import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import crypto from "crypto";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.PULSE_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || process.env.PULSE_GOOGLE_CLIENT_SECRET;
const SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

const MESSAGE_ID_REGEX = /^<[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*>$/;

const BULK_MAIL_INDICATORS = {
  headers: ["list-id", "precedence", "auto-submitted", "x-auto-response-suppress"],
  precedenceValues: ["bulk", "list", "junk"],
  autoSubmittedValues: ["auto-replied", "auto-generated", "auto-notified"],
};

function isBulkOrAutoMail(headers: { name: string; value: string }[]): { isBulk: boolean; reason: string } {
  const headerMap = new Map(headers.map(h => [h.name.toLowerCase(), h.value]));

  if (headerMap.has("list-id")) {
    return { isBulk: true, reason: "List-Id header present (mailing list)" };
  }

  const precedence = headerMap.get("precedence");
  if (precedence && BULK_MAIL_INDICATORS.precedenceValues.some(v => precedence.toLowerCase().includes(v))) {
    return { isBulk: true, reason: `Precedence: ${precedence}` };
  }

  const autoSubmitted = headerMap.get("auto-submitted");
  if (autoSubmitted && BULK_MAIL_INDICATORS.autoSubmittedValues.some(v => autoSubmitted.toLowerCase().includes(v))) {
    return { isBulk: true, reason: `Auto-Submitted: ${autoSubmitted}` };
  }

  const xAutoResponse = headerMap.get("x-auto-response-suppress");
  if (xAutoResponse && xAutoResponse.toLowerCase() !== "none") {
    return { isBulk: true, reason: "X-Auto-Response-Suppress header present" };
  }

  return { isBulk: false, reason: "" };
}

export { isBulkOrAutoMail };

function getRedirectUri(req: Request): string {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${protocol}://${host}/api/auth/google/callback`;
}

export function setupGoogleAuth(app: Express) {
  app.get("/api/auth/google", (req: Request, res: Response) => {
    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: "Google OAuth not configured" });
    }

    const redirectUri = getRedirectUri(req);
    const state = crypto.randomBytes(16).toString("hex");
    req.session.oauthState = state;

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
      state,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.redirect(authUrl);
  });

  if (process.env.NODE_ENV !== "production") {
    app.get("/api/auth/google/debug", (_req: Request, res: Response) => {
      res.json({
        clientIdSet: !!GOOGLE_CLIENT_ID,
        clientIdPrefix: GOOGLE_CLIENT_ID ? GOOGLE_CLIENT_ID.substring(0, 25) + "..." : null,
        clientSecretSet: !!GOOGLE_CLIENT_SECRET,
        hint: "Redirect URI is built dynamically from request headers. Ensure your Google Cloud Console OAuth credentials include the exact redirect URI shown in redirectUri above."
      });
    });
  }

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        console.error("Google OAuth error:", error);
        return res.redirect("/?error=google_auth_failed");
      }

      if (!code || typeof code !== "string") {
        return res.redirect("/?error=no_code");
      }

      if (state !== req.session.oauthState) {
        return res.redirect("/?error=invalid_state");
      }
      delete req.session.oauthState;

      const redirectUri = getRedirectUri(req);

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        console.error("Token exchange failed:", err);
        return res.redirect("/?error=token_exchange_failed");
      }

      const tokens = await tokenRes.json() as {
        access_token: string;
        refresh_token?: string;
        id_token?: string;
      };

      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userInfoRes.ok) {
        return res.redirect("/?error=userinfo_failed");
      }

      const googleUser = await userInfoRes.json() as {
        id: string;
        email: string;
        name: string;
        picture?: string;
      };

      let user = await storage.getUserByGoogleId(googleUser.id);

      if (user) {
        await storage.updateUserGoogleTokens(user.id, tokens.access_token, tokens.refresh_token);
      } else {
        const existingByEmail = await storage.getUserByEmail(googleUser.email);
        if (existingByEmail) {
          const { db } = await import("./db");
          const { users } = await import("@shared/schema");
          const { eq } = await import("drizzle-orm");
          const updateData: Record<string, string> = {
            googleId: googleUser.id,
            googleAccessToken: tokens.access_token,
          };
          if (tokens.refresh_token) {
            updateData.googleRefreshToken = tokens.refresh_token;
          }
          await db.update(users).set(updateData).where(eq(users.id, existingByEmail.id));
          user = { ...existingByEmail, ...updateData };
        } else {
          const randomPassword = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
          const username = googleUser.email.split("@")[0] + "_" + crypto.randomBytes(3).toString("hex");
          user = await storage.createUser({
            username,
            email: googleUser.email,
            password: randomPassword,
            displayName: googleUser.name,
            googleId: googleUser.id,
            googleAccessToken: tokens.access_token,
            googleRefreshToken: tokens.refresh_token || null,
          });
        }
      }

      req.session.userId = user.id;
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.redirect("/?error=session_save_failed");
        }
        res.redirect("/");
      });
    } catch (error) {
      console.error("Google OAuth callback error:", error);
      res.redirect("/?error=google_auth_failed");
    }
  });

  app.get("/api/auth/google/status", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    res.json({
      connected: !!user.googleId,
      hasGmailAccess: !!user.googleAccessToken,
    });
  });

  app.post("/api/gmail/send", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await storage.getUserById(req.session.userId);
    if (!user || !user.googleAccessToken) {
      return res.status(400).json({ error: "Gmail not connected. Please sign in with Google to send emails." });
    }

    const { to, subject, body, inReplyTo, threadId, alertId } = req.body;
    if (!to || !body) {
      return res.status(400).json({ error: "Recipient and message body are required" });
    }

    if (alertId) {
      const alerts = await storage.getAlertsByUser(user.id);
      const allAlerts = user.role === "admin" ? await storage.getAllAlerts() : alerts;
      const alert = allAlerts.find(a => a.id === alertId);
      if (!alert) {
        return res.status(403).json({ error: "Alert not found or not authorized" });
      }
      const record = await storage.getRecordById(alert.recordId);
      if (record && record.senderEmail !== to) {
        return res.status(400).json({ error: "Recipient must match the original sender" });
      }
    }

    try {
      let accessToken = user.googleAccessToken;

      const userEmail = user.email;
      const displayName = user.displayName || user.username;

      const sanitize = (s: string) => s.replace(/[\r\n]/g, " ").trim();
      const safeTo = sanitize(to);
      const safeSubject = sanitize(subject || "(no subject)");
      const safeBody = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

      const headers = [
        `From: "${sanitize(displayName)}" <${userEmail}>`,
        `To: ${safeTo}`,
        `Subject: ${safeSubject}`,
        "MIME-Version: 1.0",
        'Content-Type: text/plain; charset="UTF-8"',
        "X-Auto-Response-Suppress: All",
        "X-PULSE-AutoReply: v1",
        "X-Mailer: PULSE-Attendance-System",
      ];

      if (inReplyTo && MESSAGE_ID_REGEX.test(inReplyTo)) {
        headers.push(`In-Reply-To: ${inReplyTo}`);
        headers.push(`References: ${inReplyTo}`);
      }

      const rawMessage = [...headers, "", safeBody].join("\r\n");
      const encodedMessage = Buffer.from(rawMessage).toString("base64url");

      const sendPayload: Record<string, string> = { raw: encodedMessage };
      if (threadId) {
        sendPayload.threadId = threadId;
      }

      let sendRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(sendPayload),
        }
      );

      if (sendRes.status === 401 && user.googleRefreshToken) {
        const refreshed = await refreshAccessToken(user.id, user.googleRefreshToken);
        if (refreshed) {
          accessToken = refreshed;
          sendRes = await fetch(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(sendPayload),
            }
          );
        }
      }

      if (!sendRes.ok) {
        const errText = await sendRes.text();
        console.error("Gmail send error:", errText);
        if (sendRes.status === 403 || errText.includes("insufficient") || errText.includes("scope")) {
          return res.status(403).json({ error: "Gmail send permission not granted. Please reconnect your Google account to enable sending emails." });
        }
        return res.status(500).json({ error: "Failed to send email. You may need to reconnect your Google account with updated permissions." });
      }

      const sendData = await sendRes.json() as { id: string; threadId: string };
      res.json({ success: true, messageId: sendData.id, threadId: sendData.threadId });
    } catch (error) {
      console.error("Gmail send error:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  app.post("/api/gmail/fetch", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await storage.getUserById(req.session.userId);
    if (!user || !user.googleAccessToken) {
      return res.status(400).json({ error: "Gmail not connected. Please sign in with Google first." });
    }

    try {
      const { maxResults = 20, query = "" } = req.body;
      const searchQuery = query || "(absent OR absence OR excuse OR sick OR cannot attend OR won't be able OR can't make it OR unable to attend OR not coming OR won't be in OR missing class OR missing session OR out today OR out sick OR not feeling well OR under the weather OR late OR tardy OR running late OR delayed OR will be late OR running behind OR held up OR stuck in traffic OR won't make it on time OR stepping out OR leaving early OR emergency OR appointment OR called out)";

      const params = new URLSearchParams({
        maxResults: String(Math.min(maxResults, 50)),
        q: searchQuery,
      });

      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
        { headers: { Authorization: `Bearer ${user.googleAccessToken}` } }
      );

      if (listRes.status === 401) {
        if (user.googleRefreshToken) {
          const refreshed = await refreshAccessToken(user.id, user.googleRefreshToken);
          if (!refreshed) {
            return res.status(401).json({ error: "Gmail session expired. Please sign in with Google again." });
          }
          const retryRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
            { headers: { Authorization: `Bearer ${refreshed}` } }
          );
          if (!retryRes.ok) {
            return res.status(401).json({ error: "Gmail session expired. Please sign in with Google again." });
          }
          const retryData = await retryRes.json() as { messages?: { id: string }[] };
          const emails = await fetchEmailDetails(retryData.messages || [], refreshed);
          return res.json({ emails, total: emails.length });
        }
        return res.status(401).json({ error: "Gmail session expired. Please sign in with Google again." });
      }

      if (!listRes.ok) {
        const errText = await listRes.text();
        console.error("Gmail list error:", errText);
        return res.status(500).json({ error: "Failed to fetch emails from Gmail" });
      }

      const listData = await listRes.json() as { messages?: { id: string }[] };
      const emails = await fetchEmailDetails(listData.messages || [], user.googleAccessToken);
      res.json({ emails, total: emails.length });
    } catch (error) {
      console.error("Gmail fetch error:", error);
      res.status(500).json({ error: "Failed to fetch emails from Gmail" });
    }
  });
}

async function refreshAccessToken(userId: number, refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) return null;

    const data = await res.json() as { access_token: string };
    await storage.updateUserGoogleTokens(userId, data.access_token);
    return data.access_token;
  } catch {
    return null;
  }
}

async function fetchEmailDetails(messages: { id: string }[], accessToken: string) {
  const emails = [];
  let skippedBulk = 0;

  for (const msg of messages.slice(0, 50)) {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!msgRes.ok) continue;

      const msgData = await msgRes.json() as {
        id: string;
        threadId?: string;
        payload: {
          headers: { name: string; value: string }[];
          body?: { data?: string };
          parts?: { mimeType: string; body?: { data?: string } }[];
        };
        internalDate: string;
      };

      const headers = msgData.payload.headers;

      const bulkCheck = isBulkOrAutoMail(headers);
      if (bulkCheck.isBulk) {
        console.log(`[Gmail Fetch] Skipping bulk/auto mail: ${bulkCheck.reason}`);
        skippedBulk++;
        continue;
      }

      const from = headers.find((h) => h.name.toLowerCase() === "from")?.value || "";
      const subject = headers.find((h) => h.name.toLowerCase() === "subject")?.value || "";
      const date = headers.find((h) => h.name.toLowerCase() === "date")?.value || "";

      let body = "";
      if (msgData.payload.body?.data) {
        body = Buffer.from(msgData.payload.body.data, "base64url").toString("utf-8");
      } else if (msgData.payload.parts) {
        const textPart = msgData.payload.parts.find((p) => p.mimeType === "text/plain");
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, "base64url").toString("utf-8");
        } else {
          const htmlPart = msgData.payload.parts.find((p) => p.mimeType === "text/html");
          if (htmlPart?.body?.data) {
            body = Buffer.from(htmlPart.body.data, "base64url").toString("utf-8")
              .replace(/<[^>]*>/g, " ")
              .replace(/\s+/g, " ")
              .trim();
          }
        }
      }

      const nameMatch = from.match(/^"?([^"<]+)"?\s*</);
      const emailMatch = from.match(/<([^>]+)>/);
      const senderName = nameMatch ? nameMatch[1].trim() : from.split("@")[0];
      const senderEmail = emailMatch ? emailMatch[1] : from;

      const receivedAt = date ? new Date(date).toISOString() : new Date(parseInt(msgData.internalDate)).toISOString();

      emails.push({
        gmailId: msgData.id,
        gmailThreadId: msgData.threadId || null,
        senderName,
        senderEmail,
        subject,
        receivedAt,
        emailBody: body || `Subject: ${subject}`,
      });
    } catch (err) {
      console.error("Error fetching email detail:", err);
    }
  }

  if (skippedBulk > 0) {
    console.log(`[Gmail Fetch] Skipped ${skippedBulk} bulk/auto emails`);
  }

  return emails;
}
