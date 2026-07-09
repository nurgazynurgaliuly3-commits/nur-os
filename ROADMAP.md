# NurOS Full Product Roadmap

Бұл құжат NurOS-ты MVP деңгейінен толыққанды жеке AI Operating System деңгейіне жеткізу қадамдарын сипаттайды.

## 1. Өнім өзегі

1. Негізгі қолданушы сценарийін бекіту:
   - қолданушы күніне 5 минут кіреді;
   - Dashboard бүгінгі ең маңызды шешімдерді көрсетеді;
   - әр модуль дерек жинайды;
   - AI Core барлық деректі біріктіріп ұсыныс береді.
2. MVP модульдерін тұрақтандыру:
   - Dashboard;
   - Қаржы;
   - Ритуалдар;
   - Фитнес;
   - AI Chat.
3. Әр модульде input -> analysis -> recommendation логикасын міндетті ету.

## 2. Авторизация

1. Email/password login қосу.
2. Google/Apple login қосу.
3. User profile кестесін жасау.
4. Session refresh және logout flow қосу.
5. Әр қолданушы өз дерегін ғана көретін Row Level Security енгізу.

Ұсынылатын backend: Supabase немесе Firebase. Кейін масштаб керек болса Next.js + PostgreSQL + Prisma.

## 3. Деректер базасы

Кемінде мына кестелер керек:

1. `users`
   - name, age, height, gender, activity level.
2. `finance_profiles`
   - salary, monthly budget, mandatory payments, savings goal.
3. `transactions`
   - type, amount, category, date, note.
4. `rituals`
   - title, target, schedule, streak, status.
5. `ritual_logs`
   - ritual id, date, completed.
6. `fitness_profiles`
   - weight, target weight, goal, experience, injuries, sleep, water.
7. `workout_plans`
   - day, muscle group, exercises, sets, reps.
8. `nutrition_plans`
   - calories, protein, carbs, fat, budget level.
9. `supplement_reminders`
   - supplement name, time, note.
10. `ai_insights`
   - source modules, insight text, priority, status.
11. `chat_messages`
   - role, text, context snapshot, timestamp.

## 4. AI Core

1. Барлық модульден normalized context жинау.
2. Rule-based layer жасау:
   - бос қаражат төмен болса, тамақ жоспарын арзандату;
   - екі жаттығу өтпесе, жеңіл workout ұсыну;
   - ритуал жиі орындалмаса, келесі күнге қысқа нұсқа беру.
3. LLM layer қосу:
   - қолданушы сұрағына жауап беру;
   - апталық summary жасау;
   - proactive insight шығару.
4. Safety layer енгізу:
   - медициналық диагноз қоймау;
   - дәрі ұсынбау;
   - жарақат/ауру болса маманға бағыттау.
5. AI response-тарын дерекқорға сақтау.

## 5. Фитнес модулі

1. Personal Fitness Intake толықтыру:
   - бой, жас, салмақ, мақсат;
   - тәжірибе, зал күні;
   - жарақат, ұйқы, су;
   - қоспалар, БАД, тамақ шектеуі.
2. Калория есептеу:
   - BMR;
   - maintenance calories;
   - gain/lose/maintain target.
3. Macro split:
   - protein;
   - carbs;
   - fats.
4. Workout generator:
   - 3 күн: full body немесе push/pull/legs;
   - 4 күн: upper/lower немесе split;
   - beginner/intermediate/advanced айырмасы.
5. Nutrition generator:
   - қаржы модуліндегі food budget бойынша рацион;
   - cheap/standard/premium режим.
6. Progress tracking:
   - weekly weight;
   - workout completion;
   - water;
   - calories.

## 6. Қаржы модулі

1. Категориялар қосу:
   - үй;
   - тамақ;
   - көлік;
   - фитнес;
   - білім;
   - ойын-сауық;
   - жинақ.
2. Айлық analytics:
   - planned vs actual;
   - overspending;
   - free cash;
   - savings ratio.
3. Fitness integration:
   - food budget;
   - supplement budget;
   - gym budget.
4. AI ұсыныстар:
   - артық шығын;
   - үнемдеу;
   - жинақ мақсатына жету мерзімі.

## 7. Ритуалдар модулі

1. Habit creation flow.
2. Calendar view.
3. Daily check-in.
4. Streak calculation.
5. Missed habit analysis.
6. AI next-day plan:
   - ең әлсіз ритуал;
   - ең оңай minimum version;
   - нақты уақыт slot.

## 8. Dashboard

1. One-screen daily operating panel.
2. AI advice priority:
   - urgent;
   - important;
   - optional.
3. Today cards:
   - finance status;
   - rituals;
   - workout;
   - reminders;
   - progress.
4. 5-minute daily review flow:
   - done;
   - skipped;
   - tomorrow suggestion.

## 9. PWA және UX

1. Installable PWA.
2. Offline shell.
3. Push notifications.
4. Mobile bottom navigation.
5. Fast loading.
6. Dark mode persistence.
7. Empty states.
8. Loading states.
9. Error states.

## 10. Security және privacy

1. HTTPS.
2. Encrypted database.
3. Row Level Security.
4. API rate limits.
5. Sensitive health/finance data policy.
6. User data export.
7. Account deletion.

## 11. Production deployment

1. Frontend:
   - Vercel немесе Netlify.
2. Backend:
   - Supabase/Firebase немесе Railway/Fly.io.
3. Database:
   - PostgreSQL.
4. Monitoring:
   - Sentry;
   - analytics;
   - uptime checks.
5. Backups:
   - daily database backup.

## Current Build Status

Осы репозиторийде енді static MVP емес, local full-stack prototype бар:

1. Node.js backend.
2. Register/login/logout.
3. Bearer token session.
4. JSON database.
5. State sync API.
6. AI chat API.
7. Fitness intake және жоспар генераторы.
8. Finance, rituals, dashboard және chat модульдері.
9. Health check, data export, manual backup және account deletion.
10. API smoke test.
11. OpenAI-compatible AI provider adapter және local fallback.
12. Reminder API және notification permission foundation.
13. Due reminder worker endpoint және manual tick.
14. Supabase schema draft, deployment guide және storage adapter contract.

## 12. Келесі нақты sprint

1. Қазіргі static app-ты React немесе Next.js-ке көшіру.
2. Supabase auth/database қосу.
3. Finance, rituals, fitness CRUD жасау.
4. AI Core endpoint жасау.
5. Real AI Chat қосу.
6. PWA notification қосу.
7. Mobile QA және production deploy.
## 13. Completed Sprint Notes

1. Server storage access is now adapter-based instead of hard-coded into `server.js`.
2. `lib/storage.js` implements the JSON provider and `lib/storage-supabase.js` implements the Supabase REST provider.
3. `/api/health` exposes the active storage provider.
4. API smoke test validates JSON storage and the main user journey.
5. Package version bumped to `0.6.0`.

## 14. Next Production Step

1. Run the existing API smoke test against both JSON and Supabase providers.
2. Add provider-specific backup/export controls for hosted PostgreSQL.
3. Move from custom password auth to Supabase Auth or OAuth.
4. Add production rate limiting and audit logging.

## 15. Migration Tooling

1. `scripts/migrate-json-to-supabase.js` migrates `.data/nuros-db.json` to the Supabase REST provider.
2. `npm run migrate:supabase` is available after `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured.
3. `npm run test:api:supabase` reuses the API smoke test against the hosted provider.
4. The migration script is syntax-checked, but live Supabase migration requires real project credentials.

## 16. Security Foundation

1. API rate limiting is active for all `/api/*` routes.
2. Auth endpoints have a stricter rate limit.
3. Audit events are recorded for registration, login, logout, state updates, reminders, export, backup, AI chat and account deletion.
4. Local JSON audit trail writes to `.data/audit.log`.
5. Supabase audit trail writes to `nuros_audit_events`.

## 17. Next Production Step

1. Replace custom password sessions with Supabase Auth or OAuth.
2. Add password reset and email verification.
3. Add row-level security policies aligned with the final auth identity.

## 18. Auth Hardening

1. Bearer sessions now expire after `SESSION_TTL_DAYS`.
2. Expired sessions are pruned automatically during API requests.
3. `/api/health` exposes session TTL and pruned session count.
4. Package version bumped to `0.8.0`.

## 19. Account Recovery Foundation

1. Email verification request and confirmation endpoints are implemented.
2. Password reset request and confirmation endpoints are implemented.
3. Dev token exposure can be disabled with `AUTH_EXPOSE_DEV_TOKENS=false`.
4. The Account screen can request and confirm email verification tokens.
5. The auth screen includes a password reset mode.

## 20. Email Delivery Foundation

1. `lib/mailer.js` provides an email adapter boundary.
2. The default `EMAIL_PROVIDER=log` writes auth messages to `.data/email-outbox.log`.
3. Registration, verification request and password reset request all send token email events.
4. `/api/health` exposes the active email provider.

## 21. Hosted Email Provider

1. `EMAIL_PROVIDER=resend` sends auth emails through the Resend HTTP API.
2. Auth emails include token, action URL, text and HTML bodies.
3. `APP_URL`, `EMAIL_FROM` and `RESEND_API_KEY` configure hosted delivery.
4. Log mode remains the default local provider for development.

## 22. Production Diagnostics

1. `/api/health` exposes feature readiness for AI, storage, email, dev tokens, Supabase and PWA.
2. API smoke tests validate the diagnostics contract.

## 23. Deploy Readiness

1. `lib/config.js` evaluates local vs production deployment mode.
2. `/api/health` returns `deploy.ready`, warnings and blocking errors.
3. Production mode requires hosted storage, real email and hidden dev tokens.

## 24. Hosting Artifacts

1. `render.yaml` defines a Render web service blueprint.
2. `PRODUCTION_CHECKLIST.md` documents launch blockers and verification steps.

## 25. QA Test Suite

1. `tests/config-report.js` validates deploy readiness rules.
2. `tests/static-smoke.js` validates HTML, CSS, app JS, manifest and service worker assets.
3. `npm test` runs config, static and API smoke tests.
4. `run-tests.cmd` runs the same suite without requiring `npm` on PATH.

## 26. Mobile Visual QA

1. Browser QA verified desktop login, desktop app shell, mobile auth and mobile logged-in shell.
2. Mobile auth primary button remains visible.
3. Mobile topbar keeps logout and theme actions visible.
4. Mobile dashboard hides only the optional welcome action, not every primary action.

## 27. Accessibility Polish

1. Navigation buttons now expose accessible labels.
2. Topbar icon buttons expose accessible labels.
3. Floating AI command input and submit button expose accessible labels.
4. Static smoke tests guard these accessibility contracts.

## 28. In-App Diagnostics

1. Account screen displays storage provider, email provider and deploy readiness.
2. Account screen can refresh `/api/health` diagnostics without leaving the app.
3. Static smoke tests guard the diagnostics UI contract.

## 29. Browser Security Headers

1. API and static responses include `X-Content-Type-Options`.
2. Responses include `Referrer-Policy`.
3. Responses include `Permissions-Policy`.
4. Responses include a CSP compatible with current inline handlers, local assets, Google Fonts, OpenAI and Resend.
5. Static smoke tests verify security headers.

## 30. Data Portability

1. `/api/import` restores a NurOS export or plain state object into the current account.
2. Import creates a backup before replacing account state.
3. Imported state is sanitized through the same server-side rules as normal state updates.
4. Account screen includes an Import JSON control.
5. API and static smoke tests cover the import flow.
6. Import has frontend and backend payload size guards.

## 31. Activity Timeline

1. Storage adapters can read recent audit activity.
2. `/api/activity` returns recent account audit events.
3. Account screen shows a Recent activity timeline.
4. API and static smoke tests cover the activity flow.

## 32. Reminder Delivery Log

1. Reminder delivery keys are generated per user, day, time and reminder text.
2. JSON storage records delivered reminder keys in `.data/reminder-deliveries.json`.
3. Supabase storage records delivered reminders in `nuros_reminder_events`.
4. `/api/tick` is idempotent for the same reminder delivery key.
5. API smoke tests verify repeated ticks do not duplicate reminders.

## 33. Push Readiness Helpers

1. `migrate-supabase.cmd` runs JSON to Supabase migration without requiring `npm`.
2. `run-supabase-tests.cmd` runs hosted-provider API smoke tests without requiring `npm`.
3. `check-health.cmd` verifies `/api/health` deploy readiness.

## 34. Env Validation

1. `scripts/validate-env.js` validates development and production `.env` readiness.
2. `validate-env.cmd` runs env validation without requiring `npm`.
3. QA tests cover valid development, invalid production and valid production env profiles.

## 35. Pre-Push Report

1. `scripts/pre-push-report.js` checks required files, git ignore safety and checklist coverage.
2. `pre-push-report.cmd` runs the report without requiring `npm`.
3. `.env` is explicitly ignored before push.
