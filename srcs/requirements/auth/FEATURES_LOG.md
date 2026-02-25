## 20.02.26 - Feb 20

- enable logging - from prometheus / graphana
- pnpm add -D pino-pretty: pino is an intergrated logger in fastify, it is super fast but naturally outputs logs in one line, with an entire json being one line. This makes it human readable.
`docker logs -f auth | pnpm exec pino-pretty`


- pnpm add @fastify/oauth2: fastify native OAUTH2 libary, wrapper of simple-oauth2
- create docs and diagrams to illustrate OAUTH2 
	- initial oauth flow
	- potential options of what to do with credentials
		- create our own user and manage sssions
		- stay connected to provider with read/write privileges (we dont do this)
		- potentially keep multiple providers
- fix nginx config
	- rewrite the request url (take out /api/auth/)  
	- hold auth as variable
	- add relevant headers to track ip or original request and host (!)
	- make nginx config documentation in a README in requirement/nginx/

### Access_token
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
### User api call
{
  login: 'catdev42',
  id: 139005538,
  node_id: 'U_kgDOCEkOYg',
  avatar_url: 'https://avatars.githubusercontent.com/u/139005538?v=4',
  gravatar_id: '',
  url: 'https://api.github.com/users/catdev42',
  html_url: 'https://github.com/catdev42',
  followers_url: 'https://api.github.com/users/catdev42/followers',
  following_url: 'https://api.github.com/users/catdev42/following{/other_user}',
  gists_url: 'https://api.github.com/users/catdev42/gists{/gist_id}',
  starred_url: 'https://api.github.com/users/catdev42/starred{/owner}{/repo}',
  subscriptions_url: 'https://api.github.com/users/catdev42/subscriptions',
  organizations_url: 'https://api.github.com/users/catdev42/orgs',
  repos_url: 'https://api.github.com/users/catdev42/repos',
  events_url: 'https://api.github.com/users/catdev42/events{/privacy}',
  received_events_url: 'https://api.github.com/users/catdev42/received_events',
  type: 'User',
  user_view_type: 'public',
  site_admin: false,
  name: null,
  company: null,
  blog: '',
  location: null,
  email: null,
  hireable: null,
  bio: null,
  twitter_username: null,
  notification_email: null,
  public_repos: 40,
  public_gists: 0,
  followers: 13,
  following: 2,
  created_at: '2023-07-08T17:45:46Z',
  updated_at: '2026-01-31T22:28:17Z'
}

### user/emails permissions
This api call and permissions request for github is as of now too invasive as we get access to the user's private emails.

https://api.github.com/user/emails 
[
  {
    "email": "139005538+catdev42@users.noreply.github.com",
    "primary": false,
    "verified": true,
    "visibility": null
  },
  {
    "email": "user@student.42berlin.de",
    "primary": true,
    "verified": true,
    "visibility": "private"
  },
  {
    "email": "johndoe@gmail.com",
    "primary": false,
    "verified": true,
    "visibility": null
  }
]

TODO: 
2 endpoints needed:
- one to redirect to a provider url (done)
- one use that we send to provider to redirect to us and discover if they are verified

## 21.02.26 - Feb 21

### What is a cookie
- a cookie is a key value pair that the browser stores in association with a website and sends automatically with every request
- things can be stored in local storage as well, but that is not sent automaticlaly by the browser


## 22.02.26

- **Composite Unique Contraint**
  - add [unique('provider_p_id').on(table.provider, table.provider_id)] as third argument to pgTable

- ~~TODO: "dev": "pnpm db:push && tsx watch src/index.ts"~~
- ~~Add to package.json: `"dev": "pnpm db:generate && tsx watch src/index.ts`~~
### Instructions
  - run pnpm db:generate locally to make a migrate file (LOCALLY/maintenance)
  - auth server index.ts will run it on startup in server.after
  - In production we will add the migration file to the server, it is source of truth
### Note: migration files and their usage
- They function as the source of truth as we work with an existing database. We must track all changes because otherwise the db might assume we deleted one table and added another one...

- How does the migration keep track of the fact that we Altered the column instead of deleting it and putting a new one???? Ddo we write that command? So we don't simply change the schema in schema.ts???

## 23.02.26

- Add things to sessions
  - UUID token (why we need this outsire of the is on sessions?)
  - userAgent (what type of device, to be able to tell the user)
  - ip_address (the ip address of last access)


### Cookie looks like this: `session_id=my-random-uuid.6H7z...`

### COOKIE registration options
```
reply.setCookie("session_id", session.token, {
			path: "/",
			httpOnly: true,
			secure: false, // Set to TRUE when using real HTTPS
			sameSite: "lax",
			expires: expiresAt,
			signed: true,
		});
```
  1. httpOnly (Preventing "The Script Thief")
This prevents any js from getting a hold of the cookie in a "Cross-Site Scripting" or XSS attack. Otherwise it could simply run document.cookie and steal the session ID.

By marking it httpOnly, you are telling the browser: "This cookie is for the network only. Do NOT let any JavaScript touch it or even know it exists." This makes it impossible for an XSS script to steal the session directly.

2. signed: true (Preventing "The Identity Forger")
When you "sign" a cookie, you take the Session ID and a Secret Key (your session_cookie_secret) and run them through a machine called a HMAC (Hash-based Message Authentication Code). This creates a "Signature."

If a user tries to change their cookie from 123 to 456 in their browser, they don't know your Secret Key. When they send the fake 456 back to your server, Fastify will see that the signature doesn't match and will reject the cookie as tampered.

It is the equivalent of a wax seal on a letter—if the seal is broken or looks wrong, you know the message inside cannot be trusted.

3. secure: true / false (Preventing "The Eavesdropper")
secure: true: Tells the browser to only send this cookie over a secure, encrypted HTTPS connection.
In your current Docker dev environment, you are using secure: false because you're talking over plain HTTP. But once you move into "The Real World" with an SSL certificate, this becomes your final shield against anyone trying to "sniff" your network traffic.

4. sameSite: "lax" (Preventing "The Impersonator")
This prevents Cross-Site Request Forgery (CSRF). It tells the browser: "Only send this cookie if the user is actually on my website." If they are on evil-site.com and it tries to send a background request to masha-notes.com, the browser will refuse to include the cookie.

### Working with the cookie

		const sessionId = request.unsignCookie(request.cookies.session_id || "");


when you receive the cookie, you can pull it out of request
const sessionId= request.unsignCookie(request.cookies.session_id || "");

## 24.02.26

## Route registration:
Register: Runs once at boot. Builds the Router.

1. Setup: initialization of all the routes - fastify will know
2. Request: fastify already knows all the routes
3. Context: the sessionRoutes / authRoutes will know the server forever

### routes/session_helper.ts
```
export async function createSession(
	request: FastifyRequest,
	reply: FastifyReply,
	db: NodePgDatabase<typeof schema>,
	userId: number,
	role: "admin" | "user" = "user",
) {
  ...
  return session;
}

export async function verifySession(request: FastifyRequest, db: NodePgDatabase<typeof schema>) {
	...
	return user || null;
}



```

### routes/auth_utils.ts

### routes/auth.ts
Makes separate file / logic for authorization
```
export const authRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
	server.get("/login/github/callback", async function (request, reply) {
    ...
  })

  TODO:
  	// separate one for checking session/cookie
	server.get("/", async (request, reply) => {
		return { message: "Auth service root placeholder" };
	});

	// local login placeholder
	server.get("/login", async (request, reply) => {
		return { message: "Local login placeholder" };
	});
}
```
`server.register(authRoutes);`


### routes/sessions.ts
```
export const sessionRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.get("/verify", async (request, reply) => {
		// 1. HELPER: Verify Session
		const user = await verifySession(request, server.db);

		if (!user) {
			console.log("Session invalid or expired.");
			return reply.status(401).send({ error: "No active session." });
		}

		// SUCCESS: The Identity is Verified
		return {
			authenticated: true,
			user: {
				id: user.id,
				email: user.email,
				role: user.role,
			},
		};
	});

	// LOGOUT: The Revocation
	server.post("/logout", async (request, reply) => {
		// 2. HELPER: Revoke Session
		await revokeSession(request, reply, server.db);
		return { message: "Logged out successfully" };
	});
}
```
`server.register(sessionRoutes);`

## Fastify Hooks: Information

Fastify's Lifecycle is a precise, ordered sequence of events. The most "First Principle" hooks give you control at crucial moments of that sequence.

### 1. `onRequest` (The Gatekeeper)
**When**: Before Fastify even looks at the body or parses cookies. It happens the moment the request hits the server.
**Use Case**: 
-   **Rate Limiting**: "You've sent too many requests, stop right there."
-   **IP Filtering**: "We don't serve your country."
-   **Logging**: "Someone is knocking at the door."

**Usecase**: It runs *before* any potentially expensive parsing logic. It saves your server resources by rejecting bad requests early.

### 2. `preValidation` (The Bouncer)
**When**: After parsing the request body/cookies/query, but *before* validation.
**Use Case**:
-   **Authentication (Our JWT/Session Checks)**: "Let me check your ID card before I let you into the VIP room."
-   **Content-Type Check**: "We only accept JSON here."

**Usecase**: This is where you manipulate the request object (add `request.user`) so that your route handler receives a "complete" and "verified" object.

### 3. `onSend` (The Editor)
**When**: The route handler has finished, and the response payload is ready, but *before* it is sent to the client.
**Use Case**:
-   **Modifying Payload**: Wraps every response in `{ data: ..., meta: ... }`.
-   **Setting Headers**: "Let's add `Cache-Control` to everything."
-   **Encryption**: "Let's encrypt the body before we send it out."

**Usecase**: It gives you one last chance to intercept the package before it leaves the building.

### 4. `onError` (The Cleaner)
**When**: An error is thrown anywhere in the lifecycle.
**Use Case**:
-   **Global Error Handling**: Converting ugly database errors into clean `500 Internal Server Error` messages.
-   **Reporting**: Sending error details to Sentry or Datadog.

### 5. `onClose` (The Shutdown)
**When**: The server.close() method is called.
**Use Case**:
-   **Graceful Shutdown**: Closing database connections.
-   **Stopping Timers**: Cleaning up intervals.

**Why it's profound**: It ensures your application doesn't leave "ghost connections" hanging when it dies.

For your Auth service, `preValidation` is your best friend. It is where you will verify sessions and decide if the route handler should even run.



## 25.02.26

- Added a login name to schema

-track all changes
