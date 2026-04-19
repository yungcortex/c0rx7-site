-- ============================================================================
-- CORTEX · TERMINAL   —   Supabase schema
-- ============================================================================
-- Paste this entire file into your Supabase project's SQL editor and run it.
-- Enables: profiles, ideas, comments, likes, watchlists with RLS + realtime.
-- ============================================================================

-- --------------------------- PROFILES ---------------------------------------
-- One row per user. Auto-created on signup via trigger.
create table if not exists public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  handle      text        unique not null,
  bio         text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles readable by all" on public.profiles;
create policy "profiles readable by all"
  on public.profiles for select
  using (true);

drop policy if exists "profiles editable by owner" on public.profiles;
create policy "profiles editable by owner"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "profiles insertable by owner" on public.profiles;
create policy "profiles insertable by owner"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create a profile row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, handle)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'handle',
      'user_' || substring(new.id::text, 1, 8)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- --------------------------- IDEAS ------------------------------------------
-- Trade-thesis posts. Public readable, owner-writable.
create table if not exists public.ideas (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  sym          text        not null,
  bias         text        not null check (bias in ('long','short','note')),
  body         text        not null check (char_length(body) between 1 and 600),
  tgt          text,
  inv          text,
  like_count   integer     not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists ideas_created_idx on public.ideas (created_at desc);
create index if not exists ideas_user_idx    on public.ideas (user_id);
create index if not exists ideas_sym_idx     on public.ideas (sym);

alter table public.ideas enable row level security;

drop policy if exists "ideas readable by all" on public.ideas;
create policy "ideas readable by all"
  on public.ideas for select
  using (true);

drop policy if exists "ideas insertable by owner" on public.ideas;
create policy "ideas insertable by owner"
  on public.ideas for insert
  with check (auth.uid() = user_id);

drop policy if exists "ideas deletable by owner" on public.ideas;
create policy "ideas deletable by owner"
  on public.ideas for delete
  using (auth.uid() = user_id);

drop policy if exists "ideas updatable by owner" on public.ideas;
create policy "ideas updatable by owner"
  on public.ideas for update
  using (auth.uid() = user_id);

-- --------------------------- LIKES ------------------------------------------
-- One row per (user, idea). Trigger keeps like_count in sync on ideas.
create table if not exists public.idea_likes (
  idea_id    uuid        not null references public.ideas(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

alter table public.idea_likes enable row level security;

drop policy if exists "likes readable by all" on public.idea_likes;
create policy "likes readable by all"
  on public.idea_likes for select using (true);

drop policy if exists "likes insertable by owner" on public.idea_likes;
create policy "likes insertable by owner"
  on public.idea_likes for insert with check (auth.uid() = user_id);

drop policy if exists "likes deletable by owner" on public.idea_likes;
create policy "likes deletable by owner"
  on public.idea_likes for delete using (auth.uid() = user_id);

create or replace function public.bump_idea_like_count()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update public.ideas set like_count = like_count + 1 where id = new.idea_id;
  elsif tg_op = 'DELETE' then
    update public.ideas set like_count = greatest(0, like_count - 1) where id = old.idea_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_idea_likes_count on public.idea_likes;
create trigger trg_idea_likes_count
  after insert or delete on public.idea_likes
  for each row execute function public.bump_idea_like_count();

-- --------------------------- COMMENTS ---------------------------------------
-- Per-symbol comments. Any signed-in user can post, only author can delete.
create table if not exists public.comments (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  sym        text        not null,
  body       text        not null check (char_length(body) between 1 and 240),
  created_at timestamptz not null default now()
);

create index if not exists comments_sym_idx     on public.comments (sym, created_at desc);
create index if not exists comments_user_idx    on public.comments (user_id);

alter table public.comments enable row level security;

drop policy if exists "comments readable by all" on public.comments;
create policy "comments readable by all"
  on public.comments for select using (true);

drop policy if exists "comments insertable by auth user" on public.comments;
create policy "comments insertable by auth user"
  on public.comments for insert with check (auth.uid() = user_id);

drop policy if exists "comments deletable by owner" on public.comments;
create policy "comments deletable by owner"
  on public.comments for delete using (auth.uid() = user_id);

-- --------------------------- WATCHLISTS -------------------------------------
-- Named symbol lists per user.
create table if not exists public.watchlists (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null,
  symbols    text[]      not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.watchlists enable row level security;

drop policy if exists "watchlists owner read" on public.watchlists;
create policy "watchlists owner read"
  on public.watchlists for select using (auth.uid() = user_id);

drop policy if exists "watchlists owner insert" on public.watchlists;
create policy "watchlists owner insert"
  on public.watchlists for insert with check (auth.uid() = user_id);

drop policy if exists "watchlists owner update" on public.watchlists;
create policy "watchlists owner update"
  on public.watchlists for update using (auth.uid() = user_id);

drop policy if exists "watchlists owner delete" on public.watchlists;
create policy "watchlists owner delete"
  on public.watchlists for delete using (auth.uid() = user_id);

-- --------------------------- REALTIME ---------------------------------------
-- Publish tables so the client can subscribe to live changes.
alter publication supabase_realtime add table public.ideas;
alter publication supabase_realtime add table public.idea_likes;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.profiles;

-- --------------------------- VIEWS ------------------------------------------
-- ideas_with_author: convenient joined read for the feed
create or replace view public.ideas_with_author as
select
  i.id, i.user_id, i.sym, i.bias, i.body, i.tgt, i.inv, i.like_count, i.created_at,
  p.handle, p.avatar_url
from public.ideas i
left join public.profiles p on p.id = i.user_id;

grant select on public.ideas_with_author to anon, authenticated;

-- comments_with_author
create or replace view public.comments_with_author as
select
  c.id, c.user_id, c.sym, c.body, c.created_at,
  p.handle, p.avatar_url
from public.comments c
left join public.profiles p on p.id = c.user_id;

grant select on public.comments_with_author to anon, authenticated;

-- --------------------------- DONE -------------------------------------------
select 'cortex · schema ready ◆' as status;
