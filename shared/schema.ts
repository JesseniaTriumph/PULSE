import { sql } from "drizzle-orm";
import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoles = ["admin", "instructor"] as const;
export type UserRole = (typeof userRoles)[number];

export const attendanceTypes = [
  "Absent",
  "Late/Tardy",
  "Unexcused",
] as const;
export type AttendanceType = (typeof attendanceTypes)[number];

export const excuseCategories = [
  "Sick/Medical",
  "Personal",
  "Program Event",
  "Technical Issue",
  "Other",
  "None",
] as const;
export type ExcuseCategory = (typeof excuseCategories)[number];

export const cohortNames = ["L1", "L2", "L3", "L∞"] as const;
export type CohortName = (typeof cohortNames)[number];

export const messageSources = ["gmail", "slack"] as const;
export type MessageSource = (typeof messageSources)[number];

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("instructor"),
  googleId: text("google_id").unique(),
  googleAccessToken: text("google_access_token"),
  googleRefreshToken: text("google_refresh_token"),
  slackUserId: text("slack_user_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const cohorts = pgTable("cohorts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  instructorId: integer("instructor_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const studentStatuses = ["Active", "Graduated", "Hired"] as const;

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  cohortId: integer("cohort_id").notNull().references(() => cohorts.id),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const schedules = pgTable("schedules", {
  id: serial("id").primaryKey(),
  cohortId: integer("cohort_id").notNull().references(() => cohorts.id),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const attendanceRecords = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  studentId: integer("student_id").references(() => students.id),
  senderName: text("sender_name").notNull(),
  senderEmail: text("sender_email").notNull(),
  receivedAt: timestamp("received_at").notNull(),
  emailBody: text("email_body").notNull(),
  attendanceType: text("attendance_type").notNull().default("Absent"),
  excuseCategory: text("excuse_category").notNull(),
  messageSnippet: text("message_snippet").notNull(),
  status: text("status").notNull().default("pending"),
  batchId: text("batch_id"),
  needsResponse: boolean("needs_response").default(false),
  urgency: text("urgency").default("low"),
  alertReason: text("alert_reason"),
  mentionsStudent: boolean("mentions_student").default(false),
  mentionsSchool: boolean("mentions_school").default(false),
  peerOrSchoolDetail: text("peer_or_school_detail"),
  gmailMessageId: text("gmail_message_id"),
  gmailThreadId: text("gmail_thread_id"),
  source: text("source").notNull().default("gmail"),
  emailSubject: text("email_subject"),
  slackChannelId: text("slack_channel_id"),
  slackChannelName: text("slack_channel_name"),
  slackMessageTs: text("slack_message_ts"),
  slackIsDm: boolean("slack_is_dm").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  recordId: integer("record_id").notNull().references(() => attendanceRecords.id),
  alertType: text("alert_type").notNull(),
  message: text("message").notNull(),
  urgency: text("urgency").notNull().default("low"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const slackChannelConfigs = pgTable("slack_channel_configs", {
  id: serial("id").primaryKey(),
  cohortId: integer("cohort_id").notNull().references(() => cohorts.id),
  channelId: text("channel_id").notNull(),
  channelName: text("channel_name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const scanConfigs = pgTable("scan_configs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  scanTime: text("scan_time").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  scanGmail: boolean("scan_gmail").notNull().default(true),
  scanSlack: boolean("scan_slack").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertCohortSchema = createInsertSchema(cohorts).omit({ id: true, createdAt: true });
export const insertStudentSchema = createInsertSchema(students).omit({ id: true, createdAt: true });
export const insertScheduleSchema = createInsertSchema(schedules).omit({ id: true, createdAt: true });
export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecords).omit({ id: true, createdAt: true });
export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true, createdAt: true });
export const insertSlackChannelConfigSchema = createInsertSchema(slackChannelConfigs).omit({ id: true, createdAt: true });
export const insertScanConfigSchema = createInsertSchema(scanConfigs).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Cohort = typeof cohorts.$inferSelect;
export type InsertCohort = z.infer<typeof insertCohortSchema>;
export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceRecordSchema>;
export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type SlackChannelConfig = typeof slackChannelConfigs.$inferSelect;
export type InsertSlackChannelConfig = z.infer<typeof insertSlackChannelConfigSchema>;
export type ScanConfig = typeof scanConfigs.$inferSelect;
export type InsertScanConfig = z.infer<typeof insertScanConfigSchema>;

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  displayName: z.string().min(1, "Display name is required"),
  role: z.enum(userRoles).default("instructor"),
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
