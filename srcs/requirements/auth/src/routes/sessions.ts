import { eq, and } from "drizzle-orm";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import * as schema from "../db/schema";

import { verifySession, revokeSession } from "./session_helpers";
import { getOrigin } from "./auth_utils";

export const sessionRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
	// A simple endpoint to check "Who am I?"
	server.get("/verify", async (request, reply) => {
		// 1. HELPER: Verify Session
		const user = await verifySession(request, server.db);

		if (!user) {
			console.log("Session invalid or expired.");
			return reply.status(401).send({ error: "No active session." });
		}

		// SUCCESS: The Identity is Verified
		return {
			authenticated: true,
			user: {
				id: user.id,
				email: user.email,
				role: user.role,
			},
		};
	});

	// LOGOUT: The Revocation
	server.post("/logout", async (request, reply) => {
		// 2. HELPER: Revoke Session
		await revokeSession(request, reply, server.db);
		// 3. UTILS: Determine where to send them
		const origin = getOrigin(request);
		
		// 4. ACTION: Redirect to home/login
		return reply.redirect(`${origin}`); 
	});
};

/* THE IDENTITY LIFECYCLE (The "Atomic Flow"):
 *
 * 1. EXTRACTION: Pull the 'session_id' from the request cookies.
 * 2. INTEGRITY CHECK: Unsign the cookie. If the 'wax seal' is broken, the request is a forgery.
 * 3. EXISTENCE CHECK: Query the 'sessions' table for the random UUID token.
 *    If the token exists, we have found a matching 'Certificate of Stay'.
 * 4. TEMPORAL CHECK: Compare 'expires_at' with the current server time.
 *    If the clock has run out, the session is dead regardless of the token's presence.
 * 5. LINKAGE: Use 'user_id' from the session to find the actual 'User' record.
 * 6. AUTHORIZATION: Attach the user's 'role' (user/admin) to the response for downstream microservices.
 */

/*
- `/verify`: 

*/
