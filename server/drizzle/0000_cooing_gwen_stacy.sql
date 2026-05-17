CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"path" varchar(257) NOT NULL,
	"file_size" bigint NOT NULL,
	"encrypted_name_data" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"folder_id" uuid
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"parent_id" uuid,
	"encrypted_name_data" text,
	"encrypted_key_data" text NOT NULL,
	"owner_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_access" (
	"access_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"file_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"encrypted_file_key" text NOT NULL,
	"share_duration" integer NOT NULL,
	"created_at" date DEFAULT CURRENT_DATE NOT NULL,
	"x25519_ephemeral_public" text,
	"mlkem_ciphertext" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"username" varchar(25) NOT NULL,
	"email" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"srp_salt" varchar(255) NOT NULL,
	"srp_verifier" text NOT NULL,
	"kdf_salt" varchar(255) NOT NULL,
	"user_rsa_public" text NOT NULL,
	"encrypted_user_rsa_private" text NOT NULL,
	"public_keys_bundle" text NOT NULL,
	"encrypted_seed" text NOT NULL,
	"encrypted_ark" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_access" ADD CONSTRAINT "user_access_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_access" ADD CONSTRAINT "user_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;