-- Production-ready reservation schema for Supabase
-- Run this in the Supabase SQL Editor.

create extension if not exists pg_cron with schema extensions;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  booking_date date not null,
  booking_time time not null,
  service text not null,
  message text not null,
  status text not null default 'pending',
  hold_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  constraint bookings_status_chk check (status in ('pending', 'held', 'confirmed', 'cancelled'))
);

create table if not exists public.pending_holds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  slot_date date not null,
  slot_time time not null,
  held_by uuid,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  status text not null default 'active',
  constraint pending_holds_status_chk check (status in ('active', 'expired', 'confirmed', 'cancelled'))
);

create index if not exists idx_bookings_slot on public.bookings(booking_date, booking_time, status);
create index if not exists idx_pending_holds_slot on public.pending_holds(slot_date, slot_time, status, expires_at);
create unique index if not exists idx_bookings_active_slot
  on public.bookings(booking_date, booking_time)
  where status in ('held', 'confirmed');
create unique index if not exists idx_pending_holds_active_slot
  on public.pending_holds(slot_date, slot_time)
  where status = 'active';

alter table public.bookings enable row level security;
alter table public.pending_holds enable row level security;

create or replace function public.set_booking_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_booking_user_id on public.bookings;
create trigger trg_set_booking_user_id
before insert on public.bookings
for each row
execute function public.set_booking_user_id();

create or replace function public.create_booking_hold(
  p_name text,
  p_email text,
  p_phone text,
  p_booking_date date,
  p_booking_time time,
  p_service text,
  p_message text,
  p_hold_minutes integer default 10
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id uuid;
  v_hold_id uuid;
  v_now timestamptz := now();
  v_expires_at timestamptz := v_now + (p_hold_minutes || ' minutes')::interval;
  v_existing_hold_count int;
begin
  if p_hold_minutes is null or p_hold_minutes <= 0 then
    raise exception 'p_hold_minutes must be greater than 0';
  end if;

  perform 1
  from public.bookings b
  where b.booking_date = p_booking_date
    and b.booking_time = p_booking_time
    and b.status in ('confirmed', 'held')
  for update;

  if found then
    return json_build_object('success', false, 'error', 'This slot is already booked or temporarily held.');
  end if;

  select count(*) into v_existing_hold_count
  from public.pending_holds ph
  where ph.slot_date = p_booking_date
    and ph.slot_time = p_booking_time
    and ph.status = 'active'
    and ph.expires_at > v_now
  for update;

  if v_existing_hold_count > 0 then
    return json_build_object('success', false, 'error', 'This slot is already temporarily held by another customer.');
  end if;

  begin
    insert into public.bookings (
    customer_name,
    customer_email,
    customer_phone,
    booking_date,
    booking_time,
    service,
    message,
    status,
    created_at,
    updated_at
  ) values (
    p_name,
    p_email,
    p_phone,
    p_booking_date,
    p_booking_time,
    p_service,
    p_message,
    'held',
    v_now,
    v_now
  ) returning id into v_booking_id;

    insert into public.pending_holds (
      booking_id,
      slot_date,
      slot_time,
      held_by,
      expires_at,
      status,
      created_at
    ) values (
      v_booking_id,
      p_booking_date,
      p_booking_time,
      auth.uid(),
      v_expires_at,
      'active',
      v_now
    ) returning id into v_hold_id;

    update public.bookings
    set hold_id = v_hold_id,
        updated_at = v_now
    where id = v_booking_id;

    return json_build_object(
      'success', true,
      'booking_id', v_booking_id,
      'hold_id', v_hold_id,
      'expires_at', v_expires_at,
      'status', 'held'
    );
  exception when unique_violation then
    return json_build_object('success', false, 'error', 'This slot is already booked or temporarily held.');
  end;
end;
$$;

create or replace function public.confirm_hold_after_payment(
  p_hold_id uuid,
  p_payment_status text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold public.pending_holds%rowtype;
  v_booking public.bookings%rowtype;
begin
  if p_payment_status is null or p_payment_status <> 'succeeded' then
    return json_build_object('success', false, 'error', 'Payment was not successful.');
  end if;

  select * into strict v_hold
  from public.pending_holds
  where id = p_hold_id
  for update;

  if not found then
    return json_build_object('success', false, 'error', 'Hold not found.');
  end if;

  if v_hold.status <> 'active' then
    return json_build_object('success', false, 'error', 'Hold is no longer active.');
  end if;

  if v_hold.expires_at <= now() then
    update public.pending_holds
    set status = 'expired', updated_at = now()
    where id = v_hold.id;

    return json_build_object('success', false, 'error', 'Hold has expired.');
  end if;

  select * into strict v_booking
  from public.bookings
  where id = v_hold.booking_id
  for update;

  update public.pending_holds
  set status = 'confirmed', updated_at = now()
  where id = v_hold.id;

  update public.bookings
  set status = 'confirmed',
      confirmed_at = now(),
      updated_at = now()
  where id = v_booking.id;

  return json_build_object('success', true, 'booking_id', v_booking.id, 'status', 'confirmed');
end;
$$;

create or replace function public.expire_stale_holds()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pending_holds
  set status = 'expired'
  where status = 'active'
    and expires_at <= now();

  update public.bookings b
  set status = 'cancelled', updated_at = now()
  where b.status = 'held'
    and exists (
      select 1
      from public.pending_holds ph
      where ph.booking_id = b.id
        and ph.status = 'expired'
    );
end;
$$;

-- Optional: pg_cron job (enable in Supabase project first)
-- select cron.schedule(
--   'expire-stale-holds-every-minute',
--   '* * * * *',
--   $$ select public.expire_stale_holds(); $$
-- );

-- Optional: RLS policies for anon/authenticated access
create policy if not exists "Allow anonymous insert on bookings"
  on public.bookings for insert
  to anon
  with check (true);

create policy if not exists "Allow authenticated insert on bookings"
  on public.bookings for insert
  to authenticated
  with check (true);

create policy if not exists "Allow authenticated read own bookings"
  on public.bookings for select
  to authenticated
  using (user_id = auth.uid());

create policy if not exists "Allow anonymous insert on pending_holds"
  on public.pending_holds for insert
  to anon
  with check (true);

create policy if not exists "Allow authenticated read own holds"
  on public.pending_holds for select
  to authenticated
  using (held_by = auth.uid());
