# 📈 CinemataCMS System Performance Monitoring & Optimization Guide

This document outlines recommended procedures, tools, and practices to monitor and optimize system performance in CinemataCMS. Unless explicitly stated, integrations are suggestions, not confirmed implementations. The goal is to ensure smooth content delivery, stable backend operations, and quick response times for all users and administrators.

## 🧠 Key Monitoring Objectives (CinemataCMS Specific)
- **Server Health**: CPU, memory, disk usage, and uptime.
- **Application Performance**: Request latency, search responsiveness, and media list load time.
- **Video Delivery**: Transcoding success/failure tracking, FFmpeg log parsing, buffering rates.
- **Task Queues (Celery)**: Queue depth and processing times for media tasks (encoding, transcription, thumbnailing).
- **Database Efficiency**: Query times (especially for recommendations and search), index usage.
- **Error Tracking**: Django error logs, systemd logs, FFmpeg stderr output.
- **Traffic Patterns**: Upload surges, search bursts, API endpoint stress.

## 🔧 Current System Configuration

### Implemented Tools
| Component | Status | Configuration |
|-----------|---------|---------------|
| Django Logging | ✅ Active | `/logs/debug.log`, ERROR level |
| Celery + Redis | ✅ Active | Background task processing |
| PostgreSQL | ✅ Active | Primary database |
| Redis Cache | ✅ Active | Session and content caching |
| Debug Toolbar | ⚠️ Dev Only | Available but disabled in production |

### Suggested Additions
| Tool | Purpose | Implementation Priority |
|------|---------|------------------------|
| Prometheus + Grafana | Real-time metrics & dashboards | Medium |
| Sentry | Exception tracking | High |
| Flower | Celery monitoring UI | Low |
| pg_stat_statements | PostgreSQL query analysis | Medium |

## 📂 Log File Locations (CinemataCMS)
- **Django App Logs**: `/home/cinemata/cinematacms/logs/`
- **Celery Workers**: Systemd journal logs (`journalctl -u celery`) or custom logs
- **NGINX Access/Error Logs**: `/var/log/nginx/`
- **Media Processing (FFmpeg)**: Captured via subprocess stderr or logs per task

## 🚦 Dashboard Overview (Recommended Categories)
### 1. System Health
- CPU/Memory/Disk usage
- Network throughput

### 2. Application Performance
- API response latency (especially `/search/`, `/media/list/`)
- HTTP status codes (4xx/5xx)

### 3. Media Pipeline
- Celery task time for:
  - `encode_media`
  - `whisper_transcribe`
  - `produce_sprite_from_video`
- Task failure rates
- Original vs encoded file size ratio

### 4. Database Health
- Slow queries (`EXPLAIN ANALYZE` for search & recommendations)
- Connection count
- Lock contention

## 🔁 Optimization Procedures

### 🧩 Backend-Specific to CinemataCMS
- Use `.select_related()` and `.prefetch_related()` for media, tags, users
- Enable Redis caching (already configured)
- Audit `DEBUG=True` to ensure it’s disabled in production
- Match Gunicorn worker count to server CPU cores

### 📃 PostgreSQL Optimization
- Analyze query plans for `/search/` and recommendation modules
- Add indexes for `user_id`, `created_at`, `media_type`
- Archive historical media logs to reduce table bloat
- Avoid unbounded paginated media listings

### 📽️ Media Processing
- Track encoding times per file via `encode_media`
- Monitor FFmpeg logs for failure patterns
- Calculate average throughput per resolution
- Store transcoded media in buckets (S3/GCS recommended)

### 🌐 Frontend & Delivery
- Implement lazy loading for thumbnails
- Minify assets using Webpack or Django Compressor
- Convert preview images to WebP
- Consider CDN integration (optional)

## 🥪 Known Bottlenecks (From Code Review)
- Simultaneous uploads and transcoding during peak usage
- Search performance on large media sets
- Recommendation logic under heavy traffic
- Thumbnail sprite generation delays

## ⚙️ Maintenance Procedures

### Current Automated Tasks
- Session cleanup (weekly via Celery beat)
- Popular media refresh (every 10 hours)
- Thumbnail updates (every 30 hours)

### Manual Maintenance
- Monitor `/logs/debug.log` for errors
- Check Celery worker status via systemd
- Review encoding failure patterns
- Database maintenance (vacuuming, analyzing)

## 🔐 Security & Performance Settings

Configured in `settings.py`:
- Celery soft time limit: 2 hours
- Session cookie age: 8 hours
- CSRF token session-based
- HSTS enabled for security
- Static file serving optimized

## 📌 Implementation Notes

### Current Limitations
- No real-time monitoring dashboard
- Limited performance metrics collection
- Manual error log review required
- No automated alerting system

### Future Considerations
- Implement structured logging for better analysis
- Add performance middleware for request timing
- Consider APM (Application Performance Monitoring) tools
- Set up automated backup monitoring

---

*This guide reflects the current state of CinemataCMS based on codebase analysis. Suggested enhancements are provided for consideration but are not required implementations.*
