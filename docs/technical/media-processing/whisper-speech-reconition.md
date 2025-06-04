# 🧠 Whisper Speech Recognition

This explains how Whisper is integrated to transcribe the audio for subtitle generation and upload it into the media. Handled by `whisper_transcribe` in `tasks.py`.

---

##### Input Parameters:

- `friendly_token` – Unique identifier for the media.
- `translate` – Boolean. If `True`, the output will be translated to English.
- `notify` – Boolean. If `True`, users will be notified upon transcription completion.

---

### Steps:

1. Fetch the media using `friendly_token`. Return `False` if not found.
2. Check if `language_code` is "automatic-translation" or "automatic".
3. Fetch the corresponding `Language` object.
4. Check for an existing `TranscriptionRequest` to prevent duplicate processing.
5. Create a new `TranscriptionRequest`.
6. Create a temporary working directory.
7. Convert the video to WAV format using FFmpeg:
   - Mono audio
   - 16kHz sample rate
   - PCM S16LE codec
8. If conversion fails, log and return early.
9. Run Whisper.cpp on the WAV file:
   - Generate VTT subtitles (and optionally translate to English).
10. If VTT output is created:
    - Save subtitles to the database.
    - Notify the user (if `notify=True`).
11. If Whisper fails, log the result and return `False`.

---

##### Error Handling:

- If media is not found or conversion/transcription fails, the function logs the issue and returns `False`.
- Duplicate transcription requests are prevented via database checks.
