
import {defineConfig} from "drizzle-kit";
import * as dotenv from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import {resolve} from "path"

// ensure correct .env path location (works on host)
dotenv.config({ path: resolve(__dirname, "../../.env") });

const user = process.env.AUTH_DB_USER as string;

// Resolve the secret path mapping both for host and container
let auth_pass = "";
const containerSecret = "/run/secrets/auth_db_password";
const hostSecret = resolve(__dirname, "../../secrets/auth_db_password");

if (existsSync(containerSecret)) {
  auth_pass = readFileSync(containerSecret, 'utf8').trim();
} else if (existsSync(hostSecret)) {
  auth_pass = readFileSync(hostSecret, 'utf8').trim();
}

const host = process.env.POSTGRES_SERVICE as string;
const db_name = process.env.AUTH_DB_NAME as string;

const databaseUrl = `postgres://${user}:${auth_pass}@${host}/${db_name}`;

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl!,
  },
});
