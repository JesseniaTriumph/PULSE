import { storage } from "./storage";
import { categorizeExcuse } from "./openai";

const ATTENDANCE_KEYWORDS = [
  // ── Absence / not attending ──────────────────────────────────────────────
  "absent", "absence", "not coming", "won't be in", "won't be there",
  "can't come", "can't be there", "cannot attend", "unable to attend",
  "not going to make it", "not gonna make it", "won't make it",
  "can't make it", "missing class", "missing today", "missing session",
  "out today", "out tomorrow", "not in today", "won't be attending",
  "skipping", "called out", "calling out", "won't be able",
  "something came up", "something happened", "personal matter",
  "personal issue", "personal reasons", "family matter", "family situation",
  "unexpected", "unforeseen", "unavailable",

  // ── Lateness / partial attendance ────────────────────────────────────────
  "late", "tardy", "running late", "running a bit late", "running behind",
  "will be late", "going to be late", "few minutes late", "a little late",
  "held up", "delayed", "delay", "stepping out", "leaving early",
  "arrive late", "getting there late", "on my way", "heading there",
  "few mins", "a few minutes",

  // ── Health / medical ─────────────────────────────────────────────────────
  "sick", "ill", "illness", "not feeling well", "under the weather",
  "fever", "flu", "cold", "covid", "positive test", "tested positive",
  "quarantine", "migraine", "headache", "stomach", "stomachache",
  "food poisoning", "nausea", "nauseous", "throwing up", "vomiting",
  "injury", "injured", "hospital", "hospitalized", "ER", "emergency room",
  "urgent care", "ambulance", "doctor", "dr.", "doctor's appointment",
  "specialist", "follow-up", "blood work", "lab", "MRI", "X-ray",
  "physical therapy", "PT", "therapy", "mental health", "anxiety",
  "panic attack", "depression", "overwhelmed", "burned out", "burnout",
  "surgery", "procedure", "medication", "prescription", "pharmacy",
  "dentist", "dental", "optometrist", "eye doctor", "OB", "prenatal",
  "pregnant", "pregnancy",

  // ── Family / caretaking / parenting ──────────────────────────────────────
  "emergency", "family emergency", "funeral", "bereavement", "passed away",
  "death in the family", "died", "passing", "wake", "memorial", "mourning",
  "grieving", "loss",
  "my kid", "my child", "my son", "my daughter", "my baby",
  "school pickup", "school drop off", "school dropoff", "daycare", "day care",
  "babysitter", "childcare", "pediatrician", "child is sick", "kid is sick",
  "parent-teacher", "custody", "visitation",
  "my mom", "my dad", "my mother", "my father", "my parent", "my parents",
  "my grandma", "my grandpa", "my grandmother", "my grandfather",
  "my brother", "my sister", "my sibling", "my aunt", "my uncle",
  "taking care of", "caring for", "caretaker", "caregiver",
  "nursing home", "assisted living", "dialysis",
  "my partner", "my spouse", "my husband", "my wife",
  "my boyfriend", "my girlfriend", "domestic situation",

  // ── Work / employment conflicts ───────────────────────────────────────────
  "work ran over", "work ran late", "work conflict", "called into work",
  "got called in", "work emergency", "shift", "overtime",
  "interview", "job interview", "internship",

  // ── Housing / home emergencies ────────────────────────────────────────────
  "apartment", "landlord", "eviction", "housing court",
  "moving", "move out", "plumber", "repair", "maintenance",
  "gas leak", "fire", "break in", "robbery", "theft",
  "lockout", "locked out", "no heat", "boiler",

  // ── Legal / government / benefits ─────────────────────────────────────────
  "jury duty", "court", "court date", "hearing", "arraignment", "probation",
  "legal", "immigration", "visa", "DMV", "passport", "social security",
  "public assistance", "benefits office", "HRA", "social services",
  "housing authority", "NYCHA", "Section 8",

  // ── NYC transit (MTA / subway / buses / rail) ─────────────────────────────
  "subway", "train", "the train", "my train", "MTA", "metro",
  "PATH", "LIRR", "NJ Transit", "bus", "stuck on the train",
  "stuck on the subway", "train delay", "train is delayed",
  "subway delay", "signal problem", "track problem", "track work",
  "service disruption", "no service", "train not running",
  "A train", "B train", "C train", "D train", "E train", "F train",
  "G train", "J train", "L train", "M train", "N train", "Q train",
  "R train", "W train", "Z train", "1 train", "2 train", "3 train",
  "4 train", "5 train", "6 train", "7 train", "ferry", "no ride",
  "can't get a ride",

  // ── Traffic / road ────────────────────────────────────────────────────────
  "stuck in traffic", "traffic", "accident", "car accident",
  "car broke down", "vehicle", "uber", "lyft", "car service",
  "flat tire", "towed",

  // ── Weather (NYC) ─────────────────────────────────────────────────────────
  "snow", "snowstorm", "blizzard", "ice", "icy", "storm", "hurricane",
  "flooding", "flood", "power outage", "heat wave", "no AC",

  // ── Technical / connectivity ──────────────────────────────────────────────
  "internet", "wifi", "wi-fi", "connection", "no connection",
  "internet down", "internet out", "laptop", "computer", "crashed",
  "can't log in", "can't connect", "power out", "hotspot",

  // ── General excuse language ───────────────────────────────────────────────
  "excuse", "reaching out", "wanted to let you know", "just wanted to let you know",
  "heads up", "giving you a heads up", "letting you know",
];

const KEYWORD_REGEX = new RegExp(ATTENDANCE_KEYWORDS.join("|"), "i");

interface SlackMessage {
  type: string;
  text: string;
  user: string;
  ts: string;
  thread_ts?: string;
  reply_count?: number;
}

interface SlackChannel {
  id: string;
  name: string;
  is_im: boolean;
  is_mpim?: boolean;
  is_channel?: boolean;
  is_group?: boolean;
  user?: string;
}

interface SlackUserInfo {
  id: string;
  real_name: string;
  profile: {
    email?: string;
    real_name?: string;
    display_name?: string;
  };
}

async function slackApi(endpoint: string, token: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(`https://slack.com/api/${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Slack API ${endpoint} returned ${res.status}`);
  }
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Slack API ${endpoint} error: ${data.error}`);
  }
  return data;
}

const userCache = new Map<string, SlackUserInfo>();

async function getUserInfo(userId: string, token: string): Promise<SlackUserInfo> {
  if (userCache.has(userId)) return userCache.get(userId)!;
  const data = await slackApi("users.info", token, { user: userId });
  userCache.set(userId, data.user);
  return data.user;
}

export async function scanSlackForUser(userId: number): Promise<number> {
  const globalToken = process.env.SLACK_BOT_TOKEN;

  // Use per-instructor tokens if they've connected their Slack account
  const instructor = await storage.getUserById(userId);
  // User token (xoxp-) scans DMs the instructor receives; bot token (xoxb-) scans channels
  const userToken = instructor?.slackAccessToken || null;
  const botToken = instructor?.slackBotToken || null;
  // For channel scanning: prefer bot token (has channel access), then user token, then global
  const effectiveToken = botToken || userToken || globalToken;
  // For DM scanning: prefer user token (sees instructor's DMs), then bot/global
  const dmToken = userToken || botToken || globalToken;

  const enabledChannelConfigs = await storage.getEnabledSlackChannelConfigsByUser(userId);
  if (enabledChannelConfigs.length === 0 && !effectiveToken) {
    console.log(`[Slack Scanner] No Slack channels and no token for user ${userId}, skipping`);
    return 0;
  }

  const allStudents = await storage.getStudentsByInstructor(userId);
  const allStudentsGlobal = await storage.getAllStudents();
  const studentPool = allStudents.length > 0 ? allStudents : allStudentsGlobal;

  const oldest = String(Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000));
  let processed = 0;
  let skippedCooldown = 0;

  for (const channelConfig of enabledChannelConfigs) {
    const channelToken = (channelConfig as any).slackBotToken || effectiveToken;
    if (!channelToken) {
      console.log(`[Slack Scanner] No bot token for channel ${channelConfig.channelName}, skipping`);
      continue;
    }
    try {
      const data = await slackApi("conversations.history", channelToken, {
        channel: channelConfig.channelId,
        oldest,
        limit: "50",
      });

      const allTopLevel: SlackMessage[] = (data.messages || []).filter(
        (m: SlackMessage) => m.type === "message" && m.text && !m.thread_ts
      );
      const messages = allTopLevel;
      const threadParents = allTopLevel.filter(m => m.reply_count && m.reply_count > 0);

      for (const msg of messages) {
        if (!KEYWORD_REGEX.test(msg.text)) continue;

        try {
          let senderName = "Unknown";
          let senderEmail = "";

          try {
            const userInfo = await getUserInfo(msg.user, channelToken);
            senderName = userInfo.profile?.real_name || userInfo.real_name || "Unknown";
            senderEmail = userInfo.profile?.email || "";
          } catch {
            senderName = msg.user;
          }

          const duplicate = await storage.getRecordBySlackMessageTs(userId, channelConfig.channelId, msg.ts);
          if (duplicate) {
            console.log(`[Slack Scanner] Skipping message ${msg.ts} in ${channelConfig.channelName} - already processed`);
            continue;
          }

          if (senderEmail) {
            const existingCooldown = await storage.getAutoReplyCooldown(userId, senderEmail);
            if (existingCooldown) {
              const expiresAt = new Date(existingCooldown.expiresAt);
              if (expiresAt > new Date()) {
                console.log(`[Slack Scanner] Skipping ${senderEmail} - cooldown active`);
                skippedCooldown++;
                continue;
              }
            }
          }

          const categorization = await categorizeExcuse(msg.text);
          const snippet = msg.text.substring(0, 150).replace(/\n/g, " ").trim();
          const msgDate = new Date(parseFloat(msg.ts) * 1000);

          const matchedStudent = studentPool.find(s =>
            (s.slackUserId && s.slackUserId === msg.user)
            || (senderEmail && s.email.toLowerCase() === senderEmail.toLowerCase())
            || (senderEmail && (s.alternateEmails || []).some(ae => ae.toLowerCase() === senderEmail.toLowerCase()))
            || s.name.toLowerCase() === senderName.toLowerCase()
          );

          const isDm = false;

          const record = await storage.createRecord({
            userId,
            studentId: matchedStudent?.id || null,
            senderName,
            senderEmail: senderEmail || `slack:${msg.user}`,
            receivedAt: msgDate,
            emailBody: msg.text,
            attendanceType: categorization.attendanceType,
            excuseCategory: categorization.category,
            messageSnippet: snippet + (msg.text.length > 150 ? "..." : ""),
            status: "processed",
            batchId: `slack-scan-${new Date().toISOString().split("T")[0]}`,
            needsResponse: categorization.needsResponse,
            urgency: categorization.urgency,
            alertReason: categorization.alertReason,
            mentionsStudent: categorization.mentionsStudent,
            mentionsSchool: categorization.mentionsSchool,
            peerOrSchoolDetail: categorization.peerOrSchoolDetail,
            source: "slack",
            slackChannelId: channelConfig.channelId,
            slackChannelName: channelConfig.channelName,
            slackMessageTs: msg.ts,
            slackIsDm: isDm,
            aiConfidence: categorization.confidence,
            aiConfidenceTier: categorization.confidenceTier,
            requiresManualReview: categorization.requiresManualReview,
            assessmentAction: categorization.recommendedAssessmentAction,
            lmsSynced: false,
          });

          if (categorization.needsResponse && senderEmail) {
            await storage.createAlert({
              userId,
              recordId: record.id,
              alertType: categorization.urgency === "high" ? "urgent" : "action_needed",
              message: categorization.alertReason || "This Slack message may need a response",
              urgency: categorization.urgency,
            });

            await storage.setAutoReplyCooldown(userId, senderEmail, 7);
          }

          processed++;
        } catch (err) {
          console.error(`[Slack Scanner] Error processing message in ${channelConfig.channelName}:`, err);
        }
      }

      // Scan thread replies for top-level messages that have replies
      for (const parent of threadParents) {
        try {
          const threadData = await slackApi("conversations.replies", channelToken, {
            channel: channelConfig.channelId,
            ts: parent.ts,
            oldest,
            limit: "20",
          });

          const replies: SlackMessage[] = (threadData.messages || []).filter(
            (r: SlackMessage) => r.type === "message" && r.text && r.ts !== parent.ts
          );

          for (const reply of replies) {
            if (!KEYWORD_REGEX.test(reply.text)) continue;

            try {
              let senderName = "Unknown";
              let senderEmail = "";

              try {
                const userInfo = await getUserInfo(reply.user, channelToken);
                senderName = userInfo.profile?.real_name || userInfo.real_name || "Unknown";
                senderEmail = userInfo.profile?.email || "";
              } catch {
                senderName = reply.user;
              }

              const duplicate = await storage.getRecordBySlackMessageTs(userId, channelConfig.channelId, reply.ts);
              if (duplicate) continue;

              if (senderEmail) {
                const existingCooldown = await storage.getAutoReplyCooldown(userId, senderEmail);
                if (existingCooldown && new Date(existingCooldown.expiresAt) > new Date()) {
                  skippedCooldown++;
                  continue;
                }
              }

              const matchedStudent = studentPool.find(s =>
                (s.slackUserId && s.slackUserId === reply.user)
                || (senderEmail && s.email.toLowerCase() === senderEmail.toLowerCase())
                || (senderEmail && (s.alternateEmails || []).some(ae => ae.toLowerCase() === senderEmail.toLowerCase()))
                || s.name.toLowerCase() === senderName.toLowerCase()
              );

              const categorization = await categorizeExcuse(reply.text);
              const snippet = reply.text.substring(0, 150).replace(/\n/g, " ").trim();
              const msgDate = new Date(parseFloat(reply.ts) * 1000);

              const record = await storage.createRecord({
                userId,
                studentId: matchedStudent?.id || null,
                senderName,
                senderEmail: senderEmail || `slack:${reply.user}`,
                receivedAt: msgDate,
                emailBody: reply.text,
                attendanceType: categorization.attendanceType,
                excuseCategory: categorization.category,
                messageSnippet: snippet + (reply.text.length > 150 ? "..." : ""),
                status: "processed",
                batchId: `slack-scan-${new Date().toISOString().split("T")[0]}`,
                needsResponse: categorization.needsResponse,
                urgency: categorization.urgency,
                alertReason: categorization.alertReason,
                mentionsStudent: categorization.mentionsStudent,
                mentionsSchool: categorization.mentionsSchool,
                peerOrSchoolDetail: categorization.peerOrSchoolDetail,
                source: "slack",
                slackChannelId: channelConfig.channelId,
                slackChannelName: channelConfig.channelName,
                slackMessageTs: reply.ts,
                slackIsDm: false,
                aiConfidence: categorization.confidence,
                aiConfidenceTier: categorization.confidenceTier,
                requiresManualReview: categorization.requiresManualReview,
                assessmentAction: categorization.recommendedAssessmentAction,
                lmsSynced: false,
              });

              if (categorization.needsResponse && senderEmail) {
                await storage.createAlert({
                  userId,
                  recordId: record.id,
                  alertType: categorization.urgency === "high" ? "urgent" : "action_needed",
                  message: categorization.alertReason || "This Slack thread reply may need a response",
                  urgency: categorization.urgency,
                });
                await storage.setAutoReplyCooldown(userId, senderEmail, 7);
              }

              processed++;
            } catch (err) {
              console.error(`[Slack Scanner] Error processing thread reply in ${channelConfig.channelName}:`, err);
            }
          }
        } catch (err) {
          console.error(`[Slack Scanner] Error fetching thread ${parent.ts} in ${channelConfig.channelName}:`, err);
        }
      }
    } catch (err) {
      console.error(`[Slack Scanner] Error scanning channel ${channelConfig.channelName}:`, err);
    }
  }

  if (!effectiveToken && !dmToken) {
    console.log(`[Slack Scanner] Processed ${processed} Slack messages for user ${userId}`);
    return processed;
  }

  if (!dmToken) {
    console.log(`[Slack Scanner] No DM token for user ${userId}, skipping DM scan`);
    console.log(`[Slack Scanner] Processed ${processed} Slack messages for user ${userId}`);
    return processed;
  }

  try {
    const dmData = await slackApi("conversations.list", dmToken, {
      types: "im",
      limit: "100",
    });

    const dmChannels: SlackChannel[] = dmData.channels || [];

    for (const dm of dmChannels) {
      try {
        const data = await slackApi("conversations.history", dmToken, {
          channel: dm.id,
          oldest,
          limit: "20",
        });

        const messages: SlackMessage[] = (data.messages || []).filter(
          (m: SlackMessage) => m.type === "message" && m.text
        );

        for (const msg of messages) {
          if (!KEYWORD_REGEX.test(msg.text)) continue;

          try {
            let senderName = "Unknown";
            let senderEmail = "";

            try {
              const userInfo = await getUserInfo(msg.user, dmToken);
              senderName = userInfo.profile?.real_name || userInfo.real_name || "Unknown";
              senderEmail = userInfo.profile?.email || "";
            } catch {
              senderName = msg.user;
            }

            const matchedStudent = studentPool.find(s =>
              (s.slackUserId && s.slackUserId === msg.user)
              || (senderEmail && s.email.toLowerCase() === senderEmail.toLowerCase())
              || (senderEmail && (s.alternateEmails || []).some(ae => ae.toLowerCase() === senderEmail.toLowerCase()))
              || s.name.toLowerCase() === senderName.toLowerCase()
            );

            // Skip self-messages (instructor's own messages in their DMs)
            if (msg.user === instructor?.slackUserId) continue;

            if (!matchedStudent) continue;

            const dmDuplicate = await storage.getRecordBySlackMessageTs(userId, dm.id, msg.ts);
            if (dmDuplicate) {
              console.log(`[Slack Scanner] Skipping DM ${msg.ts} - already processed`);
              continue;
            }

            if (senderEmail) {
              const existingCooldown = await storage.getAutoReplyCooldown(userId, senderEmail);
              if (existingCooldown) {
                const expiresAt = new Date(existingCooldown.expiresAt);
                if (expiresAt > new Date()) {
                  console.log(`[Slack Scanner] Skipping DM from ${senderEmail} - cooldown active`);
                  skippedCooldown++;
                  continue;
                }
              }
            }

            const categorization = await categorizeExcuse(msg.text);
            const snippet = msg.text.substring(0, 150).replace(/\n/g, " ").trim();
            const msgDate = new Date(parseFloat(msg.ts) * 1000);

            const record = await storage.createRecord({
              userId,
              studentId: matchedStudent.id,
              senderName,
              senderEmail: senderEmail || `slack:${msg.user}`,
              receivedAt: msgDate,
              emailBody: msg.text,
              attendanceType: categorization.attendanceType,
              excuseCategory: categorization.category,
              messageSnippet: snippet + (msg.text.length > 150 ? "..." : ""),
              status: "processed",
              batchId: `slack-scan-${new Date().toISOString().split("T")[0]}`,
              needsResponse: categorization.needsResponse,
              urgency: categorization.urgency,
              alertReason: categorization.alertReason,
              mentionsStudent: categorization.mentionsStudent,
              mentionsSchool: categorization.mentionsSchool,
              peerOrSchoolDetail: categorization.peerOrSchoolDetail,
              source: "slack",
              slackChannelId: dm.id,
              slackChannelName: "DM",
              slackMessageTs: msg.ts,
              slackIsDm: true,
              aiConfidence: categorization.confidence,
              aiConfidenceTier: categorization.confidenceTier,
              requiresManualReview: categorization.requiresManualReview,
              assessmentAction: categorization.recommendedAssessmentAction,
              lmsSynced: false,
            });

            if (categorization.needsResponse && senderEmail) {
              await storage.createAlert({
                userId,
                recordId: record.id,
                alertType: categorization.urgency === "high" ? "urgent" : "action_needed",
                message: categorization.alertReason || "This Slack DM may need a response",
                urgency: categorization.urgency,
              });

              await storage.setAutoReplyCooldown(userId, senderEmail, 7);
            }

            processed++;
          } catch (err) {
            console.error(`[Slack Scanner] Error processing DM:`, err);
          }
        }
      } catch (err) {
        console.error(`[Slack Scanner] Error scanning DM channel:`, err);
      }
    }
  } catch (err) {
    console.log("[Slack Scanner] Could not list DM channels (may need im:history scope):", (err as Error).message);
  }

  console.log(`[Slack Scanner] Processed ${processed} Slack messages for user ${userId}`);
  return processed;
}
