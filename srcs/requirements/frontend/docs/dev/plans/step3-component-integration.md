# Step 3 — Component Integration

Detailed implementation guide for Step 3 of the [Tiptap Implementation Plan](./tiptap-implementation.md). Steps 1-2 created the backend XmlFragment support, WebSocket provider, and `useCollaboration` composable. This step wires them into Vue components: creating new ones, rewriting existing ones, updating types/stores, and deleting dead code.

Assumes familiarity with the [Tiptap + Yjs Frontend Integration](../collab/tiptap-yjs-integration.md) design document.

---

## Table of Contents

1. [File Change Summary](#1-file-change-summary)
2. [Prerequisite Fixes](#2-prerequisite-fixes)
3. [New Components](#3-new-components)
4. [Rewritten Components](#4-rewritten-components)
5. [Store Changes](#5-store-changes)
6. [Type Changes](#6-type-changes)
7. [CSS — Editor and Collaboration Styles](#7-css--editor-and-collaboration-styles)
8. [Data Flow Diagrams](#8-data-flow-diagrams)
9. [Known Limitations](#9-known-limitations)

---

## 1. File Change Summary

| File | Action | What Changes |
|---|---|---|
| `src/types.ts` | **Update** | `Note` interface: UUID `id`, `title_preview`, `content_preview`, timestamps |
| `src/composables/useCollaboration.ts` | **Update** | Fix Y.Doc reuse bug, accept plain `noteId: string`, drop `yContent` from return |
| `src/collaboration/WebSocketProvider.ts` | **Update** | Accept `noteId: string` instead of `number` |
| `src/components/ClientOnly.vue` | **Create** | SSR guard — renders slot after `onMounted` |
| `src/components/notes/CollabEditor.vue` | **Create** | Tiptap editor bound to `Y.XmlFragment` via Collaboration extension |
| `src/components/notes/NoteEdit.vue` | **Rewrite** | Replace Textarea/InputText/Save with CollabEditor + title input + Close |
| `src/components/notes/NoteDisplay.vue` | **Rewrite** | Accept note as prop, display `title_preview`/`content_preview` |
| `src/views/NotesView.vue` | **Rewrite** | Fix edit/display toggle, new-note flow, type alignment |
| `src/stores/noteStore.ts` | **Update** | Remove `editNote()`, update types to match `NoteSummary` |
| `src/stores/editStore.ts` | **Delete** | Replaced by `useCollaboration` composable |
| `src/components/notes/NoteCreateForm.vue` | **Delete** | Already unused |

---

## 2. Prerequisite Fixes

Three things in the existing Step 2 code must be fixed before the components can work correctly.

### 2a. Type alignment — `Note` interface

**Problem:** The current `Note` interface does not match what the backend returns.

```typescript
// Current (src/types.ts)
export interface Note {
  id: number;        // Backend returns UUID (string)
  title: string;     // Backend returns title_preview
  content: string;   // Backend returns content_preview
}
```

The backend's `GET /api/notes` returns `Vec<NoteSummary>`:

```rust
pub struct NoteSummary {
    pub id: Uuid,                          // string, not number
    pub title_preview: Option<String>,     // not "title"
    pub content_preview: Option<String>,   // not "content"
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

Every component that accesses `note.title`, `note.content`, or compares `note.id` with a number will break. The fix is in [Section 6](#6-type-changes).

### 2b. WebSocketProvider `noteId` type — string, not number

**Problem:** `WebSocketProvider` accepts `noteId: number`, but note IDs are UUIDs (strings). The URL template `${this.noteId}` would coerce a number to a string anyway, but the type contract is wrong.

```typescript
// Current (src/collaboration/WebSocketProvider.ts, line 12)
export interface ProviderOptions {
  noteId: number;  // ← should be string
  // ...
}
```

**Fix:** Change to `noteId: string`. This cascades into `useCollaboration`.

### 2c. `useCollaboration` — Y.Doc reuse bug and type fix

**Problem:** The current composable creates a **single** `Y.Doc` and reuses it across note switches via `watch(options.noteId)`. When the user switches from note A to note B:

```
1. watch fires: oldId = A, id = B
2. disconnect() — tears down provider, but ydoc still has note A's content
3. connectToNote(B) — creates new provider with SAME ydoc
4. Server sends note B's state
5. Y.applyUpdate merges B's state INTO the existing A content
6. Result: note A's content + note B's content mixed together
```

Yjs updates are **additive** — `Y.applyUpdate` merges, it never replaces. The only way to get a clean slate is to create a new `Y.Doc`.

**The watch pattern is also wrong for the component architecture.** With the edit/display toggle in `NotesView.vue` (see [Section 4c](#4c-notesviewvue)), `NoteEdit` mounts and unmounts as the user enters and exits edit mode. The composable should run once per mount, not watch a reactive ID:

```
Before (current):
  useCollaboration({ noteId: ref(id) })  ← creates ydoc once, watches id changes

After:
  useCollaboration(noteId)               ← creates ydoc per mount, no watch
```

**Fix:** The composable accepts a plain `string` noteId (not a `Ref`), creates the Y.Doc and connects on setup, and destroys everything on unmount. No `watch`, no reuse. Full implementation in [Section 2c implementation](#usecollaboration-refactored-implementation).

#### Why this is safe

The `NoteEdit` component already remounts on note switch because of the `v-if` toggle pattern and `:key` binding (see [Section 4c](#4c-notesviewvue)). Each mount gets a fresh composable call → fresh Y.Doc → fresh WebSocket connection. The `onUnmounted` hook cleans up the old one.

#### useCollaboration refactored implementation

```typescript
// src/composables/useCollaboration.ts
import { ref, onUnmounted, shallowRef } from "vue";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { WebSocketProvider } from "@/collaboration/WebSocketProvider";

interface UseCollaborationReturn {
  ydoc: Y.Doc;
  yTitle: Y.Text;
  awareness: Awareness;
  provider: WebSocketProvider;
  titleText: Ref<string>;
  isConnected: Ref<boolean>;
  connectedUsers: Ref<number>;
  updateTitle: (value: string) => void;
}

export function useCollaboration(noteId: string): UseCollaborationReturn {
  const ydoc = new Y.Doc();
  const yTitle = ydoc.getText("title");
  const awareness = new Awareness(ydoc);

  const titleText = ref("");
  const isConnected = ref(false);
  const connectedUsers = ref(0);

  // --- Title sync: remote → local ---
  yTitle.observe(() => {
    titleText.value = yTitle.toString();
  });

  // --- Title sync: local → remote ---
  function updateTitle(value: string): void {
    ydoc.transact(() => {
      yTitle.delete(0, yTitle.length);
      yTitle.insert(0, value);
    });
  }

  // --- Awareness tracking ---
  awareness.on("change", () => {
    connectedUsers.value = awareness.getStates().size;
  });

  // --- Connect immediately ---
  const provider = new WebSocketProvider({ noteId, doc: ydoc, awareness });
  provider.connect();
  isConnected.value = true;

  // --- Cleanup on unmount ---
  onUnmounted(() => {
    provider.disconnect();
    ydoc.destroy();
  });

  return {
    ydoc,
    yTitle,
    awareness,
    provider,
    titleText,
    isConnected,
    connectedUsers,
    updateTitle,
  };
}
```

**What changed from the current implementation:**

| Aspect | Before | After |
|---|---|---|
| **`noteId` parameter** | `Ref<number \| null>` | `string` (plain value) |
| **Y.Doc lifecycle** | Created once, reused across notes | Created per composable call (per mount) |
| **Connection** | `watch(noteId)` → connect/disconnect | Connect immediately in setup |
| **`yContent` return** | Returned as `Y.XmlFragment` | Not returned — CollabEditor gets the ydoc directly |
| **`provider` return** | `Ref<WebSocketProvider \| null>` | `WebSocketProvider` (non-nullable, non-ref) |

**Why `yContent` is no longer returned:** The `Collaboration` extension is configured with `document: ydoc` (not `fragment: yContent`), which internally calls `ydoc.getXmlFragment("default")`. This creates a **separate** shared type from the backend's `"content"` field, avoiding the type-locking conflict (see [Section 3b](#3b-collabeditorvue) for the full rationale). The composable doesn't need to expose `yContent` because it never calls `getXmlFragment()` at all.

---

## 3. New Components

### 3a. ClientOnly.vue

**Purpose:** SSR guard. Renders a fallback slot on the server, swaps to the default slot after `onMounted` fires (i.e., on the client).

**Why it exists:** Tiptap's `useEditor` accesses `document` and `window` internally, even with `immediatelyRender: false`. If the component tree containing Tiptap is rendered during SSR, Node.js crashes with `ReferenceError: document is not defined`. Wrapping the editor in `<ClientOnly>` ensures it never executes on the server.

```
src/components/ClientOnly.vue
```

```vue
<script setup lang="ts">
import { ref, onMounted } from "vue";

const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});
</script>

<template>
  <slot v-if="mounted" />
  <slot v-else name="fallback" />
</template>
```

**Usage:**

```vue
<ClientOnly>
  <NoteEdit :note-id="selectedNote.id" />
  <template #fallback>
    <div class="skeleton-editor">Loading editor...</div>
  </template>
</ClientOnly>
```

**Why wrap NoteEdit, not just CollabEditor:** `NoteEdit` calls `useCollaboration()` in its `<script setup>`, which creates a `Y.Doc` and opens a `WebSocket`. Both are browser-only APIs. If we only wrapped `<CollabEditor>` inside `NoteEdit`'s template, the `<script setup>` would still run during SSR and crash. Wrapping the entire `NoteEdit` in `<ClientOnly>` at the `NotesView` level ensures no collaboration code executes on the server.

### 3b. CollabEditor.vue

**Purpose:** Tiptap rich-text editor bound to a `Y.Doc` via the Collaboration extension.

```
src/components/notes/CollabEditor.vue
```

```vue
<script setup lang="ts">
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Placeholder from "@tiptap/extension-placeholder";
import type * as Y from "yjs";
import type { WebSocketProvider } from "@/collaboration/WebSocketProvider";

const props = defineProps<{
  ydoc: Y.Doc;
  provider: WebSocketProvider;
}>();

const editor = useEditor({
  immediatelyRender: false,
  extensions: [
    StarterKit.configure({
      history: false,
    }),
    Collaboration.configure({
      document: props.ydoc,
    }),
    CollaborationCaret.configure({
      provider: props.provider,
      user: {
        name: "Anonymous",
        color: "#958DF1",
      },
    }),
    Placeholder.configure({
      placeholder: "Start writing...",
    }),
  ],
});
</script>

<template>
  <EditorContent :editor="editor" class="tiptap-editor" />
</template>
```

#### Extension configuration rationale

**`immediatelyRender: false`** — Required for SSR safety. Tells Tiptap to defer DOM access until the component is mounted in the browser. Without it, `useEditor` tries to create a ProseMirror view during server rendering, which accesses `document` and crashes Node.js. Source: [Tiptap Nuxt install guide](https://github.com/ueberdosis/tiptap-docs/blob/main/src/content/editor/getting-started/install/nuxt.mdx).

**`history: false`** — Disables StarterKit's built-in undo/redo (ProseMirror history plugin). The `Collaboration` extension provides its own undo manager that is CRDT-aware: it tracks which operations came from which client, so undo only reverts **your** changes, not remote edits. Running both history plugins simultaneously causes double-undo and corrupted state. Note: the integration doc mentions `undoRedo: false` as a rename in recent Tiptap versions — check which name your installed version expects. With `@tiptap/starter-kit@^3.20.0`, try `history: false` first; if that doesn't work, try `undoRedo: false`.

**`Collaboration.configure({ document: props.ydoc })`** — Passes the entire Y.Doc rather than a specific fragment. This is a deliberate choice:

When you pass `document: ydoc` without specifying `field`, the Collaboration extension internally calls `ydoc.getXmlFragment("default")`. This creates a shared type named `"default"` of type `Y.XmlFragment`. Meanwhile, the backend seeds the document with `get_or_insert_text("content")` (a `Y.Text` named `"content"`). These are **two separate named shared types** in the same Y.Doc — they do not conflict:

```
Y.Doc
├── "title"   → Y.Text      (used by title input)
├── "content"  → Y.Text      (seeded by backend POST, unused by Tiptap)
└── "default"  → Y.XmlFragment (created by Collaboration extension, used by Tiptap)
```

The alternative — `fragment: ydoc.getXmlFragment("content")` — would conflict with the backend's `Y.Text("content")` and throw:

```
Error: Type with the name "content" has already been defined with a different constructor
```

This error occurs because when the server's initial state arrives via WebSocket, `Y.applyUpdate()` populates the doc with `"content"` as `Y.Text`. If the frontend has already called `getXmlFragment("content")`, the type is locked as `XmlFragment`, and the incoming `Y.Text` data causes a conflict.

By using `"default"` (via `document: ydoc`), the editor gets its own clean `XmlFragment` that never collides with the backend's `"content"` field. The downside is that content seeded via `POST /api/notes { content: "..." }` goes into `Y.Text("content")`, not `Y.XmlFragment("default")`, so it won't appear in the Tiptap editor. This is acceptable — see [Known Limitations](#9-known-limitations).

**`CollaborationCaret.configure({ provider })`** — The caret extension expects a provider object with a public `.awareness` property. Our `WebSocketProvider` exposes `readonly awareness: Awareness` (line 18 of `WebSocketProvider.ts`), which satisfies this contract.

#### Why no separate CollabTitle component

The integration doc proposed a `CollabTitle.vue` component. In practice, the title input is ~5 lines of template code in `NoteEdit.vue`:

```vue
<InputText
  :model-value="titleText"
  @update:model-value="updateTitle"
  placeholder="Title"
  fluid
/>
```

Both `titleText` and `updateTitle` come directly from `useCollaboration()`. A separate component would add a file, prop drilling (`yTitle`, `modelValue`, emit), and an import — all for wrapping a single `<InputText>`. Inlining it in `NoteEdit` is simpler.

If the title ever needs rich-text editing, a collaborative title bar, or complex UI (character count, validation), extracting it into a component at that point makes sense.

---

## 4. Rewritten Components

### 4a. NoteEdit.vue

The central orchestrator: creates the collaboration session, renders the title input and editor, provides a Close button.

#### Before (current)

```vue
<script setup lang="ts">
import Card from '@/volt/Card.vue';
import Button from '@/volt/Button.vue';
import InputText from '@/volt/InputText.vue';
import Textarea from '@/volt/Textarea.vue';
import { useEditStore } from '@/stores/editStore';
import { useConfirm } from 'primevue/useconfirm';

const confirm = useConfirm();
const editStore = useEditStore();

const emit = defineEmits<{ cancel: [] }>();

function handleCancel() {
  if (editStore.isDirty) {
    confirm.require({ /* unsaved changes dialog */ });
  } else {
    emit('cancel');
  }
}
</script>

<template>
  <Card pt:root:class="card-document">
    <template #title>New Note</template>
    <template #content>
      <InputText v-model="editStore.draftTitle" placeholder="Title" fluid />
      <Textarea v-model="editStore.draftContent" placeholder="Content..." />
      <Button label="Cancel" @click="handleCancel" />
      <Button label="Save" @click="editStore.save" />
    </template>
  </Card>
</template>
```

**Issues:**
- Uses `editStore` (Pinia singleton) — lifecycle mismatch, no real-time sync
- `<Textarea>` for content — plain text, no rich formatting
- Save button → REST PUT — but no PUT endpoint exists on the backend
- Unsaved-changes dialog — irrelevant with CRDT auto-sync
- Static "New Note" title — doesn't show the note's actual title

#### After

```vue
<script setup lang="ts">
import Card from "@/volt/Card.vue";
import Button from "@/volt/Button.vue";
import InputText from "@/volt/InputText.vue";
import CollabEditor from "./CollabEditor.vue";
import { useCollaboration } from "@/composables/useCollaboration";

const props = defineProps<{
  noteId: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const {
  ydoc,
  provider,
  titleText,
  isConnected,
  connectedUsers,
  updateTitle,
} = useCollaboration(props.noteId);
</script>

<template>
  <Card pt:root:class="card-document">
    <template #title>
      <InputText
        :model-value="titleText"
        @update:model-value="updateTitle"
        placeholder="Title"
        fluid
      />
    </template>
    <template #content>
      <div class="flex flex-col gap-4 h-full">
        <CollabEditor
          :ydoc="ydoc"
          :provider="provider"
        />
        <div class="flex items-center justify-between">
          <span v-if="connectedUsers > 1" class="text-sm text-gray-500">
            {{ connectedUsers }} users editing
          </span>
          <Button label="Close" severity="secondary" text @click="emit('close')" />
        </div>
      </div>
    </template>
  </Card>
</template>
```

#### Structural comparison

```
NoteEdit.vue (before)                NoteEdit.vue (after)
├── editStore (Pinia singleton)      ├── useCollaboration(noteId)
│   ├── draftTitle: ref("")          │   ├── titleText (from Y.Text observe)
│   ├── draftContent: ref("")        │   ├── ydoc (Y.Doc with XmlFragment)
│   ├── isDirty: computed            │   ├── provider (WebSocketProvider)
│   └── save() → REST PUT           │   └── updateTitle() → Y.Text transact
│                                    │
├── <InputText v-model>              ├── <InputText :model-value @update>
├── <Textarea v-model>               ├── <CollabEditor :ydoc :provider>
├── <Button "Save">                  └── <Button "Close">
└── <Button "Cancel">
```

**Key differences:**

| Aspect | Before | After |
|---|---|---|
| Data source | `editStore.draftTitle` / `draftContent` (strings in Pinia) | `titleText` (reactive mirror of `Y.Text`) + `Y.XmlFragment` in Tiptap |
| Persistence | Manual Save → REST PUT | Automatic — every keystroke syncs via WebSocket |
| Dirty tracking | `isDirty` computed (string comparison) | None — CRDT is always in sync |
| Cancel/Close | Unsaved-changes confirmation dialog | Just close — nothing to lose |
| Content editing | `<Textarea>` (plain text) | `<CollabEditor>` (rich text via Tiptap) |
| Multi-user | Not supported | Cursor carets + user count badge |

### 4b. NoteDisplay.vue

Shows a read-only preview of a note. Uses `title_preview` and `content_preview` from the REST API — no WebSocket, no Tiptap.

#### Before (current)

```vue
<script setup lang="ts">
import Card from '@/volt/Card.vue';
import { useEditStore } from '@/stores/editStore';

const editStore = useEditStore();
</script>

<template>
  <Card pt:root:class="card-document">
    <template #title>{{ editStore.draftTitle }}</template>
    <template #content>
      <pre class="document-body">{{ editStore.draftContent }}</pre>
    </template>
  </Card>
</template>
```

**Issues:**
- Reads from `editStore` — displays the draft, not the persisted note
- Ignores the `:note` prop passed from `NotesView.vue`
- Shows `editStore.draftContent` which is whatever the last watched `selectedNote` had

#### After

```vue
<script setup lang="ts">
import Card from "@/volt/Card.vue";
import Button from "@/volt/Button.vue";
import type { Note } from "@/types";

defineProps<{
  note: Note;
}>();

const emit = defineEmits<{
  edit: [];
}>();
</script>

<template>
  <Card pt:root:class="card-document">
    <template #title>
      <div class="flex items-center justify-between">
        <span>{{ note.title_preview || "Untitled" }}</span>
        <Button label="Edit" severity="secondary" text @click="emit('edit')" />
      </div>
    </template>
    <template #content>
      <div class="h-full flex flex-col min-h-0">
        <pre class="document-body flex-1 overflow-auto">{{ note.content_preview || "" }}</pre>
      </div>
    </template>
  </Card>
</template>
```

**What changed:**
- Accepts `note: Note` prop — reads `title_preview` and `content_preview` directly
- No store dependency — pure presentational component
- Emits `edit` event — parent toggles to `NoteEdit`
- Shows "Untitled" fallback for notes with no `title_preview`

### 4c. NotesView.vue

The parent view holding the sidebar and main content area. The biggest rewrite.

#### Problems with the current implementation

1. **`showEditForm` starts as `true`** — shows an editor on page load even with no note selected.

2. **Both `NoteEdit` and `NoteDisplay` render simultaneously** — when a note is selected, `noteStore.selectedNote` is truthy, so both `v-if="noteStore.selectedNote || showEditForm"` (NoteEdit) and `v-if="noteStore.selectedNote"` (NoteDisplay) are true. The user sees both the edit form and the display card stacked.

3. **Type mismatches** — `optionLabel="title"` but `NoteSummary` has `title_preview`. `confirmDelete(slotProps.option.id)` passes a UUID string but `confirmDelete` accepts `number`. `Listbox` `dataKey="id"` works, but the rest of the template assumes the old `Note` shape.

4. **No way to enter edit mode** — selecting a note shows `NoteDisplay`, but there's no "Edit" button to switch to `NoteEdit`.

#### After

```vue
<script setup lang="ts">
import { ref, watch, onMounted, onServerPrefetch } from "vue";
import Listbox from "@/volt/Listbox.vue";
import Button from "@/volt/Button.vue";
import SidebarLayout from "@/components/layouts/SidebarLayout.vue";
import ClientOnly from "@/components/ClientOnly.vue";
import NoteEdit from "@/components/notes/NoteEdit.vue";
import NoteDisplay from "@/components/notes/NoteDisplay.vue";
import { useConfirm } from "primevue/useconfirm";
import TimesIcon from "@primevue/icons/times";
import { useNoteStore } from "@/stores/noteStore";

const noteStore = useNoteStore();
const confirm = useConfirm();

const editMode = ref(false);

// Reset to display mode when the selected note changes
watch(() => noteStore.selectedNote, () => {
  editMode.value = false;
});

async function handleCreate() {
  await noteStore.createNote();
  editMode.value = true;
}

function handleCloseEditor() {
  editMode.value = false;
}

function handleEdit() {
  editMode.value = true;
}

function confirmDelete(id: string) {
  confirm.require({
    message: "Are you sure you want to delete this note?",
    header: "Confirm Deletion",
    icon: "pi pi-trash",
    acceptProps: { label: "Delete", severity: "danger" },
    rejectProps: { label: "Cancel", severity: "secondary" },
    accept: () => {
      noteStore.deleteNote(id);
    },
  });
}

onMounted(() => {
  if (noteStore.notesCount === 0) noteStore.fetchNotes();
});

onServerPrefetch(async () => {
  if (noteStore.notesCount === 0) await noteStore.fetchNotes();
});
</script>

<template>
  <SidebarLayout>
    <template #sidebar>
      <div class="flex items-center justify-between mb-4">
        <h2 class="section-title !mb-0">Notes</h2>
        <Button label="+" text rounded @click="handleCreate" />
      </div>
      <p v-if="noteStore.error" class="error-text">{{ noteStore.error }}</p>
      <div v-if="noteStore.isLoading" class="text-center text-gray-500">
        Loading notes...
      </div>
      <Listbox
        v-else
        v-model="noteStore.selectedNote"
        :options="noteStore.notes"
        optionLabel="title_preview"
        dataKey="id"
      >
        <template #option="slotProps">
          <div class="flex items-center justify-between w-full group/item">
            <span>{{ slotProps.option.title_preview || "Untitled" }}</span>
            <Button
              severity="danger"
              text
              rounded
              size="small"
              class="opacity-0 group-hover/item:opacity-100 transition-opacity"
              @click.stop="confirmDelete(slotProps.option.id)"
            >
              <TimesIcon class="w-2.5 h-2.5" />
            </Button>
          </div>
        </template>
      </Listbox>
    </template>

    <!-- Edit mode: collaborative editor (client-only) -->
    <ClientOnly v-if="noteStore.selectedNote && editMode">
      <NoteEdit
        :key="noteStore.selectedNote.id"
        :note-id="noteStore.selectedNote.id"
        @close="handleCloseEditor"
      />
      <template #fallback>
        <div class="text-center text-gray-500 py-8">Loading editor...</div>
      </template>
    </ClientOnly>

    <!-- Display mode: read-only preview -->
    <NoteDisplay
      v-else-if="noteStore.selectedNote && !editMode"
      :note="noteStore.selectedNote"
      @edit="handleEdit"
    />

    <!-- No note selected -->
    <div v-else-if="!noteStore.isLoading" class="empty-state">
      Select a note or create a new one
    </div>
  </SidebarLayout>
</template>
```

#### The editMode toggle pattern

The core state machine is simple:

```
                  select note
  [nothing] ─────────────────────▶ [display mode]
                                       │    ▲
                               "Edit"  │    │  "Close"
                                       ▼    │
                                   [edit mode]

  "+" button ──▶ createNote() ──▶ [edit mode]
                 (POST, select)
```

Implementation:

- `editMode = ref(false)` — starts in display mode
- `watch(selectedNote) → editMode = false` — switching notes resets to display
- `NoteDisplay @edit → editMode = true` — user clicks "Edit"
- `NoteEdit @close → editMode = false` — user clicks "Close"
- `handleCreate() → createNote() + editMode = true` — new note opens in editor

#### Why `v-if` + `:key` instead of `v-show`

`v-if` **mounts and unmounts** the component. `v-show` only toggles CSS `display`. The distinction matters for `useCollaboration`:

- **`v-if`**: When `editMode` becomes false, `NoteEdit` unmounts → `onUnmounted` fires → WebSocket disconnects, Y.Doc is destroyed. Clean lifecycle.
- **`v-show`**: `NoteEdit` stays mounted forever. The WebSocket stays open even when the user is just reading. Wasted bandwidth, stale state.

The `:key="noteStore.selectedNote.id"` binding is a safety net. If the selected note changes while `editMode` is true (unlikely but possible via rapid clicks), Vue destroys the old `NoteEdit` and creates a new one with the new note ID, giving `useCollaboration` a fresh Y.Doc.

```
Without :key                         With :key="note.id"
───────────                          ──────────────────
Note A selected, editMode=true       Same
NoteEdit mounted, connected to A     Same

Note B selected (editMode stays)     Note B selected
watch fires: editMode = false        Vue sees key changed: "A" → "B"
NoteEdit unmounts (v-if=false)       Old NoteEdit unmounts → cleanup
NoteDisplay shows                    New NoteEdit mounts → fresh Y.Doc
                                     (watch also fires editMode=false,
                                      but :key handles it first)
```

#### New-note flow

The "+" button now does two things atomically:

```
handleCreate()
  │
  ├── await noteStore.createNote()
  │     └── POST /api/notes → response: { id, title_preview, ... }
  │     └── notes.push(newNote)
  │     └── selectedNote = newNote
  │
  └── editMode = true
        └── NoteEdit mounts with newNote.id
              └── useCollaboration connects WebSocket
                    └── Server sends initial doc state
                          └── Editor ready for typing
```

The `createNote()` in the updated noteStore takes no arguments — it creates a blank note. The user types the title and content directly in the collaborative editor.

---

## 5. Store Changes

### 5a. noteStore — update types, remove `editNote()`

```typescript
// src/stores/noteStore.ts — changes summary

// 1. Import updated Note type (UUID id, title_preview, content_preview)
import type { Note } from "@/types";

// 2. createNote() — no arguments, returns blank note
async function createNote() {
  error.value = null;
  isLoading.value = true;
  try {
    const response = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),  // empty body — blank note
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const note: Note = await response.json();
    notes.value.push(note);
    selectedNote.value = note;
  } catch (catchError) {
    const errorMsg = catchError instanceof Error ? catchError.message : "Create failed";
    error.value = errorMsg;
  } finally {
    isLoading.value = false;
  }
}

// 3. deleteNote() — id is now string (UUID)
async function deleteNote(id: string) {
  // ... same logic, but id: string instead of id: number
}

// 4. REMOVE editNote() entirely — no PUT endpoint, edits go through WebSocket

// 5. Update computed properties to use new field names
const getNoteTitles = computed(() =>
  notes.value.map((note) => note.title_preview || "Untitled")
);

function searchNotes(query: string) {
  const q = query.toLowerCase();
  return notes.value.filter(
    (note) =>
      (note.title_preview || "").toLowerCase().includes(q) ||
      (note.content_preview || "").toLowerCase().includes(q),
  );
}
```

**Methods removed:** `editNote()` — this did `PUT /api/notes/${id}`, but no PUT endpoint exists. All document editing goes through the WebSocket sync channel.

**Methods kept:** `fetchNotes()`, `createNote()` (signature changed), `deleteNote()` (id type changed), `searchNotes()` (field names updated).

### 5b. editStore — delete

```
DELETE src/stores/editStore.ts
```

Every consumer of `editStore` is rewritten in Step 3:
- `NoteEdit.vue` → uses `useCollaboration()` instead
- `NoteDisplay.vue` → uses the `note` prop instead
- No other file imports it

---

## 6. Type Changes

```typescript
// src/types.ts — updated to match backend NoteSummary

export interface Note {
  id: string;                        // UUID from backend
  title_preview: string | null;      // nullable — new notes have no title
  content_preview: string | null;    // nullable — new notes have no content
  created_at: string;                // ISO 8601 datetime
  updated_at: string;                // ISO 8601 datetime
}
```

**Why `string | null` instead of `string`:** The backend's `NoteSummary` has `Option<String>` for both preview fields. A freshly created note has `null` for both. Using `string | null` matches the wire format exactly and avoids silent bugs from assuming a note always has a title.

**Why `created_at` / `updated_at` as `string`:** JSON doesn't have a Date type. The backend serializes `DateTime<Utc>` as an ISO 8601 string. The frontend can parse it with `new Date(note.created_at)` when needed for display, but the stored type should match what comes off the wire.

---

## 7. CSS — Editor and Collaboration Styles

Tiptap renders into a `<div class="tiptap ProseMirror">` element that needs base styling. The collaboration carets need color styles for remote user cursors.

Add to the app's global styles or a scoped stylesheet:

```css
/* Tiptap editor base styles */
.tiptap-editor .tiptap {
  outline: none;
  padding: 1rem;
  min-height: 200px;
  flex: 1;
  overflow-y: auto;
}

.tiptap-editor .tiptap p {
  margin: 0.5em 0;
}

.tiptap-editor .tiptap h1,
.tiptap-editor .tiptap h2,
.tiptap-editor .tiptap h3 {
  margin-top: 1em;
  margin-bottom: 0.5em;
}

/* Placeholder text (from @tiptap/extension-placeholder) */
.tiptap-editor .tiptap p.is-editor-empty:first-child::before {
  color: #adb5bd;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

/* Collaboration caret — remote user cursor */
.collaboration-cursor__caret {
  border-left: 1px solid #0d0d0d;
  border-right: 1px solid #0d0d0d;
  margin-left: -1px;
  margin-right: -1px;
  pointer-events: none;
  position: relative;
  word-break: normal;
}

/* Collaboration caret — username label */
.collaboration-cursor__label {
  border-radius: 3px 3px 3px 0;
  color: #fff;
  font-size: 12px;
  font-style: normal;
  font-weight: 600;
  left: -1px;
  line-height: normal;
  padding: 0.1rem 0.3rem;
  position: absolute;
  top: -1.4em;
  user-select: none;
  white-space: nowrap;
}
```

The caret color is set dynamically by the `CollaborationCaret` extension using the `user.color` value. The `border-left` and `background` on the label are set inline by the extension.

---

## 8. Data Flow Diagrams

### 8a. Create a new note

```
User clicks "+"
      │
      ▼
NotesView: handleCreate()
      │
      ├── noteStore.createNote()
      │     │
      │     ├── POST /api/notes {}
      │     │         │
      │     │         ▼
      │     │   Backend: creates yrs Doc with
      │     │   Y.Text("title") + Y.Text("content") (empty)
      │     │   Inserts into PostgreSQL
      │     │   Returns { id: "uuid", title_preview: null, ... }
      │     │
      │     ├── notes.push(newNote)
      │     └── selectedNote = newNote
      │
      └── editMode = true
            │
            ▼
      ClientOnly renders NoteEdit (client-side only)
            │
            ▼
      NoteEdit: useCollaboration("uuid")
            │
            ├── new Y.Doc()
            ├── ydoc.getText("title")     ← Y.Text for title
            ├── new Awareness(ydoc)
            ├── new WebSocketProvider({ noteId: "uuid", doc, awareness })
            └── provider.connect()
                  │
                  ▼
            WebSocket opens: /api/notes/uuid/sync
                  │
                  ▼
            Server sends initial state (empty doc)
                  │
                  ▼
            Tiptap editor ready — user starts typing
```

### 8b. Open an existing note

```
User clicks note "Meeting Notes" in sidebar
      │
      ▼
Listbox v-model updates noteStore.selectedNote
      │
      ├── watch fires → editMode = false
      │
      ▼
NoteDisplay renders:
      title_preview: "Meeting Notes"
      content_preview: "Agenda for today..."
      [Edit] button visible
      │
      ▼
User clicks [Edit]
      │
      ▼
NoteDisplay emits "edit" → editMode = true
      │
      ▼
ClientOnly renders NoteEdit(:key="uuid")
      │
      ▼
NoteEdit: useCollaboration("uuid")
      │
      ├── WebSocket opens → server sends full doc state
      │
      ├── Y.applyUpdate(doc, state, "remote")
      │     ├── yTitle: "Meeting Notes"
      │     │     └── observe() → titleText = "Meeting Notes"
      │     │           └── InputText shows "Meeting Notes"
      │     │
      │     └── XmlFragment("default") populated by Tiptap
      │           └── Editor renders rich content
      │
      └── Awareness update → caret positions rendered
```

### 8c. Edit the title

```
User types "Q2 Planning" in the title InputText
      │
      ▼
@update:model-value → updateTitle("Q2 Planning")
      │
      ▼
ydoc.transact(() => {
  yTitle.delete(0, yTitle.length);
  yTitle.insert(0, "Q2 Planning");
})
      │
      ├── Y.Doc "update" event fires
      │     │
      │     ▼
      │   WebSocketProvider.handleDocUpdate()
      │     │
      │     ▼
      │   WS send: [0x00][update bytes]
      │     │
      │     ▼
      │   Server: applies to yrs Doc, persists, broadcasts
      │     │
      │     ▼
      │   Other clients: receive → Y.applyUpdate → yTitle.observe()
      │                    → their titleText updates → their input rerenders
      │
      └── yTitle.observe() fires locally
            │
            ▼
      titleText.value = "Q2 Planning"
            │
            ▼
      InputText :model-value updates (Vue reactivity)
```

### 8d. Close the editor

```
User clicks [Close]
      │
      ▼
NoteEdit emits "close"
      │
      ▼
NotesView: handleCloseEditor() → editMode = false
      │
      ├── v-if becomes false → NoteEdit unmounts
      │     │
      │     ▼
      │   onUnmounted() in useCollaboration
      │     │
      │     ├── provider.disconnect()
      │     │     ├── shouldReconnect = false
      │     │     ├── doc.off("update", ...)
      │     │     ├── awareness.off("update", ...)
      │     │     └── ws.close()
      │     │           │
      │     │           ▼
      │     │     Server: removes client from room
      │     │     Server: broadcasts awareness removal
      │     │     Server: if last client → room destroyed
      │     │
      │     └── ydoc.destroy()
      │           └── All shared types freed from memory
      │
      └── NoteDisplay renders with title_preview / content_preview
            (from the selectedNote in noteStore — REST data, no WebSocket)
```

**Note:** The sidebar `title_preview` is **stale** after editing — it still shows whatever the last `GET /api/notes` returned. See [Known Limitations](#sidebar-title-staleness).

---

## 9. Known Limitations

### Sidebar title staleness

After editing a note's title in the collaborative editor, the sidebar still shows the old `title_preview` from the last REST `GET /api/notes` response. The Yjs title changes go through the WebSocket, not the REST API, so the sidebar's `noteStore.notes` array is out of date.

**Impact:** The sidebar says "Untitled" while the editor shows "Q2 Planning". Refreshing the page fetches fresh data.

**Possible fixes (not in Step 3 scope):**
- Update `noteStore.notes[i].title_preview` when `titleText` changes (requires passing a callback or watching the composable's `titleText` from `NotesView`)
- Refetch `GET /api/notes` after closing the editor
- Backend pushes preview updates via a separate channel

### Content seeding mismatch

The `POST /api/notes` backend creates a `Y.Text("content")` field (line 54 of `notes.rs`). The Tiptap `Collaboration` extension uses `Y.XmlFragment("default")`. These are different shared types in the same Y.Doc:

```
Y.Doc after POST + WebSocket connect:
├── "title"    → Y.Text("Q2 Planning")    ← visible in title input
├── "content"  → Y.Text("initial text")   ← from POST body, NOT visible in Tiptap
└── "default"  → Y.XmlFragment()          ← empty, this is what Tiptap uses
```

Content passed to `POST /api/notes { content: "initial text" }` is stored in `Y.Text("content")`, but Tiptap reads from `Y.XmlFragment("default")`. The seeded content is invisible in the editor.

**Impact:** If `createNote()` sends a `content` field, that text is persisted but never shown. Since Step 3 creates blank notes (empty POST body), this doesn't matter in practice.

**Fix (Step 1a — backend):** Change `get_or_insert_text("content")` to `get_or_insert_xml_fragment("content")` in `notes.rs:54`, then configure Tiptap with `field: "content"` instead of relying on `"default"`. This is the Step 1a backend change described in the implementation plan. After that fix, `Collaboration.configure({ document: ydoc, field: "content" })` will work because both sides use `XmlFragment`.

### Anonymous users

The `CollaborationCaret` extension is configured with a hardcoded user:

```typescript
user: {
  name: "Anonymous",
  color: "#958DF1",
}
```

All users appear as "Anonymous" with the same color. When authentication is implemented, replace this with the actual username and an assigned color.

### No offline support

If the WebSocket disconnects (network loss), local edits are kept in the Y.Doc (Yjs retains them in memory). On reconnect, the provider sends the full local state. However, if the user closes the tab while disconnected, unsaved local edits are lost — there's no IndexedDB persistence layer.

**Possible fix:** Add `y-indexeddb` to persist the Y.Doc locally. This is out of scope for Step 3.

---

## Appendix: File Dependency Order

Changes should be applied in this order to avoid intermediate type errors:

1. `src/types.ts` — new `Note` interface (everything depends on this)
2. `src/collaboration/WebSocketProvider.ts` — `noteId: string`
3. `src/composables/useCollaboration.ts` — refactored signature
4. `src/stores/noteStore.ts` — updated types, removed `editNote()`
5. `src/components/ClientOnly.vue` — new file, no dependencies
6. `src/components/notes/CollabEditor.vue` — new file, depends on WebSocketProvider
7. `src/components/notes/NoteDisplay.vue` — rewritten, depends on Note type
8. `src/components/notes/NoteEdit.vue` — rewritten, depends on useCollaboration + CollabEditor
9. `src/views/NotesView.vue` — rewritten, depends on all above
10. Delete `src/stores/editStore.ts`
11. Delete `src/components/notes/NoteCreateForm.vue`
