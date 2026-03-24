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

export async function runLiveScanForUser(
  userId: number,
  options: { gmail?: boolean; slack?: boolean } = {},
): Promise<{ gmailProcessed: number; slackProcessed: number; totalProcessed: number }> {
  const gmail = options.gmail !== false;
  const slack = options.slack !== false;

  const [gmailProcessed, slackProcessed] = await Promise.all([
    gmail ? runGmailScan(userId) : Promise.resolve(0),
    slack ? scanSlackForUser(userId) : Promise.resolve(0),
  ]);

  return {
    gmailProcessed,
    slackProcessed,
    totalProcessed: gmailProcessed + slackProcessed,
  };
}

export async function runGmailScan(userId: number): Promise<number> {
  const user = await storage.getUserById(userId);
  if (!user || !user.googleAccessToken) {
    console.log(`[Scheduler] User ${userId} has no Google token, skipping Gmail scan`);
    return 0;
  }

  const searchQuery = [
    "newer_than:1d",
    "(",
    // Absence / not attending
    "absent OR absence OR \"not coming\" OR \"won't be in\" OR \"won't be there\"",
    "OR \"can't come\" OR \"cannot attend\" OR \"unable to attend\"",
    "OR \"not going to make it\" OR \"not gonna make it\" OR \"won't make it\" OR \"can't make it\"",
    "OR \"missing class\" OR \"missing today\" OR \"out today\" OR \"called out\" OR \"calling out\"",
    "OR \"something came up\" OR \"something happened\" OR \"personal matter\" OR \"personal issue\"",
    "OR \"family matter\" OR \"family situation\" OR \"unexpected\" OR \"unavailable\"",
    "OR \"wanted to let you know\" OR \"letting you know\" OR \"heads up\"",
    // Lateness
    "OR late OR tardy OR \"running late\" OR \"running behind\" OR \"will be late\"",
    "OR \"leaving early\" OR \"stepping out\" OR delayed OR \"held up\"",
    "OR \"few minutes late\" OR \"a little late\"",
    // Health / medical
    "OR sick OR ill OR illness OR fever OR flu OR covid OR quarantine",
    "OR migraine OR headache OR hospital OR \"urgent care\" OR \"emergency room\"",
    "OR doctor OR \"doctor's appointment\" OR specialist OR \"follow-up\"",
    "OR \"not feeling well\" OR \"under the weather\" OR injury OR injured",
    "OR \"food poisoning\" OR nausea OR \"throwing up\" OR vomiting",
    "OR \"mental health\" OR anxiety OR \"panic attack\" OR depression OR overwhelmed OR burnout",
    "OR therapy OR surgery OR procedure OR medication OR prescription OR pharmacy",
    "OR dentist OR dental OR optometrist OR prenatal OR pregnant",
    "OR \"blood work\" OR \"physical therapy\"",
    // Family / caretaking / parenting
    "OR emergency OR \"family emergency\" OR funeral OR bereavement OR \"passed away\"",
    "OR died OR wake OR memorial OR mourning OR grieving OR loss",
    "OR \"my kid\" OR \"my child\" OR \"my son\" OR \"my daughter\" OR \"my baby\"",
    "OR \"school pickup\" OR \"school drop off\" OR daycare OR childcare OR babysitter",
    "OR pediatrician OR \"child is sick\" OR \"kid is sick\"",
    "OR \"my mom\" OR \"my dad\" OR \"my mother\" OR \"my father\" OR \"my parent\"",
    "OR \"my grandma\" OR \"my grandpa\" OR \"my brother\" OR \"my sister\"",
    "OR \"taking care of\" OR caregiver OR caretaker OR \"nursing home\"",
    "OR \"my partner\" OR \"my spouse\" OR \"my husband\" OR \"my wife\"",
    "OR \"my boyfriend\" OR \"my girlfriend\"",
    // Work / employment conflicts
    "OR \"work ran late\" OR \"work conflict\" OR \"called into work\" OR \"got called in\"",
    "OR \"work emergency\" OR overtime OR interview OR \"job interview\" OR internship",
    // Housing / home emergencies
    "OR eviction OR \"housing court\" OR \"gas leak\" OR \"locked out\" OR \"no heat\"",
    "OR \"break in\" OR \"flat tire\" OR \"car broke down\"",
    // Legal / government / benefits
    "OR \"jury duty\" OR \"court date\" OR arraignment OR probation",
    "OR immigration OR visa OR DMV OR \"social security\" OR \"public assistance\"",
    "OR \"housing authority\" OR NYCHA",
    // NYC transit
    "OR subway OR \"the train\" OR MTA OR \"train delay\" OR \"subway delay\"",
    "OR \"signal problem\" OR \"track problem\" OR \"track work\" OR \"service disruption\"",
    "OR LIRR OR \"NJ Transit\" OR PATH OR ferry",
    // Traffic / transport
    "OR \"stuck in traffic\" OR traffic OR accident OR \"car accident\"",
    // Weather (NYC)
    "OR snowstorm OR blizzard OR flooding OR \"power outage\" OR \"heat wave\"",
    // Technical / connectivity
    "OR \"internet down\" OR \"no internet\" OR wifi OR \"can't log in\" OR \"laptop crashed\"",
    "OR \"no connection\" OR hotspot",
    // General
    "OR appointment OR excuse",
    ")",
  ].join(" ");

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
      return 0;
    }

    const listData = await listRes.json();
    const messages = listData.messages || [];

    if (messages.length === 0) {
      console.log(`[Scheduler] No new Gmail messages for user ${userId}`);
      return 0;
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

        // Only process emails from students on the roster — skip non-roster senders entirely
        const matchedStudent = allStudents.find(
          s => s.email.toLowerCase() === senderEmail.toLowerCase()
            || (s.alternateEmails || []).some(ae => ae.toLowerCase() === senderEmail.toLowerCase())
            || s.name.toLowerCase() === senderName.toLowerCase()
        );

        if (!matchedStudent) {
          console.log(`[Scheduler] Skipping ${senderEmail} — not on student roster`);
          continue;
        }

        const categorization = await categorizeExcuse(body);
        const snippet = body.substring(0, 150).replace(/\n/g, " ").trim();

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
    return processed;
  } catch (error) {
    console.error(`[Scheduler] Error during Gmail scan for user ${userId}:`, error);
    return 0;
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
