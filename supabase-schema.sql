-- 1. Create Tables

-- Profiles table (linked to auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  role text check (role in ('admin', 'user')) not null default 'user',
  show_video boolean not null default false,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Allowed Channels table (Whitelist)
create table if not exists public.allowed_channels (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  channel_id text not null,
  channel_title text not null,
  channel_thumbnail text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, channel_id)
);

-- Playlists table
create table if not exists public.playlists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Playlist Items table
create table if not exists public.playlist_items (
  id uuid default gen_random_uuid() primary key,
  playlist_id uuid references public.playlists on delete cascade not null,
  video_id text not null,
  title text not null,
  thumbnail text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Play History table
create table if not exists public.play_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  video_id text not null,
  title text not null,
  thumbnail text,
  played_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- YouTube Cache table
create table if not exists public.youtube_cache (
  key text primary key,
  value jsonb not null,
  expires_at timestamp with time zone not null
);

-- 2. Automatic Profile Creation Trigger
-- When a user is created in auth.users, create a corresponding row in public.profiles.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  is_first_user boolean;
begin
  -- Check if profiles table is empty
  select not exists (select 1 from public.profiles) into is_first_user;

  insert into public.profiles (id, role, show_video)
  values (
    new.id,
    case when is_first_user then 'admin' else 'user' end,
    case when is_first_user then true else false end
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger configuration
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Enable Row Level Security (RLS) on all tables
alter table public.profiles enable row level security;
alter table public.allowed_channels enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_items enable row level security;
alter table public.play_history enable row level security;
alter table public.youtube_cache enable row level security;

-- 4. Create RLS Policies

-- Profiles Policies
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "Admins can update profiles"
  on public.profiles for update
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- Allowed Channels Policies
create policy "Users can view their own allowed channels"
  on public.allowed_channels for select
  using (auth.uid() = user_id);

create policy "Admins can manage all allowed channels"
  on public.allowed_channels for all
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- Playlists Policies
create policy "Users can manage their own playlists"
  on public.playlists for all
  using (auth.uid() = user_id);

-- Playlist Items Policies
create policy "Users can manage items in their own playlists"
  on public.playlist_items for all
  using (exists (
    select 1 from public.playlists
    where id = playlist_id and user_id = auth.uid()
  ));

-- Play History Policies
create policy "Users can manage their own play history"
  on public.play_history for all
  using (auth.uid() = user_id);

-- YouTube Cache Policies (Backend operations will access directly, but enable all for simple DB query client)
create policy "Enable all access to youtube_cache"
  on public.youtube_cache for all
  using (true);
