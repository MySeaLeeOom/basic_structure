# Vue 3.5 SSR MVP with Volt UI

## Critical Architectural Rules

### Vue 3.5 Native Patterns
- **Template Refs:** Use `useTemplateRef<Type>('name')`, NOT `ref(null)`
- **Props:** Destructure `defineProps` directly (stable in 3.5+)
- **IDs:** Use `useId()` for form label accessibility
- **Watchers:** Use `onWatcherCleanup()` for AbortController cleanup

### Volt UI & Tailwind v4
- Check `@/volt/` before suggesting external components
- If missing: instruct user to run `npx volt-vue add [Component]`
- Use `pt:root:class` for per-instance styling, NOT `class`
- Theme via CSS variables in `src/assets/main.css`

### SSR Safety (Fastify)
- NEVER access `window`/`document` at script-setup top-level
- Wrap browser APIs in `onMounted()` or `<ClientOnly>`
- Avoid `Date.now()`, `Math.random()` in templates

## Build Commands
- Dev: `pnpm run dev`
- Build: `pnpm run build`
- Prod: `pnpm run start`

## File Structure
- Views: `src/views/*.vue`
- Components: `src/components/*.vue`
- Volt UI: `src/volt/*.vue` (when installed)
- SSR entries: `src/entry-client.ts`, `src/entry-server.ts`
