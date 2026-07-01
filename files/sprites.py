import logging
import math
import os
import shutil
import tempfile

from django.conf import settings
from django.core.files import File

from .helpers import get_file_name, get_file_type, run_command

logger = logging.getLogger(__name__)

SPRITE_WIDTH = 160
SPRITE_HEIGHT = 90


def resolve_sprite_interval(duration, base_interval, max_tiles):
    """Choose the spacing (in seconds) between sprite tiles for a video.

    Short videos keep ``base_interval`` (e.g. 10s). Long videos widen the spacing so the
    total tile count never exceeds ``max_tiles`` — this bounds both the number of ffmpeg
    invocations on the worker and the height of the stacked JPEG the browser must decode.
    The returned value is authoritative: it is persisted on the media and used by the
    thumbnail selector to map a chosen tile (index i) back to its timestamp (i * interval),
    so it MUST match the spacing actually used to extract the tiles.
    """
    base_interval = max(1, int(base_interval or 1))
    if duration <= 0 or max_tiles <= 0:
        return base_interval
    # ceil(duration / max_tiles) is the smallest interval that keeps tile count <= max_tiles.
    min_interval_for_cap = math.ceil(duration / max_tiles)
    return max(base_interval, min_interval_for_cap)


def _command_exists(command):
    if os.path.sep in command:
        return os.path.isfile(command) and os.access(command, os.X_OK)
    return shutil.which(command) is not None


def resolve_imagemagick_command():
    configured_command = getattr(settings, "IMAGEMAGICK_COMMAND", None)
    if configured_command:
        if _command_exists(configured_command):
            return [configured_command]
        return None

    convert_command = shutil.which("convert")
    if convert_command:
        return [convert_command]

    magick_command = shutil.which("magick")
    if magick_command:
        return [magick_command]

    return None


def _media_file_path(media):
    try:
        if not media.media_file:
            return None
        return media.media_file.path
    except (NotImplementedError, ValueError):
        return None


def _failure(media, reason, error=None):
    result = {
        "ok": False,
        "reason": reason,
        "friendly_token": getattr(media, "friendly_token", None),
    }
    if error:
        result["error"] = error
    return result


def generate_sprite_for_media(media):
    if media.media_type != "video":
        return _failure(media, "not_video")

    ffmpeg_command = getattr(settings, "FFMPEG_COMMAND", None)
    if not ffmpeg_command or not _command_exists(ffmpeg_command):
        return _failure(media, "missing_ffmpeg")

    imagemagick_command = resolve_imagemagick_command()
    if not imagemagick_command:
        return _failure(media, "missing_imagemagick")

    temp_directory = getattr(settings, "TEMP_DIRECTORY", None)
    if not temp_directory or not os.path.isdir(temp_directory) or not os.access(temp_directory, os.W_OK):
        return _failure(media, "missing_temp_directory")

    media_file_path = _media_file_path(media)
    if not media_file_path or not os.path.exists(media_file_path):
        return _failure(media, "missing_media_file")

    with tempfile.TemporaryDirectory(dir=temp_directory) as tmpdirname:
        output_name = os.path.join(tmpdirname, "sprites.jpg")

        base_interval = getattr(settings, "SPRITE_NUM_SECS", 10)
        max_tiles = getattr(settings, "SPRITE_MAX_TILES", 100)

        # Extract each sprite tile at an EXACT timestamp (i * sprite_num_secs) using the
        # same `-ss <time> -i <file> -vframes 1` input-seek mechanism the poster uses in
        # Media.produce_thumbnails_from_video(). The previous `fps=1/N` approach decoded
        # frames on a different seek model than the poster's input-seek (which snaps to the
        # nearest keyframe), so the tile a user clicked and the poster generated for that
        # same second could be different frames. Extracting both the same way guarantees
        # that selecting tile `i` (time i*sprite_num_secs) yields exactly that poster.
        duration = int(getattr(media, "duration", 0) or 0)
        if duration <= 0:
            return _failure(media, "missing_duration")

        # Widen the spacing for long videos so the tile count stays bounded. The interval
        # used here is persisted on the media (sprite_num_secs) and surfaced to the client
        # so the chosen tile maps to the correct poster timestamp. See resolve_sprite_interval.
        sprite_num_secs = resolve_sprite_interval(duration, base_interval, max_tiles)

        timestamps = list(range(0, duration, sprite_num_secs))
        if not timestamps:
            timestamps = [0]

        last_ffmpeg_error = None
        # A single failed frame must NOT abort the whole job — for long/large files an
        # occasional seek failure near EOF is expected, and a partial sheet is far better
        # than none. But the thumbnail selector maps tile position i back to time
        # i*sprite_num_secs, so the surviving tiles must stay aligned to their original
        # positions. We therefore keep the contiguous run of tiles from index 0 and STOP
        # at the first failure (truncating the tail) rather than renumbering past a gap,
        # which would shift every later tile onto the wrong timestamp.
        image_files = []
        for index, timestamp in enumerate(timestamps):
            frame_path = os.path.join(tmpdirname, f"img{index:03d}.jpg")
            ffmpeg_cmd = [
                ffmpeg_command,
                "-threads",
                "1",
                "-ss",
                str(timestamp),  # input seek: -ss before -i, matching the poster command
                "-i",
                media_file_path,
                "-vframes",
                "1",
                "-vf",
                # Fit the frame inside SPRITE_WIDTH x SPRITE_HEIGHT preserving aspect ratio, then
                # pad to the exact box (letterbox/pillarbox). Two reasons:
                #   1. A bare `scale=W:H` force-stretches non-16:9 sources (e.g. vertical 9:16
                #      videos get horizontally squashed).
                #   2. It guarantees EVERY tile is exactly SPRITE_HEIGHT tall, so the stacked
                #      sheet is a clean rows*SPRITE_HEIGHT column. The client slices tiles on a
                #      fixed SPRITE_HEIGHT grid; a tile that came back a few pixels short (e.g. a
                #      frame near EOF) otherwise makes the last frame render resized.
                (
                    f"scale={SPRITE_WIDTH}:{SPRITE_HEIGHT}:force_original_aspect_ratio=decrease,"
                    f"pad={SPRITE_WIDTH}:{SPRITE_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black"
                ),
                "-y",
                frame_path,
            ]
            ffmpeg_result = run_command(ffmpeg_cmd)
            if os.path.exists(frame_path):
                image_files.append(frame_path)
            else:
                last_ffmpeg_error = ffmpeg_result.get("error")
                logger.warning(
                    "Sprite generation for media %s stopped at frame %d/%d (error: %s)",
                    getattr(media, "friendly_token", None),
                    index,
                    len(timestamps),
                    last_ffmpeg_error,
                )
                break

        if not image_files:
            return _failure(media, "ffmpeg_no_frames", last_ffmpeg_error)

        convert_cmd = [
            *imagemagick_command,
            *image_files,
            "-append",
            output_name,
        ]
        convert_result = run_command(convert_cmd)

        if not os.path.exists(output_name):
            return _failure(media, "imagemagick_no_output", convert_result.get("error"))
        if get_file_type(output_name) != "image":
            return _failure(media, "invalid_sprite_output")

        # Persist the interval actually used so the serializer can report it per-media and
        # the selector maps tiles to the correct timestamps. Set it before sprites.save()
        # so the FileField save also writes the column in one round-trip.
        media.sprite_num_secs = sprite_num_secs
        with open(output_name, "rb") as sprite_file:
            media.sprites.save(
                content=File(sprite_file),
                name=get_file_name(media_file_path) + "sprites.jpg",
            )

    if not media.sprites:
        return _failure(media, "sprite_not_saved")

    return {
        "ok": True,
        "reason": None,
        "friendly_token": media.friendly_token,
        "sprite_num_secs": sprite_num_secs,
        "sprites": media.sprites.name,
    }
