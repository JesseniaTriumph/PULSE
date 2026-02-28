import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface ClassificationResult {
  attendanceType: string;
  category: string;
  confidence: number;
  reasoning: string;
  needsResponse: boolean;
  urgency: "low" | "medium" | "high";
  alertReason: string | null;
  mentionsStudent: boolean;
  mentionsSchool: boolean;
  peerOrSchoolDetail: string | null;
}

const SYSTEM_PROMPT = `You are an attendance management assistant for Pursuit (a tech training program). Analyze student emails and provide TWO classifications, an alert assessment, and a peer/school mention check.

CLASSIFICATION 1 — Attendance Type (was the person present?):
- "Absent" — Student will not attend at all
- "Late/Tardy" — Student will attend but will arrive late, leave early, or step out partway
- "Unexcused" — No valid reason provided, vague excuses, or not a genuine notification

CLASSIFICATION 2 — Excuse Category (why?):
- "Sick/Medical" — Illness, doctor appointments, medical emergencies, health issues. Phrases: not feeling well, under the weather, out sick, flu, fever, migraine, hospital, ER, urgent care, therapy, mental health day, COVID, quarantine, food poisoning, surgery, recovery
- "Personal" — Travel, family events, personal obligations, family emergencies. Phrases: family emergency, funeral, wedding, out of town, traveling, personal matter, child care, moving, jury duty, court date, religious observance, bereavement
- "Program Event" — Conflict with program-related events, workshops, conferences. Phrases: conference, workshop, hackathon, career fair, networking event, field trip, orientation, guest speaker, company visit
- "Technical Issue" — Internet/equipment/transport problems. Phrases: internet down, WiFi issues, laptop broken, power outage, car broke down, bus delayed, train cancelled, can't log in
- "Other" — Valid reason that doesn't fit above categories
- "None" — Used when attendance type is Unexcused and no valid reason exists

ALERT ASSESSMENT — Does this email need a response from the instructor?
Look for:
- Questions that need answering ("Can I...?", "What should I...?", "Is it possible to...?")
- Special requests (schedule change, accommodation, makeup work, extension)
- Urgent matters (job interview scheduling, emergency situation requiring guidance, time-sensitive decisions)
- Requests for information about class, format, assignments, or materials
- Mentions of interviews, job offers, or career-related scheduling conflicts that need confirmation

PEER & SCHOOL MENTION CHECK — Does this email mention another student or report something about the school/program?
Look for:
- Mentions of another student by name or description (e.g., "my classmate", "another Fellow", "the person sitting next to me")
- Reports about peer behavior, conflicts, bullying, or concerns about another student's wellbeing
- Feedback or complaints about Pursuit itself — classes, curriculum, instructors, staff, facilities, policies, events
- Reports about incidents that happened at school or during program activities
- Mentions of group project issues involving other students
- Safety concerns involving peers or the learning environment

Important rules:
- If someone says "running late because I'm sick" → attendanceType: "Late/Tardy", category: "Sick/Medical"
- If someone says "I won't be in today, I have the flu" → attendanceType: "Absent", category: "Sick/Medical"
- If someone says "can't make it, something came up" (no details) → attendanceType: "Unexcused", category: "None"
- Leaving early or stepping out → attendanceType: "Late/Tardy"
- If the email mentions another student OR reports something about the school/program → set needsResponse to true and urgency to at least "medium"

Respond in JSON with these fields:
- "attendanceType": one of "Absent", "Late/Tardy", "Unexcused"
- "category": one of "Sick/Medical", "Personal", "Program Event", "Technical Issue", "Other", "None"
- "confidence": number 0-1
- "reasoning": brief one-sentence explanation
- "needsResponse": boolean — true if the email contains a question, special request, urgent matter, peer mention, or school report
- "urgency": "low", "medium", or "high" — how urgently the instructor should see/respond to this
- "alertReason": string or null — if needsResponse is true, briefly explain what needs attention
- "mentionsStudent": boolean — true if the email mentions or refers to another student
- "mentionsSchool": boolean — true if the email reports something about Pursuit, classes, curriculum, instructors, staff, or program events
- "peerOrSchoolDetail": string or null — if mentionsStudent or mentionsSchool is true, briefly describe what was mentioned`;

const MODEL_TIERS = [
  { model: "gpt-5-nano", label: "nano" },
  { model: "gpt-5-mini", label: "mini" },
  { model: "gpt-5.2", label: "full" },
] as const;

const validCategories = ["Sick/Medical", "Personal", "Program Event", "Technical Issue", "Other", "None"];
const validTypes = ["Absent", "Late/Tardy", "Unexcused"];
const validUrgencies = ["low", "medium", "high"];

function parseResponse(content: string): ClassificationResult | null {
  try {
    const parsed = JSON.parse(content);
    const attendanceType = validTypes.includes(parsed.attendanceType) ? parsed.attendanceType : null;
    const category = validCategories.includes(parsed.category) ? parsed.category : null;
    if (!attendanceType || !category) return null;
    const urgency = validUrgencies.includes(parsed.urgency) ? parsed.urgency as "low" | "medium" | "high" : "low";
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.5;
    if (confidence < 0.4) return null;

    const mentionsStudent = !!parsed.mentionsStudent;
    const mentionsSchool = !!parsed.mentionsSchool;
    const hasMention = mentionsStudent || mentionsSchool;

    const enforceNeedsResponse = hasMention ? true : !!parsed.needsResponse;
    const enforceUrgency = hasMention && urgency === "low" ? "medium" as const : urgency;

    return {
      attendanceType,
      category,
      confidence,
      reasoning: parsed.reasoning || "Classified by AI",
      needsResponse: enforceNeedsResponse,
      urgency: enforceUrgency,
      alertReason: parsed.alertReason || (hasMention ? `Contains ${mentionsStudent ? "peer mention" : ""}${mentionsStudent && mentionsSchool ? " and " : ""}${mentionsSchool ? "school/program report" : ""}` : null),
      mentionsStudent,
      mentionsSchool,
      peerOrSchoolDetail: parsed.peerOrSchoolDetail || null,
    };
  } catch {
    return null;
  }
}

export async function categorizeExcuse(emailBody: string): Promise<ClassificationResult> {
  for (const tier of MODEL_TIERS) {
    try {
      console.log(`[AI] Trying ${tier.label} (${tier.model})...`);
      const response = await openai.chat.completions.create({
        model: tier.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analyze this student email:\n\n${emailBody}` },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 400,
      });

      const content = response.choices[0]?.message?.content || "{}";
      const result = parseResponse(content);

      if (result) {
        console.log(`[AI] ${tier.label} succeeded (confidence: ${result.confidence})`);
        return result;
      }

      console.log(`[AI] ${tier.label} returned low-confidence or invalid result, escalating...`);
    } catch (error: any) {
      const isRateLimit = error?.status === 429 || error?.code === "rate_limit_exceeded";
      const isOverloaded = error?.status === 503 || error?.status === 529;
      console.error(`[AI] ${tier.label} failed (${isRateLimit ? "rate limited" : isOverloaded ? "overloaded" : error?.message || "unknown"}), trying next tier...`);
    }
  }

  console.error("[AI] All model tiers failed, returning default classification");
  return {
    attendanceType: "Absent",
    category: "None",
    confidence: 0,
    reasoning: "All AI models failed to classify this email",
    needsResponse: true,
    urgency: "medium",
    alertReason: "AI classification failed — manual review needed",
    mentionsStudent: false,
    mentionsSchool: false,
    peerOrSchoolDetail: null,
  };
}
