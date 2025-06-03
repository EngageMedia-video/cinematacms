# 📘 User API Endpoints

This documents all user related endpoints. All endpoints prefixed with `/api/v1/` are RESTful and return JSON.

---

## 🔹 `GET /api/v1/users`

**Description:**  
Retrieves a list of all users.

**Response:**  Returns an object containing user entries.

**Example Response:**
```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "description": "",
      "date_added": "2025-05-05T03:20:47.425309+01:00",
      "name": "",
      "is_featured": false,
      "thumbnail_url": "http://127.0.0.1:8000/media/userlogos/user.jpg",
      "url": "http://127.0.0.1:8000/%2Fuser/admin/",
      "api_url": "http://127.0.0.1:8000/api/v1/users/admin",
      "username": "admin",
      "advancedUser": false,
      "is_editor": false,
      "is_manager": false,
      "email_is_verified": false,
      "media_count": 2
    }
  ]
}

```




---

## 🔹 `GET /api/v1/users/{username}`

**Description:**  
Retrieve details of a specific user.

**Path Parameters:**

- `username` (string, required): The username of the user to retrieve.


**Example Response:**
```json
{
  "description": "",
  "date_added": "2025-05-05T03:20:47.425309+01:00",
  "name": "",
  "is_featured": false,
  "thumbnail_url": "http://127.0.0.1:8000/media/userlogos/user.jpg",
  "banner_thumbnail_url": "/media/userlogos/banner.jpg",
  "url": "http://127.0.0.1:8000/%2Fuser/johndoe/",
  "username": "johndoe",
  "media_info": {
    "results": [],
    "user_media": "/api/v1/media?author=johndoe"
  },
  "api_url": "http://127.0.0.1:8000/api/v1/users/johndoe",
  "edit_url": "/user/johndoe/edit",
  "default_channel_edit_url": "/channel/CsMVcUYOZ/edit",
  "home_page": "",
  "social_media_links": "",
  "location_info": [
    {
      "title": "International",
      "url": "/members?location=International"
    }
  ]
}

```


---

## 🔹 `DELETE /api/v1/users/{username}`

**Description:**  
Delete a user account.

**Authentication:** ✅ Required

**Response:**  
- `204 No Content` on success  
- `403 Forbidden` if unauthorized

---

### 🔹 `POST /api/v1/users/{username}/contact`

**Description:**  
Send a contact message to a user.

**Authentication:** ✅ Required

**Body Parameters:**

- `subject` (string, required) – The Subject of the message
- `body` (string, required) – The body of the message

**Status Codes**  
- `200 OK` on success  
- `400 Bad Request` on validation error
- `204 No Content` 


```json
{
  "subject": "Welcome Message",
  "body": "Hello, Welcome to Cinemata!"
}

```

---

### 🔹 `GET /accounts/2fa/totp/success`

**Description:**  
Returns a success message after completing 2FA (Two-Factor Authentication) via TOTP.

**Response:**  
JSON with confirmation of successful 2FA login.

```json
{
  "status": "success",
  "message": "2FA completed successfully."
}
```


### 🔹 Error Codes

- `400 Bad Request`: Invalid request parameters or data.
- `401 Unauthorized`: Missing or invalid authentication token.
- `403 Forbidden`: Access denied due to insufficient permissions.
- `404 Not Found`: Resource could not be found.
- `500 Internal Server Error`: An unexpected error occurred on the server.



### 🔹 Rate Limiting

To prevent abuse, the API applies rate limiting. The following headers are used:

- `X-Rate-Limit-Limit`: The maximum number of requests allowed per minute.
- `X-Rate-Limit-Remaining`: The number of requests remaining in the current time window.
- `X-Rate-Limit-Reset`: The time when the rate limit will reset.

**Best Practices:**
- Avoid making excessive requests in a short period of time.
- Cache responses where possible to reduce unnecessary requests.


