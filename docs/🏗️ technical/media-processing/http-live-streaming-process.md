## 🌐 HLS (HTTP Live Streaming)

This section explains how HLS support is implemented using FFmpeg. This enables adaptable bitrate streaming. Allowing the user to switch to different resolutions during playback based on internet speed and device capabilities.

---

### 🧰 HLS Preparation

HLS generation is part of the `encode_media` task when the target output format is `.m3u8`.

##### Inputs:

- `profile` – Must include target extension `.m3u8`
- `friendly_token` – Used to find the correct media
- `output_dir` – Location where playlist and segment files are saved
- `segment_time` – Duration (in seconds) of each segment (default: 4s)

##### Workflow:

1. Build FFmpeg command with HLS flags:
    - `-hls_time <segment_time>`
    - `-hls_playlist_type vod`
    - `-hls_segment_filename` for naming segments
2. Output a master playlist (`.m3u8`) with media segments (`.ts`).
3. Playlist and segments are saved in `media/hls/<friendly_token>/`.

### ⚠️ Notes

- FFmpeg handles segmenting automatically based on `-hls_time`.
- For adaptable bitrate streaming, you can generate multiple `.m3u8` variants and combine them into a master playlist.
- CDN or web server must support byte-range requests or serve `.ts` segments and `.m3u8` playlist files directly.
