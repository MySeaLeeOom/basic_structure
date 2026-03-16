import { or, eq, and } from "drizzle-orm";
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type, type Static } from "@sinclair/typebox";
import * as schema from "../db/schema";
import type { GithubUser } from "../types";
import { createSession, verifySession } from "../lib/session_helpers";
import { getHomeURL, getOrigin } from "../lib/auth_utils";
import * as argon2 from "argon2";

/* sinclair typebox schema */
export const ChangeLoginSchema = Type.Object({
	loginName: Type.String({ minLength: 3, maxLength: 50 }),
});

export const ChangeEmailSchema = Type.Object({
	email: Type.String({ format: "email" }),
});

export const AddPasswordSchema = Type.Object({
	password: Type.String({ minLength: 12 }),
	email: Type.Optional(Type.String({ format: "email" })),
});

export const ChangePasswordSchema = Type.Object({
	currentPassword: Type.String(),
	newPassword: Type.String({ minLength: 12 }),
});

export type ChangeLoginType = Static<typeof ChangeLoginSchema>;
export type ChangeEmailType = Static<typeof ChangeEmailSchema>;
export type AddPasswordType = Static<typeof AddPasswordSchema>;
export type ChangePasswordType = Static<typeof ChangePasswordSchema>;

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
	 * Returns the full user profile (Id, Email, Role, etc.) for the currently logged-in user. */
	server.get("/me", async (request, reply) => {
		const session = await verifySession(request, server.db);
		if (!session) {
			return reply.status(401).send({ error: "No active session found." });
		}

		// Get User Profile (Thick check - Source of Truth)
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
				status: user.status,
				imageURL: user.imageURL,
				createdAt: user.createdAt,
			},
		};
	});

	/**
	 * POST /add-password
	 * Allows an OAuth user to add a local password for future login. */
	server.post<{ Body: AddPasswordType }>(
		"/add-password",
		{
			schema: {
				body: AddPasswordSchema,
			},
		},
		async (request, reply) => {
			const session = await verifySession(request, server.db);
			if (!session) return reply.status(401).send({ error: "Unauthorized" });

			// Check if a local account already exists for this Identity
			const [existingAccount] = await server.db
				.select()
				.from(schema.accounts)
				.where(and(eq(schema.accounts.userId, session.userId), eq(schema.accounts.provider, "local")))
				.limit(1);

			if (existingAccount) {
				return reply.status(400).send({
					error: "Conflict",
					message: "A local account is already linked to this profile.",
					detail: "If you want to update your password, please use the 'Change Password' flow.",
				});
			}

			// 2. Fetch the User profile to verify identity
			const [user] = await server.db.select().from(schema.users).where(eq(schema.users.id, session.userId)).limit(1);
			if (!user) {
				return reply.status(404).send({ error: "User profile not found." });
			}

			// 3. Extract data from request
			const { password, email: providedEmail } = request.body;

			// Logic: We need an email for the 'local' account.
			// If the user doesn't have one in DB, they MUST provide it now.
			const finalEmail = user.email || providedEmail;

			if (!finalEmail) {
				return reply.status(400).send({
					error: "Email Required",
					message: "Your profile is missing an email address.",
					detail: "To create a local login, we require an email to serve as your identification.",
				});
			}

			// 4. Update the user profile with the new email if it was provided
			if (providedEmail && providedEmail !== user.email) {
				try {
					await server.db.update(schema.users).set({ email: providedEmail }).where(eq(schema.users.id, session.userId));
				} catch (err: any) {
					if (err.code === "23505") {
						return reply.status(409).send({
							error: "Collision",
							message: "Email already in use.",
							detail: "That email is already claimed by another scribe.",
						});
					}
					throw err;
				}
			}

			const hashedPassword = await argon2.hash(password);

			// 5. Create the local account linked to this user
			await server.db.insert(schema.accounts).values({
				userId: session.userId,
				provider: "local",
				providerAccountId: finalEmail,
				passwordHash: hashedPassword,
			});

			return {
				success: true,
				message: "Local password added successfully.",
				detail: `You can now log in using ${finalEmail} and your new password.`,
			};
		},
	);

	/**
	 * POST /lost-password
	 * Initiates the password recovery flow.
	 */
	server.post("/lost-password", async (request, reply) => {
		// This is a public route, but usually requires an identity check later.
		// TODO: Implement reset-request logic (emails, tokens, etc.)
		return { message: "Declaring intent to handle lost password." };
	});

	/**
	 * PATCH /change-password
	 * Allows a logged-in user to update their credentials.
	 */
	server.patch<{ Body: ChangePasswordType }>(
		"/change-password",
		{
			schema: {
				body: ChangePasswordSchema,
			},
		},
		async (request, reply) => {
			const session = await verifySession(request, server.db);
			if (!session) return reply.status(401).send({ error: "Unauthorized" });

			const { currentPassword, newPassword } = request.body;

			// 1. Get the local account
			const [account] = await server.db
				.select()
				.from(schema.accounts)
				.where(and(eq(schema.accounts.userId, session.userId), eq(schema.accounts.provider, "local")))
				.limit(1);

			if (!account || !account.passwordHash) {
				return reply.status(400).send({
					error: "No Local Account",
					message: "You do not have a local password set.",
					detail: "You must use 'Add Password' first if you are an OAuth user.",
				});
			}

			// 2. Verify current password
			const isValid = await argon2.verify(account.passwordHash, currentPassword);
			if (!isValid) {
				return reply.status(401).send({
					error: "Invalid Credentials",
					message: "The current password provided is incorrect.",
					detail: "Security requires verification of the old before accepting the new.",
				});
			}

			// 3. Hash and update
			const newHash = await argon2.hash(newPassword);
			await server.db
				.update(schema.accounts)
				.set({ passwordHash: newHash })
				.where(and(eq(schema.accounts.userId, session.userId), eq(schema.accounts.provider, "local")));

			return {
				success: true,
				message: "Password updated successfully.",
			};
		},
	);

	/**
	 * PATCH /change-login
	 * Updates the public identity (loginName).
	 */
	server.patch<{ Body: ChangeLoginType }>(
		"/change-login",
		{
			schema: {
				body: ChangeLoginSchema,
			},
		},
		async (request, reply) => {
			const session = await verifySession(request, server.db);
			if (!session) return reply.status(401).send({ error: "Unauthorized" });

			const { loginName } = request.body;

			try {
				await server.db.update(schema.users).set({ loginName }).where(eq(schema.users.id, session.userId));

				return {
					success: true,
					message: "Username updated successfully.",
					user: { loginName },
				};
			} catch (err: any) {
				if (err.code === "23505") {
					// Unique violation
					return reply.status(409).send({
						error: "Collision",
						message: "Username already taken.",
						detail: "This username is already claimed by another scribe.",
					});
				}
				throw err;
			}
		},
	);

	/**
	 * PATCH /change-email
	 * Updates the email address.
	 */
	server.patch<{ Body: ChangeEmailType }>(
		"/change-email",
		{
			schema: {
				body: ChangeEmailSchema,
			},
		},
		async (request, reply) => {
			const session = await verifySession(request, server.db);
			if (!session) return reply.status(401).send({ error: "Unauthorized" });

			const { email } = request.body;

			try {
				await server.db.update(schema.users).set({ email }).where(eq(schema.users.id, session.userId));

				// If email changed, we also need to update the 'local' account providerAccountId
				// so the user can actually log in with the new email.
				await server.db
					.update(schema.accounts)
					.set({ providerAccountId: email })
					.where(and(eq(schema.accounts.userId, session.userId), eq(schema.accounts.provider, "local")));

				return {
					success: true,
					message: "Email updated successfully.",
					user: { email },
				};
			} catch (err: any) {
				if (err.code === "23505") {
					// Unique violation
					return reply.status(409).send({
						error: "Collision",
						message: "Email already taken.",
						detail: "This email address is already in use.",
					});
				}
				throw err;
			}
		},
	);

	/**
	 * DELETE /delete-account
	 * Deletes the user profile and all associated data.
	 */
	server.delete("/delete-account", async (request, reply) => {
		const session = await verifySession(request, server.db);
		if (!session) return reply.status(401).send({ error: "Unauthorized" });

		// TODO: Implement cascading deletions (Notes, Accounts, etc.)
		return { message: "Declaring intent to delete account." };
	});

	/**
	 * GET /all-data
	 * The GDPR/Portability route. Returns everything we know about the user.
	 */
	server.get("/all-data", async (request, reply) => {
		const session = await verifySession(request, server.db);
		if (!session) return reply.status(401).send({ error: "Unauthorized" });

		// TODO: Implement cross-service data aggregation
		return { message: "Declaring intent to retrieve all user statistics." };
	});
};
