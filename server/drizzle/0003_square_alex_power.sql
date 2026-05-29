DROP TABLE "folder_permissions" CASCADE;--> statement-breakpoint
ALTER TABLE "folder_access" ADD COLUMN "can_download" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "folder_access" ADD COLUMN "can_share" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "folder_access" ADD COLUMN "can_delete" boolean DEFAULT false NOT NULL;