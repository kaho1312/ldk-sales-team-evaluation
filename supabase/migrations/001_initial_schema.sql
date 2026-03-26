-- ─────────────────────────────────────────────────────────────────────────────
-- LDK Sales Certification — Supabase Schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query)
-- ─────────────────────────────────────────────────────────────────────────────

-- Extension
create extension if not exists "uuid-ossp";

-- ── users ────────────────────────────────────────────────────────────────────
-- Mirrors auth.users; created automatically by trigger on signup
create table if not exists public.users (
  id         uuid references auth.users(id) on delete cascade primary key,
  email      text not null unique,
  full_name  text not null,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now(),
  last_login timestamptz
);

-- ── quiz_configs ──────────────────────────────────────────────────────────────
create table if not exists public.quiz_configs (
  id                    uuid primary key default uuid_generate_v4(),
  certification_tier    text not null check (certification_tier in ('junior','mid-level','senior')),
  total_questions       integer not null default 0,
  section_count         integer not null default 3,
  passing_threshold     numeric not null default 0.90,
  questions_source_url  text,
  is_active             boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique(certification_tier)
);

-- ── quiz_attempts ─────────────────────────────────────────────────────────────
create table if not exists public.quiz_attempts (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid references public.users(id) on delete cascade not null,
  certification_tier text not null check (certification_tier in ('junior','mid-level','senior')),
  attempt_number     integer not null default 1,
  started_at         timestamptz not null default now(),
  completed_at       timestamptz,
  status             text not null default 'in_progress'
                       check (status in ('in_progress','passed','failed')),
  total_correct      integer,
  total_questions    integer,
  section_errors     jsonb,   -- { "A": 2, "B": 0, "C": 1 }
  score_percent      numeric
);

-- ── answers ───────────────────────────────────────────────────────────────────
-- final_grade = admin_override if not null, else ai_grade
create table if not exists public.answers (
  id             uuid primary key default uuid_generate_v4(),
  attempt_id     uuid references public.quiz_attempts(id) on delete cascade not null,
  question_id    text not null,
  section        text not null check (section in ('A','B','C','All')),
  user_answer    text not null,
  ai_grade       boolean,
  ai_reasoning   text,
  admin_override boolean,      -- null = no override
  final_grade    boolean generated always as (coalesce(admin_override, ai_grade)) stored,
  created_at     timestamptz not null default now(),
  unique(attempt_id, question_id)
);

-- ── certifications ────────────────────────────────────────────────────────────
create table if not exists public.certifications (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid references public.users(id) on delete cascade not null,
  certification_tier text not null check (certification_tier in ('junior','mid-level','senior')),
  attempt_id         uuid references public.quiz_attempts(id),
  granted_at         timestamptz not null default now(),
  granted_by         text not null default 'system',   -- 'system' or admin email
  unique(user_id, certification_tier)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Default quiz configs (Junior active, others placeholder)
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.quiz_configs (certification_tier, total_questions, section_count, passing_threshold, is_active)
values
  ('junior',    55, 3, 0.90, true),
  ('mid-level',  0, 3, 0.90, false),
  ('senior',     0, 3, 0.90, false)
on conflict (certification_tier) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: auto-create users row on auth signup
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper: is caller an admin?
create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select coalesce(
    (select is_admin from public.users where id = auth.uid()),
    false
  );
$$;

-- users
alter table public.users enable row level security;

create policy "users_select_own"
  on public.users for select
  using (auth.uid() = id or public.is_admin());

create policy "users_insert_trigger"
  on public.users for insert
  with check (auth.uid() = id or public.is_admin());

create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id);

create policy "admins_update_any_user"
  on public.users for update
  using (public.is_admin());

-- quiz_configs (everyone reads, admin writes)
alter table public.quiz_configs enable row level security;

create policy "configs_read_all"
  on public.quiz_configs for select
  using (true);

create policy "configs_admin_write"
  on public.quiz_configs for all
  using (public.is_admin());

-- quiz_attempts
alter table public.quiz_attempts enable row level security;

create policy "attempts_select"
  on public.quiz_attempts for select
  using (user_id = auth.uid() or public.is_admin());

create policy "attempts_insert"
  on public.quiz_attempts for insert
  with check (user_id = auth.uid());

create policy "attempts_update"
  on public.quiz_attempts for update
  using (user_id = auth.uid() or public.is_admin());

-- answers
alter table public.answers enable row level security;

create policy "answers_select"
  on public.answers for select
  using (
    exists (
      select 1 from public.quiz_attempts
      where id = attempt_id and (user_id = auth.uid() or public.is_admin())
    )
  );

create policy "answers_insert"
  on public.answers for insert
  with check (
    exists (
      select 1 from public.quiz_attempts
      where id = attempt_id and user_id = auth.uid()
    )
  );

create policy "answers_update_admin"
  on public.answers for update
  using (public.is_admin());

-- certifications
alter table public.certifications enable row level security;

create policy "certs_select"
  on public.certifications for select
  using (user_id = auth.uid() or public.is_admin());

create policy "certs_admin_all"
  on public.certifications for all
  using (public.is_admin());

create policy "certs_system_insert"
  on public.certifications for insert
  with check (user_id = auth.uid() or public.is_admin());
