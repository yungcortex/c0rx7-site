# Aetherwake_Skeleton — canonical character skeleton spec

All four heritage base meshes (Hjari, Sivit, Korr, Vellish) MUST rig to this
skeleton. Bone names, hierarchy, and orientation must match exactly so
animations export from one heritage and import-clean into the others.

## Hierarchy

```
root
└── hips
    ├── spine_01
    │   └── spine_02
    │       └── spine_03
    │           └── neck
    │               └── head
    │                   ├── ear_l        ← Sivit (long), Vellish (animal)
    │                   └── ear_r
    ├── shoulder_l
    │   └── upper_arm_l
    │       └── lower_arm_l
    │           └── hand_l
    │               ├── thumb_01_l → 02_l → 03_l
    │               ├── index_01_l → 02_l → 03_l
    │               ├── middle_01_l → 02_l → 03_l
    │               ├── ring_01_l → 02_l → 03_l
    │               └── pinky_01_l → 02_l → 03_l
    ├── shoulder_r ...                  ← mirror
    ├── thigh_l
    │   └── calf_l
    │       └── foot_l
    │           └── toe_l
    ├── thigh_r ...                     ← mirror
    └── tail_01                          ← Vellish only (with subBuild flag)
        └── tail_02
            └── tail_03
```

## Coordinates

- **Y-up world**, RH coordinate system (Blender's default after glTF export).
- T-pose at export: arms parallel to ground, palms facing down, feet shoulder-width.

## Bone roles

| Bone | Purpose |
|---|---|
| `root` | locomotion driver, never animated by clips |
| `hips` | pelvis, drives center-of-mass |
| `spine_01..03` | upper-body bend distribution |
| `neck`, `head` | head movement; `head` carries facial morphs |
| `shoulder_*` | clavicle |
| `upper_arm_*`, `lower_arm_*`, `hand_*` | standard arm chain |
| `thumb_/index_/middle_/ring_/pinky_*` | finger chains for grip + Aspect-channel poses |
| `thigh_*`, `calf_*`, `foot_*`, `toe_*` | leg chain |
| `tail_*` | Vellish only; physics-driven simulation in runtime |
| `ear_*` | Sivit + Vellish; animated separately for emote tells |

## Optional dynamic bones

Hair physics is handled by adding **`hair_*` chains** under `head`, simulated
at runtime by Babylon's bone physics. These are not part of the canonical
skeleton — the export script captures them but they're not required for
animation retargeting.

## Mesh requirements

- Single mesh per heritage (multi-material is fine, multi-mesh isn't).
- Skinned to `Aetherwake_Skeleton` with weights summing to 1.0 per vertex.
- Max 4 weights per vertex (glTF spec).
- Tri-budget per heritage: **≤ 18,000 tris** for v1.

## Morph targets

Mandatory morph naming convention so they bind 1:1 to the SliderBlob layout:

- `face_00` … `face_39` — 40 face blendshapes (see SliderBlob byte layout)
- `body_00` … `body_31` — 32 body blendshapes
- `expr_idle`, `expr_smile`, `expr_frown`, `expr_talk_a`, `expr_talk_e`,
  `expr_blink_l`, `expr_blink_r` — expressions, runtime-driven

A heritage doesn't need to ship all 40 face / 32 body morphs at launch — the
runtime tolerates missing morph indices. Aim for the critical ~16 face + 8
body morphs for v1, expand over time.
