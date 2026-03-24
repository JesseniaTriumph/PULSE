/**
 * Tests for server/openai.ts
 * Covers:
 *  - classifyByKeywords (all 5 categories × absent/late paths, null returns)
 *  - getConfidenceTier (low / medium / high thresholds)
 *  - getDefaultAssessmentAction (all branches: zero_out, excuse, makeup_allowed, none, fallback)
 *  - getAssessmentActionReason (all 4 cases)
 *  - parseResponse (valid high, valid medium, low-confidence → null, invalid JSON → null, bad fields → null)
 *  - categorizeExcuse (keyword path, OpenAI path, escalation, final fallback, error paths)
 *  - generateReplyDraft (success, failure/catch)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mock handles so vi.fn() instances are accessible inside factories ──
const mockCreate = vi.hoisted(() => vi.fn());
const mockGetAllEnabledSlackChannelConfigs = vi.hoisted(() => vi.fn().mockResolvedValue([]));

vi.mock("openai", () => ({
  // Must use `function` keyword so Vitest allows `new OpenAI()`
  default: vi.fn(function (this: any) {
    this.chat = { completions: { create: mockCreate } };
  }),
}));

// Mock storage used by sendSlackNotification's lazy import
vi.mock("../server/storage", () => ({
  storage: {
    getAllEnabledSlackChannelConfigs: mockGetAllEnabledSlackChannelConfigs,
  },
}));

vi.mock("../server/db", () => ({ db: {} }));

import { categorizeExcuse, generateReplyDraft } from "../server/openai";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal valid OpenAI response JSON string */
function buildAiResponse(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    attendanceType: "Absent",
    category: "Medical",
    confidence: 0.85,
    reasoning: "Student clearly has a medical issue",
    needsResponse: false,
    urgency: "low",
    alertReason: null,
    mentionsStudent: false,
    mentionsSchool: false,
    peerOrSchoolDetail: null,
    recommendedAssessmentAction: "excuse",
    recommendedAssessmentReason: "Verified medical",
    ...overrides,
  });
}

function makeApiResponse(content: string) {
  return { choices: [{ message: { content } }] };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("categorizeExcuse — keyword pre-classifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure no SLACK_BOT_TOKEN so sendSlackNotification short-circuits
    delete process.env.SLACK_BOT_TOKEN;
  });

  it("classifies Medical/Absent via keywords (sick + fever)", async () => {
    const result = await categorizeExcuse(
      "I am not coming today because I am sick with a fever."
    );
    expect(result.attendanceType).toBe("Absent");
    expect(result.category).toBe("Medical");
    expect(result.confidence).toBeGreaterThanOrEqual(0.72);
    expect(result.requiresManualReview).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled(); // no API call
  });

  it("classifies Medical/Late via keywords (running late + migraine)", async () => {
    const result = await categorizeExcuse(
      "Running late today — I woke up with a migraine and had to wait for medication to kick in."
    );
    expect(result.attendanceType).toBe("Late/Tardy");
    expect(result.category).toBe("Medical");
    expect(result.recommendedAssessmentAction).toBe("excuse");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("classifies Family/Absent via keywords (family emergency + missing class)", async () => {
    const result = await categorizeExcuse(
      "I am missing class today because of a family emergency."
    );
    expect(result.attendanceType).toBe("Absent");
    expect(result.category).toBe("Family");
    expect(result.recommendedAssessmentAction).toBe("excuse");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("classifies Administrative/Absent via keywords (jury duty)", async () => {
    const result = await categorizeExcuse(
      "I won't attend today, I have jury duty and cannot leave."
    );
    expect(result.attendanceType).toBe("Absent");
    expect(result.category).toBe("Administrative");
    expect(result.recommendedAssessmentAction).toBe("excuse");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("classifies Technical/Absent via keywords (internet down + no internet)", async () => {
    const result = await categorizeExcuse(
      "I am missing class today — my internet is down and I have no internet access right now."
    );
    expect(result.attendanceType).toBe("Absent");
    expect(result.category).toBe("Technical");
    expect(result.recommendedAssessmentAction).toBe("makeup_allowed");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("classifies Other/Absent via keywords (job interview)", async () => {
    const result = await categorizeExcuse(
      "Sorry, I can't make it today — I have a job interview this morning."
    );
    expect(result.attendanceType).toBe("Absent");
    expect(result.category).toBe("Other");
    expect(result.recommendedAssessmentAction).toBe("excuse");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns higher confidence when multiple category keywords match", async () => {
    const result = await categorizeExcuse(
      "I am not coming today — I have a fever and I'm very sick and I went to the hospital."
    );
    // sick=1, fever=2, hospital=3 → confidence = min(0.72 + 3*0.04, 0.92) = 0.84
    expect(result.confidence).toBeGreaterThan(0.76);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("falls through to OpenAI when absence keyword present but no category matches", async () => {
    mockCreate.mockResolvedValueOnce(makeApiResponse(buildAiResponse()));
    await categorizeExcuse("I am staying home today.");
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("falls through to OpenAI when no absence or late keywords are present", async () => {
    mockCreate.mockResolvedValueOnce(makeApiResponse(buildAiResponse()));
    await categorizeExcuse("Hello, just checking in about the homework assignment.");
    expect(mockCreate).toHaveBeenCalledOnce();
  });
});

describe("categorizeExcuse — OpenAI path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SLACK_BOT_TOKEN;
  });

  it("returns parsed result for high-confidence OpenAI response", async () => {
    mockCreate.mockResolvedValueOnce(
      makeApiResponse(buildAiResponse({ confidence: 0.9, category: "Medical", attendanceType: "Absent" }))
    );
    const result = await categorizeExcuse("Generic message that triggers OpenAI");
    expect(result.attendanceType).toBe("Absent");
    expect(result.category).toBe("Medical");
    expect(result.confidenceTier).toBe("high");
    expect(result.requiresManualReview).toBe(false);
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("triggers Slack notification for medium-confidence result", async () => {
    process.env.SLACK_BOT_TOKEN = "xoxb-test-token";
    // Provide a channel so sendSlackNotification doesn't short-circuit
    mockGetAllEnabledSlackChannelConfigs.mockResolvedValueOnce([{ channelId: "C12345" }]);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", mockFetch);

    mockCreate.mockResolvedValueOnce(
      makeApiResponse(buildAiResponse({ confidence: 0.55, category: "Other", attendanceType: "Absent" }))
    );

    const result = await categorizeExcuse("Something that yields medium confidence");
    expect(result.confidenceTier).toBe("medium");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://slack.com/api/chat.postMessage",
      expect.objectContaining({ method: "POST" })
    );

    vi.unstubAllGlobals();
    delete process.env.SLACK_BOT_TOKEN;
  });

  it("escalates to gpt-4o when gpt-4o-mini returns low confidence", async () => {
    // First call: low confidence (parsed returns null)
    mockCreate
      .mockResolvedValueOnce(makeApiResponse(buildAiResponse({ confidence: 0.2 })))
      // Second call: high confidence from gpt-4o
      .mockResolvedValueOnce(makeApiResponse(buildAiResponse({ confidence: 0.9 })));

    const result = await categorizeExcuse("Something vague");
    expect(result.confidence).toBe(0.9);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("returns hardcoded fallback when all tiers return low confidence", async () => {
    mockCreate
      .mockResolvedValueOnce(makeApiResponse(buildAiResponse({ confidence: 0.2 })))
      .mockResolvedValueOnce(makeApiResponse(buildAiResponse({ confidence: 0.1 })));

    const result = await categorizeExcuse("Very vague message");
    expect(result.requiresManualReview).toBe(true);
    expect(result.confidence).toBe(0);
    expect(result.confidenceTier).toBe("low");
    expect(result.attendanceType).toBe("Absent");
    expect(result.category).toBe("Unexcused");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("escalates to gpt-4o when gpt-4o-mini throws a rate-limit error", async () => {
    const rateLimitError = Object.assign(new Error("Rate limit"), { status: 429 });
    mockCreate
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce(makeApiResponse(buildAiResponse({ confidence: 0.9 })));

    const result = await categorizeExcuse("Another vague message");
    expect(result.confidence).toBe(0.9);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("returns fallback when all tiers throw errors", async () => {
    mockCreate
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Timeout"));

    const result = await categorizeExcuse("Message where OpenAI is down");
    expect(result.requiresManualReview).toBe(true);
    expect(result.confidence).toBe(0);
    expect(result.alertReason).toContain("manual review");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("returns fallback when OpenAI response is not valid JSON", async () => {
    mockCreate
      .mockResolvedValueOnce(makeApiResponse("not-json"))
      .mockResolvedValueOnce(makeApiResponse("also-bad"));

    const result = await categorizeExcuse("Bad JSON test");
    expect(result.requiresManualReview).toBe(true);
  });

  it("returns fallback when attendanceType is invalid", async () => {
    mockCreate
      .mockResolvedValueOnce(makeApiResponse(buildAiResponse({ attendanceType: "INVALID" })))
      .mockResolvedValueOnce(makeApiResponse(buildAiResponse({ confidence: 0.9 })));

    const result = await categorizeExcuse("Invalid type test");
    expect(result.confidence).toBe(0.9); // escalated and succeeded
  });

  it("returns fallback when category is invalid", async () => {
    mockCreate
      .mockResolvedValueOnce(makeApiResponse(buildAiResponse({ category: "Unknown" })))
      .mockResolvedValueOnce(makeApiResponse(buildAiResponse({ confidence: 0.9 })));

    const result = await categorizeExcuse("Invalid category test");
    expect(result.confidence).toBe(0.9);
  });

  // ── getDefaultAssessmentAction branches via invalid recommendedAssessmentAction ─

  it("applies zero_out when Unexcused+Unexcused and AI returns invalid action", async () => {
    mockCreate.mockResolvedValueOnce(
      makeApiResponse(
        buildAiResponse({
          attendanceType: "Unexcused",
          category: "Unexcused",
          confidence: 0.5,
          recommendedAssessmentAction: "bad_action",
          recommendedAssessmentReason: null,
        })
      )
    );
    const result = await categorizeExcuse("No real reason given");
    expect(result.recommendedAssessmentAction).toBe("zero_out");
  });

  it("applies none when Late/Tardy+Unexcused and AI returns invalid action", async () => {
    mockCreate.mockResolvedValueOnce(
      makeApiResponse(
        buildAiResponse({
          attendanceType: "Late/Tardy",
          category: "Unexcused",
          confidence: 0.5,
          recommendedAssessmentAction: "bad_action",
          recommendedAssessmentReason: null,
        })
      )
    );
    const result = await categorizeExcuse("Will be a bit late, nothing specific");
    expect(result.recommendedAssessmentAction).toBe("none");
  });

  it("applies makeup_allowed when Technical+Absent and AI returns invalid action", async () => {
    mockCreate.mockResolvedValueOnce(
      makeApiResponse(
        buildAiResponse({
          attendanceType: "Absent",
          category: "Technical",
          confidence: 0.5,
          recommendedAssessmentAction: "bad_action",
          recommendedAssessmentReason: null,
        })
      )
    );
    const result = await categorizeExcuse("My internet is completely out today");
    expect(result.recommendedAssessmentAction).toBe("makeup_allowed");
  });

  it("applies fallback excuse for Absent+Unexcused (non-Unexcused attendanceType path)", async () => {
    mockCreate.mockResolvedValueOnce(
      makeApiResponse(
        buildAiResponse({
          attendanceType: "Absent",
          category: "Unexcused",
          confidence: 0.5,
          recommendedAssessmentAction: "bad_action",
          recommendedAssessmentReason: null,
        })
      )
    );
    const result = await categorizeExcuse("Something came up, can't explain right now");
    expect(result.recommendedAssessmentAction).toBe("excuse");
  });

  // ── Peer / school mention enforcement ────────────────────────────────────

  it("forces needsResponse=true and urgency>=medium when mentionsStudent=true", async () => {
    mockCreate.mockResolvedValueOnce(
      makeApiResponse(
        buildAiResponse({
          confidence: 0.8,
          mentionsStudent: true,
          needsResponse: false,
          urgency: "low",
          alertReason: null,
        })
      )
    );
    const result = await categorizeExcuse("Reporting a peer concern");
    expect(result.needsResponse).toBe(true);
    expect(result.urgency).toBe("medium");
    expect(result.alertReason).toContain("peer mention");
  });

  it("forces needsResponse=true when mentionsSchool=true", async () => {
    mockCreate.mockResolvedValueOnce(
      makeApiResponse(
        buildAiResponse({
          confidence: 0.8,
          mentionsSchool: true,
          mentionsStudent: false,
          needsResponse: false,
          urgency: "low",
        })
      )
    );
    const result = await categorizeExcuse("Feedback about the program");
    expect(result.needsResponse).toBe(true);
    expect(result.alertReason).toContain("school/program report");
  });

  it("alertReason contains both peer and school mention when both are true", async () => {
    mockCreate.mockResolvedValueOnce(
      makeApiResponse(
        buildAiResponse({
          confidence: 0.8,
          mentionsStudent: true,
          mentionsSchool: true,
          needsResponse: false,
          urgency: "low",
          alertReason: null,
        })
      )
    );
    const result = await categorizeExcuse("Reporting a peer and the program");
    expect(result.alertReason).toContain("peer mention");
    expect(result.alertReason).toContain("school/program report");
  });

  it("preserves high urgency when mentionsStudent=true and urgency is already medium+", async () => {
    mockCreate.mockResolvedValueOnce(
      makeApiResponse(
        buildAiResponse({
          confidence: 0.8,
          mentionsStudent: true,
          urgency: "high",
        })
      )
    );
    const result = await categorizeExcuse("Urgent peer report");
    expect(result.urgency).toBe("high"); // not downgraded
  });

  // ── Slack notification edge cases ─────────────────────────────────────────

  it("skips Slack notification when no SLACK_BOT_TOKEN", async () => {
    delete process.env.SLACK_BOT_TOKEN;
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    mockCreate.mockResolvedValueOnce(
      makeApiResponse(buildAiResponse({ confidence: 0.55 }))
    );
    await categorizeExcuse("Medium confidence, no token");
    expect(mockFetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("skips Slack notification when no channels configured", async () => {
    process.env.SLACK_BOT_TOKEN = "xoxb-token";
    mockGetAllEnabledSlackChannelConfigs.mockResolvedValueOnce([]); // no channels
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    mockCreate.mockResolvedValueOnce(
      makeApiResponse(buildAiResponse({ confidence: 0.55 }))
    );
    await categorizeExcuse("Medium confidence, no channels");
    expect(mockFetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    delete process.env.SLACK_BOT_TOKEN;
  });

  it("logs error when storage throws in sendSlackNotification (line 400 catch)", async () => {
    process.env.SLACK_BOT_TOKEN = "xoxb-token";
    mockGetAllEnabledSlackChannelConfigs.mockRejectedValueOnce(new Error("DB connection lost"));

    mockCreate.mockResolvedValueOnce(
      makeApiResponse(buildAiResponse({ confidence: 0.55 }))
    );
    // Should not throw — .catch at call site handles error
    const result = await categorizeExcuse("Medium confidence with storage error");
    expect(result.confidenceTier).toBe("medium");
    vi.unstubAllGlobals();
    delete process.env.SLACK_BOT_TOKEN;
  });

  it("logs error when Slack fetch returns non-ok HTTP status (lines 262-263)", async () => {
    process.env.SLACK_BOT_TOKEN = "xoxb-token";
    mockGetAllEnabledSlackChannelConfigs.mockResolvedValueOnce([{ channelId: "C123" }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false, status: 403 }));

    mockCreate.mockResolvedValueOnce(
      makeApiResponse(buildAiResponse({ confidence: 0.55 }))
    );
    const result = await categorizeExcuse("Medium confidence slack 403");
    expect(result.confidenceTier).toBe("medium");
    vi.unstubAllGlobals();
    delete process.env.SLACK_BOT_TOKEN;
  });

  it("logs error when Slack API returns data.ok=false (line 270)", async () => {
    process.env.SLACK_BOT_TOKEN = "xoxb-token";
    mockGetAllEnabledSlackChannelConfigs.mockResolvedValueOnce([{ channelId: "C123" }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: false, error: "channel_not_found" }),
    }));

    mockCreate.mockResolvedValueOnce(
      makeApiResponse(buildAiResponse({ confidence: 0.55 }))
    );
    const result = await categorizeExcuse("Medium confidence slack error response");
    expect(result.confidenceTier).toBe("medium");
    vi.unstubAllGlobals();
    delete process.env.SLACK_BOT_TOKEN;
  });

  it("catches fetch error in sendSlackNotification (line 273)", async () => {
    process.env.SLACK_BOT_TOKEN = "xoxb-token";
    mockGetAllEnabledSlackChannelConfigs.mockResolvedValueOnce([{ channelId: "C123" }]);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("Slack fetch timeout")));

    mockCreate.mockResolvedValueOnce(
      makeApiResponse(buildAiResponse({ confidence: 0.55 }))
    );
    const result = await categorizeExcuse("Medium confidence fetch throw");
    expect(result.confidenceTier).toBe("medium");
    vi.unstubAllGlobals();
    delete process.env.SLACK_BOT_TOKEN;
  });
});

describe("generateReplyDraft", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the AI-generated reply text", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "Hi Maria, I got your message. Hope you feel better soon!" } }],
    });
    const draft = await generateReplyDraft("I am sick today and can't come in.", {
      senderName: "Maria",
      attendanceType: "Absent",
      category: "Medical",
      assessmentAction: "excuse",
    });
    expect(draft).toBe("Hi Maria, I got your message. Hope you feel better soon!");
  });

  it("returns empty string when OpenAI throws", async () => {
    mockCreate.mockRejectedValueOnce(new Error("OpenAI timeout"));
    const draft = await generateReplyDraft("message body", {
      senderName: "John",
      attendanceType: "Late/Tardy",
      category: "Technical",
      assessmentAction: "makeup_allowed",
    });
    expect(draft).toBe("");
  });

  it("returns empty string when OpenAI returns null content", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }] });
    const draft = await generateReplyDraft("message body", {
      senderName: "Alex",
      attendanceType: "Absent",
      category: "Family",
      assessmentAction: "excuse",
    });
    expect(draft).toBe("");
  });

  it("trims whitespace from the returned draft", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "  Thank you for letting us know.  \n" } }],
    });
    const draft = await generateReplyDraft("body", {
      senderName: "Sam",
      attendanceType: "Absent",
      category: "Administrative",
      assessmentAction: "excuse",
    });
    expect(draft).toBe("Thank you for letting us know.");
  });

  it("includes correct action note for zero_out in prompt", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: "Noted." } }] });
    await generateReplyDraft("no reason given", {
      senderName: "Jordan",
      attendanceType: "Unexcused",
      category: "Unexcused",
      assessmentAction: "zero_out",
    });
    // Verify the create was called with the zero_out note embedded in the prompt
    const callArg = mockCreate.mock.calls[0][0];
    const userMsg = callArg.messages.find((m: { role: string }) => m.role === "user").content;
    expect(userMsg).toContain("unexcused absences affect attendance grades");
  });

  it("handles unknown assessmentAction gracefully (empty action note)", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: "Okay." } }] });
    const draft = await generateReplyDraft("unknown action body", {
      senderName: "Riley",
      attendanceType: "Absent",
      category: "Other",
      assessmentAction: "unknown_action",
    });
    expect(draft).toBe("Okay.");
  });
});
