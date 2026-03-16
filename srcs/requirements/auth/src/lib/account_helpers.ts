import { eq, and } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import * as schema from "../db/schema";

/**
 * Ensures a user has a specific provider account linked.
 * If it doesn't exist, it creates it.
 * If it exists and a passwordHash is provided, it updates it.
 */
export async function upsertAccount(
	server: FastifyInstance,
	params: {
		userId: string;
		provider: "github" | "local" | "google" | "42";
		providerAccountId: string;
		passwordHash?: string;
	},
) {
	const { userId, provider, providerAccountId, passwordHash } = params;

	// 1. Check if the account already exists for this provider and user
	const [existingAccount] = await server.db
		.select()
		.from(schema.accounts)
		.where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.provider, provider)))
		.limit(1);

	if (existingAccount) {
		// 2. Update if passwordHash is provided (e.g. changing password)
		if (passwordHash) {
			await server.db
				.update(schema.accounts)
				.set({
					passwordHash,
					providerAccountId, // Usually stays the same but good to stay consistent
				})
				.where(eq(schema.accounts.id, existingAccount.id));
		}
		return existingAccount;
	}

	// 3. Create a new account link
	const insertValues: schema.NewAccount = {
		userId,
		provider,
		providerAccountId,
	};

	// Only local accounts are allowed to have a password hash
	if (provider === "local" && passwordHash) {
		insertValues.passwordHash = passwordHash;
	}

	const [newAccount] = await server.db
		.insert(schema.accounts)
		.values(insertValues)
		.returning();

	return newAccount;
}
