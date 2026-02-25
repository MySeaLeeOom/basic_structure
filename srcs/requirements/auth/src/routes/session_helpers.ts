import type { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";
/**
 * Creates a secure session for a user.
 * 1. Generates a session in the DB
 * 2. Sets the signed cookie on the response
 */
export async function createSession(
	request: FastifyRequest,
	reply: FastifyReply,
	db: NodePgDatabase<typeof schema>,
	userId: number,
	role: "admin" | "user"
) {
	const expiresAt = new Date(); //creates current date
	expiresAt.setHours(expiresAt.getHours() + 24 * 7); // Valid for 1 week

	const sessionBuild:schema.NewSession = {
			user_id: userId,
			role: role as "user" | "admin",
			expiresAt: expiresAt,
			userAgent: request.headers["user-agent"], //information about device
			ipAddress: request.ip,
	}
	// Create session in DB
	const [session] = await db
		.insert(schema.sessions)
		.values(sessionBuild)
		.returning();

	// Set the cookie
	reply.setCookie("session_id", session.token, {
		path: "/",
		httpOnly: true,
		secure: false, // Set to TRUE when using real HTTPS
		sameSite: "lax",
		expires: expiresAt,
		signed: true,
	});

	return session;
}

/**
 * Verifies a session cookie and retrieves the associated user.
 * Returns the User object if valid, or null if invalid/expired.
 */
export async function verifySession(request: FastifyRequest, db: NodePgDatabase<typeof schema>) {
	const cookie = request.cookies.session_id;
	if (!cookie) return null;

	const decodedCookie = request.unsignCookie(cookie);
	if (!decodedCookie.valid || !decodedCookie.value) return null;

	const sessionUUID = decodedCookie.value;

	// Database Lookup
	const [session] = await db.select().from(schema.sessions).where(eq(schema.sessions.token, sessionUUID)).limit(1);
	if (!session) return null;

	// Expiry Check
	if (session.expiresAt < new Date()) {
		return null;
	}

	// Fetch User
	const [user] = await db.select().from(schema.users).where(eq(schema.users.id, session.user_id)).limit(1);

	return user || null;
}

/**
 * Revokes a session (Logout).
 * 1. Deletes from DB
 * 2. Clears cookie
 */
export async function revokeSession(request: FastifyRequest, reply: FastifyReply, db: NodePgDatabase<typeof schema>) {
	const cookie = request.cookies.session_id;
	if (cookie) {
		const unsigned = request.unsignCookie(cookie);
		if (unsigned.valid && unsigned.value) {
			await db.delete(schema.sessions).where(eq(schema.sessions.token, unsigned.value));
		}
	}
	reply.clearCookie("session_id", { path: "/" }); //call for the browser to clear the cookie
}
