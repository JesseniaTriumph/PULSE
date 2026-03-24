import { storage } from "./storage";

export type SlackConnectionSource = "oauth" | "env" | null;

export interface SlackConnectionStatus {
  connected: boolean;
  userConnected: boolean;
  connectionSource: SlackConnectionSource;
  oauthConfigured: boolean;
}

export interface SlackAvailableChannel {
  id: string;
  name: string;
  isPrivate: boolean;
}

interface SlackConversationListItem {
  id: string;
  name?: string;
  is_archived?: boolean;
  is_private?: boolean;
}

// Returns the best token for SCANNING (reading messages/DMs)
// Prefers user token (xoxp-) so DMs work; falls back to bot token or env
export async function getSlackTokenForUser(userId: number): Promise<string | null> {
  const user = await storage.getUserById(userId);
  return user?.slackAccessToken || user?.slackBotToken || process.env.SLACK_BOT_TOKEN || null;
}

// Returns the best token for SENDING messages as @PULSE
export async function getSlackSendToken(userId: number): Promise<string | null> {
  const user = await storage.getUserById(userId);
  return user?.slackBotToken || process.env.SLACK_BOT_TOKEN || null;
}

export async function getSlackConnectionStatus(userId: number): Promise<SlackConnectionStatus> {
  const user = await storage.getUserById(userId);
  const userConnected = !!(user?.slackAccessToken || user?.slackBotToken);
  const envConnected = !!process.env.SLACK_BOT_TOKEN;

  return {
    connected: userConnected || envConnected,
    userConnected,
    connectionSource: userConnected ? "oauth" : envConnected ? "env" : null,
    oauthConfigured: !!process.env.SLACK_CLIENT_ID && !!process.env.SLACK_CLIENT_SECRET,
  };
}

export async function slackApiGet(
  endpoint: string,
  token: string,
  params?: Record<string, string>,
): Promise<any> {
  const url = new URL(`https://slack.com/api/${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Slack API ${endpoint} returned ${response.status}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Slack API ${endpoint} error: ${data.error}`);
  }

  return data;
}

export async function slackApiPost(
  endpoint: string,
  token: string,
  body?: Record<string, unknown>,
): Promise<any> {
  const response = await fetch(`https://slack.com/api/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Slack API ${endpoint} returned ${response.status}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Slack API ${endpoint} error: ${data.error}`);
  }

  return data;
}

export async function listSlackChannels(token: string): Promise<SlackAvailableChannel[]> {
  const channels: SlackAvailableChannel[] = [];
  let cursor = "";

  do {
    const data = await slackApiGet("conversations.list", token, {
      types: "public_channel,private_channel",
      exclude_archived: "true",
      limit: "200",
      ...(cursor ? { cursor } : {}),
    });

    for (const channel of (data.channels || []) as SlackConversationListItem[]) {
      if (!channel.id || !channel.name || channel.is_archived) continue;
      channels.push({
        id: channel.id,
        name: channel.name,
        isPrivate: !!channel.is_private,
      });
    }

    cursor = data.response_metadata?.next_cursor || "";
  } while (cursor);

  return channels.sort((a, b) => a.name.localeCompare(b.name));
}
