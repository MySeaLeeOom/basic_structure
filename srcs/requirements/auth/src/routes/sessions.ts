import { eq, and } from "drizzle-orm";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import * as schema from "../db/schema";

/**
 * SESSION MANAGEMENT: The Verification Logic
 *
 * FIRST PRINCIPLES:
 * 1. The Cookie (The Proof): The browser sends us a 'session_id'.
 * 2. The Verification (The DB): We check if this token exists in our DB.
 * 3. The Deadline (The Expiry): Even if the token exists, we check the clock.
 */

export const sessionRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
	// A simple endpoint to check "Who am I?"
	server.get("/verify", async (request, reply) => {
		// 1. PULL THE TICKET (from Signed Cookies)
		// We use signed=true because we want to be sure WE were the ones who issued it.
		// If a user tampered with it, Fastify will return undefined here.
		const sessionId = request.unsignCookie(request.cookies.session_id || "");

		if (!sessionId || !sessionId.valid) {
			console.log("No valid session cookie found.");
			return reply.status(401).send({ error: "No active session." });
		}

		const tokenValue = sessionId.value as string;

		// 2. CHECK THE RELATIONAL RECORD
		const [session] = await server.db.select().from(schema.sessions).where(eq(schema.sessions.token, tokenValue)).limit(1);

		if (!session) {
			console.log("Session token not found in database.");
			return reply.status(401).send({ error: "Session invalid." });
		}

		// 3. CHECK THE CLOCK (Expiry)
		const now = new Date();
		if (session.expiresAt < now) {
			console.log("Session has expired in the database.");

			// PROFESSOR'S NOTE: Standard Cookie Behavior
			// When a cookie expires, the BROWSER deletes it automatically.
			// However, if the browser is old or the clock is wrong, the browser might keep it.
			// We MUST always perform the server-side check (the 'Atomic Truth').

			return reply.status(401).send({ error: "Session expired." });
		}

		// 4. GET THE USER (The Identity)
		const [user] = await server.db.select().from(schema.users).where(eq(schema.users.id, session.user_id)).limit(1);

		if (!user) {
			return reply.status(401).send({ error: "User no longer exists." });
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
