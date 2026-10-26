# GoPratle Event Requirements MVP

A production-oriented four-step event-requirement posting experience. The repository also retains the original `mobile/` and `server/` coursework material; the assignment implementation is isolated in `frontend/` and `backend/`.

## Architecture

```text
Next.js + TypeScript + Tailwind (Vercel)
              |
              | HTTPS POST /api/requirements
              v
Express + Zod validation + Mongoose (Render)
              |
              v
          MongoDB Atlas
```

The browser creates a UUID for each submission and sends it as `X-Idempotency-Key`. MongoDB enforces a unique index on that value, so repeat clicks or retries cannot create duplicate records. The API returns the original record for a duplicate key.

## Features

- Four-step, responsive and keyboard-accessible requirement wizard.
- Single-date and date-range support, required-field feedback, review/edit links, loading/success/error states.
- Strongly typed planner, performer, and crew details. Changing category resets the detail object, preventing stale-category data from being posted.
- Server-side category-aware validation and date validation with Zod.
- Secure origin allow-list CORS, request size limit, helpful JSON errors, liveness endpoint, idempotent persistence.
- Unit tests for client/server validation and API tests for success, validation, and duplicate behavior.

## Category assumptions

The brief does not define the category-specific questions, so this MVP uses the following useful minimum data:

| Category | Required detail fields |
| --- | --- |
| Event Planner | Estimated budget, expected guest count, planning scope |
| Performer | Performance type, required duration, equipment availability |
| Crew | Crew role, shift length, number of people needed |

Additional notes are optional for every category. All dates are date-only strings (`YYYY-MM-DD`), so no timezone conversion is applied.

## Folder structure

```text
frontend/
  src/app/                 Next.js pages and global styles
  src/components/          Reusable form, progress, and review components
  src/lib/                 API client and client validation
  src/types/               Shared frontend data types
backend/
  src/app.ts               Express app and security middleware
  src/routes/              Requirement endpoint
  src/models/              Mongoose Requirement model
  src/validation/          Zod schema and tests
  render.yaml              Render Blueprint deployment file
```

## Local setup

Prerequisites: Node.js 20+ and a MongoDB Atlas cluster (or MongoDB-compatible connection string).

1. Create both environment files from the examples.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

2. Set `MONGODB_URI` in `backend/.env`. Set `CLIENT_ORIGINS=http://localhost:3000` locally. Set `NEXT_PUBLIC_API_URL=http://localhost:5000` in `frontend/.env.local`.

3. Install and start the API, then the web app in a separate terminal.

```bash
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

Visit `http://localhost:3000`. Confirm the API independently at `http://localhost:5000/api/health`.

### Environment variables

| Variable | Service | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Backend | Atlas connection string; secret |
| `CLIENT_ORIGINS` | Backend | Comma-separated allowed frontend origins |
| `PORT` | Backend | Local listening port; Render sets this itself |
| `NODE_ENV` | Backend | Environment mode |
| `NEXT_PUBLIC_API_URL` | Frontend | Public URL of the deployed/local backend API |

Do not put credentials in `NEXT_PUBLIC_*` variables.

## API

### `GET /api/health`

Returns HTTP 200 for service liveness.

```json
{ "status": "ok", "database": "connected" }
```

### `POST /api/requirements`

Send `Content-Type: application/json` and an `X-Idempotency-Key` UUID. The same UUID must be present in `clientSubmissionId`.

```json
{
  "eventName": "Product launch",
  "eventType": "Launch",
  "dateType": "single",
  "startDate": "2026-11-11",
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

Success returns HTTP 201 and `{ "message": "Requirement created.", "requirement": { ... } }`. Invalid input returns HTTP 422 with a per-field `errors` object. A repeated key returns HTTP 200 with `duplicate: true` and the stored requirement.

## Testing and build checks

```bash
cd backend && npm test && npm run build
cd frontend && npm test && npm run build
```

API tests use a repository double for deterministic route coverage; the actual Mongoose model is used in production. Persistence is verified manually against Atlas as described below because a valid Atlas URI is intentionally not committed.

## Deployment

### Backend on Render

1. Push this repository to GitHub and create a Render **Web Service** from it, or use `backend/render.yaml` as a Blueprint.
2. Set root directory to `backend`, build command to `npm ci && npm run build`, and start command to `npm start`.
3. Add `MONGODB_URI` from Atlas and set `CLIENT_ORIGINS` to the exact Vercel URL, for example `https://your-project.vercel.app` (no trailing slash).
4. Deploy, then open `https://your-api.onrender.com/api/health`. Only continue once it reports `database: "connected"`.

### MongoDB Atlas

1. Create an Atlas database user with access limited to this app database.
2. Create a database (for example, `gopratle`) and copy its driver connection string into Render’s `MONGODB_URI`.
3. In Atlas Network Access, allow Render’s outbound IPs where possible; for an MVP, a temporary `0.0.0.0/0` entry is acceptable only with a strong, least-privilege database password.

### Frontend on Vercel

1. Import the same GitHub repository into Vercel and set the root directory to `frontend`.
2. Add `NEXT_PUBLIC_API_URL=https://your-api.onrender.com` to Vercel’s production environment variables.
3. Deploy. Copy the final Vercel URL into Render’s `CLIENT_ORIGINS`, redeploy Render, and test a real submission.

After deployment, submit each category once and confirm a `requirements` collection/document appears in Atlas. This final production database confirmation cannot happen until your real Atlas and hosting credentials are supplied.
