import { db } from "./db";
import { attendanceRecords } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  const existing = await db.select().from(attendanceRecords).limit(1);
  if (existing.length > 0) return;

  const seedRecords = [
    {
      senderName: "Maria Garcia",
      senderEmail: "maria.garcia@university.edu",
      receivedAt: new Date("2026-02-24T08:15:00"),
      emailBody: "Good morning, I woke up with a severe migraine and nausea this morning. I've already scheduled a doctor's appointment for 10 AM. I won't be able to make it to today's session. I'll make sure to review the materials and catch up with a classmate. Thank you for understanding.",
      excuseCategory: "Medical",
      messageSnippet: "Good morning, I woke up with a severe migraine and nausea this morning. I've already scheduled a doctor's appointment for 10 AM. I won't be able to make ...",
      status: "processed",
      batchId: "seed-batch-001",
    },
    {
      senderName: "James Wilson",
      senderEmail: "j.wilson@university.edu",
      receivedAt: new Date("2026-02-24T07:45:00"),
      emailBody: "Hi, I have a midterm exam for my Statistics class that directly conflicts with today's builder session. The exam is from 2-4 PM and I need to prepare during the morning. I'll be back for the next session.",
      excuseCategory: "Academic",
      messageSnippet: "Hi, I have a midterm exam for my Statistics class that directly conflicts with today's builder session. The exam is from 2-4 PM and I need to prepare dur...",
      status: "processed",
      batchId: "seed-batch-001",
    },
    {
      senderName: "Aisha Patel",
      senderEmail: "aisha.p@university.edu",
      receivedAt: new Date("2026-02-23T19:30:00"),
      emailBody: "Hello, my grandmother is visiting from out of state and this is the only day our family can all get together. I have a family dinner tonight and need to help with preparations during the day. I apologize for the short notice.",
      excuseCategory: "Personal/Family",
      messageSnippet: "Hello, my grandmother is visiting from out of state and this is the only day our family can all get together. I have a family dinner tonight and need to ...",
      status: "processed",
      batchId: "seed-batch-001",
    },
    {
      senderName: "Tyler Brooks",
      senderEmail: "tbrooks@university.edu",
      receivedAt: new Date("2026-02-25T09:00:00"),
      emailBody: "My internet has been down since last night and the ISP says they can't send a technician until this afternoon. I've tried using my mobile hotspot but the connection keeps dropping. I won't be able to participate in today's remote session.",
      excuseCategory: "Technical/Other",
      messageSnippet: "My internet has been down since last night and the ISP says they can't send a technician until this afternoon. I've tried using my mobile hotspot but the...",
      status: "processed",
      batchId: "seed-batch-001",
    },
    {
      senderName: "Devon Kim",
      senderEmail: "devon.kim@university.edu",
      receivedAt: new Date("2026-02-25T10:20:00"),
      emailBody: "Hey, I just can't make it today. Something came up.",
      excuseCategory: "Unexcused",
      messageSnippet: "Hey, I just can't make it today. Something came up.",
      status: "processed",
      batchId: "seed-batch-001",
    },
  ];

  await db.insert(attendanceRecords).values(seedRecords);
  console.log("Seeded database with sample attendance records");
}
