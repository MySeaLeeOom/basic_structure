import { eq, and, or } from "drizzle-orm";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { Type, type Static } from "@sinclair/typebox";
import * as schema from "../db/schema";
import { verifySession } from "../lib/session_helpers";
import { upsertAccount } from "../lib/account_helpers";
import * as argon2 from "argon2";

/* Schemas for Inputs */
const ChangeLoginSchema = Type.Object({
	loginName: Type.String({ minLength: 3, maxLength: 50 }),
});

const ChangeEmailSchema = Type.Object({
	email: Type.String({ format: "email" }),
});

const ChangePasswordSchema = Type.Object({
	oldPassword: Type.String(),
	newPassword: Type.String({ minLength: 8 }),
});

const ResolveUserSchema = Type.Object({
	identifier: Type.String({ minLength: 3 }),
});

type ChangeLoginType = Static<typeof ChangeLoginSchema>;
type ChangeEmailType = Static<typeof ChangeEmailSchema>;
type ChangePasswordType = Static<typeof ChangePasswordSchema>;
type ResolveUserType = Static<typeof ResolveUserSchema>;

/**
 * User Management Routes
 * Handles profile retrieval and (future) profile updates.
 */
export const userManagementRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
	/* Returns the full user profile (Id, Email, Role, etc.) */
	server.get("/me", async (request, reply) => {
		const session = await verifySession(request, server.db);
		if (!session) {
			return reply.status(401).send({ error: "No active session found." });
		}
		// Get User Profile
		const [user] = await server.db.select().from(schema.users).where(eq(schema.users.id, session.userId)).limit(1);
		if (!user) {
			return reply.status(404).send({ error: "User profile not found." });
		}
		// Return sanitized user data
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

	/*
	 * GET /resolve: Look up a user by exact email or loginName.
	 * Used by the Frontend to verify identity before creating a share.
	 */
	server.get<{ Querystring: ResolveUserType }>("/resolve", { schema: { querystring: ResolveUserSchema } }, async (request, reply) => {
		const session = await verifySession(request, server.db);
		if (!session) return reply.status(401).send({ error: "Unauthorized" });

		const { identifier } = request.query;

		const [user] = await server.db
			.select({
				id: schema.users.id,
				loginName: schema.users.loginName,
				imageURL: schema.users.imageURL,
			})
			.from(schema.users)
			.where(or(eq(schema.users.email, identifier), eq(schema.users.loginName, identifier)))
			.limit(1);

		if (!user) {
			return reply.status(404).send({ error: "No user found with that email or username." });
		}

		return { user: user };
	});

	/*
	 * GET /users: Returns all registered users (id + loginName).
	 * Used by the frontend share dialog to list/search users.
	 */
	server.get("/users", async (request, reply) => {
		const session = await verifySession(request, server.db);
		if (!session) return reply.status(401).send({ error: "Unauthorized" });

		const users = await server.db
			.select({
				id: schema.users.id,
				loginName: schema.users.loginName,
			})
			.from(schema.users);

		return { users };
	});

	/* PATCH /change-login: Updates the public identity (loginName). */
	server.patch<{ Body: ChangeLoginType }>("/change-login", { schema: { body: ChangeLoginSchema } }, async (request, reply) => {
		const session = await verifySession(request, server.db);
		if (!session) return reply.status(401).send({ error: "Unauthorized" });

		const { loginName } = request.body;

		try {
			await server.db.update(schema.users).set({ loginName }).where(eq(schema.users.id, session.userId));
			return { message: "Username updated successfully.", user: { loginName } };
		} catch (err: any) {
			if (err.code === "23505") {
				return reply.status(409).send({ error: "Username already taken." });
			}
			throw err;
		}
	});

	/* PATCH /change-email: Updates the private identity (email).*/
	server.patch<{ Body: ChangeEmailType }>("/change-email", { schema: { body: ChangeEmailSchema } }, async (request, reply) => {
		const session = await verifySession(request, server.db);
		if (!session) return reply.status(401).send({ error: "Unauthorized" });

		const { email } = request.body;
		try {
			await server.db.update(schema.users).set({ email }).where(eq(schema.users.id, session.userId));
			return { message: "Email updated successfully.", user: { email } };
		} catch (err: any) {
			if (err.code === "23505") {
				return reply.status(409).send({ error: "Email already in use." });
			}
			throw err;
		}
	});

	/**
	 * POST /change-password: Updates the password for the current user.
	 * Look for a 'local' provider account in the accounts table.
	 */
	server.post<{ Body: ChangePasswordType }>("/change-password", { schema: { body: ChangePasswordSchema } }, async (request, reply) => {
		const session = await verifySession(request, server.db);
		if (!session) return reply.status(401).send({ error: "Unauthorized" });

		const { oldPassword, newPassword } = request.body;

		// Get User Profile to check for email
		const [user] = await server.db.select().from(schema.users).where(eq(schema.users.id, session.userId)).limit(1);

		if (!user) return reply.status(404).send({ error: "User not found." });
		if (!user.email) {
			return reply.status(400).send({ error: "Please add an email before adding a login password." });
		}

		// Find the 'local' account for this user
		const [account] = await server.db
			.select()
			.from(schema.accounts)
			.where(and(eq(schema.accounts.userId, session.userId), eq(schema.accounts.provider, "local")))
			.limit(1);

		// Handle Identity Upgrading (No local account yet)
		if (!account || !account.passwordHash) {
			const newHash = await argon2.hash(newPassword);
			await upsertAccount(server, {
				userId: session.userId,
				provider: "local",
				providerAccountId: user.email,
				passwordHash: newHash,
			});
			return { message: "Local account created and password set." };
		}

		// Standard Password Change (Verify current password)
		const isMatch = await argon2.verify(account.passwordHash, oldPassword);
		if (!isMatch) {
			return reply.status(401).send({ error: "Incorrect current password." });
		}

		const newHash = await argon2.hash(newPassword);
		await upsertAccount(server, {
			userId: session.userId,
			provider: "local",
			providerAccountId: user.email,
			passwordHash: newHash,
		});

		return { message: "Password updated successfully." };
	});
};

// - Add Password
// - Lost Password
// - Delete Account
