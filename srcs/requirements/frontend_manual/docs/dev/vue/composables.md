# Vue 3 Composables

## The Problem: Repeating Yourself

Imagine you have three different components that all need a counter with increment/decrement buttons. Without composables, you'd copy-paste the same logic into each component:

```vue
<!-- Component A -->
<script setup>
const count = ref(0);
function increment() { count.value++; }
function decrement() { count.value--; }
</script>

<!-- Component B — same code again! -->
<script setup>
const count = ref(0);
function increment() { count.value++; }
function decrement() { count.value--; }
</script>
```

This violates the DRY principle (Don't Repeat Yourself). If you need to change the logic, you'd have to update every component.

## The Solution: Composables

A **composable** is a function that packages up reusable logic. Think of it like a recipe:

- You define the ingredients (state) and steps (functions) once
- Any component can use the recipe by calling the function
- Each component gets its own independent copy of the state

```
┌─────────────────────────────────────┐
│  useCounter() — the "recipe"        │
│  ─────────────────────────────────  │
│  Ingredients:                       │
│    - count (starts at 0)            │
│    - doubled (computed from count)  │
│  Steps:                             │
│    - increment()                    │
│    - decrement()                    │
└─────────────────────────────────────┘
         │
         ├──→ Component A gets its own count
         ├──→ Component B gets its own count
         └──→ Component C gets its own count
```

## Your First Composable

### Step 1: Create the file

Composables live in `src/composables/` and are named `use*.ts`:

```typescript
// src/composables/useCounter.ts
import { ref, computed } from 'vue';

export function useCounter(startValue = 0) {
  // 1. Create reactive state
  const count = ref(startValue);

  // 2. Create computed values (automatically update)
  const doubled = computed(() => count.value * 2);

  // 3. Create functions to modify state
  function increment() {
    count.value++;
  }

  function decrement() {
    count.value--;
  }

  // 4. Return what components need
  return { count, doubled, increment, decrement };
}
```

### Step 2: Use it in a component

```vue
<script setup lang="ts">
import { useCounter } from '@/composables/useCounter';

// Call the function to get your own counter
const { count, doubled, increment, decrement } = useCounter(10);
</script>

<template>
  <p>Count: {{ count }} (doubled: {{ doubled }})</p>
  <button @click="decrement">-</button>
  <button @click="increment">+</button>
</template>
```

That's it! The component now has a fully working counter without defining any logic itself.

## Why "use" Prefix?

The `use` prefix is a convention that tells developers:

- "This is a composable, not a regular function"
- "It uses Vue's reactivity system"
- "Call it inside `<script setup>`"

Examples: `useCounter`, `useNotesApi`, `useLocalStorage`, `useMousePosition`

## Real Example: Fetching Data

Let's build something practical — a composable that fetches notes from an API.

### The Problem

Without a composable, your component becomes cluttered:

```vue
<script setup>
const notes = ref([]);
const loading = ref(false);
const error = ref(null);

async function fetchNotes() {
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch('/api/notes');
    notes.value = await response.json();
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

onMounted(() => fetchNotes());
</script>
```

If another component also needs notes, you'd copy all of this.

### The Solution

Extract it into a composable:

```typescript
// src/composables/useNotesApi.ts
import { ref, readonly } from 'vue';

export function useNotesApi() {
  const notes = ref([]);
  const loading = ref(false);
  const error = ref(null);

  async function fetchNotes() {
    loading.value = true;
    error.value = null;
    try {
      const response = await fetch('/api/notes');
      notes.value = await response.json();
    } catch (e) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  }

  return {
    notes: readonly(notes),    // readonly = can't be changed from outside
    loading: readonly(loading),
    error: readonly(error),
    fetchNotes,                // function to trigger the fetch
  };
}
```

Now your component is clean:

```vue
<script setup>
import { onMounted } from 'vue';
import { useNotesApi } from '@/composables/useNotesApi';

const { notes, loading, error, fetchNotes } = useNotesApi();

onMounted(() => fetchNotes());
</script>

<template>
  <p v-if="loading">Loading...</p>
  <p v-else-if="error">Error: {{ error }}</p>
  <ul v-else>
    <li v-for="note in notes" :key="note.id">{{ note.title }}</li>
  </ul>
</template>
```

## What is `readonly()`?

When you return state from a composable, you can wrap it in `readonly()`:

```typescript
return {
  notes: readonly(notes),  // Other code can READ but not WRITE
  fetchNotes,              // Use this function to modify notes
};
```

This is like giving someone a view-only copy of a document. They can see it, but they can't edit it directly. To make changes, they must use the functions you provide (`fetchNotes`, `createNote`, etc.).

**Why bother?** It prevents bugs. If a component could directly modify `notes`, you might lose track of what's changing your data.

## SSR Safety (Important!)

If your app uses server-side rendering (SSR), there's one critical rule:

**Never access browser-only things (like `window` or `fetch`) at the top level.**

The server doesn't have `window` — it will crash.

```typescript
// WRONG — runs immediately, crashes on server
export function useBrowserSize() {
  const width = ref(window.innerWidth);  // window doesn't exist on server!
  return { width };
}

// CORRECT — only runs on client
export function useBrowserSize() {
  const width = ref(0);  // Safe default

  onMounted(() => {
    // onMounted only runs in the browser
    width.value = window.innerWidth;
  });

  return { width };
}
```

For API calls, always trigger them in `onMounted()`:

```vue
<script setup>
const { notes, fetchNotes } = useNotesApi();

// This only runs in the browser, after the page loads
onMounted(() => fetchNotes());
</script>
```

## Composables vs Pinia Stores

You might wonder: "Why not just use Pinia for everything?"

| Question | Composable | Pinia Store |
|----------|------------|-------------|
| Is the data shared globally? | No — each component gets its own copy | Yes — one copy for the whole app |
| Example use case | Notes for this view | Logged-in user info |
| Setup required | Just create the function | Register the store |

**Rule of thumb:**
- Start with composables (simpler)
- Use Pinia when multiple unrelated components need the same data (user auth, shopping cart, theme)

## Common Patterns

### Toggle (on/off state)

```typescript
export function useToggle(initial = false) {
  const isOn = ref(initial);

  function toggle() {
    isOn.value = !isOn.value;
  }

  function setOn() { isOn.value = true; }
  function setOff() { isOn.value = false; }

  return { isOn, toggle, setOn, setOff };
}
```

### Local Storage (persisted state)

```typescript
export function useLocalStorage(key: string, defaultValue: string) {
  const stored = localStorage.getItem(key);
  const value = ref(stored ?? defaultValue);

  // Save to localStorage whenever value changes
  watch(value, (newVal) => {
    localStorage.setItem(key, newVal);
  });

  return value;
}
```

## Quick Reference

```
src/composables/
├── useCounter.ts      # Simple state + functions
├── useNotesApi.ts     # API fetching
├── useToggle.ts       # Boolean toggle
└── useLocalStorage.ts # Persisted state
```

**Composable structure:**
1. Create reactive state with `ref()` or `reactive()`
2. Create computed values with `computed()`
3. Create functions to modify state
4. Return what components need (wrap state in `readonly()` if desired)

## See Also

- [Vue 3.5 Patterns](./vue-volt-patterns.md) — Full stack patterns including SSR
- [Pinia Documentation](https://pinia.vuejs.org/) — When to use stores instead
- [VueUse](https://vueuse.org/) — 200+ ready-made composables
