# NurOS Production Checklist

## Required

1. Set `NUROS_DEPLOY_MODE=production`.
2. Set `DATABASE_PROVIDER=supabase`.
3. Run `supabase-schema.sql` in Supabase.
4. Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
5. Set `AUTH_EXPOSE_DEV_TOKENS=false`.
6. Set `NUROS_DEMO_USER_ENABLED=false`.
7. Configure `EMAIL_PROVIDER=resend`, `EMAIL_FROM` and `RESEND_API_KEY`.
8. Set `APP_URL` to the public HTTPS URL.
9. Set `OPENAI_API_KEY` if hosted AI responses should use a real model.
10. Run `npm run prepush:report` or `.\pre-push-report.cmd`.
11. Run `npm run validate:env` or `.\validate-env.cmd`.
12. Run `npm run migrate:supabase` or `.\migrate-supabase.cmd` if local JSON data should be moved.
13. Run `npm test` or `.\run-tests.cmd` on this Windows workspace.
14. Run `npm run test:api:supabase` or `.\run-supabase-tests.cmd`.
15. Run `.\check-health.cmd <public-or-local-health-url>`.

## Verify

Open `/api/health` and confirm:

```json
{
  "deploy": {
    "ready": true,
    "errors": []
  }
}
```

Open `/api/ready` and confirm it returns HTTP 200.
Open `/api/live` and confirm it returns HTTP 200.

## Do Not Ship If

- `deploy.errors` is not empty.
- `AUTH_EXPOSE_DEV_TOKENS` is true.
- `NUROS_DEMO_USER_ENABLED` is true.
- `EMAIL_PROVIDER` is `log`.
- `DATABASE_PROVIDER` is `json`.
- The app is served without HTTPS.
