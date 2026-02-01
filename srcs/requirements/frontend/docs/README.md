# Frontend Documentation

## Dev Guides

### Vue + Volt UI (`dev/vue/`)

| File | Description |
|------|-------------|
| [vue-volt-setup.md](dev/vue/vue-volt-setup.md) | **Project setup & workflow.** Tailwind v4, PrimeVue unstyled mode, Volt CLI (`npx volt-vue add`), CSS variables, SSR entry points. Step-by-step view development: scaffold → state → logic → feedback. |
| [vue-volt-patterns.md](dev/vue/vue-volt-patterns.md) | **Vue 3.5 features & architecture.** `useTemplateRef()`, reactive props destructuring, `useId()`, `onWatcherCleanup()`, lazy hydration. Pinia setup stores, feature-based folder structure, Fastify SSR integration, Vitest testing. |

### Styling (`dev/`)

| File | Description |
|------|-------------|
| [tailwind-class-strategies.md](dev/tailwind-class-strategies.md) | **5 strategies for managing Tailwind classes.** `@apply` for pt props, layout wrappers, `@layer components`, JS variables, custom components. Decision tree for when to use each. |

### Devlog (`dev/devlog/`)

| Date | Summary |
|------|---------|
| [2026-02-01](dev/devlog/2026-02-01-notes-view-master-detail.md) | NotesView master-detail layout with Volt UI. Tailwind refactor: `SidebarLayout.vue` wrapper, `@layer components` for semantic classes. |

---

## Reference

### Component Examples (`components/`)

Reference implementations for common UI patterns:

| Component | Purpose |
|-----------|---------|
| `SideBar.vue` | Navigation sidebar with folders |
| `NoteCard.vue` | Note preview card |
| `NoteListItem.vue` | Sidebar list item |
| `WorkspaceTabs.vue` | Tab navigation |
| `VersionDropDownMenu.vue` | Dropdown with version history |

### Claude Code Config (`claude/`)

[README](claude/README.md) — Symlinks to Claude Code configuration:
- `frontend-claude.md` → Architectural rules (Vue 3.5, Volt, SSR)
- `settings.local.json` → Project settings (permissions, MCP servers)
- `vue-volt-ssr.md` → Skill definition

---

## Quick Links

**Setup new view:**
1. `npx volt-vue add Card Button InputText` — get components
2. Read [vue-volt-setup.md](dev/vue/vue-volt-setup.md) — workflow guide

**Clean up Tailwind classes:**
1. Read [tailwind-class-strategies.md](dev/tailwind-class-strategies.md) — pick strategy
2. See devlog for real example

**Vue 3.5 patterns:**
1. Read [vue-volt-patterns.md](dev/vue/vue-volt-patterns.md) — `useTemplateRef`, `useId`, etc.
