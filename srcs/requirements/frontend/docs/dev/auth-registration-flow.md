# Auth Registration Flow

## How registration works through Nginx

```mermaid
sequenceDiagram
    participant Browser
    participant Nginx
    participant Auth

    Browser->>Nginx: POST https://localhost/api/auth/register
    Note over Nginx: SSL termination (HTTPS → HTTP)
    Nginx->>Auth: POST http://auth:3000/register<br/>X-Forwarded-Proto: https
    Auth->>Auth: Create user + session
    Auth-->>Nginx: 302 Redirect to https://localhost/notes<br/>Set-Cookie: session_id=...
    Nginx-->>Browser: 302 + Set-Cookie
    Browser->>Browser: Stores cookie
    Browser->>Nginx: GET https://localhost/notes (with cookie)
    Note over Browser: Logged in!
```

## The bug (before the fix)

```mermaid
sequenceDiagram
    participant Browser
    participant Nginx
    participant Auth

    Browser->>Nginx: POST https://localhost/api/auth/register
    Note over Nginx: SSL termination (HTTPS → HTTP)
    Nginx->>Auth: POST http://auth:3000/register<br/>❌ No X-Forwarded-Proto
    Auth->>Auth: Create user + session
    Note over Auth: Defaults to http:// (doesn't know it was HTTPS)
    Auth-->>Nginx: 302 Redirect to http://localhost/notes<br/>Set-Cookie: session_id=...
    Nginx-->>Browser: 302 to http://localhost/notes + Set-Cookie
    Browser->>Nginx: GET http://localhost/notes
    Nginx-->>Browser: 301 Redirect to https://localhost/notes
    Note over Browser: ❌ Cookie lost in redirect chain
    Browser->>Nginx: GET https://localhost/notes (no cookie)
    Note over Browser: Not logged in!
```

## Fix

Added `proxy_set_header X-Forwarded-Proto $scheme;` to the `/api/auth` location block in `nginx.conf`, so the auth service knows the original protocol.
