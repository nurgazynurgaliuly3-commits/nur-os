# NurOS

NurOS is a Personal AI Operating System for managing daily life across finance, rituals, fitness, reminders, and AI chat.

## Run

```powershell
node server.js
```

Open:

```text
http://localhost:4173
```

Demo account is disabled by default. To enable it only for local testing, set:

```text
NUROS_DEMO_USER_ENABLED=true
```

## What Is Implemented

- Auth: register, login, logout, bearer token sessions.
- Database: storage adapter with local JSON and hosted Supabase providers.
- API: `/api/register`, `/api/login`, `/api/logout`, `/api/me`, `/api/state`, `/api/ai/chat`.
- Account tools: `/api/health`, `/api/export`, `/api/backup`, `DELETE /api/account`.
- Data portability: `/api/import` restores a sanitized NurOS export into the current account.
- Production diagnostics: `/api/health` exposes active providers and feature readiness.
- Deploy readiness: `/api/health` reports mode, warnings and blocking production errors.
- In-app diagnostics: Account screen shows active storage, email and deploy readiness status.
- Reminder worker foundation: `/api/reminders`, `/api/reminders/due`, `/api/tick`.
- Reminder delivery log: `/api/tick` records delivered reminder keys so repeated ticks do not duplicate the same reminder.
- Data protection: atomic JSON writes and automatic backups before state update/account deletion.
- Security foundation: API rate limit and audit logging for auth, export, backup, state changes, reminders, AI chat and account deletion.
- Activity timeline: `/api/activity` exposes recent account audit events for the Account screen.
- Browser security: API and static responses include CSP, referrer, permissions and content-type protection headers.
- Session hardening: bearer sessions expire automatically and stale sessions are pruned.
- Auth recovery foundation: email verification and password reset token flows.
- Email delivery foundation: local auth emails are written to `.data/email-outbox.log`; hosted email can use a Resend-compatible provider.
- Dashboard: daily AI summary, finance snapshot, rituals, fitness and reminders.
- Finance: budget, salary, mandatory payments, savings goal, transactions and AI score.
- Rituals: habit tracker, streaks, custom rituals and weak habit analysis.
- Fitness: personal intake, calories, macros, weekly gym split, food budget and safety note.
- AI Core: combines finance, rituals and fitness into proactive recommendations.
- AI Chat: uses the current user state and stores chat history.
- UX: responsive layout, dark mode, PWA shell, Stitch-inspired premium design.
- Mobile QA: auth primary action and logout/theme controls remain usable on narrow screens.
- Accessibility polish: icon-only navigation, topbar and AI command controls have accessible labels.

## Production Status

NurOS is production-gated: `/api/health` and `scripts/validate-env.js` block public launch until Supabase, HTTPS `APP_URL`, real email delivery, hidden auth tokens, and disabled demo mode are configured.

Still recommended before a wide public launch:

- OAuth with Google/Apple.
- Push notifications.
- External uptime/error monitoring.
- Formal privacy/security review.

## Architecture

- `server.js`: static server, REST API, auth, server-side AI Core summary, storage adapter usage.
- `lib/storage.js`: storage provider switch and JSON adapter implementation.
- `app.js`: frontend SPA, auth screen, API sync, module rendering and client-side AI Core.
- `styles.css`: responsive premium design system.
- `manifest.webmanifest` and `service-worker.js`: PWA foundation.
- `.data/nuros-db.json`: generated local database, ignored by git.
- `.data/audit.log`: generated local audit log, ignored by git.
- `.data/email-outbox.log`: generated local email delivery outbox, ignored by git.
- `tests/api-smoke.js`: end-to-end API smoke test.
- `tests/static-smoke.js`: static frontend and PWA asset smoke test.
- `tests/config-report.js`: deploy readiness rules test.
- `supabase-schema.sql`: hosted database schema.
- `DEPLOYMENT.md`: local and hosted deployment plan.
- `PRODUCTION_CHECKLIST.md`: launch readiness checklist.
- `render.yaml`: Render hosting blueprint.
- `storage-adapter.md`: database adapter migration contract.

## Test

```powershell
npm test
```

On this Windows workspace, if `npm` is not on PATH:

```powershell
.\run-tests.cmd
```

Hosted/Supabase helpers for this Windows workspace:

```powershell
.\pre-push-report.cmd
.\validate-env.cmd
.\migrate-supabase.cmd
.\run-supabase-tests.cmd
.\check-health.cmd http://localhost:4174/api/health
```

Individual checks:

```powershell
npm run test:config
npm run test:static
npm run test:api
```

After configuring Supabase credentials:

```powershell
npm run test:api:supabase
```

## Optional AI Provider

Copy `.env.example` to `.env` and set:

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
```

If no key is configured, NurOS keeps working with the local rule-based AI Core fallback.

## Storage Provider

Default local mode:

```text
DATABASE_PROVIDER=json
```

The JSON provider is implemented in `lib/storage.js`. The Supabase REST provider lives in `lib/storage-supabase.js` and is enabled with `DATABASE_PROVIDER=supabase` plus Supabase service credentials.

To migrate local JSON data after creating the Supabase schema:

```powershell
node scripts/migrate-json-to-supabase.js
```

## Safety

NurOS does not diagnose medical conditions and does not prescribe medication. Fitness, supplement and nutrition outputs are planning aids based on user-provided data. If the user enters injury, illness, medication, blood pressure, hormone or other sensitive health constraints, the app should route them to a qualified professional.
