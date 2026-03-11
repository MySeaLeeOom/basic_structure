# Frontend Refactor: Live Edit & Preview System

This document summarizes the architectural changes implemented to support side-by-side note editing, live markdown preview, and unsaved change protections.

## 1. Multi-Store Architecture (Pinia)
We've decoupled **Domain Data** (saved in database) from **UI Workset State** (active editing) to prevent "state pollution."

- **`noteStore.ts` (The Source of Truth):** Handles global data fetching, the master list of notes, and server-side CRUD operations.
- **`editStore.ts` (The Workspace):** A new "Setup Store" dedicated to the active draft. It tracks `draftTitle`, `draftContent`, and `draftId`. 
    - **Live Sync:** Uses a `watch` on `noteStore.selectedNote` to automatically load existing data.
    - **Dirty Checking:** Provides a computed `isDirty` flag for unsaved change warnings.

## 2. Shared Draft State (Live Preview)
By binding both the Editor and Preview components to the same `editStore`, we achieved instantaneous previewing without complex event emitting.

- **`NoteEdit.vue`:** Binds `v-model` directly to `editStore.draftTitle` and `editStore.draftContent`.
- **`NoteDisplay.vue`:** Now observes `editStore.draftContent` instead of a static `props.note`.

## 3. Responsive Workspace Layout
The UI was moved from a "Modal/Form" approach to a "Workspace" approach.
- **`NotesView.vue`:** Conditionally renders `NoteEdit` and `NoteDisplay` side-by-side.
- **`SidebarLayout.vue`:** Implements **Mobile-First** responsiveness.
    - **Mobile:** Uses `flex-col` and `w-full` sidebar (stacked view).
    - **Desktop:** Uses `md:flex-row` and `md:w-64` (side-by-side view).

## 4. Height & Overflow Management
To prevent the application from growing beyond the viewport or the editor cards from expanding infinitely:
- **Card Constraints:** Applied `flex-1` and `min-h-0` to the `Card` component’s internal slots ([src/volt/Card.vue](src/volt/Card.vue)).
- **Scrolling:** The `Textarea` and `NoteDisplay` use `overflow-auto` and `resize-none` to ensure long notes create internal scrollbars instead of breaking the layout.

## 5. Sidebar CRUD UI
We've improved the sidebar accessibility and management:
- **Quick Delete:** Added a "Times/X" button to each list item in the `Listbox` that appears on hover (`group-hover/item`).
- **Context Menus:** Implemented a right-click menu for advanced actions (Delete, etc.) using a custom `ContextMenu.vue` component.
- **Safe Actions:** All deletion operations are wrapped in `confirm.require` to prevent accidental data loss.

## 6. Guarded Navigation
Implemented a "Discard Changes" workflow using PrimeVue’s `useConfirm`.
- If `editStore.isDirty` is true when clicking "Cancel", the user is prompted to confirm discarding their work.
- The `handleSave` logic was updated to stay in the editor after saving (preventing unwanted view closures while still syncing the new database ID).

## 5. API Alignment
The `noteStore.editNote` action was updated to:
1. Handle both `PUT /api/notes/{id}` for updates.
2. Fall back to `POST /api/notes` if the ID is null (new note creation).
3. Correctly update the local `notes` array using `findIndex` to ensure UI reactivity across the entire app.

---
**Next Steps:**
- Add "Delete" functionality to the `NoteEdit` workspace.
- Implement Markdown parsing in `NoteDisplay` (currently using `<pre>` for raw text).
