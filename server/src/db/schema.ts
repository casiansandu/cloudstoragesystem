import { 
  pgTable, 
  uuid, 
  varchar, 
  text, 
  timestamp, 
  bigint, 
  integer, 
  date,
  AnyPgColumn 
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// 1. USERS
// Renamed from srp_users to users as requested
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
  username: varchar("username", { length: 25 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  srpSalt: varchar("srp_salt", { length: 255 }).notNull(),
  srpVerifier: text("srp_verifier").notNull(),
  kdfSalt: varchar("kdf_salt", { length: 255 }).notNull(),
  userRsaPublic: text("user_rsa_public").notNull(),
  encryptedUserRsaPrivate: text("encrypted_user_rsa_private").notNull(),
  publicKeysBundle: text("public_keys_bundle").notNull(),
  encryptedSeed: text("encrypted_seed").notNull(),
  encryptedArk: text("encrypted_ark").notNull(),
});

// 2. FOLDERS
export const folders = pgTable("folders", {
  id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
  // Using AnyPgColumn to prevent the "implicitly has type any" circular reference error
  parentId: uuid("parent_id").references((): AnyPgColumn => folders.id), 
  encryptedNameData: text("encrypted_name_data"),
  encryptedKeyData: text("encrypted_key_data").notNull(),
  ownerId: uuid("owner_id").notNull().references(() => users.id), 
});

// 3. FILES
export const files = pgTable("files", {
  id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
  // bigint in Postgres, but "number" in JS for easier JSON handling
  fileSize: bigint("file_size", { mode: "number" }).notNull(), 
  encryptedNameData: text("encrypted_name_data").notNull(),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  folderId: uuid("folder_id").references(() => folders.id),
});

// 4. USER ACCESS
export const userAccess = pgTable("user_access", {
  accessId: uuid("access_id").primaryKey().default(sql`uuid_generate_v4()`),
  fileId: uuid("file_id").notNull().references(() => files.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  encryptedFileKey: text("encrypted_file_key").notNull(),
  shareDuration: integer("share_duration").notNull(),
  // Changed defaultNow() to sql`CURRENT_DATE` to match your SQL "date" type exactly
  createdAt: date("created_at").notNull().default(sql`CURRENT_DATE`),
  x25519EphemeralPublic: text("x25519_ephemeral_public"),
  mlkemCiphertext: text("mlkem_ciphertext"),
});