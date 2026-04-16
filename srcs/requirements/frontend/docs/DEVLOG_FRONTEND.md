# Frontend Dev Log

---

## 2026-04-12 — Login/register forms submit on Enter

**Branch:** `ui`

### Problem
Pressing Enter in the login or register input fields did nothing. The user had to click the button with a mouse.

### What was changed

**`app/pages/Login.vue`**
- Replaced the `<div class="flex flex-col gap-4 mt-4">` wrappers in both tab panels with `<form @submit.prevent="handleLogin">` and `<form @submit.prevent="handleRegister">`
- Changed both submit buttons from `@click="handler"` to `type="submit"`, removing the explicit click handler

### Why this works
The browser has a built-in rule: when focus is inside a `<form>` and the user presses Enter, the form's `submit` event fires. This behaviour is part of the HTML specification and requires no JavaScript. The inputs were previously inside a `<div>`, which has no such behaviour.

`@submit.prevent` listens for the submit event and calls the handler. The `.prevent` modifier calls `event.preventDefault()` to stop the browser's default form submission (a full HTTP POST that would reload the page).

### Why `type="submit"` instead of `@click`
A button inside a `<form>` with `type="submit"` triggers the form's submit event when clicked — the same path as pressing Enter. Using `@click` bypassed the form entirely and called the handler directly, which works but is inconsistent with how forms are meant to work. Both the Enter key and the button now go through the same code path.

---

## 2026-04-12 — AI chat sidebar toggle + collapsed-state persistence

**Branch:** `ui`

### Problem
The `ChatSidebar` component was always visible when a note was open, with no way to hide it. When the left sidebar was collapsed, there was also no way to toggle the chat panel since its button disappeared with the sidebar.

### What was changed

**`app/pages/Notes.vue`**
- Added `const chatOpen = ref(true)` alongside `sidebarOpen`
- Added a sparkles toggle button in the sidebar toolbar row (replacing the placeholder comment)
- Added `v-show="chatOpen"` to `<ChatSidebar>` — `v-show` rather than `v-if` so conversation history survives collapsing
- Added `<template #collapsed-actions>` slot fill with a second sparkles button — visible only when the left sidebar is collapsed

**`app/components/layouts/SidebarLayout.vue`**
- Replaced the bare floating `<button>` (shown when `!sidebarOpen`) with a `<div class="flex flex-col gap-1">` wrapping that button plus a new `<slot name="collapsed-actions" />`
- This slot lets `Notes.vue` inject persistent action buttons beneath the sidebar reopen button without `SidebarLayout` needing to know what they are

### Why `v-show` not `v-if`
`v-if` destroys and recreates the component on every toggle, which would wipe the chat message history. `v-show` keeps the component mounted and just toggles `display: none`, preserving all reactive state.

---

## 2026-04-12 — Extract all inline SVGs to icon components

**Branch:** `ui`

### Problem
Multiple `.vue` files contained raw `<svg>` blocks inline in their templates, making them hard to scan and impossible to reuse without copy-pasting markup.

### What was changed

**`app/components/icons/` (new directory)**
Six new single-file components, each wrapping one SVG with `v-bind="$attrs"` on the root `<svg>` so that `class` and other attributes pass through transparently:
- `IconBars.vue` — hamburger / sidebar toggle (Heroicons solid)
- `IconSparkles.vue` — AI chat toggle (Heroicons solid)
- `IconUserPlus.vue` — add collaborator (Heroicons solid)
- `IconGlobe.vue` — language selector (stroke-based, 24px viewBox)
- `IconSun.vue` — light mode (Heroicons solid)
- `IconMoon.vue` — dark mode (Heroicons solid)

**`nuxt.config.ts`**
Added `components: [{ path: '~/components', pathPrefix: false }]`. By default Nuxt prefixes component names with their subdirectory: `icons/IconBars.vue` → `IconsIconBars`. `pathPrefix: false` disables this so the filename alone is the component name, matching what the templates expect.

**`app/components/layouts/SidebarLayout.vue`**, **`app/pages/Notes.vue`**, **`app/components/DarkModeToggle.vue`**, **`app/components/LangSelector.vue`**
All inline `<svg>` blocks replaced with the corresponding icon component.

`UserAvatar.vue` was left untouched — its SVG is generated programmatically in JavaScript (deterministic pixel-art avatar), not a static icon.

### Why `v-bind="$attrs"` on the svg root
Vue 3 automatically inherits non-prop attributes on a component's root element. Placing `v-bind="$attrs"` explicitly on the `<svg>` makes this visible and intentional, and ensures `class="w-4 h-4"` passed at the callsite merges correctly with the element's own attributes.

---

## 2026-04-12 — Fix: empty-note deletion before Yjs sync

**Branch:** `ui`

### Problem
`checkAndClean()` in `Notes.vue` deletes the currently selected note if `NoteEditor.isEmpty` is `true`. The `isEmpty` computed depended on `titleText` (from Yjs) and `editor.value` (Tiptap). Both are `null`/empty before the WebSocket sync event fires — typically a 3–5 second window after selecting a note. If the user clicked a different note during that window, `isEmpty` evaluated `true` for a note that had content, and the note was permanently deleted.

### What was changed

**`app/components/notes/NoteEditor.vue`**
```ts
// Before
const isEmpty = computed(() =>
  !titleText.value.trim() && (!editor.value || editor.value.isEmpty)
);

// After
const isEmpty = computed(() =>
  !!ydoc.value && !titleText.value.trim() && (!editor.value || editor.value.isEmpty)
);
```

`ydoc.value` is `null` until the `sync` event fires in `useCollaboration` — only then does it get set to the live `Y.Doc`. Adding `!!ydoc.value` as a prerequisite means `isEmpty` returns `false` for any note that hasn't synced yet, making it safe against premature deletion.

### Why this is the right guard
`ydoc` being non-null is the only signal in the existing architecture that sync has completed and the document's actual content is available. It requires no new state and is already in scope in `NoteEditor`.

---

## 2026-04-12 — Fix: note export missing newlines

**Branch:** `ui`

### Problem
Exported notes had all paragraph structure collapsed into a single line. `"Hello world.\n\nSecond paragraph."` became `"Hello world. Second paragraph."`.

### Root cause
`extractPlainTextFromXml` in `Account.vue` was using:
```ts
const parsed = parser.parseFromString(`<div>${xml}</div>`, 'text/html');
return (parsed.body.textContent || '').replace(/\s+/g, ' ').trim();
```
Two issues:
1. `.textContent` is layout-unaware — it concatenates all text nodes with no separator between block elements
2. `/\s+/g` matched newlines as whitespace and collapsed them to a single space

An attempted fix using `.innerText` (which is layout-aware) also failed because `DOMParser` produces an inert document with no layout — `innerText` requires a live rendered DOM to know which elements are block-level.

### What was changed

**`app/pages/Account.vue` — `extractPlainTextFromXml`**
```ts
// Before
const parsed = parser.parseFromString(`<div>${xml}</div>`, 'text/html');
return (parsed.body.textContent || '').replace(/\s+/g, ' ').trim();

// After (no DOMParser needed)
const withBreaks = xml.replace(/<\/?(p|div|h[1-6]|li|br|tr|td)[^>]*>/gi, '\n');
const stripped = withBreaks.replace(/<[^>]+>/g, '');
return stripped.replace(/\n{3,}/g, '\n\n').trim();
```

Step 1: replace every opening or closing block-level tag with `\n` before any stripping. Adjacent block boundaries naturally produce `\n\n` (paragraph gap). Step 2: strip all remaining tags (inline elements). Step 3: collapse three or more consecutive newlines (from nested block elements) to a double newline. This mirrors the approach used by the `ai-ingest` Python service's `clean_html_to_text`.

---

## 2026-04-12 — Account page: per-button loading state via `activeAction`

**Branch:** `ui`

### Problem
A single `isSubmitting = ref(false)` controlled the `:disabled` state of every button on the Account page. Any action — including a fast one like export — set it `true`, momentarily disabling all buttons simultaneously and causing a visible flash. There was also a redundant `activeForm` ref that tracked which form was active but was never read by the template.

### What was changed

**`app/pages/Account.vue`**
- Removed `isSubmitting` and `activeForm`
- Added `activeAction = ref<'login' | 'email' | 'image' | 'removeImage' | 'password' | 'delete' | 'export' | 'logout' | null>(null)`
- Every handler sets `activeAction.value = 'its-name'` at the start and `activeAction.value = null` at the end (including early-return error paths)
- Every button's `:disabled` now checks `activeAction === 'its-own-name'` only — no button is aware of any other button's state

### Why this fixes the flash
The flash was `isSubmitting` toggling `true → false` faster than a paint frame during export (a fast HTTP GET + synchronous download trigger). With `activeAction`, only the export button checks `activeAction === 'export'` — other buttons' expressions evaluate `false` regardless of what export is doing, so they never enter a disabled state.

---

## 2026-04-12 — Collapsible sidebar with mobile auto-close

**Branch:** `ui`

### Problem
The notes page had no way to collapse the sidebar, which on mobile consumed the entire screen width. On small screens, selecting a note also left the sidebar open, obscuring the editor.

### What was changed

**`app/components/layouts/SidebarLayout.vue`**
- Added `defineModel<boolean>('sidebarOpen', { default: true })` — the parent (`Notes.vue`) owns the state; `SidebarLayout` just responds to it. `defineModel` is the Vue 3.4 idiomatic two-way binding shorthand, replacing a manual prop + emit pair.
- `v-show="sidebarOpen"` on the `<aside>` — keeps the DOM alive (preserving scroll position) but hides it with `display: none`.
- When `!sidebarOpen`, a floating `<button>` is rendered at `absolute top-3 start-3` of the outer `relative` container. `start-3` is a CSS logical property (`inset-inline-start`) that maps to `left` in LTR and `right` in RTL — so the button always appears on the same side as the sidebar regardless of document direction.
- The outer `<div>` is `relative` so the absolute button is scoped to the layout, not the viewport.

**`app/pages/Notes.vue`**
- Added `useMediaQuery('(max-width: 767px)')` from VueUse to get a reactive `isMobile` ref. This is the single source of truth for the mobile breakpoint — all three callsites (`onMounted` init, `selectOwnNote`, `selectSharedNote`) read `isMobile.value` instead of repeating `window.innerWidth < 768`.
- `sidebarOpen` defaults to `true`; on mount, closes if `isMobile.value` is true.
- `selectOwnNote` and `selectSharedNote` both call `if (isMobile.value) sidebarOpen.value = false` after a note is selected — so on mobile, choosing a note automatically collapses the sidebar to reveal the editor.
- The sidebar slot now has a persistent toolbar row (toggle button + future AI toggle slot) above the "My Notes" heading and note list. The toolbar row is always rendered; the heading, list, and shared notes are wrapped in `<template v-if="sidebarOpen">` so they disappear when collapsed.

### Why `useMediaQuery` over `window.innerWidth`
`window.innerWidth` is a one-time snapshot — it reads the value at call time and never updates. `useMediaQuery` returns a reactive ref backed by the browser's `matchMedia` API, which fires an event when the viewport crosses the breakpoint. This means `isMobile` stays accurate if the user resizes the window mid-session, and the breakpoint string is defined exactly once.

### Why the floating button position matches the open-state button
Both positions resolve to 12px from the layout's inline-start edge: the sidebar has `px-3` (12px), and `start-3` is also 12px. So the icon appears to stay in place as the sidebar opens and closes — it doesn't jump.

---

## 2026-04-12 — Fix auth state flicker on page load / navigation

**Branch:** `ui`

### Problem
When navigating between pages (e.g. notes → home) during startup, the header would briefly flash between logged-in and logged-out states. The root cause was that `app.vue` called `checkAuth()` inside `onMounted` — which only runs in the browser, after the DOM is painted. Even though the SSR pass had already fetched the user and `@pinia/nuxt` serialized the store state into the HTML payload, the timing of `onMounted` could race with hydration and cause the header to momentarily show a logged-out state.

A second issue: the global middleware bailed out early for public routes (`/`, `/home`, `/login`) without calling `checkAuth` at all — so landing on the home page never populated the store server-side, making the `onMounted` call load-bearing for those routes.

### What was changed

**`app/app.vue`**
- Removed `onMounted` and its `checkAuth()` call entirely
- Removed the now-unused `useAuthStore` import and `computed` import (locale still uses `computed` via `useUiI18n`)

**`app/middleware/auth.global.ts`**
- Moved `checkAuth()` to run unconditionally for all routes, before the public-route check
- The redirect guard now only fires when the route is protected AND the user is not authenticated

### Why this works
`@pinia/nuxt` serializes the Pinia store state into the HTML payload during SSR. By the time the browser hydrates, `user.value` is already restored. The `checkAuth` guard (`if (user.value && !force) return`) short-circuits any redundant client-side fetch. With the middleware covering all routes (including public ones), there is no longer any scenario where the store is unpopulated after SSR — so `onMounted` is not needed and only caused the flicker.

### Why `onMounted` is the wrong tool for this
`onMounted` runs after the DOM is painted — by definition it cannot affect what the user first sees. Auth state that drives visible UI (like the header) must be resolved before rendering, which is exactly what SSR middleware is for. `onMounted` is appropriate for DOM-dependent interactions (e.g. initialising a canvas, attaching a resize observer), not for fetching data that controls layout.

---

## 2026-04-12 — Delete empty notes on navigate away

**Branch:** `ui`

### Problem
When a user clicked "+" to create a new note and immediately clicked away without typing anything, an empty "Untitled" record was left in the database permanently. Over time this would clutter the sidebar with ghost notes.

### What was changed

**`app/components/notes/NoteEditor.vue`**
- Added `computed` to the Vue import
- Added an `isEmpty` computed property: `!titleText.value.trim() && (!editor.value || editor.value.isEmpty)`. This is `true` only when both the Yjs title text is blank AND the Tiptap editor contains no content. `editor.isEmpty` is a native Tiptap property — it returns `true` when the document is in its default empty paragraph state.
- Added `defineExpose({ isEmpty })` to make this value readable from the parent component via a template ref.

**`app/pages/Notes.vue`**
- Added `onBeforeUnmount` to the Vue import
- Added `noteEditorRef` — a typed template ref pointing at the `<NoteEditor>` component instance:
  ```ts
  const noteEditorRef = ref<InstanceType<typeof NoteEditor> | null>(null)
  ```
  `InstanceType<typeof NoteEditor>` tells TypeScript the shape of the live component — including the `isEmpty` property we exposed. Without this type, TypeScript would not know `isEmpty` exists.
- Added `ref="noteEditorRef"` to the `<NoteEditor>` tag in the template. This is what connects the variable to the live component instance at runtime.
- Added `checkAndClean()` — silently deletes the currently selected note if `noteEditorRef.value?.isEmpty` is true. No confirmation dialog: if nothing was typed, nothing is lost.
- Made `selectOwnNote` async and added `await checkAndClean()` at the top — runs the check before switching to another note.
- Added `onBeforeUnmount(async () => { await checkAndClean(); })` — runs the same check when the user navigates away from the notes page entirely.

### Why `defineExpose` + template ref rather than Pinia

`NoteEditor` does not remount when switching notes — Vue reuses the component instance and updates the `noteId` prop. So `onBeforeUnmount` inside `NoteEditor` alone would only fire on full page leave, missing the note-switch case. Lifting the check to `Notes.vue` (which owns the switching logic) covers both. `defineExpose` is the idiomatic Vue 3 way for a parent to read ephemeral UI state from a child without pushing it into a shared store.

### Behaviour
- Create note → click a different note → empty note disappears from sidebar
- Create note → navigate to settings/logout → empty note is gone on return
- Create note → type title only → navigate away → note is kept
- Create note → type content only → navigate away → note is kept

---

## 2026-04-12 — Avatars in share note popup

**Branch:** `frontendauth`

### Problem
The share dialog showed only a single letter initial inside a plain circle for each user — both in the "current access" list and the "available users" list. The `UserAvatar` component (which generates deterministic pixel-art avatars from UUIDs and displays real photos when available) was unused here.

### What was changed

**`srcs/requirements/auth/src/routes/user.ts`**
Added `imageURL: schema.users.imageURL` to the Drizzle `.select()` on the `GET /users` endpoint. It was previously returning only `id` and `loginName`.

**`srcs/requirements/frontend/app/pages/Notes.vue`**
- Imported `UserAvatar`
- Updated the `allUsers` ref type and `$fetch` generic to include `imageURL: string | null`
- Added `imageFor(userId)` helper — resolves a collaborator's `imageURL` by looking them up in `allUsers` (needed because the collaborators list only carries `guest_id`, not image data)
- Replaced both initials `<span>` elements in the dialog with `<UserAvatar :uuid="..." :image-u-r-l="..." :size="28" />`

### Why `imageFor()` is needed
The collaborators list (`/api/notes/collab/:id`) returns `guest_id` but no user profile data. Image data only lives in `allUsers` (fetched from `/api/auth/users`). The helper bridges the two by doing a lookup on the already-loaded list — no extra network request.

### Behaviour
- Users with a real `imageURL` (GitHub/Google OAuth) display their profile photo
- Users without one get the deterministic SVG pixel-art avatar seeded from their UUID — the same visual they see in the app header

---

## 2026-04-12 — Fix: notes list flash on client-side navigation

**Branch:** `ui`

### Problem
When navigating to the notes page via client-side routing (e.g. after login), there was a brief flash of an empty notes list before the notes appeared.

### Root cause
Two separate hooks handled data fetching:
- `onServerPrefetch` — runs only during SSR (hard refresh / direct URL). Populates the store server-side and transfers state via the Nuxt payload.
- `onMounted` — runs after the component has already rendered. On client-side navigation, this was the only path that triggered `fetchNotes()`, but by then the template had already painted with `notes = []`.

### What was changed

**`app/pages/Notes.vue`**

Replaced both hooks with a single `useAsyncData` call:

```js
// Before
onMounted(() => {
    if (noteStore.notesCount === 0) noteStore.fetchNotes();
    fetchSharedNotes();
});
onServerPrefetch(async () => {
    if (noteStore.notesCount === 0) await noteStore.fetchNotes();
});

// After
await useAsyncData('notes', async () => {
    if (noteStore.notesCount === 0) await noteStore.fetchNotes();
});
onMounted(() => {
    fetchSharedNotes();
});
```

### Why `useAsyncData` fixes this
`useAsyncData` is a Nuxt primitive that integrates with its suspense system:
- **On SSR:** runs on the server and serializes the result into the HTML payload — same behaviour as `onServerPrefetch`.
- **On client-side navigation:** Nuxt suspends rendering of the page until the async function resolves, so the component never mounts with an empty list.

`onMounted` fires after render by definition — it cannot prevent the empty flash. `useAsyncData` called at the top level of `<script setup>` is intercepted by Nuxt before the component renders.

---

## 2026-04-11 — Replace empty Listbox message with create link

**Branch:** `frontendauth`

### Problem
When a user had no notes, the notes sidebar showed **"No available options"** — PrimeVue's hardcoded default empty message for the `<Listbox>` component. This was unhelpful and confusing for new users.

### What was changed

**`app/pages/Notes.vue`**
Added an `#empty` slot to the owned-notes `<Listbox>`. PrimeVue exposes this slot specifically to override the default empty message. The Volt wrapper already forwards all slots transparently, so no changes were needed there.

The slot renders a `<button>` (not a link — there's no route to navigate to, it's an action) that calls `handleCreate`, the same function used by the `+` button in the sidebar header.

**`app/locales/*.json`** (en-UK, de-DE, es-ES, ar)
Added `"notes.createFirst"` key to all four locale files:
- EN: "Create Your First Note"
- DE: "Erstelle deine erste Notiz"
- ES: "Crea tu primera nota"
- AR: "أنشئ ملاحظتك الأولى"

### Why a `<button>` and not a `<NuxtLink>`
`handleCreate` is an async action — it calls the API, creates a note, and selects it. It doesn't navigate to a different route. Using `<NuxtLink>` with `@click.prevent` would work but is semantically misleading. A `<button>` is the correct element for triggering an action.
