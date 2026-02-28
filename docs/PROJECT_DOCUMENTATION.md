# PULSE — Project Documentation

**Attendance Automation Tool**
**Version:** 2.0
**Last Updated:** February 28, 2026

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

---

## 1. Product Requirements Document (PRD)

### 1.1 Product Overview

PULSE is a space-themed, multi-user attendance automation tool designed for program administrators, instructors, and team leads. It processes builder/student absence and tardiness excuse emails, categorizes them via OpenAI using a dual-classification system (attendance type + excuse reason), and generates printable CSV/DOCX/JSON reports. The application features Google OAuth integration for Gmail inbox fetching, time-period filtering, WCAG 2 accessibility, and a dark/light mode toggle with animated star sparkles.

### 1.2 Problem Statement

Program administrators spend significant time manually reading and sorting student/builder absence and tardiness emails. PULSE automates this process by ingesting emails (manually, in batch, or directly from Gmail), using AI to determine both the attendance type (Absent, Late/Tardy, or Unexcused) and the excuse reason (Sick/Medical, Personal, Program Event, Technical Issue, Other, or None), and presenting the data in a filterable, exportable dashboard.

### 1.3 Target Users

- Program administrators and coordinators
- Instructors and teaching assistants
- Team leads managing cohort attendance
- Any role requiring systematic absence/tardiness tracking

### 1.4 Core Features

| Feature | Description |
|---|---|
| **Dual-Classification AI** | Every email is classified on two axes: Attendance Type (Absent, Late/Tardy, Unexcused) and Excuse Category (Sick/Medical, Personal, Program Event, Technical Issue, Other, None) |
| **Manual Email Entry** | Single email form with sender name, email, date, and body |
| **Batch Upload** | Paste or upload JSON/CSV with multiple emails; processed with real-time SSE streaming |
| **Gmail Fetch** | OAuth 2.0 + Gmail API to search, select, and process emails directly from inbox |
| **Time-Period Filtering** | Filter records by Day, Week, Month, Quarter, Year, or All Time |
| **Category Stats Dashboard** | Live stat cards with icons and glow effects for each classification |
| **Inline Category Editing** | Dropdown in each row to manually reclassify a record |
| **CSV Export** | All records downloaded as `attendance_report.csv` |
| **DOCX Export** | Records grouped by category into a formatted Word document |
| **JSON Export** | All records as formatted JSON for database import |
| **Print View** | Respects active time-period filter; hides interactive controls |
| **Dark / Light Mode** | Toggle between space-dark and clean-light themes; star field adapts |
| **Demo Mode** | One-click demo account with pre-seeded records |
| **WCAG 2 Accessibility** | Semantic HTML, ARIA labels, keyboard navigation, contrast ratios |

### 1.5 Attendance Classification System

PULSE uses a dual-classification approach to accurately track attendance:

**Attendance Types** (Was the person present?):
| Type | Meaning |
|---|---|
| Absent | Student will not attend at all |
| Late/Tardy | Student will attend but will not arrive on time, or is leaving early |
| Unexcused | No valid reason provided or message is not a genuine excuse |

**Excuse Categories** (Why?):
| Category | Examples |
|---|---|
| Sick/Medical | Flu, migraine, doctor appointment, hospital, COVID, mental health day, surgery, under the weather |
| Personal | Family emergency, funeral, wedding, travel, jury duty, court date, bereavement, child care, moving |
| Program Event | Conference, workshop, hackathon, career fair, field trip, orientation, guest speaker, company visit |
| Technical Issue | Internet down, laptop broken, power outage, car broke down, bus delayed, can't log in, WiFi issues |
| Other | Valid reason that does not fit the above categories |
| None | Used when attendance type is Unexcused and no valid reason exists |

**Important Classification Rules:**
- If someone says "running late because I'm sick" → Attendance Type = Late/Tardy, Excuse Category = Sick/Medical
- If someone says "I won't be in today, I have the flu" → Attendance Type = Absent, Excuse Category = Sick/Medical
- If someone says "can't make it, something came up" (no details) → Attendance Type = Unexcused, Excuse Category = None
- Leaving early or stepping out partway → Attendance Type = Late/Tardy

### 1.6 Non-Functional Requirements

- **Performance**: SSE streaming for batch processing; sub-second UI interactions
- **Security**: Bcrypt password hashing; session-based auth; CSRF state for OAuth; per-user data isolation
- **Accessibility**: WCAG 2 AA contrast, keyboard navigation, semantic elements, ARIA attributes
- **Browser Support**: Modern evergreen browsers (Chrome, Firefox, Safari, Edge)
- **Responsive**: Mobile-first with breakpoints at `md` (768px) and `lg` (1024px)

---

## 2. Architecture Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                     CLIENT (React)                  │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │ Auth Page │  │ Dashboard │  │ Theme / StarField│  │
│  └────┬─────┘  └─────┬─────┘  └──────────────────┘  │
│       │               │                              │
│  ┌────┴───────────────┴────────────────────────────┐ │
│  │          TanStack Query + Fetch API             │ │
│  └─────────────────────┬───────────────────────────┘ │
└────────────────────────┼─────────────────────────────┘
                         │ HTTP / SSE
┌────────────────────────┼─────────────────────────────┐
│                   SERVER (Express 5)                 │
│  ┌─────────┐  ┌───────┴──────┐  ┌────────────────┐  │
│  │  Auth   │  │   Routes     │  │  Google OAuth   │  │
│  │ (bcrypt)│  │ (CRUD, SSE)  │  │  + Gmail API    │  │
│  └────┬────┘  └──────┬───────┘  └───────┬─────────┘  │
│       │              │                  │            │
│  ┌────┴──────────────┴──────────────────┴──────────┐ │
│  │               Storage Layer (IStorage)          │ │
│  └──────────────────────┬──────────────────────────┘ │
│                         │                            │
│  ┌──────────────────────┴──────────────────────────┐ │
│  │        Drizzle ORM  →  PostgreSQL (Neon)        │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │          OpenAI API (Categorization)             ││
│  └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18, TypeScript | SPA with component-based UI |
| Routing | wouter | Lightweight client-side routing |
| State | TanStack Query v5 | Server state, caching, mutations |
| Styling | Tailwind CSS 3 | Utility-first CSS with dark mode |
| UI Library | shadcn/ui (Radix primitives) | Accessible, customizable components |
| Icons | lucide-react | Consistent iconography |
| Build | Vite 5 | HMR, ESBuild transforms |
| Server | Express 5 | REST API + SSE endpoints |
| ORM | Drizzle ORM | Type-safe SQL queries |
| Database | PostgreSQL (Neon Serverless) | Persistent data storage |
| Auth | express-session + bcrypt | Session cookies, password hashing |
| OAuth | Google OAuth 2.0 | Gmail access for email fetching |
| AI | OpenAI GPT (via Replit AI Integrations) | Email classification |
| Documents | docx (npm) | DOCX generation |
| Dates | date-fns | Time-period filtering |

### 2.3 Directory Structure

```
pulse/
├── client/
│   ├── index.html
│   ├── public/
│   │   └── favicon.png
│   └── src/
│       ├── main.tsx                    # React entry point
│       ├── App.tsx                     # Router + Providers
│       ├── index.css                   # Global styles, star animations, theme vars
│       ├── pages/
│       │   ├── auth.tsx                # Login / Register / OAuth / Demo
│       │   ├── dashboard.tsx           # Main dashboard with stats, filters, table
│       │   └── not-found.tsx           # 404 page
│       ├── components/
│       │   ├── ui/                     # 30+ shadcn/ui components
│       │   ├── add-email-dialog.tsx    # Manual single email entry
│       │   ├── batch-upload-dialog.tsx # JSON/CSV batch processing
│       │   ├── gmail-fetch-dialog.tsx  # Gmail inbox search + select
│       │   ├── records-table.tsx       # Data table with inline editing
│       │   ├── star-field.tsx          # Animated star/sparkle background
│       │   └── theme-provider.tsx      # Dark/Light mode context
│       ├── hooks/
│       │   ├── use-auth.ts            # Auth state hook
│       │   ├── use-mobile.tsx         # Responsive breakpoint hook
│       │   └── use-toast.ts           # Toast notification hook
│       └── lib/
│           ├── queryClient.ts         # TanStack Query config + apiRequest
│           └── utils.ts               # cn() utility
├── server/
│   ├── index.ts                       # Express server bootstrap
│   ├── auth.ts                        # Login/register/demo/session routes
│   ├── google-auth.ts                 # OAuth 2.0 flow + Gmail API
│   ├── routes.ts                      # CRUD, batch processing, exports
│   ├── openai.ts                      # AI categorization function
│   ├── storage.ts                     # IStorage interface + DatabaseStorage
│   ├── db.ts                          # Drizzle + Neon connection
│   ├── seed.ts                        # Demo data seeder
│   ├── vite.ts                        # Vite dev middleware
│   └── static.ts                      # Static file serving (production)
├── shared/
│   ├── schema.ts                      # Drizzle schema, Zod schemas, types
│   └── models/
│       └── chat.ts                    # Chat integration models
├── docs/
│   └── PROJECT_DOCUMENTATION.md       # This file
├── drizzle.config.ts
├── tailwind.config.ts
├── vite.config.ts
├── tsconfig.json
├── components.json
├── package.json
└── replit.md
```

### 2.4 Data Flow

1. **Email Ingestion**: Email arrives via manual entry, batch upload, or Gmail fetch
2. **AI Classification**: `categorizeExcuse()` in `server/openai.ts` sends the email body to OpenAI, which returns both an attendance type and an excuse category
3. **Storage**: Record is persisted in PostgreSQL via the storage layer
4. **SSE Streaming**: For batch processing, each result is streamed to the client as it completes
5. **Dashboard**: TanStack Query fetches records and stats; UI renders filtered, sortable data
6. **Export**: CSV/DOCX/JSON endpoints generate downloadable files from all user records

---

## 3. Entity-Relationship Diagram (ERD)

### 3.1 Database Schema

```
┌─────────────────────────────────┐
│            users                │
├─────────────────────────────────┤
│ id            SERIAL PK        │
│ username      TEXT NOT NULL UQ  │
│ email         TEXT NOT NULL UQ  │
│ password      TEXT NOT NULL     │
│ display_name  TEXT NOT NULL     │
│ google_id     TEXT UQ           │
│ google_access_token  TEXT       │
│ google_refresh_token TEXT       │
│ created_at    TIMESTAMP        │
└────────────┬────────────────────┘
             │
             │ 1:N (user_id → users.id)
             │
┌────────────┴────────────────────┐
│      attendance_records         │
├─────────────────────────────────┤
│ id              SERIAL PK      │
│ user_id         INT NOT NULL FK│
│ sender_name     TEXT NOT NULL   │
│ sender_email    TEXT NOT NULL   │
│ received_at     TIMESTAMP      │
│ email_body      TEXT NOT NULL   │
│ attendance_type TEXT NOT NULL   │
│ excuse_category TEXT NOT NULL   │
│ message_snippet TEXT NOT NULL   │
│ status          TEXT NOT NULL   │
│ batch_id        TEXT            │
│ created_at      TIMESTAMP      │
└─────────────────────────────────┘
```

### 3.2 Field Descriptions

**users**
| Field | Type | Constraints | Description |
|---|---|---|---|
| id | SERIAL | PK, auto-increment | Unique user identifier |
| username | TEXT | NOT NULL, UNIQUE | Login username |
| email | TEXT | NOT NULL, UNIQUE | User email address |
| password | TEXT | NOT NULL | Bcrypt-hashed password |
| display_name | TEXT | NOT NULL | Shown in UI header |
| google_id | TEXT | UNIQUE, nullable | Google OAuth subject ID |
| google_access_token | TEXT | nullable | Current OAuth access token |
| google_refresh_token | TEXT | nullable | Long-lived refresh token |
| created_at | TIMESTAMP | DEFAULT NOW() | Account creation timestamp |

**attendance_records**
| Field | Type | Constraints | Description |
|---|---|---|---|
| id | SERIAL | PK, auto-increment | Unique record identifier |
| user_id | INT | NOT NULL, FK → users.id | Owning user |
| sender_name | TEXT | NOT NULL | Name of the student/builder |
| sender_email | TEXT | NOT NULL | Email address of sender |
| received_at | TIMESTAMP | NOT NULL | Date/time the email was received |
| email_body | TEXT | NOT NULL | Full email content |
| attendance_type | TEXT | NOT NULL, DEFAULT 'Absent' | Absent, Late/Tardy, or Unexcused |
| excuse_category | TEXT | NOT NULL | Sick/Medical, Personal, Program Event, Technical Issue, Other, or None |
| message_snippet | TEXT | NOT NULL | First 150 chars of email body |
| status | TEXT | NOT NULL, DEFAULT 'pending' | Processing status (pending / processed) |
| batch_id | TEXT | nullable | Groups emails processed together |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation timestamp |

### 3.3 Relationships

- **users → attendance_records**: One-to-Many. Each user owns zero or more attendance records.
- **Data Isolation**: All queries filter by `user_id` to ensure users only see their own records.

---

## 4. Technical Requirements Document (TRD)

### 4.1 Authentication

**Username/Password Authentication**
- Registration: username (3+ chars), email (valid format), password (6+ chars), display name
- Login: username + password validated against bcrypt hash
- Session: `express-session` with `connect-pg-simple` for PostgreSQL-backed sessions
- Session secret: `SESSION_SECRET` environment variable
- Cookie: `httpOnly`, `secure` in production, `sameSite: lax`

**Google OAuth 2.0**
- Scopes: `openid`, `userinfo.email`, `userinfo.profile`, `gmail.readonly`
- Flow: Authorization Code with `access_type: offline`, `prompt: consent`
- CSRF: Random `state` parameter stored in session
- Token storage: Access and refresh tokens persisted in `users` table
- Auto-refresh: Expired access tokens refreshed via refresh token on 401 responses
- Environment variables: `PULSE_GOOGLE_CLIENT_ID`, `PULSE_GOOGLE_CLIENT_SECRET`

**Demo Mode**
- Username: `demo` / Password: `demo123456`
- Auto-created on first demo login with 6 pre-seeded attendance records
- No Google ID attached (Gmail button hidden in demo mode)

### 4.2 AI Classification Engine

**Provider**: OpenAI via Replit AI Integrations
**Model**: GPT-5.2
**Response Format**: JSON mode (`response_format: { type: "json_object" }`)
**Max Tokens**: 256

**Dual-Classification Prompt Structure**:
The AI prompt instructs the model to analyze each email and return:
1. `attendanceType`: Whether the person is Absent, Late/Tardy, or Unexcused
2. `category`: The reason/excuse — Sick/Medical, Personal, Program Event, Technical Issue, Other, or None
3. `confidence`: Float 0-1 indicating classification confidence
4. `reasoning`: One-sentence explanation

**Phrase Recognition** (comprehensive examples provided to the AI):
- Sick/Medical: not feeling well, under the weather, flu, fever, migraine, hospital, ER, urgent care, therapy, mental health day, COVID, quarantine, food poisoning, surgery, recovery
- Personal: family emergency, funeral, wedding, out of town, traveling, personal matter, child care, moving, jury duty, court date, religious observance, bereavement
- Program Event: conference, workshop, hackathon, career fair, networking event, field trip, orientation, guest speaker, company visit
- Technical Issue: internet down, WiFi issues, laptop broken, power outage, car broke down, bus delayed, train cancelled, can't log in
- Late/Tardy indicators: running late, running behind, stuck in traffic, held up, on my way, be there soon, overslept but coming, parking issues, stepping in late, missed the bus but on my way
- Unexcused indicators: can't make it (no reason), something came up (no details), just won't be there

**Fallback**: If AI response cannot be parsed, defaults to `Unexcused` with confidence `0`.

### 4.3 Gmail Integration

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
3. Parse headers (From, Subject, Date)
4. Extract body: prefer `text/plain`, fallback to `text/html` with tag stripping
5. Parse sender: regex split of `"Display Name <email@domain.com>"` format
6. Return structured email objects for user selection

**Token Refresh**:
- On 401 response from Gmail API, automatically use refresh token to get new access token
- Update database with new token
- Retry original request once

### 4.4 Export Formats

| Format | Endpoint | Content-Type | Notes |
|---|---|---|---|
| CSV | GET /api/export/csv | text/csv | Comma-separated with proper escaping |
| DOCX | GET /api/export/doc | application/vnd.openxml... | Records grouped by excuse category in tables |
| JSON | GET /api/export/json | application/json | Formatted with 2-space indentation |

All exports include all user records regardless of active time filter. Print view respects the active time filter.

### 4.5 Real-Time Processing (SSE)

Batch email processing uses Server-Sent Events for live progress:

**Event Types**:
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
│  │  [ Sign In                            ]    │              │
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

### 5.2 Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│  ⚡ PULSE    Welcome, [Name]   [☀/🌙] [Logout]              │
│  ─────────────────────────────────────────────────────────── │
│  [Star Field Background]                                     │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ STAT CARDS (one per classification)                      ││
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       ││
│  │ │Total    │ │Sick/    │ │Personal │ │Program  │       ││
│  │ │Records  │ │Medical  │ │         │ │Event    │       ││
│  │ │  42     │ │  12     │ │  8      │ │  5      │       ││
│  │ └─────────┘ └─────────┘ └─────────┘ └─────────┘       ││
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       ││
│  │ │Tech     │ │Late/    │ │Other    │ │Unexcused│       ││
│  │ │Issue    │ │Tardy    │ │         │ │         │       ││
│  │ │  4      │ │  7      │ │  3      │ │  3      │       ││
│  │ └─────────┘ └─────────┘ └─────────┘ └─────────┘       ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  TIME FILTERS: [All] [Day] [Week] [Month] [Quarter] [Year]  │
│                                                              │
│  ACTIONS: [+ Add Email] [Batch Upload] [📧 Gmail] [🔄 Clear]│
│  EXPORTS: [CSV] [DOC] [JSON] [🖨 Print]                     │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Name    │ Email       │ Date  │ Category   │ Snippet │ ⚙││
│  │─────────┼─────────────┼───────┼────────────┼─────────┼──││
│  │ Maria G │ maria@...   │ 02/26 │ [Sick/Med▼]│ Woke up │👁🗑││
│  │ James W │ j.wilson@.. │ 02/26 │ [Program ▼]│ Program │👁🗑││
│  │ Tyler B │ tbrooks@... │ 02/27 │ [TechIss ▼]│ Internet│👁🗑││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### 5.3 Email Detail Modal

```
┌──────────────────────────────────────┐
│  Email Details                    ✕  │
│                                      │
│  Name           Email                │
│  Maria Garcia   maria.garcia@u..     │
│                                      │
│  Date           Category             │
│  2/26/2026      [Sick/Medical]       │
│                                      │
│  Full Email Body                     │
│  ┌──────────────────────────────────┐│
│  │ Good morning, I woke up with    ││
│  │ a severe migraine and nausea    ││
│  │ this morning...                 ││
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
| Package | Version | Purpose |
|---|---|---|
| react | ^18 | UI framework |
| express | ^5 | HTTP server |
| drizzle-orm | latest | Type-safe database ORM |
| @neondatabase/serverless | latest | PostgreSQL driver |
| openai | latest | AI classification |
| bcrypt | latest | Password hashing |
| express-session | latest | Session management |
| connect-pg-simple | latest | PostgreSQL session store |
| docx | latest | DOCX generation |
| date-fns | latest | Date manipulation |
| wouter | latest | Client-side routing |
| @tanstack/react-query | ^5 | Server state management |
| zod | latest | Schema validation |
| drizzle-zod | latest | Drizzle-to-Zod schema bridge |

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
| `npm run dev` | Start development server (Express + Vite HMR) |
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
        ├─── New user? ──── Fill registration form ──── Validate ──── Create account ──── Dashboard
        │
        ├─── Google user? ──── Click "Sign in with Google" ──── OAuth consent
        │                          │
        │                     Callback received
        │                          │
        │                     ├── Existing Google user? ── Update tokens ── Dashboard
        │                     ├── Existing email user? ── Link Google ID ── Dashboard
        │                     └── New user? ── Create account ── Dashboard
        │
        └─── Demo? ──── Click "Try Demo" ──── Auto-login with seeded data ──── Dashboard
```

### 7.2 Email Processing Flow

```
User on Dashboard
        │
        ├─── Manual Entry ──── Fill form (name, email, date, body) ──── Submit
        │                                                                  │
        │                                                            Send to AI
        │                                                                  │
        │                                                          Classify (type + category)
        │                                                                  │
        │                                                          Save to DB ──── Update UI
        │
        ├─── Batch Upload ──── Paste JSON or CSV ──── Parse ──── Validate
        │                                                           │
        │                                                    SSE connection opened
        │                                                           │
        │                                                    For each email:
        │                                                      ├── Send to AI
        │                                                      ├── Save to DB
        │                                                      └── Stream progress event
        │                                                           │
        │                                                    Complete event ──── Update UI
        │
        └─── Gmail Fetch ──── Search inbox (keyword query)
                                    │
                              Display matching emails with checkboxes
                                    │
                              User selects emails ──── Submit selected
                                    │
                              Same batch processing flow as above
```

### 7.3 Data Consumption Flow

```
Dashboard displays records
        │
        ├─── Filter by time ──── Day / Week / Month / Quarter / Year / All
        │                              │
        │                        Filtered records shown in table + stats updated
        │
        ├─── Change category ──── Select new value from dropdown ──── PATCH API ──── Update stats
        │
        ├─── View details ──── Click eye icon ──── Modal with full email body
        │
        ├─── Delete record ──── Click trash icon ──── DELETE API ──── Remove from table
        │
        ├─── Clear all ──── Confirm ──── DELETE /api/records ──── Empty table
        │
        ├─── Export ──── CSV / DOCX / JSON ──── Download file (all records)
        │
        └─── Print ──── Window.print() ──── Print dialog (filtered records, no controls)
```

---

## 8. Conditional Logic Trees

### 8.1 AI Classification Decision Tree

```
Email received for classification
        │
        ▼
   Parse email body
        │
        ▼
   Send to OpenAI with dual-classification prompt
        │
        ├─── API responds successfully
        │         │
        │         ▼
        │    Parse JSON response
        │         │
        │         ├── Valid attendanceType? ── Yes ── Use it
        │         │                           No ── Default to "Absent"
        │         │
        │         ├── Valid category? ── Yes ── Use it
        │         │                     No ── Default to "Unexcused" / "None"
        │         │
        │         └── Return { attendanceType, category, confidence, reasoning }
        │
        └─── API fails or unparseable
                  │
                  └── Return { attendanceType: "Absent", category: "Unexcused", confidence: 0, reasoning: "Failed" }
```

### 8.2 Attendance Type Classification Logic

```
Analyze email content
        │
        ▼
   Does the person indicate they will still attend?
        │
        ├── YES (e.g., "on my way", "be there soon", "running late")
        │         │
        │         └── attendanceType = "Late/Tardy"
        │
        ├── NO, they indicate complete absence with a reason
        │         │
        │         └── attendanceType = "Absent"
        │              └── Determine excuse category from reason
        │
        └── NO reason given, vague, or not a real excuse
                  │
                  └── attendanceType = "Unexcused"
                       └── excuseCategory = "None"
```

### 8.3 Authentication Decision Tree

```
Request arrives at protected endpoint
        │
        ▼
   requireAuth middleware
        │
        ├── req.session.userId exists?
        │         │
        │         ├── Yes ── Continue to route handler
        │         │
        │         └── No ── Return 401 Unauthorized
        │
        ▼
   Route handler
        │
        ├── Resource has userId field?
        │         │
        │         ├── Matches session userId? ── Yes ── Allow operation
        │         │
        │         └── No ── Return 404 (resource not found)
        │
        └── User-scoped query (getAllRecords, getStats, etc.)
                  │
                  └── Filter by session userId automatically
```

### 8.4 Google OAuth Decision Tree

```
OAuth callback received with authorization code
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
        │         │
        │         └── Update tokens ── Set session ── Redirect to dashboard
        │
        ├── User with this email exists (no googleId)?
        │         │
        │         └── Link googleId + store tokens ── Set session ── Redirect
        │
        └── No user found?
                  │
                  └── Create new user (random password, Google details)
                       └── Store tokens ── Set session ── Redirect
```

### 8.5 Gmail Token Refresh Decision Tree

```
Gmail API request made
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
        │         │         │              │         │
        │         │         │              │         └── Update DB ── Retry original request
        │         │         │              │
        │         │         │              └── Refresh failed ── Return error
        │         │         │
        │         │         └── No ── Return "Please reconnect Gmail"
        │
        └── Other error ── Return error message
```

### 8.6 Theme Toggle Decision Tree

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

### 8.7 Time Period Filtering Decision Tree

```
Time period button clicked
        │
        ▼
   Selected period
        │
        ├── "all" ── Show all records (no date filter)
        │
        ├── "day" ── startOfDay(today) to endOfDay(today)
        │
        ├── "week" ── startOfWeek(today) to endOfWeek(today)
        │
        ├── "month" ── startOfMonth(today) to endOfMonth(today)
        │
        ├── "quarter" ── startOfQuarter(today) to endOfQuarter(today)
        │
        └── "year" ── startOfYear(today) to endOfYear(today)
              │
              ▼
        Filter records where receivedAt is within range
              │
              ▼
        Update stats cards with filtered counts
              │
              ▼
        Update table display
```

---

## 9. Full Project Report

### 9.1 Executive Summary

PULSE (version 2.0) is a production-ready attendance automation tool that combines AI-powered email classification with a polished, accessible interface. The application serves program administrators who need to track and categorize student absences and tardiness efficiently.

Key differentiators:
- **Dual-classification system**: Separates "what happened" (Absent vs. Late/Tardy vs. Unexcused) from "why" (Sick/Medical, Personal, etc.)
- **Comprehensive phrase recognition**: The AI prompt includes extensive synonym lists and edge-case rules for accurate categorization
- **Multiple ingestion methods**: Manual entry, batch upload, and direct Gmail integration
- **Real-time processing feedback**: SSE streaming shows per-email progress during batch operations
- **Three export formats**: CSV for spreadsheets, DOCX for formal reports, JSON for database import
- **Space theme with accessibility**: Animated star fields that respect color contrast requirements

### 9.2 Feature Completeness

| Feature | Status | Notes |
|---|---|---|
| Username/password auth | Complete | Bcrypt hashing, session management |
| Google OAuth | Complete | Full flow with token refresh |
| Demo mode | Complete | 6 pre-seeded records |
| Manual email entry | Complete | Single form with validation |
| Batch upload | Complete | JSON and CSV support, SSE streaming |
| Gmail fetch | Complete | Search, select, process |
| AI classification (dual) | Complete | Attendance type + excuse category |
| Time-period filtering | Complete | 6 periods with date-fns |
| Category stats cards | Complete | Icons, colors, glow effects |
| Inline category editing | Complete | Dropdown in table rows |
| Record deletion | Complete | Individual and bulk |
| CSV export | Complete | All records |
| DOCX export | Complete | Grouped by category |
| JSON export | Complete | Formatted for import |
| Print view | Complete | Filtered, no interactive controls |
| Dark mode | Complete | Space theme, 120 animated stars |
| Light mode | Complete | Clean theme, 20 corner sparkles |
| Theme persistence | Complete | localStorage |
| WCAG 2 accessibility | Complete | ARIA, keyboard nav, contrast |
| Responsive design | Complete | Mobile-first with breakpoints |

### 9.3 Security Measures

- **Password Security**: Bcrypt with salt rounds
- **Session Security**: PostgreSQL-backed sessions, httpOnly cookies, secure flag in production
- **OAuth Security**: CSRF state parameter, server-side token exchange
- **Data Isolation**: All database queries scoped to authenticated user's ID
- **Input Validation**: Zod schemas validate all incoming data before processing
- **API Protection**: All data endpoints require `requireAuth` middleware
- **Token Management**: Google tokens stored server-side, never exposed to client

### 9.4 Accessibility Compliance

- Semantic HTML elements (`<main>`, `<nav>`, `<section>`, `<table>`)
- ARIA labels on interactive elements
- `data-testid` attributes on all interactive and meaningful display elements
- Keyboard-navigable forms and buttons
- Color contrast meeting WCAG 2 AA standards
- Focus indicators on interactive elements
- Responsive layout for various screen sizes

### 9.5 Performance Characteristics

- **Frontend**: Vite HMR for instant development feedback; code splitting via dynamic imports
- **Data Fetching**: TanStack Query with caching, automatic refetching, and cache invalidation
- **Batch Processing**: SSE streaming prevents timeout on large batches; each email processed individually
- **Database**: Drizzle ORM generates optimized SQL; Neon Serverless for auto-scaling
- **Styling**: Tailwind CSS purges unused styles in production; utility classes minimize CSS bundle

### 9.6 Known Limitations

- Gmail integration requires Google Cloud Console setup (authorized test users for apps in testing mode)
- Google OAuth redirect URI must match exactly in Google Cloud Console
- Exports include all records regardless of active time filter (by design; print respects filter)
- Maximum 50 Gmail messages fetched per search query
- AI classification depends on OpenAI API availability and rate limits
- Demo account has no Gmail functionality (no Google ID linked)

### 9.7 Deployment

- **Platform**: Replit (auto-managed infrastructure)
- **Database**: PostgreSQL via Neon Serverless (connection via `DATABASE_URL`)
- **Build**: `npm run build` compiles TypeScript and bundles frontend
- **Serve**: Express serves both API and static frontend assets
- **Domain**: Available under `.replit.app` or custom domain

---

*End of PULSE Project Documentation v2.0*
