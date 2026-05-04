# Ætherwake

Web-native stylish-action ARPG. Babylon.js + TypeScript + React HUD + Supabase.

See [../GAME_DESIGN_DOC.md](../GAME_DESIGN_DOC.md) for the full design doc.

## Dev

```bash
cd game
cp .env.example .env.local   # fill in Supabase keys
npm install
npm run dev                  # http://localhost:5173
```

## Build

```bash
npm run build
npm run preview              # http://localhost:4173
```

Output to `game/dist/` and gets served by Vercel at `/play/`.

## Stack

- Babylon.js 7 — 3D engine, character animator, GUI, post-processing
- TypeScript — strict mode
- Vite — bundler + HMR
- React + Zustand — HUD/menus only (game world is Babylon)
- Supabase — auth, characters, inventory, quest progress, realtime chat/presence

## Repo layout

```
src/
  main.tsx              entry; mounts React + Babylon
  game/
    engine/             Babylon engine wrapper, render loop
    scenes/             scene builders (title, character-select, ...)
    systems/            combat / character / inventory / quest / chat / save / social
    aspects/            per-Aspect movesets (Tempest, Choir, ...)
    ui/                 React HUD components, screens, styles
    shaders/            GLSL + post-process pipelines
  net/                  supabase client, RPC, realtime
  state/                zustand stores
content/                JSON-driven content (quests, dialogue, items, enemies)
assets/                 binary assets (glb, webp, ogg)
tools/                  blender export scripts, validators
```

## Conventions

- Path aliases: `@/`, `@game/`, `@net/`, `@state/`, `@ui/`
- Scenes are pure builder functions: `(engine, canvas) => Scene`
- All persistent player data goes through `src/game/systems/save/` — never write to Supabase directly from a scene
- React owns menus/HUD, Babylon owns the world. They communicate via zustand stores.
