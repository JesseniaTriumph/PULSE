import OpenAI from "openai";

// Try standard OPENAI_API_KEY first, fallback to Replit AI integrations if needed
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "dummy",
  baseURL: process.env.OPENAI_API_KEY ? undefined : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface ClassificationResult {
  attendanceType: string;
  category: "Medical" | "Family" | "Administrative" | "Technical" | "Other" | "Unexcused";
  confidence: number;
  confidenceTier: "low" | "medium" | "high";
  reasoning: string;
  needsResponse: boolean;
  urgency: "low" | "medium" | "high";
  alertReason: string | null;
  mentionsStudent: boolean;
  mentionsSchool: boolean;
  peerOrSchoolDetail: string | null;
  requiresManualReview: boolean;
  recommendedAssessmentAction: "none" | "excuse" | "zero_out" | "makeup_allowed";
  recommendedAssessmentReason: string | null;
}

const SYSTEM_PROMPT = `You are an attendance management assistant for Pursuit (a tech training program). Analyze student emails and classify them using institutional excuse categories.

CLASSIFICATION 1 — Attendance Type (was the person present?):
- "Absent" — Student will not attend at all
- "Late/Tardy" — Student will attend but will arrive late, leave early, or step out partway
- "Unexcused" — No valid reason provided, vague excuses, or not a genuine notification

CLASSIFICATION 2 — Institutional Excuse Categories (use these four categories):
- "Medical" — Illness, injury, medical appointments, hospitalization, mental health. Phrases: sick, ill, fever, flu, COVID, hospital, ER, urgent care, doctor, dentist, surgery, therapy, migraine, food poisoning, injured, medication, quarantine
- "Family" — Family emergencies, death in family, childcare/eldercare emergencies. Phrases: family emergency, funeral, memorial, passed away, died, bereavement, family crisis, relative hospitalized, family member sick, childcare emergency, eldercare
- "Administrative" — Legal obligations, court appearances, jury duty, administrative requirements. Phrases: jury duty, subpoena, court date, legal obligation, immigration, visa, government office, DMV, passport, tribunal, deposition
- "Technical" — Internet, equipment, transportation, infrastructure problems. Phrases: internet down, WiFi, power outage, laptop broken, computer crashed, car broke down, vehicle trouble, train cancelled, bus delayed, can't log in, server issue
- "Other" — Legitimate situations that don't fit Medical/Family/Administrative/Technical. Use for: job interviews, work conflicts, housing emergencies (eviction, locked out, no heat), personal emergencies, financial situations. Student provides a real explanation but it falls outside the other four categories.
- "Unexcused" — No valid reason, vague excuses, or not a genuine notification. Use when student provides no details or clearly invalid excuse.

DUAL-THRESHOLD CONFIDENCE SYSTEM:
- Low confidence (<0.4): Very vague, suspicious, or contradictory information. Requires manual review.
- Medium confidence (0.4-0.7): Plausible but missing details. Triggers Slack alert for instructor oversight.
- High confidence (>0.7): Clear, specific explanation with verifiable details. Auto-verified.

ALERT ASSESSMENT — Does this email need a response from the instructor?
Look for:
- Questions that need answering ("Can I...?", "What should I...?", "Is it possible to...?")
- Special requests (schedule change, accommodation, makeup work, extension)
- Urgent matters (job interview scheduling, emergency situation requiring guidance)
- Requests for information about class, format, assignments, or materials

PEER & SCHOOL MENTION CHECK:
- Mentions of another student by name or description
- Reports about peer behavior, conflicts, bullying, or concerns about another student's wellbeing
- Feedback or complaints about Pursuit — classes, curriculum, instructors, staff, facilities

Important rules:
- "running late because I'm sick" → attendanceType: "Late/Tardy", category: "Medical"
- "I won't be in today, I have the flu" → attendanceType: "Absent", category: "Medical"
- "can't make it, something came up" (no details) → attendanceType: "Unexcused", category: "Unexcused"
- Leaving early or stepping out → attendanceType: "Late/Tardy"
- If mentions another student OR school/program → needsResponse: true, urgency: at least "medium"
- Be conservative with confidence — vague excuses get 0.4-0.6

ASSESSMENT ACTION RECOMMENDATION:
- "excuse" — Medical, Family, Administrative, Other (verified legitimate reason). Exempt from attendance grade.
- "makeup_allowed" — Technical with valid reason. Allow makeup work or alternative session.
- "zero_out" — Unexcused absences. Student receives zero for attendance grade.
- "none" — Late/Tardy (partial attendance) or when instructor should manually decide.

Respond in JSON with these fields:
- "attendanceType": one of "Absent", "Late/Tardy", "Unexcused"
- "category": one of "Medical", "Family", "Administrative", "Technical", "Other", "Unexcused"
- "confidence": number 0-1 (vague excuses get 0.4-0.6)
- "reasoning": brief one-sentence explanation including why this confidence level
- "needsResponse": boolean
- "urgency": "low", "medium", or "high"
- "alertReason": string or null
- "mentionsStudent": boolean
- "mentionsSchool": boolean
- "peerOrSchoolDetail": string or null
- "recommendedAssessmentAction": one of "excuse", "makeup_allowed", "zero_out", "none"
- "recommendedAssessmentReason": string or null`;

const MODEL_TIERS = [
  { model: "gpt-4o-mini", label: "mini" },
  { model: "gpt-4o", label: "full" },
] as const;

const validCategories = ["Medical", "Family", "Administrative", "Technical", "Other", "Unexcused"];
const validTypes = ["Absent", "Late/Tardy", "Unexcused"];
const validUrgencies = ["low", "medium", "high"];

/**
 * Dual-Threshold Confidence System:
 * - Low (<0.4): Requires manual review
 * - Medium (0.4-0.7): Triggers Slack alert for instructor oversight
 * - High (>0.7): Auto-verified
 */
function getConfidenceTier(confidence: number): "low" | "medium" | "high" {
  if (confidence < 0.4) return "low";
  if (confidence <= 0.7) return "medium";
  return "high";
}

function parseResponse(content: string): ClassificationResult | null {
  try {
    const parsed = JSON.parse(content);
    const attendanceType = validTypes.includes(parsed.attendanceType) ? parsed.attendanceType : null;
    const category = validCategories.includes(parsed.category) ? parsed.category : null;
    if (!attendanceType || !category) return null;
    const urgency = validUrgencies.includes(parsed.urgency) ? parsed.urgency as "low" | "medium" | "high" : "low";
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.5;

    const confidenceTier = getConfidenceTier(confidence);

    // Low confidence (<0.4) requires manual review - escalate to next tier or return fallback
    if (confidenceTier === "low") return null;

    // Medium confidence (0.4-0.7) triggers Slack alert but is still valid
    // High confidence (>0.7) is auto-verified
    const requiresManualReview = false; // low confidence already returned null above
    const shouldTriggerSlackAlert = confidenceTier === "medium";

    const mentionsStudent = !!parsed.mentionsStudent;
    const mentionsSchool = !!parsed.mentionsSchool;
    const hasMention = mentionsStudent || mentionsSchool;

    const enforceNeedsResponse = hasMention ? true : !!parsed.needsResponse;
    const enforceUrgency = hasMention && urgency === "low" ? "medium" as const : urgency;

    const validAssessmentActions = ["none", "excuse", "zero_out", "makeup_allowed"];
    const recommendedAssessmentAction = validAssessmentActions.includes(parsed.recommendedAssessmentAction)
      ? parsed.recommendedAssessmentAction
      : getDefaultAssessmentAction(category as ClassificationResult["category"], attendanceType);

    return {
      attendanceType,
      category: category as ClassificationResult["category"],
      confidence,
      confidenceTier,
      reasoning: parsed.reasoning || "Classified by AI",
      needsResponse: enforceNeedsResponse,
      urgency: enforceUrgency,
      alertReason: parsed.alertReason || (hasMention ? `Contains ${mentionsStudent ? "peer mention" : ""}${mentionsStudent && mentionsSchool ? " and " : ""}${mentionsSchool ? "school/program report" : ""}` : null),
      mentionsStudent,
      mentionsSchool,
      peerOrSchoolDetail: parsed.peerOrSchoolDetail || null,
      requiresManualReview,
      recommendedAssessmentAction,
      recommendedAssessmentReason: parsed.recommendedAssessmentReason || getAssessmentActionReason(recommendedAssessmentAction),
    };
  } catch {
    return null;
  }
}

function getDefaultAssessmentAction(category: ClassificationResult["category"], attendanceType: string): "none" | "excuse" | "zero_out" | "makeup_allowed" {
  // Institutional category mapping for assessment actions
  if (attendanceType === "Unexcused" && category === "Unexcused") return "zero_out";
  if (category === "Medical" || category === "Family" || category === "Administrative" || category === "Other") return "excuse";
  if (category === "Technical") return "makeup_allowed";
  if (attendanceType === "Late/Tardy") return "none";
  return "excuse";
}

function getAssessmentActionReason(action: string): string {
  switch (action) {
    case "excuse": return "Verified emergency (Medical/Family/Administrative) - exempt from attendance grade";
    case "makeup_allowed": return "Technical issue - allow makeup work or alternative session";
    case "zero_out": return "Unexcused absence - zero attendance grade";
    default: return "Manual review recommended";
  }
}

async function sendSlackNotification(result: ClassificationResult, emailBody: string): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.log("[Slack Notification] No SLACK_BOT_TOKEN configured, skipping notification");
    return;
  }

  const channelConfigs = await storage.getAllEnabledSlackChannelConfigs();
  if (channelConfigs.length === 0) {
    console.log("[Slack Notification] No Slack channels configured, skipping notification");
    return;
  }

  const targetChannel = channelConfigs[0].channelId;

  const message = {
    channel: targetChannel,
    text: "🔍 *AI Classification Requires Manual Review*",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🔍 AI Classification Requires Manual Review",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Confidence:* ${Math.round(result.confidence * 100)}% (${result.confidenceTier})`,
          },
          {
            type: "mrkdwn",
            text: `*Category:* ${result.category}`,
          },
          {
            type: "mrkdwn",
            text: `*Attendance:* ${result.attendanceType}`,
          },
          {
            type: "mrkdwn",
            text: `*Urgency:* ${result.urgency}`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Reasoning:* ${result.reasoning}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Message Preview:*\n\`\`\`${emailBody.substring(0, 500)}${emailBody.length > 500 ? "..." : ""}\`\`\``,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "⚠️ This classification has medium confidence and requires human verification before processing.",
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!res.ok) {
      console.error(`[Slack Notification] Failed to send notification: ${res.status}`);
      return;
    }

    const data = await res.json();
    if (data.ok) {
      console.log("[Slack Notification] Notification sent successfully");
    } else {
      console.error(`[Slack Notification] Slack API error: ${data.error}`);
    }
  } catch (error) {
    console.error("[Slack Notification] Error sending notification:", error);
  }
}

// Import storage lazily to avoid circular dependency
let storage: any = null;
async function getStorage() {
  if (!storage) {
    const mod = await import("./storage");
    storage = mod.storage;
  }
  return storage;
}

// ---------------------------------------------------------------------------
// Keyword pre-classifier — free, zero API calls, handles ~80% of cases
// ---------------------------------------------------------------------------
const KEYWORD_MAP = {
  Medical: ["sick", "ill ", "fever", "flu", "covid", "hospital", "er ", "urgent care", "doctor", "dentist", "surgery", "therapy", "migraine", "food poisoning", "injured", "medication", "quarantine", "vomiting", "nausea", "headache", "stomachache", "not feeling well", "feeling sick", "under the weather", "medical appointment", "mental health"],
  Family: ["family emergency", "funeral", "memorial", "passed away", "died", "bereavement", "family crisis", "relative hospitalized", "family member sick", "childcare", "eldercare", "death in the family", "family situation", "family matter"],
  Administrative: ["jury duty", "subpoena", "court date", "legal obligation", "immigration", "visa appointment", "government office", "dmv", "passport", "tribunal", "deposition", "legal matter"],
  Technical: ["internet down", "no internet", "wifi", "power outage", "laptop broken", "computer crashed", "car broke down", "vehicle trouble", "train cancelled", "bus delayed", "can't log in", "connection issues", "no power", "outage"],
  Other: ["job interview", "interview today", "work conflict", "called into work", "got called in", "work emergency", "housing", "locked out", "eviction", "no heat", "gas leak", "financial", "personal emergency", "personal situation", "personal matter"],
};

const ABSENCE_KEYWORDS = ["won't be", "cannot make it", "can't make it", "will not be", "unable to attend", "not going to be", "won't attend", "won't be able", "can't come", "absent today", "missing class", "not coming", "not able to make", "staying home", "going to miss"];
const LATE_KEYWORDS = ["running late", "will be late", "going to be late", "might be late", "few minutes late", "behind schedule", "tardy", "late today", "arriving late", "leaving early", "have to leave early", "need to leave early", "slightly late", "a little late"];

function classifyByKeywords(emailBody: string): ClassificationResult | null {
  const body = emailBody.toLowerCase();

  const isLate = LATE_KEYWORDS.some(k => body.includes(k));
  const isAbsent = ABSENCE_KEYWORDS.some(k => body.includes(k));

  if (!isLate && !isAbsent) return null;

  const attendanceType: "Absent" | "Late/Tardy" = isLate ? "Late/Tardy" : "Absent";

  let matchedCategory: ClassificationResult["category"] | null = null;
  let matchCount = 0;

  for (const [cat, keywords] of Object.entries(KEYWORD_MAP)) {
    const hits = keywords.filter(k => body.includes(k)).length;
    if (hits > matchCount) {
      matchCount = hits;
      matchedCategory = cat as ClassificationResult["category"];
    }
  }

  if (!matchedCategory) return null;

  const confidence = Math.min(0.72 + matchCount * 0.04, 0.92);
  const assessmentAction = getDefaultAssessmentAction(matchedCategory, attendanceType);

  console.log(`[AI] Keyword classifier matched: ${matchedCategory} / ${attendanceType} (confidence: ${confidence.toFixed(2)}, hits: ${matchCount}) — skipping OpenAI`);

  return {
    attendanceType,
    category: matchedCategory,
    confidence,
    confidenceTier: getConfidenceTier(confidence),
    reasoning: `Rule-based keyword match (${matchCount} signal${matchCount > 1 ? "s" : ""} detected)`,
    needsResponse: false,
    urgency: "low",
    alertReason: null,
    mentionsStudent: false,
    mentionsSchool: false,
    peerOrSchoolDetail: null,
    requiresManualReview: false,
    recommendedAssessmentAction: assessmentAction,
    recommendedAssessmentReason: getAssessmentActionReason(assessmentAction),
  };
}

export async function categorizeExcuse(emailBody: string): Promise<ClassificationResult> {
  // Try keyword pre-classifier first — free, no API call, handles ~80% of cases
  const keywordResult = classifyByKeywords(emailBody);
  if (keywordResult) return keywordResult;

  const tiersArray = Array.from(MODEL_TIERS);
  const lastIndex = tiersArray.length - 1;

  for (const [index, tier] of tiersArray.entries()) {
    const isFinalTier = index === lastIndex;

    try {
      console.log(`[AI] Trying ${tier.label} (${tier.model})...`);
      const response = await openai.chat.completions.create({
        model: tier.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analyze this student email:\n\n${emailBody}` },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 500,
      });

      const content = response.choices[0]?.message?.content || "{}";
      const result = parseResponse(content);

      if (result) {
        console.log(`[AI] ${tier.label} succeeded (confidence: ${result.confidence}, tier: ${result.confidenceTier})`);

        // Handle medium-confidence results with Slack notification
        if (result.confidenceTier === "medium") {
          console.log("[AI] Medium confidence detected — triggering Slack notification for manual review");
          await getStorage();
          await sendSlackNotification(result, emailBody).catch(err => {
            console.error("[AI] Failed to send Slack notification:", err);
          });
        }

        return result;
      }

      if (isFinalTier) {
        console.warn("[WARNG] Final Tier Quality Threshold Not Met");
        const fallbackResult: ClassificationResult = {
          attendanceType: "Absent",
          category: "Unexcused",
          confidence: 0,
          confidenceTier: "low",
          reasoning: "Final tier model returned low-confidence result",
          needsResponse: true,
          urgency: "medium",
          alertReason: "AI classification failed — manual review needed",
          mentionsStudent: false,
          mentionsSchool: false,
          peerOrSchoolDetail: null,
          requiresManualReview: true,
          recommendedAssessmentAction: "none",
          recommendedAssessmentReason: "Manual review required",
        };
        return fallbackResult;
      }

      console.log(`[AI] ${tier.label} returned low-confidence or invalid result, escalating...`);
    } catch (error: any) {
      const isRateLimit = error?.status === 429 || error?.code === "rate_limit_exceeded";
      const isOverloaded = error?.status === 503 || error?.status === 529;
      console.error(`[AI] ${tier.label} failed (${isRateLimit ? "rate limited" : isOverloaded ? "overloaded" : error?.message || "unknown"}), trying next tier...`);

      if (isFinalTier) {
        console.warn("[WARNG] Final Tier Quality Threshold Not Met");
        const fallbackResult: ClassificationResult = {
          attendanceType: "Absent",
          category: "Unexcused",
          confidence: 0,
          confidenceTier: "low",
          reasoning: "All AI models failed to classify this email",
          needsResponse: true,
          urgency: "medium",
          alertReason: "AI classification failed — manual review needed",
          mentionsStudent: false,
          mentionsSchool: false,
          peerOrSchoolDetail: null,
          requiresManualReview: true,
          recommendedAssessmentAction: "none",
          recommendedAssessmentReason: "Manual review required",
        };
        return fallbackResult;
      }
    }
  }

  console.error("[AI] All model tiers failed, returning default classification");
  return {
    attendanceType: "Absent",
    category: "Unexcused",
    confidence: 0,
    confidenceTier: "low",
    reasoning: "All AI models failed to classify this email",
    needsResponse: true,
    urgency: "medium",
    alertReason: "AI classification failed — manual review needed",
    mentionsStudent: false,
    mentionsSchool: false,
    peerOrSchoolDetail: null,
    requiresManualReview: true,
    recommendedAssessmentAction: "none",
    recommendedAssessmentReason: "Manual review required",
  };
}

export async function generateReplyDraft(
  messageBody: string,
  context: {
    senderName: string;
    attendanceType: string;
    category: string;
    assessmentAction: string;
  }
): Promise<string> {
  const actionNote: Record<string, string> = {
    excuse: "Their absence will be marked as excused.",
    makeup_allowed: "They'll have the opportunity to make up any missed work.",
    zero_out: "Please note that unexcused absences affect attendance grades.",
    none: "",
  };

  const systemPrompt = `You are helping a Pursuit instructor write a short, warm, professional reply to a student's attendance message.
Write 2-3 sentences max. Acknowledge their situation, confirm receipt, and note what action is being taken if relevant.
Be human, empathetic, and encouraging. Use first person as the instructor. Do not use placeholders like [name] — use the actual student name provided.
Do not add a subject line. Return only the reply body text.`;

  const userPrompt = `Student name: ${context.senderName}
Attendance type: ${context.attendanceType}
Category: ${context.category}
Action: ${actionNote[context.assessmentAction] || ""}

Student's original message:
${messageBody}

Write a reply the instructor can send directly.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 200,
    });
    return response.choices[0]?.message?.content?.trim() || "";
  } catch {
    return "";
  }
}
