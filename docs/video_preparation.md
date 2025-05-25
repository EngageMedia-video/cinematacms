# Technical Specifications Guide for Optimal Video Preparation

To ensure your video uploads to CinemataCMS are processed smoothly and deliver the best playback experience across devices and networks, please follow the technical guidelines below.

---

## 📁 File Format and Container

- **Preferred Container**: `.mp4`
- **Alternative Supported Formats**: `.mov`, `.webm`, `.mkv`, `.avi` *(note: some may require re-encoding for optimal playback)*

---

## 🎞 Video Specifications

| Parameter         | Recommendation                          |
|------------------|------------------------------------------|
| **Codec**        | H.264 (AVC)                              |
| **Resolution**   | 1920x1080 (1080p) or 1280x720 (720p)     |
| **Bitrate**      | 5,000 kbps (HD), 2,500 kbps (SD)         |
| **Frame Rate**   | 24, 25, or 30 fps (constant frame rate)  |
| **Aspect Ratio** | 16:9 preferred                           |
| **Scan Type**    | Progressive (not interlaced)             |
| **Max File Size**| 4 GB (configurable)                                     |

---

## 🔊 Audio Specifications

| Parameter        | Recommendation             |
|-----------------|-----------------------------|
| **Codec**       | AAC                         |
| **Bitrate**     | 128 kbps or higher          |
| **Sample Rate** | 44.1 kHz or 48 kHz          |
| **Channels**    | Stereo                      |

---

## 🌐 Subtitles and Captions

- **Recommended Format**: `.srt` or `.vtt`
- **Tips**:
  - Ensure subtitles are synced with the video.
  - Name subtitle files clearly, e.g., `myfilm.en.srt` for English.

---

## 🛠 Encoding Tips

Use tools like **HandBrake**, **FFmpeg**, or **Shutter Encoder** to convert and compress videos before upload.

### HandBrake Recommended Settings:
- Preset: `Fast 1080p30`
- Video Codec: `H.264 (x264)`
- Constant Quality: `RF 20` (lower = better quality)

---

## ✅ Pre-upload Checklist

- [x] Video file is in `.mov`, `.webm`, `.mkv`, `.avi` formats  
- [x] Uses H.264 video and AAC audio codecs  
- [x] File size under 4 GB  
- [x] Subtitles (if any) are in `.srt` or `.vtt`  
- [x] Video plays correctly on local devices  
- [x] Metadata is filled in (optional but helpful)  

---

## 📤 Upload Tips

- Use a stable internet connection when uploading large files.
- Avoid special characters in filenames (use only letters, numbers, dashes, and underscores).
- Test your file locally to verify it plays without issues before uploading.
