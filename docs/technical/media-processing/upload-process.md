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
- Handled by the `.save()` method for both (single and chunked uploads)[video-processing-overview.md]:
  - **Chunked Uploads:**
    - Chunks are saved individually via `self._save_chunk()` into `/chunks/<uuid>/<index>`.
    - If it's the final chunk and not using concurrent uploads:
      - All chunks are combined using `combine_chunks()`, which:
        - Reads each chunk in order.
        - Writes them into a final file.
        - Deletes the temporary chunk directory.
  - **Single Uploads:**
    - The entire file is saved directly using Django Storage.

- If the upload succeeds, `uploader.url` returns the accessible file URL based on the configured backend storage.

---

## 🔐 Security Considerations
- Filenames are sanitized to avoid filesystem-based attacks.
- UUIDs are validated to avoid spoofing and ensure trusted identification.

---

## 🧱 Dependencies
- [Fine Uploader](https://fineuploader.com/) (Frontend)
- Django (Backend)
- Django File Storage System (e.g., local or cloud-based)
