import { eq, and } from "drizzle-orm";
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";
import * as schema from "../db/schema";
import type { GithubUser } from "../types";
import { createSession } from "./session_helpers";
import { getOrigin } from "./auth_utils";

export const authRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
	// this function will receive the token
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
		const thisUser: schema.NewUser = {
			loginName: githubUser.login,
			providerId: githubUser.id.toString(),
			provider: "github",
			email: githubUser.email,
			role: "user",
		};

		// Find or Create User
		const existingUsers = await server.db.select().from(schema.users).where(eq(schema.users.providerId, thisUser.providerId));

		let user;
		if (existingUsers.length > 0) {
			console.log("Found existing user:", existingUsers[0].id);
			user = existingUsers[0];
		} else {
			const [inserted] = await server.db.insert(schema.users).values(thisUser).returning();
			user = inserted;
			console.log("Created new user:", user.id);
		}

		// CREATE SESSION & COOKIE (using Helper)
		await createSession(request, reply, server.db, user.id, user.role || "user");
		return reply.redirect(getOrigin(request));
	});

	// separate one for checking session/cookie
	server.get("/", async (request, reply) => {
		return { message: "Auth service root placeholder" };
	});

	// local login placeholder
	server.get("/login", async (request, reply) => {

		
		return { message: "Local login placeholder: local path not yet set up" };
	});
};
