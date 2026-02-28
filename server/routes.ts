import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { emailInputSchema, batchEmailInputSchema, excuseCategories } from "@shared/schema";
import { categorizeExcuse } from "./openai";
import { randomUUID } from "crypto";
import { requireAuth } from "./auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/records", requireAuth, async (req, res) => {
    try {
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

  app.get("/api/stats", requireAuth, async (_req, res) => {
    try {
      const stats = await storage.getStats(_req.session.userId!);
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

      const results = [];
      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        sendEvent({ type: "processing", index: i, name: email.senderName });

        try {
          const categorization = await categorizeExcuse(email.emailBody);
          const snippet = email.emailBody.substring(0, 150).replace(/\n/g, " ").trim();

          const record = await storage.createRecord({
            userId,
            senderName: email.senderName,
            senderEmail: email.senderEmail,
            receivedAt: new Date(email.receivedAt),
            emailBody: email.emailBody,
            excuseCategory: categorization.category,
            messageSnippet: snippet + (email.emailBody.length > 150 ? "..." : ""),
            status: "processed",
            batchId,
          });

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
      const header = "Name,Email,Date,Excuse Category,Status,Message Snippet";
      const rows = records.map((r) => {
        const escapeCsv = (s: string) => `"${s.replace(/"/g, '""')}"`;
        return [
          escapeCsv(r.senderName),
          escapeCsv(r.senderEmail),
          escapeCsv(new Date(r.receivedAt).toLocaleDateString()),
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
          children: ["Name", "Email", "Date", "Message Snippet"].map(
            (text) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
                width: { size: 25, type: WidthType.PERCENTAGE },
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
                r.messageSnippet,
              ].map(
                (text) =>
                  new TableCell({
                    children: [new Paragraph({ text })],
                    width: { size: 25, type: WidthType.PERCENTAGE },
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
