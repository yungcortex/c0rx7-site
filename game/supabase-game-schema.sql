-- ============================================================================
-- ÆTHERWAKE  —  game schema (extends supabase-schema.sql)
-- ============================================================================
-- Apply after the base profile schema. Adds: characters, inventory_items,
-- quest_progress, social_state, hub_presence (realtime), chat_messages.
-- ============================================================================

-- ---------------------------- CHARACTERS ------------------------------------
create table if not exists public.characters (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  slot          smallint    not null check (slot between 1 and 8),
  name          text        not null check (char_length(name) between 2 and 24),
  heritage      text        not null check (heritage in ('hjari','sivit','korr','vellish','ashen')),
  slider_blob   bytea       not null,
  metadata      jsonb       not null default '{}'::jsonb,
  active_aspect text        not null default 'tempest',
  aspect_xp     jsonb       not null default '{}'::jsonb,
  level         int         not null default 1,
  zone          text        not null default 'hyrr-central',
  position      jsonb       not null default '{"x":0,"y":0,"z":0,"r":0}'::jsonb,
  playtime_sec  bigint      not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, slot)
);

create index if not exists characters_user_idx on public.characters(user_id);

alter table public.characters enable row level security;

drop policy if exists "characters readable by owner" on public.characters;
create policy "characters readable by owner"
  on public.characters for select
  using (auth.uid() = user_id);

drop policy if exists "characters insertable by owner" on public.characters;
create policy "characters insertable by owner"
  on public.characters for insert
  with check (auth.uid() = user_id);

drop policy if exists "characters editable by owner" on public.characters;
create policy "characters editable by owner"
  on public.characters for update
  using (auth.uid() = user_id);

drop policy if exists "characters deletable by owner" on public.characters;
create policy "characters deletable by owner"
  on public.characters for delete
  using (auth.uid() = user_id);

-- ---------------------------- INVENTORY -------------------------------------
create table if not exists public.inventory_items (
  id            uuid        primary key default gen_random_uuid(),
  character_id  uuid        not null references public.characters(id) on delete cascade,
  item_id       text        not null,
  qty           int         not null default 1 check (qty > 0),
  slot_index    int         not null,
  equipped_slot text,
  glamour_of    text,
  mods          jsonb       not null default '{}'::jsonb,
  acquired_at   timestamptz not null default now()
);

create index if not exists inventory_items_char_idx on public.inventory_items(character_id);

alter table public.inventory_items enable row level security;

drop policy if exists "inventory readable by owner" on public.inventory_items;
create policy "inventory readable by owner"
  on public.inventory_items for select
  using (
    exists (select 1 from public.characters c
            where c.id = character_id and c.user_id = auth.uid())
  );

drop policy if exists "inventory writable by owner" on public.inventory_items;
create policy "inventory writable by owner"
  on public.inventory_items for all
  using (
    exists (select 1 from public.characters c
            where c.id = character_id and c.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.characters c
            where c.id = character_id and c.user_id = auth.uid())
  );

-- ---------------------------- QUEST PROGRESS --------------------------------
create table if not exists public.quest_progress (
  id            uuid        primary key default gen_random_uuid(),
  character_id  uuid        not null references public.characters(id) on delete cascade,
  quest_id      text        not null,
  state         text        not null check (state in ('available','active','completed','failed')),
  step          int         not null default 0,
  vars          jsonb       not null default '{}'::jsonb,
  updated_at    timestamptz not null default now(),
  unique (character_id, quest_id)
);

create index if not exists quest_progress_char_idx on public.quest_progress(character_id);

alter table public.quest_progress enable row level security;

drop policy if exists "quest progress readable by owner" on public.quest_progress;
create policy "quest progress readable by owner"
  on public.quest_progress for select
  using (
    exists (select 1 from public.characters c
            where c.id = character_id and c.user_id = auth.uid())
  );

drop policy if exists "quest progress writable by owner" on public.quest_progress;
create policy "quest progress writable by owner"
  on public.quest_progress for all
  using (
    exists (select 1 from public.characters c
            where c.id = character_id and c.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.characters c
            where c.id = character_id and c.user_id = auth.uid())
  );

-- ---------------------------- CHAT ------------------------------------------
-- Persisted chat for /world only. Other channels (say/shout/yell/party/whisper)
-- are ephemeral, broadcast over Supabase Realtime presence/broadcast.
create table if not exists public.chat_messages (
  id          uuid        primary key default gen_random_uuid(),
  channel     text        not null check (channel in ('world','choir','linkshell')),
  channel_id  text,
  author_id   uuid        not null references auth.users(id) on delete cascade,
  author_name text        not null,
  body        text        not null check (char_length(body) between 1 and 480),
  created_at  timestamptz not null default now()
);

create index if not exists chat_recent_idx on public.chat_messages(channel, channel_id, created_at desc);

alter table public.chat_messages enable row level security;

drop policy if exists "chat readable by all auth" on public.chat_messages;
create policy "chat readable by all auth"
  on public.chat_messages for select
  using (auth.uid() is not null);

drop policy if exists "chat insertable by author" on public.chat_messages;
create policy "chat insertable by author"
  on public.chat_messages for insert
  with check (auth.uid() = author_id);

-- ---------------------------- updated_at TRIGGERS ---------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_characters_updated on public.characters;
create trigger trg_characters_updated before update on public.characters
  for each row execute function public.set_updated_at();

drop trigger if exists trg_quest_updated on public.quest_progress;
create trigger trg_quest_updated before update on public.quest_progress
  for each row execute function public.set_updated_at();

-- ---------------------------- REALTIME PUBLICATION --------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
exception when duplicate_object then null;
end $$;
