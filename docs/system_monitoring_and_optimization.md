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

## 🔧 Core Tools & Services (Planned / Suggested)

| Tool / Stack              | Purpose                                  | Status                    |
|--------------------------|------------------------------------------|---------------------------|
| Prometheus + Grafana     | Real-time server metrics and dashboards  | Not implemented – Suggested |
| Sentry                   | Exception/error tracking                 | Not implemented – Suggested |
| Django Debug Toolbar     | Development profiling of queries/views   | Dev-only – Optional       |
| Celery + Flower          | Task queue and job queue insights        | Not implemented – Suggested |
| PostgreSQL Logs + pg_stat_statements | Database profiling             | Available, verify activation |
| NGINX Logs + GoAccess    | Web server traffic stats                 | Partially available       |
| UptimeRobot / StatusCake | Public uptime/SSL checks                 | Not in use                |

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

## ⚙️ Routine Maintenance Schedule

| Task                             | Frequency         |
|----------------------------------|-------------------|
| Check system logs and dashboard  | Daily             |
| Review Django errors             | Daily             |
| Restart Celery if worker hangs   | Weekly (or as needed) |
| Vacuum & analyze PostgreSQL      | Weekly            |
| Check encoding failure rate      | Weekly            |
| Audit query logs                 | Monthly           |
| Load test `/media/list/` & `/search/` | Quarterly     |

## 🔐 Alerting & Incident Response (To Be Implemented)
- Use Prometheus Alertmanager or cloud provider alerts for thresholds (CPU > 80%, DB latency > 500ms).
- Integrate alerts with Slack/Email/Discord for real-time notifications.
- Define incident severity levels and escalation contacts.
- Maintain an internal runbook for known issues and step-by-step recovery procedures, such as:
  - Restarting Celery workers
  - Clearing stalled task queues
  - Debugging failed encodings (FFmpeg)
  - Rolling back problematic deployments

## 📌 Notes for Implementation Team
- Tools like Prometheus/Sentry/Flower are not yet implemented. This document treats them as recommended integrations.
- Future versions should reflect actual metrics from production.
- Coordinate with DevOps for log shipping and visualization pipeline if monitoring stack is pursued.

## 🔍 For future updates
- Document actual performance baselines, encoding durations, and storage growth curves.
