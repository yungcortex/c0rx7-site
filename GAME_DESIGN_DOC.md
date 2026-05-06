# ÆTHERWAKE — Game Design Document

**A stylish-action ARPG with persistent online social hub.**
FFXIV / FFXI / Nexus TK structure × Devil May Cry combat flavor.
Web-native, painterly cel-shaded, deployed at c0r7x.com.

---

## Pillars

1. **Deep character creation** — 80+ blendshape sliders, 4 heritages, voice + backstory.
2. **One character, every class** — class = equipped Aspect (sentient devil-bound weapon). Switch freely.
3. **Stylish real-time combat** — DMC-style D→SSS rank, posture-break, weave-cancels, parries.
4. **Persistent social hub** — Hyrr Central, Supabase Realtime presence + chat.
5. **Painterly art direction** — cel-shaded + screen-space outline, scoped for solo dev.

---

## Premise

The world is the dreaming city **Hyrr**, eternally re-shaping between waking and sleep. Most who live here forget every cycle. **Wakers** are those who remember — they carry **Aspects**, echoes of fallen gods bound into weapons. Something is keeping the city from waking up.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Engine | Babylon.js 7+ |
| Language | TypeScript |
| Bundler | Vite |
| HUD/Menus | React + Zustand |
| Backend | Supabase (auth, db, realtime) |
| Future MP | Colyseus on Fly.io (post-launch) |
| Asset pipeline | Blender → glTF 2.0 (.glb) |
| Animations | Mixamo (free, retargeted) |
| Base mesh | MakeHuman / VRoid → custom morph rigs |
| Audio | Tone.js for music layering, royalty-free SFX |
| Hosting | Vercel (static + serverless API) |

---

## Aspects (classes) — 8 at launch

| Aspect | Weapon | Style |
|---|---|---|
| Tempest | greatsword | parry/momentum |
| Choir | dual pistols | airborne juggle |
| Bloom | scythe | range AoE |
| Veil | gauntlets | counter/grapple |
| Hymn | chime + tome | DPS healer |
| Ember | flame staff | nuke caster |
| Vow | shield + sword | tank, posture-break |
| Hush | concealed daggers | stealth-burst |

Each Aspect: 3 movesets (Light/Heavy/Ranged-or-Magic), 2-3 Shift modes (DMC styles), Stylish Rank (D→SSS), Aspect Voice (subtitled bark), and Awakening (Devil Trigger, boss-only).

---

## Character Creator depth

- **4 heritages**: Hjari, Sivit, Korr, Vellish (+ post-launch Ashen)
- **Continuous masculine↔feminine slider**, body type independent
- **80+ face/body blendshapes**, 30+ palette/skin/hair customization
- **Hair physics** via Babylon bone simulation
- **Voice**: 8 sets per heritage × 5 pitch variants
- **Backstory quiz** seeds starting Aspect affinity + opening monologue
- Save format: 256-byte slider blob + jsonb metadata in Supabase

---

## Core systems

### Combat
- 60fps action ARPG with soft lock-on
- Light/Heavy/Ranged/Dodge/Parry/Aspect-Shift/Awakening
- 3-charge stamina dodge with perfect-dodge slowdown (Bayonetta-style)
- Posture system (Sekiro): break = riposte window
- Stylish Rank affects MP regen + drop quality + leaderboard
- Damage formula: `base × scaling × rank_bonus × element × posture × jitter`

### Quests
- **Echo** (MSQ), **Vow** (sidequests), **Pact** (faction/repeatable), **Hollow** (challenge), **Whisper** (async coop)
- JSON-driven, FSM engine (~400 LOC)
- In-engine cinematics via Babylon Animation timeline

### Inventory
- 6 equipment + 2 Aspect + 50 bag (expandable to 200) + 200 bank
- Glamour system (FF14): appearance decoupled from stats
- RLS on inventory rows in Supabase

### Chat
- `/say` `/shout` `/yell` `/party` `/free` `/whisper` `/world`
- Linkshells (FFXI homage), item links, emotes, custom reactions
- PerspectiveAPI moderation

### Save
- Server-authoritative character/inventory/quest state
- Optimistic local writes, queue server sync
- Auto-snapshot on event boundaries
- 8 character slots per account

### Social
- Supabase Realtime presence in hub city (~30 visible players)
- Async ghosts/messages/kudos (Dark Souls style) elsewhere
- Choir (guilds), party finder, friends, recent players

---

## Story arc — *The Lullaby of Hyrr* (v1)

3 acts, ~12 hours. Ends on cliffhanger teasing expansion 1.
Beat sheet: TBD next session.

---

## Build phases

### Phase 0 — Scaffold (week 1) ← CURRENT
- Vite + TS + Babylon + React in `/game/` branch
- Title screen + Supabase auth + character-select stub
- One painterly skybox + rotating display character
- Move legacy heatmap site to `/legacy/` route

### Phase 1 — Character Creator (weeks 2-4)
- MakeHuman base mesh, common skeleton
- ~30 critical sliders, live-preview
- Save/load slider blob, race switcher (Hjari + Sivit first)

### Phase 2 — Hub City + Movement (weeks 5-7)
- Hyrr Central built in Blender (~30K tris)
- Third-person camera, walk/run/jump
- Realtime presence, 4 NPCs, proximity chat
- 60fps with 16 player models on screen

### Phase 3 — Combat Vertical Slice (weeks 8-12)
- Tempest Aspect fully implemented
- 1 enemy archetype + 1 boss
- Dungeon: **The Hollow Vespers**
- Solo + 2-player drop-in coop
- Loot table, basic inventory

### Phase 4 — Story + Systems (weeks 13-20)
- Quest engine + first 6 Echo quests
- 4 more Aspects (Choir, Bloom, Hymn, Vow)
- Glamour, Choir guilds, party finder, map, fast travel
- 3 more dungeons

### Phase 5 — Soft launch (weeks 21-24)
- Polish, balance, optimization, tutorial
- Cosmetic shop (transmog only, no P2W)
- Discord, landing page, announce

---

## Repo layout

```
/game/                   ← new game lives here (this branch)
  src/
    main.ts
    game/
      engine/
      systems/
        combat/
        character/
        inventory/
        quest/
        chat/
        social/
        save/
      aspects/
      scenes/
      ui/
      shaders/
      config/
    net/
    state/
    lib/
  content/
    quests/*.json
    dialogue/*.json
    items/*.json
    enemies/*.json
  assets/
    models/*.glb
    textures/*.webp
    audio/*.ogg
    ui/*.png
  tools/
    blender/
    validators/
  public/
  index.html
  package.json
  vite.config.ts
  tsconfig.json

/                        ← repo root keeps existing deploy
  index.html             ← legacy heatmap (move to /legacy/ when game ships)
  vercel.json            ← updated to route /game/* to game build
  api/
  supabase-schema.sql
```

---

## Open decisions

- **Title screen tone**: melodramatic FF14, ironic-cool DMC, or split-the-baby?
- **Mature rating**: blood/violence yes; sexuality TBD
- **Wallet-connect alt login**: deferred (no crypto for v1)

---

## Asset hosting

Commit assets <50MB total directly. Migrate to Cloudflare R2 once threshold crossed.

---

*Doc maintained on branch `game-aetherwake`. Update phase status as we go.*
