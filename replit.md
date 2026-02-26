# Attendance Automator

## Overview
Multi-user AI-powered attendance email processing tool that categorizes student absence excuses and generates reports for bulk system updates. Users register/log in with username and password to manage their own attendance records.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + Shadcn UI (wouter for routing)
- **Backend**: Express.js + PostgreSQL (Drizzle ORM) + OpenAI AI Integrations
- **AI**: Uses Replit AI Integrations (OpenAI gpt-5.2) for excuse categorization
- **Auth**: Session-based auth with bcrypt password hashing, express-session + connect-pg-simple

## Key Features
- User registration and login (session-based authentication)
- Manual email entry with AI categorization
- Batch processing (JSON or CSV upload)
- 6 excuse categories: Sick/Medical, Personal, Program Event, Technical Issue, Other, Unexcused
- CSV and DOCX export (per-user data)
- Category filtering and inline category editing
- Real-time SSE streaming for batch processing progress

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
client/src/pages/auth.tsx       - Login/Register page
client/src/pages/dashboard.tsx  - Main dashboard page
client/src/components/records-table.tsx     - Records data table
client/src/components/add-email-dialog.tsx  - Single email form
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
