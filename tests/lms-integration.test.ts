/**
 * Tests for server/lms-integration.ts
 *
 * KEY: Direct method calls (excuseAssessment, zeroOutAssessment, allowMakeup, syncAttendance)
 * do NOT invoke authenticate() first — only sync() does.
 * Mocked fetch sequences reflect the actual call order per method.
 *
 * Covers:
 *  - createLmsConnector factory (all 3 types + unknown → throws)
 *  - LmsConnector.sync() dispatch (excuse, zero_out, makeup_allowed, none + auth failure)
 *  - AgilixBuzzConnector: all methods, all success/failure/throw paths
 *  - D2LBrightspaceConnector: all methods, all success/failure/throw paths
 *  - CustomLmsConnector: all four actions, failure, throw
 *  - syncToLms: no config, action=none, success, failure
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Storage mock ─────────────────────────────────────────────────────────────
const mockGetLmsConfigsByUser = vi.hoisted(() => vi.fn());
const mockCreateLmsSyncLog = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockUpdateRecordLmsSync = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("../server/storage", () => ({
  storage: {
    getLmsConfigsByUser: mockGetLmsConfigsByUser,
    createLmsSyncLog: mockCreateLmsSyncLog,
    updateRecordLmsSync: mockUpdateRecordLmsSync,
  },
}));
vi.mock("../server/db", () => ({ db: {} }));
vi.mock("@shared/schema", () => ({}));

import {
  createLmsConnector,
  syncToLms,
  AgilixBuzzConnector,
  D2LBrightspaceConnector,
  CustomLmsConnector,
} from "../server/lms-integration";

// ─── Config fixtures ──────────────────────────────────────────────────────────

function makeBuzzConfig() {
  return {
    id: 1, userId: 1, lmsType: "agilix_buzz" as const,
    apiUrl: "https://buzz.test", apiKey: "key123", apiSecret: "secret456",
    institutionId: "inst1", enabled: true, createdAt: new Date(),
  } as any;
}

function makeD2LConfig() {
  return {
    id: 2, userId: 1, lmsType: "d2l_brightspace" as const,
    apiUrl: "https://d2l.test", apiKey: "key123", apiSecret: "secret456",
    institutionId: "org-unit-1", enabled: true, createdAt: new Date(),
  } as any;
}

function makeCustomConfig() {
  return {
    id: 3, userId: 1, lmsType: "custom" as const,
    apiUrl: "https://custom-lms.test", apiKey: "customkey", apiSecret: "customsecret",
    institutionId: null, enabled: true, createdAt: new Date(),
  } as any;
}

// ─── Fetch response builders ──────────────────────────────────────────────────

const okJson = (data: unknown) => ({ ok: true, json: async () => data, text: async () => JSON.stringify(data) });
const notOk = () => ({ ok: false, json: async () => ({}), text: async () => "error" });
const authOk = () => okJson({ access_token: "tok" });

function stubFetch(...responses: unknown[]) {
  let mock = vi.fn() as ReturnType<typeof vi.fn>;
  for (const r of responses) mock = mock.mockResolvedValueOnce(r);
  vi.stubGlobal("fetch", mock);
  return mock;
}

// ─── Shared entry fixture ─────────────────────────────────────────────────────
const baseEntry = {
  studentId: "1", studentEmail: "alice@test.com", studentName: "Alice",
  assessmentName: "Day 1", assessmentType: "attendance" as const, action: "excuse" as const,
};

// ─── createLmsConnector factory ───────────────────────────────────────────────

describe("createLmsConnector", () => {
  it("creates AgilixBuzzConnector for lmsType=agilix_buzz", () =>
    expect(createLmsConnector(makeBuzzConfig())).toBeInstanceOf(AgilixBuzzConnector));

  it("creates D2LBrightspaceConnector for lmsType=d2l_brightspace", () =>
    expect(createLmsConnector(makeD2LConfig())).toBeInstanceOf(D2LBrightspaceConnector));

  it("creates CustomLmsConnector for lmsType=custom", () =>
    expect(createLmsConnector(makeCustomConfig())).toBeInstanceOf(CustomLmsConnector));

  it("throws for an unknown lmsType", () => {
    const bad = { ...makeBuzzConfig(), lmsType: "mystery_lms" as any };
    expect(() => createLmsConnector(bad)).toThrow("Unsupported LMS type");
  });
});

// ─── LmsConnector.sync() — calls authenticate() first ────────────────────────

describe("LmsConnector.sync() via AgilixBuzzConnector", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns auth-failure when authenticate() fails (fetch not ok)", async () => {
    stubFetch(notOk()); // auth call only
    const c = new AgilixBuzzConnector(makeBuzzConfig());
    const r = await c.sync({ ...baseEntry }, "excuse");
    expect(r.success).toBe(false);
    expect(r.message).toContain("Authentication failed");
  });

  it("returns auth-failure when authenticate() throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("network down")));
    const c = new AgilixBuzzConnector(makeBuzzConfig());
    const r = await c.sync({ ...baseEntry }, "excuse");
    expect(r.success).toBe(false);
  });

  it("returns immediate success for action=none (after auth succeeds)", async () => {
    stubFetch(authOk()); // only auth call; action=none never makes another request
    const c = new AgilixBuzzConnector(makeBuzzConfig());
    const r = await c.sync({ ...baseEntry, action: "none" }, "none");
    expect(r.success).toBe(true);
    expect(r.message).toBe("No action taken");
  });
});

describe("LmsConnector.sync() via D2LBrightspaceConnector", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns auth-failure when authenticate() fails", async () => {
    stubFetch(notOk());
    const c = new D2LBrightspaceConnector(makeD2LConfig());
    const r = await c.sync({ ...baseEntry }, "excuse");
    expect(r.success).toBe(false);
    expect(r.message).toBe("Authentication failed");
  });

  it("returns auth-failure when authenticate() throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("d2l down")));
    const c = new D2LBrightspaceConnector(makeD2LConfig());
    const r = await c.sync({ ...baseEntry }, "excuse");
    expect(r.success).toBe(false);
  });
});

describe("LmsConnector.sync() via CustomLmsConnector", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns auth-failure when authenticate() fails", async () => {
    stubFetch(notOk());
    const c = new CustomLmsConnector(makeCustomConfig());
    const r = await c.sync({ ...baseEntry }, "excuse");
    expect(r.success).toBe(false);
    expect(r.message).toBe("Authentication failed");
  });

  it("returns auth-failure when authenticate() throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("auth err")));
    const c = new CustomLmsConnector(makeCustomConfig());
    const r = await c.sync({ ...baseEntry }, "excuse");
    expect(r.success).toBe(false);
  });

  it("dispatches excuse action after auth succeeds", async () => {
    // auth + action
    stubFetch(
      { ok: true }, // authenticate (checks ok only, no .json())
      okJson({ external_id: "cust-1", message: "Synced" })
    );
    const c = new CustomLmsConnector(makeCustomConfig());
    const r = await c.sync({ ...baseEntry }, "excuse");
    expect(r.success).toBe(true);
  });

  it("dispatches zero_out after auth succeeds", async () => {
    stubFetch({ ok: true }, okJson({ external_id: "cust-2" }));
    const c = new CustomLmsConnector(makeCustomConfig());
    const r = await c.sync({ ...baseEntry, action: "zero_out" }, "zero_out");
    expect(r.success).toBe(true);
    expect(r.action).toBe("zero_out");
  });

  it("dispatches makeup_allowed after auth succeeds", async () => {
    stubFetch({ ok: true }, okJson({ external_id: "cust-3" }));
    const c = new CustomLmsConnector(makeCustomConfig());
    const r = await c.sync({ ...baseEntry, action: "makeup_allowed" }, "makeup_allowed");
    expect(r.success).toBe(true);
    expect(r.action).toBe("makeup_allowed");
  });
});

// ─── AgilixBuzzConnector — direct method calls (no auth step) ────────────────
//
// excuseAssessment() → [findStudentByEmail, findAttendanceItem, POST /gradebook/entries]
// zeroOutAssessment() → [findStudentByEmail, POST /gradebook/entries]
// allowMakeup()       → [findStudentByEmail, POST /gradebook/entries]

describe("AgilixBuzzConnector.excuseAssessment", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("succeeds when student, item found and API call is ok", async () => {
    stubFetch(
      okJson({ students: [{ id: "s1", name: "Alice", email: "alice@test.com" }] }),
      okJson({ items: [{ id: "i1", name: "Day 1", type: "attendance" }] }),
      okJson({ id: "ext-123" })
    );
    const c = new AgilixBuzzConnector(makeBuzzConfig());
    const r = await c.excuseAssessment({ ...baseEntry, excusedReason: "Medical" });
    expect(r.success).toBe(true);
    expect(r.externalId).toBe("ext-123");
    expect(r.lmsType).toBe("agilix_buzz");
  });

  it("returns failure when student not found", async () => {
    stubFetch(
      okJson({ students: [] }) // no students
    );
    const c = new AgilixBuzzConnector(makeBuzzConfig());
    const r = await c.excuseAssessment({ ...baseEntry });
    expect(r.success).toBe(false);
    expect(r.message).toContain("not found in Agilix Buzz");
  });

  it("returns failure when findStudentByEmail fetch is not ok", async () => {
    stubFetch(notOk());
    const c = new AgilixBuzzConnector(makeBuzzConfig());
    const r = await c.excuseAssessment({ ...baseEntry });
    expect(r.success).toBe(false);
  });

  it("returns failure when attendance item not found", async () => {
    stubFetch(
      okJson({ students: [{ id: "s1", name: "Alice", email: "alice@test.com" }] }),
      okJson({ items: [] }) // no items
    );
    const c = new AgilixBuzzConnector(makeBuzzConfig());
    const r = await c.excuseAssessment({ ...baseEntry });
    expect(r.success).toBe(false);
    expect(r.message).toContain("not found");
  });

  it("returns failure with error text when gradebook POST fails", async () => {
    stubFetch(
      okJson({ students: [{ id: "s1", name: "Alice", email: "alice@test.com" }] }),
      okJson({ items: [{ id: "i1", name: "Day 1", type: "attendance" }] }),
      notOk() // POST fails
    );
    const c = new AgilixBuzzConnector(makeBuzzConfig());
    const r = await c.excuseAssessment({ ...baseEntry });
    expect(r.success).toBe(false);
    expect(r.message).toContain("Agilix API error");
  });

  it("returns failure when gradebook POST throws (outer catch)", async () => {
    // findStudentByEmail and findAttendanceItem succeed; the gradebook POST throws
    stubFetch(
      okJson({ students: [{ id: "s1", name: "Alice", email: "alice@test.com" }] }),
      okJson({ items: [{ id: "i1", name: "Day 1", type: "attendance" }] }),
    );
    const mock = vi.fn(fetch as any);
    mock.mockRejectedValueOnce(new Error("fetch failed")); // 3rd call: gradebook POST
    // Re-stub with combined mock: first two come from stubFetch, third throws
    const combined = vi.fn()
      .mockResolvedValueOnce(okJson({ students: [{ id: "s1", name: "Alice", email: "alice@test.com" }] }))
      .mockResolvedValueOnce(okJson({ items: [{ id: "i1", name: "Day 1", type: "attendance" }] }))
      .mockRejectedValueOnce(new Error("fetch failed"));
    vi.stubGlobal("fetch", combined);
    const c = new AgilixBuzzConnector(makeBuzzConfig());
    const r = await c.excuseAssessment({ ...baseEntry });
    expect(r.success).toBe(false);
    expect(r.message).toContain("fetch failed");
  });

  it("syncAttendance delegates to excuseAssessment", async () => {
    stubFetch(
      okJson({ students: [{ id: "s1", name: "Alice", email: "alice@test.com" }] }),
      okJson({ items: [{ id: "i1", name: "Day 1", type: "attendance" }] }),
      okJson({ id: "ext-delegate" })
    );
    const c = new AgilixBuzzConnector(makeBuzzConfig());
    const r = await c.syncAttendance({ ...baseEntry });
    expect(r.success).toBe(true);
    expect(r.externalId).toBe("ext-delegate");
  });
});

describe("AgilixBuzzConnector.zeroOutAssessment", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("succeeds when student found and API call is ok", async () => {
    stubFetch(
      okJson({ students: [{ id: "s1", name: "Alice", email: "alice@test.com" }] }),
      okJson({ id: "ext-zero" })
    );
    const c = new AgilixBuzzConnector(makeBuzzConfig());
    const r = await c.zeroOutAssessment({ ...baseEntry, action: "zero_out" });
    expect(r.success).toBe(true);
    expect(r.action).toBe("zero_out");
  });

  it("returns failure when student not found", async () => {
    stubFetch(okJson({ students: [] }));
    const c = new AgilixBuzzConnector(makeBuzzConfig());
    const r = await c.zeroOutAssessment({ ...baseEntry, action: "zero_out" });
    expect(r.success).toBe(false);
    expect(r.message).toContain("not found");
  });

  it("returns failure when findStudentByEmail fetch is not ok", async () => {
    stubFetch(notOk());
    const c = new AgilixBuzzConnector(makeBuzzConfig());
    const r = await c.zeroOutAssessment({ ...baseEntry, action: "zero_out" });
    expect(r.success).toBe(false);
  });

  it("returns failure when gradebook POST fails", async () => {
    stubFetch(
      okJson({ students: [{ id: "s1", name: "Alice", email: "alice@test.com" }] }),
      notOk()
    );
    const c = new AgilixBuzzConnector(makeBuzzConfig());
    const r = await c.zeroOutAssessment({ ...baseEntry, action: "zero_out" });
    expect(r.success).toBe(false);
    expect(r.message).toContain("Failed to zero out");
  });

  it("returns failure when gradebook POST throws (outer catch)", async () => {
    // findStudentByEmail succeeds; the gradebook POST throws
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(okJson({ students: [{ id: "s1", name: "Alice", email: "alice@test.com" }] }))
      .mockRejectedValueOnce(new Error("zero out failed"))
    );
    const c = new AgilixBuzzConnector(makeBuzzConfig());
    const r = await c.zeroOutAssessment({ ...baseEntry, action: "zero_out" });
    expect(r.success).toBe(false);
    expect(r.message).toContain("zero out failed");
  });
});

describe("AgilixBuzzConnector.allowMakeup", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("succeeds when student found and API call is ok", async () => {
    stubFetch(
      okJson({ students: [{ id: "s1", name: "Alice", email: "alice@test.com" }] }),
      okJson({ id: "ext-makeup" })
    );
    const c = new AgilixBuzzConnector(makeBuzzConfig());
    const r = await c.allowMakeup({ ...baseEntry, action: "makeup_allowed", dueDate: "2026-03-30" });
    expect(r.success).toBe(true);
    expect(r.action).toBe("makeup_allowed");
  });

  it("returns failure when student not found", async () => {
    stubFetch(okJson({ students: [] }));
    const c = new AgilixBuzzConnector(makeBuzzConfig());
    const r = await c.allowMakeup({ ...baseEntry, action: "makeup_allowed" });
    expect(r.success).toBe(false);
    expect(r.message).toContain("not found");
  });

  it("returns failure when findStudentByEmail fetch is not ok", async () => {
    stubFetch(notOk());
    const c = new AgilixBuzzConnector(makeBuzzConfig());
    const r = await c.allowMakeup({ ...baseEntry, action: "makeup_allowed" });
    expect(r.success).toBe(false);
  });

  it("returns failure when gradebook POST fails", async () => {
    stubFetch(
      okJson({ students: [{ id: "s1", name: "Alice", email: "alice@test.com" }] }),
      notOk()
    );
    const c = new AgilixBuzzConnector(makeBuzzConfig());
    const r = await c.allowMakeup({ ...baseEntry, action: "makeup_allowed" });
    expect(r.success).toBe(false);
    expect(r.message).toContain("Failed to set makeup");
  });

  it("returns failure when gradebook POST throws (outer catch)", async () => {
    // findStudentByEmail succeeds; the gradebook POST throws
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(okJson({ students: [{ id: "s1", name: "Alice", email: "alice@test.com" }] }))
      .mockRejectedValueOnce(new Error("makeup error"))
    );
    const c = new AgilixBuzzConnector(makeBuzzConfig());
    const r = await c.allowMakeup({ ...baseEntry, action: "makeup_allowed" });
    expect(r.success).toBe(false);
    expect(r.message).toContain("makeup error");
  });
});

// ─── D2LBrightspaceConnector — direct method calls (no auth step) ─────────────
//
// excuseAssessment()  → [findStudentByEmail, findGradeObject, PUT grade value]
// zeroOutAssessment() → [findStudentByEmail, findGradeObject, PUT grade value]
// allowMakeup()       → no fetch calls (immediate success)
// syncAttendance()    → delegates to excuseAssessment → same 3 fetches

describe("D2LBrightspaceConnector.excuseAssessment", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("succeeds when student, grade object found and PUT is ok", async () => {
    stubFetch(
      okJson({ items: [{ identifier: "u1" }] }),        // findStudentByEmail
      okJson({ items: [{ identifier: "g1", name: "Day 1" }] }), // findGradeObject
      { ok: true }                                        // PUT
    );
    const c = new D2LBrightspaceConnector(makeD2LConfig());
    const r = await c.excuseAssessment({ ...baseEntry });
    expect(r.success).toBe(true);
    expect(r.lmsType).toBe("d2l_brightspace");
  });

  it("returns failure when student not found (empty items)", async () => {
    stubFetch(okJson({ items: [] }));
    const c = new D2LBrightspaceConnector(makeD2LConfig());
    const r = await c.excuseAssessment({ ...baseEntry });
    expect(r.success).toBe(false);
    expect(r.message).toContain("not found in D2L");
  });

  it("returns failure when findStudentByEmail fetch is not ok", async () => {
    stubFetch(notOk());
    const c = new D2LBrightspaceConnector(makeD2LConfig());
    const r = await c.excuseAssessment({ ...baseEntry });
    expect(r.success).toBe(false);
  });

  it("returns failure when grade object not found (empty items)", async () => {
    stubFetch(
      okJson({ items: [{ identifier: "u1" }] }),
      okJson({ items: [] })
    );
    const c = new D2LBrightspaceConnector(makeD2LConfig());
    const r = await c.excuseAssessment({ ...baseEntry });
    expect(r.success).toBe(false);
    expect(r.message).toContain("not found");
  });

  it("returns failure when findGradeObject fetch is not ok", async () => {
    stubFetch(
      okJson({ items: [{ identifier: "u1" }] }),
      notOk()
    );
    const c = new D2LBrightspaceConnector(makeD2LConfig());
    const r = await c.excuseAssessment({ ...baseEntry });
    expect(r.success).toBe(false);
  });

  it("returns failure when PUT fails", async () => {
    stubFetch(
      okJson({ items: [{ identifier: "u1" }] }),
      okJson({ items: [{ identifier: "g1", name: "Day 1" }] }),
      { ok: false }
    );
    const c = new D2LBrightspaceConnector(makeD2LConfig());
    const r = await c.excuseAssessment({ ...baseEntry });
    expect(r.success).toBe(false);
    expect(r.message).toBe("D2L API error");
  });

  it("returns failure when PUT throws (outer catch)", async () => {
    // student + grade object found; PUT throws
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(okJson({ items: [{ identifier: "u1" }] }))
      .mockResolvedValueOnce(okJson({ items: [{ identifier: "g1", name: "Day 1" }] }))
      .mockRejectedValueOnce(new Error("D2L network error"))
    );
    const c = new D2LBrightspaceConnector(makeD2LConfig());
    const r = await c.excuseAssessment({ ...baseEntry });
    expect(r.success).toBe(false);
    expect(r.message).toContain("D2L network error");
  });

  it("syncAttendance delegates to excuseAssessment", async () => {
    stubFetch(
      okJson({ items: [{ identifier: "u1" }] }),
      okJson({ items: [{ identifier: "g1", name: "Day 1" }] }),
      { ok: true }
    );
    const c = new D2LBrightspaceConnector(makeD2LConfig());
    const r = await c.syncAttendance({ ...baseEntry });
    expect(r.success).toBe(true);
  });
});

describe("D2LBrightspaceConnector.zeroOutAssessment", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("succeeds when student, grade object found and PUT is ok", async () => {
    stubFetch(
      okJson({ items: [{ identifier: "u1" }] }),
      okJson({ items: [{ identifier: "g1", name: "Day 1" }] }),
      { ok: true }
    );
    const c = new D2LBrightspaceConnector(makeD2LConfig());
    const r = await c.zeroOutAssessment({ ...baseEntry, action: "zero_out" });
    expect(r.success).toBe(true);
    expect(r.action).toBe("zero_out");
  });

  it("returns failure when student not found", async () => {
    stubFetch(okJson({ items: [] }));
    const c = new D2LBrightspaceConnector(makeD2LConfig());
    const r = await c.zeroOutAssessment({ ...baseEntry, action: "zero_out" });
    expect(r.success).toBe(false);
    expect(r.message).toContain("Student not found");
  });

  it("returns failure when findStudentByEmail fetch is not ok", async () => {
    stubFetch(notOk());
    const c = new D2LBrightspaceConnector(makeD2LConfig());
    const r = await c.zeroOutAssessment({ ...baseEntry, action: "zero_out" });
    expect(r.success).toBe(false);
  });

  it("returns failure when grade object not found", async () => {
    stubFetch(
      okJson({ items: [{ identifier: "u1" }] }),
      okJson({ items: [] })
    );
    const c = new D2LBrightspaceConnector(makeD2LConfig());
    const r = await c.zeroOutAssessment({ ...baseEntry, action: "zero_out" });
    expect(r.success).toBe(false);
    expect(r.message).toBe("Grade object not found");
  });

  it("returns failure when findGradeObject fetch is not ok", async () => {
    stubFetch(
      okJson({ items: [{ identifier: "u1" }] }),
      notOk()
    );
    const c = new D2LBrightspaceConnector(makeD2LConfig());
    const r = await c.zeroOutAssessment({ ...baseEntry, action: "zero_out" });
    expect(r.success).toBe(false);
  });

  it("returns failure when PUT fails", async () => {
    stubFetch(
      okJson({ items: [{ identifier: "u1" }] }),
      okJson({ items: [{ identifier: "g1", name: "Day 1" }] }),
      { ok: false }
    );
    const c = new D2LBrightspaceConnector(makeD2LConfig());
    const r = await c.zeroOutAssessment({ ...baseEntry, action: "zero_out" });
    expect(r.success).toBe(false);
    expect(r.message).toContain("Failed to zero out");
  });

  it("returns failure when PUT throws (outer catch)", async () => {
    // student + grade object found; PUT throws
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(okJson({ items: [{ identifier: "u1" }] }))
      .mockResolvedValueOnce(okJson({ items: [{ identifier: "g1", name: "Day 1" }] }))
      .mockRejectedValueOnce(new Error("zero D2L error"))
    );
    const c = new D2LBrightspaceConnector(makeD2LConfig());
    const r = await c.zeroOutAssessment({ ...baseEntry, action: "zero_out" });
    expect(r.success).toBe(false);
    expect(r.message).toContain("zero D2L error");
  });
});

describe("D2LBrightspaceConnector.allowMakeup", () => {
  it("always returns success (D2L tracks makeup in notes, no API call needed)", async () => {
    // No fetch needed — allowMakeup returns immediately
    const c = new D2LBrightspaceConnector(makeD2LConfig());
    const r = await c.allowMakeup({ ...baseEntry, action: "makeup_allowed" });
    expect(r.success).toBe(true);
    expect(r.message).toContain("notes");
    expect(r.action).toBe("makeup_allowed");
  });
});

// ─── CustomLmsConnector — direct method calls (no auth step) ─────────────────
//
// All 4 actions call syncWithCustomApi() → 1 fetch: POST /gradebook/sync

describe("CustomLmsConnector — direct method calls", () => {
  afterEach(() => vi.unstubAllGlobals());

  const customEntry = { ...baseEntry };
  const customOk = () => okJson({ external_id: "cust-1", message: "Synced OK" });

  it("syncAttendance: success", async () => {
    stubFetch(customOk());
    const c = new CustomLmsConnector(makeCustomConfig());
    const r = await c.syncAttendance(customEntry);
    expect(r.success).toBe(true);
    expect(r.lmsType).toBe("custom");
    expect(r.externalId).toBe("cust-1");
  });

  it("excuseAssessment: success", async () => {
    stubFetch(customOk());
    const c = new CustomLmsConnector(makeCustomConfig());
    const r = await c.excuseAssessment(customEntry);
    expect(r.success).toBe(true);
    expect(r.action).toBe("excuse");
  });

  it("zeroOutAssessment: success", async () => {
    stubFetch(customOk());
    const c = new CustomLmsConnector(makeCustomConfig());
    const r = await c.zeroOutAssessment({ ...customEntry, action: "zero_out" });
    expect(r.success).toBe(true);
    expect(r.action).toBe("zero_out");
  });

  it("allowMakeup: success", async () => {
    stubFetch(customOk());
    const c = new CustomLmsConnector(makeCustomConfig());
    const r = await c.allowMakeup({ ...customEntry, action: "makeup_allowed" });
    expect(r.success).toBe(true);
    expect(r.action).toBe("makeup_allowed");
  });

  it("returns failure when gradebook POST is not ok", async () => {
    stubFetch(notOk()); // single fetch, not ok
    const c = new CustomLmsConnector(makeCustomConfig());
    const r = await c.excuseAssessment(customEntry);
    expect(r.success).toBe(false);
    expect(r.message).toContain("Custom LMS API error");
  });

  it("returns failure when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("custom LMS timeout")));
    const c = new CustomLmsConnector(makeCustomConfig());
    const r = await c.excuseAssessment(customEntry);
    expect(r.success).toBe(false);
    expect(r.message).toContain("custom LMS timeout");
  });

  it("uses message from response when external_id is absent", async () => {
    stubFetch(okJson({ message: "Processed without id" })); // no external_id
    const c = new CustomLmsConnector(makeCustomConfig());
    const r = await c.excuseAssessment(customEntry);
    expect(r.success).toBe(true);
    expect(r.message).toBe("Processed without id");
    expect(r.externalId).toBeUndefined();
  });
});

// ─── syncToLms ────────────────────────────────────────────────────────────────

describe("syncToLms", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("returns failure when no configs found", async () => {
    mockGetLmsConfigsByUser.mockResolvedValueOnce([]);
    const r = await syncToLms(1, 1, "s@t.com", "S", "Day 1", "excuse");
    expect(r.success).toBe(false);
    expect(r.message).toContain("No LMS configuration found");
  });

  it("returns failure when all configs are disabled", async () => {
    mockGetLmsConfigsByUser.mockResolvedValueOnce([{ ...makeCustomConfig(), enabled: false }]);
    const r = await syncToLms(1, 1, "s@t.com", "S", "Day 1", "excuse");
    expect(r.success).toBe(false);
    expect(r.message).toContain("No LMS configuration found");
  });

  it("returns success and logs sync for action=none (after auth)", async () => {
    mockGetLmsConfigsByUser.mockResolvedValueOnce([makeCustomConfig()]);
    stubFetch({ ok: true }); // authenticate only; none short-circuits
    const r = await syncToLms(1, 42, "s@custom.com", "S", "Day 1", "none");
    expect(r.success).toBe(true);
    expect(r.message).toBe("No action taken");
    expect(mockCreateLmsSyncLog).toHaveBeenCalledWith(
      expect.objectContaining({ recordId: 42, syncType: "none" })
    );
  });

  it("calls updateRecordLmsSync on successful action and logs success", async () => {
    mockGetLmsConfigsByUser.mockResolvedValueOnce([makeCustomConfig()]);
    stubFetch(
      { ok: true },                                          // authenticate
      okJson({ external_id: "ext-99", message: "Done" })    // gradebook/sync
    );
    const r = await syncToLms(1, 99, "s@custom.com", "S", "Day 1", "excuse", "Medical");
    expect(r.success).toBe(true);
    expect(mockUpdateRecordLmsSync).toHaveBeenCalledWith(99, true, "ext-99", "excuse");
    expect(mockCreateLmsSyncLog).toHaveBeenCalledWith(
      expect.objectContaining({ recordId: 99, syncStatus: "success" })
    );
  });

  it("logs failed sync and does not call updateRecordLmsSync", async () => {
    mockGetLmsConfigsByUser.mockResolvedValueOnce([makeCustomConfig()]);
    stubFetch({ ok: false }); // authenticate fails
    const r = await syncToLms(1, 10, "s@custom.com", "S", "Day 1", "zero_out");
    expect(r.success).toBe(false);
    expect(mockCreateLmsSyncLog).toHaveBeenCalledWith(
      expect.objectContaining({ syncStatus: "failed" })
    );
    expect(mockUpdateRecordLmsSync).not.toHaveBeenCalled();
  });
});
