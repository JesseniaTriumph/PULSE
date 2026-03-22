import { storage } from "./storage";
import { categorizeExcuse } from "./openai";
import { getExcuseCategoryEmoji, getExcuseCategoryTag } from "./slack-commands";

const ATTENDANCE_KEYWORDS = [
  "absent", "absence", "excuse", "sick", "cannot attend", "won't be able",
  "can't make it", "unable to attend", "not coming", "won't be in",
  "missing class", "out today", "out sick", "not feeling well",
  "under the weather", "late", "tardy", "running late", "delayed",
  "will be late", "running behind", "held up", "stuck in traffic",
  "stepping out", "leaving early", "emergency", "appointment", "called out",
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
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.log("[Slack Scanner] No SLACK_BOT_TOKEN configured, skipping Slack scan");
    return 0;
  }

  const enabledChannelConfigs = await storage.getAllEnabledSlackChannelConfigs();
  if (enabledChannelConfigs.length === 0) {
    console.log("[Slack Scanner] No Slack channels configured, skipping");
    return 0;
  }

  const allStudents = await storage.getStudentsByInstructor(userId);
  const allStudentsGlobal = await storage.getAllStudents();
  const studentPool = allStudents.length > 0 ? allStudents : allStudentsGlobal;

  const oldest = String(Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000));
  let processed = 0;
  let skippedCooldown = 0;

  for (const channelConfig of enabledChannelConfigs) {
    try {
      const data = await slackApi("conversations.history", token, {
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
            const userInfo = await getUserInfo(msg.user, token);
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
          const threadData = await slackApi("conversations.replies", token, {
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
                const userInfo = await getUserInfo(reply.user, token);
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

  try {
    const dmData = await slackApi("conversations.list", token, {
      types: "im",
      limit: "100",
    });

    const dmChannels: SlackChannel[] = dmData.channels || [];

    for (const dm of dmChannels) {
      try {
        const data = await slackApi("conversations.history", token, {
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
              const userInfo = await getUserInfo(msg.user, token);
              senderName = userInfo.profile?.real_name || userInfo.real_name || "Unknown";
              senderEmail = userInfo.profile?.email || "";
            } catch {
              senderName = msg.user;
            }

            const matchedStudent = studentPool.find(s =>
              (s.slackUserId && s.slackUserId === msg.user)
              || (senderEmail && s.email.toLowerCase() === senderEmail.toLowerCase())
              || s.name.toLowerCase() === senderName.toLowerCase()
            );

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
