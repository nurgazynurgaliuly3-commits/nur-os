# Security Policy

## Production Guardrails

NurOS must not be exposed publicly unless `/api/ready` returns HTTP 200 and `/api/health` shows:

```json
{
  "deploy": {
    "ready": true,
    "errors": []
  }
}
```

Production requires:

- `NUROS_DEPLOY_MODE=production`
- `DATABASE_PROVIDER=supabase`
- `NUROS_DEMO_USER_ENABLED=false`
- `AUTH_EXPOSE_DEV_TOKENS=false`
- `EMAIL_PROVIDER=resend`
- HTTPS `APP_URL`

## Secrets

Never commit `.env`, Supabase service keys, Resend keys, OpenAI keys, session tokens, exports, backups, or `.data` files.

## Reporting

For private deployments, rotate any leaked key immediately and invalidate active sessions if account data may have been exposed.
