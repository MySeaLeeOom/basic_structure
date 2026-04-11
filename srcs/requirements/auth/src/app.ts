import fastify, { type FastifyInstance } from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import postgres from "@fastify/postgres";
import fastifyCookie from "@fastify/cookie";
import fastifyOauth2, { type OAuth2Namespace } from "@fastify/oauth2";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "./db/schema"; // DB tables
import { prometheusRegister } from "./metrics";
import { authRoutes } from "./routes/auth"; // all routes
import { sessionRoutes } from "./routes/sessions"; // verification logic
import { userManagementRoutes } from "./routes/user"; // profile logic

/**
 * Declaration Merging (Module Augmentation): typescript
 * Concept: let typescript know that the object might contain extra properties
 */
declare module "fastify" {
    interface FastifyInstance {
        githubOAuth2: OAuth2Namespace;
        db: NodePgDatabase<typeof schema>;
        frontendUrl: string;
    }
}

// Configuration Interface used to inject dependencies
export interface AppConfig {
    databaseUrl: string;
    githubClientId: string;
    githubClientSecret: string;
    sessionSecret: string;
    callbackUri: string;
    frontendUrl: string;
    runMigrations?: boolean;
}

// Factory function to create the server (The Recipe)
export const buildServer = async (config: AppConfig) => {

    // FASTIFY INSTANCE
    const server = fastify({
        logger: {
            level: "trace",
            redact: {
                paths: ["body.password", "headers.cookie", "headers.authorization"],
                censor: "[PRIVATE_INTEL]",
            },
        },
        trustProxy: true, // so we can check the ip of the user, not just nginx (nginx adds this)
    }).withTypeProvider<TypeBoxTypeProvider>();

    server.decorate("frontendUrl", config.frontendUrl);

    server.get("/metrics", async (_request, reply) => {
        reply.header("Content-Type", prometheusRegister.contentType);
        return reply.send(await prometheusRegister.metrics());
    });

    // POSTGRES
    await server.register(postgres, {
        connectionString: config.databaseUrl,
        max: 10,
        idleTimeoutMillis: 30000, //30 sec this is time sitting waiting in pool
        statement_timeout: 5000, //5 seconds searching db
    });

    // connect the pool of connections to drizzle
    server.after(async () => {
        const db = drizzle(server.pg.pool, { schema }); //TODO:check schema
        server.decorate("db", db);

        // The Production Migration Gate
        if (config.runMigrations !== false) {
            try {
                server.log.info("Checking for pending migrations...");
                // This looks at our 'drizzle/' folder and ensures the DB matches
                await migrate(db, { migrationsFolder: "./drizzle" });
                server.log.info("Database is in sync.");
            } catch (err) {
                server.log.error("Migration failed! Refusing to start.");
                server.log.error(err);
                // In test environment, we might catch this differently, but for now:
                if (process.env.NODE_ENV !== "test") {
                    process.exit(1);
                }
            }
        }
    });

    // REGISTER CORE PLUGINS (Cookie)
    await server.register(fastifyCookie, {
        secret: config.sessionSecret,
        parseOptions: {},
    });

    // REGISTER OAUTH2 GITHUB
    await server.register(fastifyOauth2, {
        name: "githubOAuth2",
        scope: [], //"user:email"
        credentials: {
            client: {
                id: config.githubClientId,
                secret: config.githubClientSecret,
            },
            auth: fastifyOauth2.GITHUB_CONFIGURATION,
        },
        startRedirectPath: "/login/github",
        callbackUri: config.callbackUri,
    });

    await server.register(authRoutes);
    await server.register(sessionRoutes);
    await server.register(userManagementRoutes);

    server.get("/ping", async (request, reply) => {
        return "pong\n";
    });

    // Wait for plugins to be ready before returning
    await server.ready();
    return server;
};