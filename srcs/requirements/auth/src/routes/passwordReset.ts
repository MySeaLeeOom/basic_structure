import { eq, and } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import * as schema from "../db/schema";
import * as argon2 from "argon2";
import { upsertAccount } from "../lib/account_helpers";
import { sendPasswordResetEmail } from "../lib/mailer";

const ForgotPasswordSchema = Type.Object({
	email: Type.String({ format: "email" }),
});

const ResetPasswordSchema = Type.Object({
	token: Type.String({ minLength: 1 }),
	newPassword: Type.String({ minLength: 8 }),
});

const GENERIC_SUCCESS = "If an account with that email exists, a reset link has been sent.";
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export const passwordResetRoutes: FastifyPluginAsyncTypebox = async (server) => {
	/**
	 * POST /forgot-password
	 * Generates a reset token and emails a link. Always returns the same
	 * generic message regardless of whether the email is registered.
	 */
	server.post("/forgot-password", { schema: { body: ForgotPasswordSchema } }, async (request, reply) => {
		const { email } = request.body;

		const [user] = await server.db
			.select()
			.from(schema.users)
			.where(eq(schema.users.email, email))
			.limit(1);

		if (!user) {
			return { message: GENERIC_SUCCESS };
		}

		// Only users with a local password account can use email reset.
		const [localAccount] = await server.db
			.select({ id: schema.accounts.id })
			.from(schema.accounts)
			.where(and(eq(schema.accounts.userId, user.id), eq(schema.accounts.provider, "local")))
			.limit(1);

		if (!localAccount) {
			return { message: GENERIC_SUCCESS };
		}

		const token = randomBytes(32).toString("hex");
		const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

		await server.db.insert(schema.passwordResetTokens).values({
			userId: user.id,
			token,
			expiresAt,
		});

		const websiteUrl = process.env.WEBSITE_URL ?? "https://localhost:8443";
		const resetLink = `${websiteUrl}/reset-password?token=${token}`;

		try {
			await sendPasswordResetEmail(email, resetLink);
		} catch (err) {
			server.log.error({ err }, "Failed to send password reset email");
			// Don't leak the error — still return generic message
		}

		return { message: GENERIC_SUCCESS };
	});

	/**
	 * POST /reset-password
	 * Validates the token and updates the user's password.
	 */
	server.post("/reset-password", { schema: { body: ResetPasswordSchema } }, async (request, reply) => {
		const { token, newPassword } = request.body;

		const [resetRecord] = await server.db
			.select()
			.from(schema.passwordResetTokens)
			.where(eq(schema.passwordResetTokens.token, token))
			.limit(1);

		if (!resetRecord) {
			return reply.status(400).send({ error: "Invalid or expired reset token." });
		}

		if (resetRecord.usedAt !== null) {
			return reply.status(400).send({ error: "This reset link has already been used." });
		}

		if (resetRecord.expiresAt < new Date()) {
			return reply.status(400).send({ error: "Invalid or expired reset token." });
		}

		const [user] = await server.db
			.select()
			.from(schema.users)
			.where(eq(schema.users.id, resetRecord.userId))
			.limit(1);

		if (!user || !user.email) {
			return reply.status(400).send({ error: "Invalid or expired reset token." });
		}

		const newHash = await argon2.hash(newPassword);

		await upsertAccount(server, {
			userId: user.id,
			provider: "local",
			providerAccountId: user.email,
			passwordHash: newHash,
		});

		await server.db
			.update(schema.passwordResetTokens)
			.set({ usedAt: new Date() })
			.where(eq(schema.passwordResetTokens.id, resetRecord.id));

		return { message: "Password updated successfully." };
	});
};
