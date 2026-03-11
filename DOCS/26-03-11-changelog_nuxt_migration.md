# Migration & Architecture Changelog

This document tracks the fundamental shifts in codebase architecture during the transition from the legacy Vue frontend to the Nuxt 4 (SSR) framework and the UUID refactor.

## 1. Frontend: High-Fidelity SSR (Nuxt 4)
*   **Transition:** Moved from a manual Client-Side Rendering (CSR) approach to a full Server-Side Rendering (SSR) model.
*   **Nuxt 4 Structure:** Adopted the `app/` directory pattern, consolidating stores, components, and pages.
*   **Cookie Forwarding (The SSR Bridge):** 
    *   Implemented `useRequestHeaders(['cookie'])` within Pinia stores (`authStore.ts`, `noteStore.ts`).
    *   **Logic:** Since the Nuxt server acts as a proxy during the initial page load, it must manually forward the user's browser cookies to internal microservices (Auth, Notes) to maintain session continuity.
*   **Environment-Aware Fetching:** 
    *   Stores now detect `isServer` to switch between internal Docker URLs (e.g., `http://auth:3000`) and client-side proxied URLs (e.g., `/api/auth`).

## 2. Global State Management (Pinia Evolution)
*   **Setup Store Pattern:** Migrated to the more flexible "Setup Store" syntax.

*   **Reactivity Fix: The Header "Stateless" Bug:**
    *   **The Issue:** The `Header.vue` was previously "dumb," meaning it wasn't listening to the `authStore`. This caused a "Ghost State" where you were logged in, but the Header still showed the "Login" button.
    *   **The Fix:** We replaced the static links with dynamic `v-if="authStore.isAuthenticated"` checks.
    *   **Principle:** In a Reactive ecosystem, the UI must never "guess" the state; it must be a direct map of the Store's current truth.
*   **Manual Store Reset:** !Important
    *   Since Setup Stores do not have a built-in `$reset`, we implemented explicit `resetStore()` functions.
    *   **Logout Hygiene: Deterministic State Cleansing:**
    *   **The Problem:** The old `logout` function only cleared the user state if the API request succeeded (`try` block). If the network failed (e.g., a 502 error), the `user.value` remained populated, causing the Header to stay in a "Logged In" state despite the user's intent.
    *   **The Fix:** Moved the store reset logic into the `finally` block to ensure a "Deterministic" logout. Regardless of API success, the local UI state is now forcibly cleared.
    *   **Cross-Store Synchronization:** Implemented dynamic imports to reach into the `noteStore` and reset it simultaneously, preventing data leakage between sessions.

```typescript
async function logout() {
    loading.value = true;
    try {
        // Attempt to notify the backend
        await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
        console.error("Logout API failed, continuing with local reset", e);
    } finally {
        // DETERMINISTIC RESET: Always clear local state
        resetStore();

        // Cross-store cleanup via dynamic import
        try {
            const { useNoteStore } = await import("@/stores/noteStore");
            const noteStore = useNoteStore();
            noteStore.resetStore();
        } catch (err) {
            console.error("Failed to reset note store", err);
        }

        loading.value = false;
        window.location.href = "/";
    }
}
```
*   **Defensive Fetching:**
    *   Added "Gatekeeper" logic to `noteStore.fetchNotes` to skip network requests if `authStore.user` is null or if the SSR context lacks a valid cookie.

## 3. Backend: Identity Alignment (The UUID Refactor)
*   **The UUID Standardization:** Unified the system to use UUID v4, driven by the Notes Service's existing requirement for 128-bit identifiers.
    *   **Auth Service Refactor:** Migrated the legacy integer-based `id` system to UUIDs to ensure compatibility across the microservice boundary.

### TODO
*   **Notes Service Integration:** Leverage the existing UUID schema to implement strict user-isolation by scoping queries to the owner's UUID.
*   **Internal Identity Headers (`X-User-Id`):**
    *   Established the `X-User-Id` custom header convention for internal microservice communication.
    *   **Handshake:** Nginx/Auth verifies the session -> Injects the verified UUID into `X-User-Id` -> Notes Service reads this header to scope SQL queries (e.g., `WHERE owner_id = $1`).

## 4. DevOps & Environment Stability
*   **Container Isolation:** Resolved `EACCES` and "Module Not Found" errors caused by macOS/Linux file system conflicts.
    *   **Anonymous Volumes:** Implemented anonymous volumes for `.nuxt` and `.output` in `docker-compose.yml` to prevent local Mac build artifacts from contaminating the Linux container environment.
    *   **Permission Hardening:** Updated `Dockerfile.dev` to pre-create build directories with `chmod 777` to ensure write access regardless of the host machine's UID/GID.

---

### 🎓 Professor's Reflection:
The leap from a browser-only app to an SSR app is not merely a change in framework; it is a change in "Ontology." We now manage two realities (Server and Browser) simultaneously. The complexity added by `useRequestHeaders` and `isServer` checks is the "Tax of Performance" we pay for faster initial loads and better SEO.
