ALTER TYPE "public"."role" RENAME TO "user_role";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "role" TO "user_role";