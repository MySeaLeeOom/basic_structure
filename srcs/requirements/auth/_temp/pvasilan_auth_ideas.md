 Create a second database in the same Postgres container. auth_db and notes_db. share infrastructure but each service controls its own data therefore microservice architecture is respected

trim down auth container to api/login, /api/auth, /api/logout, and a /verify endpoint for nginx's auth_requests. stops being a gateway

add a redis cache for session storage (allows persistence through restarts, allows load balancer in the future)

SSR flow (initial page load): User->>Nginx: GET / Nginx->>Fastify: Forward Request + Cookie Fastify->>Auth: /verify (internal call, not through nginx) Auth-->>Fastify: 200 + user info OR 401 Fastify-->>User: Render "Hello Pavlos" OR "Please login"

CSR flow (API calls): User->>Nginx: GET /api/notes Nginx->>Auth: /verify Auth-->>Nginx: 200 + X-User-Id header OR 401 Nginx->>Notes: proxy with X-User-Id header

Login flow: User->>Nginx: GET /api/login Nginx->>Auth: proxy Auth-->>User: redirect to 42 OAuth User authenticates on 42 42->>Auth: /api/auth callback with code Auth: exchanges code, creates/updates user, sets session cookie Auth-->>User: redirect to / User->>Nginx: GET / (now with cookie) Nginx->>Fastify: SSR flow begins again (now authenticated)

Regarding headers from auth service (WHOSE notes are these?) 

Step 1: nginx intercepts the request
Step 2: nginx makes a subrequest to your auth service
	Before proxying to the notes service, nginx internally calls GET /verify (your auth endpoint). This subrequest includes the original request's cookies, so the auth service can validate the session.
Step 3: auth service responds
	Your /verify endpoint checks the session, looks up the user, and returns:
	200 OK with headers like X-User-Id: 123 and X-User-Name: john if valid
	401 or 403 if invalid
Step 4: nginx captures those headers
	Using auth_request_set, nginx extracts headers from the auth response into variables:
	location /api/notes {    auth_request /verify;    auth_request_set $user_id $upstream_http_x_user_id;    auth_request_set $user_name $upstream_http_x_user_name;        proxy_pass http://notes:3003;    proxy_set_header X-User-Id $user_id;    proxy_set_header X-User-Name $user_name;}
Step 5: notes service receives trusted headers
	The notes service gets the request with X-User-Id: 123 already set. It doesn't need to validate sessions or talk to the auth service directly. It just reads the header and trusts it because the request came through nginx (which already did the auth check).