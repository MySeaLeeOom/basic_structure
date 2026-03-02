import { or, eq, and } from "drizzle-orm";
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type, type Static } from "@sinclair/typebox";
import * as schema from "../db/schema";
import type { GithubUser } from "../types";
import { createSession, verifySession } from "../lib/session_helpers";
import { getHomeURL, getOrigin } from "../lib/auth_utils";
import * as argon2 from "argon2";

// sinclair typebox schema
export const RegistrationSchema = Type.Object({
	loginName: Type.String({ minLength: 3 }),
	email: Type.String({ format: "email" }),
	password: Type.String({ minLength: 12 }),
});

export const LoginSchema = Type.Object({
	identifier: Type.String({ minLength: 3 }), // Can't be shorter than the shortest loginName
	password: Type.String({ minLength: 12 }), // Must match your registration rules
});

// this makes a specific Type for request.body that will
export type RegisterType = Static<typeof RegistrationSchema>;
export type LoginType = Static<typeof LoginSchema>;

export const authRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
	// this function will receive the token from github (it is called by github)
	// - needs to check if there is a user already with this info
	// - needs to either create the user or give them a session
	server.get("/login/github/callback", async function (request, reply) {
		// get the token from github; this == request.server (if properly bound or using the instance)
		const gitToken = await server.githubOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);
		console.log("GitHub Token:", gitToken.token.access_token);

		// get the user info using token information
		const response = await fetch("https://api.github.com/user", {
			headers: {
				Authorization: `Bearer ${gitToken.token.access_token}`,
				"User-Agent": "myceleum_catdev42",
			},
		});

		if (!response.ok) {
			throw new Error(`GitHub API responded with ${response.status}`);
		}

		const githubUser = (await response.json()) as GithubUser;
		console.log("GitHub User Data:", githubUser);

		// DATABASE Logic
		// pull info of the user from githubUser
		const buildUser: schema.NewUser = {
			loginName: githubUser.login,
			providerId: githubUser.id.toString(),
			provider: "github",
			email: githubUser.email,
			role: "user",
		};

		// CHECK FOR EMAIL CONFLICT (If GitHub gave us an email)
		if (buildUser.email) {
			const emailConflict = await server.db.select().from(schema.users).where(eq(schema.users.email, buildUser.email));

			if (emailConflict.length > 0 && emailConflict[0].providerId !== buildUser.providerId) {
				// ERROR: The email is already taken by a DIFFERENT account (probably a local one)
				return reply.status(409).send({ error: "This email is already registered to a local account. Please log in with your password." });
			}
		}

		// Find or Create User
		const existingUsers = await server.db
			.select()
			.from(schema.users)
			.where(and(eq(schema.users.provider, "github"), eq(schema.users.providerId, buildUser.providerId)));

		let newUser;
		if (existingUsers.length > 0) {
			console.log("Found existing user:", existingUsers[0].id);
			newUser = existingUsers[0];
		} else {
			const [inserted] = await server.db.insert(schema.users).values(buildUser).returning();
			newUser = inserted;
			console.log("Created new user:", newUser.id);
		}

		// CREATE SESSION & COOKIE (using Helper)
		await createSession(request, reply, server.db, newUser.id, newUser.role || "user");
		return reply.redirect(getOrigin(request));
	});

	// separate one for checking session/cookie
	server.get("/", async (request, reply) => {
		const user = await verifySession(request, server.db);
		if (user) {
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
		const existingUsers = await server.db
			.select()
			.from(schema.users)
			.where(or(eq(schema.users.loginName, loginName), eq(schema.users.email, email)));

		if (existingUsers.length > 0) {
			const clash = existingUsers[0];
			const message = clash.loginName === loginName ? "Login name already taken." : "Email already registered.";
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
			provider: "local",
			providerId: loginName, // Unique for local
			email: email,
			passwordHash: passwordHash,
			role: "user",
		};

		try {
			const [newUser] = await server.db.insert(schema.users).values(buildUser).returning();
			// Create a session for the new user immediately
			await createSession(request, reply, server.db, newUser.id, newUser.role || "user");
			// Redirect to the Home URL (likely /notes)
			return reply.redirect(getOrigin(request));
		} catch (err) {
			server.log.error(err); // Manual logging becasue WE catch it not fastify. custom err message
			return reply.status(500).send({ error: "Failed to create user account. Please try again later." });
		}
	});
	// local login
	server.post("/login", { schema: { body: LoginSchema } }, async (request, reply) => {
		const existingUser = await verifySession(request, server.db);
		if (existingUser) {
			return reply.redirect(getHomeURL(request)); // Already logged in! Avoid registering.
		}

		const { identifier, password } = request.body as LoginType;

		const [user] = await server.db
			.select()
			.from(schema.users)
			.where(and(eq(schema.users.provider, "local"), or(eq(schema.users.loginName, identifier), eq(schema.users.email, identifier))));

		// Check if user exists and has a password hash
		if (!user || !user.passwordHash) {
			return reply.status(401).send({ error: "Invalid credentials." });
		}

		// Verify the password
		const isMatch = await argon2.verify(user.passwordHash, password);
		if (!isMatch) {
			return reply.status(401).send({ error: "Invalid credentials." });
		}

		// Create session & redirect
		await createSession(request, reply, server.db, user.id, user.role || "user");
		return reply.redirect(getHomeURL(request));
	});
};
