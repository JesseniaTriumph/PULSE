import { sql } from "drizzle-orm";
import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const excuseCategories = [
  "Medical",
  "Academic",
  "Personal/Family",
  "Technical/Other",
  "Unexcused",
] as const;

export type ExcuseCategory = (typeof excuseCategories)[number];

export const attendanceRecords = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
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

export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecords).omit({
  id: true,
  createdAt: true,
});

export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceRecordSchema>;

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
