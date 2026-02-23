import fastify from "fastify";
import postgres from "@fastify/postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { databaseUrl } from "./db/connections";

import { readFileSync, existsSync } from "node:fs";
import fastifyOauth2 from "@fastify/oauth2";

// import { FastifyInstance } from "fastify"; // This imports the FastifyInstance TYPE.
import { OAuth2Namespace } from "@fastify/oauth2"; // This was previously added.

import { pgEnum } from "drizzle-orm/pg-core";
import * as schema from "./db/schema"; // DB tables

// import { randomUUID } from 'node:crypto';
// const sessionID = randomUUID(); //this is for the UUID/session
const url = process.env.WEBSITE_URL || "";
if (!url) throw new Error("No website url in the environment!");
// FASTIFY INSTANCE
const server = fastify({
	logger: { level: "trace" }, // pino logger for prometheus
	trustProxy: true, // so we can check the ip of the user, not just nginx (nginx adds this)
});

// POSTGRES
// this register db as a plugin, the server makes sure the connection is there
// (pool of connections)
server.register(postgres, {
	connectionString: databaseUrl,
	max: 10,
	idleTimeoutMillis: 30000, //this is time sitting waiting in pool
	statement_timeout: 5000, //5 seconds searching db
});
// connect the pool of connections to drizzle
server.after(async () => {
	const db = drizzle(server.pg.pool);
	server.decorate("db", db);
	// The Production Migration Gate (The "Actual Machine")
	try {
		console.log("Checking for pending migrations...");
		// This looks at our 'drizzle/' folder and ensures the DB matches
		await migrate(db, { migrationsFolder: "./drizzle" });
		console.log("Database is in sync.");
	} catch (err) {
		server.log.error("Migration failed! Refusing to start.");
		server.log.error(err);
		process.exit(1);
	}
});

//OAUTH2 GITHUB
// github client id
const clientIdGit = process.env.GITHUB_CLIENT_ID;
if (!clientIdGit) {
	throw new Error("CRITICAL: GITHUB_CLIENT_ID is missing from the environment!");
}
// github client secret
let clientSecretGit = "";
const gitSecretPath = "/run/secrets/github_client_secret";
if (existsSync(gitSecretPath)) clientSecretGit = readFileSync(gitSecretPath, "utf8").trim();
else throw new Error("CRITICAL: GITHUB_CLIENT_SECRET is missing from secrets!");

/**
 * Declaration Merging (Module Augmentation): typescript
 * Concept: let typescript know that the object might contain an extra property
 * In this case, FastifyInstance might contain githubOAuth2
 */
declare module "fastify" {
	interface FastifyInstance {
		githubOAuth2: OAuth2Namespace;
	}
}
//REGISTER OAUTH2 GITHUB
server.register(fastifyOauth2, {
	name: "githubOAuth2",
	scope: [], //"user:email"
	credentials: {
		client: {
			id: clientIdGit,
			secret: clientSecretGit,
		},
		auth: fastifyOauth2.GITHUB_CONFIGURATION,
	},
	startRedirectPath: "/login/github",
	callbackUri: "http://localhost:8080/api/auth/login/github/callback",
});

//this function will receive the token
// - needs to check if there is a user already with this info
// - needs to either create the user or give them a session
server.get("/login/github/callback", async function (request, reply) {
	//get the token from github
	const gitToken = await this.githubOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);
	console.log(gitToken.token.access_token);

	// get the user info using token information
	const response = await fetch("https://api.github.com/user", {
		headers: {
			Authorization: `Bearer ${gitToken.token.access_token}`,
			"User-Agent": "myceleum_catdev42",
		},
	});
	const githubUser = await response.json();
	console.log(githubUser);

	// specialized request for emails (not doing, but tested)
	// const emailResponse = await fetch("https://api.github.com/user/emails", {
	//     headers: {
	//         Authorization: `Bearer ${gitToken.token.access_token}`,
	//         "User-Agent": "myceleum_catdev42",
	//     },
	// });
	// const emails = await emailResponse.json();
	// console.log(emails);

	// TODO: DO DATABASE
	// // ex: const user = await request.server.db.select().from(users);

	reply.send({ access_token: gitToken.token.access_token });
});

/* Example usage of drizzle:
server.get('/users', async (request, reply) => {
    const allUsers = await request.server.db.select().from(users);
});
*/

server.get("/ping", async (request, reply) => {
	return "pong\n";
});

//what to do if we are registering a user locally
// logic for registering a new user locally
server.get("/login", async (request, reply) => {
	return { message: "Local login placeholder" };
});

// separate one for checking cookie
server.get("/", async (request, reply) => {
	return { message: "Auth service root placeholder" };
});

server.listen({ port: 3000, host: "0.0.0.0" }, (err, address) => {
	if (err) {
		console.error(err);
		process.exit(1);
	}
	console.log(`Auth Server listening at ${address}`);
});
