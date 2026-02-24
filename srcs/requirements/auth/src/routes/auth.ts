import { eq, and } from "drizzle-orm";
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";
import * as schema from "../db/schema";
import type { GithubUser } from "../types";

/**
 * A 'Pure helper' to reconstruct the absolute Origin of the request.
 * It is outside the registration logic because it is a universal truth
 * regardless of which route is calling it.
 */
const getOrigin = (request: FastifyRequest): string => {
	// const protocol = (request.headers["x-forwarded-proto"] as string) || "http";
	// const host = request.headers["host"];
	const protocol = (request.headers["x-forwarded-proto"] as string) || "http";
	const host = request.headers["host"];
	const origin = `${protocol}://${host}`;

	// Hierarchy of Choice
	const fallback = "/notes";
	const referer = request.headers["referer"];

	// We check if the referer exists AND if it belongs to our own website
	// (We don't want to redirect them to a malicious site by accident!)
	const targetUrl = referer && referer.startsWith(origin) ? referer : `${origin}${fallback}`;

	console.log("Redirect after login to: ", targetUrl);
	return `${targetUrl}`;
};

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
			provider_id: githubUser.id.toString(),
			provider: "github",
			email: githubUser.email,
			role: "user",
		};
		
		// Find or Create User
		const existingUsers = await server.db.select().from(schema.users).where(eq(schema.users.provider_id, thisUser.provider_id));

		let user;
		if (existingUsers.length > 0) {
			console.log("Found existing user:", existingUsers[0].id);
			user = existingUsers[0];
		} else {
			const [inserted] = await server.db.insert(schema.users).values(thisUser).returning();
			user = inserted;
			console.log("Created new user:", user.id);
		}

		// CREATE SESSION
		const expiresAt = new Date();
		expiresAt.setHours(expiresAt.getHours() + 24 * 7); // Valid for 1 week

		// Create a session row and get the session token (uuid) of the session for cookie
		const [session] = await server.db
			.insert(schema.sessions)
			.values({
				user_id: user.id,
				role: user.role,
				expiresAt: expiresAt,
				userAgent: request.headers["user-agent"],
				ipAddress: request.ip,
			})
			.returning();

		// SET THE IDENTITY TICKET (The Cookie)
		console.log(`Creating session for User ${user.id}, Token: ${session.token}`);
		return reply
			.setCookie("session_id", session.token, {
				path: "/",
				httpOnly: true,
				secure: false, // Set to TRUE when using real HTTPS
				sameSite: "lax",
				expires: expiresAt,
				signed: true,
			})
			.redirect(getOrigin(request));
	});

	// separate one for checking session/cookie
	server.get("/", async (request, reply) => {
		return { message: "Auth service root placeholder" };
	});

	// local login placeholder
	server.get("/login", async (request, reply) => {
		return { message: "Local login placeholder" };
	});
};
