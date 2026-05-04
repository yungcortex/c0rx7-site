# Blender pipeline

## Requirements

- Blender 4.0+
- Python: bundled with Blender (no extra install needed)

## Workflow

1. Author character in Blender. Rig to **Aetherwake_Skeleton** ([spec](skeleton-spec.md)).
2. Add morph targets following the `face_NN`/`body_NN` naming convention.
3. Save the .blend at `assets/blend/character/<heritage>.blend` (the `assets/blend/` dir is gitignored — these are large source files we do not commit).
4. Export to runtime format:
   ```bash
   blender --background --python tools/blender/export-character.py -- \
       --src=./assets/blend/character/base-hjari.blend \
       --out=./assets/models/character/base-hjari.glb \
       --metadata=./assets/models/character/base-hjari.meta.json
   ```
5. The exporter validates the rig + morphs and writes a sidecar JSON describing the asset.

## Asset manifest

Runtime loads characters via `assets/models/character/<name>.glb` paired with `<name>.meta.json`. The runtime asset manifest in `src/game/config/assetManifest.ts` maps heritage → glb path so swapping is one config edit.

## Pre-launch source assets (placeholders)

Until we author Ætherwake-original meshes, we use a placeholder pipeline:

- **MakeHuman 1.3+** → export an OBJ base mesh per heritage
- **Mixamo** → auto-rig + retarget (Mixamo's skeleton is *similar* but not identical to ours — the export script tolerates remappable bones)
- **Blender** → rename bones to canonical, bake in morph targets, save .blend

Once we have real Ætherwake-original assets, the pipeline stays the same; only the source .blend changes.

## Animations

Animations live in `assets/animations/<clip-name>.glb`. Use the same skeleton. Mixamo retargeting is fine for v1; we'll re-author the signature combat animations in-house.

Naming convention:
- `idle_neutral` / `idle_aspect-tempest` / `idle_aspect-choir` ...
- `walk_loop`, `run_loop`, `jump_*`, `dodge_*`
- `combat_tempest_light_01` ... `combat_tempest_heavy_03` ...
- `emote_wave`, `emote_sit`, `emote_dance_01` ...

Aspect-specific combat animations can either share the same skeleton (cheaper) or use auxiliary bones for weapon-specific poses (more expressive, costs retargeting work).
