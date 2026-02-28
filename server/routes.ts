import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { emailInputSchema, batchEmailInputSchema, excuseCategories, insertCohortSchema, insertStudentSchema, insertScheduleSchema } from "@shared/schema";
import { categorizeExcuse } from "./openai";
import { randomUUID } from "crypto";
import { requireAuth } from "./auth";

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

      const allowedFields: Record<string, boolean> = { status: true, cohortId: true, name: true, email: true };
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
      res.json(alertList);
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
      const { scanTime, enabled } = req.body;
      if (!scanTime) return res.status(400).json({ error: "scanTime is required" });
      const config = await storage.createScanConfig({
        userId: req.session.userId!,
        scanTime,
        enabled: enabled !== false,
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
      if (studentId) {
        if (user && user.role !== "admin") {
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
        if (user && user.role !== "admin") {
          const cohort = await storage.getCohortById(parseInt(cohortId as string));
          if (!cohort || cohort.instructorId !== user.id) {
            return res.status(403).json({ error: "Access denied" });
          }
        }
        const records = await storage.getRecordsByCohort(parseInt(cohortId as string));
        return res.json(records);
      }
      const records = await storage.getAllRecords(req.session.userId!);
      res.json(records);
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
      if (cohortId) {
        const user = await storage.getUserById(req.session.userId!);
        if (user && user.role !== "admin") {
          const cohort = await storage.getCohortById(parseInt(cohortId as string));
          if (!cohort || cohort.instructorId !== user.id) {
            return res.status(403).json({ error: "Access denied" });
          }
        }
        const stats = await storage.getStatsByCohort(parseInt(cohortId as string));
        return res.json(stats);
      }
      const stats = await storage.getStats(req.session.userId!);
      res.json(stats);
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
      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        sendEvent({ type: "processing", index: i, name: email.senderName });

        try {
          const categorization = await categorizeExcuse(email.emailBody);
          const snippet = email.emailBody.substring(0, 150).replace(/\n/g, " ").trim();

          const matchedStudent = allStudents.find(
            s => s.email.toLowerCase() === email.senderEmail.toLowerCase()
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

      sendEvent({ type: "complete", total: emails.length, processed: results.length, batchId });
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

  return httpServer;
}
