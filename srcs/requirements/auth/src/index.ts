import fastify from "fastify";
import postgres from "@fastify/postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import {databaseUrl} from "./db/connections"

import { OAuth2Token } from "@fastify/oauth2";
import { pgEnum } from "drizzle-orm/pg-core";
import * as schema from './db/schema';    // DB tables

// import { randomUUID } from 'node:crypto';
// const sessionID = randomUUID(); //this is for the UUID/session

const server = fastify({
	logger: { level: 'trace' }, // pino logger for prometheus
	trustProxy: true // so we can check the ip of the user, not just nginx (nginx adds this)
});

// this register db as a plugin, the server makes sure the connection is there
// (pool of connections)
server.register(postgres, {
	connectionString: databaseUrl,
	max: 10,
	idleTimeoutMillis: 30000, //this is time sitting waiting in pool
	statement_timeout: 5000, //5 seconds searching db
});

// connect the pool of connections to drizzle
server.after(() => {
	const db = drizzle(server.pg.pool);
	server.decorate("db", db);
});

/* Example usage:
server.get('/users', async (request, reply) => {
    const allUsers = await request.server.db.select().from(users);
});
*/

server.get("/ping", async (request, reply) => {
	return "pong\n";
});

//what to do if we are registering a user locally
// logic for registering a new user locally
server.get("/api/auth/login", async (request, reply) => {});

// logic for initial login
server.get("/api/auth/login", async (request, reply) => {});

// separate one for checking cookie
server.get("/api/auth/", async (request, reply) => {});

server.listen({ port: 3000, host: "0.0.0.0" }, (err, address) => {
	if (err) {
		console.error(err);
		process.exit(1);
	}
	console.log(`Auth Server listening at ${address}`);
});
