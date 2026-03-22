# PULSE — Project Documentation

**Multi-Tenant Attendance Automation Tool for Pursuit**
**Version:** 6.0
**Last Updated:** March 22, 2026

---

## Table of Contents

1. [Product Requirements Document (PRD)](#1-product-requirements-document-prd)
2. [Architecture Overview](#2-architecture-overview)
3. [Entity-Relationship Diagram (ERD)](#3-entity-relationship-diagram-erd)
4. [Technical Requirements Document (TRD)](#4-technical-requirements-document-trd)
5. [Wireframes](#5-wireframes)
6. [System Tools & Requirements](#6-system-tools--requirements)
7. [User Flow](#7-user-flow)
8. [Conditional Logic Trees](#8-conditional-logic-trees)
9. [Full Project Report](#9-full-project-report)
10. [Project Roadmap](#10-project-roadmap)

---

## 1. Product Requirements Document (PRD)

### 1.1 Product Overview

PULSE is a space-themed, multi-tenant AI-powered attendance automation tool designed for Pursuit (tech training program). It processes student absence and tardiness messages from **Gmail AND Slack** using a hybrid dual-classification system (attendance type + excuse reason), supports role-based access (Admin/Instructor), class management (L1, L2, L3, L∞), student rosters with status tracking (Active/Graduated/Hired), alternate email matching, Slack user ID matching, class progression, weekly class schedules, automated scanning at configurable times with **per-source control** (Gmail/Slack independently per time slot), an alert system for urgent student messages, direct email/Slack reply from the portal, LMS integration for grade sync, and AI draft reply generation. The application features Google OAuth integration for Gmail inbox reading and sending, Slack Bot Token integration for channel/DM scanning, a hybrid keyword + OpenAI AI classifier for cost optimization, time-period filtering, export/print capabilities, and a dark/light mode toggle with animated star field.

### 1.2 Problem Statement

Program administrators and instructors spend significant time manually reading, sorting, and responding to student absence and tardiness messages across multiple classes and channels. Students communicate through email, Slack channels, and DMs, making it difficult to track attendance comprehensively. PULSE automates this process by ingesting messages from Gmail and Slack (manually, in batch, directly from Gmail, or via automated scanning), using AI to classify both the attendance type and excuse reason, detecting alerts for messages that need instructor response, and presenting the data in a filterable, exportable, role-scoped dashboard.

### 1.3 Target Users

| Role | Description | Access Level |
|---|---|---|
| **Admin** | Program administrators and coordinators | Full access: all classes, all students, all instructors, system configuration |
| **Instructor** | Teaching staff assigned to specific classes | Scoped access: own classes and students only |

### 1.4 Core Features

| Feature | Description |
|---|---|
| **Multi-Tenant Roles** | Admin sees everything; Instructor sees only their assigned classes and students |
| **Class Management** | L1, L2, L3, L∞ classes with instructor assignment; admin can create/edit/delete |
| **Student Roster** | Per-class student lists with status tracking (Active/Graduated/Hired); per-student attendance history and profile view |
| **Alternate Emails** | Each student can have multiple alternate email addresses; all are matched during Gmail/Slack scanning |
| **Slack User ID** | Students can have a Slack user ID for direct DM matching in Slack scans |
| **Student Import** | Import students via CSV text, JSON, or from unmatched senders already in records; supports name/email/cohort/slackUserId fields |
| **Class Progression** | Bulk promote all active students in a class to a target class; individually move students between classes |
| **Dual-Classification AI** | Every message classified on two axes: Attendance Type (Absent, Late/Tardy, Unexcused) + Excuse Category (Medical, Family, Administrative, Technical, Networking, Other, Unexcused) |
| **Hybrid AI Classification** | Cost-optimized two-stage system: keyword pre-classifier runs first (free, no API call) → handles ~80% of emails; OpenAI (`gpt-4o-mini` → `gpt-4o` fallback) handles ambiguous cases only |
| **Roster-Only Scanning** | Gmail and Slack scans skip all non-roster senders before any AI call — only emails/messages from enrolled students trigger classification |
| **Alert Detection** | AI flags emails needing instructor response (questions, special requests, urgent matters); urgency levels (low/medium/high); peer mention detection; school/program mention detection |
| **Alert Management** | Alert feed with mark read/unread, urgency color-coding, full message body detail view, unread count badge in sidebar |
| **Reply from Portal** | Compose and send replies to student emails (via connected Gmail) or Slack messages (via Bot Token) directly from the Dashboard or Alerts page; AI draft generation available |
| **Assessment Actions** | Per-record recommended action: excuse / makeup_allowed / zero_out / none — set by AI, editable by instructor |
| **LMS Integration** | Connect to Agilix Buzz, D2L Brightspace, Canvas, Blackboard, or custom LMS; sync attendance actions; track sync status per record |
| **Automated Multi-Source Scanning** | Scheduler checks every 30 seconds for configured scan times; auto-fetches and processes messages from Gmail and/or Slack; per-source toggles (Gmail/Slack) per scan time; default times: 10:00 AM, 2:00 PM, 6:25 PM, 8:00 PM, 9:55 PM |
| **Slack Scanning** | Scans configured Slack channels and DMs for attendance-related keywords using SLACK_BOT_TOKEN; processes through same AI classification as Gmail; matches senders to student roster via email, alternate emails, Slack user ID, or name |
| **Multi-Source Dashboard** | Source filter buttons (Gmail/Slack) on Dashboard; source column in records table with icons; source-specific detail in record dialog |
| **Manual Email Entry** | Single email form with sender name, email, date, and body |
| **Batch Upload** | Paste or upload JSON/CSV with multiple emails; processed with real-time SSE streaming |
| **Gmail Fetch** | OAuth 2.0 + Gmail API to search, select, and process emails directly from inbox |
| **Attendance Type Filter Buttons** | Dashboard Records section has All/Absent/Late-Tardy/Unexcused toggle buttons with counts |
| **Needs Review Filter** | Filter button appears when low-confidence AI records exist; shows count of records needing manual review |
| **Needs Reply Filter** | Filter button appears when records have `needsResponse=true`; shows count needing instructor reply |
| **Urgency Indicators** | Colored dots next to student names in table: rose = high urgency, orange = medium urgency + needs reply |
| **Excuse Category Stat Cards** | Clickable stat cards for each excuse reason; filters combine with type filter buttons |
| **Time-Period Filtering** | Filter records by Today, Week, Month, Quarter, Year, or All Time |
| **Analytics** | Toggleable analytics panel: Attendance Trend chart (by type over time), Reason Breakdown chart (by category), Classification Method breakdown (keyword vs AI confidence tier), Most Absences leaderboard |
| **Auto-Sort** | Records table auto-sorts: Needs Review first → Unexcused → Medical → Family → Administrative → Technical → Networking → Other; newest first within each group |
| **Weekly Schedule** | Per-class weekly grid with time blocks; add/edit/delete schedule entries |
| **CSV/DOCX/JSON Export** | Download attendance reports in multiple formats |
| **Print View** | Respects active time-period filter; hides interactive controls |
| **Dark / Light Mode** | Space-dark theme with 120 animated stars; clean-light theme with 20 corner sparkles |
| **Google OAuth** | Sign-in + Gmail read/send; reconnect button for scope upgrades |
| **Demo Mode** | One-click demo with admin account, 2 instructors, 4 classes, 12 students, sample records |
| **Settings** | Scan schedule config with per-source Gmail/Slack toggles, Slack channel management, LMS connection management, account info, Google connection status |

### 1.5 Attendance Classification System

PULSE uses a dual-classification approach to accurately track attendance:

**Attendance Types** (What happened — was the person present?):
| Type | Meaning | Dashboard Filter Color |
|---|---|---|
| Absent | Student will not attend at all | Rose/Red |
| Late/Tardy | Student will attend but will arrive late, or is leaving early | Orange |
| Unexcused | No valid reason provided or message is not a genuine excuse | Slate/Gray |

**Excuse Categories** (Why — the reason for absence/tardiness):
| Category | Examples | Badge Color |
|---|---|---|
| Medical | Flu, migraine, doctor appointment, hospital, COVID, mental health, surgery | Rose |
| Family | Family emergency, funeral, bereavement, childcare emergency, eldercare | Amber |
| Administrative | Jury duty, court date, legal obligation, immigration appointment, government office | Sky |
| Technical | Internet down, laptop broken, power outage, car broke down, bus delayed, WiFi issues | Violet |
| Networking | Networking event, career fair, demo day, hackathon, fireside chat, conference, alumni event, Luma/Partiful/Eventbrite events, coffee chat, informational interview | Teal |
| Other | Job interview, work conflict, housing emergency, personal emergency, financial situation — legitimate reasons outside other categories | Emerald |
| Unexcused | No valid reason, vague excuses, or not a genuine notification | Slate |

**Important Classification Rules:**
- "running late because I'm sick" → Late/Tardy + Medical
- "won't be in today, have the flu" → Absent + Medical
- "can't make it, something came up" (no details) → Unexcused + Unexcused
- "going to a networking event" → Absent + Networking
- "job interview today" → Absent/Late + Other
- Stuck in traffic → Late/Tardy + Technical
- Leaving early for any reason → Late/Tardy

**Dashboard Filtering:**
- **Attendance Type Filter Buttons** (next to Records heading): All, Absent, Late/Tardy, Unexcused — each shows count
- **Excuse Category Stat Cards** (above records): Total + one card per category — clickable to filter
- **Needs Review** button: appears when low-confidence records exist
- **Needs Reply** button: appears when records flagged `needsResponse=true` exist
- All filters combine: e.g., click "Absent" + "Medical" stat card = only Absent/Medical records

### 1.6 Alert & Classifier Output Fields

Every classified record stores these fields from the AI:

| Field | Type | Description |
|---|---|---|
| `attendanceType` | text | Absent, Late/Tardy, or Unexcused |
| `excuseCategory` | text | One of the 7 categories above |
| `aiConfidence` | real (0–1) | How confident the classifier was |
| `aiConfidenceTier` | text | low / medium / high |
| `requiresManualReview` | boolean | True when confidence < 0.4 (keyword classifier never sets this) |
| `needsResponse` | boolean | AI detected a question, request, or urgent matter |
| `urgency` | text | low / medium / high |
| `alertReason` | text | Brief explanation of why a response is needed |
| `mentionsStudent` | boolean | Email mentions another student by name |
| `mentionsSchool` | boolean | Email mentions Pursuit, classes, curriculum, or instructors |
| `peerOrSchoolDetail` | text | Details about the mention |
| `recommendedAssessmentAction` | text | excuse / makeup_allowed / zero_out / none |
| `recommendedAssessmentReason` | text | Why that action was recommended |

### 1.7 Assessment Actions

| Action | Meaning | Default Category Mapping |
|---|---|---|
| `excuse` | Exempt from attendance grade | Medical, Family, Administrative, Networking, Other |
| `makeup_allowed` | Allow makeup work or alternative session | Technical |
| `zero_out` | Student receives zero for attendance grade | Unexcused |
| `none` | No action / instructor to decide | Late/Tardy |

### 1.8 Student Status Tracking

| Status | Description |
|---|---|
| Active | Currently enrolled and attending class |
| Graduated | Completed the program |
| Hired | Placed in employment after program |

- Non-active students appear dimmed in the roster
- Bulk class promotion only moves Active students; Graduated/Hired stay in place
- Individual students can be moved between classes or have their status changed at any time

### 1.9 Non-Functional Requirements

- **Performance**: SSE streaming for batch processing; sub-second UI interactions; keyword pre-classifier eliminates API costs for ~80% of emails
- **Security**: Bcrypt password hashing; session-based auth with PostgreSQL session store; CSRF state for OAuth; per-user data isolation; CRLF header injection prevention on email replies; recipient validation on email sends; cohort ownership checks for instructors; mandatory Slack signature verification on all webhook endpoints
- **Startup**: Fail-fast on missing `SESSION_SECRET` or `DATABASE_URL`; session table created via raw SQL at boot (no file dependency)
- **Accessibility**: WCAG 2 AA contrast, keyboard navigation, semantic elements, ARIA attributes
- **Browser Support**: Modern evergreen browsers (Chrome, Firefox, Safari, Edge)
- **Responsive**: Mobile-first with sidebar collapse; breakpoints at `md` (768px) and `lg` (1024px)

---

## 2. Architecture Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (React + Vite)                        │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐  │
│  │ Auth Page │ │ Dashboard │ │ Students │ │Schedule│ │ Alerts   │  │
│  └────┬─────┘ └─────┬─────┘ └────┬─────┘ └───┬────┘ └────┬─────┘  │
│                                                                      │
│  ┌──────────────┐ ┌──────────┐ ┌─────────┐ ┌─────────┐            │
│  │Admin Cohorts │ │Instructors│ │Settings │ │Sidebar  │            │
│  └──────────────┘ └──────────┘ └─────────┘ └─────────┘            │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │        TanStack Query v5 + Fetch API + apiRequest            │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────────────┘
                              │ HTTP / SSE
┌─────────────────────────────┼───────────────────────────────────────┐
│                        SERVER (Express 5)                           │
│                                                                      │
│  ┌──────────┐  ┌────────────┴──────┐  ┌──────────────────────┐     │
│  │  Auth    │  │   Routes          │  │  Google OAuth         │     │
│  │ (bcrypt, │  │ (CRUD, SSE,      │  │  + Gmail Read/Send   │     │
│  │  session)│  │  role middleware, │  │  + Token Refresh     │     │
│  └──────────┘  │  Slack webhooks) │  └──────────────────────┘     │
│                └───────────────────┘                                │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   Storage Layer (DatabaseStorage)           │    │
│  │  Users, Cohorts, Students, Schedules, Records, Alerts,     │    │
│  │  Scans, SlackChannels, LmsConfigs, LmsSyncLogs             │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                              │                                       │
│  ┌───────────────────────────┴──────────────────────────────────┐   │
│  │              Drizzle ORM  →  PostgreSQL (Supabase)           │   │
│  │              Session pooler: aws-1-us-east-1.pooler.supabase │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────┐  ┌──────────────────────────┐     │
│  │   Hybrid AI Engine           │  │    Scheduler             │     │
│  │   Stage 1: keyword (free)   │  │    (30s interval)        │     │
│  │   Stage 2: gpt-4o-mini      │  │    Gmail + Slack scan    │     │
│  │   Stage 3: gpt-4o fallback  │  └──────────────────────────┘     │
│  └──────────────────────────────┘                                    │
│                                                                      │
│  ┌──────────────────────────────┐  ┌──────────────────────────┐     │
│  │   Slack Scanner              │  │   Migrations             │     │
│  │   Channel + DM scanning     │  │   Idempotent at boot     │     │
│  │   Keyword → AI classify     │  └──────────────────────────┘     │
│  └──────────────────────────────┘                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18, TypeScript | SPA with component-based UI |
| Routing | wouter | Lightweight client-side routing |
| State | TanStack Query v5 | Server state, caching, mutations |
| Styling | Tailwind CSS 3 | Utility-first CSS with dark mode |
| UI Library | shadcn/ui (Radix primitives) | Accessible, customizable components |
| Charts | recharts | Analytics bar charts |
| Icons | lucide-react | Action icons and visual cues |
| Company Logos | react-icons/si | Brand logos (Google, etc.) |
| Build | Vite 5 | HMR, ESBuild transforms |
| Server | Express 5 | REST API + SSE endpoints |
| ORM | Drizzle ORM | Type-safe SQL queries |
| Database | PostgreSQL (Supabase) | Persistent data storage via session pooler |
| Session Store | connect-pg-simple | PostgreSQL-backed sessions; table created via raw SQL at boot |
| Auth | express-session + bcrypt | Session cookies, password hashing, role-based access |
| OAuth | Google OAuth 2.0 | Gmail read/send access, sign-in |
| AI | OpenAI (gpt-4o-mini + gpt-4o) | Dual-tier email classification + alert detection |
| Documents | docx (npm) | DOCX generation |
| Dates | date-fns | Time-period filtering |
| Validation | Zod + drizzle-zod | Schema validation on both client and server |

### 2.3 Directory Structure

```
pulse/
├── client/
│   ├── index.html
│   └── src/
│       ├── main.tsx                       # React entry point
│       ├── App.tsx                        # Router + Providers + Sidebar layout
│       ├── index.css                      # Global styles, star animations, theme vars, print styles
│       ├── pages/
│       │   ├── auth.tsx                   # Login / Register / OAuth / Demo
│       │   ├── dashboard.tsx              # Stats, filters, category cards, analytics, records table
│       │   ├── students.tsx               # Student roster + profile + alternate emails + Slack ID
│       │   ├── schedule.tsx               # Weekly schedule grid per class
│       │   ├── alerts.tsx                 # Alert feed with reply, detail view, mark read/unread
│       │   ├── admin-cohorts.tsx          # Admin class management + instructor assignment + bulk promote
│       │   ├── instructors.tsx            # Admin instructor list
│       │   ├── settings.tsx               # Scan config, Slack channels, LMS connections, Google connect
│       │   └── not-found.tsx              # 404 page
│       ├── components/
│       │   ├── ui/                        # 30+ shadcn/ui components
│       │   ├── app-sidebar.tsx            # Sidebar nav with role-based items + alert badge
│       │   ├── add-email-dialog.tsx       # Manual single email entry
│       │   ├── batch-upload-dialog.tsx    # JSON/CSV batch processing with SSE streaming
│       │   ├── gmail-fetch-dialog.tsx     # Gmail inbox search + select
│       │   ├── student-import-dialog.tsx  # Bulk student import (CSV/JSON/from records)
│       │   ├── records-table.tsx          # Data table with auto-sort, inline editing, reply panel
│       │   ├── star-field.tsx             # Animated star/sparkle background
│       │   └── theme-provider.tsx         # Dark/Light mode context
│       ├── hooks/
│       │   ├── use-auth.ts               # Auth state hook with isAdmin helper
│       │   ├── use-mobile.tsx            # Responsive breakpoint hook
│       │   └── use-toast.ts              # Toast notification hook
│       └── lib/
│           ├── queryClient.ts            # TanStack Query config + apiRequest helper
│           └── utils.ts                  # cn() utility
├── server/
│   ├── index.ts                          # Express bootstrap; fail-fast env check; runMigrations; startScheduler
│   ├── auth.ts                           # Login/register/demo/session; creates session table via raw SQL
│   ├── google-auth.ts                    # OAuth 2.0 flow + Gmail read/send + token refresh
│   ├── routes.ts                         # All CRUD endpoints with role middleware + Slack signature verification
│   ├── openai.ts                         # Hybrid AI: keyword pre-classifier + OpenAI dual-tier
│   ├── storage.ts                        # DatabaseStorage implementing full IStorage interface
│   ├── scheduler.ts                      # Automated scanning scheduler (30s interval, Gmail + Slack)
│   ├── slack-scanner.ts                  # Slack channel/DM scanner (keyword match → AI classify)
│   ├── migrations.ts                     # Idempotent SQL migrations run at every boot
│   ├── db.ts                             # Drizzle + pg pool (Supabase session pooler)
│   ├── vite.ts                           # Vite dev middleware (development only)
│   └── static.ts                         # Static file serving (production)
├── shared/
│   └── schema.ts                         # Drizzle schema, Zod schemas, types, constants
├── tests/
│   ├── openai.test.ts                    # AI classifier unit tests
│   ├── google-auth.test.ts               # OAuth flow tests
│   └── lms-integration.test.ts           # LMS sync tests
├── docs/
│   └── PROJECT_DOCUMENTATION.md         # This file
├── vitest.config.ts
├── drizzle.config.ts
├── tailwind.config.ts
├── vite.config.ts
├── tsconfig.json
├── render.yaml
├── components.json
└── package.json
```

### 2.4 Data Flow

1. **Message Ingestion**: Message arrives via manual entry, batch upload, Gmail fetch, automated Gmail scan, or Slack scan
2. **Roster Check**: Sender email/alternateEmails/slackUserId matched against enrolled student roster — non-roster senders skipped entirely (free)
3. **Hybrid Classification**:
   - Stage 1: Keyword pre-classifier checks for clear signals (free, ~80% of cases)
   - Stage 2: gpt-4o-mini for ambiguous emails
   - Stage 3: gpt-4o escalation if mini confidence < 0.4
   - Returns: attendance type, excuse category, confidence, urgency, alert flags, assessment action
4. **Storage**: Record persisted in PostgreSQL; if `needsResponse=true`, alert record also created
5. **SSE Streaming**: For batch processing, each result streamed to client as it completes
6. **Dashboard**: TanStack Query fetches records scoped by role; records auto-sorted client-side
7. **Filtering**: Type buttons + category stat cards + time-period + Needs Review + Needs Reply all combine
8. **Analytics**: Client-computed from fetched records: trend chart, reason breakdown, classification method, leaderboard
9. **Alerts**: Flagged messages appear in alert feed; instructor can reply via Gmail or Slack directly
10. **LMS Sync**: Instructor selects action, POST triggers sync to configured LMS, result stored in lms_sync_logs

---

## 3. Entity-Relationship Diagram (ERD)

### 3.1 Database Schema

```
┌─────────────────────────────────┐       ┌──────────────────────────────────┐
│            users                │       │           scan_configs           │
├─────────────────────────────────┤       ├──────────────────────────────────┤
│ id             SERIAL PK        │──┐    │ id            SERIAL PK          │
│ username       TEXT NOT NULL UQ │  │    │ user_id       INT NOT NULL FK    │──→ users.id
│ email          TEXT NOT NULL UQ │  │    │ scan_time     TEXT NOT NULL      │
│ password       TEXT NOT NULL    │  │    │ enabled       BOOLEAN DEFAULT T  │
│ display_name   TEXT NOT NULL    │  │    │ scan_gmail    BOOLEAN DEFAULT T  │
│ role           TEXT DEFAULT     │  │    │ scan_slack    BOOLEAN DEFAULT T  │
│                'instructor'     │  │    │ created_at    TIMESTAMP          │
│ google_id      TEXT UQ          │  │    └──────────────────────────────────┘
│ google_access_token  TEXT       │  │
│ google_refresh_token TEXT       │  │    ┌──────────────────────────────────┐
│ slack_user_id  TEXT             │  │    │       slack_channel_configs      │
│ created_at     TIMESTAMP        │  │    ├──────────────────────────────────┤
└─────────────────────────────────┘  │    │ id            SERIAL PK          │
         │                           │    │ cohort_id     INT NOT NULL FK    │──→ cohorts.id
         │ 1:N (instructor_id)       │    │ channel_id    TEXT NOT NULL      │
         ▼                           │    │ channel_name  TEXT NOT NULL      │
┌─────────────────────────────────┐  │    │ enabled       BOOLEAN DEFAULT T  │
│           cohorts               │  │    │ slack_bot_token TEXT             │
├─────────────────────────────────┤  │    │ created_at    TIMESTAMP          │
│ id             SERIAL PK        │  │    └──────────────────────────────────┘
│ name           TEXT NOT NULL    │  │
│ instructor_id  INT NOT NULL FK  │──┘    ┌──────────────────────────────────┐
│ created_at     TIMESTAMP        │       │            alerts                │
└─────────────────────────────────┘       ├──────────────────────────────────┤
         │                                │ id            SERIAL PK          │
         │ 1:N (cohort_id)               │ user_id       INT NOT NULL FK    │──→ users.id
         ├──────────────┐                 │ record_id     INT NOT NULL FK    │──→ attendance_records.id
         ▼              ▼                 │ alert_type    TEXT NOT NULL      │
┌──────────────────┐ ┌──────────────────┐ │ message       TEXT NOT NULL      │
│    students      │ │   schedules      │ │ urgency       TEXT DEFAULT 'low' │
├──────────────────┤ ├──────────────────┤ │ is_read       BOOLEAN DEFAULT F  │
│ id     SERIAL PK │ │ id     SERIAL PK │ │ created_at    TIMESTAMP          │
│ name   TEXT NN   │ │ cohort_id INT FK │ └──────────────────────────────────┘
│ email  TEXT NN   │ │ day_of_week INT  │
│ cohort_id INT FK │ │ start_time TEXT  │ ┌──────────────────────────────────┐
│ status TEXT      │ │ end_time   TEXT  │ │          lms_configs             │
│  DEFAULT 'Active'│ │ label      TEXT  │ ├──────────────────────────────────┤
│ alternate_emails │ │ created_at TS    │ │ id            SERIAL PK          │
│   TEXT[]        │ └──────────────────┘ │ user_id       INT NOT NULL FK    │──→ users.id
│ slack_user_id    │                      │ lms_type      TEXT NOT NULL      │
│   TEXT          │                      │ api_url       TEXT NOT NULL      │
│ created_at TS   │                      │ api_key       TEXT NOT NULL      │
└──────────────────┘                     │ api_secret    TEXT               │
         │                               │ institution_id TEXT              │
         │ 1:N (student_id, nullable)    │ enabled       BOOLEAN DEFAULT T  │
         ▼                               │ sync_attendance BOOLEAN DEFAULT T│
┌──────────────────────────────────────────────────────────┐ │ default_assessment_action TEXT│
│              attendance_records                          │ │ created_at    TIMESTAMP      │
├──────────────────────────────────────────────────────────┤ │ updated_at    TIMESTAMP      │
│ id                     SERIAL PK                         │ └──────────────────────────────┘
│ user_id                INT NOT NULL FK  ──→ users.id     │
│ student_id             INT FK (nullable) ──→ students.id │ ┌──────────────────────────────┐
│ sender_name            TEXT NOT NULL                     │ │         lms_sync_logs        │
│ sender_email           TEXT NOT NULL                     │ ├──────────────────────────────┤
│ received_at            TIMESTAMP NOT NULL                │ │ id           SERIAL PK       │
│ email_body             TEXT NOT NULL                     │ │ record_id    INT NOT NULL FK │──→ attendance_records.id
│ attendance_type        TEXT NOT NULL DEFAULT 'Absent'    │ │ lms_config_id INT NOT NULL FK│──→ lms_configs.id
│ excuse_category        TEXT NOT NULL                     │ │ sync_type    TEXT NOT NULL   │
│ message_snippet        TEXT NOT NULL                     │ │ sync_status  TEXT NOT NULL   │
│ status                 TEXT NOT NULL DEFAULT 'pending'   │ │ lms_response TEXT            │
│ batch_id               TEXT                              │ │ error_message TEXT           │
│ needs_response         BOOLEAN DEFAULT FALSE             │ │ synced_at    TIMESTAMP       │
│ urgency                TEXT DEFAULT 'low'                │ └──────────────────────────────┘
│ alert_reason           TEXT                              │
│ mentions_student       BOOLEAN DEFAULT FALSE             │
│ mentions_school        BOOLEAN DEFAULT FALSE             │
│ peer_or_school_detail  TEXT                              │
│ gmail_message_id       TEXT                              │
│ gmail_thread_id        TEXT                              │
│ source                 TEXT NOT NULL DEFAULT 'gmail'     │
│ email_subject          TEXT                              │
│ slack_channel_id       TEXT                              │
│ slack_channel_name     TEXT                              │
│ slack_message_ts       TEXT                              │
│ slack_is_dm            BOOLEAN DEFAULT FALSE             │
│ requires_manual_review BOOLEAN DEFAULT FALSE             │
│ ai_confidence          REAL                              │
│ ai_confidence_tier     TEXT                              │
│ assessment_action      TEXT                              │
│ recommended_assessment_action TEXT                       │
│ recommended_assessment_reason TEXT                       │
│ lms_synced             BOOLEAN DEFAULT FALSE             │
│ lms_sync_status        TEXT                              │
│ created_at             TIMESTAMP                         │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Table Count: 12

| Table | Purpose |
|---|---|
| users | User accounts with role, Google OAuth tokens, Slack user ID |
| cohorts | Classes (L1, L2, L3, L∞) with instructor assignment |
| students | Student roster with class assignment, status, alternate emails, Slack user ID |
| schedules | Weekly time blocks per class |
| attendance_records | Processed records with dual classification, AI metadata, assessment actions, LMS sync status |
| alerts | Flagged records needing instructor attention |
| scan_configs | Automated scan schedule per user with per-source toggles (scanGmail, scanSlack) |
| slack_channel_configs | Slack channel-to-class mapping with optional per-channel bot token |
| lms_configs | LMS connection credentials and settings per user |
| lms_sync_logs | Audit log of every LMS sync operation |
| session | Express session storage (created via raw SQL at boot, managed by connect-pg-simple) |

### 3.3 Key Field Descriptions

**students — new fields**
| Field | Type | Description |
|---|---|---|
| alternate_emails | TEXT[] | Array of alternate email addresses to match during scanning |
| slack_user_id | TEXT | Slack member ID (U...) for DM matching |

**attendance_records — new fields vs v5**
| Field | Type | Description |
|---|---|---|
| requires_manual_review | BOOLEAN | True when AI confidence < 0.4; triggers ⚠ icon and Needs Review filter |
| ai_confidence | REAL | Raw confidence score (0–1) from classifier |
| ai_confidence_tier | TEXT | low / medium / high; null when classified by keyword (free) |
| assessment_action | TEXT | Current action applied: excuse / makeup_allowed / zero_out / none |
| recommended_assessment_action | TEXT | AI's recommended action at classification time |
| recommended_assessment_reason | TEXT | AI's reasoning for the recommended action |
| lms_synced | BOOLEAN | Whether record has been synced to an LMS |
| lms_sync_status | TEXT | success / failed / pending |

**lms_configs**
| Field | Type | Description |
|---|---|---|
| lms_type | TEXT | agilix_buzz / d2l_brightspace / canvas / blackboard / custom |
| api_url | TEXT | Base URL of the LMS API |
| api_key | TEXT | API key or client ID |
| api_secret | TEXT | API secret (optional, depends on LMS) |
| institution_id | TEXT | Institution or org identifier |
| default_assessment_action | TEXT | Default action to apply when syncing |

### 3.4 Relationships

```
users 1:N → cohorts (instructor_id)
users 1:N → attendance_records (user_id)
users 1:N → alerts (user_id)
users 1:N → scan_configs (user_id)
users 1:N → lms_configs (user_id)
cohorts 1:N → students (cohort_id)
cohorts 1:N → schedules (cohort_id)
cohorts 1:N → slack_channel_configs (cohort_id)
students 1:N → attendance_records (student_id, nullable)
attendance_records 1:N → alerts (record_id)
attendance_records 1:N → lms_sync_logs (record_id)
lms_configs 1:N → lms_sync_logs (lms_config_id)
```

---

## 4. Technical Requirements Document (TRD)

### 4.1 Authentication & Authorization

**Username/Password Authentication**
- Registration: username (3+ chars), email (valid format), password (6+ chars), display name, role selection (admin/instructor)
- Login: username + password validated against bcrypt hash
- Session: `express-session` with `connect-pg-simple` for PostgreSQL-backed sessions
- Session table: created via `CREATE TABLE IF NOT EXISTS` raw SQL at server startup — no dependency on `table.sql` file (which fails when esbuild bundles the package)
- Session secret: `SESSION_SECRET` environment variable (required; fail-fast if missing)
- Cookie: `httpOnly: true`, `secure: true` in production, `sameSite: lax`
- Trust proxy: `app.set("trust proxy", 1)` required for Render (reverse proxy HTTPS)

**Role-Based Access Control**
- `requireAuth` middleware: blocks unauthenticated requests with 401
- `requireAdmin` middleware: blocks non-admin requests with 403
- Instructor middleware: enforces cohort ownership checks
- Admin bypass: admins can access all data across all classes and instructors

**Google OAuth 2.0**
- Scopes: `openid`, `userinfo.email`, `userinfo.profile`, `gmail.readonly`, `gmail.send`
- Flow: Authorization Code with `access_type: offline`, `prompt: consent`
- CSRF: Random `state` parameter stored in session; verified on callback
- Token storage: Access and refresh tokens persisted in `users` table
- Auto-refresh: Expired access tokens refreshed via refresh token on 401 responses
- Reconnect: Settings page has "Reconnect Google Account" button for scope upgrades
- Environment variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (fallback: `PULSE_GOOGLE_CLIENT_ID`, `PULSE_GOOGLE_CLIENT_SECRET`)
- Debug endpoint: `GET /api/auth/google/debug` — only available when `NODE_ENV !== "production"`

**Session Race Condition Fix**
- All session writes (login, register, demo, OAuth callback) use explicit `req.session.save()` before responding or redirecting
- Without this, the async session write races the HTTP response on Render and cookies are never set

**Demo Mode**
- Username: `demo`, role: admin
- Auto-seeds: 2 instructor accounts, 4 cohorts (L1/L2/L3/L∞), 12 students, schedule entries, sample attendance records with correct current category names, scan configs
- No Google ID attached (Gmail features unavailable in demo)

### 4.2 Hybrid AI Classification Engine

**Design**: Two-stage system minimizes OpenAI costs — ~80% of emails classified by keyword pre-classifier for free; only ambiguous cases hit OpenAI.

**Stage 1 — Keyword Pre-Classifier** (free, zero API calls):
- Detects absence/late attendance type via keyword lists (`won't be`, `running late`, etc.)
- Scores against Medical / Family / Administrative / Technical / Networking / Other keyword sets
- Returns result on ≥1 category hit; `confidence = min(0.72 + hits×0.04, 0.92)`; `aiConfidenceTier = null` (indicates keyword path)

**Keyword Map (signal phrases)**:
| Category | Key phrases |
|---|---|
| Medical | sick, ill, fever, flu, covid, hospital, ER, urgent care, doctor, dentist, surgery, therapy, migraine, food poisoning, injured, medication, quarantine, vomiting, nausea, not feeling well |
| Family | family emergency, funeral, memorial, passed away, died, bereavement, family crisis, relative hospitalized, childcare, eldercare, death in the family |
| Administrative | jury duty, subpoena, court date, legal obligation, immigration, visa appointment, government office, DMV, passport, tribunal, deposition |
| Technical | internet down, no internet, wifi, power outage, laptop broken, computer crashed, car broke down, vehicle trouble, train cancelled, bus delayed, can't log in, connection issues |
| Networking | luma, partiful, eventbrite, networking event, mixer, gala, pitch competition, demo day, hackathon, career fair, job fair, tech talk, fireside chat, panel discussion, conference, alumni event, coffee chat, informational interview, professional development |
| Other | job interview, work conflict, called into work, work emergency, housing, locked out, eviction, no heat, financial, personal emergency |

**Stage 2 — OpenAI Fallback** (ambiguous emails only):
| Tier | Model | When Used |
|---|---|---|
| mini | gpt-4o-mini | First OpenAI attempt (lower cost) |
| full | gpt-4o | Escalation if mini confidence < 0.4 or error |

**Confidence Thresholds**:
- `< 0.4` (low): `requiresManualReview = true`; escalates to next tier or returns fallback
- `0.4–0.7` (medium): Valid result; Slack alert sent to instructor for oversight
- `> 0.7` (high): Auto-verified

**Roster-Only Pre-filter** (before any classification):
- Matches sender email against student primary email AND `alternateEmails[]`
- Non-roster senders skipped entirely — no keyword check, no AI call, no record created

**Classification Flow**:
```
Incoming email/message
  → Roster check: not enrolled? skip (free)
  → Stage 1 keywords: clear signal? return result (free, tier=null)
  → Stage 2 gpt-4o-mini: confidence >= 0.4? return result (tier=medium/high)
  → Stage 2 gpt-4o: confidence >= 0.4? return result (tier=medium/high)
  → All fail: fallback result with requiresManualReview=true
Medium-confidence AI results → Slack notification to first configured channel
```

**Assessment Action Default Mapping**:
```
Medical / Family / Administrative / Networking / Other → "excuse"
Technical → "makeup_allowed"
Unexcused → "zero_out"
Late/Tardy → "none"
```

### 4.3 Gmail Integration

**OAuth Scopes**: `gmail.readonly` + `gmail.send`

**Default Search Query**:
```
absent OR absence OR excuse OR sick OR cannot attend OR won't be able
OR can't make it OR unable to attend OR not coming OR won't be in
OR missing class OR late OR tardy OR running late OR will be late
OR emergency OR appointment OR called out
```

**Fetch Process**:
1. List message IDs via Gmail API (max 50)
2. Fetch full message details; parse headers (From, Subject, Date, Message-ID)
3. Extract body: prefer `text/plain`, fallback to `text/html` with tag stripping
4. Bulk filtering: skip promotional, marketing, auto-reply, newsletter emails before classification
5. Store `gmail_message_id` and `gmail_thread_id` for threading

**Email Reply (Send)**:
- Endpoint: `POST /api/gmail/send`
- Parameters: to, subject, body, inReplyTo, threadId, alertId
- Security: validates recipient matches original sender; sanitizes all headers against CRLF injection
- Threading: Sets `In-Reply-To` and `References` headers + Gmail `threadId`

### 4.4 Slack Integration

**Scanning**:
- `SLACK_BOT_TOKEN` used for API calls (list channels, fetch history, fetch users)
- Scans configured channels: public messages, thread replies, DMs
- Attendance keywords trigger classification: absence/late keyword detection before any AI call
- Sender matching: slackUserId → primary email → alternateEmails → display name

**Webhooks**:
- `/api/slack/events`: Event subscriptions (attendance keyword detection in real-time)
- `/api/slack/interactions`: Slash commands and interactive components
- Both endpoints enforce mandatory `verifySlackSignature()` using `SLACK_SIGNING_SECRET`
- Slack URL verification challenge (`type: "url_verification"`) bypasses signature check (required for initial app setup)

**Environment Variables**:
- `SLACK_BOT_TOKEN`: Bot OAuth token for API calls
- `SLACK_SIGNING_SECRET`: For webhook signature verification
- `SLACK_CLIENT_ID`, `SLACK_APP_ID`: For app identification

### 4.5 LMS Integration

**Supported Platforms**: Agilix Buzz, D2L Brightspace, Canvas, Blackboard, Custom

**Configuration** (stored in `lms_configs`):
- API URL, API key, API secret, institution ID
- Default assessment action (applied when syncing)
- Enable/disable per connection

**Sync Flow**:
1. Instructor selects action in record detail modal (excuse / makeup_allowed / zero_out / none)
2. POST `/api/records/:id/lms-sync` with `{ action }`
3. Server calls LMS API with attendance action
4. Result stored in `lms_sync_logs`; `attendance_records.lms_synced` and `lms_sync_status` updated
5. UI shows sync status (CheckCircle = synced, XCircle = not synced)

### 4.6 Idempotent Database Migrations

`server/migrations.ts` runs at every server boot via `runMigrations()`:
- `CREATE TABLE IF NOT EXISTS lms_configs`
- `CREATE TABLE IF NOT EXISTS lms_sync_logs`
- `ALTER TABLE students ADD COLUMN IF NOT EXISTS alternate_emails TEXT[]`
- `ALTER TABLE slack_channel_configs ADD COLUMN IF NOT EXISTS slack_bot_token TEXT`

Safe to run repeatedly; uses `IF NOT EXISTS` / `IF NOT EXISTS` semantics.

### 4.7 Automated Scanning (Scheduler)

- `startScheduler()` called on server start
- Checks every **30 seconds** if current time (HH:MM) matches any enabled `scan_config`
- Per-config toggles: `scanGmail` and `scanSlack` independently control which sources are scanned
- Roster pre-filter applied before any classification
- Default scan times for new users: 10:00, 14:00, 18:25, 20:00, 21:55

### 4.8 Export Formats

| Format | Endpoint | Content-Type |
|---|---|---|
| CSV | GET /api/export/csv | text/csv |
| DOCX | GET /api/export/doc | application/vnd.openxmlformats-officedocument.wordprocessingml.document |
| JSON | GET /api/export/json | application/json |

### 4.9 Real-Time Processing (SSE)

Batch email processing uses Server-Sent Events for live progress:

| Event | Payload | Description |
|---|---|---|
| `started` | `{ total, batchId }` | Processing has begun |
| `processing` | `{ index, name }` | Currently processing email |
| `progress` | `{ index, record, categorization }` | Email classified and saved |
| `error` | `{ index, name, error }` | Individual email failed |
| `complete` | `{ total, processed, batchId }` | All emails processed |

---

## 5. Wireframes

### 5.1 Auth Page

```
┌──────────────────────────────────────────────────────────────┐
│  [Star Field Background - 120 stars dark / 20 sparkles light]│
│                                                              │
│                    ⚡ PULSE                                   │
│              Attendance Automator                            │
│                                                              │
│  ┌────────────────────────────────────────────┐              │
│  │  [Login] [Register]                        │              │
│  │  Username / Password / Email / DisplayName │              │
│  │  [ Sign In / Register                 ]    │              │
│  │  ──── OR ────                              │              │
│  │  [ 🔵 Sign in with Google             ]    │              │
│  │  [ ▶  Try Demo                        ]    │              │
│  │              [☀ Light] / [🌙 Dark]         │              │
│  └────────────────────────────────────────────┘              │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 Dashboard

```
┌──────────┬────────────────────────────────────────────────────────────┐
│ Sidebar  │ Dashboard                     [Admin: Class ▼]             │
│          │                               [+ Add Email] [Batch] [Gmail]│
│          │                               [Analytics ▲] [Print] [CSV]  │
│          │                                                             │
│          │ TIME: [All] [Today] [Week] [Month] [Qtr] [Year]           │
│          │                                                             │
│          │ STAT CARDS (clickable):                                     │
│          │ ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐ │
│          │ │Total ││Med   ││Family││Admin ││Tech  ││Net   ││Other ││Unexc│ │
│          │ │  42  ││  12  ││   8  ││   5  ││   4  ││   3  ││   3  ││  7  │ │
│          │ └──────┘└──────┘└──────┘└──────┘└──────┘└──────┘└──────┘└──────┘│
│          │                                                             │
│          │ [ANALYTICS PANEL — when toggled:]                          │
│          │ ┌─ Attendance Trend (bar) ─────┐ ┌─ Most Absences ───────┐ │
│          │ │ Absent/Late/Unexcused by date│ │ 1. Maria G       5    │ │
│          │ └──────────────────────────────┘ └───────────────────────┘ │
│          │ ┌─ Reason Breakdown (horiz bar)┐ ┌─ Classification ───────┐ │
│          │ │ Unexcused ████████ 7         │ │ Keyword (free)    33   │ │
│          │ │ Medical   ██████   12        │ │ AI High            5   │ │
│          │ │ Family    ████     8         │ │ AI Medium          3   │ │
│          │ └──────────────────────────────┘ │ AI Low             1   │ │
│          │                                  └───────────────────────┘ │
│          │                                                             │
│          │ Records  [All(42)] [Absent(33)] [Late(6)] [Unexcused(3)]  │
│          │          [⚠ Needs Review(2)] [✉ Needs Reply(4)]           │
│          │          [Gmail(30)] [Slack(12)]   [42] Mar 1–Mar 22       │
│          │                                                             │
│          │ ┌──────────────────────────────────────────────────────┐   │
│          │ │Src │Name        │Email      │Date │Type    │Reason  │⚙ │  │
│          │ │────┼────────────┼───────────┼─────┼────────┼────────┼───│  │
│          │ │📧  │⚠ Maria G  │maria@...  │3/22 │[Absent]│[Med ▼] │👁🗑│  │
│          │ │💬  │● James W  │james@...  │3/21 │[Absent]│[Unex▼] │👁🗑│  │
│          │ │📧  │  Sarah C  │sarah@...  │3/20 │[Late]  │[Net ▼] │👁🗑│  │
│          │ └──────────────────────────────────────────────────────┘   │
└──────────┴────────────────────────────────────────────────────────────┘
  ⚠ = Needs Review (yellow triangle)   ● = High urgency (rose dot)
```

### 5.3 Record Detail Modal

```
┌──────────────────────────────────────┐
│  Email Details / Message Details  ✕  │
│                                      │
│  Name           Email                │
│  Maria Garcia   maria@university.edu │
│                                      │
│  Date           Source               │
│  3/22/2026      📧 Gmail             │
│                                      │
│  Type           Reason               │
│  [Absent]       [Medical]            │
│                                      │
│  AI Confidence                       │
│  ████████░░ 82% high                 │
│                                      │
│  Full Email Body                     │
│  ┌──────────────────────────────────┐│
│  │ Hi, I woke up with a severe     ││
│  │ migraine and nausea...          ││
│  └──────────────────────────────────┘│
│                                      │
│  ── LMS SYNC ──────────────────────  │
│  ✗ Not yet synced                    │
│  [Excuse absence ▼] [Sync to LMS]   │
│                                      │
│  ── REPLY ─────────────────────────  │
│  Send Reply                [Compose] │
│  (expands to textarea + Send button) │
│  [✨ Re-draft] (AI draft generation) │
└──────────────────────────────────────┘
```

### 5.4 Students Page

```
┌──────────┬───────────────────────────────────────────────────┐
│ Sidebar  │ Students         [Status ▼] [Class ▼] [+ Add]    │
│          │                  [Import Students]                │
│          │                                                   │
│          │ ┌─────────────────────────────────────────────┐   │
│          │ │ Name       │ Email          │Class│Status   │   │
│          │ │ Maria G    │ maria@...      │ L1  │ Active  │   │
│          │ │ James W    │ james@...      │ L1  │ Active  │   │
│          │ └─────────────────────────────────────────────┘   │
│          │                                                   │
│          │ STUDENT PROFILE (expanded):                       │
│          │ ┌─────────────────────────────────────────────┐   │
│          │ │ Maria Garcia        Status: [Active ▼]      │   │
│          │ │ maria@university.edu  Class: L1             │   │
│          │ │ Slack ID: U0123456                          │   │
│          │ │ Alternate emails:                           │   │
│          │ │   [maria.g@gmail.com ✕] [+ Add email]      │   │
│          │ │ [Move to Class ▼]                           │   │
│          │ │                                             │   │
│          │ │ Attendance History (5 records)              │   │
│          │ │ ┌──────────────────────────────────────┐    │   │
│          │ │ │Date  │Type    │Reason    │Snippet    │    │   │
│          │ │ │3/22  │Absent  │Medical   │Migraine...│    │   │
│          │ │ └──────────────────────────────────────┘    │   │
│          │ └─────────────────────────────────────────────┘   │
└──────────┴───────────────────────────────────────────────────┘
```

### 5.5 Settings Page

```
┌──────────┬───────────────────────────────────────────────────┐
│ Sidebar  │ Settings                                          │
│          │                                                   │
│          │ Account                                           │
│          │ Username / Email / Role / Google: ✅ Connected   │
│          │ [Reconnect Google Account]                        │
│          │                                                   │
│          │ Scan Schedule                                     │
│          │ ✅ 10:00 AM  [Gmail✅] [Slack✅]  [Edit][Delete] │
│          │ ✅  2:00 PM  [Gmail✅] [Slack❌]  [Edit][Delete] │
│          │ [+ Add Scan Time]                                 │
│          │                                                   │
│          │ Slack Channels                                    │
│          │ ✅ #l1-class  (L1)   [Toggle][Delete]            │
│          │ ✅ #l2-class  (L2)   [Toggle][Delete]            │
│          │ [+ Add Slack Channel]                             │
│          │                                                   │
│          │ LMS Integration                                   │
│          │ ✅ Canvas (canvas.pursuit.org)  [Toggle][Delete] │
│          │ [+ Add LMS Connection]                            │
└──────────┴───────────────────────────────────────────────────┘
```

---

## 6. System Tools & Requirements

### 6.1 Runtime Environment

| Requirement | Specification |
|---|---|
| Node.js | v20+ |
| Package Manager | npm |
| Operating System | Linux (Render) |
| Database | PostgreSQL (Supabase, session pooler) |
| Deployment | Render (web service, starter plan) |

### 6.2 Environment Variables

| Variable | Purpose | Required |
|---|---|---|
| `DATABASE_URL` | Supabase session pooler connection string | **Yes** (fail-fast) |
| `SESSION_SECRET` | Express session encryption key | **Yes** (fail-fast) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | For Google features |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | For Google features |
| `OPENAI_API_KEY` | OpenAI API key | Yes (AI classification) |
| `SLACK_BOT_TOKEN` | Slack Bot OAuth token for API calls | For Slack scanning |
| `SLACK_SIGNING_SECRET` | Slack webhook signature verification | For Slack webhooks |
| `SLACK_CLIENT_ID` | Slack app client ID | For Slack app identification |
| `SLACK_APP_ID` | Slack app ID | For Slack app identification |

Legacy fallbacks (still accepted): `PULSE_GOOGLE_CLIENT_ID`, `PULSE_GOOGLE_CLIENT_SECRET`

### 6.3 Key Dependencies

**Production**:
| Package | Version | Purpose |
|---|---|---|
| react | ^18 | UI framework |
| express | ^5 | HTTP server |
| drizzle-orm | latest | Type-safe database ORM |
| pg | latest | PostgreSQL driver (node-postgres) |
| openai | latest | AI classification |
| bcrypt | latest | Password hashing |
| express-session | latest | Session management |
| connect-pg-simple | latest | PostgreSQL session store |
| recharts | latest | Analytics charts |
| docx | latest | DOCX report generation |
| date-fns | latest | Date manipulation |
| wouter | latest | Client-side routing |
| @tanstack/react-query | ^5 | Server state management |
| zod | latest | Schema validation |

**Development**:
| Package | Purpose |
|---|---|
| vite | Build tool + HMR |
| typescript | Type checking |
| tailwindcss | Utility CSS |
| vitest | Unit testing |

### 6.4 Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start development server (Express + Vite HMR + Scheduler) |
| `npm run build` | Production build (esbuild → dist/index.cjs + Vite client) |
| `npm run start` | Run production build |
| `npm run db:push` | Push schema changes to Supabase |
| `npm test` | Run vitest test suite |

---

## 7. User Flow

### 7.1 Authentication Flow

```
User arrives at PULSE
        │
        ├─── Has account? ── Enter credentials ── Validate ── Session save ── Dashboard
        │
        ├─── New user? ── Fill registration form ── Create account ── Session save ── Dashboard
        │
        ├─── Google user? ── Click "Sign in with Google" ── OAuth consent ──
        │                         Callback → session.save() → Dashboard
        │                         (new user auto-created as instructor)
        │
        └─── Demo? ── Click "Try Demo" ── Auto-login as admin ── Seeded data ── Dashboard
```

### 7.2 Message Processing Flow

```
Incoming message (manual / batch / Gmail fetch / Gmail scan / Slack scan)
        │
        ▼
   Roster check: is sender enrolled?
        │
        ├── No → Skip (free, no record created)
        │
        └── Yes → Stage 1 keyword classifier
                        │
                        ├── Clear signal found → Record created (free, aiConfidenceTier=null)
                        │
                        └── Ambiguous → gpt-4o-mini
                                            │
                                            ├── confidence ≥ 0.4 → Record created
                                            │   (aiConfidenceTier = medium or high)
                                            │
                                            └── confidence < 0.4 → gpt-4o
                                                        │
                                                        ├── confidence ≥ 0.4 → Record created
                                                        │
                                                        └── All fail → requiresManualReview=true
                                                                        Record created with fallback
        │
        ▼
   needsResponse=true? → Create alert → Sidebar badge increments
   aiConfidenceTier=medium? → Send Slack notification to instructor
```

### 7.3 Dashboard Filtering Flow

```
All records fetched (scoped by role)
        │
        ├── Time period filter → client-side date range filter
        ├── Attendance type button → filter by attendanceType
        ├── Source button (Gmail/Slack) → filter by source
        ├── Needs Review button → filter by requiresManualReview=true
        ├── Needs Reply button → filter by needsResponse=true
        ├── Category stat card → filter by excuseCategory
        │
        └── All filters combine (AND logic)
                │
                └── Auto-sorted: NeedsReview → Unexcused → Medical → Family →
                                 Administrative → Technical → Networking → Other →
                                 newest first within each group
```

### 7.4 Alert Response Flow

```
Alert in feed (sidebar badge shows unread count)
        │
        ├── View Details → Dialog: full body, type, reason, urgency, AI confidence
        │
        ├── Reply →
        │    ├── "Compose" button opens reply panel
        │    ├── "✨ Re-draft" triggers POST /api/ai/draft-reply → AI generates reply
        │    ├── Edit text in textarea
        │    └── Send →
        │         ├── Gmail: POST /api/gmail/send (threaded, uses instructor's account)
        │         └── Slack: POST /api/slack/send (to channel or DM thread)
        │
        ├── Mark Read/Unread → PATCH /api/alerts/:id/read|unread
        └── Mark All Read → POST /api/alerts/mark-all-read
```

### 7.5 LMS Sync Flow

```
Open record detail modal
        │
        ├── See "Not yet synced" status
        ├── Select action: [Excuse absence ▼]
        ├── Click "Sync to LMS"
        │         │
        │    POST /api/records/:id/lms-sync { action }
        │         │
        │    Server calls LMS API
        │         │
        │    ├── Success → lms_synced=true, lms_sync_status="success"
        │    │             Entry in lms_sync_logs
        │    │             UI shows ✅ Synced
        │    │
        │    └── Failure → lms_sync_status="failed"
        │                  Error in lms_sync_logs
        │                  Toast: "LMS sync failed"
```

---

## 8. Conditional Logic Trees

### 8.1 Hybrid Classification Decision Tree

```
Email/message received
        │
        ▼
   Roster check (primary email + alternateEmails + slackUserId)
        │
        ├── Not enrolled → DROP (no record, no cost)
        │
        └── Enrolled
                │
                ▼
           Stage 1: Keyword Pre-Classifier
                │
                ├── ≥1 category keyword match?
                │         │
                │         └── YES → return result
                │                   attendanceType from absence/late keyword list
                │                   category from best-matching keyword set
                │                   confidence = min(0.72 + hits×0.04, 0.92)
                │                   aiConfidenceTier = null (keyword path = free)
                │
                └── No match → Stage 2: gpt-4o-mini
                                    │
                                    ├── confidence ≥ 0.4 → return result
                                    │   (tier = medium or high)
                                    │
                                    └── confidence < 0.4 → Stage 3: gpt-4o
                                                │
                                                ├── confidence ≥ 0.4 → return result
                                                │
                                                └── All fail → fallback
                                                              requiresManualReview=true
                                                              category="Unexcused"
                                                              confidence=0
```

### 8.2 Attendance Type Classification Logic

```
Analyze message content
        │
        ├── Partial attendance signals (running late, leaving early, stepping out)
        │         └── attendanceType = "Late/Tardy"
        │              + determine category from reason
        │
        ├── Complete absence with valid reason
        │         └── attendanceType = "Absent"
        │              + determine category from reason
        │
        └── Vague, no reason, or clearly invalid
                  └── attendanceType = "Unexcused"
                       + excuseCategory = "Unexcused"
```

### 8.3 Excuse Category Decision Tree

```
Reason provided:
        │
        ├── Health/body/medical → Medical
        ├── Family/relative/bereavement/childcare → Family
        ├── Legal/government/court/jury → Administrative
        ├── Internet/laptop/car/transit/power → Technical
        ├── Career event/networking/conference/hackathon → Networking
        ├── Job interview/work conflict/housing emergency/financial → Other
        └── Vague/no reason/clearly fake → Unexcused
```

### 8.4 Alert Creation Logic

```
Record classified
        │
        ├── needsResponse = true?
        │         └── YES → Create alert record
        │                   urgency = AI urgency
        │                   Sidebar badge increments
        │
        ├── mentionsStudent = true?
        │         └── YES → Also flag in alert (peer mention type)
        │
        ├── mentionsSchool = true?
        │         └── YES → Also flag in alert (school mention type)
        │
        └── aiConfidenceTier = "medium"?
                  └── YES → Send Slack notification to first configured channel
```

---

## 9. Full Project Report

### 9.1 Technical Achievements

PULSE v6.0 represents a production-grade attendance automation system with the following key technical achievements:

**Hybrid AI Cost Optimization**: The two-stage classifier (keyword → OpenAI) achieves approximately 80% cost reduction compared to sending all emails directly to OpenAI. The keyword classifier handles clear-cut cases for free, while OpenAI is reserved for genuinely ambiguous emails. The dual-tier OpenAI fallback (gpt-4o-mini → gpt-4o) further minimizes costs by using the cheaper model first.

**Roster-Only Scanning**: By pre-filtering senders against the enrolled student roster before any AI call, the system eliminates classification of spam, administrative emails, and non-student messages entirely. This further reduces API costs and prevents false positives in the records table.

**Multi-Source Attendance**: The system processes attendance notifications from both Gmail and Slack through the same classification pipeline, giving instructors a unified view regardless of how students choose to communicate.

**Session Reliability**: The production deployment on Render (behind a reverse proxy) required specific fixes:
- `app.set("trust proxy", 1)` for secure cookie propagation over HTTPS
- Explicit `req.session.save()` callbacks before all HTTP responses to prevent session/response race conditions
- Session table created via raw SQL at boot (avoiding `connect-pg-simple`'s `table.sql` file lookup, which fails when esbuild bundles the package to a single CJS file)

**Idempotent Migrations**: `server/migrations.ts` runs at every server boot using `IF NOT EXISTS` semantics, ensuring new tables and columns are automatically created on first deploy without requiring manual migration steps.

### 9.2 System Architecture Decisions

| Decision | Rationale |
|---|---|
| Supabase over Neon | Better connection pooling, reliability, and session pooler support |
| pg over @neondatabase/serverless | Standard PostgreSQL driver works reliably with Supabase session pooler |
| Keyword pre-classifier | ~80% cost reduction vs sending all emails to OpenAI |
| Roster-only filter | Eliminates false positives and reduces API calls further |
| Client-side sort | Auto-sort by priority avoids server query complexity; records are already fetched |
| Raw SQL for session table | Eliminates esbuild bundling issue with connect-pg-simple's table.sql asset |
| Explicit session.save() | Prevents race condition between session write and HTTP response |

### 9.3 Security Considerations

- All passwords hashed with bcrypt (cost factor 10)
- Sessions stored in PostgreSQL, not memory — survive server restarts
- Google OAuth CSRF protection via random state parameter
- Slack webhook signature verification on all endpoints
- Instructor data isolation enforced server-side (not just frontend)
- Email reply recipient validated against original sender
- All email headers sanitized against CRLF injection
- Production debug endpoints gated by `NODE_ENV !== "production"`
- Fail-fast on missing required environment variables

---

## 10. Project Roadmap

### Completed (v6.0)

- [x] Multi-tenant roles (Admin/Instructor)
- [x] Gmail OAuth + read + send
- [x] Slack scanning (channels + DMs)
- [x] Hybrid keyword + OpenAI classifier
- [x] 7-category excuse classification (Medical, Family, Administrative, Technical, Networking, Other, Unexcused)
- [x] Roster-only pre-filter
- [x] Alternate email matching
- [x] Slack user ID matching
- [x] Student import (CSV/JSON/from records)
- [x] Needs Review + Needs Reply dashboard filters
- [x] Auto-sort records by priority
- [x] Urgency indicators in table rows
- [x] Analytics panel (trend, reason breakdown, classification method, leaderboard)
- [x] AI draft reply generation
- [x] Reply from portal (Gmail + Slack)
- [x] Assessment actions (excuse/makeup/zero_out/none)
- [x] LMS integration (5 platforms)
- [x] Idempotent boot migrations
- [x] Production deployment on Render
- [x] Automated scanning scheduler

### Planned (Future)

- [ ] Push notifications (web push or email digest) for new alerts
- [ ] Attendance rate reports per student (% absent, % late over a period)
- [ ] Google Calendar integration (automatically flag known holidays/events)
- [ ] Slack slash command (`/pulse student @name`) for on-demand student summary
- [ ] Bulk LMS sync (sync all unsynced records at once)
- [ ] Instructor dashboard comparison (admin view across all instructors)
- [ ] Student self-service portal (student submits absence form, auto-classified)
- [ ] SMS/WhatsApp ingestion (via Twilio)
- [ ] AI-generated weekly summary email to instructors
- [ ] Custom category aliases (e.g., rename "Networking" to "Professional Development")
