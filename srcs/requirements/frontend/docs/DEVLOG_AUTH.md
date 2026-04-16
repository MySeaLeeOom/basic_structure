# Auth Service — Development Log

A running record of significant changes, bug fixes, and architectural decisions made to the auth service over time.

---

## Session — 2026-04-13

### 16. Fix: `providerAccountId` for Local Accounts Now Stores `user.id`

**Files:** `srcs/requirements/auth/src/routes/auth.ts`, `srcs/requirements/auth/src/routes/user.ts`
**DB:** One-off migration run against `auth_db`

#### The Problem

The `accounts` table has a `providerAccountId` field. For OAuth providers (GitHub etc.) this stores the external provider's unique ID — e.g. GitHub's numeric user ID. For local accounts, no external provider exists, so the field was filled with `loginName` as a placeholder — and in one case `user.email`.

This was wrong for two reasons:
- `loginName` can change via `PATCH /change-login`. If it changed, the stored value would go stale.
- The correct semantic equivalent of "the ID this provider uses to identify this user" for a local account is the internal UUID — `user.id` — which never changes.

#### Code Changes

**`srcs/requirements/auth/src/routes/auth.ts` — `createUserAndAccount` helper (~line 37)**

Registration builds the `buildAccount` object before the user is inserted, so `user.id` isn't available yet. The fix goes inside `createUserAndAccount`, after the user row is inserted, overriding `providerAccountId` for local accounts:

```ts
await tx.insert(schema.accounts).values({
    ...account,
    userId: insertedUser.id,
    providerAccountId: account.provider === "local" ? insertedUser.id : account.providerAccountId,
});
```

OAuth accounts are unaffected — they keep their external provider ID.

**`srcs/requirements/auth/src/routes/user.ts` — `POST /change-password` (~line 244)**

When an OAuth user adds a local password for the first time, `upsertAccount` was called with `providerAccountId: user.email`. Changed to `session.userId`:

```ts
// before
providerAccountId: user.email,

// after
providerAccountId: session.userId,
```

#### Data Migration

Existing local accounts in the DB had the old stale values. Updated in place:

```bash
docker exec -i postgres psql -U auth_user -d auth_db \
  -c "UPDATE accounts SET provider_account_id = user_id::text WHERE provider = 'local';"
```

Result: `UPDATE 3` — 3 rows updated. Verified by selecting all local accounts and confirming `provider_account_id = user_id` for each.

---

### 17. Rename: `findAccount` → `findAccountByProviderAccountId`

**File:** `srcs/requirements/auth/src/routes/auth.ts`

The helper function `findAccount` was renamed to `findAccountByProviderAccountId` to make it explicit that it searches by the `providerAccountId` column — not by `userId`. This distinguishes it clearly from the newer `findLocalAccountByUserId` helper. All three occurrences (definition + 2 call sites, both for GitHub OAuth) were updated.

---

### 15. Refactor: Login Account Lookup Now Uses `userId` Instead of `loginName`

**File:** `srcs/requirements/auth/src/routes/auth.ts`

#### The Problem

The local login route looked up a user's password hash in two steps:

1. Find the user row by what they typed — `findUserByIdentifier` searches the `users` table and returns the full user object including `user.id`
2. Find their local account — previously called `findAccount(server.db, "local", user.loginName)`

Step 2 searched the `accounts` table by `provider = "local"` AND `providerAccountId = loginName`. This was fragile: the `accounts` table already has a `user_id` column pointing directly to the user. Using `loginName` as a lookup key meant that if a user changed their username via `PATCH /change-login`, the `providerAccountId` in the `accounts` table would become stale and login would break.

#### What Was Changed

A new helper function `findLocalAccountByUserId` was added next to the existing `findAccount` helper:

```ts
// srcs/requirements/auth/src/routes/auth.ts
async function findLocalAccountByUserId(db: any, userId: string) {
    const [account] = await db
        .select()
        .from(schema.accounts)
        .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.provider, "local")))
        .limit(1);
    return account;
}
```

The login route now uses this instead of `findAccount`:

```ts
// before
const account = await findAccount(server.db, "local", user.loginName);

// after
const account = await findLocalAccountByUserId(server.db, user.id);
```

#### Why This Is Not a Breaking Change

The query returns the same row — just via a different column. `user.id` is already known at that point in the login flow (returned by `findUserByIdentifier` in the previous step), so no extra database call is needed.

---

## Session — 2026-04-12

### 14. Architecture Fix: Auth Service No Longer Controls Frontend Navigation

**Files:** `src/routes/auth.ts`, `src/routes/sessions.ts`, `src/lib/auth_utils.ts` (deleted), `src/app.ts`, `src/index.ts`, `src/tests/auth.test.ts`, `src/tests/TESTING.md`, `srcs/docker-compose.yml`

#### The Bug

On machines where the site was accessed via SSH tunnel (port 8443 forwarded), local login and registration failed with "Failed to fetch." The cause was a mismatch between how `fetch()` and a browser handle HTTP redirects.

`POST /login` and `POST /register` were called by `authStore.loginLocal()` and `authStore.registerLocal()` — JavaScript `fetch()` calls inside the frontend. On success, the auth service returned a `302` redirect to a URL constructed from the `Host` request header.

`fetch()` follows 302 redirects automatically. The `Host` header, as forwarded by Nginx (`proxy_set_header Host $host`), strips the port number. So the redirect destination became `https://localhost/notes` — port 443 — instead of `https://localhost:8443/notes`. Nothing listens on port 443 on a tunneled machine. Network failure. "Failed to fetch."

The redirect was also architecturally wrong: `Login.vue` already called `router.push("/")` on success. The server redirect was redundant — and on a non-standard port, actively harmful.

#### What Was Changed

**`POST /login`, `POST /register` — return JSON instead of redirecting:**

```ts
// Before
await createSession(request, reply, server.db, user.id);
return reply.redirect(getHomeURL(request));

// After
await createSession(request, reply, server.db, user.id);
return reply.send({ success: true });
```

The frontend already handles navigation after these calls. The server's job ends at issuing the session cookie.

**`POST /logout` — same fix:**

`authStore.logout()` called `/logout` via `fetch()` and then immediately did `window.location.href = "/"` itself. The server redirect was silently ignored. Changed to `reply.send({ ok: true })`.

**`GET /` — stripped down to a health check:**

The route previously checked for a session cookie and redirected browsers to `/notes` or `/login` depending on auth state. Both branches were wrong:

1. Navigation decisions belong to the frontend's route guards, not the auth service.
2. `GET /api/auth/` is never navigated to directly by a browser — it is an API endpoint.
3. Nginx's `auth_request` to `/verify` is the real session gate. The session check here was redundant and unreachable from any real user action.

Simplified to:

```ts
server.get("/", async (_request, _reply) => {
    return { service: "auth", status: "running" };
});
```

**GitHub OAuth callback — redirect target from config, not headers:**

The GitHub OAuth callback must redirect (it is a full browser navigation driven by GitHub, not a `fetch()` call). However it was using `getOrigin(request)` — the same fragile header reconstruction. Replaced with `server.frontendUrl`, a value decorated onto the server at startup from the `WEBSITE_URL` environment variable.

```ts
// Before
return reply.redirect(getOrigin(request));

// After
return reply.redirect(server.frontendUrl);
```

**`AppConfig` — `frontendUrl` added:**

```ts
export interface AppConfig {
    // ...
    frontendUrl: string;
}
```

`buildServer` decorates it onto the server: `server.decorate("frontendUrl", config.frontendUrl)`. `index.ts` reads `WEBSITE_URL` from the environment and fails fast at startup if it is missing.

**`docker-compose.yml` — `WEBSITE_URL` uncommented:**

`WEBSITE_URL` existed in `.env` but was commented out in the auth service's `environment` block. The container was never receiving it.

**`src/lib/auth_utils.ts` — deleted:**

The file contained three functions (`getOrigin`, `getHomeURL`, `getBaseURI`) and a `fallback` constant. After these changes, all three functions were either replaced by `server.frontendUrl` or removed entirely. `getBaseURI` was already a dead export — imported in `index.ts` but never called. With nothing left to export, the file was deleted.

#### Tests Updated

`auth.test.ts` assertions updated to match the new contracts:

| Endpoint | Before | After |
|---|---|---|
| `POST /register` success | `302` + `Location` header | `200` + `{ success: true }` |
| `POST /login` success | `302` + `Location` header | `200` + `{ success: true }` |
| `POST /logout` | `302` | `200` + `{ ok: true }` |

The session cookie assertions on register and login were preserved unchanged — `createSession` still runs and sets the cookie regardless of response shape.

`frontendUrl: "http://localhost:8080"` added to the test `AppConfig`.

`TESTING.md` updated to reflect the new status codes and remove references to redirect behaviour.

All 11 tests pass against the live development database.

---

## Session — 2026-04-11

### 9. `PATCH /change-image` — New Route

**File:** `src/routes/user.ts`

**What was done:**
There was no mechanism for a user to set or remove their profile picture URL. The `image_url` column has existed in the `users` table since the initial schema, but no route exposed it for writing.

A new `PATCH /change-image` route was added, following the same pattern as `/change-login` and `/change-email`:

```ts
const ChangeImageSchema = Type.Object({
    imageURL: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
});
```

The schema accepts either a non-empty string (set a new URL) or `null` (remove the existing image). Sending an empty string is rejected by `minLength: 1`, which forces callers to use `null` explicitly for removal — avoiding ambiguity between "I forgot to fill in the field" and "I want to clear my picture."

```ts
server.patch("/change-image", { schema: { body: ChangeImageSchema } }, async (request, reply) => {
    const session = await verifySession(request, server.db);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { imageURL } = request.body;
    await server.db.update(schema.users).set({ imageURL }).where(eq(schema.users.id, session.userId));
    return { message: "Profile picture updated.", user: { imageURL } };
});
```

---

### 8. `PATCH /change-password` — Correct Behaviour for OAuth-Only Users

**File:** `src/routes/user.ts`

**What was done:**
The change-password route already handled the case where no local account existed — it skipped old-password verification and created a new local account. However, the frontend had no way to know this was the case, so it required the old password field to be filled in regardless, preventing OAuth-only users from ever setting a password.

With `hasLocalAuth` now available in the `/me` response (item 7 above), the frontend can conditionally:
- Disable the "Current Password" field for OAuth-only users
- Change the button label from "Change Password" to "Add Password"
- Skip the old-password validation in the submit handler

The backend route required no changes — it was already correct. The gap was purely in the frontend not having the information to render the right UI.

---

### 7. `/me` — `hasLocalAuth` Field Added

**File:** `src/routes/user.ts`

**What was done:**
The `/me` endpoint returned only identity fields (`id`, `loginName`, `email`, `role`, `imageURL`, `createdAt`). There was no way for the frontend to know whether the currently authenticated user has a local password account — meaning one row in the `accounts` table with `provider = 'local'` and a non-null `passwordHash`.

This matters for the Account settings page: the "Change Password" form needs to behave differently depending on whether a local account exists. Without this flag, the frontend cannot distinguish a GitHub-only user from a user who registered locally.

**The fix:**
A second query is executed after the user lookup, checking for the presence of a local account row:

```ts
const [localAccount] = await server.db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(and(eq(schema.accounts.userId, user.id), eq(schema.accounts.provider, "local")))
    .limit(1);
```

`hasLocalAuth: !!localAccount` is included in the response. The double-negation converts the result to a plain boolean — `true` if the row exists, `false` if it does not.

---

### 6. Frontend Middleware — /home Added to Public Routes

**File:** `app/middleware/auth.global.ts`

`/home` was added to the `publicRoutes` array alongside `/login`. Without this, unauthenticated users navigating to `/home` were immediately redirected to `/login`, which is unintended behaviour for a public-facing landing page.

```ts
const publicRoutes = ["/login", "/home"];
```

---

### 5. Test Suite Expansion

**File:** `src/tests/auth.test.ts`

Seven new tests were added to the existing integration suite. All run against the live development database using `server.inject()`.

| Test | What it verifies |
|---|---|
| Login with non-existent user | 401 returned; same message as wrong password (no user enumeration) |
| Duplicate loginName on register | 409 with "Username already taken." |
| `GET /verify` — valid session | 200, `authenticated: true`, `X-User-Id` header present |
| `GET /verify` — no cookie | 401 |
| `GET /verify` — expired session | 401 AND the database row is confirmed deleted |
| `POST /logout` | Session row deleted, cookie cleared in response |
| `GET /verify` after logout | 401; revoked token cannot be reused |

The expired session test directly validates the lazy deletion change from item 1 above. It:
1. Deletes all existing sessions for the test user (clean slate)
2. Logs in to create exactly one session
3. Backdates `expires_at` directly in the database
4. Calls `/verify` with that cookie
5. Queries the `sessions` table and asserts the row is gone

**`src/tests/TESTING.md`** was updated to document all implemented tests (1–11) and reduce the Planned Tests section to only what genuinely remains uncovered.

---

### 4. TypeBox Type Provider Integration

**Files:** `src/app.ts`, `src/routes/auth.ts`, `src/routes/sessions.ts`, `src/routes/user.ts`

**Package added:** `@fastify/type-provider-typebox@6.1.0`

#### The Problem

TypeScript operates at compile time. Fastify's runtime validator (Ajv) operates at runtime. These two systems did not communicate.

Fastify receives a TypeBox schema object on a route and uses it to validate incoming request data. But the TypeScript compiler — reasoning about the code before it ever runs — looks at `request.body` and sees only `unknown`. It has no mechanism to inspect the schema object and infer a type from it.

The consequence was manual casts throughout the codebase:

```ts
const { loginName, email, password } = request.body as RegisterType;
```

A cast (`as`) is an instruction to the compiler to stop checking and trust the developer. It breaks the automatic safety net TypeScript provides. If the schema changes and the cast is not updated, the mismatch is invisible at compile time.

#### What a Type Provider Is

A type provider is a purely compile-time construct — it has no runtime existence. It is a TypeScript generic parameter that teaches Fastify's internal type machinery how to answer one question: *"Given a TypeBox schema on a route, what TypeScript type should `request.body` have?"*

`TypeBoxTypeProvider` answers: *"Apply `Static<typeof schema>` to extract the TypeScript type from the TypeBox schema."*

#### The Changes

**`src/app.ts`:**

```ts
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

const server = fastify({ ... }).withTypeProvider<TypeBoxTypeProvider>();
```

`.withTypeProvider<TypeBoxTypeProvider>()` returns the exact same JavaScript object at runtime. Nothing changes in the running application. At compile time, the server's type now includes the TypeBox responder — any route registered on this server can have its body/query types inferred automatically from the schema.

The explicit return type annotation `: Promise<FastifyInstance>` was also removed from `buildServer`. Keeping it would have caused TypeScript to **widen** the return type — discarding the more specific typed version back to the plain base. Without the annotation, TypeScript infers the return type from what is actually returned, preserving all type information for callers.

**`src/routes/auth.ts`, `sessions.ts`, `user.ts`:**

Each route file was changed from:

```ts
export const authRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
```

to:

```ts
export const authRoutes: FastifyPluginAsyncTypebox = async (server) => {
```

`FastifyPluginAsyncTypebox` is the same plugin type as `FastifyPluginAsync`, but parameterised to expect a TypeBox-aware server. The `server` parameter type is inferred automatically from the plugin type declaration — writing `(server: FastifyInstance)` explicitly would have overridden that inference and weakened the type back to the untyped base.

In `user.ts`, route-level generics that were the previous workaround were removed:

```ts
// Before — manual type annotation as workaround
server.patch<{ Body: ChangeLoginType }>("/change-login", { schema: { body: ChangeLoginSchema } }, ...)

// After — type inferred from schema automatically
server.patch("/change-login", { schema: { body: ChangeLoginSchema } }, ...)
```

In `auth.ts`, the `as RegisterType` and `as LoginType` casts were removed. `request.body` is now correctly typed without any manual intervention.

**Result:**
Schema and type are now one source of truth. If `RegistrationSchema` changes, the compiler immediately reports any code that no longer matches — no manual cast to update, no silent drift possible.

---

### 3. Error Message Standardisation

**File:** `src/routes/auth.ts`

**What was done:**
The duplicate loginName error message was `"Login name already taken."`. This was changed to `"Username already taken."` to match the language used in `user.ts` (the `/change-login` route) and to use the term the frontend presents to users.

---

### 2. Bug Fix: Duplicate Registration Check Only Checked loginName

**File:** `src/routes/auth.ts`

**What was done:**
The registration route checked for duplicate users with a single call:

```ts
const userExists = await findUserByIdentifier(server.db, loginName || email);
```

The intent was: check loginName, and if that is empty, check email. The problem is that `loginName` is declared in the TypeBox schema with `minLength: 3`, which means the TypeScript compiler guarantees it is always a non-empty string. In JavaScript, any non-empty string is **truthy**, so `loginName || email` **always** evaluates to `loginName`. The email was never checked.

This means a user could register with a duplicate email as long as their chosen loginName was unique. The database uniqueness constraint would eventually catch it — but with a generic 500 error rather than a proper 409 Conflict.

**The fix:**
Two separate, explicit lookups:

```ts
const loginConflict = await findUserByIdentifier(server.db, loginName);
if (loginConflict) {
    authRegisterTotal.labels("conflict_login").inc();
    return reply.status(409).send({ error: "Username already taken." });
}

const emailConflict = await findUserByIdentifier(server.db, email);
if (emailConflict) {
    authRegisterTotal.labels("conflict_email").inc();
    return reply.status(409).send({ error: "Email already registered." });
}
```

Each conflict now returns a precise 409 with an accurate message.

**Note on the root cause:**
TypeBox validates the *shape* of incoming data — it cannot reason about how the application uses that data after validation. The `||` operator is pure JavaScript logic. TypeBox's guarantee that `loginName` is always truthy is a fact the developer must be aware of when writing control flow that involves `loginName`. This class of bug is subtle precisely because the code looks intentional.

---

### 1. Session Expiry: Lazy Deletion

**File:** `src/lib/session_helpers.ts`

**What was done:**
When `verifySession()` found an expired session row, it returned `null` and moved on. The row stayed in the database forever. Over time, sessions accumulate — every user who simply closes their browser and never logs out leaves a dead row behind with no mechanism to clean it up.

**The fix:**
Before returning `null`, the expired row is now deleted:

```ts
if (session.expiresAt < new Date()) {
    await db.delete(schema.sessions).where(eq(schema.sessions.token, sessionUUID));
    return null;
}
```

This is called **lazy deletion** — cleanup happens on demand, at the moment a stale record is encountered, rather than via a scheduled background process. It requires no extra infrastructure and keeps the sessions table lean over time.

The 401 response from `/verify` is unchanged. Nginx and the frontend middleware continue to behave identically.

---

### Outstanding Items

- Login with a GitHub-only account attempting password login (no local account) — not yet tested
- User management endpoints (`/me`, `/change-login`, `/change-email`, `/change-password`, `/delete-account`) — no test coverage yet
- `@fastify/type-provider-typebox` integration does not yet cover `format: "email"` validation — Ajv v8 requires `ajv-formats` to enforce `format` keywords at runtime
