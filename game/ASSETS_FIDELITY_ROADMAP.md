# Path to Final-Fantasy-grade fidelity

Currently we render parametric capsule + sphere humanoids with flat StandardMaterial colors. To reach FFXIV / Genshin / Tales-of fidelity is **4 tiers of work**, each unlocked by the previous. Skipping a tier means the missing layer leaks through and the result looks worse, not better.

---

## TIER 1 — Stylized shading on the existing primitives *(this week)*

**Goal:** before any new mesh, get the **rendering** to look painterly. Same primitives suddenly look like Genshin if shaded right.

- ✅ `celMaterial.ts` — 3-band cel shader + warm-shadow / cool-highlight tinting + Fresnel rim ([built])
- ✅ `addOutline()` — inverted-hull outline pass ([built])
- 🔲 Apply cel + outline to **all character avatars** (replace StandardMaterial in MorphController)
- 🔲 Apply cel + outline to NPCs, Resonance Spire, district buildings
- 🔲 Add **SSAO** (Screen-Space Ambient Occlusion) — Babylon's `SSAO2RenderingPipeline`
- 🔲 Per-zone **LUT color grading** (one PNG LUT per zone — sunset, dungeon, town)
- 🔲 Volumetric god rays from the Resonance Spire crystal

**Visible win:** primitives look like Tales-of-Arise. Free, no new assets needed.

---

## TIER 2 — Real meshes, free sources *(next 1-2 weeks)*

**Goal:** swap parametric placeholder for a real humanoid base mesh per heritage. **Free pipeline:** MakeHuman → Blender → Mixamo → glTF.

### Pipeline
1. **MakeHuman 1.3+** (free, GPL) — generate base mesh per heritage
   - Hjari = default human preset
   - Sivit = tall + slim + pointed-ear modifier
   - Korr (tall) = short + broad
   - Korr (short) = very short + broad
   - Vellish = use ears/tail modifiers (or sculpt in Blender after)
2. **Export OBJ** from MakeHuman, import to Blender
3. **Mixamo auto-rig** — drop OBJ in Mixamo, get rigged FBX
4. **Bone rename in Blender** — match `Aetherwake_Skeleton` spec
5. **Add morph targets** (40 face + 32 body) — Blender's "Shape Keys" panel
6. **Export glTF** via `tools/blender/export-character.py`
7. **Drop into `assets/models/character/base-<heritage>.glb`**
8. Update `assetManifest.ts` to point at the new file
9. MorphController auto-detects glb vs primitive fallback

### Animations
- **Mixamo** — 1500+ free animations, auto-retargets to our skeleton
- Pull: `idle_neutral`, `walk_loop`, `run_loop`, `jump_start/loop/land`, `dodge_*`, `emote_wave`, `emote_sit`, `emote_dance`
- Combat anims (Tempest light/heavy/dodge/parry) — manual authoring or commission

### Time investment
- One person can have **all 4 heritage base meshes ready in a weekend** using MakeHuman + Mixamo.
- Adding 16 critical face morphs in Blender = ~4 hours per heritage.

**Visible win:** real humans walking around the plaza. Even with placeholder textures the silhouette change is enormous.

---

## TIER 3 — Texturing, hair, clothing *(next month)*

**Goal:** lift the look from "rigged base mesh" to "FFXIV character". The single biggest fidelity win is **good texture work**.

### Textures
- **Substance Painter** ($20/mo subscription, or free for students) — author character textures
- **Quixel Mixer** (free) — alternative
- Texel density target: 1024² face + 1024² body + 512² each clothing piece
- For stylized look (FFXIV / Genshin), hand-painted maps beat PBR — paint shadow + color directly into albedo, then let our cel shader add lighting

### Hair (the biggest visual upgrade)
- **Card-based hair** (FFXIV / Genshin / NieR approach): planes with alpha-cutout strands
- Build a **hair cards generator** in Blender (script that lays cards along the scalp)
- 8-10 base hairstyles per heritage = ~3 days each
- Hair physics via Babylon bone simulation
- Replace current single-sphere hair with this

### Eyes + face microdetail
- **Eyebrows** = cards on the brow ridge
- **Eyelashes** = card with alpha
- **Eye irises** = mesh disc with rim shader (FFXIV does this — gives the iris a defined edge)
- **Mouth interior** = inside the head, with teeth + tongue cards (only visible on talk/laugh emotes)

### Outfit per Aspect class
- Each Aspect has a signature combat outfit
- Modular: head + chest + hands + legs + feet
- **Tempest** (greatsword) = duster coat + heavy boots + bracers
- **Choir** (dual pistols) = waistcoat + gloves + tall boots
- **Bloom** (scythe) = robed silhouette
- **Veil** (gauntlets) = wrapped chest + loose pants
- ~2 days per outfit in Blender + 2 days texturing = ~32 days for all 8 base outfits

### Glamour variants
- 3-4 color palettes per outfit slot
- Players unlock cosmetic-only swaps via story / dungeons

**Visible win:** screenshots are now indistinguishable from a niche mid-budget JRPG.

---

## TIER 4 — Custom art + polish *(months 2-4)*

**Goal:** lift to "I would buy this game." Replace MakeHuman with a custom-sculpted base. Custom animation. Per-zone modular environments.

- **Custom base mesh** sculpted in Blender or ZBrush — ~80 hours per heritage. Distinguishes us from every other MakeHuman game
- **Custom animations** for combat — hire a freelance animator (Fiverr / pros: $50-200 per animation cycle, ~30-50 needed for Tempest)
- **Modular environment kit** — trim sheets + reusable wall/column/arch/pillar pieces. One zone's kit can serve 4-5 dungeons via lighting + dressing variation
- **Decals** for grime, posters, banners — adds storytelling without geometry cost
- **Vegetation** — grass shader (simple wind-billboard), trees with cards
- **Volumetric fog** — Babylon's `VolumetricLightScatteringPostProcess`
- **Time-of-day cycle** — affects every zone's LUT + lighting
- **Reflection probes** — per-zone cubemaps for proper highlights
- **Particle authoring** — proper combat VFX, Aspect-specific impact bursts

**Visible win:** legitimate AAA-feeling indie. Comparable to Genshin's launch quality, not its current quality.

---

## What I can ship *right now* (next commit)

Concrete Tier 1 work that lifts the existing scene:

1. Apply `applyStylizedToMesh()` to every character avatar's body, head, hair, eyes (drop StandardMaterial)
2. Apply cel shader to NPCs (same pipeline)
3. Apply cel + outline to Spire + buildings
4. Hair upgrade: replace single sphere with **6-card layered fan** (still procedural, but reads as hair)
5. Add eyebrow + eyelash cards to character heads
6. Add SSAO post-process
7. Per-zone tonemapper tweaks

That gets us 80% of the FFXIV-style "stylized realism" *visual signal* using only what we have, before any external asset work.

Then in parallel: download MakeHuman tonight, follow Tier 2 over the weekend.

---

## Asset sourcing summary (free / paid)

| Need | Free | Paid | Recommended |
|---|---|---|---|
| Base human mesh | MakeHuman | Reallusion CC4, Daz Genesis | MakeHuman → custom sculpt later |
| Stylized base | VRoid (anime) | — | VRoid for ashen variant only |
| Animations | Mixamo (1500+) | ActorCore, Animation Cocktail | Mixamo for v1 |
| Textures | Quixel Mixer, freepbr.com | Substance Painter | Substance |
| Hair | Hair-card-tool addons (Blender) | — | Custom Blender script |
| Environment kit | Quixel Megascans (free w/ epic), kenney.nl | Synty, Mixamo Studio | Quixel for hero props |
| Sound | freesound.org, Pixabay, Kevin MacLeod | — | Free for v1 |
| VO | ElevenLabs (free tier) | Voquent, Voices.com | ElevenLabs placeholder |

**Budget for FFXIV-fidelity v1:** $0 in software + ~$200-500 in commissioned animations + 200-400 hours of authoring time. Scoped, achievable, solo.
