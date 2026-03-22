# PULSE — Project Documentation

**Multi-Tenant Attendance Automation Tool for Pursuit**
**Version:** 5.0
**Last Updated:** March 21, 2026

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

PULSE is a space-themed, multi-tenant AI-powered attendance automation tool designed for Pursuit (tech training program). It processes student absence and tardiness messages from **Gmail AND Slack** using a dual-classification system (attendance type + excuse reason), supports role-based access (Admin/Instructor), class management (L1, L2, L3, L∞), student rosters with status tracking (Active/Graduated/Hired), class progression, weekly class schedules, automated scanning at configurable times with **per-source control** (Gmail/Slack independently per time slot), an alert system for urgent student messages, and direct email reply from the portal. The application features Google OAuth integration for Gmail inbox reading and sending, Slack Bot Token integration for channel/DM scanning, multi-LLM AI fallback for cost optimization, time-period filtering, export/print capabilities, and a dark/light mode toggle with animated star field.

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
| **Class Progression** | Bulk promote all active students in a class to a target class; individually move students between classes |
| **Dual-Classification AI** | Every email classified on two axes: Attendance Type (Absent, Late/Tardy, Unexcused) + Excuse Category (Sick/Medical, Personal, Program Event, Technical Issue, Other, None) |
| **Hybrid AI Classification** | Cost-optimized two-stage system: keyword pre-classifier runs first (free, no API call) → handles ~80% of emails; OpenAI (`gpt-4o-mini` → `gpt-4o` fallback) handles ambiguous cases only |
| **Roster-Only Scanning** | Gmail and Slack scans skip all non-roster senders before any AI call — only emails/messages from enrolled students trigger classification |
| **Alert Detection** | AI flags emails needing instructor response (questions, special requests, urgent matters); urgency levels (low/medium/high); peer mention detection (student-about-student); school/program mention detection |
| **Alert Management** | Alert feed with mark read/unread, urgency color-coding, full email body detail view, unread count badge in sidebar |
| **Email Reply from Portal** | Compose and send replies to student emails directly from the Alerts page; sent via instructor's connected Gmail with proper email threading |
| **Automated Multi-Source Scanning** | Scheduler checks every 30 seconds for configured scan times; auto-fetches and processes messages from Gmail and/or Slack; per-source toggles (Gmail/Slack) per scan time; default times: 10:00 AM, 2:00 PM, 6:25 PM, 8:00 PM, 9:55 PM |
| **Slack Scanning** | Scans configured Slack channels and DMs for attendance-related keywords using SLACK_BOT_TOKEN; processes through same AI classification as Gmail; matches senders to student roster; creates records with Slack metadata (channel name, DM indicator) |
| **Multi-Source Dashboard** | Source filter buttons (Gmail/Slack) on Dashboard; source column in records table with icons (Mail for Gmail, MessageSquare for Slack); source-specific detail in record dialog |
| **Manual Email Entry** | Single email form with sender name, email, date, and body |
| **Batch Upload** | Paste or upload JSON/CSV with multiple emails; processed with real-time SSE streaming |
| **Gmail Fetch** | OAuth 2.0 + Gmail API to search, select, and process emails directly from inbox |
| **Attendance Type Filter Buttons** | Dashboard Records section has All/Absent/Late-Tardy/Unexcused toggle buttons with counts |
| **Excuse Category Stat Cards** | Clickable stat cards for each excuse reason; filters combine with type filter buttons |
| **Time-Period Filtering** | Filter records by Today, Week, Month, Quarter, Year, or All Time |
| **Weekly Schedule** | Per-class weekly grid with time blocks; add/edit/delete schedule entries |
| **CSV/DOCX/JSON Export** | Download attendance reports in multiple formats |
| **Print View** | Respects active time-period filter; hides interactive controls |
| **Dark / Light Mode** | Space-dark theme with 120 animated stars; clean-light theme with 20 corner sparkles |
| **Google OAuth** | Sign-in + Gmail read/send; reconnect button for scope upgrades |
| **Demo Mode** | One-click demo with admin account, 2 instructors, 4 classes, 12 students, 7 records, 2 alerts |
| **Settings** | Scan schedule config with per-source Gmail/Slack toggles per time slot, account info, Google connection status and reconnect |

### 1.5 Attendance Classification System

PULSE uses a dual-classification approach to accurately track attendance:

**Attendance Types** (What happened — was the person present?):
| Type | Meaning | Dashboard Filter Button Color |
|---|---|---|
| Absent | Student will not attend at all | Rose/Red |
| Late/Tardy | Student will attend but will arrive late, or is leaving early | Orange |
| Unexcused | No valid reason provided or message is not a genuine excuse | Slate/Gray |

**Excuse Categories** (Why — the reason for absence/tardiness):
| Category | Examples | Stat Card Color |
|---|---|---|
| Sick/Medical | Flu, migraine, doctor appointment, hospital, COVID, mental health day, surgery, under the weather | Rose |
| Personal | Family emergency, funeral, wedding, travel, jury duty, court date, bereavement, child care, moving | Amber |
| Program Event | Conference, workshop, hackathon, career fair, field trip, orientation, guest speaker, company visit | Sky |
| Technical Issue | Internet down, laptop broken, power outage, car broke down, bus delayed, can't log in, WiFi issues | Violet |
| Other | Valid reason that does not fit the above categories | Emerald |
| None | Used when attendance type is Unexcused and no valid reason exists | Slate |

**Important Classification Rules:**
- If someone says "running late because I'm sick" → Attendance Type = Late/Tardy, Excuse Category = Sick/Medical
- If someone says "I won't be in today, I have the flu" → Attendance Type = Absent, Excuse Category = Sick/Medical
- If someone says "can't make it, something came up" (no details) → Attendance Type = Unexcused, Excuse Category = None
- Leaving early or stepping out partway → Attendance Type = Late/Tardy
- Stuck in traffic → Attendance Type = Late/Tardy, Excuse Category = Technical Issue

**Dashboard Filtering:**
- **Attendance Type Filter Buttons** (next to Records heading): All, Absent, Late/Tardy, Unexcused — each shows a count
- **Excuse Category Stat Cards** (above records): Total, Sick/Medical, Personal, Program Event, Technical Issue, Other, None — clickable to filter
- Both filters combine: e.g., click "Late/Tardy" button + "Personal" stat card = only Late/Tardy records with Personal reason

### 1.6 Alert Classification System

The AI also detects when emails need instructor attention:

| Field | Description |
|---|---|
| `needsResponse` | Boolean: does this email contain a question, request, or urgent matter? |
| `urgency` | low / medium / high — how time-sensitive is the matter? |
| `alertReason` | Brief explanation of why the alert was flagged |
| `mentionsStudent` | Boolean: does a student mention another student by name? (peer reporting) |
| `mentionsSchool` | Boolean: does the email mention Pursuit, classes, curriculum, or instructors? |
| `peerOrSchoolDetail` | Details about what was mentioned |

### 1.7 Student Status Tracking

| Status | Description |
|---|---|
| Active | Currently enrolled and attending class |
| Graduated | Completed the program |
| Hired | Placed in employment after program |

- Non-active students appear dimmed in the roster
- Bulk class promotion only moves Active students; Graduated/Hired stay in place
- Individual students can be moved between classes or have their status changed at any time

### 1.8 Non-Functional Requirements

- **Performance**: SSE streaming for batch processing; sub-second UI interactions; multi-LLM fallback minimizes API costs
- **Security**: Bcrypt password hashing; session-based auth; CSRF state for OAuth; per-user data isolation; CRLF header injection prevention on email replies; recipient validation on email sends; cohort ownership checks for instructors
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
│       │              │            │            │           │        │
│  ┌──────────────┐ ┌──────────┐ ┌─────────┐ ┌─────────┐            │
│  │Admin Cohorts │ │Instructors│ │Settings │ │Sidebar  │            │
│  └──────┬───────┘ └────┬─────┘ └────┬────┘ └────┬────┘            │
│         │              │            │            │                  │
│  ┌──────┴──────────────┴────────────┴────────────┴───────────────┐ │
│  │            TanStack Query v5 + Fetch API + apiRequest        │ │
│  └──────────────────────────┬────────────────────────────────────┘ │
└─────────────────────────────┼──────────────────────────────────────┘
                              │ HTTP / SSE
┌─────────────────────────────┼──────────────────────────────────────┐
│                        SERVER (Express 5)                          │
│  ┌──────────┐  ┌────────────┴──────┐  ┌──────────────────────┐    │
│  │  Auth    │  │   Routes          │  │  Google OAuth         │    │
│  │ (bcrypt  │  │ (CRUD, SSE,      │  │  + Gmail Read/Send   │    │
│  │  roles)  │  │  role middleware) │  │  + Token Refresh     │    │
│  └────┬─────┘  └────────┬─────────┘  └──────────┬────────────┘    │
│       │                 │                        │                 │
│  ┌────┴─────────────────┴────────────────────────┴───────────────┐ │
│  │                   Storage Layer (IStorage)                    │ │
│  │  Users, Cohorts, Students, Schedules, Records, Alerts, Scans │ │
│  └──────────────────────────┬────────────────────────────────────┘ │
│                              │                                     │
│  ┌──────────────────────────┴────────────────────────────────────┐ │
│  │              Drizzle ORM  →  PostgreSQL (Neon)                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌────────────────────────────────────┐  ┌───────────────────────┐│
│  │   Multi-LLM AI Engine (OpenAI)    │  │    Scheduler          ││
│  │   nano → mini → full fallback     │  │    (30s interval)     ││
│  │   Dual classification + alerts    │  │    Gmail + Slack scan  ││
│  └────────────────────────────────────┘  └───────────────────────┘│
│                                                                    │
│  ┌────────────────────────────────────┐                            │
│  │   Slack Scanner                    │                            │
│  │   Channel + DM scanning           │                            │
│  │   Keyword match → AI classify     │                            │
│  └────────────────────────────────────┘                            │
└───────────────────────────────────────────────────────────────────-┘
```

### 2.2 Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18, TypeScript | SPA with component-based UI |
| Routing | wouter | Lightweight client-side routing |
| State | TanStack Query v5 | Server state, caching, mutations |
| Styling | Tailwind CSS 3 | Utility-first CSS with dark mode |
| UI Library | shadcn/ui (Radix primitives) | Accessible, customizable components |
| Icons | lucide-react | Action icons and visual cues |
| Company Logos | react-icons/si | Brand logos (Google, etc.) |
| Build | Vite 5 | HMR, ESBuild transforms |
| Server | Express 5 | REST API + SSE endpoints |
| ORM | Drizzle ORM | Type-safe SQL queries |
| Database | PostgreSQL (Neon Serverless) | Persistent data storage |
| Auth | express-session + bcrypt | Session cookies, password hashing, role-based access |
| OAuth | Google OAuth 2.0 | Gmail read/send access, sign-in |
| AI | OpenAI GPT (via Replit AI Integrations) | Multi-LLM email classification + alert detection |
| Documents | docx (npm) | DOCX generation |
| Dates | date-fns | Time-period filtering |
| Validation | Zod + drizzle-zod | Schema validation on both client and server |

### 2.3 Directory Structure

```
pulse/
├── client/
│   ├── index.html
│   ├── public/
│   │   └── favicon.png
│   └── src/
│       ├── main.tsx                    # React entry point
│       ├── App.tsx                     # Router + Providers + Sidebar layout
│       ├── index.css                   # Global styles, star animations, theme vars, print styles
│       ├── pages/
│       │   ├── auth.tsx                # Login / Register / OAuth / Demo
│       │   ├── dashboard.tsx           # Stats, type filters, category cards, records table, exports
│       │   ├── students.tsx            # Student roster + profile with attendance history
│       │   ├── schedule.tsx            # Weekly schedule grid per class
│       │   ├── alerts.tsx              # Alert feed with reply, detail view, mark read/unread
│       │   ├── admin-cohorts.tsx       # Admin class management + instructor assignment + bulk promote
│       │   ├── instructors.tsx         # Admin instructor list
│       │   ├── settings.tsx            # Scan schedule config, account info, Google connect/reconnect
│       │   └── not-found.tsx           # 404 page
│       ├── components/
│       │   ├── ui/                     # 30+ shadcn/ui components
│       │   ├── app-sidebar.tsx         # Sidebar nav with role-based items + alert badge
│       │   ├── add-email-dialog.tsx    # Manual single email entry
│       │   ├── batch-upload-dialog.tsx # JSON/CSV batch processing
│       │   ├── gmail-fetch-dialog.tsx  # Gmail inbox search + select
│       │   ├── records-table.tsx       # Data table with Type + Reason columns, inline editing
│       │   ├── star-field.tsx          # Animated star/sparkle background
│       │   └── theme-provider.tsx      # Dark/Light mode context
│       ├── hooks/
│       │   ├── use-auth.ts            # Auth state hook with isAdmin helper
│       │   ├── use-mobile.tsx         # Responsive breakpoint hook
│       │   └── use-toast.ts           # Toast notification hook
│       └── lib/
│           ├── queryClient.ts         # TanStack Query config + apiRequest helper
│           └── utils.ts               # cn() utility
├── server/
│   ├── index.ts                       # Express server bootstrap + scheduler start
│   ├── auth.ts                        # Login/register/demo/session + demo seeding
│   ├── google-auth.ts                 # OAuth 2.0 flow + Gmail read/send + token refresh
│   ├── routes.ts                      # All CRUD endpoints with role middleware
│   ├── openai.ts                      # Multi-LLM AI classification + alert detection
│   ├── storage.ts                     # IStorage interface + DatabaseStorage implementation
│   ├── scheduler.ts                   # Automated scanning scheduler (30s interval, Gmail + Slack)
│   ├── slack-scanner.ts               # Slack channel/DM scanner (keyword match → AI classify)
│   ├── db.ts                          # Drizzle + Neon connection
│   ├── vite.ts                        # Vite dev middleware (DO NOT MODIFY)
│   └── static.ts                      # Static file serving (production)
├── shared/
│   ├── schema.ts                      # Drizzle schema, Zod schemas, types, constants
│   └── models/
│       └── chat.ts                    # Chat integration models
├── docs/
│   └── PROJECT_DOCUMENTATION.md       # This file
├── drizzle.config.ts
├── tailwind.config.ts
├── vite.config.ts
├── tsconfig.json
├── components.json
└── package.json
```

### 2.4 Data Flow

1. **Email Ingestion**: Email arrives via manual entry, batch upload, Gmail fetch, or automated Gmail scan
2. **Multi-LLM Classification**: Email body sent to AI (nano first → mini if low confidence → full if still low); returns attendance type, excuse category, alert flags, and peer/school mentions
3. **Storage**: Record persisted in PostgreSQL; if alert flagged, alert record also created
4. **SSE Streaming**: For batch processing, each result streamed to client as it completes
5. **Dashboard**: TanStack Query fetches records/stats scoped by role; admin sees all, instructor sees own classes
6. **Filtering**: Attendance type filter buttons + excuse category stat cards + time-period buttons all combine
7. **Alerts**: Flagged emails appear in alert feed with urgency; instructor can reply directly via Gmail
8. **Export**: CSV/DOCX/JSON endpoints generate downloadable files from user's records

---

## 3. Entity-Relationship Diagram (ERD)

### 3.1 Database Schema

```
┌─────────────────────────────────┐       ┌──────────────────────────────────┐
│            users                │       │           scan_configs           │
├─────────────────────────────────┤       ├──────────────────────────────────┤
│ id             SERIAL PK       │──┐    │ id            SERIAL PK         │
│ username       TEXT NOT NULL UQ │  │    │ user_id       INT NOT NULL FK   │──→ users.id
│ email          TEXT NOT NULL UQ │  │    │ scan_time     TEXT NOT NULL     │
│ password       TEXT NOT NULL    │  │    │ enabled       BOOLEAN DEFAULT T │
│ display_name   TEXT NOT NULL    │  │    │ scan_gmail    BOOLEAN DEFAULT T │
│ role           TEXT DEFAULT     │  │    │ scan_slack    BOOLEAN DEFAULT T │
│                'instructor'    │  │    │ created_at    TIMESTAMP         │
│ google_id      TEXT UQ         │  │    └──────────────────────────────────┘
│ google_access_token  TEXT      │  │
│ google_refresh_token TEXT      │  │    ┌──────────────────────────────────┐
│ slack_user_id  TEXT            │  │    │       slack_channel_configs      │
│ created_at     TIMESTAMP       │  │    ├──────────────────────────────────┤
└─────────────────────────────────┘  │    │ id            SERIAL PK         │
         │                           │    │ cohort_id     INT NOT NULL FK   │──→ cohorts.id
         │ 1:N (instructor_id)       │    │ channel_id    TEXT NOT NULL     │
         ▼                           │    │ channel_name  TEXT NOT NULL     │
┌─────────────────────────────────┐  │    │ enabled       BOOLEAN DEFAULT T │
│           cohorts               │  │    │ created_at    TIMESTAMP         │
├─────────────────────────────────┤  │    └──────────────────────────────────┘
│ id             SERIAL PK       │  │
│ name           TEXT NOT NULL    │  │    ┌──────────────────────────────────┐
│ instructor_id  INT NOT NULL FK │──┘    │            alerts                │
│ created_at     TIMESTAMP       │       ├──────────────────────────────────┤
└─────────────────────────────────┘       │ id            SERIAL PK         │
         │                                │ user_id       INT NOT NULL FK   │──→ users.id
         │ 1:N (cohort_id)               │ record_id     INT NOT NULL FK   │──→ attendance_records.id
         ├──────────────┐                 │ alert_type    TEXT NOT NULL      │
         ▼              ▼                 │ message       TEXT NOT NULL      │
┌──────────────────┐ ┌──────────────────┐ │ urgency       TEXT DEFAULT 'low' │
│    students      │ │   schedules      │ │ is_read       BOOLEAN DEFAULT F  │
├──────────────────┤ ├──────────────────┤ │ created_at    TIMESTAMP          │
│ id     SERIAL PK │ │ id     SERIAL PK │ └──────────────────────────────────┘
│ name   TEXT NN   │ │ cohort_id INT FK │──→ cohorts.id
│ email  TEXT NN   │ │ day_of_week INT  │
│ cohort_id INT FK │ │ start_time TEXT  │
│ status TEXT      │ │ end_time   TEXT  │
│  DEFAULT 'Active'│ │ label      TEXT  │
│ created_at TS    │ │ created_at TS    │
└──────────────────┘ └──────────────────┘
         │
         │ 1:N (student_id, nullable)
         ▼
┌──────────────────────────────────────────────┐
│              attendance_records               │
├──────────────────────────────────────────────┤
│ id                  SERIAL PK                │
│ user_id             INT NOT NULL FK          │──→ users.id
│ student_id          INT FK (nullable)        │──→ students.id
│ sender_name         TEXT NOT NULL            │
│ sender_email        TEXT NOT NULL            │
│ received_at         TIMESTAMP NOT NULL       │
│ email_body          TEXT NOT NULL            │
│ attendance_type     TEXT NOT NULL DEFAULT    │
│                     'Absent'                 │
│ excuse_category     TEXT NOT NULL            │
│ message_snippet     TEXT NOT NULL            │
│ status              TEXT NOT NULL DEFAULT    │
│                     'pending'                │
│ batch_id            TEXT                     │
│ needs_response      BOOLEAN DEFAULT FALSE   │
│ urgency             TEXT DEFAULT 'low'       │
│ alert_reason        TEXT                     │
│ mentions_student    BOOLEAN DEFAULT FALSE   │
│ mentions_school     BOOLEAN DEFAULT FALSE   │
│ peer_or_school_detail TEXT                   │
│ gmail_message_id    TEXT                     │
│ gmail_thread_id     TEXT                     │
│ source              TEXT NOT NULL DEFAULT    │
│                     'gmail'                  │
│ email_subject       TEXT                     │
│ slack_channel_id    TEXT                     │
│ slack_channel_name  TEXT                     │
│ slack_message_ts    TEXT                     │
│ slack_is_dm         BOOLEAN DEFAULT FALSE   │
│ created_at          TIMESTAMP                │
└──────────────────────────────────────────────┘
```

### 3.2 Table Count: 10

| Table | Purpose |
|---|---|
| users | User accounts with role, Google OAuth tokens, Slack user ID |
| cohorts | Classes (L1, L2, L3, L∞) with instructor assignment |
| students | Student roster with class assignment and status |
| schedules | Weekly time blocks per class |
| attendance_records | Processed records with dual classification, alert flags, multi-source metadata (Gmail/Slack) |
| alerts | Flagged records needing instructor attention |
| scan_configs | Automated scan schedule per user with per-source toggles (scanGmail, scanSlack) |
| slack_channel_configs | Slack channel-to-class mapping for automated Slack scanning |
| session | Express session storage (managed by connect-pg-simple) |

### 3.3 Field Descriptions

**users**
| Field | Type | Constraints | Description |
|---|---|---|---|
| id | SERIAL | PK | Unique user identifier |
| username | TEXT | NOT NULL, UNIQUE | Login username |
| email | TEXT | NOT NULL, UNIQUE | User email address |
| password | TEXT | NOT NULL | Bcrypt-hashed password |
| display_name | TEXT | NOT NULL | Shown in UI sidebar |
| role | TEXT | NOT NULL, DEFAULT 'instructor' | 'admin' or 'instructor' |
| google_id | TEXT | UNIQUE, nullable | Google OAuth subject ID |
| google_access_token | TEXT | nullable | Current OAuth access token |
| google_refresh_token | TEXT | nullable | Long-lived refresh token |
| created_at | TIMESTAMP | DEFAULT NOW() | Account creation timestamp |

**cohorts**
| Field | Type | Constraints | Description |
|---|---|---|---|
| id | SERIAL | PK | Unique class identifier |
| name | TEXT | NOT NULL | Class name: L1, L2, L3, or L∞ |
| instructor_id | INT | NOT NULL, FK → users.id | Assigned instructor |
| created_at | TIMESTAMP | DEFAULT NOW() | Class creation timestamp |

**students**
| Field | Type | Constraints | Description |
|---|---|---|---|
| id | SERIAL | PK | Unique student identifier |
| name | TEXT | NOT NULL | Student full name |
| email | TEXT | NOT NULL | Student email address |
| cohort_id | INT | NOT NULL, FK → cohorts.id | Current class assignment |
| status | TEXT | NOT NULL, DEFAULT 'Active' | Active, Graduated, or Hired |
| created_at | TIMESTAMP | DEFAULT NOW() | Student creation timestamp |

**schedules**
| Field | Type | Constraints | Description |
|---|---|---|---|
| id | SERIAL | PK | Unique schedule entry identifier |
| cohort_id | INT | NOT NULL, FK → cohorts.id | Class this schedule belongs to |
| day_of_week | INT | NOT NULL | 0=Sunday through 6=Saturday |
| start_time | TEXT | NOT NULL | Start time in "HH:MM" 24h format |
| end_time | TEXT | NOT NULL | End time in "HH:MM" 24h format |
| label | TEXT | NOT NULL | Subject/activity name |
| created_at | TIMESTAMP | DEFAULT NOW() | Entry creation timestamp |

**attendance_records**
| Field | Type | Constraints | Description |
|---|---|---|---|
| id | SERIAL | PK | Unique record identifier |
| user_id | INT | NOT NULL, FK → users.id | Owning instructor/admin |
| student_id | INT | FK → students.id, nullable | Linked student (if matched) |
| sender_name | TEXT | NOT NULL | Name from email |
| sender_email | TEXT | NOT NULL | Email address of sender |
| received_at | TIMESTAMP | NOT NULL | Date/time email was received |
| email_body | TEXT | NOT NULL | Full email content |
| attendance_type | TEXT | NOT NULL, DEFAULT 'Absent' | Absent, Late/Tardy, or Unexcused |
| excuse_category | TEXT | NOT NULL | Sick/Medical, Personal, Program Event, Technical Issue, Other, or None |
| message_snippet | TEXT | NOT NULL | Truncated email preview |
| status | TEXT | NOT NULL, DEFAULT 'pending' | pending or processed |
| batch_id | TEXT | nullable | Groups emails processed together |
| needs_response | BOOLEAN | DEFAULT FALSE | AI detected question/request |
| urgency | TEXT | DEFAULT 'low' | low, medium, or high |
| alert_reason | TEXT | nullable | Why alert was flagged |
| mentions_student | BOOLEAN | DEFAULT FALSE | Mentions another student by name |
| mentions_school | BOOLEAN | DEFAULT FALSE | Mentions Pursuit/program/curriculum |
| peer_or_school_detail | TEXT | nullable | Details of what was mentioned |
| gmail_message_id | TEXT | nullable | Gmail Message-ID header (for threading) |
| gmail_thread_id | TEXT | nullable | Gmail thread ID (for threading) |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation timestamp |

**alerts**
| Field | Type | Constraints | Description |
|---|---|---|---|
| id | SERIAL | PK | Unique alert identifier |
| user_id | INT | NOT NULL, FK → users.id | Instructor who should see this |
| record_id | INT | NOT NULL, FK → attendance_records.id | Associated attendance record |
| alert_type | TEXT | NOT NULL | Type of alert (needs_response, peer_mention, school_mention) |
| message | TEXT | NOT NULL | Alert description text |
| urgency | TEXT | NOT NULL, DEFAULT 'low' | low, medium, or high |
| is_read | BOOLEAN | NOT NULL, DEFAULT FALSE | Read/unread status |
| created_at | TIMESTAMP | DEFAULT NOW() | Alert creation timestamp |

**scan_configs**
| Field | Type | Constraints | Description |
|---|---|---|---|
| id | SERIAL | PK | Unique config identifier |
| user_id | INT | NOT NULL, FK → users.id | User who owns this config |
| scan_time | TEXT | NOT NULL | Time to scan in "HH:MM" 24h format |
| enabled | BOOLEAN | NOT NULL, DEFAULT TRUE | Whether this scan time is active |
| created_at | TIMESTAMP | DEFAULT NOW() | Config creation timestamp |

### 3.4 Relationships

```
users 1:N → cohorts (instructor_id)
users 1:N → attendance_records (user_id)
users 1:N → alerts (user_id)
users 1:N → scan_configs (user_id)
cohorts 1:N → students (cohort_id)
cohorts 1:N → schedules (cohort_id)
students 1:N → attendance_records (student_id, nullable)
attendance_records 1:N → alerts (record_id)
```

---

## 4. Technical Requirements Document (TRD)

### 4.1 Authentication & Authorization

**Username/Password Authentication**
- Registration: username (3+ chars), email (valid format), password (6+ chars), display name, role selection (admin/instructor)
- Login: username + password validated against bcrypt hash
- Session: `express-session` with `connect-pg-simple` for PostgreSQL-backed sessions
- Session secret: `SESSION_SECRET` environment variable
- Cookie: `httpOnly`, `secure` in production, `sameSite: lax`

**Role-Based Access Control**
- `requireAuth` middleware: blocks unauthenticated requests with 401
- `requireAdmin` middleware: blocks non-admin requests with 403
- Instructor middleware: enforces cohort ownership checks — instructors can only access students, records, and schedules in their own classes
- Admin bypass: admins can access all data across all classes and instructors

**Google OAuth 2.0**
- Scopes: `openid`, `userinfo.email`, `userinfo.profile`, `gmail.readonly`, `gmail.send`
- Flow: Authorization Code with `access_type: offline`, `prompt: consent`
- CSRF: Random `state` parameter stored in session
- Token storage: Access and refresh tokens persisted in `users` table
- Auto-refresh: Expired access tokens refreshed via refresh token on 401 responses
- Reconnect: Settings page has "Reconnect Google Account" button for existing users to re-authorize with updated scopes (e.g., adding gmail.send)
- Environment variables: `PULSE_GOOGLE_CLIENT_ID`, `PULSE_GOOGLE_CLIENT_SECRET`

**Demo Mode**
- Username: `demo`, role: admin
- Auto-seeds: 2 instructor accounts (instructor_smith for L1/L2, instructor_jones for L3/L∞), 4 cohorts, 12 students (all Active), schedule entries, 7 attendance records (4 Absent, 2 Late/Tardy, 1 Unexcused), 2 alerts
- No Google ID attached (Gmail features unavailable in demo)

### 4.2 Hybrid AI Classification Engine

**Design**: Two-stage system minimizes OpenAI costs — ~80% of emails are classified by keyword pre-classifier for free; only ambiguous cases hit OpenAI.

**Stage 1 — Keyword Pre-Classifier** (free, zero API calls):
- Detects absence/late attendance type via keyword lists (`won't be`, `running late`, etc.)
- Scores against Medical / Family / Administrative / Technical keyword sets
- Returns result on ≥1 category hit; confidence = `min(0.72 + hits×0.04, 0.92)`

**Stage 2 — OpenAI Fallback** (ambiguous emails only):
| Tier | Model | When Used |
|---|---|---|
| mini | gpt-4o-mini | First OpenAI attempt (lower cost) |
| full | gpt-4o | Escalation if mini confidence < 0.4 or fails |

**Roster-Only Pre-filter** (before any classification):
- Sender email/name matched against instructor's enrolled student roster
- Non-roster senders skipped entirely — no keyword check, no AI call

**Response Format**: JSON mode (`response_format: { type: "json_object" }`)

**Classification Fields**:
1. `attendanceType`: Absent, Late/Tardy, or Unexcused
2. `category`: Medical, Family, Administrative, Technical, or Unexcused
3. `confidence`: Float 0-1
4. `confidenceTier`: low (<0.4) / medium (0.4-0.7) / high (>0.7)
5. `reasoning`: One-sentence explanation
6. `needsResponse`: Boolean
7. `urgency`: low, medium, or high
8. `alertReason`: string or null
9. `mentionsStudent` / `mentionsSchool`: Boolean peer/school detection
10. `recommendedAssessmentAction`: excuse / makeup_allowed / zero_out / none

**Classification Flow**:
```
Incoming email/message
  → Roster check: not enrolled? skip (free)
  → Stage 1 keywords: clear signal? return result (free)
  → Stage 2 gpt-4o-mini: low confidence? escalate
  → Stage 2 gpt-4o: all fail? requiresManualReview=true
Medium-confidence AI results → Slack alert to instructor for manual review
```

### 4.3 Gmail Integration

**OAuth Scopes**: `gmail.readonly` (inbox reading) + `gmail.send` (reply sending)

**Email Search Query** (default when no custom query provided):
```
absent OR absence OR excuse OR sick OR cannot attend OR won't be able
OR can't make it OR unable to attend OR not coming OR won't be in
OR missing class OR missing session OR out today OR out sick
OR not feeling well OR under the weather OR late OR tardy
OR running late OR delayed OR will be late OR running behind
OR held up OR stuck in traffic OR won't make it on time
OR stepping out OR leaving early OR emergency OR appointment OR called out
```

**Fetch Process**:
1. List message IDs via Gmail API with search query (max 50)
2. Fetch full message details for each ID
3. Parse headers (From, Subject, Date, Message-ID)
4. Extract body: prefer `text/plain`, fallback to `text/html` with tag stripping
5. Parse sender: regex split of `"Display Name <email@domain.com>"` format
6. Store `gmail_message_id` and `gmail_thread_id` for threading
7. Return structured email objects for user selection

**Email Reply (Send)**:
- Endpoint: `POST /api/gmail/send`
- Parameters: to, subject, body, inReplyTo (Message-ID), threadId (Gmail thread), alertId
- Security: validates recipient matches original sender when alertId provided; sanitizes all headers against CRLF injection
- Threading: Sets `In-Reply-To` and `References` headers + Gmail `threadId` for proper conversation threading
- Sends via instructor's connected Gmail account using `gmail.send` scope

**Token Refresh**:
- On 401 from Gmail API, use refresh token to get new access token
- Update database with new token
- Retry original request once

### 4.4 Automated Scanning (Scheduler)

- Runs on server startup in `server/scheduler.ts`
- Checks every **30 seconds** if current time (HH:MM) matches any enabled scan_config
- For users with Google tokens and enabled scan configs: auto-fetches Gmail, processes through AI, creates records and alerts
- Default scan times seeded for new users: 10:00, 18:25, 21:55
- Logs scan results to console

### 4.5 Export Formats

| Format | Endpoint | Content-Type | Notes |
|---|---|---|---|
| CSV | GET /api/export/csv | text/csv | Comma-separated with proper escaping |
| DOCX | GET /api/export/doc | application/vnd.openxml... | Records grouped by excuse category in tables |
| JSON | GET /api/export/json | application/json | Formatted with 2-space indentation |

All exports include all user records regardless of active time filter. Print view respects the active time filter.

### 4.6 Real-Time Processing (SSE)

Batch email processing uses Server-Sent Events for live progress:

| Event | Payload | Description |
|---|---|---|
| `started` | `{ total, batchId }` | Processing has begun |
| `processing` | `{ index, name }` | Currently processing email at index |
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
│  │                                            │              │
│  │  ┌──────────────────────────────────────┐  │              │
│  │  │  Username                            │  │              │
│  │  └──────────────────────────────────────┘  │              │
│  │  ┌──────────────────────────────────────┐  │              │
│  │  │  Password                            │  │              │
│  │  └──────────────────────────────────────┘  │              │
│  │                                            │              │
│  │  Register tab also shows:                  │              │
│  │  ┌──────────────────────────────────────┐  │              │
│  │  │  Email                               │  │              │
│  │  └──────────────────────────────────────┘  │              │
│  │  ┌──────────────────────────────────────┐  │              │
│  │  │  Display Name                        │  │              │
│  │  └──────────────────────────────────────┘  │              │
│  │  ┌──────────────────────────────────────┐  │              │
│  │  │  Role: [Admin ▼] / [Instructor ▼]   │  │              │
│  │  └──────────────────────────────────────┘  │              │
│  │                                            │              │
│  │  [ Sign In / Register                 ]    │              │
│  │                                            │              │
│  │  ──── OR ────                              │              │
│  │                                            │              │
│  │  [ 🔵 Sign in with Google             ]    │              │
│  │  [ ▶  Try Demo                        ]    │              │
│  │                                            │              │
│  │              [☀ Light] / [🌙 Dark]         │              │
│  └────────────────────────────────────────────┘              │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 App Shell — Sidebar Layout

```
┌──────────┬───────────────────────────────────────────────────┐
│          │  [Star Field Background]                          │
│  ⚡PULSE  │                                                   │
│          │  [Page Content Area]                              │
│ ─────── │                                                   │
│ 📊 Dash  │                                                   │
│ 👥 Studt │                                                   │
│ 📅 Sched │                                                   │
│ 🔔 Alert │  ← badge with unread count                       │
│ ⚙ Setng  │                                                   │
│          │                                                   │
│ ADMIN:   │                                                   │
│ 🏫 Class │                                                   │
│ 👨‍🏫 Instr │                                                   │
│          │                                                   │
│ ─────── │                                                   │
│ [☀/🌙]  │                                                   │
│ [Logout] │                                                   │
└──────────┴───────────────────────────────────────────────────┘
```

### 5.3 Dashboard

```
┌──────────┬───────────────────────────────────────────────────┐
│ Sidebar  │                                                   │
│          │  Dashboard                     [Admin: Class ▼]   │
│          │                                                   │
│          │  TIME: [All] [Today] [Week] [Month] [Qtr] [Year] │
│          │                                                   │
│          │  STAT CARDS (excuse categories — clickable):      │
│          │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│          │  │Total │ │Sick/ │ │Pers  │ │Prog  │ │Tech  │   │
│          │  │  42  │ │Med 12│ │  8   │ │Evt 5 │ │Iss 4 │   │
│          │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘   │
│          │  ┌──────┐ ┌──────┐                               │
│          │  │Other │ │None  │                               │
│          │  │  3   │ │  3   │                               │
│          │  └──────┘ └──────┘                               │
│          │                                                   │
│          │  Records                                          │
│          │  TYPE FILTERS: [All(42)] [Absent(33)] [Late/      │
│          │                Tardy(6)] [Unexcused(3)]           │
│          │  [Count Badge]                                    │
│          │                                                   │
│          │  ACTIONS: [+ Add] [Batch] [📧Gmail] [🔄Clear]    │
│          │  EXPORTS: [CSV] [DOC] [JSON] [🖨Print]           │
│          │                                                   │
│          │  ┌──────────────────────────────────────────────┐ │
│          │  │ Name  │Email  │Date │Type        │Reason   │⚙│ │
│          │  │───────┼───────┼─────┼────────────┼─────────┼──│ │
│          │  │Maria G│maria@ │02/27│[Absent]    │[Sick/▼] │👁🗑│ │
│          │  │Sarah C│sarah@ │02/27│[Late/Tardy]│[Pers ▼] │👁🗑│ │
│          │  │Jordan │jordan@│02/27│[Late/Tardy]│[Tech ▼] │👁🗑│ │
│          │  │Devon K│devon@ │02/27│[Unexcused] │[None ▼] │👁🗑│ │
│          │  └──────────────────────────────────────────────┘ │
└──────────┴───────────────────────────────────────────────────┘
```

### 5.4 Students Page

```
┌──────────┬───────────────────────────────────────────────────┐
│ Sidebar  │                                                   │
│          │  Students                    [Status ▼] [Class ▼] │
│          │  [+ Add Student]                                  │
│          │                                                   │
│          │  ┌──────────────────────────────────────────────┐ │
│          │  │ Name       │ Email          │ Class │ Status │ │
│          │  │────────────┼────────────────┼───────┼────────│ │
│          │  │ Maria G    │ maria@univ.edu │  L1   │ Active │ │
│          │  │ James W    │ james@univ.edu │  L1   │ Active │ │
│          │  │ Tyler B    │ tyler@univ.edu │  L2   │ Grad'd │ │
│          │  └──────────────────────────────────────────────┘ │
│          │                                                   │
│          │  STUDENT PROFILE (click to expand):               │
│          │  ┌──────────────────────────────────────────────┐ │
│          │  │ Maria Garcia            Status: [Active ▼]  │ │
│          │  │ maria.garcia@univ.edu   Class: L1           │ │
│          │  │ [Move to Class ▼]                           │ │
│          │  │                                              │ │
│          │  │ Attendance History (5 records)               │ │
│          │  │ ┌─────────────────────────────────────────┐  │ │
│          │  │ │ Date  │ Type    │ Reason     │ Snippet  │  │ │
│          │  │ │ 02/27 │ Absent  │ Sick/Med   │ Woke up..│  │ │
│          │  │ │ 02/20 │ Late   │ Tech Issue │ Traffic..│  │ │
│          │  │ └─────────────────────────────────────────┘  │ │
│          │  └──────────────────────────────────────────────┘ │
└──────────┴───────────────────────────────────────────────────┘
```

### 5.5 Schedule Page

```
┌──────────┬───────────────────────────────────────────────────┐
│ Sidebar  │                                                   │
│          │  Schedule                        [Class: L1 ▼]    │
│          │  [+ Add Time Block]                               │
│          │                                                   │
│          │  ┌─────┬──────┬──────┬──────┬──────┬──────┬─────┐│
│          │  │     │ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │ Sat ││
│          │  │─────┼──────┼──────┼──────┼──────┼──────┼─────││
│          │  │ 9AM │ Core │ Core │ Core │ Core │ Core │     ││
│          │  │     │Coding│Coding│Coding│Coding│Coding│     ││
│          │  │─────┼──────┼──────┼──────┼──────┼──────┼─────││
│          │  │12PM │Lunch │Lunch │Lunch │Lunch │Lunch │     ││
│          │  │─────┼──────┼──────┼──────┼──────┼──────┼─────││
│          │  │ 1PM │ Lab  │ Lab  │ Lab  │ Lab  │Review│     ││
│          │  └─────┴──────┴──────┴──────┴──────┴──────┴─────┘│
└──────────┴───────────────────────────────────────────────────┘
```

### 5.6 Alerts Page

```
┌──────────┬───────────────────────────────────────────────────┐
│ Sidebar  │                                                   │
│          │  Alerts (3 unread)           [Mark All Read]       │
│          │                                                   │
│          │  ┌──────────────────────────────────────────────┐ │
│          │  │ 🔴 HIGH │ Sarah Chen         │ 1 day ago     │ │
│          │  │ Job interview — asking to leave early and    │ │
│          │  │ whether there will be a recording            │ │
│          │  │ [View Details] [Reply] [Mark Read]           │ │
│          │  ├──────────────────────────────────────────────┤ │
│          │  │ 🟡 MED  │ Alex Johnson       │ 2 days ago    │ │
│          │  │ Student mentioned another student by name,   │ │
│          │  │ reporting that they are also absent           │ │
│          │  │ [View Details] [Reply] [Mark Read]           │ │
│          │  └──────────────────────────────────────────────┘ │
│          │                                                   │
│          │  DETAIL DIALOG (click View Details):              │
│          │  ┌──────────────────────────────────────────────┐ │
│          │  │ From: sarah.chen@university.edu              │ │
│          │  │ Type: Late/Tardy │ Reason: Personal          │ │
│          │  │ Urgency: HIGH                                │ │
│          │  │                                              │ │
│          │  │ Full Email Body:                             │ │
│          │  │ "Hi, I have a job interview at 2 PM today    │ │
│          │  │  and need to leave early. Is it okay if I    │ │
│          │  │  skip the afternoon? Also, will there be a   │ │
│          │  │  recording of the session?"                  │ │
│          │  │                                              │ │
│          │  │ [Reply via Email] [Mark Unread] [Close]      │ │
│          │  └──────────────────────────────────────────────┘ │
│          │                                                   │
│          │  REPLY DIALOG:                                    │
│          │  ┌──────────────────────────────────────────────┐ │
│          │  │ To: sarah.chen@university.edu                │ │
│          │  │ Subject: Re: [original subject]              │ │
│          │  │ ┌────────────────────────────────────────┐   │ │
│          │  │ │ [Reply body text area]                 │   │ │
│          │  │ └────────────────────────────────────────┘   │ │
│          │  │ [Send Reply]                    [Cancel]     │ │
│          │  └──────────────────────────────────────────────┘ │
└──────────┴───────────────────────────────────────────────────┘
```

### 5.7 Admin Classes Page

```
┌──────────┬───────────────────────────────────────────────────┐
│ Sidebar  │                                                   │
│          │  Manage Classes                    [+ Add Class]   │
│          │                                                   │
│          │  ┌──────────────────────────────────────────────┐ │
│          │  │ L1 — Instructor Smith          [Edit] [Del] │ │
│          │  │   3 students (3 active)                     │ │
│          │  │   [Promote Class →]                         │ │
│          │  ├──────────────────────────────────────────────┤ │
│          │  │ L2 — Instructor Smith          [Edit] [Del] │ │
│          │  │   3 students (2 active, 1 graduated)        │ │
│          │  │   [Promote Class →]                         │ │
│          │  ├──────────────────────────────────────────────┤ │
│          │  │ L3 — Instructor Jones          [Edit] [Del] │ │
│          │  │   3 students (3 active)                     │ │
│          │  │   [Promote Class →]                         │ │
│          │  ├──────────────────────────────────────────────┤ │
│          │  │ L∞ — Instructor Jones          [Edit] [Del] │ │
│          │  │   3 students (3 active)                     │ │
│          │  └──────────────────────────────────────────────┘ │
│          │                                                   │
│          │  PROMOTE DIALOG:                                  │
│          │  ┌──────────────────────────────────────────────┐ │
│          │  │ Promote L1 students to: [L2 ▼]              │ │
│          │  │ This will move all 3 active students.       │ │
│          │  │ Graduated/Hired students will not be moved. │ │
│          │  │ [Confirm Promotion]              [Cancel]    │ │
│          │  └──────────────────────────────────────────────┘ │
└──────────┴───────────────────────────────────────────────────┘
```

### 5.8 Settings Page

```
┌──────────┬───────────────────────────────────────────────────┐
│ Sidebar  │                                                   │
│          │  Settings                                         │
│          │                                                   │
│          │  Account                                          │
│          │  ┌──────────────────────────────────────────────┐ │
│          │  │ Username: demo                              │ │
│          │  │ Email: demo@pulse.app                       │ │
│          │  │ Role: Admin                                 │ │
│          │  │ Google: ✅ Connected / ❌ Not connected      │ │
│          │  │ [Reconnect Google Account]                  │ │
│          │  └──────────────────────────────────────────────┘ │
│          │                                                   │
│          │  Scan Schedule                                    │
│          │  ┌──────────────────────────────────────────────┐ │
│          │  │ ✅ 10:00 AM    [Edit] [Delete]              │ │
│          │  │ ✅  6:25 PM    [Edit] [Delete]              │ │
│          │  │ ✅  9:55 PM    [Edit] [Delete]              │ │
│          │  │ [+ Add Scan Time]                           │ │
│          │  └──────────────────────────────────────────────┘ │
└──────────┴───────────────────────────────────────────────────┘
```

### 5.9 Email Detail Modal

```
┌──────────────────────────────────────┐
│  Email Details                    ✕  │
│                                      │
│  Name           Email                │
│  Sarah Chen     sarah.chen@u..       │
│                                      │
│  Date           Type                 │
│  2/27/2026      [Late/Tardy]         │
│                                      │
│  Reason                              │
│  [Personal]                          │
│                                      │
│  Full Email Body                     │
│  ┌──────────────────────────────────┐│
│  │ Hi, I have a job interview at   ││
│  │ 2 PM today and need to leave    ││
│  │ early. Is it okay if I skip     ││
│  │ the afternoon portion?          ││
│  └──────────────────────────────────┘│
└──────────────────────────────────────┘
```

---

## 6. System Tools & Requirements

### 6.1 Runtime Environment

| Requirement | Specification |
|---|---|
| Node.js | v20+ |
| Package Manager | npm |
| Operating System | Linux (NixOS via Replit) |
| Database | PostgreSQL (Neon Serverless) |

### 6.2 Environment Variables

| Variable | Purpose | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `SESSION_SECRET` | Express session encryption key | Yes |
| `PULSE_GOOGLE_CLIENT_ID` | Google OAuth client ID | For Google features |
| `PULSE_GOOGLE_CLIENT_SECRET` | Google OAuth client secret | For Google features |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI API key (via Replit Integrations) | Yes |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | OpenAI base URL (via Replit Integrations) | Yes |

### 6.3 Key Dependencies

**Production**:
| Package | Purpose |
|---|---|
| react (^18) | UI framework |
| express (^5) | HTTP server |
| drizzle-orm | Type-safe database ORM |
| @neondatabase/serverless | PostgreSQL driver |
| openai | AI classification (multi-LLM) |
| bcrypt | Password hashing |
| express-session | Session management |
| connect-pg-simple | PostgreSQL session store |
| docx | DOCX report generation |
| date-fns | Date manipulation and filtering |
| wouter | Client-side routing |
| @tanstack/react-query (^5) | Server state management |
| zod | Schema validation |
| drizzle-zod | Drizzle-to-Zod schema bridge |
| lucide-react | Icons |
| react-icons | Company logos |

**Development**:
| Package | Purpose |
|---|---|
| vite | Build tool + HMR |
| typescript | Type checking |
| tailwindcss | Utility CSS |
| @vitejs/plugin-react | React JSX transform |
| drizzle-kit | Database migrations |

### 6.4 Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start development server (Express + Vite HMR + Scheduler) |
| `npm run build` | Production build |
| `npm run db:push` | Push schema changes to database |

---

## 7. User Flow

### 7.1 Authentication Flow

```
User arrives at PULSE
        │
        ├─── Has account? ──── Yes ──── Enter credentials ──── Validate ──── Dashboard
        │                                                          │
        │                                                     Invalid? ── Show error
        │
        ├─── New user? ──── Fill registration form ──── Select role ──── Create account ──── Dashboard
        │                   (username, email, password,
        │                    display name, role)
        │
        ├─── Google user? ──── Click "Sign in with Google" ──── OAuth consent
        │                          │
        │                     Callback received
        │                          │
        │                     ├── Existing Google user? ── Update tokens ── Dashboard
        │                     ├── Existing email user? ── Link Google ID ── Dashboard
        │                     └── New user? ── Create account (instructor role) ── Dashboard
        │
        └─── Demo? ──── Click "Try Demo" ──── Auto-login as admin with seeded data ──── Dashboard
```

### 7.2 Email Processing Flow

```
User on Dashboard
        │
        ├─── Manual Entry ──── Fill form (name, email, date, body) ──── Submit
        │                                                                  │
        │                                                        Send to Multi-LLM AI
        │                                                        (nano → mini → full)
        │                                                                  │
        │                                                    Classify (type + category + alerts)
        │                                                                  │
        │                                                    Save record to DB
        │                                                    If needsResponse → create alert
        │                                                    ──── Update UI
        │
        ├─── Batch Upload ──── Paste JSON or CSV ──── Parse ──── Validate
        │                                                           │
        │                                                    SSE connection opened
        │                                                           │
        │                                                    For each email:
        │                                                      ├── Send to Multi-LLM AI
        │                                                      ├── Save to DB + create alerts
        │                                                      └── Stream progress event
        │                                                           │
        │                                                    Complete event ──── Update UI
        │
        ├─── Gmail Fetch ──── Search inbox (keyword query)
        │                           │
        │                     Display matching emails with checkboxes
        │                           │
        │                     User selects emails ──── Submit selected
        │                           │
        │                     Same batch processing flow as above
        │
        └─── Automated Scan ──── Scheduler triggers at configured time
                                        │
                                  For each user with Google tokens + enabled configs:
                                        │
                                  Fetch Gmail → Process → Save → Create alerts
```

### 7.3 Dashboard Filtering Flow

```
Dashboard displays records (scoped by role)
        │
        ├─── Admin: sees all records across all classes
        │    └── Can filter by class using dropdown
        │
        ├─── Instructor: sees only records from own classes
        │
        ├─── Filter by attendance type
        │    └── Click: [All] [Absent] [Late/Tardy] [Unexcused] buttons
        │         └── Records table filters to selected type
        │         └── Buttons show count in parentheses
        │
        ├─── Filter by excuse category
        │    └── Click stat card (Sick/Medical, Personal, etc.)
        │         └── Records table filters to selected category
        │         └── Combines with type filter
        │
        ├─── Filter by time period
        │    └── Click: [All] [Today] [Week] [Month] [Quarter] [Year]
        │
        ├─── Change reason ──── Select new value from Reason dropdown ──── PATCH API ──── Update stats
        ├─── View details ──── Click eye icon ──── Modal with full email body + type + reason
        ├─── Delete record ──── Click trash icon ──── DELETE API ──── Remove from table
        ├─── Clear all ──── Confirm ──── DELETE all ──── Empty table
        ├─── Export ──── CSV / DOCX / JSON ──── Download file
        └─── Print ──── Window.print() ──── Print dialog (filtered, no controls)
```

### 7.4 Alert Response Flow

```
Alert appears in feed (and sidebar badge increments)
        │
        ├── View Details ──── Dialog shows full email body, type, reason, urgency
        │
        ├── Reply ──── Reply dialog opens
        │                │
        │           Fill reply body ──── Send
        │                │
        │           POST /api/gmail/send
        │           (uses instructor's Gmail, threads properly)
        │                │
        │           Success toast ──── Alert marked read
        │
        ├── Mark Read ──── PATCH /api/alerts/:id/read ──── Badge decrements
        │
        ├── Mark Unread ──── PATCH /api/alerts/:id/unread ──── Badge increments
        │
        └── Mark All Read ──── POST /api/alerts/mark-all-read ──── Badge → 0
```

### 7.5 Student Management Flow

```
Students Page
        │
        ├── View roster ──── Filter by class / status
        │
        ├── Add student ──── Form (name, email, class) ──── POST /api/students
        │
        ├── Click student ──── Profile view
        │         │
        │         ├── View attendance history (all records for this student)
        │         ├── Change status ──── [Active ▼] / Graduated / Hired
        │         └── Move to class ──── Select target class ──── PATCH /api/students/:id
        │
        └── Admin: Bulk promote ──── Admin Cohorts page
                    │
                    ├── Select source class ──── Click "Promote Class"
                    ├── Select target class
                    └── Confirm ──── All Active students move; Graduated/Hired stay
```

---

## 8. Conditional Logic Trees

### 8.1 Multi-LLM Classification Decision Tree

```
Email received for classification
        │
        ▼
   Send to gpt-5-nano (cheapest)
        │
        ├─── Response received
        │         │
        │         ▼
        │    Parse JSON response
        │         │
        │         ├── confidence >= 0.4? ── Yes ── Use result
        │         │
        │         └── confidence < 0.4 or parse error
        │                  │
        │                  ▼
        │            Escalate to gpt-5-mini
        │                  │
        │                  ├── confidence >= 0.4? ── Yes ── Use result
        │                  │
        │                  └── confidence < 0.4 or parse error
        │                           │
        │                           ▼
        │                     Escalate to gpt-5.2 (full)
        │                           │
        │                           ├── Valid response? ── Use result
        │                           │
        │                           └── Failed ── Default:
        │                                    attendanceType: "Absent"
        │                                    category: "Unexcused"
        │                                    confidence: 0
        │
        └─── API fails (timeout, error)
                  │
                  └── Escalate to next tier (same logic)
```

### 8.2 Attendance Type Classification Logic

```
Analyze email content
        │
        ▼
   Does the person indicate they will still attend?
        │
        ├── YES (e.g., "on my way", "be there soon", "running late",
        │       "leaving early", "stepping out", "stuck in traffic")
        │         │
        │         └── attendanceType = "Late/Tardy"
        │              └── Determine excuse category from reason
        │                   e.g., "late because sick" → Late/Tardy + Sick/Medical
        │                   e.g., "stuck in traffic" → Late/Tardy + Technical Issue
        │                   e.g., "job interview, leaving early" → Late/Tardy + Personal
        │
        ├── NO, they indicate complete absence with a reason
        │         │
        │         └── attendanceType = "Absent"
        │              └── Determine excuse category from reason
        │
        └── NO reason given, vague, or not a genuine excuse
                  │
                  └── attendanceType = "Unexcused"
                       └── excuseCategory = "None"
```

### 8.3 Alert Detection Decision Tree

```
Email classified by AI
        │
        ▼
   needsResponse?
        │
        ├── YES (question, request, time-sensitive matter)
        │    │
        │    ├── Determine urgency:
        │    │    ├── HIGH: job interview, emergency, immediate deadline
        │    │    ├── MEDIUM: schedule change request, accommodation need
        │    │    └── LOW: general question, FYI with follow-up
        │    │
        │    └── Create alert record with alertReason
        │
        ├── mentionsStudent? (peer reporting)
        │    │
        │    └── YES → Create alert: "Student mentioned another student"
        │              Include peerOrSchoolDetail
        │
        ├── mentionsSchool? (program/curriculum mention)
        │    │
        │    └── YES → Create alert: "Email mentions Pursuit/program"
        │              Include peerOrSchoolDetail
        │
        └── None of the above → No alert created
```

### 8.4 Role-Based Access Decision Tree

```
Request arrives at protected endpoint
        │
        ▼
   requireAuth middleware
        │
        ├── Session userId exists? ── No ── Return 401
        │
        └── Yes ── Continue
                │
                ▼
          What type of endpoint?
                │
                ├── Admin-only (cohort management, instructors, bulk promote)?
                │    │
                │    └── requireAdmin middleware
                │         ├── role === 'admin'? ── Yes ── Allow
                │         └── No ── Return 403
                │
                ├── Data endpoint (records, students, schedules)?
                │    │
                │    ├── role === 'admin'? ── Bypass ownership ── Return all data
                │    │
                │    └── role === 'instructor'?
                │         │
                │         └── Check cohort ownership
                │              ├── Cohort belongs to instructor? ── Allow
                │              └── No ── Return 403/404
                │
                └── User-specific (alerts, scan configs, settings)?
                     │
                     └── Filter by session userId automatically
```

### 8.5 Google OAuth Decision Tree

```
OAuth callback received with authorization code
        │
        ▼
   Validate CSRF state parameter matches session
        │
        ├── Mismatch ── Return error
        │
        └── Match ──
                  │
                  ▼
             Exchange code for tokens (access_token, refresh_token)
                  │
                  ▼
             Fetch Google profile (email, name, googleId)
                  │
                  ▼
             Lookup user
                  │
                  ├── User with this googleId exists?
                  │         └── Update tokens ── Set session ── Redirect to dashboard
                  │
                  ├── User with this email exists (no googleId)?
                  │         └── Link googleId + store tokens ── Set session ── Redirect
                  │
                  └── No user found?
                           └── Create new user (random password, instructor role)
                                └── Store tokens ── Set session ── Redirect
```

### 8.6 Gmail Token Refresh Decision Tree

```
Gmail API request made (read or send)
        │
        ▼
   Response status?
        │
        ├── 200 OK ── Parse and return data
        │
        ├── 401 Unauthorized
        │         │
        │         ├── Refresh token available?
        │         │         │
        │         │         ├── Yes ── POST to Google token endpoint
        │         │         │              │
        │         │         │              ├── New access token received
        │         │         │              │         └── Update DB ── Retry original request
        │         │         │              │
        │         │         │              └── Refresh failed ── Return error
        │         │         │
        │         │         └── No ── Return "Please reconnect Gmail"
        │
        └── Other error ── Return error message
```

### 8.7 Email Reply Security Decision Tree

```
POST /api/gmail/send received
        │
        ▼
   Sanitize all string fields (strip CRLF characters)
        │
        ▼
   alertId provided?
        │
        ├── Yes ── Lookup alert → get associated record
        │    │
        │    └── Record senderEmail matches "to" field?
        │         ├── Yes ── Allow send
        │         └── No ── Return 403 (recipient mismatch)
        │
        └── No alertId ── Allow send (manual compose)
                │
                ▼
           Build RFC 2822 email with:
           - In-Reply-To header (for threading)
           - References header (for threading)
           - Gmail threadId (for Gmail UI threading)
                │
                ▼
           Base64url encode → POST to Gmail API
                │
                ├── Success ── Return 200
                └── 401 ── Attempt token refresh ── Retry
```

### 8.8 Student Status & Progression Decision Tree

```
Status change requested (PATCH /api/students/:id)
        │
        ▼
   Validate status value
        │
        ├── Valid (Active/Graduated/Hired)?
        │    │
        │    ├── Instructor? ── Check cohort ownership ── Allow/Deny
        │    ├── Admin? ── Allow
        │    └── Update student status
        │
        └── Invalid ── Return 400

Bulk promote requested (POST /api/cohorts/:id/promote)
        │
        ▼
   Admin only (requireAdmin)
        │
        ▼
   Validate source and target cohorts exist
        │
        ├── Same cohort? ── Return 400
        │
        └── Different cohorts ──
                  │
                  ▼
             Get all students in source cohort
                  │
                  ▼
             For each student:
                  │
                  ├── status === 'Active'? ── Move to target cohort
                  │
                  └── status === 'Graduated' or 'Hired'? ── Skip (stay in place)
```

### 8.9 Theme Toggle Decision Tree

```
Theme toggle clicked
        │
        ▼
   Current theme?
        │
        ├── "dark" ── Switch to "light"
        │                 │
        │                 ├── Remove .dark from <html>
        │                 ├── Store "light" in localStorage
        │                 └── Star field: 20 corner sparkles (violet/indigo)
        │
        └── "light" ── Switch to "dark"
                          │
                          ├── Add .dark to <html>
                          ├── Store "dark" in localStorage
                          └── Star field: 120 stars (4 animation types, varied colors)
```

### 8.10 Time Period Filtering Decision Tree

```
Time period button clicked
        │
        ▼
   Selected period
        │
        ├── "all" ── Show all records (no date filter)
        ├── "day" ── startOfDay(today) to endOfDay(today)
        ├── "week" ── startOfWeek(today) to endOfWeek(today)
        ├── "month" ── startOfMonth(today) to endOfMonth(today)
        ├── "quarter" ── startOfQuarter(today) to endOfQuarter(today)
        └── "year" ── startOfYear(today) to endOfYear(today)
              │
              ▼
        Filter records where receivedAt is within range
              │
              ▼
        Update stat cards + type filter counts + table display
```

---

## 9. Full Project Report

### 9.1 Executive Summary

PULSE (version 3.0) is a production-ready, multi-tenant attendance automation tool built for Pursuit's tech training program. It combines AI-powered email classification with role-based access control, student roster management, class progression, automated Gmail scanning, alert detection, and direct email reply — all wrapped in a polished, accessible, space-themed interface.

Key differentiators:
- **Multi-tenant architecture**: Admin sees everything; instructors see only their assigned classes
- **Dual-classification system**: Separates "what happened" (Absent vs. Late/Tardy vs. Unexcused) from "why" (Sick/Medical, Personal, etc.)
- **Multi-LLM cost optimization**: nano → mini → full model chain minimizes AI costs while maintaining accuracy
- **Alert intelligence**: AI detects questions, requests, urgency, peer mentions, and school/program mentions
- **Direct reply**: Instructors reply to student emails from the portal with proper Gmail threading
- **Student lifecycle**: Active → Graduated → Hired tracking with class progression (bulk promote)
- **Automated scanning**: Configurable Gmail scan times with background scheduler
- **Multiple ingestion methods**: Manual entry, batch upload, Gmail fetch, and automated scan
- **Three export formats**: CSV, DOCX, JSON + filtered print view

### 9.2 Feature Completeness

| Feature | Status | Notes |
|---|---|---|
| Username/password auth | Complete | Bcrypt hashing, session management |
| Role-based access (admin/instructor) | Complete | requireAuth, requireAdmin middleware, cohort ownership checks |
| Google OAuth | Complete | Full flow with token refresh, reconnect for scope upgrades |
| Demo mode | Complete | Admin + 2 instructors, 4 classes, 12 students, 7 records, 2 alerts |
| Manual email entry | Complete | Single form with validation |
| Batch upload | Complete | JSON and CSV support, SSE streaming |
| Gmail fetch | Complete | Search, select, process with Message-ID storage |
| Gmail send (reply) | Complete | Threaded replies from Alerts page with header injection prevention |
| Multi-LLM AI classification | Complete | Keyword pre-classifier (free) → gpt-4o-mini → gpt-4o fallback chain |
| Alert detection | Complete | needsResponse, urgency, peer mentions, school mentions |
| Alert management | Complete | Feed, mark read/unread, detail view, reply, sidebar badge |
| Attendance type filter buttons | Complete | All/Absent/Late-Tardy/Unexcused with counts |
| Excuse category stat cards | Complete | Total, Sick/Medical, Personal, Program Event, Tech Issue, Other, None |
| Combined filtering | Complete | Type buttons + category cards + time period all combine |
| Class management | Complete | L1/L2/L3/L∞ CRUD with instructor assignment |
| Student roster | Complete | Per-class lists, status badges, filter by class/status |
| Student profile | Complete | Attendance history, status change, move between classes |
| Student status tracking | Complete | Active/Graduated/Hired with visual indicators |
| Class progression | Complete | Bulk promote (active only) + individual move |
| Weekly schedule | Complete | Grid view, add/edit/delete time blocks per class |
| Automated multi-source scanning | Complete | 30s interval scheduler; per-source Gmail/Slack toggles per scan time; 5 default times |
| Scan schedule config | Complete | Add/edit/delete/toggle scan times in Settings; Gmail/Slack toggles per time |
| Slack scanning backend | Complete | Scans channels + DMs for attendance keywords; AI classify; student matching |
| Multi-source dashboard | Complete | Source filter buttons, source column with icons, source-aware detail dialog |
| Time-period filtering | Complete | Today/Week/Month/Quarter/Year/All |
| CSV export | Complete | All records |
| DOCX export | Complete | Grouped by excuse category |
| JSON export | Complete | Formatted for import |
| Print view | Complete | Filtered, no interactive controls |
| Dark mode | Complete | 120 animated stars, space theme |
| Light mode | Complete | 20 corner sparkles, clean theme |
| Theme persistence | Complete | localStorage |
| Sidebar navigation | Complete | Role-based items, alert badge, collapse on mobile |
| Responsive design | Complete | Mobile-first with breakpoints |
| Slack channel scanning | Complete | Channel + thread + DM scanning; keyword match → AI classify; deduplication |
| Slack channel config UI | Complete | Settings page; admin can add/toggle/delete channel mappings |
| Slack reply from portal | Complete | Reply in-thread via chat.postMessage from Alerts page |
| Student Slack ID mapping | Complete | slackUserId on students table; editable from profile; scanner prioritizes it |
| Duplicate message prevention | Complete | gmailMessageId + slackMessageTs dedup before creating records |
| Dashboard analytics | Complete | Attendance trend bar chart + top students; toggled via Analytics button |
| Notification system | Complete | 60s polling of unread count; toast fires when new alerts arrive |
| Thread message scanning | Complete | conversations.replies fetched for all parent messages with replies |
| AI draft reply | Complete | Reply dialog auto-generates draft using student context; editable before send |
| Expanded keyword detection | Complete | NYC transit, life situations, caretaking, parenting, weather, work conflicts |

### 9.3 Security Measures

- **Password Security**: Bcrypt with salt rounds
- **Session Security**: PostgreSQL-backed sessions, httpOnly cookies, secure flag in production
- **OAuth Security**: CSRF state parameter, server-side token exchange, token auto-refresh
- **Role Authorization**: requireAdmin middleware for admin-only endpoints; cohort ownership verification for instructor endpoints
- **Data Isolation**: All queries scoped to user role — admins see all, instructors see own classes only
- **Input Validation**: Zod schemas validate all incoming data; status enum validation; field allowlisting on PATCH
- **Email Security**: CRLF header injection prevention on email sends; recipient validation against original sender when replying to alerts
- **API Protection**: All data endpoints require `requireAuth` middleware; admin endpoints additionally require `requireAdmin`
- **Token Management**: Google tokens stored server-side, never exposed to client; auto-refresh on expiry

### 9.4 Accessibility Compliance

- Semantic HTML elements (`<main>`, `<nav>`, `<section>`, `<table>`)
- ARIA labels on interactive elements
- `data-testid` attributes on all interactive and meaningful display elements
- Keyboard-navigable forms and buttons
- Color contrast meeting WCAG 2 AA standards
- Focus indicators on interactive elements
- Responsive layout for various screen sizes
- Print-friendly CSS with `@media print` rules

### 9.5 Performance Characteristics

- **Frontend**: Vite HMR for instant dev feedback; code splitting via dynamic imports
- **AI Costs**: Multi-LLM fallback starts with cheapest model; only escalates when needed
- **Data Fetching**: TanStack Query v5 with caching, automatic refetching, and cache invalidation
- **Batch Processing**: SSE streaming prevents timeout on large batches
- **Database**: Drizzle ORM generates optimized SQL; Neon Serverless for auto-scaling
- **Styling**: Tailwind CSS purges unused styles in production
- **Scheduler**: Lightweight 30s interval check (not cron — simple and predictable)

### 9.6 Known Limitations

- Gmail integration requires Google Cloud Console setup (authorized test users for apps in testing mode)
- Google OAuth redirect URI must match exactly in Google Cloud Console
- Exports include all records regardless of active time filter (by design; print respects filter)
- Maximum 50 Gmail messages fetched per search query
- AI classification depends on OpenAI API availability and rate limits
- Demo account has no Gmail functionality (no Google ID linked)
- Slack scanning requires a `SLACK_BOT_TOKEN` with specific scopes — see System Tools section
- Scan times are stored as "HH:MM" strings; scheduler checks every 30 seconds
- Slack DM scanning only processes messages from known students (matched by email or name)

### 9.7 Deployment

- **Platform**: Replit (auto-managed infrastructure)
- **Database**: PostgreSQL via Neon Serverless (connection via `DATABASE_URL`)
- **Build**: `npm run build` compiles TypeScript and bundles frontend
- **Serve**: Express serves both API and static frontend assets
- **Domain**: Available under `.replit.app` or custom domain

---

## 10. Project Roadmap

### 10.1 Completed (v5.0)

- Multi-tenant with Admin/Instructor roles
- Class management (L1, L2, L3, L∞) with instructor assignment
- Student roster with Active/Graduated/Hired status tracking
- Class progression (bulk promote, individual move)
- Dual-classification AI (attendance type + excuse category)
- Hybrid AI classification (keyword pre-classifier free tier + gpt-4o-mini/gpt-4o fallback)
- Alert system with urgency, peer mentions, school mentions
- Direct email reply from portal with Gmail threading
- Automated multi-source scanning (Gmail + Slack) at 5 configurable times
- Per-source scan toggles (Gmail/Slack independently per time slot) in Settings
- Slack scanning backend (channel + DM scanning with keyword match → AI classify)
- Multi-source dashboard (source filter buttons, source column, source-aware detail dialog)
- Attendance type filter buttons on Dashboard
- Excuse category stat cards on Dashboard
- Combined filtering (type + category + time period + source)
- Weekly class schedule management
- CSV/DOCX/JSON export + filtered print
- Dark/light mode with animated star field and proper contrast in both modes
- Google OAuth with reconnect for scope upgrades
- Settings page with scan schedule config and per-source toggles
- Slack channel config CRUD UI in Settings (admin only)
- **Duplicate message prevention** — Gmail + Slack dedup using gmailMessageId / slackMessageTs
- **Student Slack ID mapping** — slackUserId on students table, editable from profile, scanner prioritizes it
- **Slack reply from portal** — Reply in-thread to Slack messages from Alerts page via chat.postMessage
- **Dashboard analytics** — Attendance trend bar chart + top students by absence count (Analytics toggle)
- **Notification system** — Sidebar polls unread count every 60s; toast fires when new alerts arrive
- **Thread message scanning** — Slack scanner fetches thread replies (conversations.replies) for parent messages with replies
- **AI draft reply** — Reply dialog auto-generates contextual draft using student name, type, category, and assessment action
- **Expanded keyword detection** — NYC transit, life situations (caretaking, parenting, housing, legal, mental health, work), weather, general notification phrases

### 10.2 Current Status & What Still Needs To Be Done

#### COMPLETED — All code built and functional:
- All core attendance features (classification, alerts, records, exports)
- Gmail integration (OAuth, fetch, send, automated scanning, dedup)
- Slack integration (channel + thread + DM scanning, dedup, reply from portal, channel config UI)
- Student Slack ID mapping (schema + profile UI + scanner priority)
- Dashboard analytics (trend chart + top students by absence)
- Notification system (60s polling + toast on new alerts)
- AI draft reply (auto-generated contextual draft pre-fills reply dialog)
- Per-source scan controls (Settings UI + backend)
- Multi-source dashboard (Gmail/Slack filter, source column, icons)
- Light/dark mode with proper contrast in both modes
- Expanded keyword coverage (NYC transit, life roles, general notification phrases)
- Roster-only scanning — non-roster senders skipped before any AI call

#### NEEDS EXTERNAL SETUP — Credentials and one-time actions required:

| Item | What's Needed | Status |
|---|---|---|
| **OpenAI API Key** | Set `OPENAI_API_KEY` in `.env` from platform.openai.com | Required for AI classification |
| **Google OAuth** | Set `PULSE_GOOGLE_CLIENT_ID` + `PULSE_GOOGLE_CLIENT_SECRET` in `.env`; move app from Testing → Production in Google Cloud Console | Required for Gmail features |
| **SLACK_BOT_TOKEN** | Create Slack app → add scopes → install to workspace → copy `xoxb-` token → set in `.env` | Required for Slack scanning |
| **Slack Channel Config** | After token is set, add cohort channels in Settings → Slack Integration | Required for channel scanning |
| **Database migration** | Run `npm run db:push` to apply `slack_user_id` column on students table | Required once |

#### Slack Bot Scopes Required:
```
channels:history
groups:history
im:history
users:read
users:read.email
chat:write
channels:read
groups:read
```

#### TODO LIST — Future features (all current P1/P2 items complete):

| # | Task | Details |
|---|---|---|
| 1 | **Calendar Integration** | Sync class schedules with Google Calendar |
| 2 | **Student Self-Service Portal** | Students confirm/update their own absence details |
| 3 | **Custom Alert Rules** | Configurable thresholds (e.g., alert if student absent 3+ times in a month) |
| 4 | **Mobile App / PWA** | Progressive Web App for on-the-go alert management |
| 5 | **Webhook Support** | Trigger external systems (Zapier, etc.) when alerts are created |
| 6 | **SMS/Text Notifications** | Alert instructors via text for high-urgency messages |
| 7 | **Parent/Guardian Notifications** | Auto-notify family contacts for students |

---

## 11. System Tools & Requirements

### 11.1 Runtime Environment

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 20+ | JavaScript/TypeScript runtime |
| TypeScript | 5.x | Type-safe development |
| tsx | Latest | TypeScript execution (dev server) |
| npm | 10+ | Package manager |

### 11.2 Database

| Service | Details |
|---|---|
| PostgreSQL | Primary database (via Neon Serverless) |
| Connection | `DATABASE_URL` environment variable |
| ORM | Drizzle ORM with drizzle-zod for schema validation |
| Driver | `@neondatabase/serverless` (WebSocket-based) |
| Sessions | `connect-pg-simple` stores sessions in PostgreSQL |

### 11.3 External APIs & Services

| Service | Purpose | Auth Method | Required |
|---|---|---|---|
| **OpenAI API** | AI classification of attendance messages | Replit AI Integrations (auto-configured) | YES |
| **Google OAuth 2.0** | User sign-in + Gmail read/send access | OAuth 2.0 Authorization Code flow | YES (for Gmail features) |
| **Gmail API** | Read inbox, send replies | OAuth 2.0 Bearer token | YES (for email scanning/reply) |
| **Slack Web API** | Scan channels/DMs for attendance messages | Bot User OAuth Token | OPTIONAL (for Slack scanning) |

### 11.4 Google Cloud Console Setup (Required for Gmail)

To enable Gmail integration, the following Google Cloud Console setup is required:

1. **Create a Google Cloud Project** at https://console.cloud.google.com
2. **Enable APIs**:
   - Gmail API
   - Google Identity Services / People API (for OAuth sign-in)
3. **Create OAuth 2.0 Credentials**:
   - Application type: Web application
   - Authorized redirect URI: `https://<your-domain>/api/auth/google/callback`
   - For Replit: use `https://<repl-name>.<username>.repl.co/api/auth/google/callback` or `https://<custom-domain>/api/auth/google/callback`
4. **Configure OAuth Consent Screen**:
   - App name: PULSE
   - Scopes: `openid`, `userinfo.email`, `userinfo.profile`, `gmail.readonly`, `gmail.send`
   - User type: External (for production) or Internal (for org-only)
   - **IMPORTANT**: If the app is in "Testing" mode, only emails explicitly added as test users can sign in. To allow all users, submit for Google verification or move to "Production" mode.
5. **Set Environment Variables**:
   - `PULSE_GOOGLE_CLIENT_ID` = Client ID from step 3
   - `PULSE_GOOGLE_CLIENT_SECRET` = Client Secret from step 3

**Current Status**: The `PULSE_GOOGLE_CLIENT_ID` env var is listed as a missing secret. It must be set for Google OAuth to work. The `PULSE_GOOGLE_CLIENT_SECRET` is already configured.

### 11.5 Slack App Setup (Required for Slack Scanning)

To enable Slack message scanning, the following Slack app setup is required:

1. **Create a Slack App** at https://api.slack.com/apps
   - Choose "From scratch"
   - Name: PULSE Attendance Scanner
   - Workspace: Pursuit workspace
2. **Add Bot Token Scopes** (OAuth & Permissions → Scopes → Bot Token Scopes):
   - `channels:history` — Read messages in public channels
   - `groups:history` — Read messages in private channels
   - `im:history` — Read direct messages
   - `channels:read` — List channels
   - `users:read` — Get user info (name)
   - `users:read.email` — Get user email (for student matching)
   - `chat:write` — Send messages (for future reply feature)
3. **Install to Workspace**: Click "Install to Workspace" and authorize
4. **Copy Bot Token**: OAuth & Permissions → Bot User OAuth Token (starts with `xoxb-`)
5. **Set Environment Variable**: `SLACK_BOT_TOKEN` = the bot token from step 4
6. **Invite Bot to Channels**: The bot must be invited to each channel it should scan (`/invite @PULSE`)
7. **Configure Channel Mappings**: Use the API to map Slack channels to classes:
   ```
   POST /api/slack-channels
   { "cohortId": 1, "channelId": "C06XXXXXXX", "channelName": "#l1-attendance" }
   ```

**Current Status**: `SLACK_BOT_TOKEN` is NOT configured. The Slack scanner will gracefully skip scanning and log a warning when the token is missing.

### 11.6 Environment Variables / Secrets

| Variable | Required | Status | Description |
|---|---|---|---|
| `DATABASE_URL` | YES | Configured | PostgreSQL connection string (Neon) |
| `SESSION_SECRET` | YES | Configured | Express session cookie signing key |
| `PULSE_GOOGLE_CLIENT_ID` | YES (for Gmail) | **MISSING** | Google OAuth Client ID |
| `PULSE_GOOGLE_CLIENT_SECRET` | YES (for Gmail) | Configured | Google OAuth Client Secret |
| `GOOGLE_CLIENT_SECRET` | — | Configured | (Legacy/duplicate — `PULSE_GOOGLE_CLIENT_SECRET` is used) |
| `SLACK_BOT_TOKEN` | Optional | **NOT SET** | Slack Bot User OAuth Token for channel/DM scanning |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | YES | Auto-configured | OpenAI API key (via Replit AI Integrations) |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | YES | Auto-configured | OpenAI base URL (via Replit AI Integrations) |

### 11.7 NPM Dependencies

**Core Backend:**
| Package | Version | Purpose |
|---|---|---|
| express | ^5.0.1 | Web framework (REST API + SSE) |
| express-session | ^1.18.1 | Session management |
| connect-pg-simple | ^10.0.0 | PostgreSQL session store |
| passport | ^0.7.0 | Authentication middleware |
| passport-local | ^1.0.0 | Local username/password strategy |
| bcrypt | ^6.0.0 | Password hashing |
| pg | ^8.16.3 | PostgreSQL client |
| drizzle-orm | ^0.39.3 | Type-safe ORM |
| @neondatabase/serverless | ^1.0.2 | Neon PostgreSQL driver |
| ws | ^8.18.0 | WebSocket library (used by Neon) |
| zod | ^3.25.76 | Schema validation |
| drizzle-zod | ^0.7.1 | Drizzle-to-Zod schema bridge |
| openai | ^6.25.0 | OpenAI API client |

**Frontend:**
| Package | Version | Purpose |
|---|---|---|
| react | ^18.3.1 | UI library |
| react-dom | ^18.3.1 | React DOM renderer |
| wouter | ^3.3.5 | Lightweight routing |
| @tanstack/react-query | ^5.60.5 | Server state management |
| @radix-ui/react-* | Various | Accessible UI primitives (20+ packages) |
| lucide-react | ^0.453.0 | Action icons |
| react-icons | ^5.4.0 | Brand logos (Google, etc.) |
| framer-motion | ^11.13.1 | Animations |
| recharts | ^2.15.2 | Charts/data visualization |
| tailwindcss | ^3.4.17 | Utility-first CSS |
| class-variance-authority | ^0.7.1 | Dynamic class management |
| tailwind-merge | ^2.6.0 | Tailwind class deduplication |

**Utilities:**
| Package | Version | Purpose |
|---|---|---|
| date-fns | ^3.6.0 | Date utilities (time-period filtering) |
| docx | ^9.6.0 | DOCX document generation |
| file-saver | ^2.0.5 | Client-side file downloads |
| p-limit | ^7.3.0 | Promise concurrency limiter |
| p-retry | ^7.1.1 | Retry logic for API calls |

**Dev Tools:**
| Package | Version | Purpose |
|---|---|---|
| typescript | ^5.6.3 | TypeScript compiler |
| tsx | ^4.19.2 | TypeScript execution |
| vite | ^5.4.14 | Build tool + dev server |
| esbuild | ^0.24.2 | Fast TypeScript/JS bundler |
| @vitejs/plugin-react | ^4.3.4 | React support for Vite |
| tailwindcss | ^3.4.17 | CSS framework |
| postcss | ^8.4.49 | CSS processing |
| autoprefixer | ^10.4.20 | CSS vendor prefixes |
| drizzle-kit | ^0.30.4 | Drizzle schema migration tool |

---

*End of PULSE Project Documentation v5.0*
