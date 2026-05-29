ALTER TABLE "folders" RENAME COLUMN "encrypted_key_data" TO "encrypted_key_data_ark";--> statement-breakpoint
ALTER TABLE "folders" ADD COLUMN "encrypted_key_data_parent_folder" text NOT NULL;