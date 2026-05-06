# BEAN ROYALE — Game Design Doc

*(formerly Ætherwake — pivoted 2026-05-04 to Fall Guys-style party game with Solana prize pools)*

> Cute beans bonking each other for SOL prize pots in the dreaming city of Hyrr.

A short-match competitive party game with deep cosmetics, run on the open web, paid out in Solana, set in a fantasy city that's secretly an MMORPG world we add to over time.

---

## Pillars

1. **Beans are the aesthetic** — primitive procedural characters are the art direction, not a placeholder. Every "model" is code. Visual identity from outlines + saturated colours + hats.
2. **3-minute matches** — bonk, race, survive, last bean standing. Easy to drop in / out.
3. **Prize pots in SOL** — entry fee N SOL, winner takes (pot − 8% house). Solana for cheap fast settlement.
4. **Cosmetics-driven progression** — hats / outfits / patterns / emotes. Unlock by winning. Buy with SOL. Trade later.
5. **Lore that sneaks in** — the dreaming city of Hyrr is the world, the Aspects are class loadouts, the heritages are bean shapes. We expand the MMORPG slowly *while* the party game is live.

---

## Tone

Adventure Time meets Fall Guys meets Hades. Cute on the surface, surprisingly dark when you read the lore. Think: chubby beans solemnly entering an ancient bell-tower trial because the gods bound into their weapons demand it.

---

## Pitch in one paragraph

> The dreaming city of Hyrr forgets itself every Cycle. The only beings that remember are **Wakers** — chubby beans bound to fragments of dead gods (Aspects). To prove their right to hold an Aspect, Wakers compete in **Aspect Trials**: 3-minute bonk-action tournaments staged across the city's districts. The winning bean takes the pot, the prestige, and a step toward unbinding their god. The losers get bonked off the platform.

---

## Core Loop

```
1. Connect wallet (Phantom)
2. Pick / customize bean
3. Browse open lobbies → pick mode + entry fee (or Free Trials)
4. Wait for fill → drop into match
5. ~3 min match → results screen
6. Winner gets payout, all players get cosmetic XP / drops
7. Back to lobby
```

Optional solo: **Aspect Trial** PvE rooms, pure cosmetic / story progression, no entry fee.

---

## Tech Stack

| Layer | Tech | Status |
|---|---|---|
| Engine | Babylon.js 7+ | done |
| Language | TypeScript | done |
| Bundler | Vite | done |
| HUD | React + Zustand | done |
| Wallet | Phantom + Solflare + Backpack via direct injection (later: wallet-adapter-react) | done (skeleton) |
| Auth | Wallet pubkey + Supabase row | TBD |
| Off-chain DB | Supabase (existing) | done |
| Realtime hub presence | Supabase Realtime | done |
| Match server | **Colyseus** on Fly.io | TBD |
| Physics | Babylon Havok plugin | TBD |
| Escrow | **Anchor** program in Rust on Solana | TBD (v2) |
| Hosting | Vercel (existing) | done |

---

## Heritages = Bean Shapes

Same lore as before, now expressed as bean silhouettes:

| Heritage | Body shape | Distinguishing feature |
|---|---|---|
| **Hjari** | medium round bean | none |
| **Sivit** | tall slim bean | long pointed bunny-ears |
| **Korr** | wide round ball | none |
| **Vellish** | small bean | cat ears + curly tail |
| **Ashen** | slim ghost bean | translucent + glow (locked at launch) |

---

## Cosmetics System

### Categories (v1)
- **Body Color** — 20 swatches in the bean palette
- **Pattern** — none, stripes, dots, split, gradient
- **Eyes** — round, sparkle, sleepy, angry, dead-X, heart, swirl
- **Mouth** — smile, grin, frown, gasp, smug, tongue, neutral
- **Hat** — wizard, crown, propeller, helmet, horns, top hat, halo
- **Outfit** — cape, scarf, armor, robe-trim, bowtie
- **Accessory** — glasses, monocle, mustache, earrings

### Earning vs Buying
- **Free**: starting set (~3 hats, 2 outfits, all eye/mouth styles, 5 colors)
- **Match drops**: cosmetic crates per win, with rarity tiers
- **SOL purchases**: 0.05–1 SOL per item, premium hats / seasonal sets
- **Tournament rewards**: top-3 bracket positions get unique trophy hats

### Glamour
Cosmetic loadout is decoupled from any future stat-bearing equipment (FFXIV approach).

---

## Game Modes (v1 → v3)

| Mode | Players | Description | MVP |
|---|---|---|---|
| **Bonk Brawl** | 8 | Last bean standing. Knock others off the platform. | v1 |
| **Bean Race** | 12 | Obstacle-course rush to the finish line. | v2 |
| **King of the Bell** | 8 | Cumulative time on the central area wins. | v2 |
| **Hot Bean** | 16 | Tag-pass-or-burn survival. | v3 |
| **Aspect Trial** | 1 | Solo PvE story content, no entry fee. | v2 |
| **Tournament Bracket** | 32 | Single-elim across multiple modes. | v3 |

---

## Solana Integration

### v1 — wallet only (now)
- Connect / display pubkey
- No money flow yet
- Save bean to Supabase keyed by pubkey

### v2 — escrow MVP
- Anchor program: lobby PDA holds entry fees in escrow
- Server posts match result (signed authority key)
- Escrow distributes pot: 87% winner, 5% top-3 split, 8% house

### v3 — full economy
- SPL token "BEAN" earned per match for non-monetary rewards
- Cosmetic NFT mints for trophies (one-of-one tournament winners)
- Spectator betting (legal-jurisdictionally constrained)
- Sponsored tournaments (brand + creator-run)

### Legal posture
Wagering on skill-based outcomes is legal in most US states + parts of EU. We:
- Position as a **skill-based competition**, not gambling
- ToS + age gate + geo-block known problem regions
- House cut + guarantees clear in lobby UI before deposit
- Real-money escrow gets an audit before mainnet
- v1-v2 default to TESTNET / paper SOL until audit lands

---

## Match Architecture (v2)

```
[Players] → [Lobby UI] → [Matchmaker (Colyseus)] → [Game Room]
                                                          ↓
                                                  [Authoritative tick]
                                                          ↓
                                                  [Match end]
                                                          ↓
                                       [Server signs result with authority key]
                                                          ↓
                                              [Anchor program payout]
                                                          ↓
                                  [Supabase: leaderboards + replay metadata]
```

Anti-cheat: server-authoritative physics; client only sends inputs. Replay frames stored for dispute resolution. Suspicious patterns (perfect timing, inhuman aim) flagged.

---

## Build phases

### Phase 0 — Bean foundation *(this week, in progress)*
- [x] Procedural bean character system
- [x] Cosmetic categories (hat/outfit/eyes/mouth/pattern/accessory)
- [x] Phantom wallet connect skeleton
- [x] Title screen rebrand
- [ ] Bean → Supabase save
- [ ] First arena (Bonk Brawl floating island)
- [ ] Bean physics + dive-bonk attack
- [ ] Solo "vs AI dummies" preview

### Phase 1 — Solo + lobbies *(weeks 2-3)*
- Match flow UI: lobby → load → match → results
- Solo Aspect Trials (PvE)
- Cosmetic shop UI (mocked, no SOL flow)
- Replays save + playback
- 8 hats + 4 outfits + 6 emotes

### Phase 2 — Multiplayer *(weeks 4-6)*
- Colyseus deploy on Fly.io
- 8-player Bonk Brawl
- Realtime sync (positions, attacks, hits)
- Server authoritative match outcome
- Leaderboard

### Phase 3 — Economy *(weeks 7-10)*
- Anchor escrow program (devnet first)
- Lobby with entry fee → on-chain deposit
- Payout on match end
- Cosmetic shop with real SOL purchases
- Audit before mainnet flip

### Phase 4 — Polish + Launch *(weeks 11-14)*
- Race + KotB modes
- Bracket tournaments
- Mobile responsive
- Tutorial onramp
- Discord, marketing, soft launch

---

## Repo layout

```
/game/
  src/
    main.tsx
    game/
      engine/
      systems/
        character/        ← Bean, BeanLook, customization
        movement/
        chat/
        social/
        save/
      scenes/
        title/
        character-creator/
        character-select/
        arena-bonk/       ← Phase 0 next
        hub-hyrr/         ← legacy MMO hub, kept for lore
      shaders/
      ui/
        screens/
        hud/
        components/       ← WalletPill, etc.
      config/
    net/
      supabase.ts
      wallet.ts           ← Phantom / Solflare / Backpack
    state/
    lib/
  public/                  ← static
  GAME_DESIGN_DOC.md       ← this file
  ASSETS_FIDELITY_ROADMAP.md ← legacy from FFXIV pivot, kept for context
  package.json
```

---

## Naming + brand

- **Working title**: BEAN ROYALE (subject to change)
- **World name**: still Hyrr / Ætherwake universe
- **Tagline**: "Bonk for glory. Win the pot. Buy hats."
- **Tone**: cute on outside, dark on inside, profitable in the middle

---

*This doc supersedes the prior MMORPG-focused Ætherwake design.*
*Hyrr lore from the prior phase is preserved; story content becomes mode flavor + Aspect Trials, not gated MSQ.*
