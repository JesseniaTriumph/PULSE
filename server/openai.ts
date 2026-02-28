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

1. "Sick/Medical" - Illness, doctor appointments, medical emergencies, health-related issues
2. "Personal" - Travel, family events, personal obligations, family emergencies
3. "Program Event" - Conflict with program-related events, workshops, conferences, or scheduled activities
4. "Technical Issue" - Internet issues, transport problems, equipment failures, software problems
5. "Late/Tardy" - Running late, arriving late, delayed arrival, tardiness, will be late but still coming
6. "Other" - Miscellaneous reasons that don't fit the above categories but still provide a reason
7. "Unexcused" - No valid reason provided, vague excuses, or the message doesn't actually contain an excuse or tardiness notification

Important: If the message indicates the person will still attend but will be late or delayed, categorize as "Late/Tardy". If they will be completely absent, use the appropriate absence category.

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
