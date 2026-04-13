import { pgTable, pgEnum, serial, text, boolean, timestamp, integer, unique, uuid } from "drizzle-orm/pg-core";
import { type InferSelectModel, type InferInsertModel } from "drizzle-orm";
import { time } from "node:console";

export const providerEnum = pgEnum("provider_type", ["github", "local", "google", "42"]);
export const roleEnum = pgEnum("user_role", ["user", "admin"]);
export const userStatusEnum = pgEnum("status", ["active", "blocked", "suspended"]);

/*
users:
	id: UUID
	email: text
	loginName: text
	image: text
	role: text
	status: text
	createsAt: timestamp
*/
export const users = pgTable("users", {
	id: uuid("id").defaultRandom().primaryKey(), // primaryKey is unique
	email: text("email").unique(), //unique
	loginName: text("login_name").unique().notNull(),
	imageURL: text("image_url"),
	userRole: roleEnum("user_role").notNull().default("user"),
	status: userStatusEnum("status").notNull().default("active"),
	createdAt: timestamp("created_at").defaultNow(),
});

/*
accounts:
	id: UUID
	userId: UUID
	provider: 'github', 'google', '42' or 'local'
	providerAccountId: text (number or email)
	passwordHash: null || text
*/

export const accounts = pgTable("accounts", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: uuid("user_id")
		.references(() => users.id, { onDelete: "cascade" })
		.notNull(),
	provider: providerEnum("provider").notNull(),
	providerAccountId: text("provider_account_id"),
	passwordHash: text("password_hash")
},(table) => [
// 		// RIGOROUS IDENTITY: A user is unique by their (provider + provider_id) pair.
		unique("user_provider_id_unique").on(table.provider, table.providerAccountId),
	],
);

/*
sessions:
	id: UUID
	userId:  UUID
	token: UUID
	expiresAt: timestamp
	userAgent: text // For device tracking
	ipAddress: text
*/

export const sessions = pgTable("sessions", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: uuid("user_id")
		.references(() => users.id, { onDelete: "cascade" })
		.notNull(),
	token: uuid("token").defaultRandom().unique().notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	userAgent: text("user_agent"),
	ipAddress: text("ip_address")
}
)

// 2. Export the Types

// Type for READING form the DB (includes all fields like ID and createdAt)
export type User = InferSelectModel<typeof users>;
export type Account = InferSelectModel<typeof accounts>;
export type Session = InferSelectModel<typeof sessions>;

// Type for INSERTING into the DB (ID and createdAt are optional b/c they have defaults)
export type NewUser = InferInsertModel<typeof users>;
export type NewAccount = InferInsertModel<typeof accounts>;
export type NewSession = InferInsertModel<typeof sessions>;

// // 1. Define the Table
// // "users" is the table name in the database
// export const users = pgTable("users", {
// 	// SERIAL: auto-incrementing integer (1, 2, 3...)
// 	id: serial("id").primaryKey(),

// 	// TEXT: standard string. We mark it as unique so no two users can have the same email
// 	email: text("email").notNull().unique(),

// 	// TEXT: for the hashed password
// 	passwordHash: text("password_hash").notNull(),

// 	// BOOLEAN: default to false
// 	isAdmin: boolean("is_admin").default(false),

// 	// TIMESTAMP: automatically set to "now()" when created
// 	createdAt: timestamp("created_at").defaultNow(),
// });
