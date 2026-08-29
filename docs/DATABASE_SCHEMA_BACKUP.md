# PULSE — Database Schema Backup

**Captured:** 2026-06-27
**Source:** `shared/schema.ts` + `shared/models/chat.ts` (Drizzle ORM definitions, already version-controlled in this repo — GitHub: `JesseniaTriumph/PULSE`).
**Reason:** Preserving the schema before the **Pulse** Supabase project (`dvpxlhbopecgiwxmaxsg`, org "Pursuit") is deleted to free a free-tier project slot.

> ⚠️ **Scope of this backup: SCHEMA ONLY.**
> The live **row data** in the Supabase database was **not** exported, because the project was paused and could not be restored (the org was at its 2‑project free‑tier limit, which blocks restore). The schema below is fully reconstructable from this repo regardless of the database — deleting the Supabase project does **not** lose any schema or application code. If the live data matters, export it from the Supabase dashboard **before** deleting the project.

Pulse is a Pursuit cohort attendance / instructor tool: it scans Gmail + Slack for absence/excuse messages, classifies them with AI, raises alerts, and optionally syncs to an LMS.

## Enums / controlled vocabularies (stored as TEXT columns)

| Name | Values |
|------|--------|
| user roles | `admin`, `instructor` |
| attendance types | `Absent`, `Late/Tardy`, `Unexcused` |
| excuse categories | `Medical`, `Family`, `Administrative`, `Technical`, `Networking`, `Other`, `Unexcused` |
| cohort names | `L1`, `L2`, `L3`, `L∞` |
| message sources | `gmail`, `slack` |
| student statuses | `Active`, `Graduated`, `Hired` |
| LMS types | `agilix_buzz`, `d2l_brightspace`, `canvas`, `blackboard`, `custom` |
| assessment actions | `none`, `excuse`, `zero_out`, `makeup_allowed` |

## Tables (13)

Reconstructed Postgres DDL equivalent of the Drizzle definitions:

```sql
CREATE TABLE users (
  id                    SERIAL PRIMARY KEY,
  username              TEXT NOT NULL UNIQUE,
  email                 TEXT NOT NULL UNIQUE,
  password              TEXT NOT NULL,
  display_name          TEXT NOT NULL,
  role                  TEXT NOT NULL DEFAULT 'instructor',
  google_id             TEXT UNIQUE,
  google_access_token   TEXT,
  google_refresh_token  TEXT,
  slack_user_id         TEXT,
  slack_access_token    TEXT,   -- user token (xoxp-) — scans DMs & channels as instructor
  slack_bot_token       TEXT,   -- bot token (xoxb-) — sends messages as @PULSE
  password_reset_token  TEXT,
  password_reset_expiry TIMESTAMP,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cohorts (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  instructor_id INTEGER NOT NULL REFERENCES users(id),
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE students (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  email            TEXT NOT NULL,
  alternate_emails TEXT[],
  cohort_id        INTEGER NOT NULL REFERENCES cohorts(id),
  status           TEXT NOT NULL DEFAULT 'Active',
  slack_user_id    TEXT,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE schedules (
  id          SERIAL PRIMARY KEY,
  cohort_id   INTEGER NOT NULL REFERENCES cohorts(id),
  day_of_week INTEGER NOT NULL,
  start_time  TEXT NOT NULL,
  end_time    TEXT NOT NULL,
  label       TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attendance_records (
  id                     SERIAL PRIMARY KEY,
  user_id                INTEGER NOT NULL REFERENCES users(id),
  student_id             INTEGER REFERENCES students(id),
  sender_name            TEXT NOT NULL,
  sender_email           TEXT NOT NULL,
  received_at            TIMESTAMP NOT NULL,
  email_body             TEXT NOT NULL,
  attendance_type        TEXT NOT NULL DEFAULT 'Absent',
  excuse_category        TEXT NOT NULL,
  message_snippet        TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'pending',
  batch_id               TEXT,
  needs_response         BOOLEAN DEFAULT false,
  urgency                TEXT DEFAULT 'low',
  alert_reason           TEXT,
  mentions_student       BOOLEAN DEFAULT false,
  mentions_school        BOOLEAN DEFAULT false,
  peer_or_school_detail  TEXT,
  gmail_message_id       TEXT,
  gmail_thread_id        TEXT,
  source                 TEXT NOT NULL DEFAULT 'gmail',
  email_subject          TEXT,
  slack_channel_id       TEXT,
  slack_channel_name     TEXT,
  slack_message_ts       TEXT,
  slack_is_dm            BOOLEAN DEFAULT false,
  ai_confidence          REAL,
  ai_confidence_tier     TEXT,
  requires_manual_review BOOLEAN DEFAULT false,
  assessment_action      TEXT DEFAULT 'none',
  lms_synced             BOOLEAN DEFAULT false,
  lms_sync_status        TEXT,
  lms_external_id        TEXT,
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE alerts (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  record_id  INTEGER NOT NULL REFERENCES attendance_records(id),
  alert_type TEXT NOT NULL,
  message    TEXT NOT NULL,
  urgency    TEXT NOT NULL DEFAULT 'low',
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE auto_reply_cooldowns (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  sender_email  TEXT NOT NULL,
  last_reply_at TIMESTAMP NOT NULL,
  expires_at    TIMESTAMP NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lms_configs (
  id                        SERIAL PRIMARY KEY,
  user_id                   INTEGER NOT NULL REFERENCES users(id),
  lms_type                  TEXT NOT NULL,
  api_url                   TEXT NOT NULL,
  api_key                   TEXT NOT NULL,
  api_secret                TEXT,
  institution_id            TEXT,
  enabled                   BOOLEAN NOT NULL DEFAULT true,
  sync_attendance           BOOLEAN NOT NULL DEFAULT true,
  default_assessment_action TEXT NOT NULL DEFAULT 'excuse',
  created_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lms_sync_logs (
  id            SERIAL PRIMARY KEY,
  record_id     INTEGER NOT NULL REFERENCES attendance_records(id),
  lms_config_id INTEGER NOT NULL REFERENCES lms_configs(id),
  sync_type     TEXT NOT NULL,
  sync_status   TEXT NOT NULL,
  lms_response  TEXT,
  error_message TEXT,
  synced_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE slack_channel_configs (
  id              SERIAL PRIMARY KEY,
  cohort_id       INTEGER NOT NULL REFERENCES cohorts(id),
  channel_id      TEXT NOT NULL,
  channel_name    TEXT NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  slack_bot_token TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scan_configs (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  scan_time   TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  scan_gmail  BOOLEAN NOT NULL DEFAULT true,
  scan_slack  BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE conversations (
  id         SERIAL PRIMARY KEY,
  title      TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
  id              SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Restoring this schema later

This Drizzle schema is the source of truth. To recreate the database from scratch:

```bash
# from the PULSE project root
npm install
npx drizzle-kit push      # applies shared/schema.ts to the DATABASE_URL in .env
```

Live data (rows) is **not** included here — restore it from a Supabase dashboard export if one was taken before deletion.
