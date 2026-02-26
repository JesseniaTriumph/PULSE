import { db } from "./db";
import { attendanceRecords, type AttendanceRecord, type InsertAttendanceRecord } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  getAllRecords(): Promise<AttendanceRecord[]>;
  getRecordById(id: number): Promise<AttendanceRecord | undefined>;
  getRecordsByBatchId(batchId: string): Promise<AttendanceRecord[]>;
  createRecord(record: InsertAttendanceRecord): Promise<AttendanceRecord>;
  createRecords(records: InsertAttendanceRecord[]): Promise<AttendanceRecord[]>;
  updateRecordCategory(id: number, category: string): Promise<AttendanceRecord | undefined>;
  updateRecordStatus(id: number, status: string): Promise<AttendanceRecord | undefined>;
  deleteRecord(id: number): Promise<void>;
  deleteAllRecords(): Promise<void>;
  getStats(): Promise<{ total: number; byCategory: Record<string, number> }>;
}

export class DatabaseStorage implements IStorage {
  async getAllRecords(): Promise<AttendanceRecord[]> {
    return db.select().from(attendanceRecords).orderBy(desc(attendanceRecords.createdAt));
  }

  async getRecordById(id: number): Promise<AttendanceRecord | undefined> {
    const [record] = await db.select().from(attendanceRecords).where(eq(attendanceRecords.id, id));
    return record;
  }

  async getRecordsByBatchId(batchId: string): Promise<AttendanceRecord[]> {
    return db.select().from(attendanceRecords).where(eq(attendanceRecords.batchId, batchId)).orderBy(desc(attendanceRecords.createdAt));
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

  async deleteAllRecords(): Promise<void> {
    await db.delete(attendanceRecords);
  }

  async getStats(): Promise<{ total: number; byCategory: Record<string, number> }> {
    const records = await db.select().from(attendanceRecords);
    const byCategory: Record<string, number> = {};
    for (const record of records) {
      byCategory[record.excuseCategory] = (byCategory[record.excuseCategory] || 0) + 1;
    }
    return { total: records.length, byCategory };
  }
}

export const storage = new DatabaseStorage();
