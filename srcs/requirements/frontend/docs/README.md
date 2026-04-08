# Frontend Documentation

## Collaborative Editing (`dev/collab/`)

| File | Description |
|------|-------------|
| [overview.md](dev/collab/overview.md) | Backend workflow: connect → load → sync → edit → persist → disconnect. Notes service (REST) + editor service (WebSocket). |
| [tiptap-yjs-integration.md](dev/collab/tiptap-yjs-integration.md) | Frontend integration: 2-file architecture, useCollaboration composable, NoteEditor component, SSR safety. |
| [live-cursors.md](dev/collab/live-cursors.md) | Awareness protocol: ephemeral cursor/selection data, CollaborationCaret config, connected users count. |
| [tiptap-yjs-summary.md](dev/tiptap-yjs-summary.md) | Comprehensive reference with mermaid diagrams covering all of the above in one file. |

## Internationalization (`dev/`)

| File | Description |
|------|-------------|
| [i18n.md](dev/i18n.md) | i18n architecture: frontend useUiI18n composable + JSON dictionaries, backend Fluent FTL files, error localization, locale resolution, consuming backend errors in Vue, best practices. |

## Vue + Volt UI (`dev/vue/`)

| File | Description |
|------|-------------|
| [vue-volt-patterns.md](dev/vue/vue-volt-patterns.md) | Vue 3.5 features (`useTemplateRef`, reactive destructuring, `useId`, lazy hydration), Volt UI setup, Pinia stores, SSR-safe patterns. |
| [composables.md](dev/vue/composables.md) | Vue 3 composable patterns: creating, using, SSR safety, composables vs Pinia. |

## Styling (`dev/`)

| File | Description |
|------|-------------|
| [tailwind-class-strategies.md](dev/tailwind-class-strategies.md) | 5 strategies for managing Tailwind classes: `@apply`, layout wrappers, `@layer components`, JS variables, custom components. |

## Devlog (`dev/devlog/`)

| Date | Summary |
|------|---------|
| [2026-02-01](dev/devlog/2026-02-01-notes-api-integration.md) | Notes API integration and creation |
| [2026-02-01](dev/devlog/2026-02-01-notes-view-master-detail.md) | NotesView master-detail layout with Volt UI |
| [2026-02-02](dev/devlog/2026-02-02-notes-view-cleanup.md) | NotesView cleanup and Listbox fix |
| [2026-02-02](dev/devlog/2026-02-02-notes-view-modularization.md) | NotesView modularization |
| [2026-02-02](dev/devlog/2026-02-02-sidebar-layout-navigation.md) | SidebarLayout and navigation |

## Component Examples (`components/`)

Reference implementations for common UI patterns (from early prototype).

## Other

| File | Description |
|------|-------------|
| [SSR.md](SSR.md) | SSR data flow diagram (partially outdated — describes Fastify, project now uses Nuxt) |
| [frontend-refactor-summary.md](frontend-refactor-summary.md) | Multi-store architecture refactor summary |
