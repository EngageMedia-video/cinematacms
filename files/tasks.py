import json
import os
import random
import re
import shutil
import subprocess
import tempfile
import time
from datetime import datetime, timedelta

import requests
from celery import Task
from celery import shared_task as task
from celery.exceptions import SoftTimeLimitExceeded
from celery.signals import task_revoked

# from celery.task.control import revoke
from celery.utils.log import get_task_logger
from django.conf import settings
from django.core.cache import cache
from django.core.files import File
from django.db.models import F, Q

from actions.models import USER_MEDIA_ACTIONS, MediaAction
from users.models import User

from .backends import FFmpegBackend
from .exceptions import VideoEncodingError
from .helpers import (
    calculate_seconds,
    create_temp_file,
    get_file_name,
    get_file_type,
    media_file_info,
    produce_ffmpeg_commands,
    produce_friendly_token,
    rm_file,
    run_command,
)
from .methods import list_tasks, notify_users, pre_save_action
from .models import (
    Category,
    EncodeProfile,
    Encoding,
    Language,
    Media,
    MediaCountry,
    MediaLanguage,
    Subtitle,
    Tag,
    Topic,
    TranscriptionRequest,
)

logger = get_task_logger(__name__)

VALID_USER_ACTIONS = [action for action, name in USER_MEDIA_ACTIONS]

ERRORS_LIST = [
    "Output file is empty, nothing was encoded",
    "Invalid data found when processing input",
    "Unable to find a suitable output format for",
]


def mask_email(email):
    """
    Mask an email address for safe logging (PII protection).

    Returns a deterministic masked representation that allows correlation
    without exposing the full email address.

    Examples:
        "user@example.com" -> "us***@ex***.com"
        "ab@test.org" -> "ab***@te***.org"
        "invalid" -> "inv***@***.***"

    Args:
        email: Email address to mask

    Returns:
        str: Masked email representation
    """
    if not email or not isinstance(email, str):
        return "***@***.***"

    try:
        if "@" not in email:
            # Invalid email format - show first 3 chars only
            prefix = email[:3] if len(email) >= 3 else email
            return f"{prefix}***@***.***"

        local, domain = email.rsplit("@", 1)

        # Mask local part: show first 2 chars
        if len(local) >= 2:
            masked_local = local[:2] + "***"
        else:
            masked_local = local + "***"

        # Mask domain: show first 2 chars of domain name + TLD
        if "." in domain:
            domain_name, tld = domain.rsplit(".", 1)
            if len(domain_name) >= 2:
                masked_domain = domain_name[:2] + "***." + tld
            else:
                masked_domain = domain_name + "***." + tld
        else:
            masked_domain = domain[:2] + "***" if len(domain) >= 2 else domain + "***"

        return f"{masked_local}@{masked_domain}"

    except Exception:
        # Fallback for any unexpected format
        return "***@***.***"


@task(name="chunkize_media", bind=True, queue="short_tasks", soft_time_limit=60 * 30)
def chunkize_media(self, friendly_token, profiles, force=True):
    profiles = [EncodeProfile.objects.get(id=profile) for profile in profiles]
    media = Media.objects.get(friendly_token=friendly_token)
    cwd = os.path.dirname(os.path.realpath(media.media_file.path))
    file_name = media.media_file.path.split("/")[-1]
    random_prefix = produce_friendly_token()
    file_format = "{0}_{1}".format(random_prefix, file_name)
    chunks_file_name = "%02d_{0}".format(file_format)
    chunks_file_name += ".mkv"  # EXPERIMENT # WERNER Speaking!!!
    cmd = [
        settings.FFMPEG_COMMAND,
        "-y",
        "-i",
        media.media_file.path,
        "-c",
        "copy",
        "-f",
        "segment",
        "-segment_time",
        str(settings.VIDEO_CHUNKS_DURATION),
        chunks_file_name,
    ]
    chunks = []
    ret = run_command(cmd, cwd=cwd)
    # means ffmpeg resulted in running without fail - output is on stderr
    if "out" in ret.keys():
        for line in ret.get("error").split("\n"):
            ch = re.findall(r"Opening \'([\W\w]+)\' for writing", line)
            if ch:
                chunks.append(ch[0])
    if not chunks:
        # command completely failed to segment file.putting to normal encode
        logger.info(
            "Failed to break file {0} in chunks. Putting to normal encode queue".format(
                friendly_token
            )
        )
        for profile in profiles:
            if media.video_height and media.video_height < profile.resolution:
                if not profile.resolution in settings.MINIMUM_RESOLUTIONS_TO_ENCODE:
                    continue
            encoding = Encoding(media=media, profile=profile)
            encoding.save()
            enc_url = settings.SSL_FRONTEND_HOST + encoding.get_absolute_url()
            encode_media.delay(
                friendly_token, profile.id, encoding.id, enc_url, force=force
            )
        return False

    chunks = [os.path.join(cwd, ch) for ch in chunks]
    to_profiles = []
    chunks_dict = {}
    # calculate once md5sums
    for chunk in chunks:
        cmd = ["md5sum", chunk]
        stdout = run_command(cmd).get("out")
        md5sum = stdout.strip().split()[0]
        chunks_dict[chunk] = md5sum

    for profile in profiles:
        if media.video_height and media.video_height < profile.resolution:
            if not profile.resolution in settings.MINIMUM_RESOLUTIONS_TO_ENCODE:
                continue
        to_profiles.append(profile)

        for chunk in chunks:
            encoding = Encoding(
                media=media,
                profile=profile,
                chunk_file_path=chunk,
                chunk=True,
                chunks_info=json.dumps(chunks_dict),
                md5sum=chunks_dict[chunk],
            )
            encoding.save()
            enc_url = settings.SSL_FRONTEND_HOST + encoding.get_absolute_url()
            if profile.resolution in settings.MINIMUM_RESOLUTIONS_TO_ENCODE:
                priority = 0
            else:
                priority = 9
            encode_media.apply_async(
                args=[friendly_token, profile.id, encoding.id, enc_url],
                kwargs={"force": force, "chunk": True, "chunk_file_path": chunk},
                priority=priority,
            )

    logger.info(
        "got {0} chunks and will encode to {1} profiles".format(
            len(chunks), to_profiles
        )
    )
    return True


class EncodingTask(Task):
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        # mainly used to run some post failure steps
        # we get here if a task is revoked
        try:
            if hasattr(self, "encoding"):
                self.encoding.status = "fail"
                self.encoding.save(update_fields=["status"])
                kill_ffmpeg_process(self.encoding.temp_file)
                if hasattr(self.encoding, "media"):
                    self.encoding.media.post_encode_actions()
        except:
            pass
        return False


@task(
    name="encode_media",
    base=EncodingTask,
    bind=True,
    queue="long_tasks",
    soft_time_limit=settings.CELERY_SOFT_TIME_LIMIT,
)
def encode_media(
    self,
    friendly_token,
    profile_id,
    encoding_id,
    encoding_url,
    force=True,
    chunk=False,
    chunk_file_path="",
):
    logger.info(
        "Encode Media started, friendly token {0}, profile id {1}, force {2}".format(
            friendly_token, profile_id, force
        )
    )
    # TODO: if called as function, not as task, what is the value for this?
    if self.request.id:
        task_id = self.request.id
    else:
        task_id = None
    try:
        media = Media.objects.get(friendly_token=friendly_token)
        profile = EncodeProfile.objects.get(id=profile_id)
    except:
        Encoding.objects.filter(id=encoding_id).delete()
        return False

    # break logic with chunk True/False
    if chunk:
        # TODO: in case a video is chunkized and this enters here many times
        # it will always run since chunk_file_path is always different
        # thus find a better way for this check
        if (
            Encoding.objects.filter(
                media=media, profile=profile, chunk_file_path=chunk_file_path
            ).count()
            > 1
            and force == False
        ):
            Encoding.objects.filter(id=encoding_id).delete()
            return False
        else:
            try:
                encoding = Encoding.objects.get(id=encoding_id)
                encoding.status = "running"
                Encoding.objects.filter(
                    media=media,
                    profile=profile,
                    chunk=True,
                    chunk_file_path=chunk_file_path,
                ).exclude(id=encoding_id).delete()
            except:
                encoding = Encoding(
                    media=media,
                    profile=profile,
                    status="running",
                    chunk=True,
                    chunk_file_path=chunk_file_path,
                )
    else:
        if (
            Encoding.objects.filter(media=media, profile=profile).count() > 1
            and force is False
        ):
            Encoding.objects.filter(id=encoding_id).delete()
            return False
        else:
            try:
                encoding = Encoding.objects.get(id=encoding_id)
                encoding.status = "running"
                Encoding.objects.filter(media=media, profile=profile).exclude(
                    id=encoding_id
                ).delete()
            except:
                encoding = Encoding(media=media, profile=profile, status="running")

    if task_id:
        encoding.task_id = task_id
    encoding.worker = "localhost"
    encoding.retries = self.request.retries
    encoding.save()

    if profile.extension == "gif":
        tf = create_temp_file(suffix=".gif")
        # -ss 5 start from 5 second. -t 25 until 25 sec
        command = [
            settings.FFMPEG_COMMAND,
            "-y",
            "-ss",
            "3",
            "-i",
            media.media_file.path,
            "-hide_banner",
            "-vf",
            "scale=344:-1:flags=lanczos,fps=1",
            "-t",
            "25",
            "-f",
            "gif",
            tf,
        ]
        ret = run_command(command)
        if os.path.exists(tf) and get_file_type(tf) == "image":
            with open(tf, "rb") as f:
                myfile = File(f)
                encoding.status = "success"
                encoding.media_file.save(content=myfile, name=tf)
                rm_file(tf)
                return True
        else:
            return False
    if chunk:
        original_media_path = chunk_file_path
    else:
        original_media_path = media.media_file.path

    if not media.duration:
        encoding.status = "fail"
        encoding.save(update_fields=["status"])
        return False

    with tempfile.TemporaryDirectory(dir=settings.TEMP_DIRECTORY) as temp_dir:
        tf = create_temp_file(suffix=".{0}".format(profile.extension), dir=temp_dir)
        tfpass = create_temp_file(suffix=".{0}".format(profile.extension), dir=temp_dir)
        ffmpeg_commands = produce_ffmpeg_commands(
            original_media_path,
            media.media_info,
            resolution=profile.resolution,
            codec=profile.codec,
            output_filename=tf,
            pass_file=tfpass,
            chunk=chunk,
        )
        if not ffmpeg_commands:
            encoding.status = "fail"
            encoding.save(update_fields=["status"])
            return False

        encoding.temp_file = tf
        encoding.commands = str(ffmpeg_commands)

        encoding.save(update_fields=["temp_file", "commands", "task_id"])

        # binding these, so they are available on on_failure
        self.encoding = encoding
        self.media = media
        # can be one-pass or two-pass
        for ffmpeg_command in ffmpeg_commands:
            ffmpeg_command = [str(s) for s in ffmpeg_command]
            encoding_backend = FFmpegBackend()
            try:
                encoding_command = encoding_backend.encode(ffmpeg_command)
                duration, n_times = 0, 0
                output = ""
                start_time = time.time()
                last_progress_time = start_time
                last_duration = -1  # Initialize with a value lower than any possible duration
                iteration_limit = 50000
                no_progress_timeout = 1800  # 30 minutes

                while encoding_command:
                    try:
                        output = next(encoding_command)
                        duration_str = calculate_seconds(output)
                        current_time = time.time()
                        n_times += 1  # Always increment

                        if duration_str is not None:
                            try:
                                new_duration = float(duration_str)
                                if new_duration > last_duration:
                                    last_progress_time = current_time  # Reset timeout on progress
                                    last_duration = new_duration

                                    percent = new_duration * 100 / media.duration
                                    if n_times % 20 == 0:
                                        encoding.progress = percent
                                        try:
                                            encoding.save(update_fields=["progress", "update_date"])
                                            logger.info("Saved {0}% (iteration {1})".format(
                                                round(percent, 2), n_times))
                                        except:
                                            pass
                            except (ValueError, TypeError):
                                # Could not parse duration, treat as no progress
                                pass
                        else:
                            # Log unparseable output for debugging
                            if n_times % 100 == 0:
                                try:
                                    encoding.save(update_fields=["update_date"])
                                    logger.info("Processing iteration {0}, no duration parsed. Output sample: {1}".format(
                                        n_times, output[:100] if output else "No output"))
                                except:
                                    pass

                        # Safety nets
                        if n_times > iteration_limit:
                            logger.error("Encoding iteration limit ({0}) exceeded".format(iteration_limit))
                            encoding_backend.terminate_process()
                            break

                        if time.time() - last_progress_time > no_progress_timeout:
                            logger.error("No progress for {0} seconds, likely stuck".format(no_progress_timeout))
                            encoding_backend.terminate_process()
                            break

                    except StopIteration:
                        break
                    except VideoEncodingError:
                        # ffmpeg error, or ffmpeg was killed
                        raise
            except Exception as e:
                try:
                    # output is empty, fail message is on the exception
                    output = e.message
                except AttributeError:
                    output = ""
                if isinstance(e, SoftTimeLimitExceeded):
                    kill_ffmpeg_process(encoding.temp_file)
                encoding.logs = output
                encoding.status = "fail"
                encoding.save(update_fields=["status", "logs"])
                raise_exception = True
                # if this is an ffmpeg's valid error
                # no need for the task to be re-run
                # otherwise rerun task...
                for error_msg in ERRORS_LIST:
                    if error_msg.lower() in output.lower():
                        raise_exception = False
                if raise_exception:
                    raise self.retry(exc=e, countdown=5, max_retries=1)

        encoding.logs = output
        encoding.progress = 100

        success = False
        encoding.status = "fail"
        if os.path.exists(tf) and os.path.getsize(tf) != 0:
            ret = media_file_info(tf)
            if ret.get("is_video") or ret.get("is_audio"):
                encoding.status = "success"
                success = True

                with open(tf, "rb") as f:
                    myfile = File(f)
                    output_name = "{0}.{1}".format(
                        get_file_name(original_media_path), profile.extension
                    )
                    encoding.media_file.save(content=myfile, name=output_name)
                encoding.total_run_time = (
                    encoding.update_date - encoding.add_date
                ).seconds

        try:
            encoding.save(
                update_fields=["status", "logs", "progress", "total_run_time"]
            )
        # this will raise a django.db.utils.DatabaseError error when task is revoked,
        # since we delete the encoding at that stage
        except:
            pass

        return success


@task(name="whisper_transcribe", queue="whisper_tasks")
def whisper_transcribe(friendly_token, translate=False, notify=True):
    """
    Transcribe media using Whisper.cpp
    """
    logger.info(
        f"Starting whisper_transcribe for {friendly_token}, translate={translate}"
    )

    # in case multiple requests arrive at the same time, avoid having them create
    # a Request for the same media...
    time.sleep(random.uniform(0, 20))

    logger.info(f"Whisper command path: {settings.WHISPER_CPP_COMMAND}")
    logger.info(f"Whisper model path: {settings.WHISPER_CPP_MODEL}")

    if not os.path.exists(settings.WHISPER_CPP_COMMAND):
        logger.error(f"Whisper command not found at: {settings.WHISPER_CPP_COMMAND}")
        return False

    if not os.path.exists(settings.WHISPER_CPP_MODEL):
        logger.error(f"Whisper model not found at: {settings.WHISPER_CPP_MODEL}")
        return False

    try:
        media = Media.objects.get(friendly_token=friendly_token)
    except Media.DoesNotExist as e:
        logger.error(f"failed to get media with friendly_token {friendly_token}: {e}")
        return False

    if not os.path.exists(media.media_file.path):
        logger.error(f"Media file not found at: {media.media_file.path}")
        return False

    if translate:
        language_code = "automatic-translation"
    else:
        language_code = "automatic"
    language = Language.objects.filter(code=language_code).first()

    if not language:
        logger.error(f"Language '{language_code}' not found in database")
        return False

    if translate:
        if TranscriptionRequest.objects.filter(
            media=media, translate_to_english=True
        ).exists():
            logger.info(f"Translation request already exists for {friendly_token}")
            return False
    else:
        if TranscriptionRequest.objects.filter(
            media=media, translate_to_english=False
        ).exists():
            logger.info(f"Transcription request already exists for {friendly_token}")
            return False

    # Create transcription request and capture it for cleanup on failure
    transcription_request = TranscriptionRequest.objects.create(
        media=media, translate_to_english=translate
    )
    logger.info(f"Created transcription request for {friendly_token}")

    try:
        with tempfile.TemporaryDirectory(dir=settings.TEMP_DIRECTORY) as tmpdirname:
            video_file_path = get_file_name(media.media_file.name)
            video_file_path = ".".join(
                video_file_path.split(".")[:-1]
            )  # needed by whisper without the extension
            subtitle_name = f"{video_file_path}"
            output_name = f"{tmpdirname}/{subtitle_name}"  # whisper.cpp will add the .vtt
            output_name_with_vtt_ending = f"{output_name}.vtt"
            wav_file = f"{tmpdirname}/{subtitle_name}.wav"

            logger.info(f"Video file path: {video_file_path}")
            logger.info(f"Output name: {output_name}")
            logger.info(f"WAV file: {wav_file}")

            # Build ffmpeg command as list to avoid shell injection and handle spaces
            ffmpeg_cmd = [
                settings.FFMPEG_COMMAND,
                "-i",
                media.media_file.path,
                "-ar",
                "16000",
                "-ac",
                "1",
                "-c:a",
                "pcm_s16le",
                wav_file,
            ]
            logger.info(f"Running ffmpeg command: {' '.join(ffmpeg_cmd)}")

            try:
                ret = subprocess.run(
                    ffmpeg_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=False
                )
                logger.info(f"ffmpeg return code: {ret.returncode}")

                if ret.returncode != 0:
                    stderr = ret.stderr.decode("utf-8")
                    logger.error(f"ffmpeg error: {stderr}")
                    transcription_request.delete()
                    return False

                if not os.path.exists(wav_file):
                    logger.error(f"WAV file not created at: {wav_file}")
                    transcription_request.delete()
                    return False

                logger.info(
                    f"WAV file created successfully: {os.path.getsize(wav_file)} bytes"
                )
            except Exception as e:
                logger.error(f"Exception running ffmpeg: {str(e)}")
                transcription_request.delete()
                return False

            # NOTE: any configurations for running the whisper transcription task should be added/removed here!
            whisper_cmd_conf = [
                "--entropy-thold",
                "2.8",
                "--max-context",
                "0",
                "--language",
                "auto",
            ]

            # Run whisper.cpp
            whisper_cmd = [
                settings.WHISPER_CPP_COMMAND,
                "-m",
                settings.WHISPER_CPP_MODEL,
                *whisper_cmd_conf,
                "-f",
                wav_file,
            ]

            if translate:
                whisper_cmd.append("--translate")

            whisper_cmd.extend(["--output-vtt", "--output-file", output_name])

            cmd_str = " ".join(whisper_cmd)
            logger.info(f"Running whisper command: {cmd_str}")

            try:
                ret = subprocess.run(
                    whisper_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE
                )
                logger.info(f"Whisper return code: {ret.returncode}")

                stdout = ret.stdout.decode("utf-8")
                stderr = ret.stderr.decode("utf-8")

                if stdout:
                    logger.info(f"Whisper stdout: {stdout}")

                if stderr:
                    logger.error(f"Whisper stderr: {stderr}")

                if ret.returncode != 0:
                    logger.error(
                        f"Whisper command failed with return code {ret.returncode}"
                    )
                    transcription_request.delete()
                    return False

                if not os.path.exists(output_name_with_vtt_ending):
                    logger.error(
                        f"Output VTT file not created at: {output_name_with_vtt_ending}"
                    )
                    transcription_request.delete()
                    return False

                logger.info(
                    f"VTT file created successfully: {os.path.getsize(output_name_with_vtt_ending)} bytes"
                )
            except Exception as e:
                logger.error(f"Exception running whisper: {str(e)}")
                transcription_request.delete()
                return False

            # Create the subtitle entry in the database
            subtitle = None
            try:
                subtitle = Subtitle.objects.create(
                    media=media, user=media.user, language=language
                )

                with open(output_name_with_vtt_ending, "rb") as f:
                    subtitle.subtitle_file.save(subtitle_name, File(f))

                logger.info("Subtitle created and saved to database")

                if notify:
                    extra_info = ""
                    if translate:
                        extra_info = "translation"
                    notify_users(
                        friendly_token=media.friendly_token,
                        action="media_auto_transcription",
                        extra=extra_info,
                    )
                    logger.info(f"Notification sent for {friendly_token}")

                # Success! Keep the transcription request
                return True
            except Exception as e:
                logger.error(f"Exception saving subtitle: {str(e)}")

                # Clean up orphaned subtitle if it was created
                if subtitle is not None:
                    try:
                        # Delete the subtitle file from storage if it exists
                        if subtitle.subtitle_file:
                            subtitle.subtitle_file.delete(save=False)
                        # Delete the subtitle database record
                        subtitle.delete()
                        logger.info("Cleaned up orphaned subtitle record and file")
                    except Exception as cleanup_error:
                        logger.error(f"Error cleaning up subtitle: {str(cleanup_error)}")

                transcription_request.delete()
                return False
    except Exception as e:
        # Catch any unexpected errors in the entire pipeline
        logger.error(f"Unexpected error in transcription pipeline: {str(e)}")
        transcription_request.delete()
        return False


@task(name="produce_sprite_from_video", queue="long_tasks")
def produce_sprite_from_video(friendly_token):
    """Produces a sprites file for a video, uses ffmpeg"""

    try:
        media = Media.objects.get(friendly_token=friendly_token)
    except BaseException:
        logger.info("failed to get media with friendly_token %s" % friendly_token)
        return False

    with tempfile.TemporaryDirectory(dir=settings.TEMP_DIRECTORY) as tmpdirname:
        try:
            tmpdir_image_files = tmpdirname + "/img%03d.jpg"
            output_name = tmpdirname + "/sprites.jpg"

            fps = getattr(settings, "SPRITE_NUM_SECS", 10)
            ffmpeg_cmd = [
                settings.FFMPEG_COMMAND,
                "-i",
                media.media_file.path,
                "-f",
                "image2",
                "-vf",
                f"fps=1/{fps}, scale=160:90",
                tmpdir_image_files,
            ]
            run_command(ffmpeg_cmd)
            image_files = [
                f
                for f in os.listdir(tmpdirname)
                if f.startswith("img") and f.endswith(".jpg")
            ]
            image_files = sorted(
                image_files, key=lambda x: int(re.search(r"\d+", x).group())
            )
            image_files = [os.path.join(tmpdirname, f) for f in image_files]
            cmd_convert = [
                "convert",
                *image_files,  # image files, unpacked into the list
                "-append",
                output_name,
            ]

            run_command(cmd_convert)

            if os.path.exists(output_name) and get_file_type(output_name) == "image":
                with open(output_name, "rb") as f:
                    myfile = File(f)
                    media.sprites.save(
                        content=myfile,
                        name=get_file_name(media.media_file.path) + "sprites.jpg",
                    )
        except BaseException:
            pass
    return True


@task(name="create_hls", queue="long_tasks")
def create_hls(friendly_token):
    if not hasattr(settings, "MP4HLS_COMMAND"):
        logger.error("Bento4 mp4hls command is missing from configuration")
        return False

    mp4hls_path = settings.MP4HLS_COMMAND
    if not os.path.exists(mp4hls_path):
        logger.error(f"Bento4 mp4hls command not found at: {mp4hls_path}")
        return False

    try:
        media = Media.objects.get(friendly_token=friendly_token)
    except:
        logger.info("failed to get media with friendly_token %s" % friendly_token)
        return False

    p = media.uid.hex
    output_dir = os.path.join(settings.HLS_DIR, p)
    encodings = media.encodings.filter(
        profile__extension="mp4", status="success", chunk=False, profile__codec="h264"
    )
    if encodings:
        existing_output_dir = None
        if os.path.exists(output_dir):
            existing_output_dir = output_dir
            output_dir = os.path.join(settings.HLS_DIR, p + produce_friendly_token())
        files = [f.media_file.path for f in encodings if f.media_file]
        cmd = [
            settings.MP4HLS_COMMAND,
            "--segment-duration=4",
            f"--output-dir={output_dir}",
            *files,
        ]
        ret = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if existing_output_dir:
            cmd = ["cp", "-rT", output_dir, existing_output_dir]
            ret = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            shutil.rmtree(output_dir)
            output_dir = existing_output_dir
        pp = os.path.join(output_dir, "master.m3u8")
        if os.path.exists(pp):
            if media.hls_file != pp:
                media.hls_file = pp
                media.save(update_fields=["hls_file"])
    return True


@task(name="media_init", queue="short_tasks")
def media_init(friendly_token):
    # run media init async
    try:
        media = Media.objects.get(friendly_token=friendly_token)
    except:
        logger.info("failed to get media with friendly_token %s" % friendly_token)
        return False
    media.media_init()

    return True


@task(name="check_running_states", queue="short_tasks")
def check_running_states():
    encodings = Encoding.objects.filter(status="running")

    logger.info("got {0} encodings that are in state running".format(encodings.count()))
    changed = 0
    for encoding in encodings:
        now = datetime.now(encoding.update_date.tzinfo)
        if (now - encoding.update_date).seconds > settings.RUNNING_STATE_STALE:
            media = encoding.media
            profile = encoding.profile
            # task_id = encoding.task_id
            # terminate task
            # if task_id:
            # revoke(task_id, terminate=True)
            encoding.delete()
            media.encode(profiles=[profile])
            logger.info("X" * 200, profile, encoding.media, encoding)
            # TODO: allign with new code + chunksize...
            changed += 1
    if changed:
        logger.info("changed from running to pending on {0} items".format(changed))
    return True


@task(name="check_media_states", queue="short_tasks")
def check_media_states():
    # check encoding status of not success media
    media = Media.objects.filter(
        Q(encoding_status="running")
        | Q(encoding_status="fail")
        | Q(encoding_status="pending")
    )

    logger.info("got {0} media that are not in state success".format(media.count()))

    changed = 0
    for m in media:
        m.set_encoding_status()
        m.save(update_fields=["encoding_status"])
        changed += 1
    if changed:
        logger.info("changed encoding status to {0} media items".format(changed))
    return True


@task(name="check_pending_states", queue="short_tasks")
def check_pending_states():
    # check encoding profiles that are on state pending and not on a queue
    encodings = Encoding.objects.filter(status="pending")

    if not encodings:
        return True

    changed = 0
    tasks = list_tasks()
    task_ids = tasks["task_ids"]
    media_profile_pairs = tasks["media_profile_pairs"]
    for encoding in encodings:
        if encoding.task_id and encoding.task_id in task_ids:
            # encoding is in one of the active/reserved/scheduled tasks list
            continue
        elif (
            encoding.media.friendly_token,
            encoding.profile.id,
        ) in media_profile_pairs:
            continue
            # encoding is in one of the reserved/scheduled tasks list.
            # has no task_id but will be run, so need to re-enter the queue
        else:
            media = encoding.media
            profile = encoding.profile
            encoding.delete()
            media.encode(profiles=[profile], force=False)
            changed += 1
    if changed:
        logger.info(
            "set to the encode queue {0} encodings that were on pending state".format(
                changed
            )
        )
    return True


@task(name="check_missing_profiles", queue="short_tasks")
def check_missing_profiles():
    # check if video files have missing profiles. If so, add them
    media = Media.objects.filter(media_type="video")
    profiles = list(EncodeProfile.objects.all())

    changed = 0

    for m in media:
        existing_profiles = [p.profile for p in m.encodings.all()]
        missing_profiles = [p for p in profiles if p not in existing_profiles]
        if missing_profiles:
            m.encode(profiles=missing_profiles, force=False)
            # since we call with force=False
            # encode_media won't delete existing profiles
            # if they appear on the meanwhile (eg on a big queue)
            changed += 1
    if changed:
        logger.info("set to the encode queue {0} profiles".format(changed))
    return True


@task(name="clear_sessions", queue="short_tasks")
def clear_sessions():
    try:
        from importlib import import_module

        from django.conf import settings

        engine = import_module(settings.SESSION_ENGINE)
        engine.SessionStore.clear_expired()
    except:
        return False
    return True


@task(name="save_user_action", queue="short_tasks")
def save_user_action(
    user_or_session, friendly_token=None, action="watch", extra_info=None
):
    if action not in VALID_USER_ACTIONS:
        return False

    try:
        media = Media.objects.get(friendly_token=friendly_token)
    except:
        return False

    user = user_or_session.get("user_id")
    session_key = user_or_session.get("user_session")
    remote_ip = user_or_session.get("remote_ip_addr")

    if user:
        try:
            user = User.objects.get(id=user)
        except:
            return False

    if (not user) and (not session_key):
        return False

    if not pre_save_action(
        media=media,
        user=user,
        session_key=session_key,
        action=action,
        remote_ip=remote_ip,
    ):
        return False

    if action == "watch":
        if user:
            MediaAction.objects.filter(user=user, media=media, action="watch").delete()
        else:
            MediaAction.objects.filter(
                session_key=session_key, media=media, action="watch"
            ).delete()
    ma = MediaAction(
        user=user,
        session_key=session_key,
        media=media,
        action=action,
        extra_info=extra_info,
        remote_ip=remote_ip,
    )
    ma.save()

    if action == "watch":
        Media.objects.filter(friendly_token=media.friendly_token).update(views=F('views') + 1)
    elif action == "report":
        Media.objects.filter(friendly_token=media.friendly_token).update(
            reported_times=F('reported_times') + 1
        )
        # Need to refresh to check the threshold
        media.refresh_from_db()
        if media.reported_times >= settings.REPORTED_TIMES_THRESHOLD:
            media.state = "private"
            media.save(update_fields=["state"])

        notify_users(
            friendly_token=media.friendly_token,
            action="media_reported",
            extra=extra_info,
        )
    elif action == "like":
        Media.objects.filter(friendly_token=media.friendly_token).update(likes=F('likes') + 1)
    elif action == "dislike":
        Media.objects.filter(friendly_token=media.friendly_token).update(dislikes=F('dislikes') + 1)

    return True


@task(name="get_list_of_popular_media", queue="long_tasks")
def get_list_of_popular_media():
    # calculate and return the top 50 popular media, based on two rules
    # X = the top 25 videos that have the most views during the last week
    # Y = the most recent 25 videos that have been liked over the last 6 months

    valid_media_x = {}
    valid_media_y = {}
    basic_query = Q(state="public", is_reviewed=True, encoding_status="success")
    media_x = Media.objects.filter(basic_query).values("friendly_token")

    period_x = datetime.now() - timedelta(days=7)
    period_y = datetime.now() - timedelta(days=30 * 6)

    for media in media_x:
        ft = media["friendly_token"]
        num = MediaAction.objects.filter(
            action_date__gte=period_x, action="watch", media__friendly_token=ft
        ).count()
        if num:
            valid_media_x[ft] = num
        num = MediaAction.objects.filter(
            action_date__gte=period_y, action="like", media__friendly_token=ft
        ).count()
        if num:
            valid_media_y[ft] = num

    x = sorted(valid_media_x.items(), key=lambda kv: kv[1], reverse=True)[:25]
    y = sorted(valid_media_y.items(), key=lambda kv: kv[1], reverse=True)[:25]

    media_ids = [a[0] for a in x]
    media_ids.extend([a[0] for a in y])
    media_ids = list(set(media_ids))
    cache.set("popular_media_ids", media_ids, 60 * 60 * 12)
    logger.info("saved popular media ids")

    return media_ids


@task(name="update_listings_thumbnails", queue="long_tasks")
def update_listings_thumbnails():
    """
    Updates thumbnails and media counts for categories, tags, topics, languages, and countries.
    Runs periodically to keep listings fresh.
    """
    from .lists import video_countries
    from .models import Language

    # Categories
    used_media = []
    saved = 0
    qs = Category.objects.filter().order_by("-media_count")
    for object in qs:
        media = (
            Media.objects.exclude(friendly_token__in=used_media)
            .filter(category=object, state="public", is_reviewed=True)
            .order_by("-views")
            .first()
        )
        if media:
            object.listings_thumbnail = media.thumbnail_url
            object.save(update_fields=["listings_thumbnail"])
            used_media.append(media.friendly_token)
            saved += 1
    logger.info("updated {} categories".format(saved))

    # Tags
    used_media = []
    saved = 0
    qs = Tag.objects.filter().order_by("-media_count")
    for object in qs:
        media = (
            Media.objects.exclude(friendly_token__in=used_media)
            .filter(tags=object, state="public", is_reviewed=True)
            .order_by("-views")
            .first()
        )
        if media:
            object.listings_thumbnail = media.thumbnail_url
            object.save(update_fields=["listings_thumbnail"])
            used_media.append(media.friendly_token)
            saved += 1
    logger.info("updated {} tags".format(saved))

    # Topics
    used_media = []
    saved = 0
    qs = Topic.objects.filter().order_by("title")
    for object in qs:
        media = (
            Media.objects.exclude(friendly_token__in=used_media)
            .filter(topics=object, state="public", is_reviewed=True)
            .order_by("-views")
            .first()
        )
        if media:
            object.listings_thumbnail = media.thumbnail_url
            object.save(update_fields=["listings_thumbnail"])
            used_media.append(media.friendly_token)
            saved += 1
    logger.info("updated {} topics".format(saved))

    # Language
    used_media = []
    saved = 0
    updated_counts = 0
    # Get language code mapping from Language model
    language_code_dict = dict(
        Language.objects.exclude(
            code__in=["automatic", "automatic-translation"]
        ).values_list("title", "code")
    )

    qs = MediaLanguage.objects.filter().order_by("-media_count")
    for object in qs:
        # Update media count
        object.update_language_media()
        updated_counts += 1

        # Update thumbnail
        language_code = language_code_dict.get(object.title)
        if not language_code:
            continue
        media = (
            Media.objects.exclude(friendly_token__in=used_media)
            .filter(media_language=language_code, state="public", is_reviewed=True)
            .order_by("-views")
            .first()
        )
        if media:
            object.listings_thumbnail = media.thumbnail_url
            object.save(update_fields=["listings_thumbnail"])
            used_media.append(media.friendly_token)
            saved += 1
    logger.info(
        "updated {} language thumbnails and {} language counts".format(
            saved, updated_counts
        )
    )

    # Country
    used_media = []
    saved = 0
    updated_counts = 0
    # Get country code mapping from lists
    video_countries_dict = dict((value, key) for (key, value) in video_countries)
    qs = MediaCountry.objects.filter().order_by("-media_count")
    for object in qs:
        # Update media count
        object.update_country_media()
        updated_counts += 1

        # Update thumbnail
        country_code = video_countries_dict.get(object.title)
        if not country_code:
            continue
        media = (
            Media.objects.exclude(friendly_token__in=used_media)
            .filter(media_country=country_code, state="public", is_reviewed=True)
            .order_by("-views")
            .first()
        )
        if media:
            object.listings_thumbnail = media.thumbnail_url
            object.save(update_fields=["listings_thumbnail"])
            used_media.append(media.friendly_token)
            saved += 1
    logger.info(
        "updated {} country thumbnails and {} country counts".format(
            saved, updated_counts
        )
    )

    return True


@task(name="start_missing_encodings", queue="short_tasks")
def start_missing_encodings():
    # TODO: check with a settings on settings, default on, if this is needed.
    # see if media file has not all encodings and set this
    # (NOT for failed, only if not exist)
    return True


# simple celery testers!
@task(name="sum_two_numbers", queue="short_tasks")
def add(x, y):
    return x + y


@task(name="sum_two_numbers_two", queue="long_tasks")
def add_two(x, y):
    return x + y


@task(name="beat_test")
def beat_test(x, y):
    return x + y


@task_revoked.connect
def task_sent_handler(sender=None, headers=None, body=None, **kwargs):
    # For encode_media tasks that are revoked,
    # ffmpeg command won't be stopped, since
    # it got started by a subprocess.
    # Need to stop that process
    # Also, removing the Encoding object,
    # since the task that would prepare it was killed
    # Maybe add a killed state for Encoding objects
    try:
        uid = kwargs["request"].task_id
        if uid:
            encoding = Encoding.objects.get(task_id=uid)
            encoding.delete()
            logger.info("deleted the Encoding object")
            if encoding.temp_file:
                kill_ffmpeg_process(encoding.temp_file)

    except:
        pass

    return True


def kill_ffmpeg_process(filepath):
    # this is not ideal, ffmpeg pid could be linked to the Encoding object
    try:
        # Use pgrep to find ffmpeg processes with the filepath
        result = subprocess.run(
            ["pgrep", "-f", f"ffmpeg.*{filepath}"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        pid = result.stdout.decode("utf-8").strip()
        if pid:
            # Kill the process
            subprocess.run(["kill", "-9", pid], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            return result
    except Exception as e:
        logger.error(f"Error killing ffmpeg process: {e}")
    return None


@task(name="remove_media_file", base=Task, queue="long_tasks")
def remove_media_file(media_file=None):
    rm_file(media_file)
    return True


# TODO LIST
# 1 chunks are deleted from original server when file is fully encoded.
# however need to enter this logic in cases of fail as well
# 2 script to delete chunks in fail status
# (and check for their encdings, and delete them as well, along with
# all chunks)
# 3 beat task, remove chunks


@task(name="cleanup_orphaned_uploads", queue="short_tasks")
def cleanup_orphaned_uploads():
    """
    Periodic task to clean up orphaned upload files.

    Cleans up:
    1. Incomplete chunks from cancelled uploads in CHUNKS_DIR
    2. Complete temp files from uploads that were never saved in UPLOAD_DIR

    Files/directories older than ORPHANED_UPLOAD_CLEANUP_HOURS are removed.
    """
    logger = get_task_logger(__name__)

    # Configurable: How old (in hours) before considering files orphaned
    cleanup_age_hours = getattr(settings, 'ORPHANED_UPLOAD_CLEANUP_HOURS', 24)
    cleanup_age_seconds = cleanup_age_hours * 3600
    current_time = time.time()

    chunks_cleaned = 0
    uploads_cleaned = 0
    errors = []

    # Clean up CHUNKS_DIR (incomplete/cancelled uploads)
    chunks_dir = os.path.join(settings.MEDIA_ROOT, settings.CHUNKS_DIR)
    if os.path.exists(chunks_dir):
        try:
            for uuid_dir in os.listdir(chunks_dir):
                dir_path = os.path.join(chunks_dir, uuid_dir)

                # Only process directories
                if not os.path.isdir(dir_path):
                    continue

                # Check if directory is old enough to be considered orphaned
                try:
                    dir_mtime = os.path.getmtime(dir_path)
                    if (current_time - dir_mtime) > cleanup_age_seconds:
                        logger.info(f"Removing orphaned chunks directory: {uuid_dir}")
                        shutil.rmtree(dir_path)
                        chunks_cleaned += 1
                except Exception as e:
                    error_msg = f"Error removing chunks directory {uuid_dir}: {e}"
                    logger.error(error_msg)
                    errors.append(error_msg)
        except Exception as e:
            error_msg = f"Error listing chunks directory: {e}"
            logger.error(error_msg)
            errors.append(error_msg)

    # Clean up UPLOAD_DIR (completed but unsaved uploads)
    upload_dir = os.path.join(settings.MEDIA_ROOT, settings.UPLOAD_DIR)
    if os.path.exists(upload_dir):
        try:
            for uuid_dir in os.listdir(upload_dir):
                dir_path = os.path.join(upload_dir, uuid_dir)

                # Only process directories
                if not os.path.isdir(dir_path):
                    continue

                # Check if directory is old enough to be considered orphaned
                try:
                    dir_mtime = os.path.getmtime(dir_path)
                    if (current_time - dir_mtime) > cleanup_age_seconds:
                        logger.info(f"Removing orphaned upload directory: {uuid_dir}")
                        shutil.rmtree(dir_path)
                        uploads_cleaned += 1
                except Exception as e:
                    error_msg = f"Error removing upload directory {uuid_dir}: {e}"
                    logger.error(error_msg)
                    errors.append(error_msg)
        except Exception as e:
            error_msg = f"Error listing upload directory: {e}"
            logger.error(error_msg)
            errors.append(error_msg)

    result = {
        'chunks_cleaned': chunks_cleaned,
        'uploads_cleaned': uploads_cleaned,
        'errors': errors
    }

    logger.info(f"Cleanup completed: {chunks_cleaned} chunk dirs, {uploads_cleaned} upload dirs removed")

    return result


@task(name="subscribe_user", queue="short_tasks")
def subscribe_user(email, name, country=None):
    """
    Subscribe user to Cinemata newsletter via WordPress Newsletter Plugin API

    Args:
        email: User's email address
        name: User's name/username
        country: User's country code (optional, for tracking)

    Returns:
        bool: True if subscription successful, False otherwise
    """
    api_url = getattr(settings, 'NEWSLETTER_API_URL', None)

    if not api_url:
        logger.warning(
            "Newsletter subscription skipped for %s: NEWSLETTER_API_URL not configured",
            mask_email(email)
        )
        return False

    # Build subscriber data for WordPress Newsletter Plugin /subscribe endpoint
    subscriber_data = {
        "email": email,
        "name": name,
        "lists": getattr(settings, 'NEWSLETTER_LIST_IDS', [2]),
        "attribute004": country if country else "",
        "send_emails": True,  # Trigger confirmation email
    }

    headers = {
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(
            api_url,
            json=subscriber_data,
            headers=headers,
            timeout=10
        )

        if response.status_code == 200:
            try:
                response_data = response.json()
            except (json.JSONDecodeError, ValueError):
                logger.error(
                    f"Newsletter subscription for {mask_email(email)}: failed to parse JSON response. "
                    f"Response content: {response.text[:200]}"
                )
                return False
            # Check if this was a new subscription or existing
            if response_data.get("_new"):
                logger.info(f"Newsletter subscription successful for {mask_email(email)} (Country: {country})")
            else:
                logger.info(f"Newsletter subscriber already exists: {mask_email(email)}")
            return True
        else:
            logger.warning(
                f"Newsletter subscription failed for {mask_email(email)}. "
                f"Status: {response.status_code}, Response: {response.text[:200]}"
            )
            return False

    except requests.exceptions.Timeout:
        logger.exception("Newsletter subscription timeout for %s", mask_email(email))
        return False
    except requests.exceptions.RequestException:
        logger.exception("Newsletter subscription error for %s", mask_email(email))
        return False
