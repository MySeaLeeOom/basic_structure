## Composables Vs. Pinia

Great observation. Let me clarify the pros and cons:

Composables (like `useNotes`) are less safe/reliable than Pinia stores for several reasons:

1. State Persistence
- Composables: State resets every time the component unmounts
- Pinia: Maintains global state across component lifecycle

2. Global Access
- Composables: Limited to component or manual state sharing
- Pinia: Accessible from anywhere in the application

3. Performance
- Composables: Recreate state each time they're used
- Pinia: More efficient state management

4. Scalability
- Composables: Good for small, component-specific logic
- Pinia: Better for complex, app-wide state management

In your case, since you're managing notes which seem to be app-wide and potentially used for RAG, a Pinia store is definitely more appropriate.

The current `useNotes` composable is essentially duplicating functionality that's now in the Pinia store, which suggests you're in a transition phase or have some redundant code.

Recommendation: 
1. Consolidate to the Pinia store
2. Remove this composable
3. Update components to use the Pinia store directly

Would you like me to help you migrate components to use the Pinia store?



# SSR State Hydration Implementation

This document compiles the complete implementation for valid Server-Side Rendering (SSR) with State Hydration using Vue 3 and Pinia.

**Goal:** Ensure that data fetched on the server (Docker network) is passed to the client (Browser) without requiring a second fetch or causing a content mismatch (Hydration Error).

**Mechanism:**
1. **Server (`entry-server.ts`):** Fetches data into Pinia store, serializes state to JSON string.
2. **Backend (`server.js`):** Injects HTML string and JSON State string into `index.html`.
3. **Client (`entry-client.ts`):** Reads JSON State from `window` and initializes Pinia store before mounting.

---

## 1. The Pinia Store
**File:** `src/stores/noteStore.ts`
*Replaces `useNotes.ts` composable.*

```typescript
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { Note } from "@/types";

export const useNoteStore = defineStore("notes", () => {
	const notes = ref<Note[]>([]);
	const selectedNote = ref<Note | null>(null);
	const error = ref<string | null>(null);
	const isLoading = ref(false);

	// Cache to prevent unnecessary refetches
	const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
	const lastFetchTimestamp = ref(0);

	async function fetchNotes() {
		// Prevent redundant fetches
		const currentTime = Date.now();
		if (notes.value.length && currentTime - lastFetchTimestamp.value < CACHE_DURATION) {
			return;
		}

		error.value = null;
		isLoading.value = true;

		try {
			// On the server, we MUST use the full internal Docker URL.
			// On the client, we use a relative URL (which goes through the Gateway/Nginx).
			const isServer = typeof window === "undefined";
			const url = isServer ? "http://notes:8000/api/notes" : "/api/notes";

			const response = await fetch(url, {
				signal: AbortSignal.timeout(5000), // Prevent hanging
			});

			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const fetchedNotes = await response.json();
			notes.value = fetchedNotes;

			// Auto-select first note if none selected
			if (!selectedNote.value && notes.value.length) {
				selectedNote.value = notes.value[0]!;
			}

			// Update fetch timestamp
			lastFetchTimestamp.value = currentTime;
		} catch (catchError) {
			const errorMsg = catchError instanceof Error ? (catchError.name === "AbortError" ? "Request timed out" : catchError.message) : "Load failed";

			error.value = errorMsg;
		} finally {
			isLoading.value = false;
		}
	}

	function selectNote(note: Note) {
		selectedNote.value = note;
	}

	return {
		notes,
		selectedNote,
		error,
		isLoading,
		fetchNotes,
		selectNote,
	};
});
```

---

## 2. Server Entry (Dehydration)
**File:** `src/entry-server.ts`
*Renders app to HTML and extracts state.*

```typescript
import { renderToString } from "vue/server-renderer";
import { createApp } from "./main";

export async function render(url: string) {
	const { app, router, pinia } = createApp("server");

	// Push the requested URL to the router
	await router.push(url);
	await router.isReady();

	// Render the app to HTML
	// Trigger any onServerPrefetch in components here implicitly
	const html = await renderToString(app);

	// DEHYDRATION:
	// We extract the Pinia state (which now contains the fetched notes).
	// We will pass this 'state' string back to server.js,
	// which will inject it into the HTML as window.__INITIAL_STATE__.
	const state = JSON.stringify(pinia.state.value);

	return { html, state };
}
```

---

## 3. Node Server (Injection)
**File:** `server.js`
*Injects the rendered HTML and the State JSON.*

```javascript
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'
import FastifyMiddie from '@fastify/middie'
import FastifyStatic from '@fastify/static'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isProduction = process.env.NODE_ENV === 'production'

async function createServer() {
  const app = Fastify()

  // Required for Vite middleware compatibility
  await app.register(FastifyMiddie)

  let vite
  if (!isProduction) {
    // DEV MODE: Use Vite as middleware
    const { createServer: createViteServer } = await import('vite')
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom'
    })
    app.use(vite.middlewares)
  } else {
    // PROD MODE: Serve static assets
    await app.register(FastifyStatic, {
      root: path.join(__dirname, 'dist/client'),
      wildcard: false
    })
  }

  app.get('*', async (req, reply) => {
    const url = req.raw.url

    try {
      let template, render
      
      if (!isProduction) {
        template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8')
        template = await vite.transformIndexHtml(url, template)
        render = (await vite.ssrLoadModule('/src/entry-server.ts')).render
      } else {
        template = fs.readFileSync(path.resolve(__dirname, 'dist/client/index.html'), 'utf-8')
        render = (await import('./dist/server/entry-server.js')).render
      }

      const { html, state } = await render(url)
      
      // INJECTION:
      // 1. Replace <!--ssr-outlet--> with the rendered HTML app.
      // 2. Replace <!--pinia-state--> with the serialized state script.
      // This ensures the browser receives both the Visuals (HTML) and the Data (State).
      const responseHtml = template
        .replace('<!--ssr-outlet-->', html)
        .replace(
          '<!--pinia-state-->',
          `<script>window.__INITIAL_STATE__=${state}</script>`
        )
      
      reply.type('text/html').send(responseHtml)
    } catch (e) {
      if (!isProduction) vite.ssrFixStacktrace(e)
      console.error(e)
      reply.code(500).send(e.stack)
    }
  })

  return app
}

createServer().then(app => {
  app.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    console.log(`Server listening at ${address}`)
  })
})
```

---

## 4. HTML Template
**File:** `index.html`
*Placeholders for content.*

```html
<!doctype html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<!-- Critical CSS for SSR anti-flash (a11y helpers) -->
		<style>
			/* Brute force hide PrimeVue accessibility helpers */
			.p-hidden-accessible {
				border: 0;
				clip: rect(0 0 0 0);
				height: 1px;
				margin: -1px;
				overflow: hidden;
				padding: 0;
				position: absolute;
				width: 1px;
				white-space: nowrap;
			}
		</style>
		<link rel="stylesheet" href="/src/assets/base.css" />
		<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
		<title>Vue Fastify SSR App</title>
	</head>
	<body>
		<div id="app"><!--ssr-outlet--></div>
		<!--pinia-state-->
		<script type="module" src="/src/entry-client.ts"></script>
	</body>
</html>
```

---

## 5. Client Entry (Hydration)
**File:** `src/entry-client.ts`
*Restores state before mounting.*

```typescript
import { createApp } from "./main";

const { app, router, pinia } = createApp("client");

// HYDRATION:
// The server has already fetched data and rendered the HTML.
// It serialized the Pinia state into window.__INITIAL_STATE__.
// We must initialize our client-side store with this data so it matches the HTML.
// If we don't, the store starts empty, Vue sees "Select a note" (empty state),
// but the HTML has "Test Note" (server state), causing a "Hydration Mismatch".
if (window.__INITIAL_STATE__) {
	pinia.state.value = window.__INITIAL_STATE__;
}

// Wait for router to be ready (resolve async components) before mounting
router.isReady().then(() => {
	app.mount("#app");
});
```

---

## 6. App Factory
**File:** `src/main.ts`
*Creates App, Router, and Pinia instances.*

```typescript
import { createSSRApp } from "vue";
import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import App from "./App.vue";
import { createRouter } from "./router";
import "./assets/base.css";

// PREV: NOTE: CSS is NOT imported here - see entry-client.ts
// CURRENT: NOTE: CSS is imported here to avoid FOUC during SSR

export function createApp(type: "client" | "server") {
	const app = createSSRApp(App);
	const pinia = createPinia();
	const router = createRouter(type);

	app.use(pinia);
	app.use(router);
	// editing some pass through styles here istead of editing volt components directly
	app.use(PrimeVue, {
		unstyled: true,
		pt: {
			Listbox: {
				pcHiddenSelectedMessage: {
					root: "sr-only",
				},
				hiddenFirstFocusableElement: {
					root: "sr-only",
				},
				hiddenLastFocusableElement: {
					root: "sr-only",
				},
				pcFilterContainer: {
					root: "relative",
				},
			},
		},
	});

	return { app, router, pinia };
}
```

---

## 7. Global CSS
**File:** `src/assets/base.css`

```css
@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap');
@import "tailwindcss";
@import "tailwindcss-primeui";


/* Volt component overrides */
@layer components {

  .card-document {
    @apply w-full max-w-3xl min-h-[800px];
  }

  .section-title {
    @apply text-xs font-semibold uppercase tracking-wider
           text-surface-500 dark:text-surface-400 mb-3;
  }

  .document-container {
    @apply flex justify-center py-8 px-4;
  }

  .document-body {
    @apply whitespace-pre-wrap font-sans leading-relaxed
           text-surface-700 dark:text-surface-300;
  }

  .error-text {
    @apply text-red-500 text-sm;
  }

  .empty-state {
    @apply p-8 text-center text-muted-color;
  }
}

:root {
  /* Primary (sage - desaturated zen green) */
  --p-primary-50: #f4f7f5;
  --p-primary-100: #e6ede8;
  --p-primary-200: #cddbd2;
  --p-primary-300: #a8c2af;
  --p-primary-400: #84a98c;
  --p-primary-500: #6b9474;
  --p-primary-600: #547a5c;
  --p-primary-700: #44624a;
  --p-primary-800: #394f3d;
  --p-primary-900: #304234;
  --p-primary-950: #1a241c;

  /* Surface (stone - warm mycelium) */
  --p-surface-0: #ffffff;
  --p-surface-50: #fafaf9;
  --p-surface-100: #f5f5f4;
  --p-surface-200: #e7e5e4;
  --p-surface-300: #d6d3d1;
  --p-surface-400: #a8a29e;
  --p-surface-500: #78716c;
  --p-surface-600: #57534e;
  --p-surface-700: #44403c;
  --p-surface-800: #292524;
  --p-surface-900: #1c1917;
  --p-surface-950: #0c0a09;

  --p-content-border-radius: 6px;
  --p-primary-color: var(--p-primary-500);
  --p-primary-contrast-color: var(--p-surface-0);
  --p-text-color: var(--p-surface-700);
  --p-text-muted-color: var(--p-surface-500);

  /* Highlight (selected state) */
  --p-highlight-background: var(--p-primary-500);
  --p-highlight-color: var(--p-surface-0);
  --p-highlight-focus-background: var(--p-primary-600);
  --p-highlight-focus-color: var(--p-surface-0);
}
```

---

## 8. Root Component
**File:** `src/App.vue`

```vue
<script lang="ts" setup>
import Header from "./components/Header.vue"
</script>

<template>
<Header/>
<RouterView />
</template>
```
