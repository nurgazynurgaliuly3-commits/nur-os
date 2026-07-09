-- NurOS hosted database schema draft for Supabase/PostgreSQL.
-- This mirrors the current local JSON database while keeping room for normalized modules.

create extension if not exists "pgcrypto";

create table if not exists public.nuros_profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  display_name text not null default 'User',
  password_hash text not null,
  email_verified boolean not null default false,
  verification_token_hash text,
  verification_expires_at timestamptz,
  reset_token_hash text,
  reset_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nuros_sessions (
  token text primary key,
  user_id uuid not null references public.nuros_profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.nuros_states (
  user_id uuid primary key references public.nuros_profiles(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.nuros_ai_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.nuros_profiles(id) on delete cascade,
  provider text not null,
  model text,
  prompt text,
  answer text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.nuros_reminder_events (
  id uuid primary key default gen_random_uuid(),
  delivery_key text unique not null,
  user_id uuid not null references public.nuros_profiles(id) on delete cascade,
  reminder text not null,
  due_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.nuros_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.nuros_profiles(id) on delete set null,
  action text not null,
  route text not null,
  method text not null,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.nuros_profiles enable row level security;
alter table public.nuros_sessions enable row level security;
alter table public.nuros_states enable row level security;
alter table public.nuros_ai_events enable row level security;
alter table public.nuros_reminder_events enable row level security;
alter table public.nuros_audit_events enable row level security;

-- RLS policies depend on the final Supabase Auth integration.
-- For production, map auth.uid() to nuros_profiles.id or store Supabase auth user id.
