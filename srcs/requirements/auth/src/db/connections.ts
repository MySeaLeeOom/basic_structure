import * as dotenv from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "path";

/*
Template for the stadard DATABASE URL in Docker:
postgres://${AUTH_DB_USER}:${AUTH_DB_PASSWORD}@${POSTGRES}/${AUTH_DB_NAME}
*/

// ensure correct .env path location (works on host)
dotenv.config({ path: resolve(__dirname, "../../.env") });

const user = process.env.AUTH_DB_USER as string;
const host = process.env.POSTGRES_ADDR as string;
const db_name = process.env.AUTH_DB_NAME as string;

// Resolve the secret path mapping both for host and container
let auth_pass = "";
const containerSecret = "/run/secrets/auth_db_password";
const hostSecret = resolve(__dirname, "../../secrets/auth_db_password");
if (existsSync(containerSecret)) {
	auth_pass = readFileSync(containerSecret, "utf8").trim();
} else if (existsSync(hostSecret)) {
	auth_pass = readFileSync(hostSecret, "utf8").trim();
}



export const databaseUrl = `postgres://${user}:${auth_pass}@${host}/${db_name}`;