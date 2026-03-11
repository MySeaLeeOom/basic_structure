# Notes API Integration & Creation

**Date:** 2026-02-01
**Branch:** `vue-notes-view`

## Overview

Integrate NotesView with the notes backend service (`/api/notes`) and add note creation functionality. Replaces static mock data with real PostgreSQL persistence.

## Current State (After Phase 2)

```
┌─────────────────┐                    ┌─────────────────┐
│  NotesView.vue  │────fetch()────────▶│  /api/notes     │
│  (reactive)     │                    │  (FastAPI)      │
└─────────────────┘                    └────────┬────────┘
                                                │
                                       ┌────────▼────────┐
                                       │   PostgreSQL    │
                                       └─────────────────┘
```

## Previous State

```
┌─────────────────┐      ┌─────────────────┐
│  NotesView.vue  │──────│  notes.ts       │
│  (static data)  │      │  (mock array)   │
└─────────────────┘      └─────────────────┘
```

**Problems solved:**
- ~~Frontend uses hardcoded `notes.ts` array~~ → Now fetches from API
- ~~No persistence — changes lost on refresh~~ → PostgreSQL storage
- ~~`id: string` in frontend vs `id: number` (SERIAL) in backend~~ → Types aligned

## API Endpoints

| Method | Endpoint | Request Body | Response |
|--------|----------|--------------|----------|
| GET | `/api/notes` | — | `Note[]` |
| POST | `/api/notes` | `{ title, content }` | `Note` |

## Implementation Plan

### Phase 1: Type Alignment ✓

Fix `id` type mismatch: `string` → `number` (matches SERIAL).

**File:** `src/data/notes.ts`
- Change `id: string` to `id: number`
- Rename `notes` to `placeholderNotes` for SSR fallback

### Phase 2: API Integration ✓

Replace the static `placeholderNotes` import with a real API call.

#### What changes in the script

**Before:** Component imports a hardcoded array and displays it immediately.

**After:** Component starts with an empty array, fetches data from the API, then displays it.

| State variable | Purpose |
|----------------|---------|
| `notes` | The array of notes (starts empty) |
| `selectedNote` | Which note is currently selected (starts null) |
| `error` | Error message if fetch fails |

#### Why `onMounted()`?

The fetch must happen inside `onMounted()` because of SSR:

- **Server render:** No fetch happens. Component renders with empty state.
- **Client hydration:** `onMounted()` fires. Fetch runs. UI updates.

If you fetch at the top level (outside `onMounted`), the server will try to fetch too — and fail or cause hydration mismatches.

#### What changes in the template

- **Error:** Show inline error text above Listbox
- **Listbox:** Always visible (empty initially, populates after fetch)
- **Empty selection:** Handle `selectedNote` being `null` initially

#### Auto-select first note

Auto-select moved into `fetchNotes()` after successful load:

```typescript
if (!selectedNote.value && notes.value.length)
  selectedNote.value = notes.value[0]!;
```

#### When to extract a composable later

Keep it inline for now. Extract to `useNotesApi()` if:
- Multiple views need notes
- Logic gets complex (caching, retry, pagination)
- You want to unit test API logic separately

See [Composables Guide](../vue/composables.md) for the pattern.

#### Implementation Summary

**NotesView.vue changes:**
```typescript
// State
const notes = ref<Note[]>([]);
const selectedNote = ref<Note | null>(null);
const error = ref<string | null>(null);

// Fetch on mount (SSR-safe)
async function fetchNotes() {
  error.value = null;
  try {
    const res = await fetch('/api/notes');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    notes.value = await res.json();
    if (!selectedNote.value && notes.value.length)
      selectedNote.value = notes.value[0]!;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Load failed';
  }
}

onMounted(fetchNotes);
```

**Template states:**
- Error: `<p class="text-red-500 text-sm">{{ error }}</p>` (inline, above Listbox)
- Listbox: Always rendered (empty initially)
- Empty selection: "Select a note" message

**notes.ts changes:**
- Removed `placeholderNotes` export
- Kept only `Note` interface

### Phase 3a: Create Form UI (no API)

Build the form scaffold first. Verify layout and SSR before wiring API.

**State additions:**
```typescript
const showCreateForm = ref(false);
const newTitle = ref('');
const newContent = ref('');
```

**Template changes:**
1. Sidebar header: "Notes" title + plus button (toggles `showCreateForm`)
2. Create form (shown when `showCreateForm` is true):
   - `<InputText v-model="newTitle" placeholder="Title" fluid />`
   - `<Textarea v-model="newContent" placeholder="Content..." rows="4" fluid />`
   - Cancel button: closes form, clears inputs
   - Create button: disabled when `!newTitle.trim()` (no API yet)
3. Form replaces Listbox when visible (not stacked)

**Validation:**
- Create disabled when title is empty
- No content required (can be empty note)

**SSR check:**
- Form starts hidden (`showCreateForm = false`)
- No browser APIs needed
- Hydration safe ✓

### Phase 3b: Create API Integration

Wire the form to POST `/api/notes`.

**Create function:**
```typescript
async function createNote() {
  try {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle.value.trim(),
        content: newContent.value
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const note: Note = await res.json();
    notes.value.push(note);
    selectedNote.value = note;
    resetForm();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Create failed';
  }
}
```

**Template updates:**
- Create button: `@click="createNote"`, `:disabled="!newTitle.trim()"`
- Errors reuse the shared `error` ref (shown in sidebar)

## File Changes

| File | Action | Phase | Description |
|------|--------|-------|-------------|
| `src/data/notes.ts` | Modify | 1 | `id: string` → `id: number`, removed `placeholderNotes` |
| `src/views/NotesView.vue` | Modify | 2 | API integration with loading/error states |
| `src/assets/base.css` | Modify | 1 | Add layout classes |
| `src/views/NotesView.vue` | Modify | 3a | Add create form UI (no API) |
| `src/views/NotesView.vue` | Modify | 3b | Wire create form to POST /api/notes |

## Volt Components Used

| Component | Phase | Usage |
|-----------|-------|-------|
| `Button` | 3a, 3b | Plus toggle, create/cancel |
| `InputText` | 3a | Note title input |
| `Textarea` | 3a | Note content input |

## SSR Considerations

1. **No fetch at top-level** — API calls in `onMounted()` only
2. **Handle empty state** — Notes array empty during SSR
3. **Hydration safe** — No `Date.now()` or random values

## Data Flow

```
SSR (Server)
  → Renders with empty notes[], selectedNote = null
  → Empty Listbox visible
  → showCreateForm = false (form hidden)

Client Hydration
  → onMounted() fires
  → fetch('/api/notes')
  → UI updates reactively

User Opens Form (Phase 3a)
  → Click plus button
  → showCreateForm = true
  → Form shown in main panel
  → Type title/content

User Creates Note (Phase 3b)
  → Click Create button
  → POST /api/notes { title, content }
  → notes.push(newNote)
  → selectedNote = newNote
  → Form closes and clears
```

## Testing Checklist

- [x] `make up` — services running
- [x] GET `/api/notes` returns array
- [x] POST `/api/notes` creates and returns note
- [x] Frontend loads notes on mount
- [x] First note auto-selects after load
- [x] Clicking notes updates content area
- [x] Error state shows inline when API unavailable
- [x] Plus button toggles create form
- [x] Cancel clears form and hides it
- [x] Create disabled when title empty
- [x] POST creates note and adds to list
- [x] New note auto-selected after create
- [x] Page refresh preserves notes

## Related Devlogs

- [Notes View Master-Detail](./2026-02-01-notes-view-master-detail.md) - Initial scaffold & Tailwind extraction
- [SidebarLayout & Navigation](./2026-02-02-sidebar-layout-navigation.md) - All views use SidebarLayout, header nav

## Future Enhancements

- [ ] Edit existing notes (PUT)
- [ ] Delete notes (DELETE)
- [ ] Optimistic updates
- [ ] Markdown preview
