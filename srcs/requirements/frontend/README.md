# Frontend TODO

Priority order based on severity and dependencies.

## Critical — Data Loss & Broken Flows

- [ ] **Text not saving** — entered text sometimes gets cut off or full lines go missing (#32)
- [ ] **OAuth redirect broken** — GitHub login redirects to `localhost/...` instead of `localhost:8080` (#32)
- [ ] **SSR 401 redirect not working** — `navigateTo('/login')` in `onServerPrefetch` doesn't fire, unauthenticated users get stuck (#32)

## High — Identity & Core UX

- [ ] **Wrong editor name** — logged-in user shows as "anonymous" in collaborative editing; pass GitHub username into Yjs awareness (#44)
- [ ] **Increase typing area** — new note body has too-small clickable area, dead space above and below (#57)

## Medium — Error Handling & Routing

- [ ] **Custom error pages** — add 401/400/500 pages, especially a "try again" page for GitHub OAuth failures (#31)
- [ ] **URL routing for notes** — notes should have addressable URLs by title/UUID for sharing and bookmarking (#31)

## Low — Internationalization

- [ ] **i18n patch** — integrate the string store prototype from `DOCS/26-01-17_frontend_42_i18n/` into the Nuxt frontend (#26)
- [ ] **Right-to-left support** — add RTL language (Arabic), translate strings, create RTL style guide (depends on i18n) (#27)

## Low — Accessibility

- [ ] **Accessibility audit & fixes** — document WCAG touchpoints, list required features, update frontend (#28)

## Backlog — Polish & Features

- [ ] Close a note from the UI (#31)
- [ ] Save button for version history (#31)
- [ ] Cleaner editor UI (#31)
- [ ] Mind maps — new service, beyond MVP (#18)

---

# Nuxt Minimal Starter

NUXT LOG: `pnpm dev`

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# pnpm
pnpm install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# pnpm
pnpm dev
```

## Production

Build the application for production:

```bash
# pnpm
pnpm build
```

Locally preview production build:

```bash
# pnpm
pnpm preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.


## Create NEW CONTAINER with NUXT for SSR
**Less manual work for routing + SSR**

```
pnpm dlx nuxi@latest init frontend_nuxt
pnpm install
pnpm approve-builds

pnpm add @pinia/nuxt @vueuse/nuxt
pnpm add -d typescript @types/node

pnpm dev
<!-- It runs -->
```

2. Move contents of src/ into app/
3. Move Dockerfiles into the new folder
4. Dependencies
```bash
pnpm add primevue @primevue/nuxt
pnpm add -D @nuxtjs/tailwindcss tailwindcss postcss autoprefixer
pnpm add -D typescript vue-tsc @types/node

pnpm exec npx tailwindcss init -p
pnpm exec nuxi prepare

pnpm add @tiptap/vue-3 @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-collaboration @tiptap/extension-collaboration-caret yjs y-websocket y-protocols markdown-it tailwindcss-primeui @primevue/icons
```
### Dependencies Explanation
When we build a modern web application, we are managing three distinct layers: **Logic**, **Structure**, and **Presentation**. These commands set up the tools to manage those layers safely and efficiently.

### 1. The Core Library & Nuxt Integration
```bash
pnpm add primevue @primevue/nuxt-module
```
*   **`primevue`**: This is a library of pre-built UI components (buttons, dialogs, inputs). Instead of building a "Confirm Dialog" from raw HTML and CSS atoms every time, you use a battle-tested component.
*   **`@primevue/nuxt`**: This is the "glue" code. Nuxt has a specific way of handling Server-Side Rendering (SSR). This module ensures that when the server renders your page, it knows how to handle PrimeVue components correctly so they don't "flicker" when the browser takes over.
*   **Why regular dependency?** These are used at **runtime**. Your users need this code to see the buttons and dialogs.

### 2. The Styling Engine (Tailwind)
```bash
pnpm add -D @nuxtjs/tailwindcss tailwindcss postcss autoprefixer
```
*   **`tailwindcss`**: A "utility-first" CSS framework. Instead of writing CSS in separate files, you apply tiny, atomic classes (e.g., `flex`, `pt-4`) directly to your HTML.
*   **`postcss` & `autoprefixer`**: These are the "cleaners." They take your modern CSS and automatically add prefixes (like `-webkit-`) so your site doesn't break on older browsers.
*   **`@nuxtjs/tailwindcss`**: The "glue" for Nuxt. It automates the configuration so you don't have to manually import Tailwind into your main CSS file.
*   **Why Dev Dependency (`-D`)?** These are **compilers**. They run on your machine to generate a final, tiny CSS file. The actual "Tailwind" software never goes to the user's browser; only the resulting CSS does.

### 3. The Type Safety Layer (TypeScript)
```bash
pnpm add -D typescript vue-tsc @types/node
```
*   **`typescript`**: The language itself. It adds "contracts" to your code (e.g., "This function *must* receive a String").
*   **`vue-tsc`**: This is a specialized version of the TypeScript compiler that understands `.vue` files. Standard TypeScript only understands `.ts` files; `vue-tsc` can "look inside" your templates to make sure you aren't passing a number to a component that expects a string.
*   **`@types/node`**: Definitions for the environment. It tells TypeScript what things like `process.env` or `path` are when you're writing server-side code.
*   **Why Dev Dependency?** TypeScript is a **development tool**. Browsers cannot run TypeScript. It must be converted (transpiled) to JavaScript before deployment.

### 4. Initialization & Preparation
```bash
pnpm exec nuxi prepare
```
*   In Nuxt, many things are "auto-generated" (like the types for your routes and stores). This command tells Nuxt: "Scan my project and generate the hidden `.nuxt` folder so that my code editor (VS Code) understands all my imports and doesn't show red squiggly lines."

### Summary of Dev vs. Prod Dependencies:
*   **Dependencies (`dependencies`)**: Code that the **user's browser** or the **production server** needs to execute (e.g., Vue, Pinia, PrimeVue).
*   **Dev Dependencies (`devDependencies`)**: Tools that **you** use to build, check, and compile the code (e.g., TypeScript, Tailwind, Linters). If you deleted these, the app would still run, but you couldn't change it or rebuild it.

