# SSR State Hydration Implementation

## What is Hydration?

"Hydration" is the process where the client-side JavaScript "wakes up" the static HTML rendered by the server.

Without proper state hydration, a "Mismatch" occurs:
1. Server renders HTML with data (e.g., list of notes).
2. Client loads with an empty store.
3. Client Vue overwrites the Server HTML with its empty state (Glitch/Flash).
4. Client fetches data again (Network waste).

To fix this, we implemented **Dehydration -> Injection -> Hydration**.

## 1. Dehydration (Server)

**File:** `srcs/requirements/frontend/src/entry-server.ts`

We extract the final state of the Pinia store after the app has rendered on the server. This "freezes" the data into a string.

```typescript
// ... inside render() function
const html = await renderToString(app);

// DEHYDRATION:
// We extract the Pinia state (which now contains the fetched notes).
const state = JSON.stringify(pinia.state.value);

return { html, state };
```

## 2. Injection (Server Middleware)

**File:** `srcs/requirements/frontend/server.js`

We take that frozen state string and embed it directly into the HTML sent to the browser, assigning it to a global window variable `window.__INITIAL_STATE__`.

```javascript
const { html, state } = await render(url)

// INJECTION:
const responseHtml = template
  .replace('<!--ssr-outlet-->', html)
  // Inject the state script so the browser has the data immediately
  .replace(
    '<!--pinia-state-->',
    `<script>window.__INITIAL_STATE__=${state}</script>`
  )
```

**File:** `srcs/requirements/frontend/index.html`

We added a placeholder comment for the injection:

```html
<body>
  <div id="app"><!--ssr-outlet--></div>
  <!--pinia-state-->
  <script type="module" src="/src/entry-client.ts"></script>
</body>
```

## 3. Hydration (Client)

**File:** `srcs/requirements/frontend/src/entry-client.ts`

When the client app starts, preventing the store from starting empty. It reads the global variable and pre-fills the Pinia store before mounting the app.

```typescript
const { app, router, pinia } = createApp("client");

// HYDRATION:
// Check if server sent us state
if (window.__INITIAL_STATE__) {
	// Initialize store with server data
	pinia.state.value = window.__INITIAL_STATE__;
}

router.isReady().then(() => {
	app.mount("#app");
});
```

## Result

When the browser loads:
1. It paints the HTML (Notes visible).
2. It executes the injected script (`window.__INITIAL_STATE__ = ...`).
3. JavaScript loads, Pinia initializes with that data.
4. Vue matches the HTML perfectly with the Store data.
5. **No flashing, no layout shift, no double-fetching.**
