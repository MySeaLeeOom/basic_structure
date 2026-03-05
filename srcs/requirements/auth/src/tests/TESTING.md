# Auth Service Integration Tests

## How to run the test

from 'srcs' folder run `docker compose exec auth pnpm test`

---

These integration tests verify the authentication flow from the outside in, treating the Fastify server as a black box (mostly). We use `server.inject()` to simulate HTTP requests without the overhead of actual network calls.

## Test Suite: `Auth Routes (Integration)`

The tests run against the **running development database** (as configured in `docker-compose.yml`), but they are designed to be idempotent (repeatable) by cleaning up after themselves.

### 1. Registration (`POST /register`)
**Goal**: Verify a user can sign up.
- **Action**: Sends a POST request with `loginName`, `email`, and `password`.
- **Checks**:
    - **Status 302**: Expects a redirect (Standard pattern for successful form submissions).
    - **Location**: specific fallback URL (e.g., `http://localhost:8080/notes`).
    - **Cookie**: Checks that a `session_id` HttpOnly cookie is set (signed).

### 2. Duplicate Registration
**Goal**: Verify constraints prevent double sign-ups.
- **Action**: Tries to register `bob@example.com` again.
- **Checks**:
    - **Status 409**: Conflict.
    - **Error Message**: "Email already registered."

### 3. Login (`POST /login`)
**Goal**: Verify a user can return and log in.
- **Action**: Sends a POST request with the registered credentials.
- **Checks**:
    - **Status 302**: Redirects to the app.
    - **Cookie**: A new session cookie is issued.

### 4. Invalid Login
**Goal**: Verify security against bad passwords.
- **Action**: Sends a POST request with the correct email but wrong password.
- **Checks**:
    - **Status 401**: Unauthorized.

---

## Cleanup & Safety

**"Do we erase what we added?"**
**Yes.**

We use an `afterAll` hook to strictly remove the test data:

```typescript
afterAll(async () => {
    // Hard delete the test user based on the specific test email
    await server.db.execute(sql`DELETE FROM users WHERE email = 'bob@example.com'`);
    await server.close(); 
});
```

We also run this **before** the tests start (`beforeAll`), just in case a previous test run crashed halfway through and left "Bob" in the database.
