import { pgTable, pgEnum, serial, text, boolean, timestamp, integer, unique, uuid } from "drizzle-orm/pg-core";
import { type InferSelectModel, type InferInsertModel } from "drizzle-orm";

export const providerEnum = pgEnum("provider_type", ["github", "local", "google", "42"]);
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const userStatusEnum = pgEnum("status", ["active", "blocked", "suspended"]);

// 1. Tables

export const users = pgTable("users", {
	id: uuid("id").defaultRandom().primaryKey(),
	loginName: text("login_name").unique().notNull(),
	email: text("email").unique(),
	role: roleEnum("role").notNull().default("user"),
	status: userStatusEnum("status").notNull().default("active"),
	created_at: timestamp("created_at").defaultNow(),
});

export const accounts = pgTable(
	"accounts",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id")
			.references(() => users.id, { onDelete: "cascade" })
			.notNull(),
		provider: providerEnum("provider").notNull(),
		providerId: text("provider_id").notNull(),
		passwordHash: text("password_hash"),
		created_at: timestamp("created_at").defaultNow(),
	},
	(table) => [unique("account_provider_unique").on(table.provider, table.providerId)],
);

export const sessions = pgTable("sessions", {
	id: serial("id").primaryKey(),
	token: uuid("token").defaultRandom().notNull().unique(),
	user_id: uuid("user_id")
		.references(() => users.id, { onDelete: "cascade" })
		.notNull(),
	role: roleEnum("user_role").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	userAgent: text("user_agent"), // For device tracking
	ipAddress: text("ip_address"),
});

// 2. Export the Types

// Type for READING form the DB (includes all fields like ID and createdAt)
export type User = InferSelectModel<typeof users>;
export type Account = InferSelectModel<typeof accounts>;
export type Session = InferSelectModel<typeof sessions>;

// Type for INSERTING into the DB (ID and createdAt are optional b/c they have defaults)
export type NewUser = InferInsertModel<typeof users>;
export type NewAccount = InferInsertModel<typeof accounts>;
export type NewSession = InferInsertModel<typeof sessions>;
