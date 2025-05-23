# 📼 Media API Endpoints #
This documents all media-related endpoints. All endpoints prefixed with `/api/v1/` are RESTful and return JSON.

## 🔹 `GET /api/v1/media`

**Description:** Retrieves a list of all media items.

**Status Codes**:
* 200 OK: Successful request
* 400 Bad Request: Invalid parameters
**Response:** Returns an object containing media entries.
  
**Example Response:**

```
{
  "count": 2,
  "next": null,
  "previous": null,
  "results": [
    {
      "friendly_token": "abc123xyz",
      "title": "Sample Video",
      "thumbnail_url": "http://127.0.0.1:8000/media/thumbnails/sample.jpg",
      "description": "A sample media file.",
      "add_date": "2025-05-14T12:34:56Z",
      "duration": 261,
      "url": "http://127.0.0.1:8000/media/sample-video",
      "api_url": "http://127.0.0.1:8000/api/v1/media/abc123xyz"
    }
  ]
}

```

---



## 🔹 `POST /api/v1/media`

**Description:** Upload a new media item.  
**Authentication:** ✅ Required  
**Content-Type:** `multipart/form-data`

---

### Body Parameters (form-data)

| Parameter    | Type     | Required | Description                       |
|--------------|----------|----------|-----------------------------------|
| `title`      | string   | yes      | The title of the media.           |
| `description`| string   | no       | Description of the media.         |
| `thumbnail`  | file     | no       | Thumbnail image file.             |
| `media_file` | file     | yes      | The video or media file to upload.|
| `category`   | string   | no       | Category for the media.           |
| `tags`       | array or string | no | Array of tags. Multiple entries or comma-separated string, depending on API support.|

---

### Status Codes

- `201 Created`: Media successfully uploaded  
- `400 Bad Request`: Invalid parameters  
- `401 Unauthorized`: Authentication required  

---

### Response

Returns the uploaded media object.

---

### Example Request (form-data)

| Key          | Value                      | Type  |
|--------------|----------------------------|-------|
| title        | My New Clip                | text  |
| description  | Behind the scenes footage  | text  |
| thumbnail    | (choose a file)            | file  |
| media_file   | (choose a file)            | file  |
| category     | Documentary                | text  |
| tags         | tag1,tag2,tag3             | text* |

> \* Alternatively, you can send multiple `tags` keys for each tag, if supported.

---

### Example Response (JSON)

```json
{
  "friendly_token": "ghj789klm",
  "title": "My New Clip",
  "thumbnail_url": "http://127.0.0.1:8000/media/thumbnails/clip.jpg",
  "description": "Behind the scenes footage",
  "add_date": "2025-05-14T13:01:00Z",
  "duration": 195,
  "url": "http://127.0.0.1:8000/media/my-new-clip",
  "api_url": "http://127.0.0.1:8000/api/v1/media/ghj789klm"
}
```



---


## 🔹 `GET /api/v1/media/{friendly_token}`

**Description:** Retrieve full details of a specific media item by its friendly token.  
**Authentication:** ✅ Required (if applicable)

---

### Path Parameters

| Parameter       | Type   | Required | Description                          |
|-----------------|--------|----------|--------------------------------------|
| `friendly_token`| string | yes      | The friendly token of the media item.|

---

### Status Codes

- `200 OK`: Successful request  
- `404 Not Found`: Media item does not exist  

---

### Response

Returns detailed information about the requested media item.

---

### Example Response (JSON)

```json
{
  "url": "http://127.0.0.1:8000/view?m=U3prbIyQM",
  "user": "admin",
  "title": "My New Clip",
  "description": "Behind the scenes footage",
  "summary": "",
  "add_date": "2025-05-16T11:15:42.206674+01:00",
  "edit_date": "2025-05-16T11:15:42.224294+01:00",
  "media_type": "image",
  "state": "unlisted",
  "duration": 0,
  "thumbnail_url": null,
  "poster_url": null,
  "thumbnail_time": null,
  "sprites_url": null,
  "preview_url": null,
  "author_name": "",
  "author_profile": "/%2Fuser/admin/",
  "author_thumbnail": "/media/userlogos/user.jpg",
  "encodings_info": {},
  "encoding_status": "success",
  "views": 1,
  "likes": 1,
  "dislikes": 0,
  "reported_times": 0,
  "user_featured": false,
  "original_media_url": "/media/original/user/admin/5ca5fe8c31894306807f96e6faa8a339.459210087_544749241452421_1886208857977491849_n.jpg",
  "size": null,
  "video_height": 1,
  "enable_comments": true,
  "categories_info": [],
  "topics_info": [],
  "is_reviewed": true,
  "company": null,
  "website": null,
  "add_subtitle_url": "/add_subtitle?m=U3prbIyQM",
  "edit_url": "/edit?m=U3prbIyQM",
  "media_country_info": [],
  "media_language_info": [
    {
      "title": "English",
      "url": "/search?language=English"
    }
  ],
  "license_info": {},
  "tags_info": [],
  "hls_info": {},
  "subtitles_info": [],
  "ratings_info": [],
  "allow_download": true,
  "year_produced": null,
  "related_media": []
}
```

## 🔹 `PUT /api/v1/media/{friendly_token}`

**Description:** Update metadata for a specific media item identified by its friendly token.  
**Authentication:** ✅ Required

---

### Path Parameters

| Parameter        | Type   | Required | Description                                      |
|------------------|--------|----------|--------------------------------------------------|
| `friendly_token` | string | yes      | The friendly token of the media item to update.  |

---

### Body Parameters (multipart/form-data)

| Parameter    | Type   | Required | Description                    |
|--------------|--------|----------|--------------------------------|
| `title`      | string | optional | New title for the media.       |
| `description`| string | optional | New description for the media. |
| `thumbnail`  | file   | optional | New thumbnail image file.|

---

### Status Codes

- `200 OK`: Update successful  
- `401 Unauthorized`: Authentication required  
- `403 Forbidden`: User doesn't have permission to update this media  
- `404 Not Found`: Media item does not exist  

---

### Response

Returns the updated media object with the latest metadata.

---

### Example Request (PUT with multipart/form-data)
| Key          | Value                        | Type  |
|--------------|------------------------------|-------|
| title        | My Updated Clip Title        | text  |
| description  | New description for the clip | text  |
| thumbnail    | (binary file upload)         | file  |

### Example Response (JSON)

```json
{
  "friendly_token": "U3prbIyQM",
  "url": "http://127.0.0.1:8000/view?m=U3prbIyQM",
  "api_url": "http://127.0.0.1:8000/api/v1/media/U3prbIyQM",
  "user": "admin",
  "title": "Updated My New Clip",
  "description": "Behind the scenes footage",
  "add_date": "2025-05-16T11:15:42.206674+01:00",
  "views": 1,
  "media_type": "image",
  "state": "unlisted",
  "duration": 0,
  "thumbnail_url": "http://127.0.0.1:8000/api/v1/media/U3prbIyQM",
  "is_reviewed": true,
  "preview_url": null,
  "author_name": "",
  "author_profile": "http://127.0.0.1:8000/%2Fuser/admin/",
  "author_thumbnail": "http://127.0.0.1:8000/media/userlogos/user.jpg",
  "encoding_status": "success",
  "likes": 1,
  "dislikes": 0,
  "reported_times": 0,
  "featured": false,
  "user_featured": false,
  "size": null,
  "media_country_info": [],
  "year_produced": null
}
```


---

## 🔹`DELETE /api/v1/media/{friendly_token}`
**Description:** Delete a media item.
**Authentication:** ✅ Required
**Path Parameters:** 
* friendly_token (string, required): The friendly token of the media item.
**Status Codes**:
* 204 No Content: Deletion successful
* 401 Unauthorized: Authentication required
* 403 Forbidden: User doesn't have permission
* 404 Not Found: Media doesn't exist
**Response:**
* 204 No Content on success

---

## 🔹 `GET /api/v1/media/{friendly_token}/comments`

**Description:** Retrieve the list of comments associated with a specific media item identified by its friendly token.

---

### Path Parameters

| Parameter        | Type   | Required | Description                          |
|------------------|--------|----------|--------------------------------------|
| `friendly_token` | string | yes      | The friendly token of the media item.|

---

### Status Codes

- `200 OK`: Successfully retrieved comments  
- `404 Not Found`: Media item does not exist  

---

### Response

Returns a JSON array of comment objects related to the media item.

Each comment object contains:

| Field                | Type     | Description                                                       |
|----------------------|----------|-------------------------------------------------------------------|
| `uid`                | string   | Unique identifier for the comment                                 |
| `add_date`           | string   | Timestamp when the comment was added (ISO 8601)                   |
| `text`               | string   | The comment text                                                  |
| `parent`             | string/null | UID of the parent comment if it's a reply; `null` if top-level |
| `author_name`        | string   | Name of the comment author                                        |
| `author_profile`     | string   | URL to the author's profile page                                  |
| `author_thumbnail_url`| string | URL to the author's thumbnail image                               |
| `media_url`          | string   | URL to the media item                                             |

---

### Example Response (JSON)

```json
[
  {
    "uid": "e6d9d1e5-a738-4183-a845-649f547bc2ce",
    "add_date": "2025-05-16T11:27:20.213240+01:00",
    "text": "good vid",
    "parent": null,
    "author_name": "",
    "author_profile": "/%2Fuser/admin/",
    "author_thumbnail_url": "/media/userlogos/user.jpg",
    "media_url": "/view?m=jOtwPmb6f"
  }
]
```

## 🔹 ``POST /api/v1/media/{friendly_token}/comments``

**Description:** Add a new comment to a specific media item identified by its friendly token.

**Authentication:** ✅ Required

---

### Path Parameters

| Parameter        | Type   | Required | Description                      |
|------------------|--------|----------|--------------------------------|
| `friendly_token` | string | yes      | The friendly token of the media item.|

---

### Body Parameters

| Parameter | Type   | Required | Description          |
|-----------|--------|----------|----------------------|
| `text`    | string | yes      | The content of the comment.|

---

### Status Codes

- `201 Created`: Comment successfully added  
- `401 Unauthorized`: Authentication required  
- `403 Forbidden`: Comments disabled or user lacks permission  

---

### Example Request

```json
{
  "text": "This is a great video! Thanks for sharing."
}
```

### Example Response
```json
{
  "uid": "e6d9d1e5-a738-4183-a845-649f547bc2ce",
  "add_date": "2025-05-16T11:27:20.213240+01:00",
  "text": "good vid",
  "parent": null,
  "author_name": "",
  "author_profile": "/%2Fuser/admin/",
  "author_thumbnail_url": "/media/userlogos/user.jpg",
  "media_url": "/view?m=jOtwPmb6f"
}

```

## 🔹 ``POST /api/v1/media/{friendly_token}/actions``

**Description:**  
Perform actions on media such as liking, disliking, or reporting inappropriate content.

**Authentication:**  
✅ Required for `like` and `dislike`  
❌ Optional for `report`

---

#### Path Parameters:
| Name            | Type   | Required | Description                            |
|-----------------|--------|----------|----------------------------------------|
| `friendly_token`| string | ✅       | The friendly token of the media item.  |

---

#### Body Parameters (JSON):
| Name         | Type   | Required | Description                                              |
|--------------|--------|----------|----------------------------------------------------------|
| `type`       | string | ✅       | The action to perform. Valid values: `"like"`, `"dislike"`, `"report"` |
| `extra_info` | string | ❌       | Additional notes or reason, used only when `type` is `"report"` |

**Content-Type:** `application/json`

---

### Status Codes

- `200 OK`: Action performed Successfully
- `400 Bad Request`: Missing or invalid parameters
- `401 Unauthorized`: Login required for like/dislikes
- `415 Unsupported Media Type`: Must use JSON body

---

### ✅ Example Request:

```json


{
  "type": "like"
}

```

### Example Response:
```json
{
  "detail": "action received"
}
```
