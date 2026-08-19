-- Allow registration pages to associate the current device with a user.
drop policy if exists "Allow anon insert user_devices"
on public.user_devices;

create policy "Allow anon insert user_devices"
on public.user_devices
for insert
to anon
with check (true);