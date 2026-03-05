In our quest for structural integrity, we must distinguish between **Checking an Identity** and **Becoming a Representative**. You have correctly identified that there are different "Options" based on the **Atomic Goals** of your application.

Here are the two primary paths we can take after receiving the `access_token` from the Provider for the first time.

---

### Option 1: The "Identity Verification" Path (Social Login)
In this scenario, we only care about **who** the user is. We use the Provider as a "Trusted Verifier" and then we throw the key away.

```mermaid
%%{init: { 'theme': 'base', 'themeVariables': { 'background': '#ffffff', 'primaryColor': '#ffffff', 'primaryTextColor': '#3f3f46', 'primaryBorderColor': '#3f3f46', 'lineColor': '#3f3f46', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'noteBkgColor': '#ffffff', 'noteTextColor': '#3f3f46', 'noteBorderColor': '#3f3f46', 'actorBkg': '#ffffff', 'actorTextColor': '#3f3f46', 'actorBorder': '#3f3f46', 'labelTextColor': '#3f3f46', 'loopTextColor': '#3f3f46', 'activationBkgColor': '#ffffff', 'sequenceNumberColor': '#3f3f46', 'signalColor': '#3f3f46', 'signalTextColor': '#3f3f46' }}}%%
sequenceDiagram
    autonumber
    participant S as My Auth Service
    participant P as Provider (Facebook)
    participant DB as Postgres DB

    Note over S, P: Phase: "Who are you?"
    S->>P: GET /me (using access_token)
    P-->>S: JSON { id: "FB_123", email: "masha@..." }
    
    Note over S: 1. DISCARD Access Token (Memory Only)
    
    Note over S, DB: Phase: "Welcome Home"
    S->>DB: UPSERT User (email, fb_id)
    DB-->>S: UserRecord { id: 101 }
    
    Note over S: 2. Generate OUR OWN Session Cookie
    S-->>S: Session: { user_id: 101 }
```

**The Logical Truth:** We treat the `access_token` like a **Temporary Visitor's Badge**. We use it once to look at their ID card, then we shred the badge. 
*   **Storage:** We only store the User's Email and their `provider_id` (so we know who they are next time they return).
*   **Pros:** Very secure. If our database is stolen, the hackers don't get the user's Facebook password or keys.
*   **Cons:** We cannot "do" anything in Facebook later.

---

### Option 2: The "Continuous Integration" Path (The Agent)
In this scenario, we want to act on the user's behalf even when they are asleep. We are building a "Representation" of the user.

```mermaid
%%{init: { 'theme': 'base', 'themeVariables': { 'background': '#ffffff', 'primaryColor': '#ffffff', 'primaryTextColor': '#3f3f46', 'primaryBorderColor': '#3f3f46', 'lineColor': '#3f3f46', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'noteBkgColor': '#ffffff', 'noteTextColor': '#3f3f46', 'noteBorderColor': '#3f3f46', 'actorBkg': '#ffffff', 'actorTextColor': '#3f3f46', 'actorBorder': '#3f3f46', 'labelTextColor': '#3f3f46', 'loopTextColor': '#3f3f46', 'activationBkgColor': '#ffffff', 'sequenceNumberColor': '#3f3f46', 'signalColor': '#3f3f46', 'signalTextColor': '#3f3f46' }}}%%
sequenceDiagram
    autonumber
    participant S as My Auth Service
    participant P as Provider (Facebook)
    participant DB as Postgres DB

    Note over S, P: Phase: "Become the Agent"
    S->>P: GET /me (using access_token)
    P-->>S: JSON { id: "FB_123", email: "masha@..." }
    
    Note over S, DB: Phase: "Store the Power"
    S->>DB: UPSERT User + STORE(access_token, refresh_token)
    DB-->>S: SUCCESS
    
    Note over S: (Later that night, user is offline)
    S->>DB: READ(access_token) for User 101
    S->>P: GET /user/photos (using access_token)
    P-->>S: Data Delivered
```

**The Logical Truth:** We treat the `access_token` like a **Key to the User's House**. We put it in our vault (`postgres`) so we can enter their house (Facebook) and perform chores (read data) whenever we need to.
*   **Storage:** We store the Email, the `provider_id`, the `access_token`, and the `refresh_token`.
*   **Pros:** Powerful. We can sync notes across platforms or fetch content automatically.
*   **Cons:** High risk. If our database is stolen, the hackers can now "act" as our users on Facebook.

---

### The C++98 Comparison: Transient vs. Persistent State

Think of these two options as different ways of handling a **Resource Handle**:

*   **Option 1 (Transient):**
    ```cpp
    void handleLogin(Token t) {
        User u = Provider::fetchUser(t); // Use the handle briefly
        Database::sync(u);              // Save the person, not the handle
        // Token 't' goes out of scope and is deleted.
    }
    ```

*   **Option 2 (Persistent):**
    ```cpp
    void handleIntegration(Token t, RefreshToken r) {
        User u = Provider::fetchUser(t);
        Database::sync(u);
        Database::storeCredentials(u.id, t, r); // Save the handle for later use
    }
    ```

**In our Note-Taking App:** You must decide what your mission is. If you just want them to log in, use **Option 1**. If you want to "Import notes from GitHub," you must use **Option 2**.

---

### Option 3: The "Hybrid Authority" (The Multi-Key Record)
In this scenario, we decouple the User's existence from any single third party. We treat our app as the "Master" and allow multiple ways to prove identity.

```mermaid
%%{init: { 'theme': 'base', 'themeVariables': { 'background': '#ffffff', 'primaryColor': '#ffffff', 'primaryTextColor': '#3f3f46', 'primaryBorderColor': '#3f3f46', 'lineColor': '#3f3f46', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'noteBkgColor': '#ffffff', 'noteTextColor': '#3f3f46', 'noteBorderColor': '#3f3f46', 'actorBkg': '#ffffff', 'actorTextColor': '#3f3f46', 'actorBorder': '#3f3f46', 'labelTextColor': '#3f3f46', 'loopTextColor': '#3f3f46', 'activationBkgColor': '#ffffff', 'sequenceNumberColor': '#3f3f46', 'signalColor': '#3f3f46', 'signalTextColor': '#3f3f46' }}}%%
graph TD
    UserRecord[Internal User ID: 101]
    UserRecord --> LinkA[GitHub ID: gh_123]
    UserRecord --> LinkB[Facebook ID: fb_456]
    UserRecord --> LinkC[Local Auth: Email + Hashed Password]
    UserRecord --> Guard[2FA: TOTP Secret]
    
    LinkC --> Guard
    LinkA -.-> Guard
```

**The Logical Truth:** We treat the User as a **Citizen** of our app, not just a guest of a Provider.
*   **Storage:** `user_id`, multiple `provider_id`s, local credentials (hashed), and optional 2FA secrets.
*   **2FA (Two-Factor):** An additional "Challenge-Response" layer required regardless of the login method.
*   **Pros:** Total resilience. If GitHub is deleted, the user logs in with their Password or Facebook. No data is lost.
*   **Cons:** Higher complexity in the `auth` service.

---

### The Lifespan of a Credential
 To answer your question rigorously: **In Option 1 (Identity Verification), Refreshing typically does not fit at all.** 

To understand why, we must deconstruct the "Succession of Authority."

### 1. The Hand-off of the "Master"
In **Option 1**, the Provider (GitHub/Facebook) is merely a **Witness**.
*   **The Moment of Login:** GitHub says, *"Yes, this is Masha."*
*   **The Transition:** You create a row in your `postgres` DB and issue **Your Own Session Cookie** (e.g., valid for 30 days).
*   **The Result:** From that second onward, your server is the "Master" of Masha's session. You no longer care if GitHub's 1-hour `access_token` expires, because you aren't using it for anything. You have already "Verified the Passport" and issued an "Internal ID Card."

### 2. When Refreshing *Does* Happen (The Identity Loop)
The only time refreshing fits into an Identity path is if you want to **Continuously Re-Verify** that the user's GitHub account is still active *without* making them click a button.

```mermaid
%%{init: { 
  'theme': 'base', 
  'themeVariables': {
    'background': '#ffffff',
    'primaryColor': '#ffffff',
    'primaryTextColor': '#3f3f46',
    'primaryBorderColor': '#3f3f46',
    'lineColor': '#3f3f46',
    'secondaryColor': '#ffffff',
    'tertiaryColor': '#ffffff',
    'noteBkgColor': '#ffffff',
    'noteTextColor': '#3f3f46',
    'noteBorderColor': '#3f3f46',
    'actorBkg': '#ffffff',
    'actorTextColor': '#3f3f46',
    'actorBorder': '#3f3f46',
    'labelTextColor': '#3f3f46',
    'loopTextColor': '#3f3f46',
    'activationBkgColor': '#ffffff',
    'sequenceNumberColor': '#3f3f46',
    'signalColor': '#3f3f46',
    'signalTextColor': '#3f3f46'
  }
}}%%
sequenceDiagram
    autonumber
    participant B as User's Browser
    participant S as My Auth Service
    participant P as Provider (GitHub)

    Note over B, S: User has an active session with us
    B->>S: GET /my-notes (presents our Cookie)
    
    Note over S: Phase: Verification Check
    S->>S: "Is our internal session still valid?" (Yes)
    S-->>B: 200 OK (Deliver Notes)

    Note over S: [Event: GitHub Access Token Expires]
    
    Note over S: (Wait, we need to check if they still have a GitHub account)
    S->>P: POST /refresh (presents GitHub Refresh Token)
    P-->>S: 200 OK (New GitHub Access Token)
    Note over S: Identity re-verified silently.
```

### 3. The Atomic Difference
*   **Option 2 (The Agent):** Refreshing is **Required**. You need a fresh key to keep reading their files or posting to their wall while they are away.
*   **Option 1 (The Social Login):** Refreshing is **Optional/Rare**. Most apps simply wait for their *own* session to expire. When it does, they just send the user through the "Departure Gate" again. If the user is still logged into GitHub, the process takes 0.5 seconds and feels "silent" anyway.

### The C++98 Analogy: The Cache vs. The Connection
Think of **Option 1** like a **DNS Cache**.
*   You ask the DNS server (GitHub) for an IP (Identity).
*   You store that IP in your local cache for 24 hours.
*   Even if the DNS server goes down or the original record changes, you keep using your cache until it expires. You don't need to "Refresh" the DNS link every minute.

**In summary:** In most "Identity" scenarios, we don't store the refresh token at all. We trust our own session once the identity is proven. We only keep the refresh token if we plan to act as an "Agent" (Option 2) or if we want a very strict, real-time link to the user's social account status.

Does this clarify why "Refreshing" feels like it belongs more to the powerful "Agent" path than the simple "Social Login" path?