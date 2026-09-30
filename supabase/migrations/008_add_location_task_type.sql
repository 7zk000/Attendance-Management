-- Add optional work location (【多摩】/【自宅】) and task type
-- (作業 / ドキュメント整理・手順作成など) fields, captured alongside check-in/check-out.
-- Run this in Supabase SQL Editor after 001-007.

alter table public.kintai add column if not exists location text;
alter table public.kintai add column if not exists task_type text;

-- Parameter lists changed, so the old overloads must be dropped explicitly —
-- create or replace only replaces a function with an identical signature.
drop function if exists public.stamp_kintai(text, text, text, timestamptz, numeric, text);
drop function if exists public.fix_kintai(text, date, text, text, timestamptz, timestamptz, numeric, text);

create or replace function public.stamp_kintai(
  p_token text,
  p_kind text,
  p_time text,
  p_at timestamptz,
  p_work_hours numeric,
  p_remarks text,
  p_location text,
  p_task_type text
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
  v_found boolean := false;
begin
  if p_kind not in ('checkin', 'checkout') then
    raise exception 'invalid kind: %', p_kind;
  end if;

  select name into v_name from public.users where token = p_token;
  if v_name is null then
    raise exception 'invalid token';
  end if;

  if p_kind = 'checkout' then
    select * into v_row from public.kintai
    where name = v_name and check_in is not null and check_out is null
    order by date desc
    limit 1;
    v_found := found;
  end if;

  if not v_found then
    select * into v_row from public.kintai where name = v_name and date = v_date;
    v_found := found;
  end if;

  if not v_found then
    insert into public.kintai(name, date, check_in, check_out, checkin_at, checkout_at, work_hours, remarks, location, task_type)
    values (
      v_name,
      v_date,
      case when p_kind = 'checkin' then p_time end,
      case when p_kind = 'checkout' then p_time end,
      case when p_kind = 'checkin' then p_at end,
      case when p_kind = 'checkout' then p_at end,
      p_work_hours,
      p_remarks,
      p_location,
      p_task_type
    );
    return;
  end if;

  update public.kintai set
    check_in = case when p_kind = 'checkin' then coalesce(v_row.check_in, p_time) else v_row.check_in end,
    check_out = case when p_kind = 'checkout' then coalesce(v_row.check_out, p_time) else v_row.check_out end,
    checkin_at = case when p_kind = 'checkin' then coalesce(v_row.checkin_at, p_at) else v_row.checkin_at end,
    checkout_at = case when p_kind = 'checkout' then coalesce(v_row.checkout_at, p_at) else v_row.checkout_at end,
    work_hours = p_work_hours,
    remarks = p_remarks,
    location = p_location,
    task_type = p_task_type
  where id = v_row.id;
end;
$$;

grant execute on function public.stamp_kintai(text, text, text, timestamptz, numeric, text, text, text) to anon;

create or replace function public.fix_kintai(
  p_token text,
  p_date date,
  p_check_in text,
  p_check_out text,
  p_checkin_at timestamptz,
  p_checkout_at timestamptz,
  p_work_hours numeric,
  p_remarks text,
  p_location text,
  p_task_type text
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
    insert into public.kintai(name, date, check_in, check_out, checkin_at, checkout_at, work_hours, remarks, location, task_type)
    values (v_name, p_date, p_check_in, p_check_out, p_checkin_at, p_checkout_at, p_work_hours, p_remarks, p_location, p_task_type);
  else
    update public.kintai set
      check_in = p_check_in,
      check_out = p_check_out,
      checkin_at = p_checkin_at,
      checkout_at = p_checkout_at,
      work_hours = p_work_hours,
      remarks = p_remarks,
      location = p_location,
      task_type = p_task_type
    where id = v_id;
  end if;
end;
$$;

grant execute on function public.fix_kintai(text, date, text, text, timestamptz, timestamptz, numeric, text, text, text) to anon;
