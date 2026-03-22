import { storage } from "./storage";
import { categorizeExcuse } from "./openai";

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

interface SlackInteractionPayload {
  type: string;
  callback_id?: string;
  actions?: Array<{ action_id: string; value: string }>;
  user: { id: string; name: string };
  channel: { id: string; name: string };
  message?: { ts: string; text: string };
  trigger_id?: string;
  command?: string;
  text?: string;
  response_url?: string;
  team: { id: string };
}

interface SlackEvent {
  type: string;
  user?: string;
  channel?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  parent_user_id?: string;
}

interface SlackChallenge {
  type: "url_verification";
  challenge: string;
  token: string;
}

const EXCUSE_CATEGORY_EMOJIS: Record<string, string> = {
  "Medical": ":hospital:",
  "Family": ":pray:",
  "Administrative": ":courthouse:",
  "Technical": ":computer:",
  "Other": ":pushpin:",
  "Unexcused": ":no_entry:",
};

const EXCUSE_CATEGORY_TAGS: Record<string, string> = {
  "Medical": "#medical",
  "Family": "#family-emergency",
  "Administrative": "#administrative",
  "Technical": "#technical",
  "Other": "#other",
  "Unexcused": "#unexcused",
};

async function slackApi(endpoint: string, token: string, body?: any): Promise<any> {
  const response = await fetch(`https://slack.com/api/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Slack API ${endpoint} returned ${response.status}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Slack API ${endpoint} error: ${data.error}`);
  }

  return data;
}

export async function handleSlackInteraction(payload: SlackInteractionPayload): Promise<any> {
  if (payload.type === "slash_command" && payload.command === "/pulse-recap") {
    return handlePulseRecap(payload);
  }

  if (payload.type === "block_actions") {
    return handleBlockAction(payload);
  }

  return { status: 200 };
}

async function handlePulseRecap(payload: SlackInteractionPayload): Promise<any> {
  const { text, user, channel, response_url, team } = payload;
  const className = text?.trim();

  if (!response_url) {
    return { status: 200, text: "Error: Could not send response" };
  }

  // Acknowledge immediately
  await fetch(response_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "📊 Generating Pulse Recap... This may take a moment.",
      response_type: "ephemeral",
    }),
  });

  try {
    // Get user by Slack ID (if connected) or use admin
    const users = await storage.getAllInstructors();
    const adminUser = users.find(u => u.role === "admin") || users[0];

    if (!adminUser) {
      await fetch(response_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "❌ Error: No admin user found. Please ensure PULSE is properly configured.",
          response_type: "ephemeral",
        }),
      });
      return { status: 200 };
    }

    // Get recent records
    const allRecords = await storage.getAllRecordsAdmin();
    let recentRecords = allRecords
      .filter(r => r.attendanceType !== "Late/Tardy" || r.excuseCategory !== "Unexcused")
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
      .slice(0, 5);

    if (recentRecords.length === 0) {
      await fetch(response_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "📊 *Pulse Recap*\n\nNo recent attendance records found.",
          response_type: "ephemeral",
        }),
      });
      return { status: 200 };
    }

    // Use AI to generate summary with Full tier
    const recapText = recentRecords
      .map(r => `${r.senderName}: ${r.attendanceType} - ${r.excuseCategory} (${new Date(r.receivedAt).toLocaleDateString()})`)
      .join("\n");

    const summaryPrompt = `Analyze these 5 recent student attendance records and provide a concise summary report.

RECORDS:
${recapText}

Provide:
1. Overall attendance trend (e.g., "3 out of 5 absences due to illness")
2. Category breakdown with counts
3. Any concerning patterns (e.g., multiple flu cases, pattern of unexcused absences)
4. Recommended actions for instructors

Keep it brief and actionable. Use bullet points.`;

    const aiResult = await categorizeExcuse(summaryPrompt);

    // Count categories
    const categoryCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};

    for (const record of recentRecords) {
      categoryCounts[record.excuseCategory] = (categoryCounts[record.excuseCategory] || 0) + 1;
      typeCounts[record.attendanceType] = (typeCounts[record.attendanceType] || 0) + 1;
    }

    // Build recap blocks
    const categorySummary = Object.entries(categoryCounts)
      .map(([cat, count]) => `${EXCUSE_CATEGORY_EMOJIS[cat] || ":bullet:"} *${count}* ${EXCUSE_CATEGORY_TAGS[cat] || cat}`)
      .join("\n");

    const typeSummary = Object.entries(typeCounts)
      .map(([type, count]) => `• ${type}: ${count}`)
      .join("\n");

    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📊 Pulse Recap — Latest 5 Records",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Attendance Types*\n${typeSummary}`,
          },
          {
            type: "mrkdwn",
            text: `*Categories*\n${categorySummary}`,
          },
        ],
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*AI Analysis:*\n${aiResult.reasoning}`,
        },
      },
    ];

    // Add trend warning if concerning pattern detected
    const medicalCount = categoryCounts["Medical/Hospitalization"] || 0;
    const unexcusedCount = categoryCounts["Unexcused"] || 0;

    if (medicalCount >= 3) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":warning: *Trend Alert:* Multiple medical absences detected. Consider checking for potential illness outbreak.",
        },
      });
    }

    if (unexcusedCount >= 2) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":warning: *Trend Alert:* Multiple unexcused absences. Consider reaching out to students.",
        },
      });
    }

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Generated by PULSE AI • ${new Date().toLocaleString()}`,
        },
      ],
    });

    await fetch(response_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "📊 Pulse Recap Generated",
        blocks,
        response_type: "ephemeral",
      }),
    });

    return { status: 200 };
  } catch (error) {
    console.error("[Slack Commands] Error generating Pulse Recap:", error);
    await fetch(response_url!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "❌ Error generating Pulse Recap. Please try again.",
        response_type: "ephemeral",
      }),
    });
    return { status: 200 };
  }
}

async function handleBlockAction(payload: SlackInteractionPayload): Promise<any> {
  const action = payload.actions?.[0];

  if (action?.action_id === "tag_excuse_category") {
    const { channel, message, user } = payload;
    const category = action.value;

    try {
      // Add reaction to the message
      await slackApi("reactions.add", SLACK_BOT_TOKEN!, {
        channel: channel.id,
        timestamp: message?.ts,
        name: EXCUSE_CATEGORY_EMOJIS[category]?.replace(":", "") || "question",
      });

      return { status: 200 };
    } catch (error) {
      console.error("[Slack Commands] Error adding reaction:", error);
      return { status: 200 };
    }
  }

  return { status: 200 };
}

export async function handleSlackEvent(event: SlackEvent, teamId: string): Promise<void> {
  // Handle thread messages for automated tagging
  if (event.type === "message" && event.thread_ts && !event.parent_user_id) {
    // This is a parent message of a thread - analyze for tagging
    await analyzeAndTagThread(event, teamId);
  }
}

async function analyzeAndTagThread(event: SlackEvent, teamId: string): Promise<void> {
  if (!event.text || !SLACK_BOT_TOKEN) return;

  // Check if message contains attendance-related keywords
  const attendanceKeywords = [
    "absent", "absence", "excuse", "sick", "can't make it", "won't be able",
    "not coming", "late", "tardy", "emergency", "appointment", "doctor",
    "hospital", "family emergency", "funeral", "interview", "conference",
  ];

  const hasAttendanceKeyword = attendanceKeywords.some(
    keyword => event.text!.toLowerCase().includes(keyword)
  );

  if (!hasAttendanceKeyword) return;

  try {
    // Use AI to categorize
    const categorization = await categorizeExcuse(event.text);

    // Add appropriate emoji reaction
    const emoji = EXCUSE_CATEGORY_EMOJIS[categorization.category]?.replace(":", "");
    if (emoji && event.channel && event.ts) {
      await slackApi("reactions.add", SLACK_BOT_TOKEN, {
        channel: event.channel,
        timestamp: event.ts,
        name: emoji,
      });
    }

    // Add category tag as a threaded reply (if high confidence)
    if (categorization.confidence >= 0.7 && event.channel && event.ts) {
      const tag = EXCUSE_CATEGORY_TAGS[categorization.category];
      const confidenceLabel = categorization.confidence >= 0.85 ? "High" : "Medium";

      await slackApi("chat.postMessage", SLACK_BOT_TOKEN, {
        channel: event.channel,
        thread_ts: event.ts,
        text: `🏷️ *Auto-tagged:* ${tag}\n• Category: ${categorization.category}\n• Confidence: ${confidenceLabel} (${Math.round(categorization.confidence * 100)}%)\n• Recommended: ${categorization.recommendedAssessmentAction.replace("_", " ")}`,
      });
    }

    console.log(`[Slack Auto-Tag] Tagged message in ${event.channel} with ${categorization.category}`);
  } catch (error) {
    console.error("[Slack Auto-Tag] Error analyzing message:", error);
  }
}

export async function sendSlackRecapNotification(
  channelId: string,
  records: Array<{
    senderName: string;
    attendanceType: string;
    excuseCategory: string;
    receivedAt: Date;
  }>
): Promise<void> {
  if (!SLACK_BOT_TOKEN) return;

  const categoryCounts: Record<string, number> = {};
  for (const record of records) {
    categoryCounts[record.excuseCategory] = (categoryCounts[record.excuseCategory] || 0) + 1;
  }

  const categorySummary = Object.entries(categoryCounts)
    .map(([cat, count]) => `${EXCUSE_CATEGORY_EMOJIS[cat] || ":bullet:"} ${count} ${cat}`)
    .join("\n");

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "📊 Daily Pulse Recap",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Today's Attendance Summary*\n${records.length} records processed\n\n*Categories:*\n${categorySummary}`,
      },
    },
  ];

  try {
    await slackApi("chat.postMessage", SLACK_BOT_TOKEN, {
      channel: channelId,
      blocks,
    });
  } catch (error) {
    console.error("[Slack Recap] Error sending notification:", error);
  }
}

export function getExcuseCategoryEmoji(category: string): string {
  return EXCUSE_CATEGORY_EMOJIS[category] || ":question:";
}

export function getExcuseCategoryTag(category: string): string {
  return EXCUSE_CATEGORY_TAGS[category] || "#other";
}
