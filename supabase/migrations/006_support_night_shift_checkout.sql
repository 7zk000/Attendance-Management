-- Support night shifts (夜勤) that cross midnight.
-- Run this in Supabase SQL Editor after 001-005.
--
-- stamp_kintai looked up the row to update strictly by current_date. A night
-- shift checks in before midnight and checks out after it, so by the time the
-- checkout stamp fires, current_date has rolled over to the next day and no
-- row exists there yet — the checkout created a brand new row (check_in null,
-- check_out set) instead of closing out the shift that was actually open.
--
-- Fix: on checkout, first look for the most recent still-open shift for that
-- person (check_in set, check_out not yet set) regardless of date, and close
-- that one out. Fall back to the current_date lookup (and insert) for the
-- normal same-day case.

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
