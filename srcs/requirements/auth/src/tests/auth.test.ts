import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer, type AppConfig } from "../app";
import { databaseUrl } from "../db/connections";
import { fallback } from "../lib/auth_utils";
import { sql } from "drizzle-orm";

describe("Auth Routes (Integration)", () => {
	// We need a server instance for our tests
	let server: Awaited<ReturnType<typeof buildServer>>;

	// Helper to print Logs
	function logInteraction(testName: string, req: any, res: any) {
		console.log(`\n🔹 [Test: ${testName}]`);
		console.log(`   Request: ${req.method} ${req.url}`);
		if (req.payload) console.log(`   Payload:`, JSON.stringify(req.payload));
		console.log(`   Response: Status ${res.statusCode}`);
		if (res.headers.location) console.log(`   Redirect To: ${res.headers.location}`);
		if (res.body) console.log(`   Body: ${res.body}`);
		console.log("------------------------------------------");
	}

	// Setup: Build the server before running tests
	beforeAll(async () => {
		// Log the DB URL (sanitized) to verify we are targeting the right environment
		// In Docker, this should look like postgres://... @postgres/...
		// console.log("Test Environment DB:", databaseUrl.replace(/:[^:@]*@/, ":***@"));
		console.log("Test Environment DB:", databaseUrl);

		const config: AppConfig = {
			databaseUrl: databaseUrl, // Using the dev DB for now (Caution: this writes real data)
			githubClientId: "test_client_id",
			githubClientSecret: "test_client_secret",
			sessionSecret: "a_very_long_test_secret_key_that_is_32_bytes",
			callbackUri: "http://localhost:8080/cb",
			runMigrations: false, // Assume DB is already migrated in dev
		};

		server = await buildServer(config);
		// Pre-flight cleanup: Ensure test user doesn't exist from a previous crash
		await server.db.execute(sql`DELETE FROM users WHERE email = 'bob@example.com'`);
	});

	// Note: Proper teardown happens in the final afterAll block below

	it("should register a new user successfully", async () => {
		const req = {
			method: "POST" as const,
			url: "/register",
			headers: { host: "localhost:8080" },
			payload: {
				loginName: "testuser_bob",
				email: "bob@example.com",
				password: "securePassword123!",
			},
		};
		const response = await server.inject(req);

		logInteraction("Register Success", req, response);

		// We expect a redirect (302) to the notes page upon success
		expect(response.statusCode).toBe(302);
		expect(response.headers.location).toBe(`http://localhost:8080${fallback}`);
		// Use regex to check for the session cookie
		const setCookie = response.headers["set-cookie"];
		expect(setCookie).toBeDefined();

		// Handle potential array or string (fastify inject behavior)
		const cookieVal = Array.isArray(setCookie) ? setCookie[0] : setCookie;
		expect(cookieVal).toMatch(/session_id=/);
	});

	it("should fail to register with duplicate email", async () => {
		const req = {
			method: "POST" as const,
			url: "/register",
			payload: {
				loginName: "testuser_bob_2", // Different name
				email: "bob@example.com", // SAME email
				password: "securePassword123!",
			},
		};
		const response = await server.inject(req);

		logInteraction("Register Duplicate Email", req, response);

		expect(response.statusCode).toBe(409);
		expect(response.json()).toEqual({ error: "Email already registered." });
	});

	it("should login successfully with correct credentials", async () => {
		const req = {
			method: "POST" as const,
			url: "/login",
			headers: { host: "localhost:8080" },
			payload: {
				identifier: "bob@example.com",
				password: "securePassword123!",
			},
		};
		const response = await server.inject(req);

		logInteraction("Login Success", req, response);

		expect(response.statusCode).toBe(302);
		expect(response.headers.location).toBe(`http://localhost:8080${fallback}`);
		expect(response.headers["set-cookie"]).toBeDefined();
	});

	it("should reject login with wrong password", async () => {
		const req = {
			method: "POST" as const,
			url: "/login",
			payload: {
				identifier: "bob@example.com",
				password: "wrongPassword!",
			},
		};
		const response = await server.inject(req);

		logInteraction("Login Wrong Password", req, response);
		expect(response.statusCode).toBe(401);
		expect(response.json()).toEqual({ error: "Invalid credentials." });
	});

	// Cleanup: Delete the test user so the test is repeatable
	afterAll(async () => {
		// We can access the db directly via the decorator we made!
		await server.db.execute(sql`DELETE FROM users WHERE email = 'bob@example.com'`);
		await server.close(); // Close the pool after cleanup
	});
});
