# PULSE

## Overview
PULSE is a space-themed, multi-user AI-powered attendance email processing tool that categorizes student/builder absence excuses and generates reports for bulk system updates. Users register/log in with username and password to manage their own attendance records. The app features a dark space aesthetic with animated star fields and violet/indigo accent colors.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + Shadcn UI (wouter for routing)
- **Backend**: Express.js + PostgreSQL (Drizzle ORM) + OpenAI AI Integrations
- **AI**: Uses Replit AI Integrations (OpenAI gpt-5.2) for excuse categorization
- **Auth**: Session-based auth with bcrypt password hashing, express-session + connect-pg-simple
- **Theme**: Dark space theme with animated star field, violet/indigo gradients, Space Grotesk font

## Key Features
- User registration and login (session-based authentication)
- Manual email entry with AI categorization
- Batch processing (JSON or CSV upload)
- 6 excuse categories: Sick/Medical, Personal, Program Event, Technical Issue, Other, Unexcused
- Time-period filtering: Day, Week, Month, Quarter, Year with print support
- CSV and DOCX export (per-user data)
- Category filtering and inline category editing
- Real-time SSE streaming for batch processing progress
- Print-friendly view for all time periods

## Project Structure
```
shared/schema.ts          - Data models (users, attendanceRecords tables)
server/db.ts              - Database connection (Neon PostgreSQL)
server/auth.ts            - Authentication setup (session, login, register, logout)
server/storage.ts         - CRUD operations (DatabaseStorage)
server/routes.ts          - API endpoints (all protected by requireAuth)
server/openai.ts          - AI categorization logic
client/src/App.tsx         - App root with auth-gated routing
client/src/hooks/use-auth.ts    - Auth hook (login, register, logout, user state)
client/src/pages/auth.tsx       - Login/Register page (space themed)
client/src/pages/dashboard.tsx  - Main dashboard with time filters, stats, table
client/src/pages/not-found.tsx  - 404 error page
client/src/components/star-field.tsx       - Animated star background
client/src/components/records-table.tsx    - Records data table (print-friendly)
client/src/components/add-email-dialog.tsx - Single email form
client/src/components/batch-upload-dialog.tsx - Batch processing
```

## API Endpoints
### Auth
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Sign in
- `POST /api/auth/logout` - Sign out
- `GET /api/auth/me` - Current user info

### Records (all require auth)
- `GET /api/records` - List user's attendance records
- `GET /api/stats` - Category counts for user
- `POST /api/process-emails` - Process emails with AI (SSE)
- `PATCH /api/records/:id/category` - Update category
- `DELETE /api/records/:id` - Delete record
- `GET /api/export/csv` - Download CSV report
- `GET /api/export/doc` - Download DOCX report

## Database
- PostgreSQL via Neon
- Tables: `users`, `attendance_records` (with user_id FK), `session` (auto-created by connect-pg-simple)
- Managed with Drizzle ORM, push with `npm run db:push`

## Environment
- SESSION_SECRET - Used for express-session cookie signing
- DATABASE_URL - PostgreSQL connection string
- Gmail connector was declined by user; auth is username/password based
