import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { storage } from "./storage";

// Bot Token Scopes — app reads channels/DMs it's been added to, sends as @PULSE
const BOT_SCOPES = [
  "channels:history",
  "channels:read",
  "groups:history",
  "groups:read",
  "im:history",
  "im:read",
  "mpim:history",
  "mpim:read",
  "users:read",
  "users:read.email",
  "chat:write",
].join(",");

// User Token Scopes — app reads the instructor's own DMs and channels as them
const USER_SCOPES = [
  "channels:history",
  "groups:history",
  "im:history",
  "im:read",
  "mpim:history",
  "mpim:read",
  "users:read",
  "users:read.email",
].join(",");

function getRedirectUri(req: Request): string {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${protocol}://${host}/api/auth/slack/callback`;
}

export function setupSlackAuth(app: Express) {
  app.get("/api/auth/slack", (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.status(503).json({ error: "Slack OAuth is not configured" });
    }

    const redirectUri = getRedirectUri(req);
    const state = `${req.session.userId}:${crypto.randomBytes(16).toString("hex")}`;
    req.session.slackOAuthState = state;

    const url = new URL("https://slack.com/oauth/v2/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("scope", BOT_SCOPES);        // bot token — send as @PULSE
    url.searchParams.set("user_scope", USER_SCOPES);  // user token — scan instructor's DMs
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);

    // Save session before redirecting so slackOAuthState is persisted to DB
    req.session.save((err) => {
      if (err) {
        console.error("[Slack Auth] Session save error:", err);
        return res.status(500).json({ error: "Session error" });
      }
      res.redirect(url.toString());
    });
  });

  app.get("/api/auth/slack/callback", async (req: Request, res: Response) => {
    const { code, state, error } = req.query;

    if (error) {
      console.error("[Slack Auth] OAuth error:", error);
      return res.redirect("/settings?slack_error=access_denied");
    }

    if (!code || typeof code !== "string" || !state || typeof state !== "string") {
      return res.redirect("/settings?slack_error=missing_params");
    }

    if (state !== req.session.slackOAuthState) {
      return res.redirect("/settings?slack_error=invalid_state");
    }
    delete req.session.slackOAuthState;

    const [userIdPart] = state.split(":");
    const userId = parseInt(userIdPart, 10);
    if (isNaN(userId)) {
      return res.redirect("/settings?slack_error=invalid_state");
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.redirect("/settings?slack_error=not_configured");
    }

    try {
      const redirectUri = getRedirectUri(req);

      const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenRes.json();

      if (!tokenData.ok) {
        console.error("[Slack Auth] Token exchange failed:", tokenData.error);
        return res.redirect(`/settings?slack_error=${tokenData.error}`);
      }

      // oauth.v2.access returns:
      //   tokenData.access_token        — bot token  (xoxb-) for sending as @PULSE
      //   tokenData.authed_user.access_token — user token (xoxp-) for scanning instructor's DMs
      const botToken = tokenData.access_token || null;
      const userToken = tokenData.authed_user?.access_token || null;
      const slackUserId = tokenData.authed_user?.id || null;
      const botUserId = tokenData.bot_user_id || null;

      if (!botToken && !userToken) {
        console.error("[Slack Auth] No tokens in response:", JSON.stringify(tokenData));
        return res.redirect("/settings?slack_error=no_token");
      }

      // Store user token as slackAccessToken (scanning), bot token as slackBotToken (sending)
      await storage.updateUserSlackTokens(userId, userToken, slackUserId, botToken);
      req.session.userId = userId;
      console.log(`[Slack Auth] Connected Slack for user ${userId} — bot: ${!!botToken}, user token: ${!!userToken}, slackUserId: ${slackUserId || botUserId}`);

      res.redirect("/settings?slack_connected=1");
    } catch (err) {
      console.error("[Slack Auth] Error during token exchange:", err);
      res.redirect("/settings?slack_error=server_error");
    }
  });

  app.post("/api/auth/slack/disconnect", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      await storage.updateUserSlackTokens(req.session.userId, null, null);
      res.json({ success: true });
    } catch (err) {
      console.error("[Slack Auth] Error disconnecting:", err);
      res.status(500).json({ error: "Failed to disconnect Slack" });
    }
  });
}
