import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import crypto from "crypto";

const GOOGLE_CLIENT_ID = process.env.PULSE_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.PULSE_GOOGLE_CLIENT_SECRET;
const SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

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

    console.log("[Google OAuth] Redirect URI:", redirectUri);
    console.log("[Google OAuth] Client ID prefix:", GOOGLE_CLIENT_ID?.substring(0, 20) + "...");
    console.log("[Google OAuth] Headers - host:", req.headers.host, "x-forwarded-host:", req.headers["x-forwarded-host"], "x-forwarded-proto:", req.headers["x-forwarded-proto"]);

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
    console.log("[Google OAuth] Full auth URL:", authUrl);
    res.redirect(authUrl);
  });

  app.get("/api/auth/google/debug", (_req: Request, res: Response) => {
    res.json({
      clientIdSet: !!GOOGLE_CLIENT_ID,
      clientIdPrefix: GOOGLE_CLIENT_ID ? GOOGLE_CLIENT_ID.substring(0, 25) + "..." : null,
      clientSecretSet: !!GOOGLE_CLIENT_SECRET,
      hint: "If clientId looks wrong, re-check PULSE_GOOGLE_CLIENT_ID in Replit Secrets. The redirect URI in Google Console must exactly match: https://53e82104-7131-4dd1-b9aa-34ec8a5a2d54-00-nixix7l2kl4k.picard.replit.dev/api/auth/google/callback"
    });
  });

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
      res.redirect("/");
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
      const searchQuery = query || "subject:(absent OR excuse OR sick OR cannot attend OR won't be able)";

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

  for (const msg of messages.slice(0, 50)) {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!msgRes.ok) continue;

      const msgData = await msgRes.json() as {
        id: string;
        payload: {
          headers: { name: string; value: string }[];
          body?: { data?: string };
          parts?: { mimeType: string; body?: { data?: string } }[];
        };
        internalDate: string;
      };

      const headers = msgData.payload.headers;
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

  return emails;
}
