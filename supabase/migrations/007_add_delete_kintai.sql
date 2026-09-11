-- Allow a user to delete their own attendance record for a given date.
-- Run this in Supabase SQL Editor after 001-006.
--
-- Mistyped punches previously had no way out: fix_kintai can only overwrite a
-- row, so a record entered on the wrong date stayed there forever. This adds a
-- delete that follows the same security model as the other write functions —
-- anon has no direct write access to public.kintai, so the caller's identity is
-- resolved from their token first and only that person's row is removed.
--
-- Returns the number of deleted rows so the UI can tell "deleted" apart from
-- "there was nothing on that date".

create or replace function public.delete_kintai(p_token text, p_date date)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
  v_deleted integer;
begin
  select name into v_name from public.users where token = p_token;
  if v_name is null then
    raise exception 'invalid token';
  end if;

  delete from public.kintai where name = v_name and date = p_date;
  get diagnostics v_deleted = row_count;

  return v_deleted;
end;
$$;

grant execute on function public.delete_kintai(text, date) to anon;
