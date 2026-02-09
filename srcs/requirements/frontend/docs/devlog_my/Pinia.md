### Summary of Changes for Pinia SSR State Management

To enable the "Hydration" flow (where the server fetches data and safely passes it to the client), we modified five key files. Here are the specific changes:

---

#### 1. entry-server.ts
**Purpose:** Capture the data from Pinia after the server finishes rendering the app.
```typescript
// ... existing imports ...
export async function render(url: string) {
    const { app, router, pinia } = createApp("server"); // Added 'pinia' to destructuring

    await router.push(url);
    await router.isReady();

    const html = await renderToString(app);

    // --- KEY ADDITION ---
    // Serialize the current state of all Pinia stores into a JSON string
    const state = JSON.stringify(pinia.state.value);

    return { html, state }; // Now returns both HTML and the data state
}
```

---

#### 2. server.js
**Purpose:** Inject the captured data into the browser's global memory.
```javascript
// ... inside app.get('*', ...) ...
    try {
      const { html, state } = await render(url) // Capture the state from render()

      let responseHtml = template.replace('<!--ssr-app-->', html)

      // --- KEY ADDITION ---
      // Injects a script tag that sets a global variable for the browser to read
      if (state) {
        responseHtml = responseHtml.replace(
          '</body>',
          `<script>window.__INITIAL_STATE__ = ${state}</script></body>`
        )
      }

      reply.type('text/html').send(responseHtml)
// ...
```
---
#### 3. entry-client.ts
**Purpose:** Pick up the data in the browser and give it back to Pinia.
```typescript
// ...
const { app, router, pinia } = createApp("client"); // Added 'pinia'

// --- KEY ADDITION ---
// Check if the server left us any data in the 'window' object
if (window.__INITIAL_STATE__) {
    // "Hydrate" the store state so the UI doesn't have to fetch it again
    pinia.state.value = window.__INITIAL_STATE__;
}
// ...
```
---
#### 4. noteStore.ts
**Purpose:** Handle the difference between internal Docker networking and external browser networking.
```typescript
// ... inside fetchNotes() ...
    try {
        // --- KEY ADDITION ---
        // Detect environment: Server uses direct Docker URL, Client uses relative path
        const isServer = typeof window === "undefined";
        const url = isServer 
            ? "http://notes:8000/api/notes" // Internal Docker network
            : "/api/notes";               // External Browser path

        const response = await fetch(url);
// ...
```
---
#### 5. NotesView.vue
**Purpose:** Tell the server exactly *when* to fetch the data during the rendering process.
```typescript
// ...
import { onServerPrefetch, onMounted } from "vue"; // Added onServerPrefetch

const noteStore = useNoteStore();

// --- KEY ADDITION ---
// This hook is specific to SSR. It tells the server to wait for this
// async call to finish before sending the HTML to the user.
onServerPrefetch(async () => {
    await noteStore.fetchNotes();
});

onMounted(() => {
    // Optimization: Only fetch on client if SSR didn't already do it
    if (noteStore.notes.length === 0) {
        noteStore.fetchNotes();
    }
});
``` 
### Result
When a user visits `/notes`, the server fetches the notes, puts them in the HTML, and embeds the data. The page arrives **pre-populated**, and the browser instantly continues without needing another API request.
# SSR & Pinia State Synchronization Setup
To avoid the "flash of empty content" and improve SEO, we have implemented a full SSR (Server-Side Rendering) data synchronization flow using Pinia.
## 1. The Core Changes
### A. Server Entry (src/entry-server.ts)
We now capture the state of Pinia *after* the components have finished their data fetching (onServerPrefetch). This state is returned as a JSON string alongside the rendered HTML.
### B. Fastify Server (server.js)
The Fastify server takes the serialized state and injects it into the HTML before sending it to the browser:
\`\`\`html
<script>window.__INITIAL_STATE__ = {"notes": {...}}</script>
\`\`\`
### C. Client Entry (src/entry-client.ts)
When the browser loads the app, Pinia checks for window.__INITIAL_STATE__. If it exists, it "hydrates" the store immediately, making the data available before the first render on the client.
### D. Smart Store Routing (src/stores/noteStore.ts)
The store functions now detect their environment:
- **On Server**: Talks directly to http://notes:8000/api/notes (Internal Docker network).
- **On Client**: Talks to /api/notes (Relative path via Nginx/Gateway).
## 2. Component Implementation (NotesView.vue)
To trigger the server-side fetch, we use the onServerPrefetch hook:
\`\`\`typescript
// This runs only on the server
onServerPrefetch(async () => {
    await noteStore.fetchNotes();
});
// This runs only on the client
onMounted(() => {
    if (noteStore.notes.length === 0) { // Only fetch if SSR didn't already
        noteStore.fetchNotes();
    }
});
\`\`\`
## 3. Benefits
1. **Zero Flicker**: Data is present in the first byte of HTML.
2. **SEO**: Search engine crawlers can see the notes without executing JavaScript.
3. **Speed**: Internal server-to-server communication happens over the Docker virtual network, which is much faster than external API calls.
