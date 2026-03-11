# Auth System Implementation & Nginx Integration (Pre-Migration)

This document records the foundational authentication architecture established prior to the Nuxt 4/SSR migration, focusing on the "First Principles" of secure microservice communication.

## 1. Identity Verification (The Auth Service)
*   **Purpose:** Act as the "Source of Truth" for user identity.
*   **Initial Discovery:** Implemented a `/verify` endpoint to check session validity and a `/logout` to clear server-side session cookies.
*   **Local Strategy:** Added `loginLocal` and `registerLocal` controllers to handle traditional email/password credentials alongside the pre-existing OAuth flow.

## 2. The Gateway Proxy (Nginx Integration)
*   **Central Dispatch:** Transitioned the frontend to use relative API paths (e.g., `/api/auth`), allowing Nginx to handle routing between the frontend, auth, and backend services.
*   **The `auth_request` Pattern:**
    *   **Logic:** Every request to a protected resource (like `/api/notes`) is intercepted by Nginx and "paused."
    *   **The Handshake:** Nginx sends a sub-request to the Auth Service's `/verify` endpoint.
    *   **The Decision:** 
        *   If `/verify` returns `200 OK`, Nginx allows the original request to proceed.
        *   If it returns `401 Unauthorized`, Nginx blocks the request and redirects the user to `/login`.
*   **Internal Identity Injection (`X-User-Id`):**
    *   Configured Nginx (`auth_request_set`) to extract the user's UUID and login name from the Auth Service's response headers.
    *   **Handover:** These values are then injected into the headers of the request sent to the Notes/Editor services, allowing them to know "WHO" is asking without needing to re-verify the session themselves.
*   **Internal Identity Injection (`X-User-Role`):**


## 3. UI Integration & Global State (The Auth Store)
*   **The Auth Store (`authStore.ts`):** Established the central state for user identity in the frontend.
    *   **Variables (State):**
        *   `user`: Holds the decrypted user object (`id`, `loginName`, `email`, `role`) or `null`.
        *   `isAuthenticated`: A computed property derived from the presence of a user.
        *   `loading`: Tracks the status of network handshakes.
        *   `error`: Captures any authorization failures for UI feedback.
    *   **Core Handshakes (Actions):**
        *   `checkAuth()`: The most critical action. It polls the `/api/auth/verify` endpoint to see if the user's browser cookie is still valid.
        *   `logout()`: Deletes the session on the server and clears the local state.
        *   `loginLocal()` / `registerLocal()`: Interfaces for traditional password-based entry.
*   **Login/Register Pages:** Created the initial UI components and routing for local authentication.
*   **Reactivity Foundation:** 
    *   Connected the `Header.vue` (in the manual Vue build) to the `authStore`.
    *   Implemented `v-if="authStore.isAuthenticated"` to toggle between "Login" and "Logout" buttons based on the result of the `checkAuth()` call.
*   **Fetch Refactor:** Updated all frontend API calls to point to the `/api/` proxy prefix, ensuring they always pass through the Nginx security layer.

## 4. The "Primary Source" Logic
*   **Nginx configuration snippet (Conceptual):**
    ```nginx
    location /api/notes {
        auth_request /api/auth/verify;
        auth_request_set $user_id $upstream_http_x_user_id;
        proxy_set_header X-User-Id $user_id; # The Identity Handover
        proxy_pass http://notes:3003;
    }
    ```

---

### Reflection:
By moving the security check into Nginx (C++ efficiency) and using headers for internal identity handover, we decoupled our services. The Notes service no longer needs to know how to "Log In"—it only needs to know how to "Listen" for the trusted `X-User-Id` header.
