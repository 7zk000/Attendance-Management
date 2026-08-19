-- Fix "column reference \"id\" is ambiguous" (SQLSTATE 42702) in register_user.
-- Because the function is declared as `returns table(id bigint, name text, token
-- text, device_id text)`, those column names are also visible as PL/pgSQL
-- variables inside the function body. The unqualified `returning id into v_id`
-- in the insert branch (new-user registration) was ambiguous between the table
-- column and that implicit out-parameter, so every first-time registration
-- failed. Qualifying the insert target and the returned column fixes it.
-- Run this in Supabase SQL Editor after 001-004.

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
    insert into public.users as u (name, token, device_id)
    values (p_name, p_token, p_device_id)
    returning u.id into v_id;
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
