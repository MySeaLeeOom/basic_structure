import { eq, and } from "drizzle-orm";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import * as schema from "../db/schema"

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

export const sessionRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
	// A simple endpoint to check "Who am I?"
	server.get("/verify", async (request, reply) => {
		// 1. PULL THE TICKET (from Signed Cookies)
		// We use signed=true because we want to be sure WE were the ones who issued it.
		// If a user tampered with it, Fastify will return undefined here.
		const verifiedCoookie = request.unsignCookie(request.cookies.session_id || "");
		if (!verifiedCoookie || !verifiedCoookie.valid) {
			console.log("No valid session cookie found.");
			return reply.status(401).send({ error: "No active session." });
		}

		const tokenValue = verifiedCoookie.value as string;

		// 2. CHECK THE SESSION RECORD DB
		const [sessionObject] = await server.db.select().from(schema.sessions).where(eq(schema.sessions.token, tokenValue)).limit(1);
		if (!sessionObject) {
			console.log("Session token not found in database.");
			return reply.status(401).send({ error: "Session invalid." });
		}

		// 3. CHECK THE CLOCK (Expiry)
		// Standard Cookie Behavior
			// When a cookie expires, the BROWSER deletes it automatically.
			// However, if the browser is old or the clock is wrong, the browser might keep it.
			// We MUST always perform the server-side check.
		const now = new Date();
		if (sessionObject.expiresAt < now) {
			console.log("Session has expired in the database.");
			return reply.status(401).send({ error: "Session expired." });
		}

		// 4. GET THE USER (The Identity)
		const [userObject] = await server.db.select().from(schema.users).where(eq(schema.users.id, sessionObject.user_id)).limit(1);
		if (!userObject) {
			return reply.status(401).send({ error: "User no longer exists." });
		}

		// SUCCESS: The Identity is Verified
		return {
			authenticated: true,
			user: {
				id: userObject.id,
				email: userObject.email,
				role: userObject.role,
			},
		};
	});

	// LOGOUT: The Revocation
	server.post("/logout", async (request, reply) => {
		const sessionId = request.unsignCookie(request.cookies.session_id || "");

		if (sessionId && sessionId.valid && sessionId.value) {
			// Delete the record from our DB (Revoke the ticket)
			await server.db.delete(schema.sessions).where(eq(schema.sessions.token, sessionId.value));
		}

		// Clear the cookie in the browser
		reply.clearCookie("session_id", { path: "/" });
		return { message: "Logged out successfully" };
	});
};
