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
		//TODO TODO
		// ADD LOGIC IF USER EXISTS... if exists, just log them in... which means send them back a session cookie
		const existingUsers = await server.db.select().from(schema.users).where(eq(schema.users.provider_id, thisUser.provider_id));
		//select() always returns an array. To see if a user exists, we check if the length of that array is greater than zero.
		if (existingUsers.length > 0) {
			console.log("Found existing user:", existingUsers[0].id);

			const origin = getOrigin(request);
			console.log("Detected Origin:", origin);

		

			//TODO replace this with actual session creation and redirect
			return reply.send({
				access_token: gitToken.token.access_token,
				user: existingUsers[0],
				redirect_to: `${origin}/`,
			});
		}

		// For now, let's just insert and see it work
		const user = await server.db.insert(schema.users).values(thisUser).returning();
		console.log("DB User:", user);

		reply.send({ access_token: gitToken.token.access_token });
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
