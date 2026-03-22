import { storage } from "./storage";
import { categorizeExcuse } from "./openai";
import { scanSlackForUser } from "./slack-scanner";
import { isBulkOrAutoMail } from "./google-auth";

let lastCheckedMinute = "";

export function startScheduler() {
  setInterval(async () => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    if (currentTime === lastCheckedMinute) return;
    lastCheckedMinute = currentTime;

    try {
      const enabledConfigs = await storage.getAllEnabledScanConfigs();
      const matchingConfigs = enabledConfigs.filter(c => c.scanTime === currentTime);

      if (matchingConfigs.length === 0) return;

      console.log(`[Scheduler] ${currentTime} - Triggering scan for ${matchingConfigs.length} config(s)`);

      for (const config of matchingConfigs) {
        try {
          const sources: string[] = [];
          if (config.scanGmail) sources.push("Gmail");
          if (config.scanSlack) sources.push("Slack");

          if (sources.length === 0) {
            console.log(`[Scheduler] Config ${config.id} has no sources enabled, skipping`);
            continue;
          }

          console.log(`[Scheduler] Scanning ${sources.join(" + ")} for user ${config.userId}`);

          if (config.scanGmail) {
            await runGmailScan(config.userId);
          }

          if (config.scanSlack) {
            await scanSlackForUser(config.userId);
          }
        } catch (error) {
          console.error(`[Scheduler] Scan failed for user ${config.userId}:`, error);
        }
      }
    } catch (error) {
      console.error("[Scheduler] Error checking scan configs:", error);
    }
  }, 30000);

  console.log("[Scheduler] Started - checking every 30 seconds");
}

async function runGmailScan(userId: number) {
  const user = await storage.getUserById(userId);
  if (!user || !user.googleAccessToken) {
    console.log(`[Scheduler] User ${userId} has no Google token, skipping Gmail scan`);
    return;
  }

  const searchQuery = "newer_than:1d (absent OR absence OR excuse OR sick OR cannot attend OR won't be able OR can't make it OR unable to attend OR not coming OR won't be in OR missing class OR out today OR out sick OR not feeling well OR under the weather OR late OR tardy OR running late OR delayed OR will be late OR running behind OR held up OR stuck in traffic OR stepping out OR leaving early OR emergency OR appointment OR called out)";

  try {
    let accessToken = user.googleAccessToken;

    const params = new URLSearchParams({
      maxResults: "20",
      q: searchQuery,
    });

    let listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (listRes.status === 401 && user.googleRefreshToken) {
      const refreshed = await refreshToken(userId, user.googleRefreshToken);
      if (refreshed) {
        accessToken = refreshed;
        listRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
      }
    }

    if (!listRes.ok) {
      console.log(`[Scheduler] Gmail API error for user ${userId}: ${listRes.status}`);
      return;
    }

    const listData = await listRes.json();
    const messages = listData.messages || [];

    if (messages.length === 0) {
      console.log(`[Scheduler] No new Gmail messages for user ${userId}`);
      return;
    }

    const allStudents = await storage.getStudentsByInstructor(userId);
    let processed = 0;
    let skippedBulk = 0;
    let skippedCooldown = 0;

    for (const msg of messages.slice(0, 20)) {
      try {
        const detailRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!detailRes.ok) continue;
        const detail = await detailRes.json();

        const headers = detail.payload?.headers || [];

        const bulkCheck = isBulkOrAutoMail(headers);
        if (bulkCheck.isBulk) {
          console.log(`[Scheduler] Skipping bulk mail: ${bulkCheck.reason}`);
          skippedBulk++;
          continue;
        }

        const from = headers.find((h: any) => h.name === "From")?.value || "";
        const date = headers.find((h: any) => h.name === "Date")?.value || "";
        const subject = headers.find((h: any) => h.name === "Subject")?.value || "";

        const nameMatch = from.match(/^"?([^"<]+)"?\s*<?/);
        const emailMatch = from.match(/<([^>]+)>/);
        const senderName = nameMatch ? nameMatch[1].trim() : from;
        const senderEmail = emailMatch ? emailMatch[1] : from;

        const duplicate = await storage.getRecordByGmailMessageId(userId, msg.id);
        if (duplicate) {
          console.log(`[Scheduler] Skipping Gmail message ${msg.id} - already processed`);
          continue;
        }

        const existingCooldown = await storage.getAutoReplyCooldown(userId, senderEmail);
        if (existingCooldown) {
          const expiresAt = new Date(existingCooldown.expiresAt);
          if (expiresAt > new Date()) {
            console.log(`[Scheduler] Skipping ${senderEmail} - cooldown active`);
            skippedCooldown++;
            continue;
          }
        }

        let body = "";
        const parts = detail.payload?.parts || [];
        const textPart = parts.find((p: any) => p.mimeType === "text/plain");
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
        } else if (detail.payload?.body?.data) {
          body = Buffer.from(detail.payload.body.data, "base64").toString("utf-8");
        }

        if (!body.trim()) continue;

        const categorization = await categorizeExcuse(body);
        const snippet = body.substring(0, 150).replace(/\n/g, " ").trim();

        const matchedStudent = allStudents.find(
          s => s.email.toLowerCase() === senderEmail.toLowerCase()
            || s.name.toLowerCase() === senderName.toLowerCase()
        );

        const record = await storage.createRecord({
          userId,
          studentId: matchedStudent?.id || null,
          senderName,
          senderEmail,
          receivedAt: new Date(date || Date.now()),
          emailBody: body,
          attendanceType: categorization.attendanceType,
          excuseCategory: categorization.category,
          messageSnippet: snippet + (body.length > 150 ? "..." : ""),
          status: "processed",
          batchId: `auto-scan-${new Date().toISOString().split("T")[0]}`,
          needsResponse: categorization.needsResponse,
          urgency: categorization.urgency,
          alertReason: categorization.alertReason,
          source: "gmail",
          gmailMessageId: msg.id,
          gmailThreadId: detail.threadId || null,
          emailSubject: subject || null,
          aiConfidence: categorization.confidence,
          aiConfidenceTier: categorization.confidenceTier,
          requiresManualReview: categorization.requiresManualReview,
          assessmentAction: categorization.recommendedAssessmentAction,
          lmsSynced: false,
        });

        if (categorization.needsResponse) {
          await storage.createAlert({
            userId,
            recordId: record.id,
            alertType: categorization.urgency === "high" ? "urgent" : "action_needed",
            message: categorization.alertReason || "This email may need a response",
            urgency: categorization.urgency,
          });

          await storage.setAutoReplyCooldown(userId, senderEmail, 7);
        }

        processed++;
      } catch (err) {
        console.error(`[Scheduler] Error processing Gmail message:`, err);
      }
    }

    console.log(`[Scheduler] Processed ${processed} Gmail messages for user ${userId}`);
  } catch (error) {
    console.error(`[Scheduler] Error during Gmail scan for user ${userId}:`, error);
  }
}

async function refreshToken(userId: number, refreshTokenVal: string): Promise<string | null> {
  try {
    const clientId = process.env.PULSE_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.PULSE_GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshTokenVal,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenRes.ok) return null;
    const tokenData = await tokenRes.json();
    await storage.updateUserGoogleTokens(userId, tokenData.access_token);
    return tokenData.access_token;
  } catch {
    return null;
  }
}
