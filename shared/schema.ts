import { sql } from "drizzle-orm";
import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const excuseCategories = [
  "Sick/Medical",
  "Personal",
  "Program Event",
  "Technical Issue",
  "Other",
  "Unexcused",
] as const;

export type ExcuseCategory = (typeof excuseCategories)[number];

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  googleId: text("google_id").unique(),
  googleAccessToken: text("google_access_token"),
  googleRefreshToken: text("google_refresh_token"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const attendanceRecords = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  senderName: text("sender_name").notNull(),
  senderEmail: text("sender_email").notNull(),
  receivedAt: timestamp("received_at").notNull(),
  emailBody: text("email_body").notNull(),
  excuseCategory: text("excuse_category").notNull(),
  messageSnippet: text("message_snippet").notNull(),
  status: text("status").notNull().default("pending"),
  batchId: text("batch_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecords).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceRecordSchema>;

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  displayName: z.string().min(1, "Display name is required"),
});

export const emailInputSchema = z.object({
  senderName: z.string().min(1),
  senderEmail: z.string().email(),
  receivedAt: z.string(),
  emailBody: z.string().min(1),
});

export type EmailInput = z.infer<typeof emailInputSchema>;

export const batchEmailInputSchema = z.object({
  emails: z.array(emailInputSchema).min(1),
});

export * from "./models/chat";
