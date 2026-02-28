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
}

export async function categorizeExcuse(emailBody: string): Promise<ClassificationResult> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      {
        role: "system",
        content: `You are an attendance management assistant. Analyze student emails and provide TWO classifications plus an alert assessment.

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

Important rules:
- If someone says "running late because I'm sick" → attendanceType: "Late/Tardy", category: "Sick/Medical"
- If someone says "I won't be in today, I have the flu" → attendanceType: "Absent", category: "Sick/Medical"
- If someone says "can't make it, something came up" (no details) → attendanceType: "Unexcused", category: "None"
- Leaving early or stepping out → attendanceType: "Late/Tardy"

Respond in JSON with these fields:
- "attendanceType": one of "Absent", "Late/Tardy", "Unexcused"
- "category": one of "Sick/Medical", "Personal", "Program Event", "Technical Issue", "Other", "None"
- "confidence": number 0-1
- "reasoning": brief one-sentence explanation
- "needsResponse": boolean — true if the email contains a question, special request, or urgent matter that the instructor should respond to
- "urgency": "low", "medium", or "high" — how urgently the instructor should see/respond to this
- "alertReason": string or null — if needsResponse is true, briefly explain what needs attention`,
      },
      {
        role: "user",
        content: `Analyze this student email:\n\n${emailBody}`,
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 350,
  });

  const validCategories = ["Sick/Medical", "Personal", "Program Event", "Technical Issue", "Other", "None"];
  const validTypes = ["Absent", "Late/Tardy", "Unexcused"];
  const validUrgencies = ["low", "medium", "high"];
  const content = response.choices[0]?.message?.content || "{}";

  try {
    const parsed = JSON.parse(content);
    const attendanceType = validTypes.includes(parsed.attendanceType) ? parsed.attendanceType : "Absent";
    const category = validCategories.includes(parsed.category) ? parsed.category : "None";
    const urgency = validUrgencies.includes(parsed.urgency) ? parsed.urgency as "low" | "medium" | "high" : "low";

    return {
      attendanceType,
      category,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      reasoning: parsed.reasoning || "Unable to determine category",
      needsResponse: !!parsed.needsResponse,
      urgency,
      alertReason: parsed.alertReason || null,
    };
  } catch {
    return {
      attendanceType: "Absent",
      category: "None",
      confidence: 0,
      reasoning: "Failed to parse AI response",
      needsResponse: false,
      urgency: "low",
      alertReason: null,
    };
  }
}
