import { readFileSync, existsSync } from "node:fs";
import { buildServer, type AppConfig } from "./app";
import { databaseUrl } from "./db/connections";
// Function to load configuration from environment and secrets
const loadConfig = (): AppConfig => {
	// 1. GITHUB CLIENT ID
	const clientIdGit = process.env.GITHUB_CLIENT_ID;
	if (!clientIdGit) {
		throw new Error("CRITICAL: GITHUB_CLIENT_ID is missing from the environment!");
	}

	const githubCallbackURL = process.env.GITHUB_CALLBACK_URL;
	if (!githubCallbackURL) {
		throw new Error("CRITICAL: GITHUB_CALLBACK_URL is missing from the environment!");
	}

	const websiteUrl = process.env.WEBSITE_URL;
	if (!websiteUrl) {
		throw new Error("CRITICAL: WEBSITE_URL is missing from the environment!");
	}

	// 2. GITHUB CLIENT SECRET
	const gitSecretPath = "/run/secrets/github_client_secret";
	let clientSecretGit = "";
	if (existsSync(gitSecretPath)) {
		clientSecretGit = readFileSync(gitSecretPath, "utf8").trim();
	} else {
		throw new Error("CRITICAL: GITHUB_CLIENT_SECRET is missing from secrets!");
	}

	// 3. SESSION SECRET
	const sessionSecretPath = "/run/secrets/session_secret_key";
	let sessionSecret = "";
	if (existsSync(sessionSecretPath)) {
		sessionSecret = readFileSync(sessionSecretPath, "utf8").trim();
	} else {
		throw new Error("CRITICAL: SESSION_SECRET_KEY is missing from secrets!");
	}

	// 4. CONFIG OBJECT
	return {
		databaseUrl: databaseUrl,
		githubClientId: clientIdGit,
		githubClientSecret: clientSecretGit,
		sessionSecret: sessionSecret,
		callbackUri: githubCallbackURL, // THIS NEEDS TO MATCH GITHUB APP SETUP
		frontendUrl: websiteUrl,
		runMigrations: true,
	};
};

// Main function to start the server
const start = async () => {
	try {
		const config = loadConfig();
		const server = await buildServer(config);

		await server.listen({ port: 3000, host: "0.0.0.0" });
		console.log("Auth Server listening at http://0.0.0.0:3000");
	} catch (err) {
		console.error("Failed to start server:", err);
		process.exit(1);
	}
};

start();
