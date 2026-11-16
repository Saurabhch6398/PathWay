# PathWay – Industry Career OS

A career platform that connects **students, mentors, faculty and recruiters**: skills and profiles, jobs / internships /
micro-internship gigs, mentoring sessions, AI quizzes and skill-gap analysis, recruiter hiring tools and faculty
industry-collaboration tracking.

MERN + TypeScript monorepo: **MongoDB · Express 5 · React 19 · Node 22**, validated with Zod, AI via Google Gemini.

| Path                | What                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `apps/api`          | Express API, modular (`modules/<feature>`: routes → service → models)                      |
| `apps/web`          | React + Vite + Tailwind + React Router + TanStack Query                                    |
| `packages/shared`   | Zod schemas and TypeScript types used by both apps (one source of truth)                   |
| `scripts/smoke.mjs` | Post-deploy smoke test                                                                     |
| `docs/`             | [Deployment guide](docs/DEPLOYMENT.md) · [Architecture & data model](docs/ARCHITECTURE.md) |

## Features by role

- **Student** – profile and skills; browse and apply to jobs/internships/gigs; track or withdraw applications; book mentors;
  AI quizzes that update skill levels; AI skill-gap analysis; streaming AI career advisor; opt out of recruiter search.
- **Mentor** – profile and availability; confirm/decline session requests; a private mentee pipeline with notes.
- **Recruiter** – register a company; post and close opportunities; review applicants and shortlist/accept/reject;
  talent search by skill, level and role; analytics.
- **Faculty** – track MoUs, faculty swaps, FDPs, consultancy, research and industry projects through a lifecycle;
  privacy-protected cohort insights; AI academic advisor.
- **Admin** – support ticket queue. **Everyone** – help centre with an AI assistant and tickets.

## Quick start (local)

Requirements: **Node 20+** (`.nvmrc` says 22) and MongoDB (Docker, or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster).

```bash
cp .env.example .env           # Windows: copy .env.example .env
# edit .env: set JWT_ACCESS_SECRET (command is in the file); GEMINI_API_KEY is optional

docker compose up -d           # MongoDB on :27017 (skip if you use Atlas; put its URI in .env)
npm install
npm run seed -w @pathway/api   # demo organisations, opportunities, mentors and one user per role
npm run dev                    # API http://localhost:4000 · web http://localhost:5173
```

Sign in at http://localhost:5173 with `student@pathway.dev`, `mentor@pathway.dev` (also `mentor2@`, `mentor3@`),
`faculty@pathway.dev`, `recruiter@pathway.dev` or `admin@pathway.dev`; password `Password123`.
The seed refuses to run when `NODE_ENV=production`.

Run everything in Docker instead: `docker compose --profile app up --build` → http://localhost:4000.
The app container runs in production mode (Secure cookies), so use Chrome or Firefox for `http://localhost`; Safari refuses Secure cookies on plain http.

## Configuration

| Variable            | Required | Notes                                                                                                  |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `MONGODB_URI`       | yes      | e.g. `mongodb://localhost:27017/pathway` or your Atlas connection string                               |
| `JWT_ACCESS_SECRET` | yes      | at least 32 characters; the app refuses to start without it                                            |
| `NODE_ENV`          |          | `production` enables secure cookies, request logging, and serving the web app                          |
| `PORT`              |          | default 4000 (hosts like Render set it for you)                                                        |
| `CLIENT_URL`        |          | public URL of the site (CORS allow-list); default `http://localhost:5173`                              |
| `GEMINI_API_KEY`    |          | enables quizzes, skill gap, advisor and helpdesk chat. Without it those answer `503 AI_NOT_CONFIGURED` |
| `GEMINI_MODELS`     |          | comma-separated model names tried in order (default `gemini-flash-latest,gemini-flash-lite-latest`)    |
| `TRUST_PROXY`       |          | reverse proxies in front of the app; defaults to 1 in production, 0 otherwise                          |
| `STATIC_DIR`        |          | built web app to serve; defaults to `apps/web/dist` in production                                      |

## Scripts

| Command                                                                  |                                                                   |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `npm run dev`                                                            | API + web with reload                                             |
| `npm run build`                                                          | build the API (`apps/api/dist`) and the web app (`apps/web/dist`) |
| `npm run lint` · `typecheck` · `test` · `format`                         | quality checks (CI runs the first four plus a Docker build)       |
| `npm run test:integration -w @pathway/api`                               | tests against a **real MongoDB** (see below)                      |
| `npm run seed -w @pathway/api`                                           | demo data (never in production)                                   |
| `npm run create-admin -w @pathway/api -- --email you@x.com --name "You"` | create the first admin                                            |
| `node scripts/smoke.mjs <url> [--register]`                              | post-deploy smoke test                                            |

## Testing

- **Unit/route tests (78, `npm test`)** run the real Express app against in-memory fakes of the Mongoose models,
  so they need no database. They cover validation, authorisation, business rules, the AI module (with a scripted fake model),
  static hosting, and error handling.
- **Integration tests (`npm run test:integration`)** run the same app against a real MongoDB and check what fakes can't:
  that the unique/partial/TTL indexes exist and hold under simultaneous requests (double bookings, duplicate sign-ups
  and applications), and that populate, `$elemMatch` and array updates work on real documents.
  ```bash
  docker compose up -d mongo
  TEST_MONGODB_URI=mongodb://localhost:27017 npm run test:integration -w @pathway/api
  ```
  They create and drop a temporary database. Without `TEST_MONGODB_URI` they are skipped.
- **Smoke test** (`scripts/smoke.mjs`) checks a running deployment end to end.

## API overview

All routes are under `/api`. Errors are JSON: `{ "error": { "code", "message" } }`.

| Area            | Endpoints                                                                                                                                                                                                 | Who                          |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Auth            | `POST /auth/register, login, refresh, logout` · `GET /auth/me`                                                                                                                                            | public / signed in           |
| Student profile | `GET, PATCH /students/me`                                                                                                                                                                                 | student                      |
| Opportunities   | `GET /opportunities?kind&q&skill&page&limit` · `GET /:id` · `POST /:id/apply`                                                                                                                             | signed in / student          |
| Applications    | `GET /applications/me` · `POST /:id/withdraw`                                                                                                                                                             | student                      |
| Mentors         | `GET /mentors` · `GET /:id` · `POST /:id/sessions`                                                                                                                                                        | signed in / student          |
| Sessions        | `GET /sessions/me` · `PATCH /:id`                                                                                                                                                                         | student, mentor              |
| Mentor area     | `GET, PATCH /mentors/me` · `GET /me/summary` · `GET /me/mentees` · `PATCH /me/mentees/:studentId`                                                                                                         | mentor                       |
| AI              | `POST /ai/quizzes` · `POST /ai/quizzes/:id/submit` · `GET /ai/quizzes/me` · `POST /ai/skill-gap` · `POST /ai/advisor` (SSE)                                                                               | student (advisor: + faculty) |
| Helpdesk        | `POST /helpdesk/chat` · `POST, GET /helpdesk/tickets…` · admin: `GET /helpdesk/tickets`, `PATCH /:id`                                                                                                     | signed in / admin            |
| Recruiter       | `GET, PATCH /recruiter/me` · `GET, POST /recruiter/opportunities` · `PATCH /:id` · `GET /:id/applications` · `PATCH /recruiter/applications/:id` · `GET /recruiter/students` · `GET /recruiter/analytics` | recruiter                    |
| Faculty         | `GET, PATCH /faculty/me` · `GET, POST /faculty/collaborations` · `PATCH /:id` · `GET /faculty/insights`                                                                                                   | faculty                      |
| Health          | `GET /health` (503 if the database is down)                                                                                                                                                               | public                       |

## Security notes

- Passwords hashed with bcrypt; identical error for unknown email and wrong password; rate-limited credential endpoints.
- 15-minute access token held in memory by the web app; refresh token is an opaque, **single-use, rotating** value in an
  `HttpOnly` cookie (SHA-256 stored server-side). Logout revokes it.
- Role checks on every route; people can only see or change their own records (other people's records return 404).
- Zod validation on every input; helmet headers; 1 MB body limit; `Cache-Control: no-store` on API responses.
- AI: per-user rate limits; user text is passed to the model as data; model output is validated; quiz answer keys never
  leave the server before submission.
- Privacy: talent search never returns email addresses and students can opt out; cohort insights hide groups under 3 students;
  mentor notes are private.

## Known limitations

- Company names belong to the first recruiter who registers them; there is no invite flow to add colleagues yet.
- Mentor title/company are self-declared (unverified). Collaboration partners are free text without accounts.
- No email (verification, password reset) or notifications. Interview scheduling is not built.
- Cohort insights cover all students on the platform (students don't record their college yet).
- Free hosting tiers may sleep when idle and free MongoDB clusters don't include automatic backups; see the deployment guide.

## Status

Phases 0–6 are complete: foundation · auth and data · student MVP · AI module · recruiter · mentor and faculty · production readiness.
