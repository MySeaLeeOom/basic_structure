import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema.js'; //for autocomplete in IDE

// This path is critical. 
// It points to the folder we mounted in Docker to /home/muni/data
const sqlite = new Database('./data/auth.db');
// Initialize Drizzle with your schema so it knows your table structures
export const db = drizzle(sqlite, { schema });

console.log("Database connection established at ./data/auth.db");
