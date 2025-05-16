# Troubleshooting Guide for CinemataCMS Administrators

This guide provides solutions to common issues administrators may face when managing **CinemataCMS**. It covers login problems, media errors, database faults, and deployment issues, along with debugging methods and best practices.

---

## Access and Login Issues

### Problem: Admin cannot log in to the Django Admin Panel
- **Cause**: User is not marked as `is_staff`.
- **Solution**: 
  1. Enter the Django shell:  
     `python3 manage.py shell`
  2. Run:  
     ```python
     from django.contrib.auth import get_user_model  
     User = get_user_model()  
     user = User.objects.get(username="your_username")  
     user.is_staff = True  
     user.save()
     ```
  3. Exit shell and try again.

### Problem: Superuser access not available
- **Cause**: User account lacks `is_superuser`.
- **Solution**:
  - Run the same as above but set `user.is_superuser = True`.

---

## Media Upload and Processing Problems

### Problem: Video upload fails or hangs
- **Cause**: Transcoding error, file size limit, or unsupported format.
- **Solution**:
  - Check logs (`media.log` or `gunicorn.log`) for `ffmpeg` errors.
  - Ensure `ffmpeg` is installed and accessible.
  - Verify media file extensions are allowed.

### Problem: Thumbnails or previews not generated
- **Cause**: Missing dependencies or incorrect job worker config.
- **Solution**:
  - Check background task runner logs (e.g., Celery).
  - Make sure `ffmpeg`, `imagemagick`, and any required libraries are installed.

---

## Database and Application Errors

### Problem: “OperationalError: could not connect to server”
- **Cause**: PostgreSQL service is down or misconfigured.
- **Solution**:
  - Restart PostgreSQL: `sudo systemctl restart postgresql`
  - Check `settings.py` for correct database credentials.

### Problem: Migration errors after updates
- **Solution**:
  - Run:  
    ```bash
    python3 manage.py makemigrations
    python3 manage.py migrate
    ```

---

## Performance and Resource Bottlenecks

### Problem: Site is slow or crashes under load
- **Cause**: Insufficient resources, unoptimized queries, or too many workers.
- **Solution**:
  - Use `htop` or `top` to check CPU and memory usage.
  - Enable caching via Redis or Memcached.
  - Review slow queries in PostgreSQL.

### Problem: High CPU during video uploads
- **Solution**:
  - Limit concurrent transcoding jobs.
  - Move transcoding to background using Celery or a queue system.

---

## Admin Panel Issues

### Problem: Pages not rendering correctly
- **Cause**: Static files not collected or outdated.
- **Solution**:
  - Run: `python3 manage.py collectstatic`
  - Restart the server.

### Problem: Admin panel is blank or throws 500 error
- **Cause**: Template error, missing database fields, or Python exception.
- **Solution**:
  - Check the error logs.
  - Revert recent template changes or fix missing data fields.

---

## Service and Deployment Failures

### Problem: `mediacms` service fails to start
- **Solution**:
  - Run: `sudo systemctl status mediacms`
  - Check logs in `/var/log/mediacms/` for details.
  - Make sure `.env` and config files are correct.

### Problem: Changes not applied after update
- **Solution**:
  - Restart the server:
    ```bash
    sudo systemctl restart mediacms
    sudo systemctl restart nginx
    ```

---
