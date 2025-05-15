# 🎵 Playlist API Endpoints

This documents all playlist-related endpoints. All endpoints prefixed with /api/v1/ are RESTful and return JSON.


---

### 🔹 `GET /api/v1/playlists`

**Description:**  
Retrieve a list of all playlists.

**Response:** Returns a paginated list of playlist objects.

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

### 🔹 `GET /api/v1/playlists/{friendly_token}`

**Description:**  
Retrieve detailed information about a specific playlist.

**Path Parameters:**
- friendly_token (string, required): The slug or unique token of the playlist.

**Response:** 
Returns full details of the playlist including list of media items.

**Example Response:**
```json
{
  "title": "Chill Vibes",
  "slug": "chill-vibes",
  "description": "A collection of relaxing tunes.",
  "thumbnail_url": "http://127.0.0.1:8000/media/playlists/chill-vibes.jpg",
  "created_date": "2025-05-10T09:30:00Z",
  "media_items": [
    {
      "title": "Smooth Jazz",
      "slug": "smooth-jazz",
      "duration": "00:05:12",
      "url": "http://127.0.0.1:8000/media/smooth-jazz"
    },
    {
      "title": "Ocean Waves",
      "slug": "ocean-waves",
      "duration": "00:03:45",
      "url": "http://127.0.0.1:8000/media/ocean-waves"
    }
  ],
  "api_url": "http://127.0.0.1:8000/api/v1/playlists/chill-vibes"
}


```




### 🔹POST /api/v1/playlists` 

**Description:**  
Create a new playlist.

**Authentication:**
-slug (string, required): ✅ Required

**Body Parameters:**
- title (string, required): The title of the playlist.
- description (string, optional): A short description of the playlist.
- thumbnail (file, optional): An image file to use as the playlist thumbnail.
- media_ids (array of strings, optional): List of media item IDs to add to the playlist initially.

**Response:** 
Returns the newly created playlist object.

**Example Request:**
```json
{
  "title": "Evening Chill",
  "description": "Perfect tracks for winding down.",
  "media_ids": ["media123", "media456", "media789"]
}


```



### 🔹`PATCH /api/v1/playlists/{friendly_token}` 

**OR**

### 🔹`PUT /api/v1/playlists/{friendly_token}`

**Description:**  
Update playlist metadata or contents.

**Authentication:**
✅ Required

**Path Parameters:**
- friendly_token (string, required): Playlist slug or token.

**Body Parameters**:
- title (string): Updated playlist title.
- description (string): Updated playlist description.
- thumbnail (file): New thumbnail image file.
- media_ids (array of strings): New list of media item IDs to replace existing playlist items.


**Response:** 
Returns updated media object.

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

Response:

- 204 No Content on success
- 403 Forbidden if unauthorized