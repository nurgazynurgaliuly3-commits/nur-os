# NurOS Deployment Plan

## Local

```powershell
.\start-nuros.cmd
```

Open `http://localhost:4174`.

## Environment

Copy `.env.example` to `.env`.

Required for real AI:

```text
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

Hosted production DB:

```text
NUROS_DEPLOY_MODE=production
DATABASE_PROVIDER=supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NUROS_DEMO_USER_ENABLED=false
```

## Migrate Local JSON To Supabase

After running `supabase-schema.sql` in Supabase SQL Editor and setting the environment variables above:

```powershell
node scripts/migrate-json-to-supabase.js
```

On this Windows workspace:

```powershell
.\migrate-supabase.cmd
```

Or pass a custom JSON database path:

```powershell
node scripts/migrate-json-to-supabase.js C:\path\to\nuros-db.json
```

Then verify the hosted provider:

```powershell
npm run test:api:supabase
```

Or without `npm`:

```powershell
.\run-supabase-tests.cmd
```

## Security Runtime

NurOS now includes a lightweight API rate limit and audit trail.

Environment knobs:

```text
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
AUTH_RATE_LIMIT_MAX=25
SESSION_TTL_DAYS=30
AUTH_TOKEN_TTL_MINUTES=30
AUTH_EXPOSE_DEV_TOKENS=false
APP_URL=https://your-nuros-domain.com
EMAIL_PROVIDER=resend
EMAIL_FROM=NurOS <noreply@your-domain.com>
RESEND_API_KEY=
```

Local JSON audit events are written to `.data/audit.log`. Supabase audit events are written to `nuros_audit_events`.
Local auth email messages are written to `.data/email-outbox.log` with `EMAIL_PROVIDER=log`. Hosted auth email can use `EMAIL_PROVIDER=resend`.

Before going public, check:

```powershell
node server.js
```

Then open `/api/health` and confirm `deploy.ready` is `true` and `deploy.errors` is empty.

You can also run:

```powershell
.\check-health.cmd http://localhost:4174/api/health
```

Render hosting can start from `render.yaml`. Use `PRODUCTION_CHECKLIST.md` before exposing the app publicly.

Run the local QA suite before deployment:

```powershell
.\pre-push-report.cmd
.\validate-env.cmd
npm test
```

If `npm` is not available on the Windows machine:

```powershell
.\run-tests.cmd
```

## Hosted Database

1. Create a Supabase project.
2. Run `supabase-schema.sql`.
3. Add Supabase env vars.
4. Set `DATABASE_PROVIDER=supabase`.
5. Run `.\run-supabase-tests.cmd` or `npm run test:api:supabase`.

## Web Hosting

Short path:

1. Deploy this Node server to Render/Railway/Fly.io.
2. Set env vars.
3. Use Supabase storage for public use.
4. Confirm `/api/health` returns `deploy.ready=true`.

Long path:

1. Convert frontend to Next.js.
2. Use Supabase Auth.
3. Use Postgres tables for modules.
4. Use a queue/cron for reminder delivery.
5. Add Sentry and uptime monitoring.
