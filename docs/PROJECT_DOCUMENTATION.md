# PULSE — Project Documentation

**Attendance Automation Tool**
**Version:** 1.0
**Last Updated:** February 27, 2026

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

PULSE is a space-themed, multi-user attendance automation tool designed for program administrators, instructors, and team leads. It processes builder/student absence excuse emails, categorizes them via OpenAI into six predefined categories, and generates printable CSV/DOCX reports. The application features Google OAuth integration for Gmail inbox fetching, time-period filtering, WCAG 2 accessibility, and a dark/light mode toggle with animated star sparkles.

### 1.2 Problem Statement

Manually reviewing and categorizing student absence excuse emails is time-consuming and error-prone. Administrators need an automated, AI-powered system that can ingest emails (manually, in batch, or directly from Gmail), categorize the excuse type, and produce organized reports for record-keeping and auditing.

### 1.3 Target Users

- Program administrators managing builder/student attendance
- Instructors tracking class participation
- Team leads monitoring team member availability
- Any user who needs to process and categorize absence excuses at scale

### 1.4 Functional Requirements

| ID | Requirement | Status |
|----|------------|--------|
| FR-01 | Users can register with username, email, display name, and password | Done |
| FR-02 | Users can log in with username and password | Done |
| FR-03 | Users can log out, destroying their session | Done |
| FR-04 | A demo account is available with pre-seeded data | Done |
| FR-05 | Users can manually add a single email for AI categorization | Done |
| FR-06 | Users can batch-upload emails via JSON paste or JSON/CSV file upload | Done |
| FR-07 | AI categorizes each email into one of 6 categories | Done |
| FR-08 | Batch processing provides real-time progress via Server-Sent Events | Done |
| FR-09 | Dashboard displays category-based statistics cards | Done |
| FR-10 | Users can filter records by time period (Day, Week, Month, Quarter, Year) | Done |
| FR-11 | Users can filter records by clicking a category card | Done |
| FR-12 | Users can manually override an AI-assigned category | Done |
| FR-13 | Users can update a record's status (pending, approved, denied) | Done |
| FR-14 | Users can delete individual records | Done |
| FR-15 | Users can clear all records at once | Done |
| FR-16 | Users can export all records to CSV | Done |
| FR-17 | Users can export all records to DOCX (grouped by category) | Done |
| FR-18 | Users can print filtered records with a print-optimized layout | Done |
| FR-19 | The app displays an animated star field background in dark mode | Done |
| FR-20 | Light mode displays subtle corner sparkles instead of full star field | Done |
| FR-21 | Users can toggle between dark and light mode with persistence | Done |
| FR-22 | Users can sign in with Google OAuth | Done |
| FR-23 | Google OAuth links to existing accounts by email if found | Done |
| FR-24 | Google OAuth stores access and refresh tokens for Gmail access | Done |
| FR-25 | Users with Google accounts can search their Gmail inbox | Done |
| FR-26 | Users can select fetched Gmail emails and process them with AI | Done |
| FR-27 | Gmail token refresh is handled automatically on expiration | Done |

### 1.5 Non-Functional Requirements

| ID | Requirement | Status |
|----|------------|--------|
| NFR-01 | WCAG 2 accessibility (semantic HTML, ARIA labels, keyboard navigation) | Done |
| NFR-02 | Responsive design (mobile-friendly via Tailwind breakpoints) | Done |
| NFR-03 | Data isolation — each user only sees their own records | Done |
| NFR-04 | Sessions persisted in PostgreSQL (survive server restarts) | Done |
| NFR-05 | All passwords hashed with bcrypt (10 rounds) | Done |
| NFR-06 | CSRF protection via OAuth state parameter | Done |
| NFR-07 | Print stylesheet hides UI chrome and optimizes table layout | Done |
| NFR-08 | `data-testid` attributes on all interactive and display elements | Done |

### 1.6 Excuse Categories

1. **Sick/Medical** — Illness, doctor appointments, medical emergencies, health-related issues
2. **Personal** — Travel, family events, personal obligations, family emergencies
3. **Program Event** — Conflict with program-related events, workshops, conferences, or scheduled activities
4. **Technical Issue** — Internet issues, transport problems, equipment failures, software problems
5. **Other** — Miscellaneous reasons that provide a valid excuse but do not fit the specific categories above
6. **Unexcused** — No valid reason provided, vague excuses, or the message does not contain an actual excuse

---

## 2. Architecture Overview

### 2.1 High-Level Architecture

PULSE follows a monolithic full-stack JavaScript architecture with a clear client-server separation served from a single Express process.

```
┌────────────────────────────────────────────────────────────────────┐
│                          Browser (Client)                         │
│                                                                   │
│  React 18 + Vite + TanStack Query + wouter + Tailwind CSS         │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Auth Page │  │ Dashboard │  │ Dialogs  │  │ Theme / StarField│  │
│  └──────────┘  └───────────┘  └──────────┘  └──────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                              │  HTTP / SSE
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                       Express 5 Server                            │
│                                                                   │
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ auth.ts    │  │ routes.ts  │  │ google-auth.ts│  │ openai.ts │ │
│  │ (session,  │  │ (CRUD,     │  │ (OAuth,       │  │ (GPT cat- │ │
│  │  register, │  │  process,  │  │  Gmail fetch, │  │  egorize) │ │
│  │  login)    │  │  export)   │  │  token mgmt)  │  │           │ │
│  └────────────┘  └────────────┘  └──────────────┘  └───────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ storage.ts (IStorage interface → DatabaseStorage via Drizzle) ││
│  └────────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────┘
                              │  SQL (Drizzle ORM)
                              ▼
                    ┌──────────────────┐
                    │   PostgreSQL DB  │
                    │   (Replit-hosted) │
                    └──────────────────┘
```

### 2.2 Frontend Architecture

- **Framework:** React 18 with Vite build tool
- **Routing:** wouter (lightweight client-side router)
- **State/Data:** TanStack React Query v5 for server state; React useState/useMemo for local state
- **Styling:** Tailwind CSS with shadcn/ui component library (Radix UI primitives)
- **Icons:** lucide-react for action icons; react-icons for brand logos
- **Theming:** Custom ThemeProvider context with localStorage persistence; CSS custom properties in `:root` (light) and `.dark` (dark)

### 2.3 Backend Architecture

- **Runtime:** Node.js 20 with TypeScript (tsx for development)
- **Framework:** Express 5
- **ORM:** Drizzle ORM with drizzle-zod for schema validation
- **Database:** PostgreSQL via `@neondatabase/serverless` driver
- **Session Store:** connect-pg-simple (sessions in PostgreSQL `session` table)
- **Authentication:** Custom session-based auth (bcrypt for passwords) + Google OAuth 2.0 (manual implementation)
- **AI Integration:** OpenAI GPT (via Replit AI Integrations) for excuse categorization
- **Document Generation:** `docx` library for DOCX exports
- **Real-time Updates:** Server-Sent Events (SSE) for batch processing progress

### 2.4 Shared Layer

- `shared/schema.ts` — Drizzle table definitions, Zod insert schemas, TypeScript types, and validation schemas shared between client and server

### 2.5 File Structure

```
├── client/
│   ├── index.html
│   └── src/
│       ├── App.tsx                     # Root component with ThemeProvider + Router
│       ├── main.tsx                    # React entry point
│       ├── index.css                   # Global styles, star animations, CSS variables
│       ├── components/
│       │   ├── add-email-dialog.tsx    # Single email manual entry dialog
│       │   ├── batch-upload-dialog.tsx # Batch JSON/CSV upload dialog
│       │   ├── gmail-fetch-dialog.tsx  # Gmail inbox search + select dialog
│       │   ├── records-table.tsx       # Attendance records data table
│       │   ├── star-field.tsx          # Animated star/sparkle background
│       │   ├── theme-provider.tsx      # Light/dark mode context + toggle hook
│       │   └── ui/                     # shadcn/ui primitives (30+ components)
│       ├── hooks/
│       │   ├── use-auth.ts            # Authentication hook (login/register/logout/demo)
│       │   ├── use-mobile.tsx         # Responsive breakpoint hook
│       │   └── use-toast.ts           # Toast notification hook
│       ├── lib/
│       │   ├── queryClient.ts         # TanStack Query client + apiRequest helper
│       │   └── utils.ts               # Tailwind merge utility
│       └── pages/
│           ├── auth.tsx               # Login / Register / Demo / Google Sign-In page
│           ├── dashboard.tsx          # Main dashboard with stats, filters, table, exports
│           └── not-found.tsx          # 404 page
├── server/
│   ├── index.ts                       # Express app bootstrap
│   ├── auth.ts                        # Session setup, login/register/demo routes, requireAuth
│   ├── google-auth.ts                 # Google OAuth routes, Gmail fetch, token refresh
│   ├── openai.ts                      # OpenAI excuse categorization function
│   ├── routes.ts                      # CRUD routes, batch processing SSE, exports
│   ├── storage.ts                     # IStorage interface + DatabaseStorage implementation
│   ├── db.ts                          # Database connection (pool + Drizzle instance)
│   ├── seed.ts                        # Demo account seed data
│   ├── static.ts                      # Static file serving for production
│   └── vite.ts                        # Vite dev server middleware
├── shared/
│   ├── schema.ts                      # Drizzle schema, Zod schemas, types, constants
│   └── models/
│       └── chat.ts                    # Conversations/messages tables (AI integrations)
├── docs/
│   └── PROJECT_DOCUMENTATION.md       # This document
├── tailwind.config.ts
├── vite.config.ts
├── drizzle.config.ts
├── tsconfig.json
├── package.json
└── replit.md
```

---

## 3. Entity-Relationship Diagram (ERD)

### 3.1 Tables

#### `users`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-incrementing user ID |
| `username` | text | NOT NULL, UNIQUE | Login username |
| `email` | text | NOT NULL, UNIQUE | User email address |
| `password` | text | NOT NULL | Bcrypt-hashed password |
| `display_name` | text | NOT NULL | Display name shown in UI |
| `google_id` | text | UNIQUE | Google OAuth subject ID (nullable) |
| `google_access_token` | text | | Google API access token (nullable) |
| `google_refresh_token` | text | | Google API refresh token (nullable) |
| `created_at` | timestamp | NOT NULL, DEFAULT NOW | Account creation timestamp |

#### `attendance_records`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-incrementing record ID |
| `user_id` | integer | NOT NULL, FK → users.id | Owning user |
| `sender_name` | text | NOT NULL | Name of the person who sent the excuse |
| `sender_email` | text | NOT NULL | Email of the sender |
| `received_at` | timestamp | NOT NULL | Date the excuse email was received |
| `email_body` | text | NOT NULL | Full text of the excuse email |
| `excuse_category` | text | NOT NULL | AI-assigned category (one of 6) |
| `message_snippet` | text | NOT NULL | Truncated preview of the email body |
| `status` | text | NOT NULL, DEFAULT "pending" | Review status (pending/approved/denied) |
| `batch_id` | text | | Batch processing group ID (nullable) |
| `created_at` | timestamp | NOT NULL, DEFAULT NOW | Record creation timestamp |

#### `session` (auto-created by connect-pg-simple)

| Column | Type | Description |
|--------|------|-------------|
| `sid` | varchar | Session ID (PK) |
| `sess` | json | Session data (contains userId, oauthState) |
| `expire` | timestamp | Session expiration time |

#### `conversations` (AI Integrations)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Conversation ID |
| `title` | text | NOT NULL | Conversation title |
| `created_at` | timestamp | NOT NULL, DEFAULT NOW | Creation timestamp |

#### `messages` (AI Integrations)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Message ID |
| `conversation_id` | integer | NOT NULL, FK → conversations.id (CASCADE) | Parent conversation |
| `role` | text | NOT NULL | Message role (user/assistant/system) |
| `content` | text | NOT NULL | Message content |
| `created_at` | timestamp | NOT NULL, DEFAULT NOW | Creation timestamp |

### 3.2 Relationships Diagram

```
┌───────────┐       1:N       ┌─────────────────────┐
│   users   │────────────────▶│  attendance_records  │
│           │                 │                       │
│ id (PK)   │                 │ user_id (FK → users)  │
│ username  │                 │ sender_name           │
│ email     │                 │ sender_email          │
│ password  │                 │ excuse_category       │
│ google_id │                 │ status                │
└───────────┘                 └───────────────────────┘

┌───────────────┐     1:N     ┌────────────────┐
│ conversations │────────────▶│   messages     │
│               │             │                │
│ id (PK)       │             │ conversation_id│
│ title         │             │ (FK, CASCADE)  │
└───────────────┘             └────────────────┘
```

---

## 4. Technical Requirements Document (TRD)

### 4.1 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | React | 18.x |
| Build Tool | Vite | Latest |
| Styling | Tailwind CSS | 4.x |
| UI Components | shadcn/ui (Radix UI) | Latest |
| Client Routing | wouter | Latest |
| Server State | TanStack React Query | 5.x |
| Form Handling | react-hook-form + @hookform/resolvers | Latest |
| Date Utilities | date-fns | 3.x |
| Backend Framework | Express | 5.x |
| Runtime | Node.js | 20.x |
| Language | TypeScript | Latest |
| ORM | Drizzle ORM | 0.39.x |
| Schema Validation | drizzle-zod + Zod | Latest |
| Database | PostgreSQL | (Replit-managed) |
| Session Store | connect-pg-simple | 10.x |
| Password Hashing | bcrypt | 6.x |
| AI Service | OpenAI GPT (via Replit AI Integrations) | Latest |
| Document Export | docx | 9.x |
| Icons | lucide-react | 0.453.x |

### 4.2 Authentication Requirements

- **Session-based** authentication using express-session
- Sessions stored in PostgreSQL via connect-pg-simple for persistence across server restarts
- Session cookie: `httpOnly: true`, `secure: true` in production, `maxAge: 7 days`
- Passwords hashed with bcrypt (10 salt rounds)
- Google OAuth 2.0 with scopes: `openid`, `email`, `profile`, `gmail.readonly`
- OAuth state parameter for CSRF protection
- Automatic token refresh on Gmail API 401 responses

### 4.3 API Endpoints

#### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user (validates against registerSchema) |
| POST | `/api/auth/login` | Login with username/password |
| POST | `/api/auth/logout` | Destroy session and clear cookie |
| POST | `/api/auth/demo` | Login as demo user (creates + seeds if needed) |
| GET | `/api/auth/me` | Get current authenticated user |
| GET | `/api/auth/google` | Initiate Google OAuth flow |
| GET | `/api/auth/google/callback` | Handle Google OAuth callback |

#### Records Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/records` | Get all records for authenticated user |
| GET | `/api/records/:id` | Get a specific record (ownership verified) |
| PATCH | `/api/records/:id/category` | Update record's excuse category |
| PATCH | `/api/records/:id/status` | Update record's review status |
| DELETE | `/api/records/:id` | Delete a specific record |
| DELETE | `/api/records` | Delete all records for authenticated user |

#### Processing & Stats

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Get category counts for authenticated user |
| POST | `/api/process-emails` | Process batch of emails via SSE stream |

#### Exports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/export/csv` | Download all records as CSV file |
| GET | `/api/export/doc` | Download all records as DOCX file |

#### Gmail Integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/gmail/fetch` | Search Gmail inbox and return email list |

### 4.4 API Security

- All data routes protected by `requireAuth` middleware
- All database queries scoped to `req.session.userId` for multi-tenant data isolation
- Request body validation using Zod schemas before database operations
- Google tokens stored server-side only (never sent to client)

### 4.5 AI Integration Requirements

- Model: OpenAI GPT (configured via Replit AI Integrations environment variables)
- Response format: JSON object with `category`, `confidence` (0-1), and `reasoning`
- Fallback: Defaults to "Unexcused" with confidence 0 if AI response is malformed or category is invalid
- Max tokens: 256 per categorization request

### 4.6 Export Requirements

- **CSV**: Flat file with columns: Name, Email, Date, Excuse Category, Status, Message Snippet. All user records included regardless of active filters.
- **DOCX**: Formatted Word document with title, generation metadata, and records grouped by category in tables. All user records included regardless of active filters.
- **Print**: Browser print dialog renders filtered records only. Print CSS hides navigation, star field, and action buttons. Shows print-specific header with filter context.

### 4.7 Accessibility Requirements (WCAG 2)

- Semantic HTML elements (`nav`, `main`, `header`, `section`, `table`)
- ARIA labels on interactive elements
- Keyboard-navigable UI (tab order, focus management)
- Sufficient color contrast in both light and dark modes
- `data-testid` attributes on all interactive and data-display elements for automated testing

### 4.8 Theming Requirements

- Dark mode: Deep space background (hsl 230 25% 7%), light text (hsl 220 20% 93%), violet accents (hsl 265 80% 60%), 120 animated stars across the full viewport
- Light mode: Near-white background (hsl 230 25% 97%), dark text (hsl 230 20% 12%), violet accents (hsl 265 80% 55%), 20 subtle corner sparkles only
- Toggle persisted in localStorage under key `pulse-theme`
- Dark mode applied via `.dark` class on `<html>` element (Tailwind `darkMode: ["class"]`)
- CSS custom properties in `:root` for light mode, `.dark` for dark mode

---

## 5. Wireframes

### 5.1 Auth Page Layout

```
┌──────────────────────────────────────────────────────────┐
│                    [Star Field Background]                │
│                                                          │
│              ┌────────────────────────────┐               │
│              │         ⚡ PULSE           │  [☀/🌙 Toggle]│
│              │  Attendance Automation     │               │
│              │                            │               │
│              │  ┌──────────┬───────────┐  │               │
│              │  │  Login   │ Register  │  │               │
│              │  └──────────┴───────────┘  │               │
│              │                            │               │
│              │  Username: [___________]   │               │
│              │  Password: [___________]   │               │
│              │                            │               │
│              │  [     Sign In        ]    │               │
│              │                            │               │
│              │  ── or continue with ──    │               │
│              │  [G  Sign in with Google]  │               │
│              │                            │               │
│              │  [     Try Demo       ]    │               │
│              └────────────────────────────┘               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 5.2 Dashboard Layout

```
┌──────────────────────────────────────────────────────────┐
│ ⚡ PULSE                    [Add Email] [Batch Process]   │
│ Welcome, User               [Gmail] [☀/🌙] [Sign Out]   │
├──────────────────────────────────────────────────────────┤
│ [Day] [Week] [Month] [Quarter] [Year]                    │
│                                                          │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌───────┐ │
│ │Total │ │Sick/ │ │Perso-│ │Prog. │ │Tech  │ │Other  │ │
│ │  24  │ │Med 8 │ │nal 5 │ │Evt 3 │ │Iss 4 │ │   4   │ │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └───────┘ │
│                                                          │
│ Records ─────────────── [CSV] [DOC] [Print] [Clear All]  │
│ ┌────────────────────────────────────────────────────────┐│
│ │ Name     │ Email        │ Date  │ Category  │ Status  ││
│ ├──────────┼──────────────┼───────┼───────────┼─────────┤│
│ │ Jane Doe │ jane@ex.com  │ 02/27 │ Sick/Med  │ Pending ││
│ │ John S.  │ john@ex.com  │ 02/26 │ Personal  │Approved ││
│ │ ...      │ ...          │ ...   │ ...       │ ...     ││
│ └────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

### 5.3 Add Email Dialog

```
┌─────────────────────────────────┐
│ Add Absence Email          [X]  │
│                                 │
│ Sender Name: [______________]   │
│ Sender Email: [_____________]   │
│ Date Received: [____________]   │
│ Email Body:                     │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│ [Cancel]          [Process]     │
└─────────────────────────────────┘
```

### 5.4 Batch Upload Dialog

```
┌──────────────────────────────────────┐
│ Batch Process Emails            [X]  │
│                                      │
│ ┌──────────┬───────────┐             │
│ │  Paste   │  Upload   │             │
│ └──────────┴───────────┘             │
│                                      │
│ Paste JSON array of emails:          │
│ ┌──────────────────────────────────┐ │
│ │ [{"senderName": "...", ...}]     │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Processing: 3 / 10  [████████░░]     │
│                                      │
│ [Cancel]          [Process All]      │
└──────────────────────────────────────┘
```

### 5.5 Gmail Fetch Dialog

```
┌──────────────────────────────────────┐
│ Fetch from Gmail               [X]  │
│                                      │
│ Search Query: [absent OR excuse___]  │
│ Max Results:  [20___]                │
│ [    Search Gmail    ]               │
│                                      │
│ Select All  │  Deselect All          │
│ ┌──────────────────────────────────┐ │
│ │ ☑ From: Jane — Subject: Sick    │ │
│ │ ☑ From: John — Subject: Away    │ │
│ │ ☐ From: Alex — Subject: Meeting │ │
│ └──────────────────────────────────┘ │
│                                      │
│ [Cancel]      [Process with AI]      │
└──────────────────────────────────────┘
```

---

## 6. System Tools & Requirements

### 6.1 Runtime Environment

| Component | Requirement |
|-----------|-------------|
| Operating System | Linux (NixOS via Replit) |
| Node.js | v20.x |
| Package Manager | npm |
| Database | PostgreSQL (Replit-managed, via `DATABASE_URL`) |

### 6.2 Environment Variables

| Variable | Source | Purpose |
|----------|--------|---------|
| `DATABASE_URL` | Replit (auto) | PostgreSQL connection string |
| `PULSE_GOOGLE_CLIENT_ID` | Secret | Google OAuth client ID |
| `PULSE_GOOGLE_CLIENT_SECRET` | Secret | Google OAuth client secret |
| `SESSION_SECRET` | Secret | Express session signing key |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Replit AI Integrations (auto) | OpenAI API key |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Replit AI Integrations (auto) | OpenAI API base URL |

### 6.3 Key Dependencies

**Runtime Dependencies:**

| Package | Purpose |
|---------|---------|
| `react`, `react-dom` | UI rendering |
| `vite`, `@vitejs/plugin-react` | Build tooling and HMR |
| `express` | HTTP server framework |
| `express-session` | Session middleware |
| `connect-pg-simple` | PostgreSQL session store |
| `bcrypt` | Password hashing |
| `drizzle-orm`, `drizzle-zod` | ORM and schema validation |
| `@neondatabase/serverless` | PostgreSQL driver |
| `openai` | OpenAI API client |
| `docx` | DOCX document generation |
| `@tanstack/react-query` | Server state management |
| `wouter` | Client-side routing |
| `date-fns` | Date manipulation and formatting |
| `zod` | Runtime schema validation |
| `tailwind-merge`, `class-variance-authority`, `clsx` | Styling utilities |
| `lucide-react` | Icon library |
| `react-hook-form`, `@hookform/resolvers` | Form handling and validation |
| `framer-motion` | Animation library |
| `recharts` | Charting library |

**Dev Dependencies:**

| Package | Purpose |
|---------|---------|
| `typescript` | Type checking |
| `tsx` | TypeScript execution for development |
| `drizzle-kit` | Database migration tooling |
| `tailwindcss`, `autoprefixer`, `postcss` | CSS processing |
| `@tailwindcss/typography` | Prose styling plugin |
| `tailwindcss-animate` | Animation utilities |

### 6.4 Build & Run Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (Express + Vite HMR) |
| `npm run db:push` | Push Drizzle schema changes to PostgreSQL |
| `npm run build` | Build production frontend bundle |

### 6.5 Google OAuth Setup Requirements

1. Create a project in Google Cloud Console
2. Enable Gmail API
3. Configure OAuth consent screen (add test users while in "Testing" mode)
4. Create OAuth 2.0 Client ID credentials (Web application type)
5. Set authorized redirect URI to: `https://<replit-domain>/api/auth/google/callback`
6. Store Client ID in `PULSE_GOOGLE_CLIENT_ID` secret
7. Store Client Secret in `PULSE_GOOGLE_CLIENT_SECRET` secret

---

## 7. User Flow

### 7.1 Authentication Flow

```
User visits app
    │
    ├── Has session? ──Yes──▶ Dashboard
    │
    └── No session
         │
         ├── Click "Sign In"
         │     │
         │     ├── Enter username + password
         │     │     │
         │     │     ├── Valid? ──Yes──▶ Set session → Dashboard
         │     │     └── Invalid? ──▶ Show error toast
         │     │
         │     └── Click "Sign in with Google"
         │           │
         │           ├── Redirect to Google consent screen
         │           ├── User authorizes → Callback with code
         │           ├── Exchange code for tokens
         │           ├── Find/create/link user account
         │           └── Set session → Dashboard
         │
         ├── Click "Register" tab
         │     │
         │     ├── Enter display name, username, password
         │     ├── Validate inputs (Zod schema)
         │     ├── Hash password → Create user
         │     └── Set session → Dashboard
         │
         └── Click "Try Demo"
               │
               ├── Find or create "demo" user
               ├── Seed 6 sample records (first time only)
               └── Set session → Dashboard
```

### 7.2 Email Processing Flow

```
User on Dashboard
    │
    ├── Click "Add Email"
    │     │
    │     ├── Fill in sender name, email, date, body
    │     ├── Submit → POST /api/process-emails (single email array)
    │     ├── SSE stream: AI categorizes → record created
    │     └── Invalidate cache → table refreshes
    │
    ├── Click "Batch Process"
    │     │
    │     ├── Paste JSON array  ──OR──  Upload JSON/CSV file
    │     ├── Submit → POST /api/process-emails (batch array)
    │     ├── SSE stream: progress updates per email
    │     │     ├── Success → record created, progress increments
    │     │     └── Error → error logged, continue to next
    │     └── Invalidate cache → table refreshes
    │
    └── Click "Gmail" (Google users only)
          │
          ├── Enter search query (or use default)
          ├── POST /api/gmail/fetch → search Gmail inbox
          ├── Display results with checkboxes
          ├── User selects emails → Click "Process with AI"
          ├── POST /api/process-emails (selected emails)
          ├── SSE stream: progress updates per email
          └── Invalidate cache → table refreshes
```

### 7.3 Record Management Flow

```
User views records table
    │
    ├── Click category dropdown → PATCH /api/records/:id/category
    │     └── Update category → invalidate cache
    │
    ├── Click status badge → PATCH /api/records/:id/status
    │     └── Cycle: pending → approved → denied → pending
    │
    ├── Click delete (trash icon) → DELETE /api/records/:id
    │     └── Remove record → invalidate cache
    │
    ├── Click "Clear All" → DELETE /api/records
    │     └── Remove all user records → invalidate cache
    │
    ├── Click CSV → window.open("/api/export/csv") → download
    │
    ├── Click DOC → window.open("/api/export/doc") → download
    │
    └── Click Print → window.print() → print filtered view
```

### 7.4 Filtering Flow

```
User on Dashboard
    │
    ├── Click time period button (Day/Week/Month/Quarter/Year)
    │     │
    │     ├── Calculate date range using date-fns
    │     ├── Filter records array client-side
    │     └── Update stats cards + table with filtered data
    │
    └── Click a category stat card
          │
          ├── Toggle category filter on/off
          └── Further filter already time-filtered records
```

---

## 8. Conditional Logic Trees

### 8.1 AI Categorization Logic

```
Input: emailBody (string)
    │
    ├── Send to OpenAI GPT with system prompt
    │     │
    │     ├── Response received
    │     │     │
    │     │     ├── Parse JSON response
    │     │     │     │
    │     │     │     ├── Valid JSON?
    │     │     │     │     │
    │     │     │     │     ├── Yes
    │     │     │     │     │     │
    │     │     │     │     │     ├── Category in valid list?
    │     │     │     │     │     │     ├── Yes → Use parsed category
    │     │     │     │     │     │     └── No → Default to "Unexcused"
    │     │     │     │     │     │
    │     │     │     │     │     ├── Confidence is number?
    │     │     │     │     │     │     ├── Yes → Use parsed confidence
    │     │     │     │     │     │     └── No → Default to 0.5
    │     │     │     │     │     │
    │     │     │     │     │     └── Return { category, confidence, reasoning }
    │     │     │     │     │
    │     │     │     │     └── No (JSON parse error)
    │     │     │     │           └── Return { "Unexcused", 0, "Failed to parse" }
    │     │     │     │
    │     │     │     └── (handled by try/catch)
    │     │     │
    │     │     └── API error → throw (caught by route handler)
    │     │
    │     └── Network/timeout error → throw
    │
    └── Valid categories: Sick/Medical | Personal | Program Event |
        Technical Issue | Other | Unexcused
```

### 8.2 Google OAuth Callback Logic

```
Callback received with ?code=...&state=...
    │
    ├── State matches session.oauthState?
    │     │
    │     ├── No → 403 "Invalid OAuth state"
    │     │
    │     └── Yes
    │           │
    │           ├── Exchange code for tokens
    │           │     │
    │           │     ├── Success → got access_token, refresh_token
    │           │     └── Failure → 500 "Token exchange failed"
    │           │
    │           ├── Fetch Google user profile
    │           │     │
    │           │     └── Got { id, email, name }
    │           │
    │           ├── Find user by googleId?
    │           │     │
    │           │     ├── Found → Update tokens → Set session
    │           │     │
    │           │     └── Not found
    │           │           │
    │           │           ├── Find user by email?
    │           │           │     │
    │           │           │     ├── Found → Link Google account
    │           │           │     │           Update tokens → Set session
    │           │           │     │
    │           │           │     └── Not found → Create new user
    │           │           │                     (random password)
    │           │           │                     Set session
    │           │           │
    │           │           └── (all paths) → Redirect to "/"
    │           │
    │           └── Session saved → Redirect to dashboard
```

### 8.3 Gmail Fetch Logic

```
POST /api/gmail/fetch { query?, maxResults? }
    │
    ├── Get user from session
    │     │
    │     ├── User has googleAccessToken?
    │     │     │
    │     │     ├── No → 400 "No Google account linked"
    │     │     │
    │     │     └── Yes
    │     │           │
    │     │           ├── Build search query
    │     │           │     ├── User provided query? → Use it
    │     │           │     └── No query → Default: "subject:(absent OR excuse
    │     │           │           OR sick OR cannot attend OR won't be able)"
    │     │           │
    │     │           ├── Call Gmail API: list messages
    │     │           │     │
    │     │           │     ├── 200 OK → Got message IDs
    │     │           │     │
    │     │           │     ├── 401 Unauthorized
    │     │           │     │     │
    │     │           │     │     ├── Has refresh_token?
    │     │           │     │     │     ├── Yes → Refresh access token → Retry
    │     │           │     │     │     └── No → 401 "Token expired, re-auth needed"
    │     │           │     │     │
    │     │           │     │     └── Refresh succeeded? → Retry list call
    │     │           │     │
    │     │           │     └── Other error → 500 with error details
    │     │           │
    │     │           ├── For each message ID:
    │     │           │     │
    │     │           │     ├── Fetch full message (format=full)
    │     │           │     ├── Parse headers (From, Subject, Date)
    │     │           │     ├── Extract body:
    │     │           │     │     ├── text/plain part? → Use directly
    │     │           │     │     ├── text/html part? → Strip HTML tags
    │     │           │     │     └── No body? → Use subject as body
    │     │           │     └── Decode base64url content
    │     │           │
    │     │           └── Return array of { id, from, subject, date, body }
```

### 8.4 Theme Toggle Logic

```
App loads
    │
    ├── Check localStorage("pulse-theme")
    │     │
    │     ├── "light" → Set theme to light, remove "dark" class
    │     ├── "dark" → Set theme to dark, add "dark" class
    │     └── Not set → Default to "dark", add "dark" class
    │
    ├── ThemeProvider wraps entire app
    │     │
    │     └── Provides { theme, toggleTheme } via React Context
    │
    └── User clicks toggle button
          │
          ├── theme === "dark"?
          │     ├── Yes → Switch to "light"
          │     │     ├── Remove "dark" class from <html>
          │     │     ├── CSS variables switch to :root (light palette)
          │     │     └── StarField renders 20 corner sparkles
          │     │
          │     └── No → Switch to "dark"
          │           ├── Add "dark" class to <html>
          │           ├── CSS variables switch to .dark (space palette)
          │           └── StarField renders 120 full-viewport stars
          │
          └── Save to localStorage("pulse-theme")
```

### 8.5 Batch Processing SSE Logic

```
POST /api/process-emails { emails: [...] }
    │
    ├── Set response headers for SSE
    │     Content-Type: text/event-stream
    │     Cache-Control: no-cache
    │     Connection: keep-alive
    │
    ├── Generate batchId (random UUID)
    │
    ├── For each email in array (index i):
    │     │
    │     ├── Send SSE: { type: "progress", current: i+1, total: N }
    │     │
    │     ├── Call categorizeExcuse(email.emailBody)
    │     │     │
    │     │     ├── Success → { category, confidence, reasoning }
    │     │     │     │
    │     │     │     ├── Create record in database
    │     │     │     │     userId, senderName, senderEmail, receivedAt,
    │     │     │     │     emailBody, excuseCategory, messageSnippet, batchId
    │     │     │     │
    │     │     │     └── Send SSE: { type: "result", record: {...} }
    │     │     │
    │     │     └── Error
    │     │           └── Send SSE: { type: "error", email: senderEmail,
    │     │                           error: message }
    │     │
    │     └── Continue to next email
    │
    └── Send SSE: { type: "complete", batchId }
        Close connection
```

### 8.6 Export Logic

```
User clicks export button
    │
    ├── CSV Export
    │     │
    │     ├── GET /api/export/csv
    │     ├── Fetch ALL records for user (no filter)
    │     ├── Build CSV string:
    │     │     Header: Name,Email,Date,Excuse Category,Status,Message Snippet
    │     │     Each row: escapeCsv(field) for proper quoting
    │     ├── Set Content-Disposition: attachment; filename=attendance_report.csv
    │     └── Send response (text/csv)
    │
    ├── DOCX Export
    │     │
    │     ├── GET /api/export/doc
    │     ├── Fetch ALL records for user (no filter)
    │     ├── Group records by excuseCategory
    │     ├── Build Document:
    │     │     ├── Title: "Attendance Report" (centered)
    │     │     ├── Subtitle: generation date, total count
    │     │     ├── For each category:
    │     │     │     ├── Heading: "Category Name (count)"
    │     │     │     └── Table: Name | Email | Date | Message Snippet
    │     │     └── Pack to buffer
    │     ├── Set Content-Disposition: attachment; filename=attendance_report.docx
    │     └── Send response (application/vnd.openxmlformats-...)
    │
    └── Print View
          │
          ├── window.print() triggered
          ├── @media print CSS activates:
          │     ├── Hide: .star-field, .no-print (nav, buttons, filters)
          │     ├── Show: .print-header (title, period, count)
          │     ├── Style: white background, black text, bordered table
          │     └── Show: .print-category (static text instead of dropdown)
          └── Only filtered records are printed (time period + category)
```

---

## 9. Full Project Report

### 9.1 Executive Summary

PULSE is a production-ready, multi-user attendance automation tool that leverages AI to categorize student absence excuse emails. Built with a modern TypeScript stack (React + Express + PostgreSQL), it provides three email ingestion methods (manual, batch, Gmail), AI-powered categorization into six predefined categories, and multiple export formats (CSV, DOCX, print). The application features Google OAuth integration for Gmail access, a distinctive space-themed UI with animated star fields, and full dark/light mode support.

### 9.2 Features Implemented

**Core Features:**
- Multi-user authentication (username/password + Google OAuth)
- Demo mode with pre-seeded sample data
- Single email manual entry with AI categorization
- Batch email processing via JSON paste or JSON/CSV file upload
- Real-time batch processing progress via Server-Sent Events
- Gmail inbox search and email selection for AI processing
- Automatic token refresh for Gmail API access
- Dashboard with category-based statistics cards
- Time-period filtering (Day, Week, Month, Quarter, Year)
- Category-based filtering via stat card clicks
- Manual category override on any record
- Record status management (pending/approved/denied)
- Individual record deletion and bulk clear
- CSV export (all records)
- DOCX export (grouped by category, formatted tables)
- Print view (filtered records, print-optimized CSS)

**UI/UX Features:**
- Space-themed design with animated star field (120 stars, 4 animation types: twinkle-soft, twinkle-flash, twinkle-flicker, sparkle-cross)
- Dark/light mode toggle with localStorage persistence
- Light mode: subtle violet corner sparkles (20 sparkles in corners only)
- Dark mode: full-viewport star field with varied colors (white, bluish, warm, cool, pinkish) and full-intensity sparkle with scale(2) and cross-shaped box-shadow
- Responsive design via Tailwind CSS breakpoints
- WCAG 2 accessibility compliance
- shadcn/ui component library for consistent, accessible UI primitives
- Toast notifications for user feedback
- `data-testid` attributes on all interactive elements

### 9.3 AI Categorization Details

The system uses OpenAI GPT via Replit AI Integrations with a structured system prompt. Each email body is sent with instructions to categorize into exactly one of six categories. The AI returns a JSON response with:
- `category` — one of the six valid categories (exact string match)
- `confidence` — a number between 0 and 1
- `reasoning` — a brief one-sentence explanation

The system validates the response against the allowed category list and falls back to "Unexcused" with confidence 0 if the AI response is malformed, unparseable, or returns an invalid category. The `response_format: { type: "json_object" }` parameter enforces structured JSON output from the model.

### 9.4 Security Model

- Passwords hashed with bcrypt (10 rounds)
- Sessions stored server-side in PostgreSQL (not in cookies)
- Session cookies: `httpOnly`, `secure` in production, 7-day expiry
- Google OAuth state parameter for CSRF protection
- All API routes require authentication via `requireAuth` middleware
- All database queries scoped to the authenticated user's ID
- Google tokens stored server-side only
- Request body validation via Zod schemas

### 9.5 Data Model Summary

The application uses four primary tables:
1. **users** — User accounts with optional Google OAuth linkage (9 columns)
2. **attendance_records** — Processed absence excuse records (11 columns)
3. **session** — Express session persistence (auto-managed by connect-pg-simple)
4. **conversations/messages** — AI integrations support tables (Replit-managed)

Key relationship: Each user has zero-to-many attendance records. Records are isolated per user via the `userId` foreign key, ensuring complete multi-tenant data separation.

### 9.6 Storage Interface

The `IStorage` interface in `server/storage.ts` defines all data access operations:

**User Operations:**
- `createUser(user)` — Create a new user account
- `getUserByUsername(username)` — Look up user by username
- `getUserByEmail(email)` — Look up user by email
- `getUserById(id)` — Look up user by ID
- `getUserByGoogleId(googleId)` — Look up user by Google OAuth ID
- `updateUserGoogleTokens(userId, accessToken, refreshToken?)` — Update stored OAuth tokens

**Record Operations:**
- `getAllRecords(userId)` — Get all records for a user (ordered by creation date descending)
- `getRecordById(id)` — Get a single record
- `getRecordsByBatchId(batchId, userId)` — Get records from a specific batch
- `createRecord(record)` — Create a single attendance record
- `createRecords(records)` — Bulk create attendance records
- `updateRecordCategory(id, category)` — Change a record's excuse category
- `updateRecordStatus(id, status)` — Change a record's review status
- `deleteRecord(id)` — Delete a single record
- `deleteAllRecords(userId)` — Delete all records for a user
- `getStats(userId)` — Get total count and per-category breakdown

### 9.7 Performance Considerations

- Client-side filtering avoids additional API calls for time-period and category filters
- TanStack React Query provides automatic caching with targeted invalidation after mutations
- Server-Sent Events provide streaming updates during batch processing (no polling)
- Star field animations use CSS-only animations (no JavaScript animation loops)
- Light mode reduces star count from 120 to 20 for minimal visual overhead
- `useMemo` used for star generation and record filtering to avoid unnecessary recomputation

### 9.8 Known Limitations

1. CSV and DOCX exports always include all records regardless of active frontend filters
2. Google OAuth requires the user's email to be added as a test user while the consent screen is in "Testing" mode
3. Gmail fetch is limited to the `gmail.readonly` scope — no email modification
4. AI categorization cost scales linearly with email count (one API call per email)
5. No pagination on the records table (all records loaded at once)
6. No real-time collaboration — each user manages their own independent record set

### 9.9 Deployment

The application runs on Replit with the following deployment configuration:
- **Development:** `npm run dev` starts Express 5 with Vite middleware for HMR
- **Production:** Built frontend served as static files by Express
- **Database:** Replit-managed PostgreSQL accessed via `DATABASE_URL`
- **Secrets:** Managed via Replit's environment secrets system
- **AI:** OpenAI access via Replit AI Integrations (auto-configured environment variables)

---

*End of Documentation*
