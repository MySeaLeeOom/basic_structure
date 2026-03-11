# Developer Guide

## Common Pitfalls

### 1. Stale Docker Volumes (The "Ghost in the Machine")

When we change service names, update configuration, or modify how `node_modules` are handled, Docker often **reuses** old volumes instead of creating new ones. This leads to weird bugs like:
- "Module not found" errors even after you `npm install`.
- Old code running even after you changed files.
- Configuration changes not taking effect.

**Solution: The Deep Clean**

If things act weird, your first step should be to purge the volumes. We have added specific Make commands for this.

*   **`make clean-frontend`**:
    *   **Use when**: Nuxt is acting up, or you changed `nuxt.config.ts` and it's not picking up, or `node_modules` seem broken.
    *   **What it does**: Deletes ONLY the `.nuxt`, `.output`, and frontend `node_modules` volumes.
    *   **Safety**: ✅ SAFE. It does NOT touch your Database.

*   **`make fclean`** (Full Clean):
    *   **Use when**: You want to reset the entire project to a "Fresh Clone" state.
    *   **What it does**: Deletes **EVERYTHING**, including the **Postgres Database** and **Auth Users**.
    *   **Safety**: ⚠️ DESTRUCTIVE. You will lose all data.

### 2. Permissions on Linux/Mac

If you see `EACCES` or permission denied errors, it's usually because files created inside the container (by `root`) are not editable by you (uid `1000` or `501`).

*   **Fix**: Run `make getuser` or just `make up` (which runs `getuser` automatically). This sets your local UID/GID in the `.env` file, and the containers use this to map permissions correctly.
