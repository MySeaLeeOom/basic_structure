import { pgTable,pgEnum, serial, text, boolean, timestamp, integer} from "drizzle-orm/pg-core";
import { type InferSelectModel, type InferInsertModel } from "drizzle-orm";

export const providerEnum = pgEnum('provider_type', ['github', 'local', 'google', '42']);
export const roleEnum = pgEnum('role', ['user','admin']);
export const userStatusEnum = pgEnum('status', ['active','blocked', 'suspened']);

// Export tables

export const users= pgTable('users', {
	id: serial('id').primaryKey(),
	provider: providerEnum('provider').notNull().default('local'),
	provider_id: text('provider_id').notNull(),
	email: text('email').notNull(),
	passwordHash: text('password_hash'),
	role: roleEnum('role').notNull(). default('user'),
	status:userStatusEnum('status').notNull().default('active'),
	created_at: timestamp().defaultNow()
})

export const sessions = pgTable('sessions', {
	id: serial('id').primaryKey(),
    user_id: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
	role: roleEnum('user_role').notNull(),
	expiresAt: timestamp('expires_at').notNull()
})

// 2. Export the Types

// Type for READING form the DB (includes all fields like ID and createdAt)
export type User = InferSelectModel<typeof users>;
export type Session = InferSelectModel<typeof sessions>;

// Type for INSERTING into the DB (ID and createdAt are optional b/c they have defaults)
export type NewUser = InferInsertModel<typeof users>;
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
