/**
 * Tests for server/google-auth.ts
 * Covers: isBulkOrAutoMail — all branches (List-Id, Precedence, Auto-Submitted, X-Auto-Response-Suppress)
 */

import { describe, it, expect, vi } from "vitest";

// ── Hoist mocks so they are set up before any module is imported ─────────────
vi.mock("../server/storage", () => ({
  storage: {
    getUserById: vi.fn(),
    getUserByGoogleId: vi.fn(),
    getUserByEmail: vi.fn(),
    updateUserGoogleTokens: vi.fn(),
    createUser: vi.fn(),
    getAlertsByUser: vi.fn(),
    getAllAlerts: vi.fn(),
    getRecordById: vi.fn(),
  },
}));

vi.mock("../server/db", () => ({ db: {} }));
vi.mock("bcrypt", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed"), compare: vi.fn().mockResolvedValue(true) },
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));
vi.mock("@shared/schema", () => ({ users: {} }));

import { isBulkOrAutoMail } from "../server/google-auth";

// ─────────────────────────────────────────────────────────────────────────────

describe("isBulkOrAutoMail", () => {
  // ── Normal / personal email ─────────────────────────────────────────────

  it("returns isBulk=false for a plain personal email with no bulk headers", () => {
    const headers = [
      { name: "From", value: "student@example.com" },
      { name: "Subject", value: "I will be absent today" },
      { name: "Date", value: "Mon, 22 Mar 2026 09:00:00 -0400" },
    ];
    const result = isBulkOrAutoMail(headers);
    expect(result.isBulk).toBe(false);
    expect(result.reason).toBe("");
  });

  it("returns isBulk=false for an empty headers array", () => {
    const result = isBulkOrAutoMail([]);
    expect(result.isBulk).toBe(false);
    expect(result.reason).toBe("");
  });

  // ── List-Id ─────────────────────────────────────────────────────────────

  it("detects List-Id header (mailing list)", () => {
    const result = isBulkOrAutoMail([{ name: "List-Id", value: "<newsletter.school.edu>" }]);
    expect(result.isBulk).toBe(true);
    expect(result.reason).toContain("List-Id");
  });

  it("detects List-Id header regardless of header name case", () => {
    const result = isBulkOrAutoMail([{ name: "list-id", value: "<list.example.com>" }]);
    expect(result.isBulk).toBe(true);
  });

  it("detects List-Id header with mixed case name", () => {
    const result = isBulkOrAutoMail([{ name: "List-ID", value: "<updates.school.edu>" }]);
    expect(result.isBulk).toBe(true);
  });

  // ── Precedence ───────────────────────────────────────────────────────────

  it("detects Precedence: bulk", () => {
    const result = isBulkOrAutoMail([{ name: "Precedence", value: "bulk" }]);
    expect(result.isBulk).toBe(true);
    expect(result.reason).toContain("bulk");
  });

  it("detects Precedence: list", () => {
    const result = isBulkOrAutoMail([{ name: "Precedence", value: "list" }]);
    expect(result.isBulk).toBe(true);
    expect(result.reason).toContain("list");
  });

  it("detects Precedence: junk", () => {
    const result = isBulkOrAutoMail([{ name: "Precedence", value: "junk" }]);
    expect(result.isBulk).toBe(true);
    expect(result.reason).toContain("junk");
  });

  it("is case-insensitive for Precedence value", () => {
    const result = isBulkOrAutoMail([{ name: "Precedence", value: "BULK" }]);
    expect(result.isBulk).toBe(true);
  });

  it("does not treat Precedence: normal as bulk", () => {
    const result = isBulkOrAutoMail([{ name: "Precedence", value: "normal" }]);
    expect(result.isBulk).toBe(false);
  });

  // ── Auto-Submitted ───────────────────────────────────────────────────────

  it("detects Auto-Submitted: auto-replied", () => {
    const result = isBulkOrAutoMail([{ name: "Auto-Submitted", value: "auto-replied" }]);
    expect(result.isBulk).toBe(true);
    expect(result.reason).toContain("auto-replied");
  });

  it("detects Auto-Submitted: auto-generated", () => {
    const result = isBulkOrAutoMail([{ name: "Auto-Submitted", value: "auto-generated" }]);
    expect(result.isBulk).toBe(true);
    expect(result.reason).toContain("auto-generated");
  });

  it("detects Auto-Submitted: auto-notified", () => {
    const result = isBulkOrAutoMail([{ name: "Auto-Submitted", value: "auto-notified" }]);
    expect(result.isBulk).toBe(true);
    expect(result.reason).toContain("auto-notified");
  });

  it("is case-insensitive for Auto-Submitted value", () => {
    const result = isBulkOrAutoMail([{ name: "auto-submitted", value: "Auto-Replied" }]);
    expect(result.isBulk).toBe(true);
  });

  // ── X-Auto-Response-Suppress ─────────────────────────────────────────────

  it("detects X-Auto-Response-Suppress: All", () => {
    const result = isBulkOrAutoMail([{ name: "X-Auto-Response-Suppress", value: "All" }]);
    expect(result.isBulk).toBe(true);
    expect(result.reason).toContain("X-Auto-Response-Suppress");
  });

  it("detects X-Auto-Response-Suppress: DR, RN", () => {
    const result = isBulkOrAutoMail([{ name: "X-Auto-Response-Suppress", value: "DR, RN" }]);
    expect(result.isBulk).toBe(true);
  });

  it("does NOT flag X-Auto-Response-Suppress: none as bulk", () => {
    const result = isBulkOrAutoMail([{ name: "X-Auto-Response-Suppress", value: "none" }]);
    expect(result.isBulk).toBe(false);
  });

  it("is case-insensitive for X-Auto-Response-Suppress 'none'", () => {
    const result = isBulkOrAutoMail([{ name: "X-Auto-Response-Suppress", value: "None" }]);
    expect(result.isBulk).toBe(false);
  });

  // ── Multiple headers — first match wins ──────────────────────────────────

  it("returns on List-Id even when other non-bulk headers are present", () => {
    const result = isBulkOrAutoMail([
      { name: "From", value: "newsletter@school.edu" },
      { name: "List-Id", value: "<newsletter.school.edu>" },
      { name: "Subject", value: "Monthly Update" },
    ]);
    expect(result.isBulk).toBe(true);
    expect(result.reason).toContain("List-Id");
  });
});
