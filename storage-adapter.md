# NurOS Storage Adapter Contract

Current provider: `json`.

Future provider: `supabase`.

The server depends on these operations rather than direct file/database access:

```ts
type StorageAdapter = {
  init(): Promise<void>;
  health(): Promise<{ provider: string; users: number; sessions: number }>;
  readDb(): Promise<Db>;
  writeDb(db: Db): Promise<void>;
  backup(reason: string): Promise<string | null>;
  audit(event: AuditEvent): Promise<void>;
};
```

## JSON Adapter

Implemented today in `lib/storage.js` using:

- `.data/nuros-db.json`
- atomic temp-file write
- `.data/backups`
- `.data/audit.log`

## Supabase Adapter

`DATABASE_PROVIDER=supabase` loads `lib/storage-supabase.js`. It uses Supabase REST with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, so it should only run on a trusted server environment.

Target mapping:

- `users` -> `nuros_profiles`
- `sessions` -> `nuros_sessions`
- `states` -> `nuros_states.state`
- AI logs -> `nuros_ai_events`
- reminder delivery logs -> `nuros_reminder_events`
- audit logs -> `nuros_audit_events`

## Migration Steps

1. Export JSON database from Account screen.
2. Create Supabase schema with `supabase-schema.sql`.
3. Import users and states.
4. Switch `DATABASE_PROVIDER=supabase`.
5. Run `node tests/api-smoke.js`.
