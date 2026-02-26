# Attendance Automator

## Overview
AI-powered attendance email processing tool that categorizes student absence excuses and generates reports for bulk system updates.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + Shadcn UI (wouter for routing)
- **Backend**: Express.js + PostgreSQL (Drizzle ORM) + OpenAI AI Integrations
- **AI**: Uses Replit AI Integrations (OpenAI gpt-5.2) for excuse categorization

## Key Features
- Manual email entry with AI categorization
- Batch processing (JSON or CSV upload)
- 5 excuse categories: Medical, Academic, Personal/Family, Technical/Other, Unexcused
- CSV and DOCX export
- Category filtering and inline category editing
- Real-time SSE streaming for batch processing progress

## Project Structure
```
shared/schema.ts          - Data models (attendanceRecords table)
server/db.ts              - Database connection (Neon PostgreSQL)
server/storage.ts         - CRUD operations (DatabaseStorage)
server/routes.ts          - API endpoints
server/openai.ts          - AI categorization logic
server/seed.ts            - Development seed data
client/src/pages/dashboard.tsx     - Main dashboard page
client/src/components/records-table.tsx     - Records data table
client/src/components/add-email-dialog.tsx  - Single email form
client/src/components/batch-upload-dialog.tsx - Batch processing
```

## API Endpoints
- `GET /api/records` - List all attendance records
- `GET /api/stats` - Category counts
- `POST /api/process-emails` - Process emails with AI (SSE)
- `PATCH /api/records/:id/category` - Update category
- `DELETE /api/records/:id` - Delete record
- `GET /api/export/csv` - Download CSV report
- `GET /api/export/doc` - Download DOCX report

## Database
- PostgreSQL via Neon
- Single table: `attendance_records`
- Managed with Drizzle ORM, push with `npm run db:push`
