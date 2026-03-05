## How to run these ts files:

- `pnpm init`
- `pnpm add typescript`
- `pnpm exec tsc --init`
- `pnpm add -D @types/node`
- add  `"dev": "pnpm exec tsc"` to package.json scripts
- run `node <filename.js>`

```ts
{
"compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "esnext",
    "types": ["node"],
    "outDir": "./dist",
	}
}
```


# 📜 The 9 Koans of Argon2
*A guide to modern password hashing and the defense of the digital gate.*

### 1. The One-Way Path (Hashing vs. Encryption)
Hashing is a one-way transformation. Unlike encryption, there is no "key" to turn a hash back into a password. To check a password, you must re-hash the user's attempt and compare it to the stored "dust."

### 2. The Unique Snowflake (The Salt)
Every password must be hashed with a unique, random string called a **Salt**. This ensures that even if two users have the same password (e.g., "123456"), their hashes in the database will look completely different.

### 3. The Rainbow Trap (Anti-Precomputation)
By using unique salts, we defeat "Rainbow Tables"—massive lists of pre-calculated hashes. A thief cannot use a "cheat sheet" to crack your database; they must perform the heavy work for every single account individually.

### 4. The Price of Entry (Memory-Hardness)
Argon2 is designed to fill a specific amount of RAM (`memoryCost`). This "Memory-Hardness" makes it incredibly expensive and slow for hackers using massive GPU clusters to guess passwords at high speeds.

### 5. The Many Hands (Parallelism)
Argon2 can utilize multiple CPU cores (`parallelism`) to compute a hash. For the best performance, this setting should be tuned to match the actual hardware or container limits of your microservice.

### 6. The Hybrid (Argon2id)
We use the **Argon2id** variant. It is a hybrid that provides protection against "Side-Channel" timing attacks (the 'i' strategy) and "GPU/ASIC" brute-force attacks (the 'd' strategy).

### 7. The Front-End Mirage (The Replay Risk)
Hashing on the client (browser) is an illusion. If the server accepts a hash as the "secret," then that hash effectively *is* the password. Always send raw passwords over a secure tunnel (HTTPS) and hash them on the server.

### 8. The Verification Ritual (The `verify` Function)
Never use a simple string comparison (`===`) to check passwords. The `argon2.verify()` function is required to safely extract the salt and parameters from a stored string and perform a "constant-time" comparison.

### 9. The Upgrading Wall (NeedsRehash)
Security standards must evolve as hardware gets faster. Use `argon2.needsRehash()` during the login process to silently upgrade a user's old, weak hash to modern, stronger settings without interrupting their experience.
