-- Fix schema drift: 001's "create table if not exists" silently skipped adding
-- is_admin when public.users already existed without that column, so the
-- "create index ... on public.users (is_admin)" statement in 001 has been
-- failing on every fresh/preview database ever since. This migration is
-- additive and safe to run even if is_admin already exists.
-- Run this in Supabase SQL Editor after 001-003.

alter table public.users
  add column if not exists is_admin boolean not null default false;

create index if not exists idx_users_is_admin
  on public.users (is_admin);
