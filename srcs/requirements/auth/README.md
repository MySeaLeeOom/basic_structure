Authorization OAUTH2 Fundamentals:

1. The Who:
- User
- Authorization Service (Google, Github, 42, etc)
- Us, we are the client making a request to the Authorization Service

2. The Flow:
  1. Redirect the user to the Authorization Service (Google, Github, 42, etc)
  - Fastify oauth2 plugin (we) generates and sends a state variable (client side security none where we are the client now as we are asking to authorize a user)
  2. The user must accept
  3. Authorization service redirects them to a URL we provided with some numbers attached to the URL
  - it contains 
  4. We request from the Authorization Code, our Client Id and out Client Secret
  5. Authorization Service checks that all is in order and sends us back an access token
    -we can use the access token to query for the User's Login name and Profile Information





Rules:
- hash the password (we will never be able to see the password, it will be hashed and if the hassh matches, then we know the user entered the correct password)

Considerations:
- Password recovery

Roles:
- User: manage their own profile, manage their own notes, invite users to their own notes
- Admin: Do we do an admin view? Ban or block specific users, change user roles

## Question looking for answers
- How to determine the expires at for sessions?
- Cascade delete: if a user is deleted, all of their sessions should be deleted as well. 
- What do we do if a user is banned?

Github client secret - 


# Fastify Auth

## Features

+ Create a separate database for notes (A, MY) 
+ Create a testing proxy in nginx (port 83)

- Schema
  - User
  - Session


## Tech Stack 

- **Framework**: Fastify
- **Language**: TypeScript
- **ORM**: Drizzle
- **Driver**: pg (node-postgres)
- **Database**: PostgreSQL 16

### Project Status

#### Completed

- [x] Service scaffolding (Node 20 + TypeScript)
- [x] Docker Environment variables & Docker Secrets
- [x] Database connection pooling (`@fastify/postgres`)
- [x] Data Type definitions ([schema.ts](src/schema.ts))
- [ ] Nginx `auth_request` configuration strategy

### In Progress / Next Steps

- [ ] Configure Drizzle Schema (converting TypeScript interfaces to DB tables)
- [ ] Implement GitHub OAuth handshake (Login route)
- [ ] Session Creation (generating UUIDs and storing in DB)
- [ ] Role-based check logic (for Nginx headers)
- [ ] Admin "Block/Disable User" endpoint

### Frontend recommendations
- [ ] Catch the 500 or 502 with a pretty page saying Server is busy, try again later 

### Planned Features

- [ ] Token rotation (Refresh tokens)
- [ ] Rate limiting for login attempts (Maybe)
- [ ] Multi-factor authentication (Maybe)






## Installation
  - fastify 
  ```
  # Core server and its Postgres bridge
  pnpm add fastify @fastify/postgres
  # Types for Node.js itself
  pnpm add -D @types/node 
  ```
  - typescript 
  ```
  pnpm add -D typescript @tsconfig/node20
  ```
  - postgres 
  ```
  # The actual driver (the "engine")
  pnpm add pg

  # TypeScript help for the driver
  pnpm add -D @types/pg
  ```
  - drizzle
  ```
  # The tool used in the code (index.ts / schema.ts)
  pnpm add drizzle-orm

  # The CLI tool for generating migrations
  pnpm add -D drizzle-kit
  ```

## Why do we need pg, and the connection flow

The short answer is: **`pg` is the "Driver" (the engine), while everything else is the "Dashboard" (the steering wheel and buttons).**

If we doen't explicitly have **pg** then drizzle is handling the driver with its default settings in the background!

Here is the hierarchy of how a message travels from your code to the database:

### Level 1: The Database (Postgres)
This is the actual software running in a separate container. It only speaks its own binary language over the network.

### Level 2: The Driver (`pg`) — **THE ENGINE**
This is the low-level library that knows how to:
*   Open a network socket to the Postgres container.
*   Handle the handshake and password authentication.
*   Send raw SQL strings and get back rows of data.
*   **Without `pg`, your application literally has no "hands" to reach out and touch the database.**

### Level 3: The ORM (`drizzle-orm`) — **THE TRANSLATOR**
Drizzle doesn't actually know how to "talk" to a network. It only knows how to:
*   Convert your TypeScript code into SQL strings.
*   Map the results back into nice TypeScript objects.
*   **It "sits on top" of `pg`.** When you use Drizzle, it internally says to `pg`: *"Hey engine, please send this SQL string I just generated to the database for me."*

### Level 4: The Framework Bridge (`@fastify/postgres`) — **THE MANAGER**
This is a small wrapper that manages **Efficiency**.
*   Instead of opening a new connection for every user, it creates a **Connection Pool** (it keeps 10 connections open and ready).
*   It makes sure that if your server crashes, the database connections are closed properly so you don't leak memory.
*   **It also "sits on top" of `pg`.**

### Summary: Why you need all of them
1.  **`pg`**: To actually move data over the network.
2.  **`drizzle-orm`**: So you don't have to write raw SQL by hand (and for Type Safety).
3.  **`@fastify/postgres`**: To handle connection math and make development easier.

If you removed `pg`, Drizzle and Fastify would both crash because they would have no way to actually "speak" to the database



## Notes
- No redis for development, but an option later

## Schema Draft

User {
  id : some kind of automatically generated uid,
  username: "octocat", 
  auth_provider: "github",
  provider_id: 12345, //unique id of the user in github
  email:"octocat@github.com", 
  status: "active | suspended | banned",
  created_at: 2026-02-25,
}

- Make sure a user can't sign up twice with the same GitHub ID.

session {
  id : UUID,
  user_ud : User["id"],
  role : User["role"],
  expires_at: Date
}













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