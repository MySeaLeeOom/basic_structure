# NotesView Master-Detail Layout

**Date:** 2026-02-01
**Branch:** `vue-notes-view`

## Overview

Master-detail layout for Notes view using Volt UI components. Fixed-width sidebar with `Listbox` for note navigation, flexible main area with `Card` displaying selected note content.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Header: "Mycelium"    [Home] [Notes] [Mindmap]     │
├───────────────┬─────────────────────────────────────┤
│  Sidebar      │  Document View                      │
│  w-64         │  bg-surface-200                     │
│               │                                     │
│  ┌─────────┐  │  ┌───────────────────────────┐      │
│  │ Notes   │  │  │  Card                     │      │
│  ├─────────┤  │  │  ────────────────────     │      │
│  │Listbox  │  │  │  Title                    │      │
│  │         │  │  │                           │      │
│  │ • Note1 │  │  │  Content (pre-formatted)  │      │
│  │ • Note2 │  │  │                           │      │
│  │ • Note3 │  │  │                           │      │
│  └─────────┘  │  └───────────────────────────┘      │
└───────────────┴─────────────────────────────────────┘
```

> Navigation added in [sidebar-layout-navigation](./2026-02-02-sidebar-layout-navigation.md).

## Volt Components

| Component | Usage | Why |
|-----------|-------|-----|
| `Listbox` | Note selection | Built-in keyboard nav, a11y, selection state |
| `Card` | Document container | Consistent styling with title/content slots |
| `Toolbar` | Header bar | Flexible slot-based layout |

## File Structure

```
src/
├── views/
│   ├── HomeView.vue       # Dashboard (uses SidebarLayout)
│   ├── NotesView.vue      # Notes master-detail
│   └── MindmapView.vue    # Mindmap (uses SidebarLayout)
├── components/
│   ├── Header.vue         # App header with nav links
│   └── layouts/
│       └── SidebarLayout.vue  # Reusable sidebar wrapper
├── data/
│   └── notes.ts           # Note interface (type only)
├── volt/                  # Volt UI components (60+)
│   ├── Listbox.vue
│   ├── Card.vue
│   ├── Toolbar.vue
│   └── ...
└── assets/
    └── base.css           # Theme variables + @layer components
```

## NotesView Implementation

> **Note:** This shows the initial scaffold. For current implementation with API integration and create form, see [notes-api-integration](./2026-02-01-notes-api-integration.md).

**Initial scaffold (static data):**

```vue
<script setup lang="ts">
import { ref } from 'vue';
import Listbox from '@/volt/Listbox.vue';
import Card from '@/volt/Card.vue';
import { notes, type Note } from '@/data/notes';

const selectedNote = ref<Note>(notes[0]!);
</script>
```

**Current implementation** uses SidebarLayout wrapper and fetches from API:

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import SidebarLayout from '@/components/layouts/SidebarLayout.vue';
import Listbox from '@/volt/Listbox.vue';
import type { Note } from '@/data/notes';

const notes = ref<Note[]>([]);
const selectedNote = ref<Note | null>(null);

async function fetchNotes() { /* ... */ }
onMounted(fetchNotes);
</script>

<template>
  <SidebarLayout>
    <template #sidebar>
      <Listbox :modelValue="selectedNote" :options="notes" ... />
    </template>
    <div class="document-container">
      <Card v-if="selectedNote" pt:root:class="card-document">...</Card>
    </div>
  </SidebarLayout>
</template>
```

## Key Patterns

### Volt Component Customization

Use `pt:root:class` for per-instance styling without fighting the design system:

```vue
<Listbox pt:root:class="border-0 shadow-none bg-transparent" />
<Card pt:root:class="w-full max-w-3xl min-h-[800px]" />
```

### Object Selection with Listbox

When binding to objects, use `dataKey` for proper comparison:

```vue
<Listbox
  v-model="selectedNote"
  :options="notes"
  optionLabel="title"
  dataKey="id"          <!-- Compare by id, not object reference -->
/>
```

### SSR Safety

- Static placeholder data (no `Date.now()`, `Math.random()`)
- No `window`/`document` access at script-setup top-level
- All browser APIs in `onMounted` or event handlers

## Theme Configuration

`src/assets/base.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap');
@import "tailwindcss";
@import "tailwindcss-primeui";

@theme {
  --font-handwritten: 'Caveat', cursive;
}

:root {
  /* Primary (emerald) */
  --p-primary-500: #10b981;
  /* ... */

  /* Surface (zinc) - complete 0-950 palette */
  --p-surface-0: #ffffff;
  --p-surface-50: #fafafa;
  /* ... */
  --p-surface-950: #09090b;
}
```

## Data Model

`src/data/notes.ts`: (types.ts)

```ts
export interface Note {
  id: number;       // Matches PostgreSQL SERIAL
  title: string;
  content: string;
}
```

> **Note:** Placeholder data removed after API integration. See [notes-api-integration](./2026-02-01-notes-api-integration.md).

## Dependencies

```json
{
  "dependencies": {
    "@primevue/icons": "^4.5.4",
    "primevue": "^4.5.4",
    "vue": "^3.5.27",
    "vue-router": "^4.6.4"
  }
}
```

---

## Refactor: Tailwind Class Extraction

Eliminated inline Tailwind clutter using a hybrid approach. See [Tailwind Class Strategies](../tailwind-class-strategies.md) for the full comparison of all 5 methods.

**Strategies used:**

### 1. Layout Wrapper Component

Created `src/components/layouts/SidebarLayout.vue`:

```vue
<script setup lang="ts">
defineProps<{ sidebarWidth?: string }>();
</script>

<template>
  <div class="flex h-[calc(100vh-60px)]">
    <aside class="shrink-0 bg-surface-50 ..." :style="{ width: sidebarWidth ?? '16rem' }">
      <slot name="sidebar" />
    </aside>
    <main class="flex-1 bg-surface-200 ...">
      <slot />
    </main>
  </div>
</template>
```

### 2. `@layer components` in CSS

Added semantic classes to `src/assets/base.css`:

```css
@layer components {
  .listbox-borderless { @apply border-0 shadow-none bg-transparent; }
  .card-document { @apply w-full max-w-3xl min-h-[800px]; }
  .section-title { @apply text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400 mb-3; }
  .document-container { @apply flex justify-center py-8 px-4; }
  .document-body { @apply whitespace-pre-wrap font-sans leading-relaxed text-surface-700 dark:text-surface-300; }
}
```

### Result: Clean NotesView

```vue
<template>
  <SidebarLayout>
    <template #sidebar>
      <h2 class="section-title">Notes</h2>
      <Listbox v-model="selectedNote" :options="notes" optionLabel="title" dataKey="id"
               pt:root:class="listbox-borderless" />
    </template>

    <div class="document-container">
      <Card pt:root:class="card-document">
        <template #title>{{ selectedNote.title }}</template>
        <template #content>
          <pre class="document-body">{{ selectedNote.content }}</pre>
        </template>
      </Card>
    </div>
  </SidebarLayout>
</template>
```

### Files Changed

| File | Change |
|------|--------|
| `src/components/layouts/SidebarLayout.vue` | New layout wrapper |
| `src/assets/base.css` | Added `@layer components` |
| `src/views/NotesView.vue` | Refactored to use semantic classes |

## Related Devlogs

- [Notes API Integration](./2026-02-01-notes-api-integration.md) - API integration & create form
- [SidebarLayout & Navigation](./2026-02-02-sidebar-layout-navigation.md) - All views use SidebarLayout, header nav