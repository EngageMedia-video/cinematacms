# Upload Process

This outlines the flow of how media uploads are handled from the frontend to the backend using the tus resumable upload protocol and Django.

### 📤 User Action
- - User has two options to navigate to the upload page which routes them to the `/upload`:
  - **"Upload Media"** on the sidebar.
  - by clicking on the upload button that appears on the header/navigation area.
---

### 🧩 Frontend Handling (tus-js-client)
- The single-upload page, the bulk-upload tab, and file replacement on the edit page share one upload
  engine, `frontend/src/features/shared/utils/tusUpload.js`. It drives
  [tus-js-client](https://github.com/tus/tus-js-client) and gives each page:
  - file validation (type, size, empty file, item limit) before anything is sent;
  - progress, pause, continue, retry and cancel;
  - the upload states: uploading, paused, awaiting sign-in, expired, failed and complete.
- Files are sent with the [tus 1.0.0 resumable upload protocol](https://tus.io/protocols/resumable-upload)
  to `/fu/tus/` (new media) or `/fu/tus/update/<token>/` (replacement file).

---

### 🛠️ Backend Handling (Django)
The tus endpoints live in `uploader/tus_views.py`, the protocol rules in `uploader/tus.py`, and the
state every upload shares in `uploader/sessions.py` and the `uploader.UploadSession` model.

#### Protocol
- The server implements the tus core protocol and the `creation`, `expiration` and `termination`
  extensions. `OPTIONS` advertises them with `Tus-Max-Size`. It does not implement
  `creation-defer-length`, `creation-with-upload`, `checksum` or `concatenation`, so one upload is
  one sequential byte stream.
- `POST` creates an upload from `Upload-Length` and `Upload-Metadata` (`filename`, and optionally
  `fingerprint` and `is_draft`). The server chooses the upload id and answers `201` with `Location`.
  A file over the size limit gets `413`, and a file type that is not allowed gets `400`.
- `HEAD` returns `Upload-Offset`, the number of bytes the server holds. The browser asks for it
  before every start, retry and resume, so the server's offset is the only authority.
- `PATCH` appends the body at `Upload-Offset`. The upload's bytes are one append-only file,
  `chunks/<uuid>/data`, and that file's size is the offset. Accepted bytes are flushed to disk
  before the response, so they survive a lost response, a page reload and an application restart.
  - An `Upload-Offset` other than the file's size gets `409` and changes nothing.
  - A body that would pass `Upload-Length` gets `413` and changes nothing.
  - Only one request writes an upload at a time (a file lock). A second request gets `423` and
    retries.
  - nginx buffers each request (`uwsgi_request_buffering on`), so an interrupted `PATCH` stores
    nothing. The browser therefore sends 8 MiB per `PATCH` (`UPLOAD_CHUNK_SIZE`).
- `DELETE` cancels an upload and deletes its bytes. Later requests get `410`. For a completed upload it
  ends the upload resource only; the media stays.
- If the data file cannot be created, creation fails and leaves no upload row behind.
- A request without `Tus-Resumable: 1.0.0` gets `412`. `X-HTTP-Method-Override` is not supported:
  the browser sends `PATCH` and `DELETE` themselves, and no proxy in the stock deployment blocks them.

#### Sign-in, ownership and limits
- tus leaves authentication to the application. Every request needs the session cookie and, for
  `POST`, `PATCH` and `DELETE`, the `X-CSRFToken` header.
- A signed-out request gets `401`. A signed-in account that may not upload, or may not edit the target
  media, gets `403`. The difference lets the browser tell an expired session from a permission denial.
- An upload belongs to the account that created it and to its target (new media, or one media's
  replacement file). For any other account or target it answers `404`.
- `uploader.tus.max_upload_size(user)` is the one place that decides the size limit (`UPLOAD_MAX_SIZE`).

#### Completion
- The `PATCH` that delivers the last byte completes the upload: the data file moves to
  `uploads/<uuid>/<filename>` and becomes the media (or the staged replacement file). The response
  carries the media URL in `X-Media-Url`.
- Completion runs once. `sessions.complete` claims the upload (`open` to `assembling`) with a
  conditional update. A repeated final request, or a `HEAD` after a lost response, returns the first
  `X-Media-Url` and creates nothing. While another request is completing, the answer is `423`.
- If the worker dies after the last byte and before completion, the next `HEAD` completes the upload.
- If media creation fails, the upload ends as `failed` because a media row may already exist. Later
  requests get `410`, and the user selects the file again.

#### Retries and resume
- **Retries:** tus-js-client retries a failed request after 1, 2, 4, 8, 16 and 30 seconds
  (`RETRY_DELAYS_MS`) and starts the list again whenever a retry makes progress. It retries network
  errors, `5xx`, `409` and `423`, and stops at once on any other `4xx`. A manual retry also continues
  from the server's offset.
- **Resume after a reload:** the browser cannot keep the file, so the user selects it again. Before
  sending, the engine asks `GET /fu/tus/?filename=…&total_size=…&fingerprint=…` for the caller's
  unfinished upload of the same file. The fingerprint is a SHA-256 of the file's size, modification
  time, and first and last MiB. On a match the upload continues from the server's offset; a different
  file, account or target never matches. A draft (bulk) upload and a non-draft (single) upload of one
  file are separate uploads: the lookup sends `is_draft` and matches only the same mode.
- **Failed completion:** if creating the media fails after the last byte, the upload ends as failed
  and later requests get `410` with `X-Upload-Result: unknown`. The media may already exist, so the
  browser shows the upload as expired with a message to check the media first, the same as for a
  remembered upload that is gone; **Retry** sends the file as a new upload.
- **The same file twice:** a file selected again while its first copy is still in the list is sent as
  its own upload and becomes its own media; the browser does not attach it to the first copy's
  upload. Another tab is a separate engine: selecting the same file there continues the same upload,
  and both tabs end on the same media.
- **Lost final response:** the browser keeps the upload's URL in `localStorage` until it sees the upload
  end. The key is a hash of the endpoint, the mode, the signed-in account, the fingerprint and the
  file name, so the entry shows no file name and another account on the same browser never recalls
  it. An entry is ignored after 24 hours, and stale entries are removed when an upload page opens. If the response to the last byte is lost and the page reloads, the completed upload is no longer
  unfinished, so the lookup finds nothing; the engine then asks the remembered URL, and its `HEAD`
  returns the media that was created. Nothing is sent or created twice. If that URL is gone, the
  upload may have created its media before the server removed it, so the engine does not send the
  file again by itself: it shows *expired* with a message to check the media, and **Retry** sends the
  file as a new upload.
- **Sign-in recovery:** on `401`, from the lookup or from any tus request, the upload waits in the
  *awaiting sign-in* state without using retries. After the user signs in again (for example in another tab), **Continue** resumes the same
  upload. The CSRF token is read before every request, so the token of the new session is used.
- **Expiry:** an upload untouched for `ORPHANED_UPLOAD_CLEANUP_HOURS` (24 by default) expires. Its
  bytes are deleted and later requests get `410`. `Upload-Expires` tells the browser when. The
  browser never starts a replacement upload on its own: it shows the upload as expired, and **Retry**
  sends the file again. A server error on the offset check is retried against the same upload. The daily `cleanup_orphaned_uploads` task deletes expired sessions.
- **Cancellation:** cancelling an unfinished upload sends `DELETE`.

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/fu/tus/` | OPTIONS | Protocol version, extensions and size limit |
| `/fu/tus/` | POST | Create an upload for new media |
| `/fu/tus/` | GET | Find the caller's unfinished upload of a file |
| `/fu/tus/<uuid>/` | HEAD, PATCH, DELETE | Offset, append, cancel |
| `/fu/tus/update/<token>/` | OPTIONS, POST, GET | The same for a replacement file of one media |
| `/fu/tus/update/<token>/<uuid>/` | HEAD, PATCH, DELETE | Offset, append, cancel |
| `/fu/upload/cancel/<token>/` | POST | Discard the replacement file staged for one media |

#### Fine Uploader
The Fine Uploader endpoints (`/fu/upload/`, `/fu/upload/session/…`, `/fu/upload/update/…`) and the
chunked upload code are removed. Sessions are cut off before a release, so no page loaded before the
tus release continues an upload. Migration `uploader.0003` deletes the remaining chunked upload
rows, and the daily `cleanup_orphaned_uploads` task removes their chunk files.

#### Release and rollback
- **Release:** cut off the sessions before the deploy, as for any maintenance. Migration
  `uploader.0003` drops columns the previous application code writes, so the previous code cannot
  run against the new schema.
- **Rollback:** before the previous code is deployed, run `python manage.py migrate uploader 0001`
  with the new code still in place. It restores the dropped columns and deletes every upload
  session, because the restored columns have no default. Unfinished uploads are lost and their
  files are selected again; media that was already created is not affected. `rollback.sh` does not
  run this step.

---

## 🔐 Security Considerations
- Filenames are sanitized to avoid filesystem-based attacks.
- The server chooses a tus upload's id; the browser never names the path its bytes are written to.
- An upload accepts offset checks, bytes, cancellation and completion only from the account and for
  the target that created it.
- The size limit is checked at creation and again on every `PATCH`, and a `PATCH` can never write
  past `Upload-Length`, so chunked transfer cannot bypass the whole-file limit.

---

## 🧱 Dependencies
- [tus-js-client](https://github.com/tus/tus-js-client) 4.3.1 (Frontend)
- Django (Backend)
- Local filesystem under `MEDIA_ROOT` for unfinished uploads (the file lock needs a local filesystem)
