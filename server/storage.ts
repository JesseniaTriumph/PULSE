import { db } from "./db";
import {
  users, attendanceRecords, cohorts, students, schedules, alerts, scanConfigs, slackChannelConfigs, autoReplyCooldowns, lmsConfigs, lmsSyncLogs,
  type User, type InsertUser,
  type AttendanceRecord, type InsertAttendanceRecord,
  type Cohort, type InsertCohort,
  type Student, type InsertStudent,
  type Schedule, type InsertSchedule,
  type Alert, type InsertAlert,
  type SlackChannelConfig, type InsertSlackChannelConfig,
  type ScanConfig, type InsertScanConfig,
  type AutoReplyCooldown, type InsertAutoReplyCooldown,
  type LmsConfig, type InsertLmsConfig,
  type LmsSyncLog, type InsertLmsSyncLog,
} from "@shared/schema";
import { eq, desc, and, sql, inArray, gt, lte } from "drizzle-orm";

export interface IStorage {
  createUser(user: InsertUser): Promise<User>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  updateUser(id: number, data: Partial<{ role: string; displayName: string }>): Promise<void>;
  updateUserGoogleTokens(userId: number, accessToken: string, refreshToken?: string): Promise<void>;
  updateUserSlackTokens(userId: number, accessToken: string | null, slackUserId?: string | null, botToken?: string | null): Promise<void>;
  getAllInstructors(): Promise<User[]>;

  createCohort(cohort: InsertCohort): Promise<Cohort>;
  getCohortById(id: number): Promise<Cohort | undefined>;
  getAllCohorts(): Promise<Cohort[]>;
  getCohortsByInstructor(instructorId: number): Promise<Cohort[]>;
  updateCohort(id: number, data: Partial<InsertCohort>): Promise<Cohort | undefined>;
  deleteCohort(id: number): Promise<void>;

  createStudent(student: InsertStudent): Promise<Student>;
  bulkCreateStudents(rows: InsertStudent[]): Promise<{ created: number; skipped: number }>;
  getStudentById(id: number): Promise<Student | undefined>;
  getStudentsByCohort(cohortId: number): Promise<Student[]>;
  getStudentsByInstructor(instructorId: number): Promise<Student[]>;
  getAllStudents(): Promise<Student[]>;
  updateStudent(id: number, data: Partial<InsertStudent>): Promise<Student | undefined>;
  deleteStudent(id: number): Promise<void>;

  createScheduleEntry(entry: InsertSchedule): Promise<Schedule>;
  getScheduleByCohort(cohortId: number): Promise<Schedule[]>;
  updateScheduleEntry(id: number, data: Partial<InsertSchedule>): Promise<Schedule | undefined>;
  deleteScheduleEntry(id: number): Promise<void>;

  getAllRecords(userId: number): Promise<AttendanceRecord[]>;
  getAllRecordsAdmin(): Promise<AttendanceRecord[]>;
  getRecordsByStudentId(studentId: number): Promise<AttendanceRecord[]>;
  getRecordsByCohort(cohortId: number): Promise<AttendanceRecord[]>;
  getRecordById(id: number): Promise<AttendanceRecord | undefined>;
  getRecordsByBatchId(batchId: string, userId: number): Promise<AttendanceRecord[]>;
  getRecordByGmailMessageId(userId: number, gmailMessageId: string): Promise<AttendanceRecord | undefined>;
  getRecordBySlackMessageTs(userId: number, channelId: string, slackMessageTs: string): Promise<AttendanceRecord | undefined>;
  createRecord(record: InsertAttendanceRecord): Promise<AttendanceRecord>;
  createRecords(records: InsertAttendanceRecord[]): Promise<AttendanceRecord[]>;
  updateRecordCategory(id: number, category: string): Promise<AttendanceRecord | undefined>;
  updateRecordStatus(id: number, status: string): Promise<AttendanceRecord | undefined>;
  deleteRecord(id: number): Promise<void>;
  deleteAllRecords(userId: number): Promise<void>;
  getStats(userId: number): Promise<{ total: number; byCategory: Record<string, number> }>;
  getStatsAdmin(): Promise<{ total: number; byCategory: Record<string, number> }>;
  getStatsByCohort(cohortId: number): Promise<{ total: number; byCategory: Record<string, number> }>;

  createAlert(alert: InsertAlert): Promise<Alert>;
  getAlertsByUser(userId: number): Promise<Alert[]>;
  getAllAlerts(): Promise<Alert[]>;
  getUnreadAlertCount(userId: number): Promise<number>;
  getAllUnreadAlertCount(): Promise<number>;
  markAlertRead(id: number): Promise<Alert | undefined>;
  markAlertUnread(id: number): Promise<Alert | undefined>;
  markAllAlertsRead(userId: number): Promise<void>;

  createSlackChannelConfig(config: InsertSlackChannelConfig): Promise<SlackChannelConfig>;
  getSlackChannelConfigsByCohort(cohortId: number): Promise<SlackChannelConfig[]>;
  getAllSlackChannelConfigs(): Promise<SlackChannelConfig[]>;
  getAllEnabledSlackChannelConfigs(): Promise<SlackChannelConfig[]>;
  getEnabledSlackChannelConfigsByUser(userId: number): Promise<SlackChannelConfig[]>;
  updateSlackChannelConfig(id: number, data: Partial<InsertSlackChannelConfig>): Promise<SlackChannelConfig | undefined>;
  deleteSlackChannelConfig(id: number): Promise<void>;

  createScanConfig(config: InsertScanConfig): Promise<ScanConfig>;
  getScanConfigsByUser(userId: number): Promise<ScanConfig[]>;
  getAllEnabledScanConfigs(): Promise<ScanConfig[]>;
  updateScanConfig(id: number, data: Partial<InsertScanConfig>): Promise<ScanConfig | undefined>;
  deleteScanConfig(id: number): Promise<void>;

  getAutoReplyCooldown(userId: number, senderEmail: string): Promise<AutoReplyCooldown | undefined>;
  setAutoReplyCooldown(userId: number, senderEmail: string, cooldownDays: number): Promise<AutoReplyCooldown>;
  deleteExpiredCooldowns(): Promise<void>;

  getLmsConfigsByUser(userId: number): Promise<LmsConfig[]>;
  getLmsConfigById(id: number): Promise<LmsConfig | undefined>;
  createLmsConfig(config: InsertLmsConfig): Promise<LmsConfig>;
  updateLmsConfig(id: number, data: Partial<InsertLmsConfig>): Promise<LmsConfig | undefined>;
  deleteLmsConfig(id: number): Promise<void>;

  createLmsSyncLog(log: InsertLmsSyncLog): Promise<LmsSyncLog>;
  getLmsSyncLogsByRecord(recordId: number): Promise<LmsSyncLog[]>;
  updateRecordLmsSync(recordId: number, synced: boolean, externalId?: string, action?: string): Promise<AttendanceRecord | undefined>;
}

export class DatabaseStorage implements IStorage {
  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user;
  }

  async updateUser(id: number, data: Partial<{ role: string; displayName: string }>): Promise<void> {
    await db.update(users).set(data).where(eq(users.id, id));
  }

  async updateUserGoogleTokens(userId: number, accessToken: string, refreshToken?: string): Promise<void> {
    const updateData: Record<string, string> = { googleAccessToken: accessToken };
    if (refreshToken) {
      updateData.googleRefreshToken = refreshToken;
    }
    await db.update(users).set(updateData).where(eq(users.id, userId));
  }

  async updateUserSlackTokens(userId: number, accessToken: string | null, slackUserId?: string | null, botToken?: string | null): Promise<void> {
    const updateData: Record<string, string | null> = { slackAccessToken: accessToken };
    if (slackUserId !== undefined) updateData.slackUserId = slackUserId;
    if (botToken !== undefined) updateData.slackBotToken = botToken;
    await db.update(users).set(updateData).where(eq(users.id, userId));
  }

  async getAllInstructors(): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, "instructor"));
  }

  async createCohort(cohort: InsertCohort): Promise<Cohort> {
    const [created] = await db.insert(cohorts).values(cohort).returning();
    return created;
  }

  async getCohortById(id: number): Promise<Cohort | undefined> {
    const [cohort] = await db.select().from(cohorts).where(eq(cohorts.id, id));
    return cohort;
  }

  async getAllCohorts(): Promise<Cohort[]> {
    return db.select().from(cohorts).orderBy(cohorts.name);
  }

  async getCohortsByInstructor(instructorId: number): Promise<Cohort[]> {
    return db.select().from(cohorts).where(eq(cohorts.instructorId, instructorId)).orderBy(cohorts.name);
  }

  async updateCohort(id: number, data: Partial<InsertCohort>): Promise<Cohort | undefined> {
    const [updated] = await db.update(cohorts).set(data).where(eq(cohorts.id, id)).returning();
    return updated;
  }

  async deleteCohort(id: number): Promise<void> {
    await db.delete(cohorts).where(eq(cohorts.id, id));
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    const [created] = await db.insert(students).values(student).returning();
    return created;
  }

  async bulkCreateStudents(rows: InsertStudent[]): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;
    for (const row of rows) {
      const existing = await db.select().from(students).where(eq(students.email, row.email)).limit(1);
      if (existing.length > 0) { skipped++; continue; }
      await db.insert(students).values(row);
      created++;
    }
    return { created, skipped };
  }

  async getStudentById(id: number): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.id, id));
    return student;
  }

  async getStudentsByCohort(cohortId: number): Promise<Student[]> {
    return db.select().from(students).where(eq(students.cohortId, cohortId)).orderBy(students.name);
  }

  async getStudentsByInstructor(instructorId: number): Promise<Student[]> {
    const instructorCohorts = await this.getCohortsByInstructor(instructorId);
    if (instructorCohorts.length === 0) return [];
    const cohortIds = instructorCohorts.map(c => c.id);
    return db.select().from(students).where(inArray(students.cohortId, cohortIds)).orderBy(students.name);
  }

  async getAllStudents(): Promise<Student[]> {
    return db.select().from(students).orderBy(students.name);
  }

  async updateStudent(id: number, data: Partial<InsertStudent>): Promise<Student | undefined> {
    const [updated] = await db.update(students).set(data).where(eq(students.id, id)).returning();
    return updated;
  }

  async deleteStudent(id: number): Promise<void> {
    await db.delete(students).where(eq(students.id, id));
  }

  async createScheduleEntry(entry: InsertSchedule): Promise<Schedule> {
    const [created] = await db.insert(schedules).values(entry).returning();
    return created;
  }

  async getScheduleByCohort(cohortId: number): Promise<Schedule[]> {
    return db.select().from(schedules)
      .where(eq(schedules.cohortId, cohortId))
      .orderBy(schedules.dayOfWeek, schedules.startTime);
  }

  async updateScheduleEntry(id: number, data: Partial<InsertSchedule>): Promise<Schedule | undefined> {
    const [updated] = await db.update(schedules).set(data).where(eq(schedules.id, id)).returning();
    return updated;
  }

  async deleteScheduleEntry(id: number): Promise<void> {
    await db.delete(schedules).where(eq(schedules.id, id));
  }

  async getAllRecords(userId: number): Promise<AttendanceRecord[]> {
    return db.select().from(attendanceRecords)
      .where(eq(attendanceRecords.userId, userId))
      .orderBy(desc(attendanceRecords.createdAt));
  }

  async getAllRecordsAdmin(): Promise<AttendanceRecord[]> {
    return db.select().from(attendanceRecords)
      .orderBy(desc(attendanceRecords.createdAt));
  }

  async getRecordsByStudentId(studentId: number): Promise<AttendanceRecord[]> {
    return db.select().from(attendanceRecords)
      .where(eq(attendanceRecords.studentId, studentId))
      .orderBy(desc(attendanceRecords.createdAt));
  }

  async getRecordsByCohort(cohortId: number): Promise<AttendanceRecord[]> {
    const cohortStudents = await this.getStudentsByCohort(cohortId);
    if (cohortStudents.length === 0) return [];
    const studentIds = cohortStudents.map(s => s.id);
    return db.select().from(attendanceRecords)
      .where(inArray(attendanceRecords.studentId, studentIds))
      .orderBy(desc(attendanceRecords.createdAt));
  }

  async getRecordById(id: number): Promise<AttendanceRecord | undefined> {
    const [record] = await db.select().from(attendanceRecords).where(eq(attendanceRecords.id, id));
    return record;
  }

  async getRecordsByBatchId(batchId: string, userId: number): Promise<AttendanceRecord[]> {
    return db.select().from(attendanceRecords)
      .where(and(eq(attendanceRecords.batchId, batchId), eq(attendanceRecords.userId, userId)))
      .orderBy(desc(attendanceRecords.createdAt));
  }

  async getRecordByGmailMessageId(userId: number, gmailMessageId: string): Promise<AttendanceRecord | undefined> {
    const [record] = await db.select().from(attendanceRecords)
      .where(and(eq(attendanceRecords.userId, userId), eq(attendanceRecords.gmailMessageId, gmailMessageId)));
    return record;
  }

  async getRecordBySlackMessageTs(userId: number, channelId: string, slackMessageTs: string): Promise<AttendanceRecord | undefined> {
    const [record] = await db.select().from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.userId, userId),
        eq(attendanceRecords.slackChannelId, channelId),
        eq(attendanceRecords.slackMessageTs, slackMessageTs),
      ));
    return record;
  }

  async createRecord(record: InsertAttendanceRecord): Promise<AttendanceRecord> {
    const [created] = await db.insert(attendanceRecords).values(record).returning();
    return created;
  }

  async createRecords(records: InsertAttendanceRecord[]): Promise<AttendanceRecord[]> {
    if (records.length === 0) return [];
    return db.insert(attendanceRecords).values(records).returning();
  }

  async updateRecordCategory(id: number, category: string): Promise<AttendanceRecord | undefined> {
    const [updated] = await db
      .update(attendanceRecords)
      .set({ excuseCategory: category })
      .where(eq(attendanceRecords.id, id))
      .returning();
    return updated;
  }

  async updateRecordStatus(id: number, status: string): Promise<AttendanceRecord | undefined> {
    const [updated] = await db
      .update(attendanceRecords)
      .set({ status })
      .where(eq(attendanceRecords.id, id))
      .returning();
    return updated;
  }

  async deleteRecord(id: number): Promise<void> {
    await db.delete(alerts).where(eq(alerts.recordId, id));
    await db.delete(attendanceRecords).where(eq(attendanceRecords.id, id));
  }

  async deleteAllRecords(userId: number): Promise<void> {
    const userRecords = await this.getAllRecords(userId);
    const recordIds = userRecords.map(r => r.id);
    if (recordIds.length > 0) {
      await db.delete(alerts).where(inArray(alerts.recordId, recordIds));
    }
    await db.delete(attendanceRecords).where(eq(attendanceRecords.userId, userId));
  }

  async getStats(userId: number): Promise<{ total: number; byCategory: Record<string, number> }> {
    const records = await db.select().from(attendanceRecords)
      .where(eq(attendanceRecords.userId, userId));
    const byCategory: Record<string, number> = {};
    for (const record of records) {
      byCategory[record.excuseCategory] = (byCategory[record.excuseCategory] || 0) + 1;
    }
    return { total: records.length, byCategory };
  }

  async getStatsAdmin(): Promise<{ total: number; byCategory: Record<string, number> }> {
    const records = await db.select().from(attendanceRecords);
    const byCategory: Record<string, number> = {};
    for (const record of records) {
      byCategory[record.excuseCategory] = (byCategory[record.excuseCategory] || 0) + 1;
    }
    return { total: records.length, byCategory };
  }

  async getStatsByCohort(cohortId: number): Promise<{ total: number; byCategory: Record<string, number> }> {
    const records = await this.getRecordsByCohort(cohortId);
    const byCategory: Record<string, number> = {};
    for (const record of records) {
      byCategory[record.excuseCategory] = (byCategory[record.excuseCategory] || 0) + 1;
    }
    return { total: records.length, byCategory };
  }

  async createAlert(alert: InsertAlert): Promise<Alert> {
    const [created] = await db.insert(alerts).values(alert).returning();
    return created;
  }

  async getAlertsByUser(userId: number): Promise<Alert[]> {
    return db.select().from(alerts)
      .where(eq(alerts.userId, userId))
      .orderBy(desc(alerts.createdAt));
  }

  async getAllAlerts(): Promise<Alert[]> {
    return db.select().from(alerts).orderBy(desc(alerts.createdAt));
  }

  async getUnreadAlertCount(userId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(alerts)
      .where(and(eq(alerts.userId, userId), eq(alerts.isRead, false)));
    return Number(result[0]?.count || 0);
  }

  async getAllUnreadAlertCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(alerts)
      .where(eq(alerts.isRead, false));
    return Number(result[0]?.count || 0);
  }

  async markAlertRead(id: number): Promise<Alert | undefined> {
    const [updated] = await db.update(alerts).set({ isRead: true }).where(eq(alerts.id, id)).returning();
    return updated;
  }

  async markAlertUnread(id: number): Promise<Alert | undefined> {
    const [updated] = await db.update(alerts).set({ isRead: false }).where(eq(alerts.id, id)).returning();
    return updated;
  }

  async markAllAlertsRead(userId: number): Promise<void> {
    await db.update(alerts).set({ isRead: true }).where(eq(alerts.userId, userId));
  }

  async createSlackChannelConfig(config: InsertSlackChannelConfig): Promise<SlackChannelConfig> {
    const [created] = await db.insert(slackChannelConfigs).values(config).returning();
    return created;
  }

  async getSlackChannelConfigsByCohort(cohortId: number): Promise<SlackChannelConfig[]> {
    return db.select().from(slackChannelConfigs).where(eq(slackChannelConfigs.cohortId, cohortId));
  }

  async getAllSlackChannelConfigs(): Promise<SlackChannelConfig[]> {
    return db.select().from(slackChannelConfigs);
  }

  async getAllEnabledSlackChannelConfigs(): Promise<SlackChannelConfig[]> {
    return db.select().from(slackChannelConfigs).where(eq(slackChannelConfigs.enabled, true));
  }

  async getEnabledSlackChannelConfigsByUser(userId: number): Promise<SlackChannelConfig[]> {
    // Join through cohorts so we only return channels belonging to this instructor's cohorts.
    // Admins pass userId=-1 convention is not used here; callers that want all channels
    // should use getAllEnabledSlackChannelConfigs() directly.
    const rows = await db
      .select({ config: slackChannelConfigs })
      .from(slackChannelConfigs)
      .innerJoin(cohorts, eq(slackChannelConfigs.cohortId, cohorts.id))
      .where(and(eq(slackChannelConfigs.enabled, true), eq(cohorts.instructorId, userId)));
    return rows.map(r => r.config);
  }

  async updateSlackChannelConfig(id: number, data: Partial<InsertSlackChannelConfig>): Promise<SlackChannelConfig | undefined> {
    const [updated] = await db.update(slackChannelConfigs).set(data).where(eq(slackChannelConfigs.id, id)).returning();
    return updated;
  }

  async deleteSlackChannelConfig(id: number): Promise<void> {
    await db.delete(slackChannelConfigs).where(eq(slackChannelConfigs.id, id));
  }

  async createScanConfig(config: InsertScanConfig): Promise<ScanConfig> {
    const [created] = await db.insert(scanConfigs).values(config).returning();
    return created;
  }

  async getScanConfigsByUser(userId: number): Promise<ScanConfig[]> {
    return db.select().from(scanConfigs).where(eq(scanConfigs.userId, userId));
  }

  async getAllEnabledScanConfigs(): Promise<ScanConfig[]> {
    return db.select().from(scanConfigs).where(eq(scanConfigs.enabled, true));
  }

  async updateScanConfig(id: number, data: Partial<InsertScanConfig>): Promise<ScanConfig | undefined> {
    const [updated] = await db.update(scanConfigs).set(data).where(eq(scanConfigs.id, id)).returning();
    return updated;
  }

  async deleteScanConfig(id: number): Promise<void> {
    await db.delete(scanConfigs).where(eq(scanConfigs.id, id));
  }

  async getAutoReplyCooldown(userId: number, senderEmail: string): Promise<AutoReplyCooldown | undefined> {
    const now = new Date();
    const [cooldown] = await db.select().from(autoReplyCooldowns)
      .where(and(eq(autoReplyCooldowns.userId, userId), eq(autoReplyCooldowns.senderEmail, senderEmail), gt(autoReplyCooldowns.expiresAt, now)));
    return cooldown;
  }

  async setAutoReplyCooldown(userId: number, senderEmail: string, cooldownDays: number): Promise<AutoReplyCooldown> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + cooldownDays * 24 * 60 * 60 * 1000);

    const [existing] = await db.select().from(autoReplyCooldowns)
      .where(and(eq(autoReplyCooldowns.userId, userId), eq(autoReplyCooldowns.senderEmail, senderEmail)));

    if (existing) {
      const [updated] = await db.update(autoReplyCooldowns)
        .set({ lastReplyAt: now, expiresAt })
        .where(and(eq(autoReplyCooldowns.userId, userId), eq(autoReplyCooldowns.senderEmail, senderEmail)))
        .returning();
      return updated;
    }

    const [created] = await db.insert(autoReplyCooldowns).values({
      userId,
      senderEmail,
      lastReplyAt: now,
      expiresAt,
    }).returning();
    return created;
  }

  async deleteExpiredCooldowns(): Promise<void> {
    const now = new Date();
    await db.delete(autoReplyCooldowns).where(lte(autoReplyCooldowns.expiresAt, now));
  }

  async getLmsConfigsByUser(userId: number): Promise<LmsConfig[]> {
    return db.select().from(lmsConfigs).where(eq(lmsConfigs.userId, userId));
  }

  async getLmsConfigById(id: number): Promise<LmsConfig | undefined> {
    const [config] = await db.select().from(lmsConfigs).where(eq(lmsConfigs.id, id));
    return config;
  }

  async createLmsConfig(config: InsertLmsConfig): Promise<LmsConfig> {
    const [created] = await db.insert(lmsConfigs).values(config).returning();
    return created;
  }

  async updateLmsConfig(id: number, data: Partial<InsertLmsConfig>): Promise<LmsConfig | undefined> {
    const [updated] = await db.update(lmsConfigs).set({ ...data, updatedAt: new Date() }).where(eq(lmsConfigs.id, id)).returning();
    return updated;
  }

  async deleteLmsConfig(id: number): Promise<void> {
    await db.delete(lmsConfigs).where(eq(lmsConfigs.id, id));
  }

  async createLmsSyncLog(log: InsertLmsSyncLog): Promise<LmsSyncLog> {
    const [created] = await db.insert(lmsSyncLogs).values(log).returning();
    return created;
  }

  async getLmsSyncLogsByRecord(recordId: number): Promise<LmsSyncLog[]> {
    return db.select().from(lmsSyncLogs).where(eq(lmsSyncLogs.recordId, recordId));
  }

  async updateRecordLmsSync(recordId: number, synced: boolean, externalId?: string, action?: string): Promise<AttendanceRecord | undefined> {
    const updateData: Record<string, any> = { lmsSynced: synced };
    if (externalId) updateData.lmsExternalId = externalId;
    if (action) updateData.assessmentAction = action;
    if (synced) updateData.lmsSyncStatus = "synced";

    const [updated] = await db.update(attendanceRecords).set(updateData).where(eq(attendanceRecords.id, recordId)).returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
