# NotesView Reactivity Flow

How the sidebar Listbox and main Card are connected through Vue's reactivity system.

## Component Structure

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { notes, type Note } from '@/data/notes';

const selectedNote = ref<Note>(notes[0]!);
</script>
```

## 1. The Reactive State

```typescript
const selectedNote = ref<Note>(notes[0]!);
//    └── reactive container holding ONE note object
```

This creates a "box" that Vue watches. When its value changes, Vue re-renders anything that uses it.

## 2. Listbox → selectedNote (v-model)

```vue
<Listbox
  v-model="selectedNote"      ← two-way binding
  :options="notes"            ← all 3 notes for display
  optionLabel="title"         ← show note.title in list
/>
```

`v-model` is shorthand for:

```vue
<Listbox
  :modelValue="selectedNote"                  ← reads current value
  @update:modelValue="selectedNote = $event"  ← writes new value on click
  :options="notes"
/>
```

When user clicks "Project Ideas":
1. Listbox emits `update:modelValue` with the clicked Note object
2. Vue sets `selectedNote.value = { id: '2', title: 'Project Ideas', ... }`

## 3. selectedNote → Card (reactivity)

```vue
<Card>
  <template #title>{{ selectedNote.title }}</template>
  <template #content>
    <pre>{{ selectedNote.content }}</pre>
  </template>
</Card>
```

Vue tracks that this Card template **depends on** `selectedNote`. When `selectedNote` changes, Vue automatically re-renders the Card.

## 4. Step-by-Step Flow

### Initial State

```
┌────────────────────────────────────────────────────────────┐
│  selectedNote.value = { id:'1', title:'Meeting Notes'...}  │
└────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐           ┌─────────────────────┐
│ Listbox         │           │ Card                │
│ ● Meeting Notes │ ◄─────────│ Title: Meeting Notes│
│ ○ Project Ideas │  selected │ Content: # Meeting..│
│ ○ Shopping List │           └─────────────────────┘
└─────────────────┘
```

### User Clicks "Project Ideas"

```
┌─────────────────┐
│ Listbox emits   │
│ update:modelValue
│ with notes[1]   │
└────────┬────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────┐
│  selectedNote.value = { id:'2', title:'Project Ideas'...}  │
│                        ▲                                   │
│                        │ Vue detects change                │
└────────────────────────┼───────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
┌─────────────────┐           ┌─────────────────────┐
│ Listbox         │           │ Card (re-rendered)  │
│ ○ Meeting Notes │           │ Title: Project Ideas│
│ ● Project Ideas │ ◄─────────│ Content: # Project..│
│ ○ Shopping List │  selected └─────────────────────┘
└─────────────────┘
```

## 5. Shared Reactive Reference

Both components read from the **same** reactive ref:

```
                    ┌──────────────────┐
                    │  selectedNote    │
                    │  (ref<Note>)     │
                    └────────┬─────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
       ┌─────────────┐              ┌─────────────┐
       │  Listbox    │              │    Card     │
       │  writes ✏️   │              │   reads 👁️  │
       │  & reads 👁️ │              │             │
       └─────────────┘              └─────────────┘
```

- **Listbox**: Both reads (to show selection) and writes (on click)
- **Card**: Only reads

Vue's dependency tracking ensures both stay synchronized automatically.

## Data Source

The notes come from `@/data/notes.ts`:

```typescript
export interface Note {
  id: string;
  title: string;
  content: string;
}

export const notes: Note[] = [
  { id: '1', title: 'Meeting Notes', content: '...' },
  { id: '2', title: 'Project Ideas', content: '...' },
  { id: '3', title: 'Shopping List', content: '...' }
];
```

This is static data (SSR-safe - no browser APIs, `Date.now()`, or `Math.random()`).
