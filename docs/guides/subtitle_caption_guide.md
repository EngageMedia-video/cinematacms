# Subtitle and Caption Guide: Creation, Management, and Formatting

This guide outlines best practices and technical details for creating, formatting, and managing subtitles and captions for videos uploaded to CinemataCMS. Proper implementation enhances accessibility, audience reach, and content discoverability.

---

## 🎯 Purpose

Subtitles and captions help:
- Provide access for viewers who are deaf or hard of hearing
- Expand content reach to multilingual audiences
- Aid understanding in noisy or sound-off environments
- Improve content visibility in search results

---

## 📁 Supported Subtitle Formats

| Format | Description                             |
|--------|-----------------------------------------|
| `.srt` | SubRip Subtitle – most commonly used    |
| `.vtt` | WebVTT – used in HTML5 video playback   |

> 📌 **Recommendation**: Use `.srt` for maximum compatibility unless `.vtt` is required.

---

## 🛠 Tools for Creating Subtitles

### Online Tools
- [Amara](https://amara.org/)
- [Subtitle Edit Online](https://www.nikse.dk/SubtitleEdit/Online)

### Desktop Applications
- [Aegisub](http://www.aegisub.org/)
- [Subtitle Edit (Windows)](https://github.com/SubtitleEdit/subtitleedit)
- [Jubler (Mac/Linux)](http://www.jubler.org/)

### Command Line
- [`ffmpeg`](https://ffmpeg.org/) – to extract or embed subtitles

---

## ✅ Subtitle Formatting Best Practices

### Example `.srt` Format

```
1
00:00:00,000 --> 00:00:04,000
Welcome to our documentary on coastal communities.

2
00:00:04,001 --> 00:00:07,500
These communities are on the frontlines of climate change.
```

### Key Guidelines

- Use time format: `HH:MM:SS,MS`
- No overlapping timecodes
- Limit to 1–2 lines per subtitle entry
- Use proper grammar and punctuation
- Avoid ALL CAPS unless indicating SHOUTING
- For non-speech audio:
  - Use brackets: `[music playing]`, `[laughter]`, `[inaudible]`

---

## 🌍 Multi-language Subtitle Support

You can upload multiple subtitle files per video. Use a clear naming convention:

```
film.en.srt       # English  
film.id.srt       # Indonesian  
film.fr.srt       # French  
```

Use ISO 639-1 language codes.

---

## 🔧 Subtitle Management in CinemataCMS

### Uploading Subtitles
1. Go to the **Edit Video** page
2. Click **Add Subtitle**
3. Upload a `.srt` or `.vtt` file and select the correct language
4. Save changes

### Editing or Removing Subtitles
- Subtitles can be replaced or removed anytime from the same interface
- Always retest video playback after updating subtitle files

---

## 📋 Accessibility Tips

- Provide subtitles in at least one major audience language
- Include **closed captions** (CC) for key audio cues: speaker ID, sound effects, music
- Use high-contrast colors for readability (handled by the video player theme)

---

## 🔍 Subtitle Validation Tools

Validate your subtitle files with:
- [Subtitle Tools Validator](https://subtitletools.com/)
- [Online Subtitle Checker](https://www.nikse.dk/SubtitleEdit/Online)

---

## 🔁 Checklist

- [x] File format is `.srt` or `.vtt`  
- [x] Timestamps are synchronized and non-overlapping  
- [x] Language code included in file name  
- [x] Subtitle content matches spoken audio  
- [x] Tested locally before upload  
