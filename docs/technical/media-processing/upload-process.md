# Upload Process

This outlines the flow of how media uploads are handled from the frontend to the backend using Fine Uploader and Django.

### 📤 User Action
- - User has two options to navigate to the upload page which routes them to the `/upload`:
  - **"Upload Media"** on the sidebar.
  - by clicking on the upload button that appears on the header/navigation area.
---

### 🧩 Frontend Handling (Fine Uploader)
- On the upload page, Fine Uploader manages the upload process on the client side:
  - Provides a button to open a file explorer.
  - Supports drag & drop.
  - Performs file validation (size, type, etc.).
  - Displays a loader showing upload progress.
  - Sends the uploaded file to the backend via the `/uploader` endpoint.

---

### 🛠️ Backend Handling (Django)
#### File Reception
- The backend receives the uploaded file and initializes the `ChunkedFineUploader` class:
  - The filename is cleaned using `strip_delimiters(input_string)` to remove unsafe characters.
  - UUID validation is performed with `is_valid_uuid_format(uuid_string)` to ensure a valid UUID v4 format.
  - Determines whether the upload is chunked or not:
    - If `total_parts > 1` → **Chunked Upload**
    - Else → **Single Upload**

#### Saving the Upload
- **Single uploads** (a file small enough for one request) are saved directly using Django Storage.
- **Chunked uploads** go through an upload session (`uploader.UploadSession`, logic in `uploader/sessions.py`):
  - The first chunk to arrive creates the session. It binds the upload's `qquuid` to the signed-in
    account, to the target (a new media upload, or the media whose file is being replaced), and to the
    file identity: sanitized name, total size, part size, part count, and the client fingerprint
    (`qqfingerprint`).
  - Every chunk is checked against the session. A chunk from another account or target gets HTTP 403,
    a chunk of a different file gets 409, and a chunk that does not fit the file layout gets 400.
  - Chunks are written to `/chunks/<uuid>/<index>` through a temporary file and a rename, so a repeated
    chunk replaces the earlier copy and an interrupted write never leaves a short chunk.
  - The `?done` request assembles the file once. A repeated or concurrent completion returns the first
    result (`media_url`) instead of creating another media file. While another request is assembling,
    the response is a retryable 409. If a part is missing, the response asks the client to send the
    file again (`reset`).
  - When assembly or media creation fails, the session reopens and its chunks stay on disk, so another
    completion can succeed.

#### Retries and resume
- All three upload flows (single upload, bulk upload, and file replacement on the edit page) build Fine
  Uploader through `frontend/src/features/shared/utils/resumableUpload.js`.
- **Retries:** each chunk has its own budget of automatic retries (`CHUNK_RETRY_POLICY`, 5 by default),
  with a delay that doubles from 1 second up to 30 seconds. Fine Uploader's own retry counter is per
  file, so the module applies the budget instead. A response with `preventRetry` ends the upload at
  once. The flow's error callback runs only when the upload fails for good.
- **Resume:** before a file is added, the browser asks `GET <upload endpoint>session/` for the caller's
  open upload of the same file. The query carries the name, size, part size and fingerprint. The
  response lists the parts that are on disk with the expected size. They are written into Fine
  Uploader's resume record, so after a page reload, selecting the same file again sends only the
  missing parts. Without a match, the browser drops any saved progress and uploads the whole file.
- **Cancellation:** cancelling a chunked upload calls `DELETE <upload endpoint>session/<uuid>/`. The
  server deletes the chunks, and later chunks for that upload get HTTP 410.
- **Expiry:** a session untouched for `ORPHANED_UPLOAD_CLEANUP_HOURS` (24 by default) expires. Its
  chunks are deleted, later requests get HTTP 410, and selecting the file again starts a new upload.
  The daily `cleanup_orphaned_uploads` task deletes expired sessions.

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/fu/upload/` | POST | Chunks, single-request files, and `?done` completion for new media |
| `/fu/upload/session/` | GET | Find a resumable upload for new media |
| `/fu/upload/session/<uuid>/` | DELETE | Cancel an upload for new media |
| `/fu/upload/update/<token>/` | POST | The same for a replacement file of one media |
| `/fu/upload/update/<token>/session/` | GET | Find a resumable replacement upload |
| `/fu/upload/update/<token>/session/<uuid>/` | DELETE | Cancel a replacement upload |

---

## 🔐 Security Considerations
- Filenames are sanitized to avoid filesystem-based attacks.
- UUIDs are validated to avoid spoofing and ensure trusted identification.
- An upload session accepts chunks, resume lookups, cancellation and completion only from the account
  and for the target that created it, and only for the same file identity.

---

## 🧱 Dependencies
- [Fine Uploader](https://fineuploader.com/) (Frontend)
- Django (Backend)
- Django File Storage System (e.g., local or cloud-based)
