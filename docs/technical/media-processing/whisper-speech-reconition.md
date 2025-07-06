# 🧠 Whisper Speech Recognition

This explains how Whisper is integrated to transcribe the audio for subtitle generation and upload it into the media. Handled by `whisper_transcribe` in `tasks.py`.

---

## Admin Management

### Re-running Failed Transcriptions

To re-run Whisper transcription when it fails or needs updating:

**Step 1: Delete Existing Subtitles First**
Before deleting transcription requests, remove any existing subtitles:

**Option A - Via Edit Media Interface:**
1. Go to Edit Media page for your video
2. Click "Edit Subtitle" 
3. Delete existing subtitle files
4. Look for "Auto-detect & Translate to English" subtitles and delete them

**Option B - Via Django Admin:**
1. Go to `/admin/files/subtitle/`
2. Find subtitles for your media
3. Delete the subtitle records

**Step 2: Delete Transcription Requests**
1. Go to `/admin/files/transcriptionrequest/`
2. Find the failed transcription request(s)
3. Select the checkbox(es) next to the requests
4. Choose "Delete requests (enable retranscoding)" from the Actions dropdown
5. Click "Go"
6. You'll see a success message confirming deletion

**Step 3: Retry Transcription**
1. Go back to the Edit Media page
2. The "Translate to English" checkbox should now be unchecked
3. Check the transcription option you want and save
4. Whisper will start processing again

### TranscriptionRequest Admin Interface

The admin interface provides:
- **List View**: Media title, date, language, country, translation status
- **Search**: Filter by media title
- **Filters**: Translation status and date
- **Bulk Actions**: Delete multiple requests at once
- **Status Monitoring**: See all transcription requests in one place

---

## Model Configuration

CinemataCMS uses the **ggml-base.bin** model by default for optimal memory efficiency and broad compatibility. This model provides good transcription quality while using approximately 1GB of RAM.

### Default Model: Base
- **Memory Usage**: ~1GB RAM
- **Accuracy**: Good quality transcription for the English language; Below-average to average for Tagalog, Bahasa Indonesia (ongoing tests)
- **Use Case**: Recommended for most development and production environments
- **Location**: Automatically detected via `settings_utils.py`

### Alternative Models Available

| Model | Memory Usage | Accuracy | Download Command |
|-------|-------------|----------|------------------|
| `ggml-tiny.bin` | ~100MB | Basic | `bash ./models/download-ggml-model.sh tiny` |
| `ggml-base.bin` | ~1GB | **Good (Default)** | `bash ./models/download-ggml-model.sh base` |
| `ggml-small.bin` | ~500MB | Better | `bash ./models/download-ggml-model.sh small` |
| `ggml-large-v3.bin` | ~3-4GB | Highest | `bash ./models/download-ggml-model.sh large-v3` |

### Changing Models

To use a different model:

1. **Download the desired model:**
   ```bash
   cd /path/to/whisper.cpp
   bash ./models/download-ggml-model.sh large-v3  # or other model
   ```

2. **Update `cms/settings_utils.py`:**
   ```python
   # Change this line to use your preferred model
   whisper_cpp_model = str(whisper_cpp_dir / "models" / "ggml-large-v3.bin")
   ```

3. **Restart Celery workers:**
   ```bash
   pkill -f "celery.*whisper"
   celery -A cms worker --loglevel=info --queues=whisper_tasks --concurrency=1
   ```

> **⚠️ Memory Warning**: The large-v3 model requires 3-4GB of available RAM. Systems with less than 4GB total RAM should use the base or smaller models to avoid out-of-memory errors.

---

## Input Parameters

- `friendly_token` – Unique identifier for the media.
- `translate` – Boolean. If `True`, the output will be translated to English.
- `notify` – Boolean. If `True`, users will be notified upon transcription completion.

---

## Processing Steps

1. **Media Validation**: Fetch the media using `friendly_token`. Return `False` if not found.
2. **Language Setup**: Check if `language_code` is "automatic-translation" or "automatic".
3. **Language Object**: Fetch the corresponding `Language` object from database.
4. **Duplicate Prevention**: Check for existing transcription records to prevent duplicate processing.
5. **Request Creation**: Create a new transcription record for tracking.
6. **Workspace Setup**: Create a temporary working directory for processing.
7. **Audio Conversion**: Convert the video to WAV format using FFmpeg:
   - Mono audio (single channel)
   - 16kHz sample rate
   - PCM S16LE codec format
8. **Conversion Validation**: If conversion fails, log error and return early.
9. **Whisper Processing**: Run Whisper.cpp on the WAV file:
   - Generate VTT subtitles
   - Optionally translate to English if `translate=True`
   - Apply configured parameters (entropy threshold, language detection, etc.)
10. **Output Validation**: If VTT output is successfully created:
    - Save subtitles to the database as `Subtitle` object
    - Link to original media and user
    - Notify the user if `notify=True`
11. **Error Handling**: If Whisper fails, log the result and return `False`.

---

## Whisper Return Codes & Troubleshooting

### Success Codes
- **0**: ✅ **Success** - Transcription completed successfully
  - VTT file generated
  - Subtitles saved to database
  - Task completed normally

### Error Codes
- **-9**: ❌ **Out of Memory (SIGKILL)** - Process killed by system
  - **Cause**: Insufficient RAM for the selected model
  - **Solution**: Switch to a smaller model (base → small → tiny)
  - **Check**: `dmesg | grep -i "killed process"` for OOM evidence

- **1**: ❌ **General Error** - Various issues
  - Invalid command line arguments
  - Model file not found
  - Audio file corruption
  - **Solution**: Check logs for specific error messages

- **2**: ❌ **File Not Found** - Input/model files missing
  - **Cause**: Audio file or model file doesn't exist
  - **Solution**: Verify file paths and model installation

- **126**: ❌ **Permission Denied** - Execution permission issues
  - **Cause**: whisper-cli binary not executable
  - **Solution**: `chmod +x /path/to/whisper-cli`

- **127**: ❌ **Command Not Found** - Binary path issues
  - **Cause**: whisper-cli not found at specified path
  - **Solution**: Verify `WHISPER_CPP_COMMAND` path in settings

### Memory Monitoring

```bash
# Check available memory before transcription
free -h

# Monitor whisper process during execution
top -p $(pgrep whisper-cli)

# Check for out-of-memory kills
sudo dmesg | grep -i "killed process" | tail -10
```

### Debug Commands

```bash
# Test whisper-cli manually
/path/to/whisper-cli --help

# Test with small audio file
/path/to/whisper-cli -m /path/to/model.bin -f test.wav --output-vtt

# Check model file exists
ls -la /path/to/whisper.cpp/models/ggml-*.bin
```

---

## Error Handling & Recovery

### Automatic Error Prevention
- **Memory Checks**: System validates available RAM before processing
- **Duplicate Prevention**: Database checks prevent duplicate processing
- **File Validation**: Checks for model and audio file existence
- **Timeout Protection**: Process timeouts prevent hanging tasks

### Manual Recovery
- **Clear Stuck Tasks**: Restart Celery workers if tasks get stuck
- **Model Switching**: Change to smaller model for memory-constrained systems
- **Admin Interface**: Use `/admin/files/transcriptionrequest/` to manage failed requests

### Logging
All transcription attempts are logged with:
- Start/completion times
- Memory usage
- Command executed
- Error messages
- Return codes

Log files located at: `/path/to/cinematacms/logs/`

---

## Performance Optimization

### Memory-Efficient Configuration
```python
# Optimal settings for limited memory systems
whisper_cmd_conf = [
    "--entropy-thold", "2.8",
    "--max-context", "0",
    "--language", "auto",
    "--threads", "1",        # Single thread
    "--best-of", "1",        # Minimal beam search
    "--beam-size", "1"       # Reduce memory usage
]
```

### Production Recommendations
- **2GB RAM systems**: Use `ggml-base.bin` or smaller
- **4GB+ RAM systems**: Can use `ggml-large-v3.bin` for better accuracy
- **Concurrent Processing**: Limit to 1 whisper task at a time (`--concurrency=1`)
- **Monitoring**: Set up alerts for OOM conditions

---

## Integration Notes

- **Celery Queue**: Uses dedicated `whisper_tasks` queue
- **Database Models**: Creates transcription and subtitle records
- **File Storage**: VTT files stored in Django media storage
- **User Notifications**: Integrated with CinemataCMS notification system
- **API Integration**: Results accessible via Media API endpoints
- **Admin Management**: Full admin interface for transcription request management

For additional troubleshooting and advanced configuration, see the [Whisper.cpp Integration Fix Documentation](../technical/whisper-cpp-integration-fix.md).
