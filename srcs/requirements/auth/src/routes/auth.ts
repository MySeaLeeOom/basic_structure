import { or, eq, and } from "drizzle-orm";
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type, type Static } from "@sinclair/typebox";
import * as schema from "../db/schema";
import type { GithubUser } from "../types";
import { createSession, verifySession } from "../lib/session_helpers";
import { getHomeURL, getOrigin } from "../lib/auth_utils";
import * as argon2 from "argon2";
import {
	authGithubCallbackTotal,
	authLoginLocalTotal,
	authPasswordVerifySeconds,
	authRegisterTotal,
} from "../metrics";

/* sinclair typebox schema */
export const RegistrationSchema = Type.Object({
	loginName: Type.String({ minLength: 3 }),
	email: Type.String({ format: "email" }),
	password: Type.String({ minLength: 8 }),
});

export const LoginSchema = Type.Object({
	identifier: Type.String({ minLength: 3 }), // Can't be shorter than the shortest loginName
	password: Type.String({ minLength: 8 }), // Must match your registration rules
});

// this makes a specific Type for request.body that will
export type RegisterType = Static<typeof RegistrationSchema>;
export type LoginType = Static<typeof LoginSchema>;

/**
 * Atomic helper to create a User and an associated Account in one transaction.
 * This ensures we never have a "ghost user" without an authentication method.
 */
async function createUserAndAccount(db: any, user: schema.NewUser, account: Omit<schema.NewAccount, "userId">) {
	return await db.transaction(async (tx: any) => {
		const [insertedUser] = await tx.insert(schema.users).values(user).returning();
		await tx.insert(schema.accounts).values({
			...account,
			userId: insertedUser.id,
		});
		return insertedUser;
	});
}

/**
 * Helper: Find a user by email or login name.
 * Encapsulates the OR logic for identity checks.
 */
async function findUserByIdentifier(db: any, identifier: string) {
	const [user] = await db
		.select()
		.from(schema.users)
		.where(or(eq(schema.users.email, identifier), eq(schema.users.loginName, identifier)));
	return user;
}

/**
 * Helper: Find an account by its external provider identity.
 */
async function findAccount(db: any, provider: any, providerAccountId: string) {
	const [account] = await db
		.select()
		.from(schema.accounts)
		.where(and(eq(schema.accounts.provider, provider), eq(schema.accounts.providerAccountId, providerAccountId)));
	return account;
}

export const authRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
	// this function will receive the token from github (it is called by github)
	// - needs to check if there is a user already with this info
	// - needs to either create the user or give them a session
	server.get("/login/github/callback", async function (request, reply) {
		let gitToken;
		try {
			gitToken = await server.githubOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);
		} catch (err) {
			authGithubCallbackTotal.labels("error_oauth").inc();
			throw err;
		}
		console.log("GitHub Token:", gitToken.token.access_token);

		// get the user info using token information
		const response = await fetch("https://api.github.com/user", {
			headers: {
				Authorization: `Bearer ${gitToken.token.access_token}`,
				"User-Agent": "myceleum_catdev42",
			},
		});

		if (!response.ok) {
			authGithubCallbackTotal.labels("error_github_api").inc();
			return reply.status(502).send({ error: "GitHub API error." });
		}

		const githubUser = (await response.json()) as GithubUser;
		console.log("GitHub User Data:", githubUser);

		// DATABASE Logic
		// pull info of the user from githubUser
		const buildUser: schema.NewUser = {
			loginName: githubUser.login,
			imageURL: githubUser.avatar_url,
			role: "user",
			email: githubUser.email,
		};

		const buildAccount: schema.NewAccount = {
			userId: "", // Will be set after user is found/created
			provider: "github",
			providerAccountId: githubUser.id.toString(),
		};

		// CHECK FOR EMAIL CONFLICT (If GitHub gave us an email)
		if (buildUser.email) {
			const emailConflict = await findUserByIdentifier(server.db, buildUser.email);

			if (emailConflict) {
				const existingAccount = await findAccount(server.db, "github", githubUser.id.toString());
				
				if (existingAccount && existingAccount.userId !== emailConflict.id) {
					authGithubCallbackTotal.labels("conflict_email").inc();
					return reply.status(409).send({ error: "Email already linked to a different GitHub account." });
				}
			}
		}

		// Find or Create User/Account
		let user;
		const existingAccount = await findAccount(server.db, "github", githubUser.id.toString());

		let githubOutcome: "success_returning" | "success_new_user";
		if (existingAccount) {
			const [found] = await server.db.select().from(schema.users).where(eq(schema.users.id, existingAccount.userId));
			user = found;
			console.log("Found existing user via account:", user.id);
			githubOutcome = "success_returning";
		} else {
			try {
				user = await createUserAndAccount(server.db, buildUser, {
					provider: "github",
					providerAccountId: githubUser.id.toString(),
				});
			} catch (err) {
				authGithubCallbackTotal.labels("error_create").inc();
				throw err;
			}
			console.log("Created new user and linked account:", user.id);
			githubOutcome = "success_new_user";
		}

		authGithubCallbackTotal.labels(githubOutcome).inc();
		// CREATE SESSION & COOKIE (using Helper)
		await createSession(request, reply, server.db, user.id);
		return reply.redirect(getOrigin(request));
	});

	// separate one for checking session/cookie
	server.get("/", async (request, reply) => {
		const session = await verifySession(request, server.db);
		if (session) {
			return reply.redirect(getHomeURL(request));
		}

		// If headers indicate this is a browser request, redirect to login
		if (request.headers.accept?.includes("text/html")) {
			return reply.redirect(getOrigin(request) + "/login");
		}

		// Otherwise, return a JSON status for API/Ping tools
		return {
			service: "auth",
			status: "running",
			authenticated: false,
		};
	});

	// local registration
	server.post("/register", { schema: { body: RegistrationSchema } }, async (request, reply) => {
		const existingUser = await verifySession(request, server.db);
		if (existingUser) {
			return reply.redirect(getHomeURL(request)); // Already logged in! Avoid registering.
		}

		const { loginName, email, password } = request.body as RegisterType;

		// Check for existing users
		const userExists = await findUserByIdentifier(server.db, loginName || email);

		if (userExists) {
			const conflict = userExists.loginName === loginName ? "conflict_login" : "conflict_email";
			authRegisterTotal.labels(conflict).inc();
			const message = userExists.loginName === loginName ? "Login name already taken." : "Email already registered.";
			return reply.status(409).send({ error: message });
		}

		// Hash password (placeholder for now)
		const passwordHash = await argon2.hash(password, {
			timeCost: 10, // The number of iterations
			memoryCost: 2 ** 16, // 64MB of RAM
			parallelism: 2, // Number of threads
		});

		const buildUser: schema.NewUser = {
			loginName: loginName,
			email: email,
			role: "user",
		};

		const buildAccount: schema.NewAccount = {
			userId: "", // Set after insert
			provider: "local",
			providerAccountId: loginName,
			passwordHash: passwordHash,
		};

		try {
			const newUser = await createUserAndAccount(server.db, buildUser, buildAccount);
			authRegisterTotal.labels("success").inc();
			// Create a session for the new user immediately
			await createSession(request, reply, server.db, newUser.id);
			// Redirect to the Home URL (likely /notes)
			return reply.redirect(getOrigin(request));
		} catch (err) {
			server.log.error(err); // Manual logging becasue WE catch it not fastify. custom err message
			authRegisterTotal.labels("error").inc();
			return reply.status(500).send({ error: "Failed to create user account. Please try again later." });
		}
	});
	// local login
	server.post("/login", { schema: { body: LoginSchema } }, async (request, reply) => {
		const session = await verifySession(request, server.db);
		if (session) {
			return reply.redirect(getHomeURL(request)); // Already logged in! Avoid registering.
		}

		const { identifier, password } = request.body as LoginType;

		const user = await findUserByIdentifier(server.db, identifier);
		if (!user) {
			authLoginLocalTotal.labels("fail_user_not_found").inc();
			return reply.status(401).send({ error: "Invalid credentials." });
		}

		const account = await findAccount(server.db, "local", user.loginName);
		if (!account || !account.passwordHash) {
			authLoginLocalTotal.labels("fail_no_local_account").inc();
			return reply.status(401).send({ error: "Invalid credentials." });
		}

		const verifyDone = authPasswordVerifySeconds.startTimer();
		const isMatch = await argon2.verify(account.passwordHash, password);
		verifyDone();

		if (!isMatch) {
			authLoginLocalTotal.labels("fail_wrong_password").inc();
			return reply.status(401).send({ error: "Invalid credentials." });
		}

		authLoginLocalTotal.labels("success").inc();
		// Create session & redirect
		await createSession(request, reply, server.db, user.id);
		return reply.redirect(getHomeURL(request));
	});
};
