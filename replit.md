# PULSE

## Overview
PULSE is a space-themed, multi-tenant AI-powered attendance management system. It processes student/builder absence and tardiness emails using a dual-classification system (attendanceType + excuseCategory), supports multiple roles (Admin/Instructor), cohorts (L1, L2, L3, L∞), student rosters, class schedules, automated Gmail scanning at configured times, and an alert system for urgent/action-needed emails. Features a dark space aesthetic with animated star fields and violet/indigo accent colors.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + Shadcn UI (wouter for routing, @tanstack/react-query)
- **Backend**: Express.js + PostgreSQL (Drizzle ORM) + OpenAI AI Integrations
- **AI**: Multi-LLM fallback system using Replit AI Integrations (OpenAI): tries gpt-5-nano (cheapest) → gpt-5-mini → gpt-5.2 (most capable). Performs dual-classification (attendanceType + excuseCategory), alert detection (needsResponse, urgency, alertReason), and peer/school mention detection (mentionsStudent, mentionsSchool, peerOrSchoolDetail)
- **Auth**: Session-based auth with bcrypt, express-session + connect-pg-simple; Google OAuth for sign-in + Gmail access; role-based access (admin/instructor)
- **Theme**: Dark/light mode with ThemeProvider (localStorage persistence); dark mode: full star field (120 stars), light mode: subtle corner sparkles (20 sparkles); CSS variables in :root (light) and .dark (dark); Tailwind darkMode: ["class"]
- **Scheduler**: Interval-based scanner (every 30s) checking configured scan times; auto-fetches Gmail, processes emails, creates alerts

## Key Features
- Multi-tenant with roles: Admin (sees all) and Instructor (sees own cohorts)
- Cohort management: L1, L2, L3, L∞ with instructor assignments
- Student roster with per-student attendance history and profile view
- Student status tracking: Active, Graduated, Hired (status column on students table)
- Class progression: bulk promote entire class (all active students move to target class), move individual students between classes
- Class schedule management (weekly grid per cohort)
- Dual classification: attendanceType (Absent/Late-Tardy/Unexcused) + excuseCategory (Sick-Medical/Personal/Program Event/Technical Issue/Other/None)
- Alert system for emails needing response (urgency: low/medium/high), peer mentions (student-about-student), and school/program reports (about Pursuit, classes, curriculum, instructors)
- Multi-LLM fallback: nano → mini → full model chain to minimize costs; escalates only on low confidence or failure
- Automated Gmail scanning at configurable times (default: 10:00 AM, 6:25 PM, 9:55 PM)
- Google OAuth sign-in with Gmail inbox reading
- Manual email entry, batch processing (JSON/CSV), Gmail fetch
- Time-period filtering, CSV/DOCX/JSON export, print support
- Sidebar navigation with alert badge count

## Project Structure
```
shared/schema.ts          - Data models (users, cohorts, students, schedules, attendanceRecords, alerts, scanConfigs)
server/db.ts              - Database connection (Neon PostgreSQL)
server/auth.ts            - Auth setup (session, login, register, logout, demo with seeding)
server/google-auth.ts     - Google OAuth routes (sign-in, callback, Gmail fetch)
server/storage.ts         - Full CRUD operations (IStorage interface + DatabaseStorage)
server/routes.ts          - API endpoints with role-based middleware
server/openai.ts          - AI dual-classification + alert detection
server/scheduler.ts       - Automated email scanning scheduler
client/src/App.tsx         - App root with sidebar layout, auth gating, routing
client/src/hooks/use-auth.ts    - Auth hook (login, register, logout, user state, role helpers)
client/src/components/app-sidebar.tsx  - Sidebar navigation with role-based items + alert badge
client/src/components/star-field.tsx   - Animated star background
client/src/components/theme-provider.tsx - Dark/light mode context
client/src/components/records-table.tsx  - Records data table (print-friendly)
client/src/components/add-email-dialog.tsx - Single email form
client/src/components/batch-upload-dialog.tsx - Batch processing
client/src/components/gmail-fetch-dialog.tsx  - Gmail inbox search
client/src/pages/dashboard.tsx  - Dashboard with stats, time filters, records, cohort filter (admin)
client/src/pages/students.tsx   - Student roster + student profile with attendance history
client/src/pages/schedule.tsx   - Weekly schedule grid per cohort
client/src/pages/alerts.tsx     - Alert feed with urgency badges, mark read
client/src/pages/admin-cohorts.tsx - Admin cohort management + instructor assignment
client/src/pages/instructors.tsx   - Admin instructor list
client/src/pages/settings.tsx   - Scan schedule config, account info, Google connection
client/src/pages/auth.tsx       - Login/Register page (space themed, Google sign-in)
```

## API Endpoints
### Auth
- `POST /api/auth/register` - Create account (with role)
- `POST /api/auth/login` - Sign in
- `POST /api/auth/logout` - Sign out
- `POST /api/auth/demo` - Demo login (admin + seeded cohorts, students, schedule, records, alerts)
- `GET /api/auth/me` - Current user info (includes role, googleId)
- `GET /api/auth/google` - Initiate Google OAuth flow
- `GET /api/auth/google/callback` - Google OAuth callback

### Cohorts & Students
- `GET/POST/PATCH/DELETE /api/cohorts` - Cohort CRUD (admin: all, instructor: own)
- `GET/POST/PATCH/DELETE /api/students` - Student CRUD (admin: all, instructor: own cohorts); PATCH supports status and cohortId changes
- `GET /api/students/:id` - Student profile with attendance records
- `POST /api/cohorts/:id/promote` - Bulk promote all active students to target class (admin only)
- `GET /api/instructors` - List all instructors (admin only)

### Schedules
- `GET /api/schedules/:cohortId` - Schedule for a cohort
- `POST/PATCH/DELETE /api/schedules` - Schedule CRUD

### Alerts
- `GET /api/alerts` - User's alerts (admin: all alerts)
- `GET /api/alerts/unread-count` - Unread count
- `PATCH /api/alerts/:id/read` - Mark alert read
- `POST /api/alerts/mark-all-read` - Mark all read

### Scan Configs
- `GET/POST/PATCH/DELETE /api/scan-configs` - Scan schedule CRUD

### Records & Export (with cohort ownership checks for instructors)
- `GET /api/records` - Records (supports ?cohortId, ?studentId filters)
- `GET /api/stats` - Category counts (supports ?cohortId)
- `POST /api/process-emails` - Process emails with AI (SSE streaming)
- `GET /api/export/csv|doc|json` - Export reports

## Database
- PostgreSQL via Neon
- 7 Tables: `users` (with role, google fields), `cohorts`, `students`, `schedules`, `attendance_records` (with attendanceType, excuseCategory, needsResponse, urgency, alertReason), `alerts`, `scan_configs`, `session`
- Managed with Drizzle ORM

## Demo Account
- Username: `demo`, role: admin — seeds 2 instructors, 4 cohorts, 12 students, schedule entries, 7 attendance records, 2 alerts
- Instructor accounts: instructor_smith (L1/L2), instructor_jones (L3/L∞)

## Important User Preferences
- Do NOT tone down sparkle intensity — keep scale(2), strong box-shadows, anim-sparkle at full intensity
- Star field: 120 stars dark mode, 20 corner sparkles light mode

## Environment Secrets
- `SESSION_SECRET` - express-session cookie signing
- `DATABASE_URL` - PostgreSQL connection string
- `PULSE_GOOGLE_CLIENT_ID` - Google OAuth client ID
- `PULSE_GOOGLE_CLIENT_SECRET` - Google OAuth client secret
