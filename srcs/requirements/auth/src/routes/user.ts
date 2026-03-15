import { or, eq, and } from "drizzle-orm";
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type, type Static } from "@sinclair/typebox";
import * as schema from "../db/schema";
import type { GithubUser } from "../types";
import { createSession, verifySession } from "../lib/session_helpers";
import { getHomeURL, getOrigin } from "../lib/auth_utils";
import * as argon2 from "argon2";

// // sinclair typebox schema
// export const RegistrationSchema = Type.Object({
// 	loginName: Type.String({ minLength: 3 }),
// 	email: Type.String({ format: "email" }),
// 	password: Type.String({ minLength: 12 }),
// });

// export const LoginSchema = Type.Object({
// 	identifier: Type.String({ minLength: 3 }), // Can't be shorter than the shortest loginName
// 	password: Type.String({ minLength: 12 }), // Must match your registration rules
// });

// // this makes a specific Type for request.body that will
// export type RegisterType = Static<typeof RegistrationSchema>;
// export type LoginType = Static<typeof LoginSchema>;

/*

- Add Password

- Lost Password

- Change Password

- Change Username

- Delete Account

- Get All User Data
 */

/**
 * User Management Routes
 * Handles profile retrieval and (future) profile updates.
 */
export const userManagementRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
    /**
     * GET /me
     * The Profile Identity Route.
     * Returns the full user profile (Id, Email, Role, etc.) for the currently logged-in user.
     * This is the "Thick" check.
     */
    server.get("/me", async (request, reply) => {
        // 1. Get Session (Thin check)
        const session = await verifySession(request, server.db);
        if (!session) {
            return reply.status(401).send({ error: "No active session found." });
        }

        // 2. Get User Profile (Thick check - Source of Truth)
        const [user] = await server.db
            .select()
            .from(schema.users)
            .where(eq(schema.users.id, session.userId))
            .limit(1);

        if (!user) {
            return reply.status(404).send({ error: "User profile not found." });
        }

        // 3. Return sanitized user data
        return {
            authenticated: true,
            user: {
                id: user.id,
                loginName: user.loginName,
                email: user.email,
                role: user.role,
                imageURL: user.imageURL,
                createdAt: user.createdAt,
            },
        };
    });
};