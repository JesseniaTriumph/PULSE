import { db } from "./db";
import { users, attendanceRecords, type User, type InsertUser, type AttendanceRecord, type InsertAttendanceRecord } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  createUser(user: InsertUser): Promise<User>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  updateUserGoogleTokens(userId: number, accessToken: string, refreshToken?: string): Promise<void>;

  getAllRecords(userId: number): Promise<AttendanceRecord[]>;
  getRecordById(id: number): Promise<AttendanceRecord | undefined>;
  getRecordsByBatchId(batchId: string, userId: number): Promise<AttendanceRecord[]>;
  createRecord(record: InsertAttendanceRecord): Promise<AttendanceRecord>;
  createRecords(records: InsertAttendanceRecord[]): Promise<AttendanceRecord[]>;
  updateRecordCategory(id: number, category: string): Promise<AttendanceRecord | undefined>;
  updateRecordStatus(id: number, status: string): Promise<AttendanceRecord | undefined>;
  deleteRecord(id: number): Promise<void>;
  deleteAllRecords(userId: number): Promise<void>;
  getStats(userId: number): Promise<{ total: number; byCategory: Record<string, number> }>;
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

  async updateUserGoogleTokens(userId: number, accessToken: string, refreshToken?: string): Promise<void> {
    const updateData: Record<string, string> = { googleAccessToken: accessToken };
    if (refreshToken) {
      updateData.googleRefreshToken = refreshToken;
    }
    await db.update(users).set(updateData).where(eq(users.id, userId));
  }

  async getAllRecords(userId: number): Promise<AttendanceRecord[]> {
    return db.select().from(attendanceRecords)
      .where(eq(attendanceRecords.userId, userId))
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
    await db.delete(attendanceRecords).where(eq(attendanceRecords.id, id));
  }

  async deleteAllRecords(userId: number): Promise<void> {
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
}

export const storage = new DatabaseStorage();
