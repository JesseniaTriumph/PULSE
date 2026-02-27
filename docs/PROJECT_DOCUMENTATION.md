# PULSE - Complete Project Documentation

---

## Table of Contents
1. [Product Requirements Document (PRD)](#1-product-requirements-document-prd)
2. [System Architecture](#2-system-architecture)
3. [Entity Relationship Diagram (ERD)](#3-entity-relationship-diagram-erd)
4. [Technical Requirements Document (TRD)](#4-technical-requirements-document-trd)
5. [Wireframes](#5-wireframes)
6. [System Tools & Requirements](#6-system-tools--requirements)
7. [User Flow](#7-user-flow)
8. [Conditional Logic Trees](#8-conditional-logic-trees)
9. [Full Project Report](#9-full-project-report)

---

## 1. Product Requirements Document (PRD)

### 1.1 Product Overview
**PULSE** is a space-themed, multi-user web application designed for organizational staff to process builder/student absence excuse emails, automatically categorize them using AI, and generate exportable reports (CSV and DOCX) for bulk attendance system updates. Records can be filtered by time period (Day, Week, Month, Quarter, Year) and printed directly from the browser.

### 1.2 Problem Statement
Staff members manually read and categorize dozens of absence excuse emails daily, then manually enter them into attendance systems. This process is time-consuming, error-prone, and inconsistent across staff members.

### 1.3 Target Users
- Program coordinators and administrative staff responsible for tracking builder/student attendance
- Multiple co-workers within the same organization, each with their own login

### 1.4 Excuse Categories (6 Total)
| Category | Description |
|---|---|
| **Sick/Medical** | Illness, doctor appointments, medical emergencies, hospital visits |
| **Personal** | Travel, family events, personal obligations, non-medical personal matters |
| **Program Event** | Program-related events, workshops, conferences, required organization activities |
| **Technical Issue** | Internet outages, equipment failures, transport problems, connectivity issues |
| **Other** | Miscellaneous reasons that don't fit the above categories |
| **Unexcused** | No valid reason provided, vague excuses, insufficient explanation |

### 1.5 Functional Requirements

| ID | Requirement | Status |
|---|---|---|
| FR-01 | Users can register with username, email, password, and display name | Done |
| FR-02 | Users can log in with username and password | Done |
| FR-03 | Users can log out, clearing their session | Done |
| FR-04 | Demo mode with pre-loaded sample data for 6 categories | Done |
| FR-05 | Manually enter a single email for AI categorization | Done |
| FR-06 | Batch upload emails via JSON or CSV for AI categorization | Done |
| FR-07 | AI categorizes each email into one of 6 excuse categories | Done |
| FR-08 | Real-time progress streaming during batch processing (SSE) | Done |
| FR-09 | View all attendance records in a sortable table | Done |
| FR-10 | Filter records by clicking category stat cards | Done |
| FR-11 | Inline edit category via dropdown in the records table | Done |
| FR-12 | View full email body in a detail dialog | Done |
| FR-13 | Delete individual records | Done |
| FR-14 | Clear all records for the user | Done |
| FR-15 | Export records as CSV | Done |
| FR-16 | Export records as formatted DOCX (grouped by category) | Done |
| FR-17 | Each user only sees their own records (data isolation) | Done |
| FR-18 | Filter records by time period: Day, Week, Month, Quarter, Year | Done |
| FR-19 | Print filtered records via browser print dialog | Done |
| FR-20 | Space-themed dark UI with animated star field and violet/indigo branding | Done |
| FR-21 | Stat cards dynamically update counts based on selected time period | Done |
| FR-22 | Google OAuth login | Planned |
| FR-23 | Pull emails directly from Gmail inbox | Planned |

### 1.6 Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | Passwords hashed with bcrypt (10 salt rounds) |
| NFR-02 | Sessions stored server-side in PostgreSQL (7-day expiry) |
| NFR-03 | All API endpoints require authentication (except auth routes) |
| NFR-04 | Record ownership enforced on all CRUD operations |
| NFR-05 | Responsive UI that works on desktop and mobile |
| NFR-06 | AI categorization validates output against allowed categories |
| NFR-07 | Dark space-themed aesthetic with Space Grotesk typography |
| NFR-08 | Print-friendly layout hides interactive elements and star field |

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
+------------------+         +-------------------+         +------------------+
|                  |  HTTP   |                   |  SQL    |                  |
|   React Frontend | ------> |  Express Backend  | ------> | PostgreSQL (Neon)|
|   (Vite + SPA)   | <------ |  (Node.js)        | <------ |                  |
|                  |  JSON   |                   |         +------------------+
+------------------+  + SSE  +-------------------+
                              |         |
                              |         | HTTPS (API call)
                              |         v
                              |  +------------------+
                              |  | OpenAI (GPT)     |
                              |  | via Replit AI     |
                              |  | Integrations     |
                              |  +------------------+
                              |
                              | Session Store
                              v
                      +------------------+
                      | PostgreSQL       |
                      | (session table)  |
                      +------------------+
```

### 2.2 Frontend Architecture

```
React App (Vite SPA)
|
+-- App.tsx (Root - Auth gate + Providers)
|   +-- QueryClientProvider (TanStack Query v5)
|   +-- TooltipProvider (Radix UI)
|   +-- Toaster (notification system)
|   +-- Router (wouter)
|       +-- AuthPage (unauthenticated users)
|       |   +-- StarField (animated background)
|       |   +-- Login Form
|       |   +-- Register Form
|       |   +-- Demo Button
|       +-- Dashboard (authenticated users)
|           +-- StarField (animated background)
|           +-- Header (PULSE logo, user greeting, action buttons)
|           +-- TimePeriodFilter (All Time, Day, Week, Month, Quarter, Year)
|           +-- Stat Cards (6 categories, clickable filters, period-aware counts)
|           +-- Action Bar (print, export CSV, export DOC, clear all)
|           +-- RecordsTable (print-friendly, inline edit, view detail)
|           +-- AddEmailDialog (single email form)
|           +-- BatchUploadDialog (JSON/CSV upload + SSE progress)
```

### 2.3 Backend Architecture

```
Express Server (server/index.ts)
|
+-- Middleware Stack
|   +-- express.json() (body parser)
|   +-- express.urlencoded()
|   +-- express-session (connect-pg-simple store)
|   +-- Request logger
|
+-- Auth Routes (server/auth.ts)
|   +-- POST /api/auth/register
|   +-- POST /api/auth/login
|   +-- POST /api/auth/logout
|   +-- POST /api/auth/demo
|   +-- GET  /api/auth/me
|
+-- API Routes (server/routes.ts) [all protected by requireAuth]
|   +-- GET    /api/records
|   +-- GET    /api/records/:id
|   +-- GET    /api/stats
|   +-- POST   /api/process-emails (SSE stream)
|   +-- PATCH  /api/records/:id/category
|   +-- PATCH  /api/records/:id/status
|   +-- DELETE /api/records/:id
|   +-- DELETE /api/records
|   +-- GET    /api/export/csv
|   +-- GET    /api/export/doc
|
+-- Storage Layer (server/storage.ts)
|   +-- DatabaseStorage class (Drizzle ORM queries)
|
+-- AI Layer (server/openai.ts)
|   +-- categorizeExcuse() -> OpenAI GPT
|
+-- Static/Vite
    +-- Dev: Vite middleware (HMR)
    +-- Prod: Static file serving
```

### 2.4 Communication Patterns

| Pattern | Use Case |
|---|---|
| REST (JSON) | All CRUD operations, auth, stats, single email processing |
| SSE (Server-Sent Events) | Batch email processing - streams progress for each email as AI categorizes it |
| File Download | CSV and DOCX exports served as file attachment responses |
| Browser Print | window.print() triggers print dialog for time-filtered records |

### 2.5 Theme & Branding

| Aspect | Implementation |
|---|---|
| Color Palette | Deep navy background (hsl 230 25% 7%), violet/indigo accents (hsl 265 80% 60%) |
| Typography | Space Grotesk (primary), Space Mono (monospace) |
| Visual Effects | Animated star field (80 stars, CSS twinkle animation), floating logo, purple glow text |
| Category Colors | Rose (Sick/Medical), Amber (Personal), Sky (Program Event), Violet (Technical Issue), Emerald (Other), Slate (Unexcused) |
| Cards/Panels | Semi-transparent backgrounds (bg-card/60), backdrop blur, violet-tinted borders |
| Buttons | Violet-to-indigo gradients for primary actions, violet-bordered outlines for secondary |

---

## 3. Entity Relationship Diagram (ERD)

```
+---------------------------+          +------------------------------------+
|         users              |          |       attendance_records           |
+---------------------------+          +------------------------------------+
| PK  id          SERIAL    |----+     | PK  id              SERIAL        |
|     username    TEXT [UQ]  |    |     | FK  user_id          INTEGER [NN] |
|     email       TEXT [UQ]  |    +----<|     sender_name      TEXT    [NN] |
|     password    TEXT [NN]  |          |     sender_email     TEXT    [NN] |
|     display_name TEXT [NN] |          |     received_at      TIMESTAMP[NN]|
|     created_at  TIMESTAMP  |          |     email_body       TEXT    [NN] |
+---------------------------+          |     excuse_category  TEXT    [NN] |
                                       |     message_snippet  TEXT    [NN] |
+---------------------------+          |     status           TEXT    [NN] |
|         session            |          |     batch_id         TEXT         |
+---------------------------+          |     created_at       TIMESTAMP    |
| PK  sid         VARCHAR    |          +------------------------------------+
|     sess        JSON       |
|     expire      TIMESTAMP  |
+---------------------------+
(auto-managed by connect-pg-simple)

RELATIONSHIPS:
  users.id  ---(1 to Many)---  attendance_records.user_id
  One user has many attendance records.
  Each attendance record belongs to exactly one user.

CONSTRAINTS:
  users.username               UNIQUE, NOT NULL
  users.email                  UNIQUE, NOT NULL
  users.password               NOT NULL (bcrypt hashed)
  users.display_name           NOT NULL
  attendance_records.user_id   REFERENCES users(id), NOT NULL
  attendance_records.status    DEFAULT 'pending'
  attendance_records.excuse_category must be one of:
    'Sick/Medical', 'Personal', 'Program Event',
    'Technical Issue', 'Other', 'Unexcused'
```

### Column Details

#### users
| Column | Type | Constraints | Description |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | Auto-incrementing unique identifier |
| username | TEXT | UNIQUE, NOT NULL | Login username (min 3 chars) |
| email | TEXT | UNIQUE, NOT NULL | User email address |
| password | TEXT | NOT NULL | bcrypt-hashed password (min 6 chars raw) |
| display_name | TEXT | NOT NULL | User's display name shown in UI |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Account creation time |

#### attendance_records
| Column | Type | Constraints | Description |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | Auto-incrementing unique identifier |
| user_id | INTEGER | FK -> users(id), NOT NULL | Owner of this record |
| sender_name | TEXT | NOT NULL | Name of the person who sent the excuse email |
| sender_email | TEXT | NOT NULL | Email address of the sender |
| received_at | TIMESTAMP | NOT NULL | When the excuse email was received |
| email_body | TEXT | NOT NULL | Full text of the excuse email |
| excuse_category | TEXT | NOT NULL | AI-assigned category (one of 6) |
| message_snippet | TEXT | NOT NULL | First 150 characters of email body |
| status | TEXT | NOT NULL, DEFAULT 'pending' | Processing status (pending/processed) |
| batch_id | TEXT | NULLABLE | Groups records from same batch upload |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation time |

#### session (auto-managed)
| Column | Type | Description |
|---|---|---|
| sid | VARCHAR | Session ID (PRIMARY KEY) |
| sess | JSON | Serialized session data (contains userId) |
| expire | TIMESTAMP | Session expiration time |

---

## 4. Technical Requirements Document (TRD)

### 4.1 Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Frontend Framework | React | 18.3.1 | UI rendering |
| Build Tool | Vite | latest | Dev server + production bundling |
| CSS Framework | Tailwind CSS | latest | Utility-first styling |
| UI Components | Shadcn UI (Radix) | latest | Accessible component primitives |
| Routing | wouter | latest | Lightweight client-side routing |
| Data Fetching | TanStack React Query | v5 | Server state management + caching |
| Icons | lucide-react | latest | UI icons |
| Date Utilities | date-fns | latest | Time-period calculations (startOfDay, startOfWeek, etc.) |
| Backend Framework | Express.js | 5.0.1 | HTTP server + API routing |
| Runtime | Node.js | 20+ | Server runtime |
| Database | PostgreSQL (Neon) | managed | Data persistence |
| ORM | Drizzle ORM | latest | Type-safe database queries |
| AI | OpenAI GPT | gpt-5.2 | Email categorization |
| AI Proxy | Replit AI Integrations | latest | Managed AI API access |
| Auth Sessions | express-session | latest | Server-side session management |
| Session Store | connect-pg-simple | latest | PostgreSQL session storage |
| Password Hashing | bcrypt | latest | Secure password storage |
| Validation | Zod + drizzle-zod | latest | Input/output schema validation |
| DOCX Generation | docx | latest | Word document report creation |

### 4.2 API Endpoint Specifications

#### Authentication Endpoints (No auth required)

**POST /api/auth/register**
```
Request Body:
  {
    username: string (min 3 chars),
    email: string (valid email),
    password: string (min 6 chars),
    displayName: string (min 1 char)
  }

Success Response: 201
  { id: number, username: string, email: string, displayName: string }

Error Responses:
  400 - Invalid input (validation failed)
  409 - Username already taken
  409 - Email already registered
  500 - Server error

Side Effect: Creates session cookie
```

**POST /api/auth/login**
```
Request Body:
  { username: string (min 1 char), password: string (min 6 chars) }

Success Response: 200
  { id: number, username: string, email: string, displayName: string }

Error Responses:
  400 - Invalid input
  401 - Invalid username or password
  500 - Server error

Side Effect: Creates session cookie
```

**POST /api/auth/logout**
```
Request Body: (none)

Success Response: 200
  { message: "Logged out" }

Side Effect: Destroys session, clears cookie
```

**POST /api/auth/demo**
```
Request Body: (none)

Success Response: 200
  { id: number, username: string, email: string, displayName: string }

Side Effect:
  - Creates "demo" user if not exists
  - Seeds 6 sample attendance records (one per category) if new
  - Creates session cookie
```

**GET /api/auth/me**
```
Success Response: 200
  { id: number, username: string, email: string, displayName: string }

Error Responses:
  401 - Not authenticated
```

#### Record Endpoints (All require authentication via requireAuth middleware)

**GET /api/records**
```
Success Response: 200
  [
    {
      id: number,
      userId: number,
      senderName: string,
      senderEmail: string,
      receivedAt: string (ISO timestamp),
      emailBody: string,
      excuseCategory: string,
      messageSnippet: string,
      status: string,
      batchId: string | null,
      createdAt: string (ISO timestamp)
    }
  ]

Scope: Returns only records where userId matches session user
Sort: Descending by createdAt
Note: Time-period filtering is applied client-side using date-fns
```

**GET /api/records/:id**
```
Success Response: 200  { ...record object }
Error: 404 - Record not found or not owned by user
```

**GET /api/stats**
```
Success Response: 200
  {
    total: number,
    byCategory: {
      "Sick/Medical": number,
      "Personal": number,
      "Program Event": number,
      "Technical Issue": number,
      "Other": number,
      "Unexcused": number
    }
  }

Scope: Counts only the authenticated user's records
Note: When a time period filter is active, stats are recomputed client-side
      from the time-filtered records (periodStats) for accurate card counts
```

**POST /api/process-emails**
```
Request Body:
  {
    emails: [
      {
        senderName: string,
        senderEmail: string (valid email),
        receivedAt: string (date string),
        emailBody: string
      }
    ]
  }

Response: SSE (text/event-stream)
  Event sequence:
    data: { type: "started", total: number, batchId: string }
    data: { type: "processing", index: number, name: string }
    data: { type: "progress", index: number, record: object, categorization: object }
    ... (repeats for each email)
    data: { type: "complete", total: number, processed: number, batchId: string }

  On per-email error:
    data: { type: "error", index: number, name: string, error: string }

Side Effect: Creates attendance_records in DB with userId from session
```

**PATCH /api/records/:id/category**
```
Request Body: { category: string }
  category must be one of: "Sick/Medical", "Personal", "Program Event",
                            "Technical Issue", "Other", "Unexcused"

Success Response: 200  { ...updated record }
Errors: 400 (invalid category), 404 (not found/not owned)
Authorization: Checks record.userId === session.userId
```

**PATCH /api/records/:id/status**
```
Request Body: { status: string }
Success Response: 200  { ...updated record }
Errors: 404 (not found/not owned)
Authorization: Checks record.userId === session.userId
```

**DELETE /api/records/:id**
```
Success Response: 204 (no content)
Errors: 404 (not found/not owned)
Authorization: Checks record.userId === session.userId
```

**DELETE /api/records**
```
Success Response: 204 (no content)
Effect: Deletes ALL records for the authenticated user only
```

**GET /api/export/csv**
```
Response: File download
  Content-Type: text/csv
  Filename: attendance_report.csv
  Columns: Name, Email, Date, Excuse Category, Status, Message Snippet
  Scope: Only authenticated user's records (all records, not time-filtered)
```

**GET /api/export/doc**
```
Response: File download
  Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
  Filename: attendance_report.docx
  Format: Title page, records grouped by category in tables
  Scope: Only authenticated user's records (all records, not time-filtered)
```

### 4.3 Data Validation Schemas (Zod)

```
loginSchema:
  username: string, min 1 character
  password: string, min 6 characters

registerSchema:
  username:    string, min 3 characters
  email:       string, valid email format
  password:    string, min 6 characters
  displayName: string, min 1 character

emailInputSchema:
  senderName:  string, min 1 character
  senderEmail: string, valid email format
  receivedAt:  string (ISO date string)
  emailBody:   string, min 1 character

batchEmailInputSchema:
  emails: array of emailInputSchema, min 1 item

excuseCategories (constant enum):
  "Sick/Medical" | "Personal" | "Program Event" |
  "Technical Issue" | "Other" | "Unexcused"
```

### 4.4 Security Model

| Concern | Implementation |
|---|---|
| Password Storage | bcrypt hash with 10 salt rounds, never stored in plain text |
| Session Management | Server-side sessions in PostgreSQL via connect-pg-simple, 7-day max age, httpOnly cookies |
| Cookie Security | secure=true in production, sameSite=lax, httpOnly=true |
| Data Isolation | Every database query filters by userId; ownership checked before update/delete |
| Input Validation | Zod schemas validate all request bodies before processing |
| AI Output Validation | AI response validated against 6 allowed categories, falls back to "Other" on invalid |
| Auth Middleware | requireAuth middleware returns 401 for unauthenticated requests on all data endpoints |
| Credential Handling | Session secret stored as environment secret, never hardcoded |

### 4.5 Time-Period Filtering (Client-Side)

| Period | Label | Date Range (computed via date-fns) |
|---|---|---|
| all | All Time | No filter applied, shows all records |
| day | Today | startOfDay(now) to endOfDay(now) |
| week | This Week | startOfWeek(now, Mon) to endOfWeek(now, Mon) |
| month | This Month | startOfMonth(now) to endOfMonth(now) |
| quarter | This Quarter | startOfQuarter(now) to endOfQuarter(now) |
| year | This Year | startOfYear(now) to endOfYear(now) |

Filtering is applied against the `receivedAt` field of each attendance record. Both the records table and the stat card counts update to reflect the selected time period.

### 4.6 Print Functionality

| Aspect | Implementation |
|---|---|
| Trigger | Print button in action bar calls window.print() |
| Hidden Elements | Star field, navigation header, time-period buttons, action buttons, category dropdowns, action column (all use .no-print CSS class) |
| Visible in Print | Print header (PULSE - Attendance Report, period, count, date), records table with Name, Email, Date, Category (text), Snippet columns |
| Styling | White background, black text, bordered table cells, centered header |

---

## 5. Wireframes

### 5.1 Auth Page - Login Mode
```
+--------------------------------------------------------------+
|  [* * * * * * * * animated star field background * * * * * *] |
|                                                              |
|                    [Zap Icon - floating]                      |
|                     PULSE (glowing)                          |
|          AI-Powered Attendance Tracking System               |
|                                                              |
|  +--------------------------------------------------------+  |
|  | (semi-transparent card, backdrop blur)                  |  |
|  |                                                        |  |
|  |  Sign In                                               |  |
|  |  Enter your credentials to access your dashboard       |  |
|  |                                                        |  |
|  |  Username                                              |  |
|  |  +--------------------------------------------------+  |  |
|  |  |                                                  |  |  |
|  |  +--------------------------------------------------+  |  |
|  |                                                        |  |
|  |  Password                                              |  |
|  |  +--------------------------------------------------+  |  |
|  |  |                                                  |  |  |
|  |  +--------------------------------------------------+  |  |
|  |                                                        |  |
|  |  +--------------------------------------------------+  |  |
|  |  | [violet-indigo gradient]  Sign In                 |  |  |
|  |  +--------------------------------------------------+  |  |
|  |                                                        |  |
|  |  Don't have an account? [Create one] (violet link)     |  |
|  |                                                        |  |
|  +--------------------------------------------------------+  |
|                                                              |
|  ----------------------- or -------------------------        |
|                                                              |
|  +--------------------------------------------------------+  |
|  | [violet border]  > Try Demo (with sample data)         |  |
|  +--------------------------------------------------------+  |
|                                                              |
+--------------------------------------------------------------+
```

### 5.2 Auth Page - Register Mode
```
+--------------------------------------------------------------+
|  [* * * * * * * * animated star field background * * * * * *] |
|                                                              |
|                    [Zap Icon - floating]                      |
|                     PULSE (glowing)                          |
|          AI-Powered Attendance Tracking System               |
|                                                              |
|  +--------------------------------------------------------+  |
|  | (semi-transparent card, backdrop blur)                  |  |
|  |                                                        |  |
|  |  Create Account                                        |  |
|  |  Create an account to start processing attendance      |  |
|  |                                                        |  |
|  |  Full Name    [________________________]               |  |
|  |  Email        [________________________]               |  |
|  |  Username     [________________________]               |  |
|  |  Password     [________________________]               |  |
|  |                                                        |  |
|  |  [violet-indigo gradient] Create Account               |  |
|  |                                                        |  |
|  |  Already have an account? [Sign in]                    |  |
|  |                                                        |  |
|  +--------------------------------------------------------+  |
|                                                              |
|  ----------------------- or -------------------------        |
|  +--------------------------------------------------------+  |
|  | [violet border]  > Try Demo (with sample data)         |  |
|  +--------------------------------------------------------+  |
|                                                              |
+--------------------------------------------------------------+
```

### 5.3 Dashboard
```
+--------------------------------------------------------------------------+
| [* * * * * * * * * animated star field (behind content) * * * * * * * * *]|
|                                                                          |
| [Zap] PULSE (glow)          [+ Add Email] [Batch Process] [Sign Out]     |
| Welcome, Demo User                                                       |
+--------------------------------------------------------------------------+
|                                                                          |
| [All Time] [Today] [This Week] [This Month] [This Quarter] [This Year]  |
|  (active=violet gradient, inactive=violet border outline)                |
|                                                                          |
| +----------+ +----------+ +----------+ +----------+ +--------+ +------+ |
| | Total    | | Sick/Med | | Personal | | Program  | | Tech   | |      | |
| | [count]  | | [count]  | | [count]  | | Event    | | Issue  | |      | |
| | (violet) | | (rose)   | | (amber)  | | (sky)    | | (violet| |      | |
| +----------+ +----------+ +----------+ +----------+ +--------+ +------+ |
|                              +----------+ +----------+                   |
|                              | Other     | | Unexcused|                  |
|                              | (emerald) | | (slate)  |                  |
|                              +----------+ +----------+                   |
|                                                                          |
| Records [Sick/Medical] (badge)    [count]                                |
| Feb 1, 2026 - Feb 28, 2026   [Print] [CSV] [DOC] [Clear]               |
|                                                                          |
| +----------------------------------------------------------------------+ |
| | Name          | Email              | Date     | Category     |Actions| |
| +----------------------------------------------------------------------+ |
| | Maria Garcia  | maria.garcia@...   | 2/24/26  | [Sick/Med  v]| [o][x]| |
| | James Wilson  | j.wilson@...       | 2/24/26  | [Program   v]| [o][x]| |
| | Aisha Patel   | aisha.p@...        | 2/23/26  | [Personal  v]| [o][x]| |
| | Tyler Brooks  | tbrooks@...        | 2/25/26  | [Tech Iss  v]| [o][x]| |
| | Sarah Chen    | sarah.chen@...     | 2/25/26  | [Other     v]| [o][x]| |
| | Devon Kim     | devon.kim@...      | 2/25/26  | [Unexcused v]| [o][x]| |
| +----------------------------------------------------------------------+ |
|                                                                          |
| [o] = View full email    [x] = Delete record    [v] = Category dropdown |
+--------------------------------------------------------------------------+
```

### 5.4 Print View (browser print dialog output)
```
+--------------------------------------------------------------+
|                                                              |
|              PULSE - Attendance Report                       |
|  Period: This Month | Total Records: 6 | Generated: 2/27/26 |
|                                                              |
| +----------------------------------------------------------+|
| | Name          | Email              | Date     | Category  ||
| +----------------------------------------------------------+|
| | Maria Garcia  | maria.garcia@...   | 2/24/26  | Sick/Med  ||
| | James Wilson  | j.wilson@...       | 2/24/26  | Program   ||
| | Aisha Patel   | aisha.p@...        | 2/23/26  | Personal  ||
| | Tyler Brooks  | tbrooks@...        | 2/25/26  | Tech Iss  ||
| | Sarah Chen    | sarah.chen@...     | 2/25/26  | Other     ||
| | Devon Kim     | devon.kim@...      | 2/25/26  | Unexcused ||
| +----------------------------------------------------------+|
|                                                              |
+--------------------------------------------------------------+
(No star field, no buttons, no dropdowns - clean printable table)
```

### 5.5 Add Email Dialog
```
+------------------------------------------------------+
|  Add Email for Processing                       [X]  |
|  (violet-bordered dialog, backdrop blur)             |
|                                                      |
|  Student Name                                        |
|  +------------------------------------------------+  |
|  |                                                |  |
|  +------------------------------------------------+  |
|                                                      |
|  Student Email                                       |
|  +------------------------------------------------+  |
|  |                                                |  |
|  +------------------------------------------------+  |
|                                                      |
|  Date Received                                       |
|  +------------------------------------------------+  |
|  |                                                |  |
|  +------------------------------------------------+  |
|                                                      |
|  Email Body                                          |
|  +------------------------------------------------+  |
|  |                                                |  |
|  |                                                |  |
|  |                                                |  |
|  +------------------------------------------------+  |
|                                                      |
|              [Cancel]    [Process]                    |
+------------------------------------------------------+
```

### 5.6 Batch Upload Dialog
```
+------------------------------------------------------+
|  Batch Process Emails                           [X]  |
|                                                      |
|  +----------+  +----------+                          |
|  | Paste JSON|  | Upload File|                       |
|  +----------+  +----------+                          |
|                                                      |
|  Paste JSON array or upload a file:                  |
|  +------------------------------------------------+  |
|  | [                                              |  |
|  |   { "senderName": "...", ... },                |  |
|  |   { "senderName": "...", ... }                 |  |
|  | ]                                              |  |
|  +------------------------------------------------+  |
|                                                      |
|  [Upload File]                                       |
|                                                      |
|  --- While Processing ---                            |
|                                                      |
|  Processing 3 of 6 emails...                         |
|  +================================================+  |
|  |====================>                           |  |
|  +================================================+  |
|                                                      |
|              [Cancel]    [Process Emails]             |
+------------------------------------------------------+
```

### 5.7 View Email Detail Dialog
```
+------------------------------------------------------+
|  Email Details                                  [X]  |
|  (violet-bordered dialog, backdrop blur)             |
|                                                      |
|  Name:     Maria Garcia                              |
|  Email:    maria.garcia@university.edu               |
|  Date:     2/24/2026                                 |
|  Category: [Sick/Medical] (colored badge)            |
|                                                      |
|  Full Email Body                                     |
|  +------------------------------------------------+  |
|  | Good morning, I woke up with a severe migraine  |  |
|  | and nausea this morning. I've already scheduled |  |
|  | a doctor's appointment for 10 AM...             |  |
|  +------------------------------------------------+  |
|                                                      |
+------------------------------------------------------+
```

---

## 6. System Tools & Requirements

### 6.1 Runtime Environment
| Component | Requirement |
|---|---|
| Platform | Replit (NixOS-based Linux container) |
| Node.js | v20+ |
| PostgreSQL | Neon Serverless (managed, via DATABASE_URL) |
| AI Service | Replit AI Integrations (OpenAI proxy, billed to Replit credits) |

### 6.2 Environment Variables

| Variable | Type | Required | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Runtime-managed | Yes | PostgreSQL connection string (auto-provisioned by Replit) |
| `SESSION_SECRET` | Secret | Yes | Signs and verifies session cookies |
| `PULSE_GOOGLE_CLIENT_ID` | Secret | Planned | Google OAuth client ID for Gmail integration (PULSE-specific) |
| `PULSE_GOOGLE_CLIENT_SECRET` | Secret | Planned | Google OAuth client secret for Gmail integration (PULSE-specific) |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Runtime-managed | Yes | OpenAI API key (auto-set by Replit AI Integrations) |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Runtime-managed | Yes | OpenAI proxy URL (auto-set by Replit AI Integrations) |

### 6.3 NPM Dependencies

#### Backend / Core
| Package | Purpose |
|---|---|
| express | Web server framework (v5) |
| express-session | Session middleware for cookie-based auth |
| connect-pg-simple | Stores sessions in PostgreSQL |
| bcrypt | Password hashing (10 salt rounds) |
| drizzle-orm | Type-safe ORM for PostgreSQL |
| drizzle-zod | Bridge between Drizzle schemas and Zod validation |
| @neondatabase/serverless | Neon PostgreSQL driver (WebSocket-based) |
| pg | PostgreSQL client library |
| zod | Runtime schema validation for request bodies |
| openai | OpenAI SDK for AI categorization |
| docx | Generates Word (.docx) documents for export |
| ws | WebSocket library (required by Neon driver) |

#### Frontend
| Package | Purpose |
|---|---|
| react, react-dom | UI rendering framework |
| wouter | Lightweight client-side router |
| @tanstack/react-query | Server state management, caching, mutations |
| lucide-react | SVG icon components |
| react-icons | Additional icons (brand logos via react-icons/si) |
| tailwind-merge, clsx | CSS class composition utilities |
| class-variance-authority | Component variant styling system |
| Radix UI primitives | Accessible UI foundations (Dialog, Select, Tabs, etc.) |
| recharts | Data visualization charts |
| framer-motion | UI animations and transitions |
| date-fns | Time-period filtering (startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear + end* variants) |

#### Dev Tools
| Package | Purpose |
|---|---|
| typescript | Static type checking |
| tsx | TypeScript execution for dev server |
| vite | Frontend dev server and production bundler |
| @vitejs/plugin-react | React JSX transform for Vite |
| tailwindcss, postcss, autoprefixer | CSS processing pipeline |
| drizzle-kit | Database schema push and migration tooling |
| esbuild | Backend production build |

### 6.4 Scripts
| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `NODE_ENV=development tsx server/index.ts` | Start development server (backend + Vite HMR) |
| `npm run build` | `tsx script/build.ts` | Build frontend and backend for production |
| `npm start` | `NODE_ENV=production node dist/index.js` | Run production build |
| `npm run db:push` | `drizzle-kit push` | Sync Drizzle schema to PostgreSQL database |

---

## 7. User Flow

### 7.1 Complete User Journey

```
[User visits app URL]
        |
        v
[Check authentication: GET /api/auth/me]
        |
   +----+----+
   |         |
 401       200
(not auth) (authenticated)
   |         |
   v         v
[Auth Page]  [Dashboard] -----> (see 7.2)
   |
   +--------+--------+---------+
   |        |        |         |
[Login]  [Register]  [Demo]    |
   |        |        |         |
   v        v        v         |
[Enter   [Enter    [Click      |
 username  name,    "Try       |
 password] email,   Demo"]     |
           username,    |      |
           password]    |      |
   |        |        |         |
   v        v        v         |
[POST      [POST    [POST      |
 /login]    /register] /demo]  |
   |        |        |         |
   +--------+--------+         |
            |                  |
      [Session created]        |
            |                  |
            v                  |
      [Dashboard] <------------+
```

### 7.2 Dashboard Interactions

```
[Dashboard loaded]
   |
   +----> [Select Time Period]
   |         Click any period button (All Time, Today, This Week, etc.)
   |         Records and stat cards filter to matching date range
   |         Period description shown below records heading
   |
   +----> [View Stats]
   |         6 category cards show counts for selected time period
   |         Click any card to filter table by that category
   |
   +----> [Add Single Email]
   |         Click "Add Email" button
   |         Fill form (name, email, date, body)
   |         Click "Process"
   |         AI categorizes -> record created
   |         Table refreshes
   |
   +----> [Batch Process]
   |         Click "Batch Process" button
   |         Choose Paste JSON or Upload File tab
   |         Paste text or upload file
   |         Click "Process Emails"
   |         Watch real-time progress (SSE)
   |         All records created
   |         Table refreshes
   |
   +----> [Edit Category]
   |         Click dropdown in table row
   |         Select new category
   |         PATCH request updates record
   |         Stats refresh
   |
   +----> [View Email Detail]
   |         Click eye icon in table row
   |         Dialog shows full email body
   |
   +----> [Delete Record]
   |         Click delete on table row
   |         Record removed
   |
   +----> [Clear All]
   |         Click "Clear" button
   |         Confirmation dialog
   |         All user's records deleted
   |
   +----> [Print Records]
   |         Click "Print" button
   |         Browser print dialog opens
   |         Shows clean table with header, period, and record count
   |         Star field, buttons, dropdowns all hidden
   |
   +----> [Export CSV]
   |         Click "CSV" button
   |         Browser downloads attendance_report.csv
   |
   +----> [Export DOCX]
   |         Click "DOC" button
   |         Browser downloads attendance_report.docx
   |
   +----> [Sign Out]
            Click "Sign Out"
            Session destroyed
            Redirected to Auth Page
```

### 7.3 Time-Period Filtering Flow

```
[User clicks time period button]
        |
        v
[setTimePeriod(period)]
        |
        v
[getTimePeriodRange(period)]
        |
   +----+----+
   |         |
 "all"     other
   |         |
   v         v
[null     [{ start: startOfPeriod(now),
 range]     end: endOfPeriod(now) }]
   |         |
   v         v
[timeFilteredRecords = records.filter(r =>
   period === "all" || (r.receivedAt >= start && r.receivedAt <= end))]
        |
        v
[periodStats = recompute counts from timeFilteredRecords]
        |
        v
[Stat cards show periodStats counts]
[Table shows timeFilteredRecords (+ optional category filter)]
[Print button prints currently visible filtered records]
```

### 7.4 Batch Processing Detail Flow

```
[User clicks "Batch Process"]
        |
        v
[Dialog opens with Paste JSON / Upload File tabs]
        |
   +----+----+
   |         |
[JSON]    [CSV]
   |         |
[Paste    [Upload .csv file]
 JSON      |
 array]   [Parse CSV headers:
   |       senderName, senderEmail,
   |       receivedAt, emailBody]
   |         |
   +----+----+
        |
  [Validate: array of emails, min 1]
        |
  [Click "Process Emails"]
        |
        v
  [POST /api/process-emails]
        |
        v
  [Server generates batchId (UUID)]
        |
        v
  [SSE stream begins]
        |
        +----> For EACH email (sequential):
        |         |
        |    [Event: "processing" { index, name }]
        |    [Frontend: show "Processing {name}..."]
        |         |
        |    [Call OpenAI: categorizeExcuse(emailBody)]
        |         |
        |    [Validate AI response category]
        |         |
        |    [Create attendance_record in DB]
        |         |
        |    [Event: "progress" { index, record, categorization }]
        |    [Frontend: show checkmark + assigned category]
        |    [Frontend: update progress bar]
        |
        v
  [Event: "complete" { total, processed, batchId }]
        |
        v
  [Frontend: show summary]
  [Invalidate /api/records and /api/stats cache]
  [Dashboard table + stats refresh with new data]
```

---

## 8. Conditional Logic Trees

### 8.1 Authentication Decision Tree

```
[Any API request arrives]
        |
        v
[Is path /api/auth/* ?]
   |              |
  YES             NO
   |              |
   v              v
[Route to      [requireAuth middleware]
 auth handler]      |
   |           [req.session.userId exists?]
   |              |              |
   |             YES             NO
   |              |              |
   |              v              v
   |         [next()         [Return 401
   |          continue]       { error: "Not authenticated" }]
   |
   +---> POST /api/auth/register
   |        |
   |   [registerSchema.safeParse(body)]
   |        |--- FAIL --> 400 { error: "Invalid input" }
   |        |
   |   [storage.getUserByUsername(username)]
   |        |--- FOUND --> 409 { error: "Username already taken" }
   |        |
   |   [storage.getUserByEmail(email)]
   |        |--- FOUND --> 409 { error: "Email already registered" }
   |        |
   |   [bcrypt.hash(password, 10)]
   |   [storage.createUser({...})]
   |   [req.session.userId = user.id]
   |        |
   |        v
   |   201 { id, username, email, displayName }
   |
   +---> POST /api/auth/login
   |        |
   |   [loginSchema.safeParse(body)]
   |        |--- FAIL --> 400 { error: "Invalid input" }
   |        |
   |   [storage.getUserByUsername(username)]
   |        |--- NOT FOUND --> 401 { error: "Invalid username or password" }
   |        |
   |   [bcrypt.compare(password, user.password)]
   |        |--- FALSE --> 401 { error: "Invalid username or password" }
   |        |
   |   [req.session.userId = user.id]
   |        |
   |        v
   |   200 { id, username, email, displayName }
   |
   +---> POST /api/auth/demo
   |        |
   |   [storage.getUserByUsername("demo")]
   |        |
   |   +----+----+
   |   |         |
   | FOUND    NOT FOUND
   |   |         |
   |   |    [Create demo user]
   |   |    [bcrypt.hash("demo123456", 10)]
   |   |    [storage.createUser({username:"demo",...})]
   |   |    [Create 6 seed records:]
   |   |      - Maria Garcia -> Sick/Medical
   |   |      - James Wilson -> Program Event
   |   |      - Aisha Patel  -> Personal
   |   |      - Tyler Brooks -> Technical Issue
   |   |      - Sarah Chen   -> Other
   |   |      - Devon Kim    -> Unexcused
   |   |         |
   |   +----+----+
   |        |
   |   [req.session.userId = user.id]
   |        v
   |   200 { id, username, email, displayName }
   |
   +---> POST /api/auth/logout
   |        |
   |   [req.session.destroy()]
   |   [res.clearCookie("connect.sid")]
   |        v
   |   200 { message: "Logged out" }
   |
   +---> GET /api/auth/me
            |
       [req.session.userId exists?]
            |              |
           YES             NO
            |              |
       [storage.getUserById(userId)]   401
            |              |
          FOUND         NOT FOUND
            |              |
       200 { id, ... }   401
```

### 8.2 Record Ownership Authorization Tree

```
[Authenticated request to read/modify/delete a record]
        |
        v
[Parse record ID from req.params.id]
        |
        v
[storage.getRecordById(id)]
        |
   +----+----+
   |         |
  null     record found
   |         |
   v         v
  404    [record.userId === req.session.userId?]
              |              |
             YES             NO
              |              |
              v              v
         [Proceed        404 { error: "Record not found" }
          with            (same error to prevent
          operation]       user ID enumeration)
```

### 8.3 AI Categorization Decision Tree

```
[Email body text received]
        |
        v
[Send to OpenAI GPT with system prompt]
[Prompt instructs: categorize into exactly one of 6 categories]
[Categories described with examples in prompt]
        |
        v
[Receive AI JSON response]
        |
        v
[JSON.parse(response)]
        |
   +----+----+
   |         |
 FAIL      SUCCESS
   |         |
   v         v
[Return   [Is response.category in excuseCategories array?]
 { category:    |              |
   "Other",    YES             NO
   confidence:  |              |
   0 }]         v              v
           [Return          [Override category to "Other"]
            { category,     [Return { category: "Other",
              confidence }]   confidence: 0 }]
```

### 8.4 Time-Period Filter Decision Tree

```
[User clicks a time period button]
        |
        v
[timePeriod state updated]
        |
        v
[Is period "all"?]
   |         |
  YES        NO
   |         |
   v         v
[Return   [Compute date range using date-fns:]
 all         |
 records]    +-- "day"     -> startOfDay(now) .. endOfDay(now)
             +-- "week"    -> startOfWeek(now, Mon) .. endOfWeek(now, Mon)
             +-- "month"   -> startOfMonth(now) .. endOfMonth(now)
             +-- "quarter" -> startOfQuarter(now) .. endOfQuarter(now)
             +-- "year"    -> startOfYear(now) .. endOfYear(now)
                  |
                  v
             [Filter records where receivedAt >= start && receivedAt <= end]
                  |
                  v
             [Recompute periodStats from filtered records]
                  |
                  v
             [Update stat card counts]
             [Update table display]
             [Apply any active category filter on top]
```

### 8.5 Print Decision Tree

```
[User clicks Print button]
        |
        v
[window.print() called]
        |
        v
[@media print CSS activates]
        |
        +----> [.no-print elements hidden:]
        |         Star field, header nav, time period buttons,
        |         action buttons, category dropdowns, action column
        |
        +----> [.print-header shown:]
        |         "PULSE - Attendance Report"
        |         Period name | Record count | Generated date
        |
        +----> [.print-table styled:]
        |         White background, black text, bordered cells
        |         Category shown as plain text (not dropdown)
        |
        +----> [.print-category shown:]
                  Hidden span with category text becomes visible
                  Replaces the interactive Select dropdown
        |
        v
[Browser print dialog opens with clean formatted table]
```

### 8.6 Email Input Decision Tree

```
[User wants to process emails]
        |
   +----+----+
   |         |
[Single]  [Batch]
   |         |
   v         v
[Click     [Click "Batch Process"]
 "Add       |
 Email"]    v
   |      [Dialog opens]
   v         |
[Dialog   +--+--+
 opens]   |     |
   |    [JSON] [CSV]
   v      |     |
[Fill:  [Paste [Upload .csv file]
 name,  JSON     |
 email, array]  [Parse CSV to array:
 date,    |      map headers to fields]
 body]    |     |
   |      +--+--+
   |         |
   v         v
[Validate [Validate each email object:
 single    senderName (required)
 email:    senderEmail (valid email)
 same      receivedAt (required)
 rules]    emailBody (required)]
   |         |
   |    +----+----+
   |    |         |
   |  VALID    INVALID
   |    |         |
   |    v         v
   |  [Enable   [Show validation errors]
   |   "Process  [Button stays disabled]
   |   Emails"]
   |    |
   +----+
        |
        v
[POST /api/process-emails]
[Body: { emails: [...] }]
        |
        v
[SSE stream: real-time progress per email]
        |
        v
[Records created in DB]
[Cache invalidated]
[Dashboard refreshes]
```

### 8.7 Export Decision Tree

```
[User clicks export button]
        |
   +----+----+
   |         |
 [CSV]    [DOCX]
   |         |
   v         v
[GET /api/ [GET /api/
 export/    export/
 csv]       doc]
   |         |
   v         v
[Fetch all [Fetch all user's records]
 user's        |
 records]      v
   |      [Group records by excuseCategory]
   v           |
[Build CSV     v
 string:   [Build Document object:
 header +   - Paragraph: "Attendance Report" (H1)
 rows with   - Paragraph: date + total count
 escaped     - For each category:
 values]       - Paragraph: "{Category} ({count})" (H2)
   |           - Table: Name | Email | Date | Snippet
   v           ]
[Set           |
 headers:      v
 Content-Type  [Packer.toBuffer(doc)]
 text/csv,        |
 filename:        v
 attendance_   [Set headers:
 report.csv]    Content-Type: application/docx,
   |            filename: attendance_report.docx]
   v               |
[Send CSV          v
 string]       [Send buffer]
   |               |
   v               v
[Browser       [Browser downloads
 downloads      attendance_report.docx]
 attendance_
 report.csv]
```

---

## 9. Full Project Report

### 9.1 Executive Summary
PULSE is a production-ready, space-themed, multi-user web application that automates the processing of builder/student absence excuse emails. It uses AI (OpenAI GPT via Replit AI Integrations) to categorize excuses into 6 predefined categories, provides a dashboard for review and editing with time-period filtering and print capabilities, and generates exportable reports in CSV and DOCX formats. The tool is designed for organizational co-workers who each maintain their own isolated set of attendance records.

### 9.2 Current State (As Built)

| Area | Status | Details |
|---|---|---|
| Authentication | Complete | Username/password registration, login, logout, session management |
| Demo Mode | Complete | One-click demo access with 6 pre-loaded sample records |
| Single Email Processing | Complete | Manual entry form with AI categorization |
| Batch Processing | Complete | JSON paste, JSON file upload, CSV file upload with SSE progress |
| AI Categorization | Complete | OpenAI GPT categorizes into 6 excuse types |
| Dashboard | Complete | Stats cards, filterable table, inline category editing |
| Time-Period Filtering | Complete | Day, Week, Month, Quarter, Year filters with dynamic stat updates |
| Print Functionality | Complete | Print button generates clean, formatted printable report |
| Data Export | Complete | CSV and formatted DOCX report generation |
| Data Isolation | Complete | Each user's data completely isolated |
| Record Management | Complete | View, edit category, delete individual, clear all |
| Space Theme | Complete | Dark navy background, star field, violet/indigo accents, Space Grotesk font |

### 9.3 Planned Features

| Feature | Description | Dependency |
|---|---|---|
| Google OAuth Login | Sign in with Google account instead of username/password | PULSE_GOOGLE_CLIENT_ID, PULSE_GOOGLE_CLIENT_SECRET |
| Gmail Integration | Pull absence excuse emails directly from user's Gmail inbox | Google OAuth + Gmail API scope (gmail.readonly) |
| Auto-archive | Automatically archive/label processed emails in Gmail | Gmail Integration |
| Webhook/API Integration | Direct integration with external attendance tracking systems | API specification from target system |

### 9.4 Known Limitations
1. Emails must currently be entered manually or uploaded as JSON/CSV files
2. No multi-tenancy - all users share the same application instance
3. No password reset flow (planned to be resolved with Google OAuth)
4. No admin role or user management dashboard
5. Batch emails are processed sequentially (one at a time) to manage AI API rate limits
6. No email deduplication - the same email can be processed multiple times
7. CSV/DOCX exports include all records regardless of active time-period filter (print respects the filter)

### 9.5 Infrastructure Summary

| Component | Service | Details |
|---|---|---|
| Hosting | Replit | Development and production hosting |
| Database | Neon PostgreSQL | Serverless, auto-scaling, WebSocket-based connection |
| AI | Replit AI Integrations | OpenAI GPT proxy, billed to Replit credits |
| Domain | Replit-provided | .replit.dev domain (custom domain configurable on deploy) |
| Sessions | PostgreSQL | Server-side session storage via connect-pg-simple |

### 9.6 Project File Inventory

| File | Purpose |
|---|---|
| `shared/schema.ts` | Database schema (Drizzle), Zod validation schemas, TypeScript types |
| `shared/models/chat.ts` | Chat model schemas (unused, from template) |
| `server/index.ts` | Express server setup, middleware stack, startup sequence |
| `server/auth.ts` | Authentication routes, session config, demo mode with seed data |
| `server/routes.ts` | All protected API endpoints (records, stats, exports) |
| `server/storage.ts` | Database access layer with IStorage interface and DatabaseStorage class |
| `server/openai.ts` | AI categorization function using OpenAI GPT |
| `server/db.ts` | Database connection pool setup (Neon PostgreSQL) |
| `server/seed.ts` | Empty seed file (demo data handled by /api/auth/demo) |
| `server/vite.ts` | Vite dev server middleware setup |
| `server/static.ts` | Production static file serving |
| `client/src/main.tsx` | React app entry point |
| `client/src/App.tsx` | Root component with auth gate, providers, routing |
| `client/src/pages/auth.tsx` | Login/Register page with space theme and star field |
| `client/src/pages/dashboard.tsx` | Main dashboard with time-period filter, stats, table, print |
| `client/src/pages/not-found.tsx` | 404 error page |
| `client/src/hooks/use-auth.ts` | Auth state management hook (login/register/demo/logout) |
| `client/src/hooks/use-toast.ts` | Toast notification hook |
| `client/src/components/star-field.tsx` | Animated star field background (80 memoized stars) |
| `client/src/components/records-table.tsx` | Attendance records data table with inline editing and print support |
| `client/src/components/add-email-dialog.tsx` | Single email entry dialog |
| `client/src/components/batch-upload-dialog.tsx` | Batch upload dialog with SSE progress tracking |
| `client/src/lib/queryClient.ts` | TanStack Query client config and API request helper |
| `client/src/index.css` | Global styles, space theme CSS variables, print styles, star field animations |
| `drizzle.config.ts` | Drizzle ORM configuration |
| `vite.config.ts` | Vite build configuration |
| `tailwind.config.ts` | Tailwind CSS configuration |
| `tsconfig.json` | TypeScript configuration |
| `package.json` | Dependencies and scripts |
| `replit.md` | Project overview and architecture reference |
| `docs/PROJECT_DOCUMENTATION.md` | This file - complete project documentation |
