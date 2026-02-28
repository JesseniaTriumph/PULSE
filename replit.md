# PULSE

## Overview
PULSE is a space-themed, multi-tenant AI-powered attendance management system built for Pursuit (tech training program). It processes student absence and tardiness messages from Gmail AND Slack using a dual-classification system (attendanceType + excuseCategory), supports multiple roles (Admin/Instructor), classes (L1, L2, L3, L∞), student rosters with status tracking, class progression, class schedules, automated scanning at configured times with per-source control (Gmail/Slack independently per time slot), direct email replies from the portal, and an alert system for urgent/action-needed messages. Features a dark space aesthetic with animated star fields and violet/indigo accent colors.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + Shadcn UI (wouter for routing, @tanstack/react-query)
- **Backend**: Express.js + PostgreSQL (Drizzle ORM) + OpenAI AI Integrations
- **AI**: Multi-LLM fallback system using Replit AI Integrations (OpenAI): tries gpt-5-nano (cheapest) → gpt-5-mini → gpt-5.2 (most capable). Performs dual-classification (attendanceType + excuseCategory), alert detection (needsResponse, urgency, alertReason), and peer/school mention detection (mentionsStudent, mentionsSchool, peerOrSchoolDetail)
- **Auth**: Session-based auth with bcrypt, express-session + connect-pg-simple; Google OAuth for sign-in + Gmail access (read + send); role-based access (admin/instructor)
- **Theme**: Dark/light mode with ThemeProvider (localStorage persistence); dark mode: full star field (120 stars), light mode: subtle corner sparkles (20 sparkles); CSS variables in :root (light) and .dark (dark); Tailwind darkMode: ["class"]
- **Scheduler**: Interval-based scanner (every 30s) checking configured scan times; per-source flags (scanGmail, scanSlack) control which sources to scan at each time; auto-fetches Gmail and/or Slack, processes messages, creates alerts
- **Multi-source**: Records can come from Gmail or Slack; source tracked per record with source-specific metadata (Gmail: messageId, threadId, subject; Slack: channelId, channelName, messageTs, isDm)
- **Slack Scanner**: Scans configured Slack channels and DMs for attendance-related messages using SLACK_BOT_TOKEN; keyword matching → AI categorization → record creation with student matching

## Key Features
- Multi-tenant with roles: Admin (sees all) and Instructor (sees own classes)
- Class management: L1, L2, L3, L∞ with instructor assignments
- Student roster with per-student attendance history and profile view
- Student status tracking: Active, Graduated, Hired (status column on students table; non-active students appear dimmed in roster)
- Class progression: bulk promote entire class (moves all active students to target class; Graduated/Hired stay put), move individual students between classes
- Class schedule management (weekly grid per class)
- Dual classification system:
  - **attendanceType**: Absent, Late/Tardy, Unexcused (filter buttons on Dashboard next to Records heading)
  - **excuseCategory**: Sick/Medical, Personal, Program Event, Technical Issue, Other, None (clickable stat cards on Dashboard)
  - Both filters work together (e.g., show only Late/Tardy + Personal records)
- Alert system with mark read/unread, urgency levels (low/medium/high), peer mentions (student-about-student), and school/program reports (about Pursuit, classes, curriculum, instructors)
- Direct email reply from Alerts page: compose reply → sent via instructor's Gmail with proper email threading (In-Reply-To, References headers, Gmail threadId)
- Multi-LLM fallback: nano → mini → full model chain to minimize costs; escalates only on low confidence (<0.4) or failure
- Automated scanning at 5 configurable times (default: 10:00 AM, 2:00 PM, 6:25 PM, 8:00 PM, 9:55 PM)
- Per-source scan control: each scan time has independent Gmail and Slack toggles in Settings
- Slack scanning: scans configured channels and DMs for attendance keywords, processes through AI, creates records with Slack metadata
- Google OAuth sign-in with Gmail inbox reading and sending; reconnect button in Settings for re-authorizing with updated scopes
- Manual email entry, batch processing (JSON/CSV), Gmail fetch
- Time-period filtering (Today/Week/Month/Quarter/Year/All), CSV/DOCX/JSON export, print support
- Sidebar navigation with alert badge count (unread count)
- Multi-source support: Gmail and Slack records with source filter buttons (Gmail/Slack) and source indicators in records table
- Admin sees ALL records across all users; Instructor sees only their own

## Project Structure
```
shared/schema.ts          - Data models (users, cohorts, students, schedules, attendanceRecords, alerts, scanConfigs, slackChannelConfigs); studentStatuses, attendanceTypes, excuseCategories, messageSources constants
server/db.ts              - Database connection (Neon PostgreSQL)
server/auth.ts            - Auth setup (session, login, register, logout, demo with seeding)
server/google-auth.ts     - Google OAuth routes (sign-in, callback, Gmail fetch, Gmail send); scopes: openid, userinfo.email, userinfo.profile, gmail.readonly, gmail.send
server/storage.ts         - Full CRUD operations (IStorage interface + DatabaseStorage); includes markAlertRead, markAlertUnread, updateStudent (status/cohortId), getCohortById, getStudentsByCohort
server/routes.ts          - API endpoints with role-based middleware (requireAuth, requireAdmin); includes PATCH /api/students/:id with authorization + validation, POST /api/cohorts/:id/promote
server/openai.ts          - AI dual-classification + alert detection + peer/school mention detection
server/scheduler.ts       - Automated scanning scheduler (30s interval); checks scanGmail/scanSlack per config; runs Gmail scan and/or Slack scan
server/slack-scanner.ts   - Slack channel/DM scanner using SLACK_BOT_TOKEN; keyword matching → AI categorization → record creation
client/src/App.tsx         - App root with sidebar layout, auth gating, routing
client/src/hooks/use-auth.ts    - Auth hook (login, register, logout, user state, isAdmin helper)
client/src/components/app-sidebar.tsx  - Sidebar navigation with role-based items + alert badge
client/src/components/star-field.tsx   - Animated star background
client/src/components/theme-provider.tsx - Dark/light mode context
client/src/components/records-table.tsx  - Records data table with Type + Reason columns (print-friendly)
client/src/components/add-email-dialog.tsx - Single email form
client/src/components/batch-upload-dialog.tsx - Batch processing
client/src/components/gmail-fetch-dialog.tsx  - Gmail inbox search
client/src/pages/dashboard.tsx  - Dashboard with excuse category stat cards, attendance type filter buttons (All/Absent/Late-Tardy/Unexcused), source filter buttons (Gmail/Slack), time filters, records table, cohort filter (admin)
client/src/pages/students.tsx   - Student roster with status badges + filter, student profile with status change dropdown + move-to-class dialog, attendance history
client/src/pages/schedule.tsx   - Weekly schedule grid per class
client/src/pages/alerts.tsx     - Alert feed with urgency badges, mark read/unread, reply dialog (Gmail send), alert detail dialog showing full email body
client/src/pages/admin-cohorts.tsx - Admin class management + instructor assignment + bulk promote class dialog
client/src/pages/instructors.tsx   - Admin instructor list
client/src/pages/settings.tsx   - Scan schedule config with per-source toggles (Gmail/Slack per time), account info, Google connect/reconnect
client/src/pages/auth.tsx       - Login/Register page (space themed, Google sign-in)
```

## API Endpoints
### Auth
- `POST /api/auth/register` - Create account (with role)
- `POST /api/auth/login` - Sign in
- `POST /api/auth/logout` - Sign out
- `POST /api/auth/demo` - Demo login (admin + seeded cohorts, students, schedule, records, alerts)
- `GET /api/auth/me` - Current user info (includes role, googleId)
- `GET /api/auth/google` - Initiate Google OAuth flow (scopes: openid, email, profile, gmail.readonly, gmail.send)
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/google/status` - Check if Google account is connected and has Gmail access

### Cohorts & Students
- `GET/POST/PATCH/DELETE /api/cohorts` - Class CRUD (admin: all, instructor: own)
- `GET/POST/PATCH/DELETE /api/students` - Student CRUD (admin: all, instructor: own classes); PATCH supports status (Active/Graduated/Hired) and cohortId changes with authorization checks
- `GET /api/students/:id` - Student profile with attendance records
- `POST /api/cohorts/:id/promote` - Bulk promote all active students to target class (admin only); validates source/target exist and aren't same
- `GET /api/instructors` - List all instructors (admin only)

### Schedules
- `GET /api/schedules/:cohortId` - Schedule for a class (with ownership check for instructors)
- `POST/PATCH/DELETE /api/schedules` - Schedule CRUD

### Alerts
- `GET /api/alerts` - User's alerts (admin: all alerts); enriched with associated record data (senderName, senderEmail, emailBody, messageSnippet, gmailMessageId, gmailThreadId)
- `GET /api/alerts/unread-count` - Unread count
- `PATCH /api/alerts/:id/read` - Mark alert read
- `PATCH /api/alerts/:id/unread` - Mark alert unread
- `POST /api/alerts/mark-all-read` - Mark all read

### Gmail
- `POST /api/gmail/fetch` - Fetch emails from connected Gmail inbox
- `POST /api/gmail/send` - Send email reply via Gmail (to, subject, body, inReplyTo, threadId, alertId); validates recipient matches original sender when alertId provided; sanitizes headers against injection; supports token refresh

### Scan Configs
- `GET/POST/PATCH/DELETE /api/scan-configs` - Scan schedule CRUD; each config has `scanGmail` and `scanSlack` boolean fields for per-source control

### Slack Channel Configs
- `GET/POST/PATCH/DELETE /api/slack-channels` - Slack channel config CRUD (admin only)

### Records & Export (with cohort ownership checks for instructors)
- `GET /api/records` - Records (supports ?cohortId, ?studentId filters)
- `GET /api/stats` - Category counts (supports ?cohortId)
- `POST /api/process-emails` - Process emails with AI (SSE streaming)
- `GET /api/export/csv|doc|json` - Export reports

## Database
- PostgreSQL via Neon
- 9 Tables: `users` (with role, google fields, slackUserId), `cohorts`, `students` (with status: Active/Graduated/Hired), `schedules`, `attendance_records` (with attendanceType, excuseCategory, needsResponse, urgency, alertReason, mentionsStudent, mentionsSchool, peerOrSchoolDetail, gmailMessageId, gmailThreadId, source, emailSubject, slackChannelId, slackChannelName, slackMessageTs, slackIsDm), `alerts`, `scan_configs` (with scanGmail, scanSlack booleans), `slack_channel_configs`, `session`
- Managed with Drizzle ORM

## Demo Account
- Username: `demo`, role: admin — seeds 2 instructors, 4 cohorts (L1/L2/L3/L∞), 12 students (all Active by default), schedule entries, 7 attendance records (mix of Gmail and Slack sources), 2 alerts, 5 scan configs
- Instructor accounts: instructor_smith (L1/L2), instructor_jones (L3/L∞)

## Important User Preferences
- Do NOT tone down sparkle intensity — keep scale(2), strong box-shadows, anim-sparkle at full intensity
- Star field: 120 stars dark mode, 20 corner sparkles light mode
- UI says "Classes" everywhere; code/variables/routes still use "cohort" internally
- Late/Tardy must always be visible as a classification — both as an attendanceType and as filter buttons on the Dashboard
- ALL button/badge colors need darker hues in light mode (use `dark:` variants) — not just yellow/gray, ALL colors
- Base text color in light mode: deep space navy-dark (250 25% 10%) — space-themed, high contrast, NOT plain gray
- Dark mode colors must remain exactly as-is — zero changes to dark mode

## Terminology
- UI-facing: "Classes" (not "Cohorts")
- Internal code: variables, routes, DB columns still use `cohort` naming
- attendanceType = the what (Absent, Late/Tardy, Unexcused)
- excuseCategory = the why (Sick/Medical, Personal, Program Event, Technical Issue, Other, None)

## Environment Secrets
- `SESSION_SECRET` - express-session cookie signing
- `DATABASE_URL` - PostgreSQL connection string
- `PULSE_GOOGLE_CLIENT_ID` - Google OAuth client ID
- `PULSE_GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `SLACK_BOT_TOKEN` - Slack Bot User OAuth Token (optional; needed for Slack scanning; scopes: channels:history, groups:history, im:history, channels:read, users:read, users:read.email, chat:write)

## Security Notes
- PATCH /api/students/:id enforces instructor ownership (can only modify students in their own classes)
- PATCH /api/students/:id validates status against allowed values and verifies target cohortId exists
- POST /api/gmail/send validates recipient matches original sender when alertId is provided; sanitizes all header fields against CRLF injection
- Promote endpoint validates source/target classes exist and aren't the same
- Google OAuth tokens auto-refresh when expired using refresh token
- Slack scanner gracefully handles missing SLACK_BOT_TOKEN (logs warning, skips scan)
