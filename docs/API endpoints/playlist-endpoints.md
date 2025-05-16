# 🎵 Playlist API Endpoints

This documents all playlist-related endpoints. All endpoints prefixed with /api/v1/ are RESTful and return JSON.


---

## 🔹 `GET /api/v1/playlists`

**Description:**  
Retrieve a list of all playlists.

**Response:**  
Returns a paginated list of playlist objects.

### Status Codes

- `200 OK`: The request was successful, and playlists are returned.
- `401 Unauthorized`: Authentication credentials were missing or invalid.
- `403 Forbidden`: The user does not have permission to access playlists.
- `500 Internal Server Error`: Something went wrong on the server.



**Example Response:**

```json
{
  "count": 3,
  "next": null,
  "previous": null,
  "results": [
    {
      "title": "Chill Vibes",
      "slug": "chill-vibes",
      "description": "A collection of relaxing tunes.",
      "thumbnail_url": "http://127.0.0.1:8000/media/playlists/chill-vibes.jpg",
      "created_date": "2025-05-10T09:30:00Z",
      "media_count": 25,
      "api_url": "http://127.0.0.1:8000/api/v1/playlists/chill-vibes"
    },
    {
      "title": "Workout Mix",
      "slug": "workout-mix",
      "description": "Upbeat tracks to pump you up.",
      "thumbnail_url": "http://127.0.0.1:8000/media/playlists/workout-mix.jpg",
      "created_date": "2025-05-12T15:45:00Z",
      "media_count": 40,
      "api_url": "http://127.0.0.1:8000/api/v1/playlists/workout-mix"
    }
  ]
}
```

---

## 🔹 `GET /api/v1/playlists/{friendly_token}`

**Description:**  
Retrieve detailed information about a specific playlist.

**Path Parameters:**

- `friendly_token` (string, required): The slug or unique token of the playlist.

**Response:**  
Returns full details of the playlist including list of media items.

### Status Codes

- `200 OK`: The request was successful, and the playlist details are returned.  
- `400 invalid or not specified action`: The action field is missing or invalid.  
- `400 invalid media_ids`: One or more media IDs are invalid or missing.  
- `401 authentication credentials were not provided`: Request lacks valid authentication token.  
- `403 permission denied`: User lacks permission to update this playlist.  
- `404 playlist not found`: Playlist with the specified token does not exist.  
- `415 unsupported media type`: Thumbnail file format is not supported.  
- `500 internal server error`: Unexpected server error occurred.  

**Example Response:**

```json
{
  "title": "Evening Chill",
  "add_date": "2025-05-15T16:59:10.274624+01:00",
  "user_thumbnail_url": "/media/userlogos/user.jpg",
  "description": "Perfect tracks for winding down.",
  "user": "admin",
  "media_count": 0,
  "url": "/playlists/FgALQ7WmR",
  "thumbnail_url": null,
  "playlist_media": [],
  "results": []
}

```




## 🔹POST /api/v1/playlists` 

**Description:**  
Create a new playlist.

**Authentication:**
-slug (string, required): ✅ Required

**Body Parameters:**
- title (string, required): The title of the playlist.
- description (string, optional): A short description of the playlist.
- thumbnail (file, optional): An image file to use as the playlist thumbnail.
- media_ids (array of strings, optional): List of media item IDs to add to the playlist initially.

**Status Codes**
`201 Created`: The playlist was successfully created.
`400 Bad Request`: The request data was invalid or missing required fields.
`401 Unauthorized`: Authentication credentials were missing or invalid.
`403 Forbidden`: The user does not have permission to create playlists.
`500 Internal Server Error`: Something went wrong on the server.

**Response:** 
Returns the newly created playlist object.

**Example Request:**
```json
{
  "title": "Hello",
  "description": "Hello, Welcome to Cinemata",
  "thumbnail": "poster.jpg",
  "media_ids": ["media123", "media456", "media789"]
}
```

```json
{
  "add_date": "2025-05-16T12:19:20.474952+01:00",
  "title": "Hello",
  "description": "Hello, Welcome to Cinemata",
  "user": "admin",
  "media_count": 0,
  "url": "/playlists/kJWzhQQGM",
  "api_url": "/api/v1/playlists/kJWzhQQGM",
  "thumbnail_url": null
}

```

---


## 🔹 `PUT /api/v1/playlists/{friendly_token}`

**Description:**  
Update playlist metadata or contents.

**Authentication:**  
✅ Required

**Path Parameters:**  
- `friendly_token` (string, required): Playlist slug or token.

**Body Parameters:**  
- `title` (string, optional): Updated playlist title.  
- `description` (string, optional): Updated playlist description.  
- `thumbnail` (file, optional): New thumbnail image file.  
- `media_ids` (array of strings, optional): New list of media item IDs to replace existing playlist items.

### Error Codes

- `400 invalid or not specified action`: The action field is missing or invalid.
- `400 invalid media_ids`: One or more media IDs are invalid or missing.
- `401 authentication credentials were not provided`: Request lacks valid authentication token.
- `403 permission denied`: User lacks permission to update this playlist.
- `404 playlist not found`: Playlist with the specified token does not exist.
- `415 unsupported media type`: Thumbnail file format is not supported.
- `500 internal server error`: Unexpected server error occurred.


**Response:**  
Returns updated playlist object.

**Example Request:**  
```json
{
  "title": "Evening Chill Updated",
  "description": "Relaxing tunes for the evening.",
  "media_ids": ["media123", "media999"]
}
```




### 🔹`DELETE /api/v1/playlists/{friendly_token}`

**Description:**  
Delete a playlist.

**Authentication:**  
✅ Required

**Response:**

- `204 No Content`: Playlist successfully deleted.  
- `403 Forbidden`: User is not authorized to delete this playlist.  
