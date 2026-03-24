import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { storage } from "./storage";

const SLACK_SCOPES = [
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
    url.searchParams.set("user_scope", SLACK_SCOPES);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);

    res.redirect(url.toString());
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

      const userToken = tokenData.authed_user?.access_token || null;
      const slackUserId = tokenData.authed_user?.id || null;

      if (!userToken) {
        console.error("[Slack Auth] No user token in response");
        return res.redirect("/settings?slack_error=no_user_token");
      }

      await storage.updateUserSlackTokens(userId, userToken, slackUserId);
      req.session.userId = userId;
      console.log(`[Slack Auth] Connected Slack for user ${userId} (Slack user ${slackUserId})`);

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
