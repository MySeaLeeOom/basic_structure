# Fastify Auth

- No redis for development, but an option later

## Schema

user {
  id : some kind of automatically generated uid,
  username: "octocat", 
  auth_provider: "github",
  provider_id: 12345, //unique id of the user in github
  email:"octocat@github.com", 
  status: "active | suspended | banned",
  created_at: 2026-02-25,
}

- Make sure a user can't sign up twice with the same GitHub ID.













### GET request
```rust
.route("/api/auth/login", get(login_handler))
```
This means "When a request arrives at `/api/auth/login` AND it is a `GET` request (like typing in a browser bar), run `login_handler`."

If you send a `POST` request there, Axum returns "405 Method Not Allowed".

### Local
If we implement a traditional "Username/Password" form:
*   The User fills a form on your frontend.
*   The Frontend sends a `POST` request with JSON body `{ "email": "x", "password": "y" }`.
*   You would add: `.route("/api/auth/register", post(register_handler))`

### Do we store credentials with OAuth?
**NO.** That is the beauty of OAuth.
*   You are never allowed to see or store the user's Google/GitHub password.
*   GitHub handles that security. You trust GitHub.

### 4. "Do they get an ID? Are they in our database?"
**YES.** You absolutely must store them in your database, but differently.

When GitHub redirects back to `callback_handler`, we exchange the code for a Token. Then we use that token to ask GitHub:
`GET https://api.github.com/user`

GitHub replies:
```json
{
  "id": 123456,
  "login": "octocat",
  "email": "octocat@github.com"
}
```

**Your Database Table (`users`) will look like this:**
| id (PK) | username | provider | provider_id | email | created_at |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | octocat | github | 123456 | octo@git | 2026-02-10 |

**The Logic:**
1.  User logs in via GitHub.
2.  We get GitHub ID `123456`.
3.  We query our DB: `SELECT * FROM users WHERE provider='github' AND provider_id='123456'`.
    *   **If found:** Great, log them in (Session Cookie = User ID 1).
    *   **If not found:** This is a new user! `INSERT INTO users ...`. Then log them in.

This enables you to have "Users" in your system without ever handling a password.