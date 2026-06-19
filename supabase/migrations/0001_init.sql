-- =========================================================
-- Social Media Analytics Dashboard — Initial Schema
-- Run this once in the Supabase SQL editor.
-- =========================================================

create extension if not exists "pgcrypto";   -- for bcrypt hashing of the PIN
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------
-- ENUM: supported platforms (add more here as you extend)
-- ---------------------------------------------------------
do $$ begin
  create type platform_type as enum ('youtube', 'tiktok', 'instagram', 'twitter');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------
-- TABLE: admin_settings  (single-row table holding the PIN hash)
-- ---------------------------------------------------------
create table if not exists admin_settings (
  id            int primary key default 1 check (id = 1), -- enforce single row
  pin_hash      text not null,
  updated_at    timestamptz not null default now()
);

-- helper to set/update the PIN (call manually once, then via Admin Panel)
create or replace function set_admin_pin(new_pin text)
returns void
language plpgsql
security definer
as $$
begin
  if new_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;

  insert into admin_settings (id, pin_hash, updated_at)
  values (1, crypt(new_pin, gen_salt('bf')), now())
  on conflict (id) do update
    set pin_hash = excluded.pin_hash, updated_at = now();
end;
$$;

-- verifies a PIN attempt; returns true/false. Used by the login RPC.
create or replace function verify_admin_pin(attempt text)
returns boolean
language sql
security definer
as $$
  select coalesce(
    (select pin_hash = crypt(attempt, pin_hash) from admin_settings where id = 1),
    false
  );
$$;

-- ---------------------------------------------------------
-- TABLE: channel_groups  (one row per organization/brand)
-- ---------------------------------------------------------
create table if not exists channel_groups (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  description   text,
  logo_url      text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------
-- TABLE: platform_profiles  (one row per platform per group)
-- ---------------------------------------------------------
create table if not exists platform_profiles (
  id              uuid primary key default uuid_generate_v4(),
  group_id        uuid not null references channel_groups(id) on delete cascade,
  platform        platform_type not null,
  profile_url     text not null,
  handle          text,                 -- derived display handle, e.g. "@acme"
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (group_id, platform)           -- one profile per platform per group
);

-- ---------------------------------------------------------
-- TABLE: cached_posts  (the analytics cache — frontend reads ONLY this)
-- ---------------------------------------------------------
create table if not exists cached_posts (
  id              uuid primary key default uuid_generate_v4(),
  profile_id      uuid not null references platform_profiles(id) on delete cascade,
  platform        platform_type not null,
  external_id     text not null,        -- platform's native post/video id
  title           text,                 -- title or caption
  permalink       text not null,        -- link back to the original post
  thumbnail_url   text,
  published_at    timestamptz not null,
  view_count      bigint default 0,
  like_count      bigint default 0,
  comment_count   bigint default 0,
  fetched_at      timestamptz not null default now(),
  unique (platform, external_id)
);

create index if not exists idx_cached_posts_profile on cached_posts(profile_id);
create index if not exists idx_cached_posts_published on cached_posts(published_at desc);

-- ---------------------------------------------------------
-- TABLE: fetch_logs  (per-profile fetch status, for error UI states)
-- ---------------------------------------------------------
create table if not exists fetch_logs (
  profile_id      uuid primary key references platform_profiles(id) on delete cascade,
  status          text not null default 'pending', -- 'ok' | 'error' | 'unavailable' | 'pending'
  message         text,
  last_attempt_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Housekeeping: purge cached posts older than 7 days
-- (also re-run by the Edge Function after every fetch)
-- ---------------------------------------------------------
create or replace function purge_old_posts()
returns void
language sql
as $$
  delete from cached_posts where published_at < now() - interval '7 days';
$$;

-- ---------------------------------------------------------
-- Admin RPCs (mutations) — all security definer, all PIN-gated
-- by the frontend already holding a verified session; for an
-- extra server-side layer they re-check the PIN passed in.
-- ---------------------------------------------------------
create or replace function admin_upsert_group(
  p_pin text, p_id uuid, p_name text, p_description text, p_sort_order int
) returns uuid
language plpgsql security definer as $$
declare new_id uuid;
begin
  if not verify_admin_pin(p_pin) then raise exception 'Invalid PIN'; end if;

  if p_id is null then
    insert into channel_groups(name, description, sort_order)
    values (p_name, p_description, coalesce(p_sort_order, 0))
    returning id into new_id;
  else
    update channel_groups
      set name = p_name, description = p_description,
          sort_order = coalesce(p_sort_order, sort_order), updated_at = now()
      where id = p_id
      returning id into new_id;
  end if;
  return new_id;
end; $$;

create or replace function admin_delete_group(p_pin text, p_id uuid)
returns void language plpgsql security definer as $$
begin
  if not verify_admin_pin(p_pin) then raise exception 'Invalid PIN'; end if;
  delete from channel_groups where id = p_id;
end; $$;

create or replace function admin_upsert_profile(
  p_pin text, p_group_id uuid, p_platform platform_type, p_profile_url text, p_handle text
) returns uuid
language plpgsql security definer as $$
declare new_id uuid;
begin
  if not verify_admin_pin(p_pin) then raise exception 'Invalid PIN'; end if;

  insert into platform_profiles(group_id, platform, profile_url, handle)
  values (p_group_id, p_platform, p_profile_url, p_handle)
  on conflict (group_id, platform) do update
    set profile_url = excluded.profile_url, handle = excluded.handle, updated_at = now()
  returning id into new_id;
  return new_id;
end; $$;

create or replace function admin_delete_profile(p_pin text, p_id uuid)
returns void language plpgsql security definer as $$
begin
  if not verify_admin_pin(p_pin) then raise exception 'Invalid PIN'; end if;
  delete from platform_profiles where id = p_id;
end; $$;

create or replace function admin_reorder_groups(p_pin text, p_ids uuid[])
returns void language plpgsql security definer as $$
declare i int := 0; gid uuid;
begin
  if not verify_admin_pin(p_pin) then raise exception 'Invalid PIN'; end if;
  foreach gid in array p_ids loop
    update channel_groups set sort_order = i, updated_at = now() where id = gid;
    i := i + 1;
  end loop;
end; $$;

create or replace function admin_set_pin(p_old_pin text, p_new_pin text)
returns void language plpgsql security definer as $$
begin
  if not verify_admin_pin(p_old_pin) then raise exception 'Invalid current PIN'; end if;
  perform set_admin_pin(p_new_pin);
end; $$;

-- ---------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------
alter table channel_groups enable row level security;
alter table platform_profiles enable row level security;
alter table cached_posts enable row level security;
alter table fetch_logs enable row level security;
alter table admin_settings enable row level security;

-- Public read-only access (used by the anon key in the frontend)
create policy "public read channel_groups" on channel_groups for select using (true);
create policy "public read platform_profiles" on platform_profiles for select using (true);
create policy "public read cached_posts" on cached_posts for select using (true);
create policy "public read fetch_logs" on fetch_logs for select using (true);
-- admin_settings: no public access at all (not even select) — only via RPCs above (security definer)

-- No direct insert/update/delete policies are defined for the anon role on any table,
-- so all writes MUST go through the security-definer RPC functions above (PIN-gated)
-- or the service_role key used inside the Edge Function.

-- ---------------------------------------------------------
-- Seed data: 4 example channel groups (edit/delete from Admin Panel)
-- ---------------------------------------------------------
insert into channel_groups (name, description, sort_order) values
  ('Acme Corp', 'Flagship brand channels', 0),
  ('Acme Gaming', 'Gaming sub-brand', 1),
  ('Acme News', 'News & updates desk', 2),
  ('Acme Lifestyle', 'Lifestyle content arm', 3)
on conflict do nothing;

-- Set a default PIN — CHANGE THIS IMMEDIATELY after first login.
select set_admin_pin('1234');
