CREATE TYPE "public"."provider_type" AS ENUM('github', 'local', 'google', '42');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('active', 'blocked', 'suspended');--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"user_role" "role" NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" "provider_type" DEFAULT 'local' NOT NULL,
	"provider_id" text NOT NULL,
	"email" text,
	"password_hash" text,
	"role" "role" DEFAULT 'user' NOT NULL,
	"status" "status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_provider_id_unique" UNIQUE("provider","provider_id")
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;