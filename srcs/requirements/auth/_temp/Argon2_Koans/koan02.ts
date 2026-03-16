// First, we must add the strength: pnpm add argon2
import * as argon2 from "argon2";

async function demonstrateTime() {
	const password = "my-secret-password";

	// The fast path (like SHA-256)
	console.time("Fast Hash");
	// (Simulated conceptual fast hash)
	console.timeEnd("Fast Hash");

	// The Argon2 path: We intentionally make the CPU work.
	console.log("Starting Argon2 grind...");
	console.time("Argon2 Hash");

	const hash = await argon2.hash(password, {
		timeCost: 10, // The number of iterations
		memoryCost: 2 ** 16, // 64MB of RAM
		parallelism: 2, // Number of threads
	});

	console.timeEnd("Argon2 Hash");
	console.log(`Argon2 Output: ${hash}`);
}

demonstrateTime();
