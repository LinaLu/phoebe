import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const familyMembers = pgTable("family_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  relationship: text("relationship").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const medicalRecords = pgTable("medical_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  familyMemberId: uuid("family_member_id")
    .references(() => familyMembers.id)
    .notNull(),
  encryptedData: text("encrypted_data").notNull(), // Base64 cipher text
  iv: text("iv").notNull(), // Base64 initialization vector
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
