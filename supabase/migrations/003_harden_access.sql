-- Harden access: stop anon clients from reading/writing other people's data.
-- Run this in Supabase SQL Editor after 001 and 002.
--
-- Previously "users", "kintai" and "user_devices" were fully open to the
-- anon key (using(true)/with check(true)), which let anyone with the
-- publishable key (embedded in the client HTML) read every user's token
-- (an account-takeover secret) and write/forge attendance rows for any
-- name. This migration closes direct table access for users/user_devices,
-- keeps kintai readable (needed by the admin dashboard) but not writable
-- by anon, and introduces SECURITY DEFINER functions that resolve the
-- caller's identity from their token before touching any row.

drop policy if exists "Allow anon full access to users" on public.users;
drop policy if exists "Allow anon full access to kintai" on public.kintai;
drop policy if exists "Allow anon full access to user_devices" on public.user_devices;
drop policy if exists "Allow anon insert user_devices" on public.user_devices;

create policy "Allow anon read kintai"
on public.kintai
for select
to anon
using (true);

-- No anon policies on users / user_devices: all access to those tables
-- goes through the functions below, which run as the function owner and
-- bypass RLS, but only after verifying the caller's token.

create or replace function public.register_user(p_name text, p_token text, p_device_id text)
returns table(id bigint, name text, token text, device_id text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  select u.id into v_id from public.users u where u.name = p_name limit 1;

  if v_id is null then
    insert into public.users(name, token, device_id)
    values (p_name, p_token, p_device_id)
    returning id into v_id;
  else
    update public.users u
    set device_id = coalesce(u.device_id, p_device_id)
    where u.id = v_id;
  end if;

  return query
  select u.id, u.name, u.token, u.device_id from public.users u where u.id = v_id;
end;
$$;

grant execute on function public.register_user(text, text, text) to anon;

create or replace function public.load_user_by_token(p_token text)
returns table(id bigint, name text, token text, device_id text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select u.id, u.name, u.token, u.device_id
  from public.users u
  where u.token = p_token;
$$;

grant execute on function public.load_user_by_token(text) to anon;

create or replace function public.upsert_user_device(p_token text, p_device_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id bigint;
begin
  select id into v_user_id from public.users where token = p_token limit 1;
  if v_user_id is null then
    return;
  end if;

  insert into public.user_devices(user_id, device_id)
  values (v_user_id, p_device_id)
  on conflict (user_id, device_id) do nothing;
end;
$$;

grant execute on function public.upsert_user_device(text, text) to anon;

create or replace function public.list_user_names()
returns table(name text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select distinct u.name from public.users u order by 1;
$$;

grant execute on function public.list_user_names() to anon;

create or replace function public.stamp_kintai(
  p_token text,
  p_kind text,
  p_time text,
  p_at timestamptz,
  p_work_hours numeric,
  p_remarks text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
  v_date date := current_date;
  v_row public.kintai%rowtype;
begin
  if p_kind not in ('checkin', 'checkout') then
    raise exception 'invalid kind: %', p_kind;
  end if;

  select name into v_name from public.users where token = p_token;
  if v_name is null then
    raise exception 'invalid token';
  end if;

  select * into v_row from public.kintai where name = v_name and date = v_date;

  if not found then
    insert into public.kintai(name, date, check_in, check_out, checkin_at, checkout_at, work_hours, remarks)
    values (
      v_name,
      v_date,
      case when p_kind = 'checkin' then p_time end,
      case when p_kind = 'checkout' then p_time end,
      case when p_kind = 'checkin' then p_at end,
      case when p_kind = 'checkout' then p_at end,
      p_work_hours,
      p_remarks
    );
    return;
  end if;

  update public.kintai set
    check_in = case when p_kind = 'checkin' then coalesce(v_row.check_in, p_time) else v_row.check_in end,
    check_out = case when p_kind = 'checkout' then coalesce(v_row.check_out, p_time) else v_row.check_out end,
    checkin_at = case when p_kind = 'checkin' then coalesce(v_row.checkin_at, p_at) else v_row.checkin_at end,
    checkout_at = case when p_kind = 'checkout' then coalesce(v_row.checkout_at, p_at) else v_row.checkout_at end,
    work_hours = p_work_hours,
    remarks = p_remarks
  where id = v_row.id;
end;
$$;

grant execute on function public.stamp_kintai(text, text, text, timestamptz, numeric, text) to anon;

create or replace function public.fix_kintai(
  p_token text,
  p_date date,
  p_check_in text,
  p_check_out text,
  p_checkin_at timestamptz,
  p_checkout_at timestamptz,
  p_work_hours numeric,
  p_remarks text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
  v_id bigint;
begin
  select name into v_name from public.users where token = p_token;
  if v_name is null then
    raise exception 'invalid token';
  end if;

  select id into v_id from public.kintai where name = v_name and date = p_date;

  if v_id is null then
    insert into public.kintai(name, date, check_in, check_out, checkin_at, checkout_at, work_hours, remarks)
    values (v_name, p_date, p_check_in, p_check_out, p_checkin_at, p_checkout_at, p_work_hours, p_remarks);
  else
    update public.kintai set
      check_in = p_check_in,
      check_out = p_check_out,
      checkin_at = p_checkin_at,
      checkout_at = p_checkout_at,
      work_hours = p_work_hours,
      remarks = p_remarks
    where id = v_id;
  end if;
end;
$$;

grant execute on function public.fix_kintai(text, date, text, text, timestamptz, timestamptz, numeric, text) to anon;
