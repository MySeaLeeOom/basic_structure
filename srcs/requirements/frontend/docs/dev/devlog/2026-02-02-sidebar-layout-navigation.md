# SidebarLayout & Navigation

**Date:** 2026-02-02
**Branch:** `vue-notes-view`

## Overview

Apply consistent SidebarLayout to all views and add header navigation. Demonstrates the "add feature once, all views get it" benefit of layout wrapper components.

## Changes

### 1. SidebarLayout Applied to All Views

Previously only NotesView used SidebarLayout. Now core views share the same layout:

| View | Sidebar Content |
|------|-----------------|
| HomeView | Dashboard placeholder |
| NotesView | Notes list + create button |

**Benefit:** Any enhancement to SidebarLayout (collapse toggle, resize, keyboard shortcuts) now applies to all views automatically.

### 2. Header Navigation

Added nav links to Header component using RouterLink:

```
┌─────────────────────────────────────────────────────────┐
│  Mycelium              [Home] [Notes]                   │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Active route highlighting (primary color + background)
- Hover states for light/dark modes
- Data-driven `navItems` array for easy maintenance

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/views/HomeView.vue` | Modify | Wrap content in SidebarLayout |
| `src/components/Header.vue` | Modify | Add RouterLink navigation |

## Layout Wrapper vs @apply Discussion

This work demonstrates when Layout Wrapper wins over Tailwind @apply:

### Scenario 1: Different sidebar widths per view

```vue
<!-- SidebarLayout.vue prop -->
<aside :style="{ width: sidebarWidth ?? '16rem' }">

<!-- Usage -->
<SidebarLayout sidebar-width="24rem">
```

One prop vs multiple CSS classes (`.sidebar-narrow`, `.sidebar-wide`, etc.)

### Scenario 2: Add collapse button to all sidebars

```vue
<!-- SidebarLayout.vue - add once -->
<button @click="collapsed = !collapsed">Toggle</button>
<slot v-if="!collapsed" name="sidebar" />
```

All views get the feature automatically. With @apply, you'd copy-paste the button and logic to every view.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Header.vue (nav links)                                 │
├─────────────────────────────────────────────────────────┤
│  SidebarLayout.vue                                      │
│  ┌──────────────┬──────────────────────────────────────┐│
│  │ #sidebar     │ default slot                         ││
│  │              │                                      ││
│  │ (per-view)   │ (per-view content)                   ││
│  └──────────────┴──────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

## Related Devlogs

- [Notes View Master-Detail](./2026-02-01-notes-view-master-detail.md) - Initial scaffold & Tailwind extraction
- [Notes API Integration](./2026-02-01-notes-api-integration.md) - API integration & create form

## Future Enhancements

- [ ] Sidebar collapse toggle (add to SidebarLayout, all views get it)
- [ ] Persist collapsed state to localStorage
- [ ] Keyboard shortcut (Ctrl+[) for collapse
- [ ] Mobile responsive sidebar (drawer mode)
