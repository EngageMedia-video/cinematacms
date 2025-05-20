# 📼 Video Processing (`tasks.py`)

This outlines how encoding and optional chunking of uploaded video files is being handled. FFmpeg is the tool used to handle video encoding and chunking. Celery, on the other hand, is used to schedule and run background video processing tasks. [Whisper](whisper-speech-reconition.md) is used for speech recognition to transcribe the dialogue of the video.

---

## 📌 Overview

The encoding pipeline is composed of two main Celery tasks:

1. `chunkize_media`
2. `encode_media`

These functions run asynchronously in the background to offload heavy processing operations from the main application, as explained below.

---

### 🛠️ Tasks

#### Chunking

- Handled by `chunkize_media`, which takes a single media file and attempts to segment it using FFmpeg.

##### Input Parameters:

- `friendly_token` – Unique identifier for the media.
- `profiles` – List of encoding profiles to use.
- `force` – Used to force the encoding even though it was previously attempted.

##### Workflow:

1. Media is fetched with `friendly_token`.
2. FFmpeg command is built to chunk the file.
3. Chunk data is saved with MD5 hash in order to prevent duplicate work.
4. `encode_media` is queued for each chunk-profile combo.

##### Fallback:

- If chunking fails, defaults to non-chunked encoding.

---

#### Encoding

- Handled by `encode_media`, which encodes a media file or chunk with the specified profile.

##### Inputs:

- `friendly_token`: Media identifier  
- `profile_id`: Encoding profile ID  
- `encoding_id`: DB ID for the encoding  
- `encoding_url`: Callback or status endpoint  
- `force`: Force re-encoding  
- `chunk`: Boolean for chunked input  
- `chunk_file_path`: If chunked, path to chunk file

##### Workflow:

1. Media and profile are retrieved from the database.
2. Skip if duplicate chunk exists.
3. For `.gif` targets, use a different FFmpeg command.
4. For video:  
    - Generate 1- or 2-pass FFmpeg command.  
    - Encode using `FFmpegBackend`.  
    - Track and log encoding progress.  
    - Save result or log error.

##### Error Handling:

- Update database on failure  
- Subprocess is killed if revoked

---

## 🧱 Supporting Components

### `EncodingTask`

Custom Celery task base.  
Handles clean-up and DB updates on failure.

### 🔧 Utility Functions

- `run_command`: Executes shell commands.
- `produce_ffmpeg_commands`: Generates FFmpeg CLI per profile.
- `create_temp_file`: Sets up temp files.
- `calculate_seconds`: Parses FFmpeg logs.
- `FFmpegBackend`: Handles FFmpeg execution.
