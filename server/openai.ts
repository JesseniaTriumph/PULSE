import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function categorizeExcuse(emailBody: string): Promise<{
  category: string;
  confidence: number;
  reasoning: string;
}> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      {
        role: "system",
        content: `You are an attendance management assistant. Your job is to categorize student absence or tardiness messages into exactly one of these categories:

1. "Sick/Medical" - Illness, doctor appointments, medical emergencies, health-related issues. Includes phrases like: not feeling well, under the weather, out sick, flu, fever, migraine, hospital, ER, urgent care, therapy appointment, mental health day, COVID, quarantine, food poisoning, surgery, recovery
2. "Personal" - Travel, family events, personal obligations, family emergencies. Includes phrases like: family emergency, funeral, wedding, out of town, traveling, personal matter, taking the day off, child care, picking up kids, moving, jury duty, court date, religious observance, bereavement
3. "Program Event" - Conflict with program-related events, workshops, conferences, or scheduled activities. Includes phrases like: conference, workshop, hackathon, career fair, networking event, required event, field trip, orientation, program activity, guest speaker, company visit
4. "Technical Issue" - Internet issues, transport problems, equipment failures, software problems. Includes phrases like: internet down, WiFi issues, laptop broken, computer crashed, power outage, no electricity, car broke down, bus delayed, train cancelled, transportation issue, software update, can't log in
5. "Late/Tardy" - Running late, arriving late, delayed arrival, tardiness — the person is still coming but will not be on time. Includes phrases like: running late, running behind, will be late, stuck in traffic, held up, on my way, be there soon, few minutes late, delayed, won't make it on time, starting late, stepping in late, caught up in something, overslept but coming, missed the bus but on my way, parking issues
6. "Other" - Miscellaneous reasons that don't fit the above categories but still provide a valid reason
7. "Unexcused" - No valid reason provided, vague excuses, or the message doesn't actually contain an excuse or tardiness notification. Includes phrases like: can't make it (with no reason), something came up (with no details), just won't be there

Important distinctions:
- If the person says they will still attend but will arrive late or be delayed, use "Late/Tardy"
- If the person will be completely absent for the entire session/class, use the appropriate absence category
- Messages about leaving early or stepping out partway through should be "Late/Tardy"
- If a message mentions both being late AND a specific reason (e.g. "running late because I'm sick"), prioritize the root cause category (Sick/Medical in that example)

Respond in JSON format with exactly these fields:
- "category": one of the seven categories above (exact string match)
- "confidence": a number between 0 and 1 indicating how confident you are
- "reasoning": a brief one-sentence explanation of why you chose this category`,
      },
      {
        role: "user",
        content: `Categorize this absence or tardiness email:\n\n${emailBody}`,
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 256,
  });

  const validCategories = ["Sick/Medical", "Personal", "Program Event", "Technical Issue", "Late/Tardy", "Other", "Unexcused"];
  const content = response.choices[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(content);
    const category = validCategories.includes(parsed.category) ? parsed.category : "Unexcused";
    return {
      category,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      reasoning: parsed.reasoning || "Unable to determine category",
    };
  } catch {
    return {
      category: "Unexcused",
      confidence: 0,
      reasoning: "Failed to parse AI response",
    };
  }
}
