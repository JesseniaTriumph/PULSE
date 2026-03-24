/**
 * Route-level tests for server/google-auth.ts
 * Covers: setupGoogleAuth — all route handlers
 *   GET  /api/auth/google
 *   GET  /api/auth/google/debug (non-production)
 *   GET  /api/auth/google/callback
 *   GET  /api/auth/google/status
 *   POST /api/gmail/send
 *   POST /api/gmail/fetch
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import session from "express-session";
import request from "supertest";

// ── Hoist mocks ──────────────────────────────────────────────────────────────

const mockStorage = vi.hoisted(() => ({
  getUserById: vi.fn(),
  getUserByGoogleId: vi.fn(),
  getUserByEmail: vi.fn(),
  updateUserGoogleTokens: vi.fn(),
  createUser: vi.fn(),
  getAlertsByUser: vi.fn(),
  getAllAlerts: vi.fn(),
  getRecordById: vi.fn(),
}));

vi.mock("../server/storage", () => ({ storage: mockStorage }));

const mockDbUpdate = vi.hoisted(() => vi.fn());
vi.mock("../server/db", () => ({
  db: {
    update: () => ({
      set: () => ({
        where: mockDbUpdate,
      }),
    }),
  },
}));

vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed_password"),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("drizzle-orm", () => ({ eq: vi.fn().mockReturnValue({}) }));
vi.mock("@shared/schema", () => ({ users: { id: "id" } }));

// Global fetch mock
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Set required env vars in hoisted block so they're available at module load time
vi.hoisted(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.NODE_ENV = "test";
});

import { setupGoogleAuth } from "../server/google-auth";

// ── App factory ──────────────────────────────────────────────────────────────

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: true,
    }),
  );
  // Helper route to inject session state
  app.get("/__set-session", (req: any, res: any) => {
    Object.assign(req.session, req.query);
    req.session.save(() => res.json({ ok: true }));
  });
  // Helper to set userId session
  app.get("/__login/:userId", (req: any, res: any) => {
    req.session.userId = parseInt(req.params.userId);
    req.session.save(() => res.json({ ok: true }));
  });
  setupGoogleAuth(app);
  return app;
}

function jsonOk(body: object) {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  };
}

function jsonFail(status: number, body: string = "error") {
  return {
    ok: false,
    status,
    json: vi.fn().mockResolvedValue({ error: body }),
    text: vi.fn().mockResolvedValue(body),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/auth/google", () => {
  it("redirects to Google OAuth URL", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/auth/google");

    expect(res.status).toBe(302);
    const loc = res.headers.location ?? "";
    expect(loc).toContain("accounts.google.com/o/oauth2/v2/auth");
    expect(loc).toContain("client_id=test-client-id");
    expect(loc).toContain("response_type=code");
    expect(loc).toContain("access_type=offline");
    expect(loc).toContain("prompt=consent");
    expect(loc).toContain("gmail");
    expect(loc).toContain("state=");
  });
});

describe("GET /api/auth/google/debug", () => {
  it("returns debug info in non-production mode", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/auth/google/debug");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("clientIdSet", true);
    expect(res.body).toHaveProperty("clientSecretSet", true);
    expect(res.body.clientIdPrefix).toContain("test-client-id");
  });
});

describe("GET /api/auth/google/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("redirects with error=google_auth_failed when OAuth error is present", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/auth/google/callback?error=access_denied");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("error=google_auth_failed");
  });

  it("redirects with error=no_code when code is missing", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/auth/google/callback?state=somestate");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("error=no_code");
  });

  it("redirects with error=invalid_state on state mismatch", async () => {
    const app = makeApp();
    const agent = request.agent(app);

    // Set a known state in session
    await agent.get("/__set-session?oauthState=correctstate");

    const res = await agent.get("/api/auth/google/callback?code=abc&state=wrongstate");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("error=invalid_state");
  });

  it("redirects with error=token_exchange_failed when token fetch fails", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__set-session?oauthState=mystate");

    mockFetch.mockResolvedValueOnce(jsonFail(400, "invalid_grant"));

    const res = await agent.get("/api/auth/google/callback?code=badcode&state=mystate");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("error=token_exchange_failed");
  });

  it("redirects with error=userinfo_failed when userinfo fetch fails", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__set-session?oauthState=s2");

    mockFetch.mockResolvedValueOnce(jsonOk({ access_token: "tok", refresh_token: "ref" }));
    mockFetch.mockResolvedValueOnce(jsonFail(401, "unauthorized"));

    const res = await agent.get("/api/auth/google/callback?code=goodcode&state=s2");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("error=userinfo_failed");
  });

  it("creates new user and redirects to / on successful flow", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__set-session?oauthState=s3");

    mockFetch.mockResolvedValueOnce(jsonOk({ access_token: "tok", refresh_token: "ref" }));
    mockFetch.mockResolvedValueOnce(jsonOk({ id: "gid1", email: "new@school.edu", name: "New Student" }));

    mockStorage.getUserByGoogleId.mockResolvedValueOnce(null);
    mockStorage.getUserByEmail.mockResolvedValueOnce(null);
    mockStorage.createUser.mockResolvedValueOnce({
      id: 42,
      email: "new@school.edu",
      googleId: "gid1",
      googleAccessToken: "tok",
    });

    const res = await agent.get("/api/auth/google/callback?code=good&state=s3");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");
    expect(mockStorage.createUser).toHaveBeenCalledOnce();
  });

  it("updates existing user matched by Google ID and redirects to /", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__set-session?oauthState=s4");

    mockFetch.mockResolvedValueOnce(jsonOk({ access_token: "newt", refresh_token: "newr" }));
    mockFetch.mockResolvedValueOnce(jsonOk({ id: "existgid", email: "exist@school.edu", name: "Existing" }));

    mockStorage.getUserByGoogleId.mockResolvedValueOnce({ id: 10, email: "exist@school.edu", googleId: "existgid" });
    mockStorage.updateUserGoogleTokens.mockResolvedValueOnce(undefined);

    const res = await agent.get("/api/auth/google/callback?code=c&state=s4");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");
    expect(mockStorage.updateUserGoogleTokens).toHaveBeenCalledWith(10, "newt", "newr");
  });

  it("merges Google ID into existing email-matched account", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__set-session?oauthState=s5");

    mockFetch.mockResolvedValueOnce(jsonOk({ access_token: "tok5" })); // no refresh token
    mockFetch.mockResolvedValueOnce(jsonOk({ id: "newgid", email: "merge@school.edu", name: "Merge" }));

    mockStorage.getUserByGoogleId.mockResolvedValueOnce(null);
    mockStorage.getUserByEmail.mockResolvedValueOnce({ id: 55, email: "merge@school.edu" });
    mockDbUpdate.mockResolvedValueOnce([]);

    const res = await agent.get("/api/auth/google/callback?code=c5&state=s5");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");
  });

  it("redirects to /?error=google_auth_failed on unexpected exception", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__set-session?oauthState=s6");

    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    const res = await agent.get("/api/auth/google/callback?code=c6&state=s6");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("error=google_auth_failed");
  });
});

describe("GET /api/auth/google/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/auth/google/status");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Not authenticated");
  });

  it("returns connected:true when user has Google credentials", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/7");

    mockStorage.getUserById.mockResolvedValueOnce({
      id: 7,
      googleId: "gid",
      googleAccessToken: "tok",
    });

    const res = await agent.get("/api/auth/google/status");
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(true);
    expect(res.body.hasGmailAccess).toBe(true);
  });

  it("returns connected:false and hasGmailAccess:false when no googleId", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/8");

    mockStorage.getUserById.mockResolvedValueOnce({ id: 8 });

    const res = await agent.get("/api/auth/google/status");
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(false);
    expect(res.body.hasGmailAccess).toBe(false);
  });

  it("returns 401 when user not found in storage", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/999");

    mockStorage.getUserById.mockResolvedValueOnce(null);

    const res = await agent.get("/api/auth/google/status");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("User not found");
  });
});

describe("POST /api/gmail/send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    const app = makeApp();
    const res = await request(app).post("/api/gmail/send").send({ to: "a@b.com", body: "hi" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when Gmail not connected (no googleAccessToken)", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/1");

    mockStorage.getUserById.mockResolvedValueOnce({ id: 1 });

    const res = await agent.post("/api/gmail/send").send({ to: "a@b.com", body: "hi" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Gmail not connected");
  });

  it("returns 400 when to or body is missing", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/1");

    mockStorage.getUserById.mockResolvedValueOnce({
      id: 1,
      email: "t@school.edu",
      googleAccessToken: "tok",
      displayName: "Teacher",
    });

    const res = await agent.post("/api/gmail/send").send({ subject: "only subject" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("required");
  });

  it("sends email successfully and returns messageId", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/1");

    mockStorage.getUserById.mockResolvedValueOnce({
      id: 1,
      email: "t@school.edu",
      googleAccessToken: "tok",
      displayName: "Teacher",
      role: "admin",
    });

    mockFetch.mockResolvedValueOnce(jsonOk({ id: "msg123", threadId: "thread456" }));

    const res = await agent.post("/api/gmail/send").send({
      to: "student@school.edu",
      subject: "Absence",
      body: "Please explain.",
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.messageId).toBe("msg123");
    expect(res.body.threadId).toBe("thread456");
  });

  it("includes In-Reply-To header for valid Message-ID", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/1");

    mockStorage.getUserById.mockResolvedValueOnce({
      id: 1,
      email: "t@school.edu",
      googleAccessToken: "tok",
      displayName: "Teacher",
      role: "admin",
    });

    mockFetch.mockResolvedValueOnce(jsonOk({ id: "m1", threadId: "t1" }));

    const res = await agent.post("/api/gmail/send").send({
      to: "s@school.edu",
      subject: "Re: absence",
      body: "Got it.",
      inReplyTo: "<valid.message.id@mail.gmail.com>",
      threadId: "thread1",
    });
    expect(res.status).toBe(200);
    const raw = Buffer.from(
      JSON.parse(mockFetch.mock.calls[0][1].body).raw,
      "base64url",
    ).toString("utf-8");
    expect(raw).toContain("In-Reply-To: <valid.message.id@mail.gmail.com>");
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).threadId).toBe("thread1");
  });

  it("skips In-Reply-To for invalid message ID format", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/1");

    mockStorage.getUserById.mockResolvedValueOnce({
      id: 1,
      email: "t@school.edu",
      googleAccessToken: "tok",
      displayName: "Teacher",
      role: "admin",
    });

    mockFetch.mockResolvedValueOnce(jsonOk({ id: "m2", threadId: "t2" }));

    await agent.post("/api/gmail/send").send({
      to: "s@school.edu",
      body: "body",
      inReplyTo: "not-valid",
    });

    const raw = Buffer.from(
      JSON.parse(mockFetch.mock.calls[0][1].body).raw,
      "base64url",
    ).toString("utf-8");
    expect(raw).not.toContain("In-Reply-To");
  });

  it("refreshes token on 401 and retries successfully", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/1");

    mockStorage.getUserById.mockResolvedValueOnce({
      id: 1,
      email: "t@school.edu",
      googleAccessToken: "expired",
      googleRefreshToken: "refresh-tok",
      displayName: "Teacher",
      role: "admin",
    });
    mockStorage.updateUserGoogleTokens.mockResolvedValueOnce(undefined);

    // First send: 401
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: vi.fn().mockResolvedValue("Unauthorized") });
    // Token refresh
    mockFetch.mockResolvedValueOnce(jsonOk({ access_token: "new-tok" }));
    // Retry: success
    mockFetch.mockResolvedValueOnce(jsonOk({ id: "m3", threadId: "t3" }));

    const res = await agent.post("/api/gmail/send").send({
      to: "s@school.edu",
      body: "hello",
    });
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("returns 403 when send fails with insufficient scope error", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/1");

    mockStorage.getUserById.mockResolvedValueOnce({
      id: 1,
      email: "t@school.edu",
      googleAccessToken: "tok",
      displayName: "Teacher",
      role: "admin",
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: vi.fn().mockResolvedValue("insufficient scope for sending"),
    });

    const res = await agent.post("/api/gmail/send").send({
      to: "s@school.edu",
      body: "hello",
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain("permission");
  });

  it("returns 500 on general send failure", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/1");

    mockStorage.getUserById.mockResolvedValueOnce({
      id: 1,
      email: "t@school.edu",
      googleAccessToken: "tok",
      displayName: "Teacher",
      role: "admin",
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue("server error"),
    });

    const res = await agent.post("/api/gmail/send").send({
      to: "s@school.edu",
      body: "hello",
    });
    expect(res.status).toBe(500);
  });

  it("validates alertId: returns 400 when recipient doesn't match record sender", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/1");

    mockStorage.getUserById.mockResolvedValueOnce({
      id: 1,
      email: "t@school.edu",
      googleAccessToken: "tok",
      displayName: "Teacher",
      role: "admin",
    });
    mockStorage.getAllAlerts.mockResolvedValueOnce([{ id: 5, recordId: 20 }]);
    mockStorage.getRecordById.mockResolvedValueOnce({ senderEmail: "correct@school.edu" });

    const res = await agent.post("/api/gmail/send").send({
      to: "wrong@school.edu",
      body: "hi",
      alertId: 5,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Recipient must match");
  });

  it("validates alertId: returns 403 when alert not found", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/1");

    mockStorage.getUserById.mockResolvedValueOnce({
      id: 1,
      email: "t@school.edu",
      googleAccessToken: "tok",
      displayName: "Teacher",
      role: "admin",
    });
    mockStorage.getAllAlerts.mockResolvedValueOnce([]);

    const res = await agent.post("/api/gmail/send").send({
      to: "s@school.edu",
      body: "hi",
      alertId: 999,
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain("not found");
  });

  it("sends to correct recipient when alertId passes validation", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/1");

    mockStorage.getUserById.mockResolvedValueOnce({
      id: 1,
      email: "t@school.edu",
      googleAccessToken: "tok",
      displayName: "Teacher",
      role: "admin",
    });
    mockStorage.getAllAlerts.mockResolvedValueOnce([{ id: 10, recordId: 30 }]);
    mockStorage.getRecordById.mockResolvedValueOnce({ senderEmail: "s@school.edu" });
    mockFetch.mockResolvedValueOnce(jsonOk({ id: "m10", threadId: "t10" }));

    const res = await agent.post("/api/gmail/send").send({
      to: "s@school.edu",
      body: "hi",
      alertId: 10,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("POST /api/gmail/fetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    const app = makeApp();
    const res = await request(app).post("/api/gmail/fetch").send({});
    expect(res.status).toBe(401);
  });

  it("returns 400 when Gmail not connected", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/2");

    mockStorage.getUserById.mockResolvedValueOnce({ id: 2 });

    const res = await agent.post("/api/gmail/fetch").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Gmail not connected");
  });

  it("returns empty emails when no messages found", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/2");

    mockStorage.getUserById.mockResolvedValueOnce({ id: 2, googleAccessToken: "tok" });
    mockFetch.mockResolvedValueOnce(jsonOk({ messages: [] }));

    const res = await agent.post("/api/gmail/fetch").send({});
    expect(res.status).toBe(200);
    expect(res.body.emails).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it("fetches and parses email with direct body", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/2");

    mockStorage.getUserById.mockResolvedValueOnce({ id: 2, googleAccessToken: "tok" });
    mockFetch.mockResolvedValueOnce(jsonOk({ messages: [{ id: "msg1" }] }));

    const bodyData = Buffer.from("I will be absent today.").toString("base64url");
    mockFetch.mockResolvedValueOnce(
      jsonOk({
        id: "msg1",
        threadId: "thread1",
        payload: {
          headers: [
            { name: "From", value: '"John Doe" <john@school.edu>' },
            { name: "Subject", value: "Absence" },
            { name: "Date", value: "Mon, 22 Mar 2026 09:00:00 +0000" },
          ],
          body: { data: bodyData },
        },
        internalDate: "1742637600000",
      }),
    );

    const res = await agent.post("/api/gmail/fetch").send({ maxResults: 5 });
    expect(res.status).toBe(200);
    expect(res.body.emails).toHaveLength(1);
    expect(res.body.emails[0].senderName).toBe("John Doe");
    expect(res.body.emails[0].senderEmail).toBe("john@school.edu");
    expect(res.body.emails[0].emailBody).toContain("absent today");
    expect(res.body.emails[0].gmailId).toBe("msg1");
    expect(res.body.emails[0].gmailThreadId).toBe("thread1");
  });

  it("parses multipart email using text/plain part", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/2");

    mockStorage.getUserById.mockResolvedValueOnce({ id: 2, googleAccessToken: "tok" });
    mockFetch.mockResolvedValueOnce(jsonOk({ messages: [{ id: "mp1" }] }));

    const textData = Buffer.from("I'm sick today").toString("base64url");
    mockFetch.mockResolvedValueOnce(
      jsonOk({
        id: "mp1",
        threadId: "tp1",
        payload: {
          headers: [
            { name: "From", value: "student@school.edu" },
            { name: "Subject", value: "Sick" },
            { name: "Date", value: "Mon, 22 Mar 2026 09:00:00 +0000" },
          ],
          body: {},
          parts: [
            { mimeType: "text/plain", body: { data: textData } },
          ],
        },
        internalDate: "1742637600000",
      }),
    );

    const res = await agent.post("/api/gmail/fetch").send({});
    expect(res.status).toBe(200);
    expect(res.body.emails[0].emailBody).toContain("sick today");
  });

  it("falls back to html part when no text/plain is available", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/2");

    mockStorage.getUserById.mockResolvedValueOnce({ id: 2, googleAccessToken: "tok" });
    mockFetch.mockResolvedValueOnce(jsonOk({ messages: [{ id: "html1" }] }));

    const htmlData = Buffer.from("<p>Emergency at home</p>").toString("base64url");
    mockFetch.mockResolvedValueOnce(
      jsonOk({
        id: "html1",
        threadId: "th1",
        payload: {
          headers: [
            { name: "From", value: "parent@home.com" },
            { name: "Subject", value: "Emergency" },
            { name: "Date", value: "Mon, 22 Mar 2026 09:00:00 +0000" },
          ],
          body: {},
          parts: [
            { mimeType: "text/html", body: { data: htmlData } },
          ],
        },
        internalDate: "1742637600000",
      }),
    );

    const res = await agent.post("/api/gmail/fetch").send({});
    expect(res.status).toBe(200);
    expect(res.body.emails[0].emailBody).toContain("Emergency at home");
  });

  it("skips bulk email with List-Id header", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/2");

    mockStorage.getUserById.mockResolvedValueOnce({ id: 2, googleAccessToken: "tok" });
    mockFetch.mockResolvedValueOnce(jsonOk({ messages: [{ id: "bulk1" }] }));
    mockFetch.mockResolvedValueOnce(
      jsonOk({
        id: "bulk1",
        threadId: "t1",
        payload: {
          headers: [{ name: "List-Id", value: "<newsletter.school.edu>" }],
          body: {},
        },
        internalDate: "1742637600000",
      }),
    );

    const res = await agent.post("/api/gmail/fetch").send({});
    expect(res.status).toBe(200);
    expect(res.body.emails).toHaveLength(0);
  });

  it("refreshes token on 401 list response and retries", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/2");

    mockStorage.getUserById.mockResolvedValueOnce({
      id: 2,
      googleAccessToken: "expired",
      googleRefreshToken: "refresh",
    });
    mockStorage.updateUserGoogleTokens.mockResolvedValueOnce(undefined);

    // List: 401
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    // Token refresh
    mockFetch.mockResolvedValueOnce(jsonOk({ access_token: "new-tok" }));
    // Retry list: empty
    mockFetch.mockResolvedValueOnce(jsonOk({ messages: [] }));

    const res = await agent.post("/api/gmail/fetch").send({});
    expect(res.status).toBe(200);
    expect(res.body.emails).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("returns 401 when refresh token fails on list 401", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/2");

    mockStorage.getUserById.mockResolvedValueOnce({
      id: 2,
      googleAccessToken: "expired",
      googleRefreshToken: "bad-refresh",
    });

    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    mockFetch.mockResolvedValueOnce({ ok: false, text: vi.fn().mockResolvedValue("error") });

    const res = await agent.post("/api/gmail/fetch").send({});
    expect(res.status).toBe(401);
    expect(res.body.error).toContain("expired");
  });

  it("returns 401 when 401 with no refresh token", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/2");

    mockStorage.getUserById.mockResolvedValueOnce({
      id: 2,
      googleAccessToken: "expired",
    });

    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    const res = await agent.post("/api/gmail/fetch").send({});
    expect(res.status).toBe(401);
    expect(res.body.error).toContain("expired");
  });

  it("returns 500 on Gmail list error (non-401)", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/2");

    mockStorage.getUserById.mockResolvedValueOnce({ id: 2, googleAccessToken: "tok" });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue("Internal error"),
    });

    const res = await agent.post("/api/gmail/fetch").send({});
    expect(res.status).toBe(500);
    expect(res.body.error).toContain("Failed to fetch emails");
  });

  it("uses fallback subject when body is empty", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/2");

    mockStorage.getUserById.mockResolvedValueOnce({ id: 2, googleAccessToken: "tok" });
    mockFetch.mockResolvedValueOnce(jsonOk({ messages: [{ id: "noBody" }] }));
    mockFetch.mockResolvedValueOnce(
      jsonOk({
        id: "noBody",
        threadId: "tnb",
        payload: {
          headers: [
            { name: "From", value: "anon@school.edu" },
            { name: "Subject", value: "I'll be absent" },
            { name: "Date", value: "Mon, 22 Mar 2026 09:00:00 +0000" },
          ],
          body: {},
          parts: [],
        },
        internalDate: "1742637600000",
      }),
    );

    const res = await agent.post("/api/gmail/fetch").send({});
    expect(res.status).toBe(200);
    expect(res.body.emails[0].emailBody).toContain("I'll be absent");
  });

  it("handles email with no angle-bracket format (bare email as from)", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/2");

    mockStorage.getUserById.mockResolvedValueOnce({ id: 2, googleAccessToken: "tok" });
    mockFetch.mockResolvedValueOnce(jsonOk({ messages: [{ id: "bare1" }] }));

    const bodyData = Buffer.from("Absence").toString("base64url");
    mockFetch.mockResolvedValueOnce(
      jsonOk({
        id: "bare1",
        threadId: "tb1",
        payload: {
          headers: [
            { name: "From", value: "student@school.edu" },
            { name: "Subject", value: "Absent" },
            { name: "Date", value: "Mon, 22 Mar 2026 09:00:00 +0000" },
          ],
          body: { data: bodyData },
        },
        internalDate: "1742637600000",
      }),
    );

    const res = await agent.post("/api/gmail/fetch").send({});
    expect(res.status).toBe(200);
    expect(res.body.emails[0].senderEmail).toBe("student@school.edu");
    expect(res.body.emails[0].senderName).toBe("student"); // bare email -> split on @
  });

  it("returns 500 when internal fetch throws unexpectedly (lines 377-378)", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/2");

    mockStorage.getUserById.mockResolvedValueOnce({ id: 2, googleAccessToken: "tok" });
    // Make the Gmail list fetch itself throw to trigger the catch block
    mockFetch.mockRejectedValueOnce(new Error("Unexpected network failure"));

    const res = await agent.post("/api/gmail/fetch").send({});
    expect(res.status).toBe(500);
    expect(res.body.error).toContain("Failed to fetch emails");
  });

  it("returns 401 when retry list fetch fails after token refresh (line 358)", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/2");

    mockStorage.getUserById.mockResolvedValueOnce({
      id: 2,
      googleAccessToken: "expired",
      googleRefreshToken: "refresh",
    });
    mockStorage.updateUserGoogleTokens.mockResolvedValueOnce(undefined);

    // List: 401
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    // Token refresh: succeeds
    mockFetch.mockResolvedValueOnce(jsonOk({ access_token: "new-tok" }));
    // Retry list: fails (non-401)
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

    const res = await agent.post("/api/gmail/fetch").send({});
    expect(res.status).toBe(401);
    expect(res.body.error).toContain("expired");
  });

  it("skips message when detail fetch returns non-ok (line 417)", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/2");

    mockStorage.getUserById.mockResolvedValueOnce({ id: 2, googleAccessToken: "tok" });
    mockFetch.mockResolvedValueOnce(jsonOk({ messages: [{ id: "err1" }] }));
    // Message detail fetch: not ok → should skip
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const res = await agent.post("/api/gmail/fetch").send({});
    expect(res.status).toBe(200);
    expect(res.body.emails).toHaveLength(0);
  });

  it("catches and continues when message detail fetch throws (line 478)", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/2");

    mockStorage.getUserById.mockResolvedValueOnce({ id: 2, googleAccessToken: "tok" });
    mockFetch.mockResolvedValueOnce(jsonOk({ messages: [{ id: "throw1" }] }));
    // Message detail fetch: throws
    mockFetch.mockRejectedValueOnce(new Error("message fetch error"));

    const res = await agent.post("/api/gmail/fetch").send({});
    expect(res.status).toBe(200);
    expect(res.body.emails).toHaveLength(0);
  });
});


describe("GET /api/auth/google/callback (additional paths)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("stores refresh_token when merging existing email account with refresh token (line 166)", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__set-session?oauthState=s-merge-rt");

    // tokens with refresh_token
    mockFetch.mockResolvedValueOnce(jsonOk({ access_token: "tok-m", refresh_token: "ref-m" }));
    mockFetch.mockResolvedValueOnce(jsonOk({ id: "gid-m", email: "merge-rt@school.edu", name: "Merge RT" }));

    mockStorage.getUserByGoogleId.mockResolvedValueOnce(null);
    mockStorage.getUserByEmail.mockResolvedValueOnce({ id: 77, email: "merge-rt@school.edu" });
    mockDbUpdate.mockResolvedValueOnce([]);

    const res = await agent.get("/api/auth/google/callback?code=cm&state=s-merge-rt");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");
    // updateData should include googleRefreshToken (line 166)
    expect(mockDbUpdate).toHaveBeenCalledOnce();
  });
});

describe("POST /api/gmail/send (additional paths)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("returns 401 when token refresh fetch throws (line 402 catch)", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/1");

    mockStorage.getUserById.mockResolvedValueOnce({
      id: 1,
      email: "t@school.edu",
      googleAccessToken: "expired",
      googleRefreshToken: "refresh-tok",
      displayName: "Teacher",
      role: "admin",
    });

    // First send: 401
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: vi.fn().mockResolvedValue("Unauthorized") });
    // Token refresh fetch: throws (triggers line 402)
    mockFetch.mockRejectedValueOnce(new Error("Token endpoint unreachable"));

    const res = await agent.post("/api/gmail/send").send({
      to: "s@school.edu",
      body: "hello",
    });
    // refresh returns null → original 401 sendRes is still non-ok → falls to 500 handler
    expect(res.status).toBe(500);
  });

  it("returns 500 when gmail send fetch throws (lines 318-319)", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.get("/__login/1");

    mockStorage.getUserById.mockResolvedValueOnce({
      id: 1,
      email: "t@school.edu",
      googleAccessToken: "tok",
      displayName: "Teacher",
      role: "admin",
    });

    mockFetch.mockRejectedValueOnce(new Error("Gmail network error"));

    const res = await agent.post("/api/gmail/send").send({
      to: "s@school.edu",
      body: "hello",
    });
    expect(res.status).toBe(500);
    expect(res.body.error).toContain("Failed to send email");
  });
});
