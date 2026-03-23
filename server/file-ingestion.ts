/**
 * File ingestion: parse PDF, DOCX, TXT, CSV, JSON, and images.
 * AI extraction (GPT-4o) pulls senderName, senderEmail, receivedAt, emailBody
 * from unstructured content so it feeds directly into the existing classifier pipeline.
 */

import multer from "multer";
import type { Express, Request, Response } from "express";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// In-memory storage — we don't persist uploaded files to disk
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
});

const SUPPORTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/csv",
  "application/json",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
];

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

// ── Text extractors ───────────────────────────────────────────────────────────

async function extractPdf(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return data.text;
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

// ── AI extraction ─────────────────────────────────────────────────────────────

const EXTRACTION_SYSTEM = `You are an assistant that extracts attendance-related email records from provided text or images.

Return a JSON array (no markdown, no explanation) where each element has:
  senderName   - full name of the person contacting the instructor (string)
  senderEmail  - their email address (string, empty string if not found)
  receivedAt   - ISO 8601 timestamp of when the message was sent/dated (string, use current date/time if unclear)
  emailBody    - the full text of the message or absence notification (string)

Rules:
- Only include records that describe an absence, lateness, medical issue, excuse, or attendance-related matter.
- If a document contains multiple separate messages/records, return one element per record.
- If you cannot find any such records, return an empty array [].
- Never invent data. Use empty string for missing fields rather than guessing.`;

async function aiExtractFromText(text: string): Promise<object[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM },
      {
        role: "user",
        content: `Extract attendance email records from the following text:\n\n${text.slice(0, 12000)}`,
      },
    ],
    temperature: 0,
    max_tokens: 4000,
  });

  const raw = response.choices[0]?.message?.content?.trim() || "[]";
  // Strip markdown code fences if present
  const json = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "");
  return JSON.parse(json);
}

async function aiExtractFromImage(buffer: Buffer, mimeType: string): Promise<object[]> {
  const base64 = buffer.toString("base64");
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract attendance email records from this image. Look for names, email addresses, absence messages, or any attendance-related communications.",
          },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
        ],
      },
    ],
    temperature: 0,
    max_tokens: 4000,
  });

  const raw = response.choices[0]?.message?.content?.trim() || "[]";
  const json = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "");
  return JSON.parse(json);
}

// ── CSV parser (server-side, handles any column order) ────────────────────────

function parseCSV(text: string): object[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());

  const findIdx = (...names: string[]) => {
    for (const name of names) {
      const idx = headers.indexOf(name);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const nameIdx = findIdx("name", "sendername", "sender name", "student name", "student");
  const emailIdx = findIdx("email", "senderemail", "sender email", "address");
  const dateIdx = findIdx("date", "receivedat", "received at", "timestamp", "time");
  const bodyIdx = findIdx("body", "emailbody", "email body", "message", "text", "content", "reason");

  return lines
    .slice(1)
    .map((line) => {
      const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map((v) =>
        v.replace(/^"|"$/g, "").trim(),
      ) || [];
      return {
        senderName: nameIdx !== -1 ? (values[nameIdx] || "") : (values[0] || ""),
        senderEmail: emailIdx !== -1 ? (values[emailIdx] || "") : (values[1] || ""),
        receivedAt:
          dateIdx !== -1 && values[dateIdx]
            ? new Date(values[dateIdx]).toISOString()
            : new Date().toISOString(),
        emailBody: bodyIdx !== -1 ? (values[bodyIdx] || "") : (values[3] || ""),
      };
    })
    .filter((r) => r.senderName || r.senderEmail || r.emailBody);
}

// ── Main route handler ────────────────────────────────────────────────────────

export function setupFileIngestion(app: Express) {
  /**
   * POST /api/ingest-file
   * Accepts a multipart file upload, extracts email records, returns JSON array.
   * Supports: PDF, DOCX, DOC, TXT, CSV, JSON, PNG, JPG, WEBP, GIF
   */
  app.post(
    "/api/ingest-file",
    upload.single("file"),
    async (req: Request, res: Response) => {
      if (!req.session?.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const mime = file.mimetype.toLowerCase();
      const filename = file.originalname.toLowerCase();

      // Determine actual type from extension when browser sends application/octet-stream
      const effectiveMime =
        mime === "application/octet-stream"
          ? filename.endsWith(".pdf")
            ? "application/pdf"
            : filename.endsWith(".docx")
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : filename.endsWith(".doc")
            ? "application/msword"
            : filename.endsWith(".csv")
            ? "text/csv"
            : filename.endsWith(".txt")
            ? "text/plain"
            : filename.endsWith(".json")
            ? "application/json"
            : mime
          : mime;

      try {
        let records: object[] = [];

        if (effectiveMime === "application/json" || filename.endsWith(".json")) {
          const text = file.buffer.toString("utf-8");
          const parsed = JSON.parse(text);
          records = Array.isArray(parsed) ? parsed : [parsed];
        } else if (effectiveMime === "text/csv" || filename.endsWith(".csv")) {
          const text = file.buffer.toString("utf-8");
          records = parseCSV(text);
        } else if (effectiveMime === "text/plain" || filename.endsWith(".txt")) {
          const text = file.buffer.toString("utf-8");
          records = await aiExtractFromText(text);
        } else if (effectiveMime === "application/pdf" || filename.endsWith(".pdf")) {
          const text = await extractPdf(file.buffer);
          records = await aiExtractFromText(text);
        } else if (
          effectiveMime ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          effectiveMime === "application/msword" ||
          filename.endsWith(".docx") ||
          filename.endsWith(".doc")
        ) {
          const text = await extractDocx(file.buffer);
          records = await aiExtractFromText(text);
        } else if (IMAGE_TYPES.has(effectiveMime) || filename.match(/\.(png|jpe?g|webp|gif)$/)) {
          records = await aiExtractFromImage(file.buffer, effectiveMime);
        } else {
          return res.status(415).json({
            error: `Unsupported file type: ${file.originalname}. Supported: PDF, DOCX, TXT, CSV, JSON, PNG, JPG, WEBP`,
          });
        }

        res.json({ records, count: records.length });
      } catch (err: any) {
        console.error("[FileIngestion] Error:", err);
        res.status(500).json({
          error: `Failed to parse file: ${err.message || "Unknown error"}`,
        });
      }
    },
  );
}
