# GoPratle AI Event Assistant & Requirements Platform

A production-oriented event requirement posting and operations platform for event planners, performers, and crew. In addition to the four-step keyboard-accessible requirement wizard, this release features an optional Gemini-powered AI event assistant, a real-time admin operations dashboard, and an interactive event schedule calendar.

---

## Architecture

```text
Next.js + TypeScript + Tailwind (Vercel)
     │                 │                  │
     │ / (Wizard + AI) │ /dashboard       │ /dashboard/calendar
     │                 ▼                  ▼
     │         HTTPS REST APIs (CORS secured)
     ▼                 │
Express + Zod + Mongoose (Render)
     │                 │
     │ GEMINI_API_KEY  │ Mongoose ODM
     ▼                 ▼
Google Gemini API    MongoDB Atlas
(Backend only)       (requirements & ai_system_status)
```

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS, FullCalendar v7.
- **Backend**: Node.js, Express 5, Mongoose 8, Zod v4, `@google/genai`.
- **Database**: MongoDB Atlas with unique idempotency keys, indexing on status/category/dates, and AI operational status tracking.
- **AI Engine**: Google Gemini (`gemini-2.5-flash`), strictly isolated in the Express backend.

---

## Key Features

1. **Four-Step Requirement Wizard**:
   - Step 1: Event Basics (name, type, single date or date range, city/venue, category).
   - Step 2: Category-Specific Details (strongly typed for Planners, Performers, and Crew).
   - Step 3: Contact Details & Notes (requires at least one valid phone number or email address; strictly entered via manual form and never sent to Gemini).
   - Step 4: Review and submit with idempotent UUID enforcement (`X-Idempotency-Key`).
   - Changing categories safely resets category details to prevent stale attributes from being saved.

2. **Guided Event-Planning Chat Assistant**:
   - Interactive guided conversational chat assistant directly above the event form.
   - Initial greeting: *"Hi! I’m your GoPratle event assistant. What are you planning?"*
   - Dynamic quick-reply chips (*Birthday party*, *Wedding*, *Corporate event*, *Concert / performance*, *Other*).
   - Conversational follow-up questions tailored to missing data (date, city, guest count, category, budget/venue).
   - Backend conversational endpoint `POST /api/ai/chat` accumulates conversation history, validates output with Zod, and updates extracted requirements.
   - **Review event details**: Once core details are captured, an action button pre-fills the existing four-step form and scrolls to the wizard for final customer review.
   - **Demo Support Fallback**: If Gemini encounters errors, provider unavailability, or if the user clicks *Need help*, a dedicated fallback panel appears:
     > *"Need help planning your event? Our team can help you complete your brief."*
     > **Demo support: +91 90000 00000**
   - Retains 100% field editability and keeps the manual four-step form accessible in every state.

3. **Resilient AI Availability & Quota Handling**:
   - When Gemini hits rate limits, quotas, token limits, `RESOURCE_EXHAUSTED`, or HTTP 429:
     - Backend catches error without crashing, logs event in `ai_system_status`, and returns HTTP 429:
       ```json
       {
         "code": "AI_LIMIT_REACHED",
         "message": "The AI assistant has temporarily reached its usage limit. Please complete the event form manually."
       }
       ```
     - Frontend displays this exact friendly message, retains the user's typed prompt, and provides **Continue manually** and **Retry** options.
   - Handles missing `GEMINI_API_KEY` with a friendly configuration response (HTTP 503) without exposing credentials.
   - Handles network timeouts with retryable friendly response (HTTP 504).
   - Manual requirement posting remains available 100% of the time.

4. **Real Admin Dashboard (`/dashboard`)**:
   > **Note**: This MVP dashboard is authentication-free. Authentication and role-based access must be added before exposing real customer contact data in production.
   - Real-time MongoDB requirement records and metrics:
     - Total requirements count.
     - Category breakdown (Planner, Performer, Crew counts).
     - Upcoming events count (events scheduled on or after today).
     - AI Assistant Status card (Available / Usage limit reached / Temporarily unavailable with last issue time).
   - Searchable and filterable table:
     - Filter by category, status, date range (`dateFrom` / `dateTo`), event type, and keyword search.
     - Server-side Zod validation, pagination, and sorting.
   - Requirement detail modal and standalone page (`/dashboard/requirements/[id]`). Contact phone numbers (`tel:`) and email addresses (`mailto:`) are protected and displayed only in the individual detail views.
   - Interactive status update control calling `PATCH /api/requirements/:id/status`. Allowed statuses: `new`, `reviewing`, `contacted`, `confirmed`, `closed`.

5. **Real Event Calendar (`/dashboard/calendar`)**:
   - Powered by FullCalendar v7 (`dayGridMonth` and `listMonth` views).
   - Loads real requirements from `GET /api/requirements?limit=100&excludeStatus=closed`.
   - **Excludes Closed Requirements**: Requirements marked with status `closed` remain in the dashboard table for record-keeping, but are excluded from the calendar view via both backend API filtering and defensive client filtering.
   - **Instant Removal on Status Change**: Updating a requirement to `closed` in the event detail modal removes it from the calendar immediately without requiring a page reload.
   - Active requirement statuses (`new`, `reviewing`, `contacted`, `confirmed`) remain clearly visible on the calendar.
   - Single-day events display as one-day blocks; date ranges display across their full multi-day duration.
   - Category-colored event badges:
     - **Planner**: Indigo (`#4f46e5`)
     - **Performer**: Purple (`#9333ea`)
     - **Crew**: Emerald (`#059669`)
   - Click any event to open its full requirement details modal.
   - Gracefully handles and skips malformed or missing dates without breaking.

---

## Data Flow

```text
1. GUIDED AI CHAT FLOW:
User conversation ──> POST /api/ai/chat ──> Gemini ──> Zod validate ──> Review event details ──> Form pre-fill

2. MANUAL WIZARD FLOW:
User input ──> Client validation ──> UUID key ──> POST /api/requirements ──> MongoDB Atlas

3. ADMIN DASHBOARD FLOW:
/dashboard ──> GET /api/requirements?category=...&status=... ──> MongoDB ──> Table & Metrics
Status dropdown ──> PATCH /api/requirements/:id/status ──> MongoDB update

4. CALENDAR FLOW:
/dashboard/calendar ──> GET /api/requirements?excludeStatus=closed ──> FullCalendar month & list render
Status update to closed ──> Immediate local calendar event eviction
```

---

## AI Safety & Gemini Key Handling

- **Zero Client Exposure**: The Gemini API is only called inside the Node/Express backend (`backend/src/services/aiService.ts`). `GEMINI_API_KEY` is never referenced in frontend code, browser network traffic, git commits, or client-side bundles.
- **No Secret Logging**: The server never logs API keys, secret headers, or raw provider tokens.
- **Safe Output Parsing**: Raw Gemini output is stripped of markdown wrappers, parsed as JSON, and strictly validated against Zod schemas (`backend/src/validation/ai.ts`) before returning to the browser.
- **In-Memory Rate Limiting**: Backend applies an IP sliding-window throttle on AI requests to protect Gemini quota.

---

## Category Detail Assumptions

| Category | Required detail fields |
| --- | --- |
| **Event Planner** | Estimated budget (`budget`), expected guest count (`guestCount`), planning scope (`planningScope`: Full planning, Partial planning, Day-of coordination) |
| **Performer** | Performance type (`performanceType`), duration in minutes (`durationMinutes`), equipment availability (`equipmentProvided`: Yes, fully provided, Partially provided, No, provider should bring it) |
| **Crew** | Crew role (`crewRole`), shift length in hours (`shiftHours`), number of people needed (`teamSize`) |

---

## API Documentation

### 1. `GET /api/health`
Returns service and database liveness.

**Response (HTTP 200)**:
```json
{
  "status": "ok",
  "database": "connected"
}
```

---

### 2. `POST /api/ai/extract-event-details`
Extracts structured event requirement details from freeform text using Gemini.

**Request**:
```json
{
  "description": "I need a DJ and decorator for a birthday party in Bangalore next Saturday for 100 guests with a budget of ₹80,000."
}
```

**Success Response (HTTP 200)**:
```json
{
  "extracted": {
    "eventName": "Birthday Party in Bangalore",
    "eventType": "Birthday party",
    "dateType": "single",
    "startDate": "2026-11-21",
    "endDate": "",
    "location": "Bangalore",
    "venue": "",
    "category": "performer",
    "details": {
      "performanceType": "DJ",
      "durationMinutes": "180",
      "equipmentProvided": "No, provider should bring it"
    },
    "notes": "Budget of ₹80,000 with 100 guests. Needs decorator in addition to DJ.",
    "missingFields": ["venue"]
  },
  "missingFields": ["venue"],
  "suggestedStep": 2
}
```

**Quota / Rate Limit Response (HTTP 429)**:
```json
{
  "code": "AI_LIMIT_REACHED",
  "message": "The AI assistant has temporarily reached its usage limit. Please complete the event form manually."
}
```

**Missing Key Response (HTTP 503)**:
```json
{
  "code": "AI_CONFIG_MISSING",
  "message": "The AI assistant is currently not configured. Please complete the event form manually."
}
```

**Network Timeout Response (HTTP 504)**:
```json
{
  "code": "AI_NETWORK_ERROR",
  "message": "The AI request timed out or encountered a network issue. You can retry or continue manually."
}
```

---

### 3. `POST /api/ai/chat`
Conversational endpoint for the guided event assistant. Accepts multi-turn messages and previously extracted state, returning the assistant's next message, quick reply chips, updated structured extraction, and review status.

**Request**:
```json
{
  "messages": [
    { "role": "assistant", "content": "Hi! I’m your GoPratle event assistant. What are you planning?" },
    { "role": "user", "content": "Birthday party for Rohan in Bangalore" }
  ],
  "currentExtracted": {
    "eventType": "Birthday party"
  }
}
```

**Success Response (HTTP 200)**:
```json
{
  "assistantMessage": "Awesome! What date will Rohan's birthday party take place?",
  "quickReplies": ["Next Saturday", "Next month", "Need help"],
  "extracted": {
    "eventName": "Rohan's Birthday Party",
    "eventType": "Birthday party",
    "dateType": "single",
    "startDate": "",
    "endDate": "",
    "location": "Bangalore",
    "venue": "",
    "category": "planner",
    "details": {},
    "notes": "",
    "missingFields": ["startDate"]
  },
  "missingFields": ["startDate"],
  "isReadyForReview": false,
  "suggestedStep": 1
}
```

---

### 4. `GET /api/admin/ai-status`
Returns current operational status of the AI assistant.

**Response (HTTP 200)**:
```json
{
  "status": "available",
  "lastIssueAt": null,
  "lastIssueType": null,
  "updatedAt": "2026-11-14T13:45:00.000Z"
}
```

*(Status values: `available`, `limited`, `unavailable`)*

---

### 4. `POST /api/requirements`
Creates an event requirement. Enforces duplicate prevention via `X-Idempotency-Key`.

**Headers**:
- `Content-Type: application/json`
- `X-Idempotency-Key: <UUID>`

**Request**:
```json
{
  "eventName": "Product launch",
  "eventType": "Launch",
  "dateType": "single",
  "startDate": "2026-11-20",
  "location": "Pune",
  "venue": "Studio 5",
  "category": "performer",
  "details": {
    "performanceType": "DJ",
    "durationMinutes": 120,
    "equipmentProvided": "No, provider should bring it"
  },
  "notes": "Set up by 5 PM.",
  "clientSubmissionId": "80f53d33-cc58-477d-bd42-0bbdf9a3d20b"
}
```

**Success Response (HTTP 201)**:
```json
{
  "message": "Requirement created.",
  "requirement": {
    "_id": "6735c0...",
    "status": "new",
    "eventName": "Product launch",
    ...
  }
}
```

---

### 5. `GET /api/requirements`
Returns paginated requirements with dashboard summary metrics and filter support.

**Query Parameters (Optional)**:
- `page` (number, default: 1)
- `limit` (number, default: 10, max: 100)
- `category` (`planner` | `performer` | `crew`)
- `status` (`new` | `reviewing` | `contacted` | `confirmed` | `closed`)
- `excludeStatus` (`new` | `reviewing` | `contacted` | `confirmed` | `closed` - e.g. `excludeStatus=closed` used by calendar)
- `eventType` (string, case-insensitive substring)
- `location` (string, case-insensitive substring)
- `dateFrom` (`YYYY-MM-DD`)
- `dateTo` (`YYYY-MM-DD`)
- `search` (string, multi-field text search)
- `sortBy` (`createdAt` | `startDate` | `eventName` | `status`)
- `sortOrder` (`asc` | `desc`)

**Response (HTTP 200)**:
```json
{
  "data": [
    {
      "_id": "6735c0...",
      "eventName": "Product launch",
      "eventType": "Launch",
      "dateType": "single",
      "startDate": "2026-11-20",
      "location": "Pune",
      "category": "performer",
      "status": "new",
      "details": { ... },
      "createdAt": "2026-11-14T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "summary": {
    "total": 45,
    "planner": 15,
    "performer": 20,
    "crew": 10,
    "upcoming": 28
  }
}
```

---

### 6. `GET /api/requirements/:id`
Retrieves a single requirement by its MongoDB `_id`.

**Response (HTTP 200)**:
```json
{
  "requirement": {
    "_id": "6735c0...",
    "status": "new",
    "eventName": "Product launch",
    ...
  }
}
```

---

### 7. `PATCH /api/requirements/:id/status`
Updates requirement status in MongoDB.

**Request**:
```json
{
  "status": "reviewing"
}
```
*(Allowed statuses: `new`, `reviewing`, `contacted`, `confirmed`, `closed`)*

**Response (HTTP 200)**:
```json
{
  "message": "Status updated.",
  "requirement": {
    "_id": "6735c0...",
    "status": "reviewing",
    "updatedAt": "2026-11-14T10:15:00.000Z"
  }
}
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Example / Note |
| --- | --- | --- |
| `MONGODB_URI` | MongoDB Atlas driver connection URI | `mongodb+srv://user:pass@cluster.mongodb.net/dbname` |
| `CLIENT_ORIGINS` | Comma-separated allowed frontend origins for CORS | `http://localhost:3000,https://go-pratle-lovat.vercel.app` |
| `PORT` | Local server port (Render injects automatically) | `5000` |
| `NODE_ENV` | Runtime environment | `development` or `production` |
| `GEMINI_API_KEY` | Google Gemini API key for GoPratle AI Assistant | Secret key from Google AI Studio |

### Frontend (`frontend/.env.local`)

| Variable | Description | Example |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Public base URL of the Express backend | `http://localhost:5000` or Render URL |

---

## Local Setup

### Prerequisites
- Node.js 20+
- MongoDB instance or Atlas connection string
- (Optional for AI) Google Gemini API Key

### Steps

1. Configure environment files:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   ```
2. In `backend/.env`:
   - Set `MONGODB_URI`
   - Set `CLIENT_ORIGINS=http://localhost:3000`
   - Set `GEMINI_API_KEY=your_gemini_api_key`
3. In `frontend/.env.local`:
   - Set `NEXT_PUBLIC_API_URL=http://localhost:5000`
4. Install and run both services:
   ```bash
   # Terminal 1: Backend API
   cd backend && npm install && npm run dev

   # Terminal 2: Frontend Web App
   cd frontend && npm install && npm run dev
   ```
5. Open:
   - Form & AI Assistant: `http://localhost:3000`
   - Admin Dashboard: `http://localhost:3000/dashboard`
   - Event Calendar: `http://localhost:3000/dashboard/calendar`
   - Health check: `http://localhost:5000/api/health`

---

## Testing & Build Commands

Run automated tests and production builds across both workspaces:

```bash
# Run all backend tests (22 tests: AI extraction, quotas, CORS, CRUD, validation)
cd backend && npm test

# Run backend build (TypeScript compilation)
cd backend && npm run build

# Run all frontend tests (10 tests: AI assistant, dashboard, validation)
cd frontend && npm test

# Run frontend build (Next.js production build with FullCalendar)
cd frontend && npm run build
```

---

## Deployment Steps

### 1. MongoDB Atlas
1. Ensure your database user has read/write privileges on the database (e.g., `gopratle`).
2. Whitelist Render’s IP addresses (or `0.0.0.0/0` with strong authentication).
3. Copy the driver connection string.

### 2. Backend on Render
1. Connect the GitHub repository to Render as a **Web Service** (or deploy via `backend/render.yaml`).
2. Set Root Directory to `backend`.
3. Build command: `npm ci --include=dev && npm run build`
4. Start command: `npm start`
5. Configure Environment Variables in Render Dashboard:
   - `MONGODB_URI`: Your Atlas connection string
   - `CLIENT_ORIGINS`: Your Vercel frontend URL (e.g. `https://go-pratle-lovat.vercel.app`)
   - `GEMINI_API_KEY`: Your Gemini API key from Google AI Studio
   - `NODE_ENV`: `production`
6. Verify service health at `https://<render-url>/api/health`.

### 3. Frontend on Vercel
1. Import repository on Vercel with Root Directory set to `frontend`.
2. Configure Environment Variable:
   - `NEXT_PUBLIC_API_URL`: Your Render backend URL (no trailing slash).
3. Deploy and test the live application.

---

## Manual Verification Checklist

- [ ] **AI Extraction**: Enter *"I need a DJ and decorator for a birthday party in Bangalore next Saturday for 100 guests with a budget of ₹80,000."* and click **Generate event details**. Verify form fields pre-populate and step advances.
- [ ] **Manual Form Editing**: Change any pre-filled field. Verify fields remain fully editable.
- [ ] **Category Reset**: Switch categories manually in Step 1. Verify detail fields reset properly.
- [ ] **Quota Limit Simulation**: Unset or exhaust Gemini key, trigger AI extraction, and verify the friendly `The AI assistant has temporarily reached its usage limit. Please complete the event form manually.` alert is displayed with **Continue manually** active.
- [ ] **Form Submission**: Submit the requirement and verify confirmation screen.
- [ ] **Admin Dashboard (`/dashboard`)**: Verify new requirement appears in the table with status `new`, and metric cards reflect real counts.
- [ ] **Status Update**: Change status to `reviewing` or `confirmed` via table dropdown or modal. Verify persistence upon refresh.
- [ ] **Calendar (`/dashboard/calendar`)**: Navigate to Calendar, verify single-day and multi-day events render with category colors, switch between Month and List views, and click an event to view details.

---

## Limitations & Future Improvements

- **Authentication**: Current admin dashboard is an authentication-free MVP. Future iterations can integrate NextAuth.js or Clerk with role-based access control (Admin, Coordinator, Viewer).
- **Provider Marketplace Portal**: Direct provider bids and quote responses linked to requirement UUIDs.
- **Email / SMS Alerts**: Webhooks to trigger real-time notifications via SendGrid/Twilio when requirements are submitted or status updates to `confirmed`.
