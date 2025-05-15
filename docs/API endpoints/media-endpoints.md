# 📼 Media API Endpoints

This documents all media-related endpoints. All endpoints prefixed with `/api/v1/` are RESTful and return JSON.

---

### 🔹 `GET /api/v1/media`

**Description:**  
Retrieves a list of all media items.

**Body Parameters**:
- title (string, required): The title of the media file.
- description (string, optional): A short description of the media (can be left blank).
- file (file, required): The video or media file to be uploaded.
- thumbnail (file, optional): A thumbnail image representing the media (optional).

**Response:** Returns an object containing media entries.

**Example Response:**
```json
{
  "count": 2,
  "next": null,
  "previous": null,
  "results": [
    {
      "title": "Sample Video",
      "slug": "sample-video",
      "thumbnail_url": "http://127.0.0.1:8000/media/thumbnails/sample.jpg",
      "description": "A sample media file.",
      "upload_date": "2025-05-14T12:34:56Z",
      "duration": "00:04:21",
      "url": "http://127.0.0.1:8000/media/sample-video",
      "api_url": "http://127.0.0.1:8000/api/v1/media/sample-video"
    }
  ]
}
```

---

### 🔹 ` POST /api/v1/media`

**Description:**  
Upload a new media item.

**Authentication**: ✅ Required



**Body Parameters**:

- title (string, required): The title of the media.
- description (string, optional): Description of the media.
- thumbnail (file, optional): Thumbnail image file.
- file (file, required): The video or media file to upload.

**Response:** 
Returns the uploaded media object.

**Example Request:**
```json
{
  "title": "My New Clip",
  "description": "Behind the scenes footage"
}

```

**Example Response:**
```json
{
  "title": "My New Clip",
  "slug": "my-new-clip",
  "thumbnail_url": "http://127.0.0.1:8000/media/thumbnails/clip.jpg",
  "description": "Behind the scenes footage",
  "upload_date": "2025-05-14T13:01:00Z",
  "duration": "00:03:15",
  "url": "http://127.0.0.1:8000/media/my-new-clip",
  "api_url": "http://127.0.0.1:8000/api/v1/media/my-new-clip"
}

```




### 🔹`GET /api/v1/media/{slug}` 

**Description:**  
Retrieve a specific media item

**Path Parameters:**
-slug (string, required): The slug of the media item.

**Response:** 
Returns full details of the media item.

**Example Response:**
```json
{
  "title": "My New Clip",
  "slug": "my-new-clip",
  "thumbnail_url": "http://127.0.0.1:8000/media/thumbnails/clip.jpg",
  "description": "Behind the scenes footage",
  "upload_date": "2025-05-14T13:01:00Z",
  "duration": "00:03:15",
  "url": "http://127.0.0.1:8000/media/my-new-clip",
  "api_url": "http://127.0.0.1:8000/api/v1/media/my-new-clip"
}

```



### 🔹`PATCH /api/v1/media/{slug}` 

**OR**

### 🔹`PUT /api/v1/media/{slug}`

**Description:**  
Update media metadata.

**Authentication:**
✅ Required

**Body Parameters**:
- title (string, optional)
- description (string, optional)
- thumbnail (file, optional)


**Response:** 
Returns updated media object.

**Example Request (PATCH):**
```json
{
  "title": "My Updated Clip Title",
  "description": "New description for the clip"
}
```

**Example Response:**
```json
{
  "title": "My Updated Clip Title",
  "slug": "my-new-clip",
  "thumbnail_url": "http://127.0.0.1:8000/media/thumbnails/clip.jpg",
  "description": "New description for the clip",
  "upload_date": "2025-05-14T13:01:00Z",
  "duration": "00:03:15",
  "url": "http://127.0.0.1:8000/media/my-new-clip",
  "api_url": "http://127.0.0.1:8000/api/v1/media/my-new-clip"
}

```



### 🔹`DELETE /api/v1/media/{slug}` 

**Description:**  
Delete a media item.

**Authentication:**
 ✅ Required

Response:

- 204 No Content on success
- 403 Forbidden if unauthorized