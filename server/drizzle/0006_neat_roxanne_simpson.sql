ALTER TABLE "users" ADD COLUMN "opaque_registration_record" text NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "srp_salt";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "srp_verifier";