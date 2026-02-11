import Fastify, { FastifyRequest, FastifyReply } from "fastify";
import fastifyJwt from "@fastify/jwt";
import { getJwtSecret } from "./config.js"; // Import your new helper
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "./db.js";
import { users } from "./schema.js";

// 1. Define the shape of your Body
interface RegisterBody {
	username: string;
	email: string;
	password: string;
}

interface LoginBody {
	email: string;
	password: string;
}

const fastify = Fastify({ logger: true });

// 1. Register JWT Plugin
// The 'secret' is used to sign the tokens. In production, use an ENV variable.

fastify.register(fastifyJwt, {
	secret: getJwtSecret(),
});

fastify.get("/test-token", async (request, reply) => {
	const token = fastify.jwt.sign({ user: "myakoven", project: "transcendence" });
	return { token };
});

//-- ROUTES

//Register: create a new user
fastify.post<{ Body: RegisterBody }>("/register", async (request, reply) => {
	const { username, email, password } = request.body; // No more 'as any'

	//hash the password (10 "rounds" of scramblin)
	const hashedPassword = await bcrypt.hash(password, 10);

	try {
		const newUser = await db
			.insert(users)
			.values({
				username,
				email,
				password: hashedPassword,
			})
			.returning();
		return { message: "User created", user: { id: newUser[0].id, username: newUser[0].username } };
	} catch (e: any) {
		fastify.log.error(e);
		if (e.code === "SQLITE_CONSTRAINT_UNIQUE") {
			return reply.status(400).send({ error: "Username or Email already exists" });
		}
		return reply.status(500).send({ error: "Internal Server Error during registration" });
	}
});

// LOGIN: Verify user and give them a "Passport" (JWT)

fastify.post<{ Body: LoginBody }>("/login", async (request, reply) => {
	const { email, password } = request.body;

	//find user

	const user = await db.select().from(users).where(eq(users.email, email)).get();

	if (!user) {
		return reply.status(401).send({ error: "Invalid credentials" });
	}

	const isMatch = await bcrypt.compare(password, user.password);

	if (!isMatch) {
		return reply.status(401).send({ error: "Invalid credentials" });
	}

	// Create token
	// Put the userId in the token so the App service can rread it later
	const token = fastify.jwt.sign({
		userId: user.id,
		username: user.username,
	});
	return { token };
});

const start = async () => {
	try {
		await fastify.listen({ port: 3001, host: "0.0.0.0" });
		console.log("Myceleum Auth Service running on port 3001");
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
};

start();
