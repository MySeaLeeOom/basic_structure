# Claude Code Configuration

This directory contains symlinks to all Claude Code configuration files for the frontend project.

## Files Overview

| Symlink | Target | Purpose |
|---------|--------|---------|
| `frontend-claude.md` | `../../CLAUDE.md` | Main frontend architectural rules |
| `settings.local.json` | `../../.claude/settings.local.json` | Claude Code project settings |
| `vue-volt-ssr.md` | `~/.claude/skills/vue-volt-ssr/SKILL.md` | Vue 3.5 + Volt UI skill |

## Configuration Summary

### Frontend CLAUDE.md
Establishes architectural rules for Vue 3.5 + Volt UI + Fastify SSR:

- **Vue 3.5 Patterns**: `useTemplateRef()`, `useId()`, `onWatcherCleanup()`
- **Volt UI**: Check `@/volt/` first, use `pt:root:class` for styling
- **SSR Safety**: No `window`/`document` at top-level, wrap in `onMounted()`

### settings.local.json
Project-specific Claude Code settings:

- **MCP Servers**: `chrome-webdriver` enabled for E2E testing
- **permissions.deny**: Prevents Claude from reading (uses correct syntax):
  ```json
  "permissions": {
    "deny": [
      "Read(dist/**)",
      "Read(node_modules/**)",
      "Read(.vite/**)",
      "Read(pnpm-lock.yaml)"
    ]
  }
  ```

### vue-volt-ssr Skill
Enhanced with Vue 3.5 specific patterns:

- `useTemplateRef<T>('name')` - Type-safe template refs
- `onWatcherCleanup()` - AbortController cleanup in watchers
- `useId()` - SSR-safe unique IDs for form accessibility

## Usage

Invoke the skill with `/vue-volt-ssr` when:
- Creating Vue views or components
- Working with Volt UI components
- Building forms with validation
- Fixing SSR hydration issues

## Changelog

### 2025-02-01
- Created `frontend/CLAUDE.md` with Vue 3.5 + Volt UI + SSR rules
- Updated `.claude/settings.local.json` with `permissions.deny` rules
- Enhanced `vue-volt-ssr` skill with Vue 3.5 patterns:
  - `useTemplateRef` example
  - `onWatcherCleanup` for fetch abort
  - `useId` for form accessibility
