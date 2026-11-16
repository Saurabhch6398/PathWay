# Deploying PathWay

PathWay deploys as **one Docker service** (the API also serves the built website) plus a **MongoDB** database.
Serving both from one address means the login cookie works without any cross-site settings.

This guide uses **MongoDB Atlas** (database) and **Render** (hosting). Any host that runs a Docker image works the same
way: set the environment variables in the table below, expose the `PORT`, and use `/api/health` as the health check.
Dashboards change over time, so menu names may differ slightly from what is written here.

## 0. Before you start

- A GitHub account with this project pushed to a repository.
- Optional: a Gemini API key from https://aistudio.google.com/apikey (without it everything works except the AI features).
- Run it locally once first (see the README) so you know it works on your machine.
- Optional but recommended: run the integration tests against a real MongoDB (`npm run test:integration -w @pathway/api`).

## 1. Create the database (MongoDB Atlas)

1. Create an Atlas account and a **free cluster**.
2. **Database Access** → add a database user with a strong generated password (read/write to any database).
3. **Network Access** → allow connections from the hosting service. Render's outbound addresses change, so the usual
   free-tier setup is to allow `0.0.0.0/0`. That is acceptable _because_ the database requires the username and password;
   if you later use a paid plan with fixed outbound IPs, restrict it to those.
4. **Connect → Drivers** → copy the connection string and add the database name, e.g.
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/pathway?retryWrites=true&w=majority`.
   If the password contains special characters, URL-encode them.

## 2. Deploy the app (Render)

**With the blueprint (easiest)**

1. Push the repository to GitHub.
2. In Render: **New → Blueprint**, pick the repository. It reads `render.yaml`.
3. Fill in the values it asks for:
   - `MONGODB_URI` – the Atlas string from step 1
   - `CLIENT_URL` – your site's address, e.g. `https://pathway.onrender.com` (you can edit it after the first deploy
     once you know the exact URL)
   - `GEMINI_API_KEY` – optional
     `JWT_ACCESS_SECRET` is generated for you.
4. Deploy. The first build takes a few minutes.

**Manually (any Docker host)**: create a web service from the `Dockerfile` with these environment variables.

| Variable            | Value                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`          | `production`                                                                                                   |
| `MONGODB_URI`       | your Atlas connection string                                                                                   |
| `JWT_ACCESS_SECRET` | a random string of 32+ characters (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| `CLIENT_URL`        | your public `https://…` address                                                                                |
| `GEMINI_API_KEY`    | optional                                                                                                       |
| `TRUST_PROXY`       | leave unset (defaults to 1 behind a proxy). Set `0` if there is no proxy in front                              |

`PORT` is provided by the host. Health check path: `/api/health`.

## 3. Create your first admin

The demo seed refuses to run in production on purpose (it would create accounts with a known password), so create the
admin explicitly. Free hosting tiers usually have no shell, so run this **from your own computer**, pointed at the
production database:

```bash
# in the project folder, with Node installed and `npm install` done
MONGODB_URI="mongodb+srv://…/pathway?…" \
  npm run create-admin -w @pathway/api -- --email you@example.com --name "Your Name"
```

It asks for a password (at least 12 characters; typing is hidden). To avoid the prompt, set `ADMIN_PASSWORD` instead.
Use `--promote` to turn an existing account into an admin. On Windows PowerShell set the variable first:
`$env:MONGODB_URI="…"`.

## 4. Check the deployment

```bash
node scripts/smoke.mjs https://your-app.onrender.com             # read-only checks
node scripts/smoke.mjs https://your-app.onrender.com --register  # also tests sign-up, login, refresh and logout
```

`--register` creates one throwaway student account (there is no account deletion yet; remove it from Atlas if you like).

Then click through it once yourself:

1. Sign in as the admin → **Tickets** page loads.
2. Register a recruiter → **Company** → create a posting.
3. Register a student → apply to that posting → (as the recruiter) shortlist them → the student sees "shortlisted".
4. Register a mentor → as the student, book a session → (as the mentor) confirm it.
5. If you set a Gemini key: generate a quiz and chat with the advisor.

## 5. Operating it

- **Updating**: push to the connected branch; Render rebuilds. CI (`.github/workflows/ci.yml`) runs lint, types, tests and a
  Docker build on every push; consider requiring it to pass before merging. To roll back, redeploy the previous commit.
- **Logs**: one JSON line per request (method, path, status, duration, user id; no query strings or tokens).
- **Uptime**: point an external monitor (e.g. UptimeRobot) at `/api/health`; it returns 503 when the database is unreachable.
  Free Render instances sleep when idle, so the first request after a pause is slow. Use a paid instance for an always-on site.
- **Backups**: free MongoDB clusters generally do **not** include automated backups (check Atlas's current plan details).
  Either upgrade, or schedule `mongodump --uri "$MONGODB_URI" --out backup-$(date +%F)` from a machine you control, and
  practise restoring with `mongorestore` at least once.
- **Secrets**: rotate `JWT_ACCESS_SECRET` if it ever leaks (everyone will have to sign in again). Never commit `.env`.
- **Custom domain**: add it in Render, update `CLIENT_URL`, and redeploy. HTTPS certificates are automatic.
- **AI costs**: AI endpoints are limited to 15 requests per user per minute. Set a budget/quota on your Gemini key.

## 6. Troubleshooting

| Symptom                                                     | Likely cause                                                                                                           |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Build fails on `npm ci`                                     | `package-lock.json` is out of date: run `npm install` locally and commit it                                            |
| App exits at start with "Invalid environment configuration" | a required variable is missing or `JWT_ACCESS_SECRET` is shorter than 32 characters                                    |
| `connect ECONNREFUSED` / `Server selection timed out`       | wrong `MONGODB_URI`, or Atlas Network Access doesn't allow the host                                                    |
| `/api/health` returns 503                                   | the app is running but the database connection is down                                                                 |
| Everyone gets "Too many requests"                           | `TRUST_PROXY` is 0 behind a proxy, so all users share one IP; set it to 1                                              |
| You can sign in but are logged out on refresh               | the site is served over `http`, or the API and website are on different domains (the cookie is `Secure` in production) |
| AI endpoints return `503 AI_NOT_CONFIGURED`                 | `GEMINI_API_KEY` is not set                                                                                            |
| AI endpoints return `502 AI_UPSTREAM`                       | the model names in `GEMINI_MODELS` aren't available to your key: change them                                           |
| Blank page after deploy                                     | the web app wasn't built into the image (`apps/web/dist` missing), check the build logs                                |
