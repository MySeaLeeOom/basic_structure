# NotesView Modularization

**Date:** 2026-02-02
**Branch:** `vue-notes-view`

## Overview

Extract reusable components and composables from `NotesView.vue` to establish patterns for the codebase.

## Changes

### 1. Created `useNotes` Composable

New composable at `src/composables/useNotes.ts` encapsulates API and state logic:

```ts
export function useNotes() {
  const notes = ref<Note[]>([]);
  const selectedNote = ref<Note | null>(null);
  const error = ref<string | null>(null);

  async function fetchNotes() { ... }
  async function createNote(title: string, content: string) { ... }

  return { notes, selectedNote, error, fetchNotes, createNote };
}
```

### 2. Created `NoteCreateForm` Component

Self-contained form component at `src/components/notes/NoteCreateForm.vue`:

- Manages own form state (`title`, `content` refs)
- Emits `create(title, content)` when submitted
- Emits `cancel` when cancelled
- Uses Volt: Card, InputText, Textarea, Button

### 3. Created `NoteDisplay` Component

Simple display component at `src/components/notes/NoteDisplay.vue`:

- Props: `note: Note`
- Uses Volt: Card

### 4. Simplified NotesView

Reduced from 102 → 52 lines. Now only handles:

- Layout orchestration with SidebarLayout
- Component event handling
- `showCreateForm` UI state

## File Structure

```
src/
├── composables/
│   └── useNotes.ts              # NEW: API + state logic
├── components/
│   └── notes/
│       ├── NoteCreateForm.vue   # NEW: Create form
│       └── NoteDisplay.vue      # NEW: Note card
└── views/
    └── NotesView.vue            # SIMPLIFIED
```

## Patterns Established

1. **Composables** for API/state logic (separation of concerns)
2. **Feature folders** under components (`components/notes/`)
3. **Props down, events up** for component communication
4. **Views as orchestrators** - minimal logic, delegate to composables/components

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/composables/useNotes.ts` | Create | API fetch/create + state management |
| `src/components/notes/NoteCreateForm.vue` | Create | Form with title/content inputs |
| `src/components/notes/NoteDisplay.vue` | Create | Card displaying note |
| `src/views/NotesView.vue` | Modify | Use composable and child components |

## Related Devlogs

- [NotesView Cleanup](./2026-02-02-notes-view-cleanup.md) - Previous cleanup work
- [SidebarLayout & Navigation](./2026-02-02-sidebar-layout-navigation.md) - Layout system
