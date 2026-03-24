import { pool } from "./db";

/**
 * Idempotent schema migrations — runs at startup to ensure all tables and
 * columns added after initial deploy exist in the production database.
 * Uses IF NOT EXISTS / IF NOT EXISTS semantics so it's safe to run every boot.
 */
export async function runMigrations() {
  const client = await pool.connect();
  try {
    // lms_configs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "lms_configs" (
        "id" serial PRIMARY KEY,
        "user_id" integer NOT NULL REFERENCES "users"("id"),
        "lms_type" text NOT NULL,
        "api_url" text NOT NULL,
        "api_key" text NOT NULL,
        "api_secret" text,
        "institution_id" text,
        "enabled" boolean NOT NULL DEFAULT true,
        "sync_attendance" boolean NOT NULL DEFAULT true,
        "default_assessment_action" text NOT NULL DEFAULT 'excuse',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // lms_sync_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "lms_sync_logs" (
        "id" serial PRIMARY KEY,
        "record_id" integer NOT NULL REFERENCES "attendance_records"("id"),
        "lms_config_id" integer NOT NULL REFERENCES "lms_configs"("id"),
        "sync_type" text NOT NULL,
        "sync_status" text NOT NULL,
        "lms_response" text,
        "error_message" text,
        "synced_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // alternate_emails column on students (added for multi-email support)
    await client.query(`
      ALTER TABLE "students"
        ADD COLUMN IF NOT EXISTS "alternate_emails" text[];
    `);

    // slack_bot_token column on slack_channel_configs (added for multi-org support)
    await client.query(`
      ALTER TABLE "slack_channel_configs"
        ADD COLUMN IF NOT EXISTS "slack_bot_token" text;
    `);

    // password reset columns on users (added for forgot-password flow)
    await client.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "password_reset_token" text,
        ADD COLUMN IF NOT EXISTS "password_reset_expiry" timestamp;
    `);

    console.log("[migrations] Schema up to date");
  } catch (err) {
    console.error("[migrations] Migration failed:", err);
    throw err;
  } finally {
    client.release();
  }
}
