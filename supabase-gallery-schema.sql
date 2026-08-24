create extension if not exists pgcrypto;

create table if not exists public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  title text,
  category text not null,
  image_url text not null,
  storage_path text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.gallery_images enable row level security;

create index if not exists idx_gallery_images_active
  on public.gallery_images (is_active, sort_order, category);


-- Public read policy
drop policy if exists "Gallery images public read"
on public.gallery_images;

create policy "Gallery images public read"
on public.gallery_images
for select
using (true);


-- Authenticated users full access
drop policy if exists "Gallery images authenticated full access"
on public.gallery_images;

create policy "Gallery images authenticated full access"
on public.gallery_images
for all
to authenticated
using (true)
with check (true);