# Bean Royale Match Server

Authoritative Colyseus server for multiplayer Bonk Brawl. Runs at 30Hz, owns the truth on physics + bonking + match outcome.

## Local dev

```bash
cd game/server
npm install
npm run dev
```

Server listens on `:2567`. Client connects with `VITE_COLYSEUS_URL=ws://localhost:2567`.

## Deploy (Fly.io)

```bash
fly launch --no-deploy        # first time only
fly secrets set ...           # any env you need
npm run build
fly deploy
```

`fly.toml` sets up auto-stop / auto-start so we only pay for VM when at least one match is active.

## Schema

`PlayerSchema { username, color, hat, x, y, z, yaw, alive, bonks }`
`RoomState { players: Map<sessionId, PlayerSchema>, variant, phase, startsAt }`

## Phases

```
lobby → (2+ players) → countdown (5s) → playing → ended
```

## Anti-cheat status

Server-authoritative for movement + bonk hit detection. Inputs from client are advisory; server applies. Replay frames not yet stored — Phase 4. Suspicious-input flag (perfect timing, inhuman aim) not yet implemented.
