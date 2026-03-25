# Tailwind Class Management Strategies

Comparison of 5 strategies for managing Tailwind classes in Vue + PrimeVue/Volt applications.

## Quick Reference

| Strategy | Best For | Use When |
|----------|----------|----------|
| `@apply` in CSS | PrimeVue `pt` props | Long utility strings in component props |
| Layout Wrappers | Structural layouts | Sidebar/main, dashboard grids |
| `@layer components` | Global design system | Buttons, inputs, cards used everywhere |
| JS Variables | One-off complex props | Quick cleanup, no new files |
| Custom Components | Reusable UI elements | Semantic components with logic |

---

## Strategy 1: `@apply` in CSS

Extract utility classes into semantic CSS classes.

**Best for:** PrimeVue `pt` props (deep customization)

**Pros:**
- Keeps HTML clean
- Easy to read class names
- IDE support for CSS

**Cons:**
- Breaks "utility-first" workflow
- Forces you to invent class names

**Example:**

```css
/* src/assets/base.css */
@layer components {
  .listbox-borderless {
    @apply border-0 shadow-none bg-transparent;
  }
}
```

```vue
<Listbox pt:root:class="listbox-borderless" />
```

**Verdict:** Highly recommended for PrimeVue. A CSS class is much easier to pass than a 100-character `pt` string.

---

## Strategy 2: Layout Wrapper Components

Extract repeated layout divs into reusable components.

**Best for:** Structural layouts (sidebars, dashboards, grids)

**Why use it:**

| Without | With `SidebarLayout` |
|---------|----------------------|
| Repeat 10+ classes per view | Write once, reuse |
| Dark mode logic everywhere | Handled in component |
| Change sidebar width = edit every view | Change in one file |

**1. Repeat classes vs write once:**
```vue
<!-- ❌ NotesView.vue, SettingsView.vue, UsersView.vue all have: -->
<aside class="shrink-0 w-64 bg-surface-50 border-r border-surface-200 p-4">

<!-- ✅ All three just use: -->
<SidebarLayout>
```

**2. Dark mode logic everywhere vs handled in component:**
```vue
<!-- ❌ Every view needs both light AND dark classes: -->
<aside class="bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-700">

<!-- ✅ SidebarLayout handles it internally, views don't care: -->
<SidebarLayout>
```

**3. Change width = edit every view vs one file:**
```vue
<!-- ❌ Designer says "make sidebar 20rem" → edit 5 files: -->
<!-- NotesView.vue: --> <aside class="w-64 ...">  <!-- change to w-80 -->
<!-- SettingsView.vue: --> <aside class="w-64 ...">  <!-- change to w-80 -->
<!-- UsersView.vue: --> <aside class="w-64 ...">  <!-- change to w-80 -->

<!-- ✅ Just edit SidebarLayout.vue once: -->
:style="{ width: sidebarWidth ?? '20rem' }"
```

**Example from NotesView:**

```vue
<!-- ❌ Without: copy-paste this to every view with a sidebar -->
<div class="flex h-[calc(100vh-60px)]">
  <aside class="shrink-0 w-64 bg-surface-50 dark:bg-surface-800 border-r p-4">
    <Listbox :options="notes" />
  </aside>
  <main class="flex-1 overflow-auto">
    <Card>{{ selectedNote.content }}</Card>
  </main>
</div>

<!-- ✅ With: clean and semantic -->
<SidebarLayout>
  <template #sidebar>
    <Listbox :options="notes" />
  </template>
  <Card>{{ selectedNote.content }}</Card>
</SidebarLayout>
```

**Why not other strategies for layouts?**

Other strategies only extract **classes**. Layout wrappers extract **structure**.

---

**Scenario 1: Different sidebar widths per view**

NotesView needs narrow sidebar (16rem), SettingsView needs wide sidebar (24rem).

With @apply:
```css
/* base.css - create multiple classes */
.sidebar-narrow { @apply w-64; }
.sidebar-wide { @apply w-96; }
```
```vue
<!-- NotesView.vue -->
<aside class="sidebar-narrow">...</aside>

<!-- SettingsView.vue -->
<aside class="sidebar-wide">...</aside>
```

With Layout Wrapper:
```vue
<!-- SidebarLayout.vue - add a prop -->
<aside :style="{ width: sidebarWidth ?? '16rem' }">
  <slot name="sidebar" />
</aside>
```
```vue
<!-- NotesView.vue - default width -->
<SidebarLayout>...</SidebarLayout>

<!-- SettingsView.vue - custom width -->
<SidebarLayout sidebar-width="24rem">...</SidebarLayout>
```

✅ Layout Wrapper: one prop vs multiple CSS classes.

---

**Scenario 2: Add a collapse button to all sidebars**

With @apply:
```vue
<!-- NotesView.vue - add button -->
<aside class="sidebar">
  <button @click="collapsed = !collapsed">Toggle</button>
  <Listbox v-if="!collapsed" />
</aside>

<!-- SettingsView.vue - add same button -->
<aside class="sidebar">
  <button @click="collapsed = !collapsed">Toggle</button>
  <SettingsMenu v-if="!collapsed" />
</aside>

<!-- UsersView.vue - add same button -->
<!-- ... repeat for every view -->
```

With Layout Wrapper:
```vue
<!-- SidebarLayout.vue - add once -->
<aside>
  <button @click="collapsed = !collapsed">Toggle</button>
  <slot v-if="!collapsed" name="sidebar" />
</aside>
```
```vue
<!-- All views get it automatically, no changes needed -->
<SidebarLayout>
  <template #sidebar><Listbox /></template>
</SidebarLayout>
```

✅ Layout Wrapper: add feature once, all views get it.

---

**Scenario 3: Wrap main content in a scrollable container**

With JS Variables:
```vue
<!-- NotesView.vue -->
<main :class="mainClasses">
  <div class="overflow-auto h-full">  <!-- add wrapper -->
    <Card />
  </div>
</main>

<!-- SettingsView.vue - add same wrapper -->
<!-- UsersView.vue - add same wrapper -->
```

With Layout Wrapper:
```vue
<!-- SidebarLayout.vue - add once -->
<main>
  <div class="overflow-auto h-full">
    <slot />
  </div>
</main>
```
```vue
<!-- Views unchanged -->
<SidebarLayout>
  <template #sidebar>...</template>
  <Card />
</SidebarLayout>
```

✅ Layout Wrapper: change structure once, applies everywhere.

**Verdict:** Use for any layout repeated across views. NotesView, SettingsView, UsersView can all share `SidebarLayout`.

---

## Strategy 3: `@layer components`

Create global classes that Tailwind understands as components.

**Best for:** Global design systems (buttons, inputs, form elements)

**Pros:**
- Allows utility overrides: `btn bg-red-500` works (utility wins)
- Consistent design system
- Single source of truth

**Cons:**
- Requires global CSS setup
- Can lead to naming conflicts
- Increases bundle size if overused

**Example:**

```css
@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-primary-500 text-white rounded-lg
           hover:bg-primary-600 transition-colors;
  }
}
```

```vue
<button class="btn-primary">Submit</button>
<button class="btn-primary bg-red-500">Delete</button> <!-- Override works -->
```

**Verdict:** Use for truly global elements. Overkill for view-specific styles.

---

## Strategy 4: JS Variables

Store class strings in script setup variables.

**Best for:** One-off complex props, quick refactors

**Pros:**
- Fastest cleanup - no new files
- Keeps styles near logic
- Cleans up template immediately

**Cons:**
- Styles live in JS (weird separation)
- No IDE autocomplete for Tailwind in strings
- Not reusable outside component

**Example:**

```vue
<script setup lang="ts">
const sidebarClasses = 'w-64 shrink-0 bg-surface-50 dark:bg-surface-800 border-r border-surface-200 p-4';
const cardClasses = 'w-full max-w-3xl min-h-[800px]';
</script>

<template>
  <aside :class="sidebarClasses">...</aside>
  <Card :pt:root:class="cardClasses">...</Card>
</template>
```

**Verdict:** Great for quick cleanup. Use when you don't want to create files but need readability.

---

## Strategy 5: Custom Components

Create Vue components that encapsulate styling.

**Best for:** Reusable UI elements with semantic meaning

**Pros:**
- The "Vue Way" - fully encapsulated
- Can include logic, props, slots
- Self-documenting

**Cons:**
- High friction - new file per component
- Risk of "component explosion" (`BlueText.vue`, `BoldHeader.vue`)

**Example:**

```vue
<!-- src/components/SectionTitle.vue -->
<template>
  <h2 class="text-xs font-semibold uppercase tracking-wider text-surface-500 mb-3">
    <slot />
  </h2>
</template>
```

```vue
<SectionTitle>Notes</SectionTitle>
```

**Verdict:** Good for components with *logical meaning*. Avoid for pure styling wrappers.

---

## Decision Tree

```
Need to style a PrimeVue `pt` prop?
  └─→ Use @apply (#1)

Building a page layout (sidebar, grid, dashboard)?
  └─→ Use Layout Wrapper (#2)

Creating a button/input used across 10+ views?
  └─→ Use @layer components (#3)

Quick one-off cleanup, no time for files?
  └─→ Use JS Variables (#4)

Component has logic + styling + reuse potential?
  └─→ Use Custom Component (#5)
```

---

## Recommended Hybrid Approach

For Vue + Volt UI projects, combine strategies:

1. **Layout Wrappers** for page structure
2. **`@apply`** for PrimeVue `pt` prop overrides
3. **`@layer components`** sparingly for global design tokens

This keeps views focused on content while maintaining clean, readable templates.
