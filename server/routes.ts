import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { emailInputSchema, batchEmailInputSchema, excuseCategories, insertCohortSchema, insertStudentSchema, insertScheduleSchema } from "@shared/schema";
import { categorizeExcuse, generateReplyDraft } from "./openai";
import { randomUUID } from "crypto";
import { requireAuth } from "./auth";
import { handleSlackInteraction, handleSlackEvent } from "./slack-commands";
import { setupFileIngestion } from "./file-ingestion";
import crypto from "crypto";

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  } catch (error) {
    console.error("Error in requireAdmin:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/cohorts", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(401).json({ error: "User not found" });
      const cohortList = user.role === "admin"
        ? await storage.getAllCohorts()
        : await storage.getCohortsByInstructor(user.id);
      res.json(cohortList);
    } catch (error) {
      console.error("Error fetching cohorts:", error);
      res.status(500).json({ error: "Failed to fetch cohorts" });
    }
  });

  app.post("/api/cohorts", requireAdmin, async (req, res) => {
    try {
      const { name, instructorId } = req.body;
      if (!name || !instructorId) {
        return res.status(400).json({ error: "Name and instructorId are required" });
      }
      const cohort = await storage.createCohort({ name, instructorId });
      res.status(201).json(cohort);
    } catch (error) {
      console.error("Error creating cohort:", error);
      res.status(500).json({ error: "Failed to create cohort" });
    }
  });

  app.patch("/api/cohorts/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateCohort(id, req.body);
      if (!updated) return res.status(404).json({ error: "Cohort not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating cohort:", error);
      res.status(500).json({ error: "Failed to update cohort" });
    }
  });

  app.delete("/api/cohorts/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCohort(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting cohort:", error);
      res.status(500).json({ error: "Failed to delete cohort" });
    }
  });

  app.get("/api/instructors", requireAdmin, async (_req, res) => {
    try {
      const instructors = await storage.getAllInstructors();
      res.json(instructors.map(u => ({
        id: u.id, username: u.username, email: u.email, displayName: u.displayName, role: u.role,
      })));
    } catch (error) {
      console.error("Error fetching instructors:", error);
      res.status(500).json({ error: "Failed to fetch instructors" });
    }
  });

  app.get("/api/students", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(401).json({ error: "User not found" });
      const studentList = user.role === "admin"
        ? await storage.getAllStudents()
        : await storage.getStudentsByInstructor(user.id);
      res.json(studentList);
    } catch (error) {
      console.error("Error fetching students:", error);
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  app.get("/api/students/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const student = await storage.getStudentById(id);
      if (!student) return res.status(404).json({ error: "Student not found" });
      const user = await storage.getUserById(req.session.userId!);
      if (user && user.role !== "admin") {
        const cohort = await storage.getCohortById(student.cohortId);
        if (!cohort || cohort.instructorId !== user.id) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      const records = await storage.getRecordsByStudentId(id);
      res.json({ student, records });
    } catch (error) {
      console.error("Error fetching student:", error);
      res.status(500).json({ error: "Failed to fetch student" });
    }
  });

  app.post("/api/students/import", requireAuth, async (req, res) => {
    try {
      const { students: rows, cohortId } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: "students array is required" });
      }
      const parsed: Array<{ name: string; email: string; cohortId: number; slackUserId?: string }> = [];
      const errors: string[] = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r.name?.trim() || !r.email?.trim()) {
          errors.push(`Row ${i + 1}: name and email are required`);
          continue;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim())) {
          errors.push(`Row ${i + 1}: invalid email "${r.email}"`);
          continue;
        }
        const resolvedCohortId = parseInt(r.cohortId || cohortId);
        if (!resolvedCohortId) {
          errors.push(`Row ${i + 1}: cohortId is required`);
          continue;
        }
        parsed.push({ name: r.name.trim(), email: r.email.trim().toLowerCase(), cohortId: resolvedCohortId, ...(r.slackUserId ? { slackUserId: r.slackUserId.trim() } : {}) });
      }
      const result = await storage.bulkCreateStudents(parsed);
      res.json({ ...result, errors });
    } catch (error) {
      console.error("Error importing students:", error);
      res.status(500).json({ error: "Failed to import students" });
    }
  });

  app.post("/api/students", requireAuth, async (req, res) => {
    try {
      const { name, email, cohortId } = req.body;
      if (!name || !email || !cohortId) {
        return res.status(400).json({ error: "Name, email, and cohortId are required" });
      }
      const student = await storage.createStudent({ name, email, cohortId });
      res.status(201).json(student);
    } catch (error) {
      console.error("Error creating student:", error);
      res.status(500).json({ error: "Failed to create student" });
    }
  });

  app.patch("/api/students/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const student = await storage.getStudentById(id);
      if (!student) return res.status(404).json({ error: "Student not found" });

      const user = await storage.getUserById(req.session.userId!);
      if (user && user.role !== "admin") {
        const userCohorts = await storage.getCohortsByInstructor(user.id);
        const cohortIds = userCohorts.map(c => c.id);
        if (!cohortIds.includes(student.cohortId)) {
          return res.status(403).json({ error: "Not authorized to modify this student" });
        }
      }

      const allowedFields: Record<string, boolean> = { status: true, cohortId: true, name: true, email: true, slackUserId: true, alternateEmails: true };
      const updateData: Record<string, any> = {};
      for (const key of Object.keys(req.body)) {
        if (!allowedFields[key]) continue;
        updateData[key] = req.body[key];
      }

      const validStatuses = ["Active", "Graduated", "Hired"];
      if (updateData.status && !validStatuses.includes(updateData.status)) {
        return res.status(400).json({ error: "Invalid status. Must be Active, Graduated, or Hired" });
      }
      if (updateData.cohortId) {
        const targetCohort = await storage.getCohortById(updateData.cohortId);
        if (!targetCohort) {
          return res.status(400).json({ error: "Target class does not exist" });
        }
      }

      const updated = await storage.updateStudent(id, updateData);
      if (!updated) return res.status(404).json({ error: "Student not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating student:", error);
      res.status(500).json({ error: "Failed to update student" });
    }
  });

  app.delete("/api/students/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteStudent(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting student:", error);
      res.status(500).json({ error: "Failed to delete student" });
    }
  });

  app.post("/api/cohorts/:id/promote", requireAdmin, async (req, res) => {
    try {
      const fromCohortId = parseInt(req.params.id);
      const { targetCohortId } = req.body;
      if (!targetCohortId) {
        return res.status(400).json({ error: "Target class is required" });
      }
      const parsedTarget = parseInt(targetCohortId);
      if (parsedTarget === fromCohortId) {
        return res.status(400).json({ error: "Cannot promote to the same class" });
      }
      const sourceCohort = await storage.getCohortById(fromCohortId);
      if (!sourceCohort) {
        return res.status(404).json({ error: "Source class not found" });
      }
      const targetCohort = await storage.getCohortById(parsedTarget);
      if (!targetCohort) {
        return res.status(404).json({ error: "Target class not found" });
      }
      const studentsInCohort = await storage.getStudentsByCohort(fromCohortId);
      const activeStudents = studentsInCohort.filter(s => s.status === "Active");
      let promoted = 0;
      for (const student of activeStudents) {
        await storage.updateStudent(student.id, { cohortId: parseInt(targetCohortId) });
        promoted++;
      }
      res.json({ promoted, targetCohort: targetCohort.name });
    } catch (error) {
      console.error("Error promoting class:", error);
      res.status(500).json({ error: "Failed to promote class" });
    }
  });

  app.get("/api/schedules/:cohortId", requireAuth, async (req, res) => {
    try {
      const cohortId = parseInt(req.params.cohortId);
      const user = await storage.getUserById(req.session.userId!);
      if (user && user.role !== "admin") {
        const cohort = await storage.getCohortById(cohortId);
        if (!cohort || cohort.instructorId !== user.id) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      const schedule = await storage.getScheduleByCohort(cohortId);
      res.json(schedule);
    } catch (error) {
      console.error("Error fetching schedule:", error);
      res.status(500).json({ error: "Failed to fetch schedule" });
    }
  });

  app.post("/api/schedules", requireAuth, async (req, res) => {
    try {
      const { cohortId, dayOfWeek, startTime, endTime, label } = req.body;
      if (cohortId === undefined || dayOfWeek === undefined || !startTime || !endTime || !label) {
        return res.status(400).json({ error: "All schedule fields are required" });
      }
      const entry = await storage.createScheduleEntry({ cohortId, dayOfWeek, startTime, endTime, label });
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating schedule entry:", error);
      res.status(500).json({ error: "Failed to create schedule entry" });
    }
  });

  app.patch("/api/schedules/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateScheduleEntry(id, req.body);
      if (!updated) return res.status(404).json({ error: "Schedule entry not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating schedule:", error);
      res.status(500).json({ error: "Failed to update schedule" });
    }
  });

  app.delete("/api/schedules/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteScheduleEntry(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting schedule entry:", error);
      res.status(500).json({ error: "Failed to delete schedule entry" });
    }
  });

  app.get("/api/alerts", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(401).json({ error: "User not found" });
      const alertList = user.role === "admin"
        ? await storage.getAllAlerts()
        : await storage.getAlertsByUser(req.session.userId!);

      const enriched = await Promise.all(alertList.map(async (alert) => {
        const record = await storage.getRecordById(alert.recordId);
        return {
          ...alert,
          record: record ? {
            senderName: record.senderName,
            senderEmail: record.senderEmail,
            emailBody: record.emailBody,
            messageSnippet: record.messageSnippet,
            gmailMessageId: record.gmailMessageId,
            gmailThreadId: record.gmailThreadId,
            source: record.source,
            slackChannelId: record.slackChannelId,
            slackMessageTs: record.slackMessageTs,
          } : null,
        };
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  app.get("/api/alerts/unread-count", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(401).json({ error: "User not found" });
      const count = user.role === "admin"
        ? await storage.getAllUnreadAlertCount()
        : await storage.getUnreadAlertCount(req.session.userId!);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  app.patch("/api/alerts/:id/read", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.markAlertRead(id);
      if (!updated) return res.status(404).json({ error: "Alert not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error marking alert read:", error);
      res.status(500).json({ error: "Failed to mark alert read" });
    }
  });

  app.patch("/api/alerts/:id/unread", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.markAlertUnread(id);
      if (!updated) return res.status(404).json({ error: "Alert not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error marking alert unread:", error);
      res.status(500).json({ error: "Failed to mark alert unread" });
    }
  });

  app.post("/api/alerts/mark-all-read", requireAuth, async (req, res) => {
    try {
      await storage.markAllAlertsRead(req.session.userId!);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all read:", error);
      res.status(500).json({ error: "Failed to mark all read" });
    }
  });

  app.get("/api/scan-configs", requireAuth, async (req, res) => {
    try {
      const configs = await storage.getScanConfigsByUser(req.session.userId!);
      res.json(configs);
    } catch (error) {
      console.error("Error fetching scan configs:", error);
      res.status(500).json({ error: "Failed to fetch scan configs" });
    }
  });

  app.post("/api/scan-configs", requireAuth, async (req, res) => {
    try {
      const { scanTime, enabled, scanGmail, scanSlack } = req.body;
      if (!scanTime) return res.status(400).json({ error: "scanTime is required" });
      const config = await storage.createScanConfig({
        userId: req.session.userId!,
        scanTime,
        enabled: enabled !== false,
        scanGmail: scanGmail !== false,
        scanSlack: scanSlack !== false,
      });
      res.status(201).json(config);
    } catch (error) {
      console.error("Error creating scan config:", error);
      res.status(500).json({ error: "Failed to create scan config" });
    }
  });

  app.patch("/api/scan-configs/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateScanConfig(id, req.body);
      if (!updated) return res.status(404).json({ error: "Scan config not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating scan config:", error);
      res.status(500).json({ error: "Failed to update scan config" });
    }
  });

  app.delete("/api/scan-configs/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteScanConfig(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting scan config:", error);
      res.status(500).json({ error: "Failed to delete scan config" });
    }
  });

  app.get("/api/records", requireAuth, async (req, res) => {
    try {
      const { studentId, cohortId } = req.query;
      const user = await storage.getUserById(req.session.userId!);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      if (studentId) {
        if (user.role !== "admin") {
          const student = await storage.getStudentById(parseInt(studentId as string));
          if (student) {
            const cohort = await storage.getCohortById(student.cohortId);
            if (!cohort || cohort.instructorId !== user.id) {
              return res.status(403).json({ error: "Access denied" });
            }
          }
        }
        const records = await storage.getRecordsByStudentId(parseInt(studentId as string));
        return res.json(records);
      }
      if (cohortId) {
        if (user.role !== "admin") {
          const cohort = await storage.getCohortById(parseInt(cohortId as string));
          if (!cohort || cohort.instructorId !== user.id) {
            return res.status(403).json({ error: "Access denied" });
          }
        }
        const records = await storage.getRecordsByCohort(parseInt(cohortId as string));
        return res.json(records);
      }
      if (user.role === "admin") {
        const records = await storage.getAllRecordsAdmin();
        res.json(records);
      } else {
        const records = await storage.getAllRecords(req.session.userId!);
        res.json(records);
      }
    } catch (error) {
      console.error("Error fetching records:", error);
      res.status(500).json({ error: "Failed to fetch records" });
    }
  });

  app.get("/api/records/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const record = await storage.getRecordById(id);
      if (!record || record.userId !== req.session.userId!) {
        return res.status(404).json({ error: "Record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Error fetching record:", error);
      res.status(500).json({ error: "Failed to fetch record" });
    }
  });

  app.get("/api/stats", requireAuth, async (req, res) => {
    try {
      const { cohortId } = req.query;
      const user = await storage.getUserById(req.session.userId!);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      if (cohortId) {
        if (user.role !== "admin") {
          const cohort = await storage.getCohortById(parseInt(cohortId as string));
          if (!cohort || cohort.instructorId !== user.id) {
            return res.status(403).json({ error: "Access denied" });
          }
        }
        const stats = await storage.getStatsByCohort(parseInt(cohortId as string));
        return res.json(stats);
      }
      if (user.role === "admin") {
        const stats = await storage.getStatsAdmin();
        res.json(stats);
      } else {
        const stats = await storage.getStats(req.session.userId!);
        res.json(stats);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.post("/api/process-emails", requireAuth, async (req, res) => {
    try {
      const parsed = batchEmailInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.errors });
      }

      const batchId = randomUUID();
      const { emails } = parsed.data;
      const userId = req.session.userId!;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const sendEvent = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      sendEvent({ type: "started", total: emails.length, batchId });

      const allStudents = await storage.getStudentsByInstructor(userId);

      const results = [];
      let cooldownSkipped = 0;

      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        sendEvent({ type: "processing", index: i, name: email.senderName });

        try {
          const existingCooldown = await storage.getAutoReplyCooldown(userId, email.senderEmail);
          if (existingCooldown) {
            const expiresAt = new Date(existingCooldown.expiresAt);
            if (expiresAt > new Date()) {
              console.log(`[Cooldown] Skipping ${email.senderEmail} - cooldown active until ${expiresAt.toISOString()}`);
              cooldownSkipped++;
              sendEvent({
                type: "cooldown-skipped",
                index: i,
                senderEmail: email.senderEmail,
                reason: "Within 7-day cooldown period",
              });
              continue;
            }
          }

          const categorization = await categorizeExcuse(email.emailBody);
          const snippet = email.emailBody.substring(0, 150).replace(/\n/g, " ").trim();

          const matchedStudent = allStudents.find(
            s => s.email.toLowerCase() === email.senderEmail.toLowerCase()
              || (s.alternateEmails ?? []).some(ae => ae.toLowerCase() === email.senderEmail.toLowerCase())
              || s.name.toLowerCase() === email.senderName.toLowerCase()
          );

          const record = await storage.createRecord({
            userId,
            studentId: matchedStudent?.id || null,
            senderName: email.senderName,
            senderEmail: email.senderEmail,
            receivedAt: new Date(email.receivedAt),
            emailBody: email.emailBody,
            attendanceType: categorization.attendanceType,
            excuseCategory: categorization.category,
            messageSnippet: snippet + (email.emailBody.length > 150 ? "..." : ""),
            status: "processed",
            batchId,
            needsResponse: categorization.needsResponse,
            urgency: categorization.urgency,
            alertReason: categorization.alertReason,
            mentionsStudent: categorization.mentionsStudent,
            mentionsSchool: categorization.mentionsSchool,
            peerOrSchoolDetail: categorization.peerOrSchoolDetail,
            aiConfidence: categorization.confidence,
            aiConfidenceTier: categorization.confidenceTier,
            requiresManualReview: categorization.requiresManualReview,
            assessmentAction: categorization.recommendedAssessmentAction,
            lmsSynced: false,
          });

          if (categorization.needsResponse) {
            let alertType = categorization.urgency === "high" ? "urgent" : "action_needed";
            let alertMessage = categorization.alertReason || "This email may need a response";

            if (categorization.mentionsStudent) {
              alertType = "peer_mention";
              alertMessage = `Peer mention: ${categorization.peerOrSchoolDetail || alertMessage}`;
            } else if (categorization.mentionsSchool) {
              alertType = "school_report";
              alertMessage = `School/program report: ${categorization.peerOrSchoolDetail || alertMessage}`;
            }

            await storage.createAlert({
              userId,
              recordId: record.id,
              alertType,
              message: alertMessage,
              urgency: categorization.urgency,
            });

            await storage.setAutoReplyCooldown(userId, email.senderEmail, 7);
          }

          results.push(record);
          sendEvent({
            type: "progress",
            index: i,
            record,
            categorization,
          });
        } catch (error) {
          console.error(`Error processing email ${i}:`, error);
          sendEvent({
            type: "error",
            index: i,
            name: email.senderName,
            error: "Failed to categorize",
          });
        }
      }

      sendEvent({
        type: "complete",
        total: emails.length,
        processed: results.length,
        batchId,
        cooldownSkipped,
      });
      res.end();
    } catch (error) {
      console.error("Error processing emails:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to process emails" });
      }
    }
  });

  app.patch("/api/records/:id/category", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const record = await storage.getRecordById(id);
      if (!record || record.userId !== req.session.userId!) {
        return res.status(404).json({ error: "Record not found" });
      }
      const { category } = req.body;
      if (!(excuseCategories as readonly string[]).includes(category)) {
        return res.status(400).json({ error: "Invalid category" });
      }
      const updated = await storage.updateRecordCategory(id, category);
      res.json(updated);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.patch("/api/records/:id/status", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const record = await storage.getRecordById(id);
      if (!record || record.userId !== req.session.userId!) {
        return res.status(404).json({ error: "Record not found" });
      }
      const { status } = req.body;
      const updated = await storage.updateRecordStatus(id, status);
      res.json(updated);
    } catch (error) {
      console.error("Error updating status:", error);
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  app.delete("/api/records/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const record = await storage.getRecordById(id);
      if (!record || record.userId !== req.session.userId!) {
        return res.status(404).json({ error: "Record not found" });
      }
      await storage.deleteRecord(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting record:", error);
      res.status(500).json({ error: "Failed to delete record" });
    }
  });

  app.delete("/api/records", requireAuth, async (req, res) => {
    try {
      await storage.deleteAllRecords(req.session.userId!);
      res.status(204).send();
    } catch (error) {
      console.error("Error clearing records:", error);
      res.status(500).json({ error: "Failed to clear records" });
    }
  });

  app.get("/api/export/csv", requireAuth, async (req, res) => {
    try {
      const records = await storage.getAllRecords(req.session.userId!);
      const header = "Name,Email,Date,Attendance Type,Excuse Category,Status,Message Snippet";
      const rows = records.map((r) => {
        const escapeCsv = (s: string) => `"${s.replace(/"/g, '""')}"`;
        return [
          escapeCsv(r.senderName),
          escapeCsv(r.senderEmail),
          escapeCsv(new Date(r.receivedAt).toLocaleDateString()),
          escapeCsv(r.attendanceType),
          escapeCsv(r.excuseCategory),
          escapeCsv(r.status),
          escapeCsv(r.messageSnippet),
        ].join(",");
      });
      const csv = [header, ...rows].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=attendance_report.csv");
      res.send(csv);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      res.status(500).json({ error: "Failed to export CSV" });
    }
  });

  app.get("/api/export/json", requireAuth, async (req, res) => {
    try {
      const records = await storage.getAllRecords(req.session.userId!);
      const data = records.map((r) => ({
        senderName: r.senderName,
        senderEmail: r.senderEmail,
        receivedAt: r.receivedAt,
        emailBody: r.emailBody,
        attendanceType: r.attendanceType,
        excuseCategory: r.excuseCategory,
        messageSnippet: r.messageSnippet,
        status: r.status,
        batchId: r.batchId,
        createdAt: r.createdAt,
      }));
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", "attachment; filename=attendance_report.json");
      res.send(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Error exporting JSON:", error);
      res.status(500).json({ error: "Failed to export JSON" });
    }
  });

  app.get("/api/export/doc", requireAuth, async (req, res) => {
    try {
      const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, HeadingLevel, BorderStyle } = await import("docx");
      const records = await storage.getAllRecords(req.session.userId!);

      const grouped: Record<string, typeof records> = {};
      for (const record of records) {
        if (!grouped[record.excuseCategory]) {
          grouped[record.excuseCategory] = [];
        }
        grouped[record.excuseCategory].push(record);
      }

      const sections: any[] = [];

      sections.push(
        new Paragraph({
          text: "Attendance Report",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Paragraph({
          text: `Generated: ${new Date().toLocaleDateString()} | Total Records: ${records.length}`,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      );

      for (const [category, categoryRecords] of Object.entries(grouped)) {
        sections.push(
          new Paragraph({
            text: `${category} (${categoryRecords.length})`,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 200 },
          })
        );

        const headerRow = new TableRow({
          children: ["Name", "Email", "Date", "Type", "Message Snippet"].map(
            (text) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
                width: { size: 20, type: WidthType.PERCENTAGE },
              })
          ),
        });

        const dataRows = categoryRecords.map(
          (r) =>
            new TableRow({
              children: [
                r.senderName,
                r.senderEmail,
                new Date(r.receivedAt).toLocaleDateString(),
                r.attendanceType,
                r.messageSnippet,
              ].map(
                (text) =>
                  new TableCell({
                    children: [new Paragraph({ text })],
                    width: { size: 20, type: WidthType.PERCENTAGE },
                  })
              ),
            })
        );

        sections.push(
          new Table({
            rows: [headerRow, ...dataRows],
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
      }

      const doc = new Document({
        sections: [{ children: sections }],
      });

      const buffer = await Packer.toBuffer(doc);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", "attachment; filename=attendance_report.docx");
      res.send(buffer);
    } catch (error) {
      console.error("Error exporting DOC:", error);
      res.status(500).json({ error: "Failed to export document" });
    }
  });

  app.get("/api/slack-channels", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (user.role === "admin") {
        const configs = await storage.getAllSlackChannelConfigs();
        res.json(configs);
      } else {
        const cohortList = await storage.getCohortsByInstructor(user.id);
        const configs: any[] = [];
        for (const c of cohortList) {
          const cc = await storage.getSlackChannelConfigsByCohort(c.id);
          configs.push(...cc);
        }
        res.json(configs);
      }
    } catch (error) {
      console.error("Error fetching slack channels:", error);
      res.status(500).json({ error: "Failed to fetch slack channels" });
    }
  });

  app.post("/api/slack-channels", requireAdmin, async (req, res) => {
    try {
      const { cohortId, channelId, channelName, slackBotToken } = req.body;
      if (!cohortId || !channelId || !channelName) {
        return res.status(400).json({ error: "cohortId, channelId, and channelName are required" });
      }
      const config = await storage.createSlackChannelConfig({ cohortId, channelId, channelName, slackBotToken: slackBotToken || null });
      res.status(201).json(config);
    } catch (error) {
      console.error("Error creating slack channel config:", error);
      res.status(500).json({ error: "Failed to create slack channel config" });
    }
  });

  app.patch("/api/slack-channels/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const config = await storage.updateSlackChannelConfig(id, req.body);
      if (!config) return res.status(404).json({ error: "Config not found" });
      res.json(config);
    } catch (error) {
      console.error("Error updating slack channel config:", error);
      res.status(500).json({ error: "Failed to update config" });
    }
  });

  app.delete("/api/slack-channels/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSlackChannelConfig(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting slack channel config:", error);
      res.status(500).json({ error: "Failed to delete config" });
    }
  });

  app.get("/api/slack/status", requireAuth, async (_req, res) => {
    res.json({ connected: !!process.env.SLACK_BOT_TOKEN });
  });

  app.post("/api/ai/draft-reply", requireAuth, async (req, res) => {
    try {
      const { recordId } = req.body;
      if (!recordId) return res.status(400).json({ error: "recordId required" });

      const record = await storage.getRecordById(recordId);
      if (!record) return res.status(404).json({ error: "Record not found" });

      const draft = await generateReplyDraft(record.emailBody, {
        senderName: record.senderName,
        attendanceType: record.attendanceType,
        category: record.excuseCategory,
        assessmentAction: record.assessmentAction || "none",
      });

      res.json({ draft });
    } catch (error) {
      console.error("Error generating reply draft:", error);
      res.status(500).json({ error: "Failed to generate draft" });
    }
  });

  app.post("/api/slack/send", requireAuth, async (req, res) => {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) {
      return res.status(503).json({ error: "Slack is not configured on this server" });
    }

    const { channelId, threadTs, body, alertId } = req.body;
    if (!channelId || !body) {
      return res.status(400).json({ error: "channelId and body are required" });
    }

    if (alertId) {
      const userId = req.session.userId!;
      const user = await storage.getUserById(userId);
      const alertList = user?.role === "admin"
        ? await storage.getAllAlerts()
        : await storage.getAlertsByUser(userId);
      const alert = alertList.find(a => a.id === alertId);
      if (!alert) {
        return res.status(403).json({ error: "Alert not found or not authorized" });
      }
    }

    try {
      const payload: Record<string, string> = { channel: channelId, text: body };
      if (threadTs) payload.thread_ts = threadTs;

      const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await slackRes.json();
      if (!data.ok) {
        return res.status(500).json({ error: data.error || "Slack API error" });
      }

      if (alertId) {
        const userId = req.session.userId!;
        await storage.markAlertRead(alertId);
        req.app.emit("alert-read", { userId });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error sending Slack message:", error);
      res.status(500).json({ error: "Failed to send Slack message" });
    }
  });

  app.get("/api/lms-configs", requireAuth, async (req, res) => {
    try {
      const configs = await storage.getLmsConfigsByUser(req.session.userId!);
      res.json(configs);
    } catch (error) {
      console.error("Error fetching LMS configs:", error);
      res.status(500).json({ error: "Failed to fetch LMS configs" });
    }
  });

  app.post("/api/lms-configs", requireAuth, async (req, res) => {
    try {
      const { lmsType, apiUrl, apiKey, apiSecret, institutionId, enabled, syncAttendance, defaultAssessmentAction } = req.body;
      if (!lmsType || !apiUrl || !apiKey) {
        return res.status(400).json({ error: "lmsType, apiUrl, and apiKey are required" });
      }
      const config = await storage.createLmsConfig({
        userId: req.session.userId!,
        lmsType,
        apiUrl,
        apiKey,
        apiSecret: apiSecret || null,
        institutionId: institutionId || null,
        enabled: enabled !== false,
        syncAttendance: syncAttendance !== false,
        defaultAssessmentAction: defaultAssessmentAction || "excuse",
      });
      res.status(201).json(config);
    } catch (error) {
      console.error("Error creating LMS config:", error);
      res.status(500).json({ error: "Failed to create LMS config" });
    }
  });

  app.patch("/api/lms-configs/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const config = await storage.updateLmsConfig(id, req.body);
      if (!config) return res.status(404).json({ error: "Config not found" });
      res.json(config);
    } catch (error) {
      console.error("Error updating LMS config:", error);
      res.status(500).json({ error: "Failed to update LMS config" });
    }
  });

  app.delete("/api/lms-configs/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLmsConfig(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting LMS config:", error);
      res.status(500).json({ error: "Failed to delete LMS config" });
    }
  });

  app.post("/api/records/:id/lms-sync", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const record = await storage.getRecordById(id);
      if (!record || record.userId !== req.session.userId!) {
        return res.status(404).json({ error: "Record not found" });
      }

      const { action, assessmentName, dueDate } = req.body;
      const validActions = ["none", "excuse", "zero_out", "makeup_allowed"];
      if (!validActions.includes(action)) {
        return res.status(400).json({ error: "Invalid assessment action" });
      }

      const { syncToLms } = await import("./lms-integration");
      const result = await syncToLms(
        req.session.userId!,
        id,
        record.senderEmail,
        record.senderName,
        assessmentName || `Attendance - ${new Date(record.receivedAt).toLocaleDateString()}`,
        action,
        record.alertReason || undefined,
        dueDate
      );

      res.json(result);
    } catch (error) {
      console.error("Error syncing to LMS:", error);
      res.status(500).json({ error: "Failed to sync to LMS" });
    }
  });

  app.get("/api/records/:id/lms-logs", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const record = await storage.getRecordById(id);
      if (!record || record.userId !== req.session.userId!) {
        return res.status(404).json({ error: "Record not found" });
      }

      const logs = await storage.getLmsSyncLogsByRecord(id);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching LMS sync logs:", error);
      res.status(500).json({ error: "Failed to fetch LMS sync logs" });
    }
  });

  function verifySlackSignature(req: Request, res: Response): boolean {
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    if (!signingSecret) {
      res.status(500).json({ error: "Slack signing secret not configured" });
      return false;
    }
    const signature = req.headers["x-slack-signature"] as string;
    const timestamp = req.headers["x-slack-request-timestamp"] as string;
    if (!signature || !timestamp) {
      res.status(401).json({ error: "Missing Slack signature headers" });
      return false;
    }
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) {
      res.status(401).json({ error: "Request timestamp too old" });
      return false;
    }
    const body = JSON.stringify(req.body);
    const hash = crypto.createHmac("sha256", signingSecret).update(`v0:${timestamp}:${body}`).digest("hex");
    if (`v0=${hash}` !== signature) {
      res.status(401).json({ error: "Invalid signature" });
      return false;
    }
    return true;
  }

  // Slack slash commands and interactive messages
  app.post("/api/slack/interactions", async (req, res) => {
    try {
      if (!verifySlackSignature(req, res)) return;

      const result = await handleSlackInteraction(req.body);
      res.status(result.status).send();
    } catch (error) {
      console.error("[Slack] Error handling interaction:", error);
      res.status(500).json({ error: "Failed to handle Slack interaction" });
    }
  });

  // Slack event subscription
  app.post("/api/slack/events", async (req, res) => {
    try {
      const { type, challenge, event, team_id } = req.body;

      // URL verification challenge — skip signature check for initial Slack setup
      if (type === "url_verification") {
        return res.send(challenge);
      }

      if (!verifySlackSignature(req, res)) return;

      if (type === "event_callback" && event) {
        await handleSlackEvent(event, team_id);
      }

      res.status(200).send();
    } catch (error) {
      console.error("[Slack] Error handling event:", error);
      res.status(500).json({ error: "Failed to handle Slack event" });
    }
  });

  setupFileIngestion(app);

  return httpServer;
}
