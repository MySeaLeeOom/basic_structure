import { readFileSync, existsSync } from "node:fs";
import fastify from "fastify";
import postgres from "@fastify/postgres";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { databaseUrl } from "./db/connections";
import fastifyOauth2 from "@fastify/oauth2";
import { OAuth2Namespace } from "@fastify/oauth2"; // This was previously added.

import * as schema from "./db/schema"; // DB tables
import { authRoutes } from "./routes/auth"; // all routes

/**
 * Declaration Merging (Module Augmentation): typescript
 * Concept: let typescript know that the object might contain an extra property
 * In this case, FastifyInstance might contain githubOAuth2
 */
declare module "fastify" {
	interface FastifyInstance {
		githubOAuth2: OAuth2Namespace;
		db: NodePgDatabase<typeof schema>;
	}
}

// Maybe dont really need this, can get it from request headers
// const url = process.env.WEBSITE_URL || "";
// if (!url) throw new Error("No website url in the environment!");

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
	const db = drizzle(server.pg.pool, { schema }); //TODO:check
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

server.register(authRoutes);

server.get("/ping", async (request, reply) => {
	return "pong\n";
});

server.listen({ port: 3000, host: "0.0.0.0" }, (err, address) => {
	if (err) {
		console.error(err);
		process.exit(1);
	}
	console.log(`Auth Server listening at ${address}`);
});
