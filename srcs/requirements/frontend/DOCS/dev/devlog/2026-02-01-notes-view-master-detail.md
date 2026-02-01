# NotesView Master-Detail Layout

**Date:** 2026-02-01
**Branch:** `vue-notes-view`

## Overview

Implemented a master-detail layout for the Notes view using Volt UI components. The layout features a fixed-width sidebar for note navigation and a flexible main area displaying the selected note.

## Files Changed

| File | Change |
|------|--------|
| `src/views/NotesView.vue` | Google Docs-style document view |
| `src/components/Header.vue` | Styled header with Volt Toolbar |
| `src/data/notes.ts` | Placeholder notes data (extracted) |
| `src/assets/base.css` | Caveat font + complete surface palette |
| `tsconfig.app.json` | Added `@/*` path alias for TypeScript |

## Implementation Details

### Layout Structure (Google Docs Style)

```
┌─────────────────────────────────────────────────┐
│  Header: "Mycelium" brand (Volt Toolbar)        │
├──────────────┬──────────────────────────────────┤
│  Sidebar     │  Document View (gray bg)         │
│  w-64        │                                  │
│  shrink-0    │  ┌─────────────────────────┐     │
│              │  │  Title                  │     │
│ ┌──────────┐ │  │  ─────────────────────  │     │
│ │ My Notes │ │  │                         │     │
│ └──────────┘ │  │  # Markdown content     │     │
│              │  │  ## Rendered as doc     │     │
│ • Note 1    │  │                         │     │
│ • Note 2    │  │  (816px white paper     │     │
│ • Note 3    │  │   with shadow)          │     │
│              │  └─────────────────────────┘     │
└──────────────┴──────────────────────────────────┘
```

### Volt Components Used

| Component | Usage | Props |
|-----------|-------|-------|
| `Toolbar` | Header bar | Custom dark mode classes |
| `SecondaryButton` | Note list items | `text` variant |

### Document View Styling

Google Docs-like centered paper:
- **Container**: `bg-surface-200 dark:bg-surface-950` (gray background)
- **Paper**: `max-w-[816px] min-h-[1056px]` (letter size proportions)
- **Shadow**: `shadow-lg rounded-sm`
- **Padding**: `p-16` (64px margins like real documents)

### Tailwind Theme Extension

Added custom font via `@theme` block in `base.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap');

@theme {
  --font-handwritten: 'Caveat', cursive;
}
```

Usage: `class="font-handwritten text-xl"`

### SSR Safety

- Static placeholder data (no `Date.now()`, `Math.random()`)
- No `window`/`document` access at top-level
- All browser APIs wrapped in event handlers

## Testing

Verified via Chrome WebDriver MCP:
- SSR renders correctly at `/notes`
- Click handlers update selected note
- Tag content updates reactively
- Layout maintains fixed sidebar + fluid main

## Dark Mode Fix

Initial implementation had poor contrast in dark mode. Fixed by:

1. **Complete surface palette** in `base.css` - added all values from 0-950
2. **Layered backgrounds**:
   - Main area: `dark:bg-surface-950` (darkest)
   - Card: `dark:bg-surface-800` (lighter, stands out)
   - Sidebar: `dark:bg-surface-900`
3. **Visible borders**: Changed from `surface-700` to `surface-600`
4. **Selected state**: Added `!text-surface-100` for button text contrast

## Data Extraction

Moved placeholder notes to `src/data/notes.ts`:

```ts
// src/data/notes.ts
export interface Note {
  id: string;
  title: string;
  content: string;  // Raw markdown
}

export const notes: Note[] = [...]
```

Import in view: `import { notes } from '@/data/notes'`

## Header Component

Simplified header using Volt Toolbar with just brand text:

```vue
<Toolbar class="!rounded-none !border-x-0 !border-t-0 dark:!bg-surface-900">
  <template #start>
    <span class="text-xl font-bold text-primary-500">Mycelium</span>
  </template>
</Toolbar>
```

## Next Steps

- [ ] Add markdown renderer for document content
- [ ] Implement note CRUD operations
- [ ] Connect to backend API

## Related

- Plan: See planning transcript for full design rationale
- Components reference: `DOCS/components/`
