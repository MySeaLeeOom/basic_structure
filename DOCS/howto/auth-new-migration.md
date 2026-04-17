# How to Update the Auth Database Schema

This guide covers the end-to-end process for making a schema change in the auth service — adding a column, creating a table, adding an enum value, etc.

---

## Step-by-step: making an initial drizzle migration file

This is a one-time process — only needed when the `drizzle/` folder does not exist yet (i.e. a fresh checkout or a new service).

### Step 1 — Write `src/db/schema.ts`

Define all your tables, enums, and constraints in TypeScript. This file is the source of truth. See the **"making a schema change"** section below for syntax examples.

### Step 2 — Run the generator

```bash
cd srcs/requirements/auth
pnpm run db:generate
```

Because no previous snapshot exists, `drizzle-kit` treats the entire `schema.ts` as the initial state and creates:

```
drizzle/
  0000_<random-tag>.sql     ← the full CREATE TABLE / CREATE TYPE SQL
  meta/
    _journal.json           ← records which migrations have been applied
    0000_snapshot.json      ← snapshot of the schema at this point in time
```

The random tag (e.g. `0000_lean_flatman`) is cosmetic — the index `0000` is what matters.

### Step 4 — Read the generated SQL

Open `drizzle/0000_*.sql` and verify every table and enum matches your intent. This is plain SQL — there is no magic.

### Step 5 — Commit all three files

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat(auth-db): initial drizzle schema and migration"
```

Commit the `drizzle/meta/` folder too — without it, Drizzle loses track of which migrations have run and will regenerate everything from scratch.

---


## Step-by-step: making a schema change

### Step 1 — Edit `src/db/schema.ts`

Make your change in TypeScript. Examples:

**Adding a column to an existing table:**
```ts
export const users = pgTable("users", {
    // ... existing columns ...
    twoFactorEnabled: boolean("two_factor_enabled").default(false),  // new
});
```

**Adding a new table:**
```ts
export const passwordResets = pgTable("password_resets", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    token: uuid("token").defaultRandom().unique().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
});
```

**Adding a value to an existing enum:**
```ts
export const providerEnum = pgEnum("provider_type", ["github", "local", "google", "42", "discord"]);
```

> ⚠️ Removing enum values or renaming columns is destructive. Drizzle will generate the correct SQL but think carefully about whether existing data will be affected.

### Step 2 — Generate the migration file

From inside the `auth/` directory:

```bash
cd srcs/requirements/auth
pnpm run db:generate
```

This runs `drizzle-kit generate`. It will:
- Compare `schema.ts` against the last snapshot in `drizzle/meta/`
- Print a summary of detected changes
- Write a new SQL file to `drizzle/` (e.g. `0001_my_change.sql`)
- Update `drizzle/meta/_journal.json` and the snapshot

**Read the generated SQL before committing.** It is plain SQL — verify it matches your intent.

### Step 3 — Commit both files

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat(auth-db): add two_factor_enabled column to users"
```

Both the schema change and the generated migration file must be committed together. The migration file is not a build artifact — it is part of the source of truth.

### Step 4 — Apply it

On next container startup (e.g. `make re` or `make up`), `migrate()` will detect the new file and run it automatically. You will see in the logs:

```
Checking for pending migrations...
Database is in sync.
```

If you want to apply it without restarting the whole stack, you can run:

```bash
# from inside the auth container or with a direct DB connection
pnpm run db:push
```

> ⚠️ `db:push` bypasses the migration system entirely and pushes schema changes directly. It does **not** create a migration file. Use it only during local prototyping — never on a shared or production DB, and never as a substitute for `db:generate`.

---

## How the system works

The auth service manages its database through **Drizzle ORM**. There are three moving parts:

### 1. The schema — `src/db/schema.ts`

This is the **source of truth**. Every table, column, enum, and constraint is defined here in TypeScript. You never write SQL by hand to change the structure — you change this file.

```
src/db/schema.ts     ← you edit this
     ↓
drizzle-kit generate ← you run this
     ↓
drizzle/0001_xxx.sql ← generated SQL migration file (commit this)
     ↓
server startup       ← migrate() applies it automatically
```

### 2. The migration files — `drizzle/`

`drizzle-kit generate` compares your updated `schema.ts` against the previously generated snapshots and produces a new `.sql` file. These files are **append-only** — never delete or edit them. Each file represents one state transition of the database.

Currently there is one migration:
- `drizzle/0000_lean_flatman.sql` — the initial schema (users, accounts, sessions tables + enums)

When you add a migration it becomes `0001_something.sql`, then `0002_something.sql`, etc.

### 3. The migration runner — `src/app.ts`

On every startup, `buildServer()` calls Drizzle's `migrate()`:

```ts
// src/app.ts lines 68–83
if (config.runMigrations !== false) {
    try {
        server.log.info("Checking for pending migrations...");
        await migrate(db, { migrationsFolder: "./drizzle" });
        server.log.info("Database is in sync.");
    } catch (err) {
        server.log.error("Migration failed! Refusing to start.");
        server.log.error(err);
        if (process.env.NODE_ENV !== "test") {
            process.exit(1);   // ← hard stop in production if migration fails
        }
    }
}
```

`migrate()` looks at the `drizzle/meta/_journal.json` file to know which migrations have already been applied. It only runs the ones that are new. If the database is already up to date, it does nothing.

---

## The `runMigrations` toggle AUTOMATICALLY UPDATE DB

`runMigrations` is a field on the `AppConfig` interface:

```ts
// src/app.ts
export interface AppConfig {
    databaseUrl: string;
    // ...
    runMigrations?: boolean;   // ← optional, defaults to true
}
```

It is set in two places:

**`src/index.ts` (production entry point):**
```ts
return {
    databaseUrl: databaseUrl,
    // ...
    runMigrations: true,       // ← always runs migrations on container startup
};
```

**Test suite:**
```ts
// Tests pass runMigrations: false to skip migration overhead
// and rely on the test DB already being set up
```

The `process.exit(1)` guard inside the catch block means: if a migration fails in production (e.g. a SQL conflict, DB unreachable), the server **refuses to start** rather than running against a stale schema. This is intentional — a mismatch between code and DB is worse than downtime.

---

## `drizzle.config.ts` — what it does

```ts
// srcs/requirements/auth/drizzle.config.ts
export default defineConfig({
    out: "./drizzle",           // where migration files are written
    schema: "./src/db/schema.ts", // where drizzle-kit reads the schema from
    dialect: "postgresql",
    dbCredentials: {
        url: databaseUrl!,      // same connection string the server uses
    },
});
```

`drizzle-kit` (the CLI) reads this file when you run `db:generate` or `db:push`. It needs live DB access to introspect the current state — make sure the DB container is running when you run these commands.

---

## Common mistakes

| Mistake | Consequence |
|---|---|
| Editing a generated `.sql` file directly | Drizzle's snapshot and the file go out of sync — future generates will be wrong |
| Running `db:push` instead of `db:generate` on a shared DB | Schema changes are applied but no migration file exists — other devs' DBs diverge |
| Not committing the `drizzle/meta/` folder | The journal is lost, Drizzle re-generates all migrations from scratch |
| Removing an enum value without a data migration | Existing rows with that value cause a DB error on startup |
