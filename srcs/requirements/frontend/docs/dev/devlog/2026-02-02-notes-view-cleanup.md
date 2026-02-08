# NotesView Cleanup & Listbox Fix

**Date:** 2026-02-02
**Branch:** `vue-notes-view`

## Overview

Simplify NotesView by using standard v-model and extract inline Tailwind classes to base.css. Fix Volt Listbox selected state text visibility.

## Changes

### 1. Simplified Listbox v-model

Previously used manual modelValue/update pattern to prevent deselection:

```vue
<!-- Before -->
<Listbox
  :modelValue="selectedNote"
  @update:modelValue="(val: Note) => val && (selectedNote = val)"
  ...
/>

<!-- After -->
<Listbox v-model="selectedNote" ... />
```

Now allows deselection (clicking selected note sets `selectedNote = null`). The empty state UI handles this gracefully.

### 2. Extract Inline Classes to @layer components

Moved repeated utility patterns to `base.css`:

```css
.error-text {
  @apply text-red-500 text-sm;
}

.empty-state {
  @apply p-8 text-center text-muted-color;
}
```

### 3. Fix Volt Listbox Selected Text Color

**Problem:** Selected items in dark mode had dark text on highlight background, making them unreadable.

**Fix:** Added `p-selected:text-surface-0` to force white text when selected:

```diff
- p-selected:bg-highlight p-selected:p-focus:bg-highlight-emphasis
+ p-selected:bg-highlight p-selected:text-surface-0 p-selected:p-focus:bg-highlight-emphasis
```

### 4. Removed Redundant Button Styling

Removed `pt:root:class` from add button - PrimeVue's `text` + `rounded` props already provide minimal styling.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/views/NotesView.vue` | Modify | Simplify Listbox to v-model, use CSS classes |
| `src/assets/base.css` | Modify | Add error-text, empty-state classes |
| `src/volt/Listbox.vue` | Modify | Fix selected state text color |

## Related Devlogs

- [SidebarLayout & Navigation](./2026-02-02-sidebar-layout-navigation.md) - Layout applied to all views
