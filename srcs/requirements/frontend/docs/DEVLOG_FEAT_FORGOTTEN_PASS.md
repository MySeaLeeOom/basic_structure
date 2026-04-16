# DEVLOG — Forgot Password Feature

**Branch:** `frontendauth`
**Date:** 2026-04-13

---

## Overview

This feature adds a full "Forgot Password" flow to Mycelium Notes. It covers:

- A `POST /forgot-password` API endpoint that emails a time-limited reset link
- A `POST /reset-password` API endpoint that validates the token and updates the password
- Two new frontend pages: `/forgot-password` and `/reset-password`
- A "Forgot password?" link on the login page

Email delivery uses Gmail SMTP via `nodemailer`.

---

## Step 1 — Add the `password_reset_tokens` table to the DB schema

**File:** `srcs/requirements/auth/src/db/schema.ts`

A reset token needs to live somewhere in the database. We add a new table for it. The token itself is a 64-character hex string (32 random bytes), stored as plain text — it already has 256 bits of entropy so there is no need to hash it, just like the `sessions` table stores its UUID token directly.

Add this block after the `sessions` table definition:

```ts
export const passwordResetTokens = pgTable("password_reset_tokens", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
        .references(() => users.id, { onDelete: "cascade" })
        .notNull(),
    token: text("token").unique().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),              // null = not yet used
    createdAt: timestamp("created_at").defaultNow(),
});
```

Also add the exported type at the bottom of the file alongside the other types:

```ts
export type PasswordResetToken = InferSelectModel<typeof passwordResetTokens>;
```

---

## Step 2 — Generate the Drizzle migration

Drizzle does not auto-apply schema changes. You need to generate a migration SQL file first, then it gets applied automatically the next time the auth service starts.

Run this from the auth directory:

```bash
cd srcs/requirements/auth
npx drizzle-kit generate
```

This reads `schema.ts`, diffs it against the previous migration, and writes a new file to `drizzle/`. In our case it produced `drizzle/0001_numerous_fat_cobra.sql`:

```sql
CREATE TABLE "password_reset_tokens" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "token" text NOT NULL,
    "expires_at" timestamp NOT NULL,
    "used_at" timestamp,
    "created_at" timestamp DEFAULT now(),
    CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
```

You never edit this file manually. It runs automatically inside the container on next startup because `app.ts` calls `migrate(db, { migrationsFolder: "./drizzle" })`.

---

## Step 3 — Install nodemailer

`nodemailer` is the standard Node.js library for sending email over SMTP.

```bash
cd srcs/requirements/auth
pnpm add nodemailer
pnpm add -D @types/nodemailer
```

This updates `package.json` and `pnpm-lock.yaml`.

---

## Step 4 — Create the email utility

**New file:** `srcs/requirements/auth/src/lib/mailer.ts`

This file creates a single reusable nodemailer transporter and exports one function for sending reset emails. It reads SMTP credentials from environment variables at module load time.

```ts
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject: "Reset your Mycelium Notes password",
        text: `You requested a password reset.\n\nClick the link below to set a new password (valid for 1 hour):\n\n${resetLink}\n\nIf you did not request this, you can ignore this email.`,
        html: `
            <p>You requested a password reset.</p>
            <p>Click the link below to set a new password (valid for 1 hour):</p>
            <p><a href="${resetLink}">${resetLink}</a></p>
            <p>If you did not request this, you can ignore this email.</p>
        `,
    });
}
```

`secure: true` is only needed for port 465 (legacy SSL). Port 587 uses STARTTLS, which nodemailer handles automatically when `secure` is false.

---

## Step 5 — Create the password reset routes

**New file:** `srcs/requirements/auth/src/routes/passwordReset.ts`

This file contains both new API endpoints.

### POST /forgot-password

1. Receives `{ email }` in the body.
2. Looks up the user by email.
3. Checks they have a `local` provider account (OAuth-only users have no password to reset).
4. Generates a cryptographically random 64-char hex token.
5. Stores it in `password_reset_tokens` with a 1-hour expiry.
6. Emails the reset link to the user.
7. **Always returns the same generic success message** — whether the email exists or not. This is intentional: revealing whether an email is registered is a privacy/security leak.

### POST /reset-password

1. Receives `{ token, newPassword }`.
2. Looks up the token in the DB.
3. Rejects if: not found, already used (`usedAt` is set), or expired.
4. Hashes the new password with argon2.
5. Calls the existing `upsertAccount` helper to update (or create) the local account with the new hash.
6. Sets `usedAt = now()` so the token can never be reused.

```ts
import { eq, and } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import * as schema from "../db/schema";
import * as argon2 from "argon2";
import { upsertAccount } from "../lib/account_helpers";
import { sendPasswordResetEmail } from "../lib/mailer";

const ForgotPasswordSchema = Type.Object({
    email: Type.String({ format: "email" }),
});

const ResetPasswordSchema = Type.Object({
    token: Type.String({ minLength: 1 }),
    newPassword: Type.String({ minLength: 8 }),
});

const GENERIC_SUCCESS = "If an account with that email exists, a reset link has been sent.";
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export const passwordResetRoutes: FastifyPluginAsyncTypebox = async (server) => {

    server.post("/forgot-password", { schema: { body: ForgotPasswordSchema } }, async (request, reply) => {
        const { email } = request.body;

        const [user] = await server.db
            .select()
            .from(schema.users)
            .where(eq(schema.users.email, email))
            .limit(1);

        if (!user) return { message: GENERIC_SUCCESS };

        const [localAccount] = await server.db
            .select({ id: schema.accounts.id })
            .from(schema.accounts)
            .where(and(eq(schema.accounts.userId, user.id), eq(schema.accounts.provider, "local")))
            .limit(1);

        if (!localAccount) return { message: GENERIC_SUCCESS };

        const token = randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

        await server.db.insert(schema.passwordResetTokens).values({ userId: user.id, token, expiresAt });

        const websiteUrl = process.env.WEBSITE_URL ?? "https://localhost:8443";
        const resetLink = `${websiteUrl}/reset-password?token=${token}`;

        try {
            await sendPasswordResetEmail(email, resetLink);
        } catch (err) {
            server.log.error({ err }, "Failed to send password reset email");
        }

        return { message: GENERIC_SUCCESS };
    });

    server.post("/reset-password", { schema: { body: ResetPasswordSchema } }, async (request, reply) => {
        const { token, newPassword } = request.body;

        const [resetRecord] = await server.db
            .select()
            .from(schema.passwordResetTokens)
            .where(eq(schema.passwordResetTokens.token, token))
            .limit(1);

        if (!resetRecord)
            return reply.status(400).send({ error: "Invalid or expired reset token." });
        if (resetRecord.usedAt !== null)
            return reply.status(400).send({ error: "This reset link has already been used." });
        if (resetRecord.expiresAt < new Date())
            return reply.status(400).send({ error: "Invalid or expired reset token." });

        const [user] = await server.db
            .select()
            .from(schema.users)
            .where(eq(schema.users.id, resetRecord.userId))
            .limit(1);

        if (!user || !user.email)
            return reply.status(400).send({ error: "Invalid or expired reset token." });

        const newHash = await argon2.hash(newPassword);

        await upsertAccount(server, {
            userId: user.id,
            provider: "local",
            providerAccountId: user.loginName,
            passwordHash: newHash,
        });

        await server.db
            .update(schema.passwordResetTokens)
            .set({ usedAt: new Date() })
            .where(eq(schema.passwordResetTokens.id, resetRecord.id));

        return { message: "Password updated successfully." };
    });
};
```

---

## Step 6 — Register the routes in app.ts

**File:** `srcs/requirements/auth/src/app.ts`

Add the import at the top with the other route imports:

```ts
import { passwordResetRoutes } from "./routes/passwordReset";
```

Then register it alongside the other route plugins:

```ts
await server.register(authRoutes);
await server.register(sessionRoutes);
await server.register(userManagementRoutes);
await server.register(passwordResetRoutes);  // ← add this
```

---

## Step 7 — Add SMTP environment variables to docker-compose

**File:** `srcs/docker-compose.yml`

In the `auth` service's `environment` block, add:

```yaml
WEBSITE_URL: ${WEBSITE_URL}
SMTP_HOST: ${SMTP_HOST}
SMTP_PORT: ${SMTP_PORT}
SMTP_USER: ${SMTP_USER}
SMTP_PASS: ${SMTP_PASS}
SMTP_FROM: ${SMTP_FROM}
```

(`WEBSITE_URL` was already there — it's used to build the reset link.)

---

## Step 8 — Add SMTP credentials to .env

**File:** `srcs/.env`

Add these lines at the bottom and fill in your real values:

```
# SMTP (for password reset emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=youremail@gmail.com
SMTP_PASS=your16charapppassword
SMTP_FROM="Mycelium Notes <youremail@gmail.com>"
```

### Getting a Gmail App Password

You cannot use your regular Gmail password here. Google requires an App Password:

1. Enable **2-Step Verification** on your Google account at `myaccount.google.com → Security`
2. Go to `myaccount.google.com/apppasswords`
3. Enter an app name (e.g. `Mycelium Notes`) and click **Create**
4. Copy the 16-character code Google shows you — **remove the spaces** before pasting it into `.env`

The `SMTP_FROM` value must use the same address as `SMTP_USER`. Gmail rejects mismatches. The part in `"quotes"` is the display name shown in the recipient's inbox; the part in `<angle brackets>` is the actual sending address.

---

## Step 9 — Add "Forgot password?" link to the login page

**File:** `srcs/requirements/frontend/app/pages/Login.vue`

Inside the login tab panel, add a link below the Sign In button and above the "OR" divider:

```vue
<Button type="submit" :label="t('login.signin')" fluid />

<div class="text-center text-sm mt-1">
    <NuxtLink to="/forgot-password" class="text-primary hover:underline text-sm">
        {{ t('login.forgotPassword') }}
    </NuxtLink>
</div>

<div class="text-center text-sm text-gray-500 my-2">{{ t('login.or') }}</div>
```

---

## Step 10 — Create the ForgotPassword page

**New file:** `srcs/requirements/frontend/app/pages/ForgotPassword.vue`

This page shows an email form. On submit it always shows the generic success message (matches the backend's deliberate vagueness — we never confirm whether an email is registered).

```vue
<script setup lang="ts">
import { ref } from "vue";
import Card from "@/volt/Card.vue";
import Button from "@/volt/Button.vue";
import InputText from "@/volt/InputText.vue";
import { useUiI18n } from "~/composables/useUiI18n";

const { t } = useUiI18n();
const email = ref("");
const loading = ref(false);
const submitted = ref(false);

async function handleSubmit() {
    loading.value = true;
    try {
        await fetch("/api/auth/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email.value }),
        });
        submitted.value = true;
    } catch {
        submitted.value = true;
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <div class="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-900 p-4">
        <Card class="w-full max-w-md">
            <template #title>
                <div class="text-center text-2xl font-bold mb-4">{{ t('forgot.title') }}</div>
            </template>
            <template #content>
                <div v-if="submitted" class="flex flex-col gap-4">
                    <p class="text-center text-sm text-gray-600 dark:text-gray-400">
                        {{ t('forgot.success') }}
                    </p>
                    <NuxtLink to="/login" class="text-center text-primary hover:underline text-sm">
                        {{ t('login.tab.login') }}
                    </NuxtLink>
                </div>
                <form v-else class="flex flex-col gap-4" @submit.prevent="handleSubmit">
                    <InputText v-model="email" type="email" :placeholder="t('forgot.email')" fluid />
                    <Button type="submit" :label="t('forgot.submit')" :loading="loading" fluid />
                    <NuxtLink to="/login" class="text-center text-primary hover:underline text-sm">
                        {{ t('login.tab.login') }}
                    </NuxtLink>
                </form>
            </template>
        </Card>
    </div>
</template>
```

---

## Step 11 — Create the ResetPassword page

**New file:** `srcs/requirements/frontend/app/pages/ResetPassword.vue`

This page reads the `token` from the URL query string (`/reset-password?token=abc123...`), shows a new password + confirm form, and calls the reset endpoint. On success it redirects to `/login`.

```vue
<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import Card from "@/volt/Card.vue";
import Button from "@/volt/Button.vue";
import InputText from "@/volt/InputText.vue";
import { useUiI18n } from "~/composables/useUiI18n";

const { t } = useUiI18n();
const route = useRoute();
const router = useRouter();

const token = route.query.token as string;
const newPassword = ref("");
const confirmPassword = ref("");
const loading = ref(false);
const error = ref<string | null>(null);

async function handleSubmit() {
    error.value = null;
    if (newPassword.value !== confirmPassword.value) {
        error.value = t('reset.error.mismatch');
        return;
    }
    loading.value = true;
    try {
        const res = await fetch("/api/auth/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, newPassword: newPassword.value }),
        });
        const data = await res.json();
        if (!res.ok) {
            error.value = data.error ?? "Something went wrong.";
            return;
        }
        router.push({ path: "/login", query: { reset: "success" } });
    } catch {
        error.value = "Something went wrong. Please try again.";
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <div class="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-900 p-4">
        <Card class="w-full max-w-md">
            <template #title>
                <div class="text-center text-2xl font-bold mb-4">{{ t('reset.title') }}</div>
            </template>
            <template #content>
                <div v-if="!token" class="text-center text-red-500 text-sm">
                    Invalid reset link. Please request a new one.
                </div>
                <form v-else class="flex flex-col gap-4" @submit.prevent="handleSubmit">
                    <InputText v-model="newPassword" type="password" :placeholder="t('reset.newPassword')" fluid />
                    <InputText v-model="confirmPassword" type="password" :placeholder="t('reset.confirm')" fluid />
                    <Button type="submit" :label="t('reset.submit')" :loading="loading" fluid />
                </form>
                <div v-if="error" class="text-red-500 text-sm mt-4 text-center">{{ error }}</div>
            </template>
        </Card>
    </div>
</template>
```

---

## Step 12 — Add i18n translation keys

**Files:** all four locale files in `srcs/requirements/frontend/app/locales/`

Add these keys to each locale file. Shown here for English (`en-UK.json`) — translate accordingly for `de-DE.json`, `es-ES.json`, and `ar.json`:

```json
"login.forgotPassword": "Forgot password?",
"forgot.title": "Reset Password",
"forgot.email": "Email address",
"forgot.submit": "Send Reset Link",
"forgot.success": "If an account with that email exists, a reset link has been sent.",
"reset.title": "Set New Password",
"reset.newPassword": "New Password",
"reset.confirm": "Confirm Password",
"reset.submit": "Set Password",
"reset.success": "Password updated. You can now log in.",
"reset.error.mismatch": "Passwords do not match."
```

---

## Testing the full flow

1. `make re` to rebuild with the new migration and env vars
2. Go to the login page — confirm the "Forgot password?" link is visible
3. Click it, enter a test account email, submit
4. Check the Gmail inbox for the reset link
5. Click the link — confirm `/reset-password?token=...` loads
6. Enter a new password, submit — confirm redirect to `/login`
7. Log in with the new password — confirm it works
8. Try clicking the reset link again — confirm "already used" error
9. Manually set `expires_at` to the past in the DB, try the token — confirm "expired" error

---

## Bug fix — reset password didn't allow login afterwards

**File:** `srcs/requirements/auth/src/routes/passwordReset.ts`

After resetting, logging in with the new password failed with "Invalid credentials." The cause: the login route looks up the local account using `loginName` as the `providerAccountId`:

```ts
// auth.ts — login route
const account = await findAccount(server.db, "local", user.loginName);
```

Registration stores the local account with `providerAccountId = loginName` to match this. But the reset route was calling `upsertAccount` with `providerAccountId: user.email`, which overwrote the stored value. After reset, login could no longer find the account.

Fix — pass `loginName` instead of `email`, matching what registration does:

```ts
// before (wrong)
providerAccountId: user.email,

// after (correct)
providerAccountId: user.loginName,
```

---

## Bug fix — pages were inaccessible to logged-out users

**File:** `srcs/requirements/frontend/app/middleware/auth.global.ts`

After building the pages, clicking "Forgot password?" redirected straight back to `/login`. The cause: a global Nuxt middleware runs on every route change and redirects unauthenticated users away from any route not on an explicit whitelist.

The original whitelist:

```ts
const publicRoutes = ["/login", "/home", "/"];
```

Both `/forgot-password` and `/reset-password` need to be reachable without a session, so they were added:

```ts
const publicRoutes = ["/login", "/home", "/", "/forgot-password", "/reset-password"];
```

This is the right pattern for any future page that needs to be accessible before login.

---

## Files changed

| File | Type | Change |
|---|---|---|
| `srcs/requirements/auth/src/db/schema.ts` | Modified | Added `passwordResetTokens` table |
| `srcs/requirements/auth/drizzle/0001_numerous_fat_cobra.sql` | Created | Auto-generated migration |
| `srcs/requirements/auth/src/lib/mailer.ts` | Created | nodemailer transporter + send function |
| `srcs/requirements/auth/src/routes/passwordReset.ts` | Created | Two new API endpoints |
| `srcs/requirements/auth/src/app.ts` | Modified | Registered `passwordResetRoutes` |
| `srcs/requirements/auth/package.json` | Modified | Added `nodemailer` + `@types/nodemailer` |
| `srcs/docker-compose.yml` | Modified | Added SMTP env vars to auth service |
| `srcs/.env` | Modified | Added SMTP placeholder values |
| `srcs/requirements/frontend/app/pages/Login.vue` | Modified | Added "Forgot password?" link |
| `srcs/requirements/frontend/app/pages/ForgotPassword.vue` | Created | Forgot password form page |
| `srcs/requirements/frontend/app/pages/ResetPassword.vue` | Created | Set new password page |
| `srcs/requirements/frontend/app/locales/en-UK.json` | Modified | Added 11 i18n keys |
| `srcs/requirements/frontend/app/locales/de-DE.json` | Modified | Added 11 i18n keys |
| `srcs/requirements/frontend/app/locales/es-ES.json` | Modified | Added 11 i18n keys |
| `srcs/requirements/frontend/app/locales/ar.json` | Modified | Added 11 i18n keys |
| `srcs/requirements/frontend/app/middleware/auth.global.ts` | Modified | Added `/forgot-password` and `/reset-password` to public routes |
