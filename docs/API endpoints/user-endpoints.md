# 📘 User API Endpoints

This documents all user related endpoints. All endpoints prefixed with `/api/v1/` are RESTful and return JSON.

---

### 🔹 `GET /api/v1/users`

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

### 🔹 `GET /api/v1/users/{username}`

**Description:**  
Retrieve details of a specific user.

**Path Parameters:**

- `username` (string, required): The username of the user to retrieve.

**Response:**  
Returns the full user profile (excluding password or sensitive info), with fields such as:

- `description` (string): The description of the user.
- `date_added` (string): Timestamp of when the user was created.
- `name` (string): The full name of the user.
- `is_featured` (boolean): If the user is featured.
- `thumbnail_url` (string): URL of the user's profile image.
- `url` (string): Absolute URL to the user's profile page.
- `api_url` (string): Absolute API URL to the user's API endpoint.
- `username` (string): The username of the user.
- `advancedUser` (boolean): Whether the user is an advanced user.
- `is_editor` (boolean): Whether the user is an editor.
- `is_manager` (boolean): Whether the user is a manager.
- `email_is_verified` (boolean): Whether the user's email is verified.
- `media_count` (integer): The number of media associated with the user.

**Example Response:**
```json
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
```

---

### 🔹 `PATCH /api/v1/users/{username}`  
**OR**  
### 🔹 `PUT /api/v1/users/{username}`

**Description:**  
Update user details.

**Authentication:** ✅ Required

**Body Parameters:**  
Partial or full user profile fields. Examples:

- `name` (string)  
- `email` (string)  
- `thumbnail_url` (string)  
- `password` (string, optional – if changing password)
- `description` (string, optional): The description of the user.
- `is_featured` (boolean, optional): Whether the user is featured.



**Response:**  
Returns updated user object or validation errors.


**Example Request**
```json
{
   "username": "john_doe",
   "email": "john_doe@example.com",
   "password": "new_securepassword123",
   "name": "John Doe",
   "is_featured": true
}

```

---

### 🔹 `DELETE /api/v1/users/{username}`

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


```json
{
  "subject": "Welcome Message",
  "body": "Hello, Welcome to Cinemata!"
}

```
**Response:**  
- `200 OK` on success  
- `400 Bad Request` on validation error
- `204 No Content` 

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


