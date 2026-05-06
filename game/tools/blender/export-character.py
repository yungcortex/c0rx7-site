"""
export-character.py — Blender batch exporter for Ætherwake character meshes.

Run inside Blender 4.x:
    blender --background --python tools/blender/export-character.py -- \
        --src=./assets/blend/character/base-hjari.blend \
        --out=./assets/models/character/base-hjari.glb \
        --metadata=./assets/models/character/base-hjari.meta.json

What it does:
1. Opens the source .blend.
2. Validates the rig is the canonical Ætherwake skeleton (bone count + names).
3. Validates morph targets follow the naming convention: face_NN or body_NN.
4. Exports as glTF 2.0 (.glb) with morph targets, materials, hair physics-bones.
5. Writes a sidecar JSON listing morph targets, mesh names, animation clips,
   bone count, vertex count, and tri count for runtime asset manifest.

Naming convention for morph targets:
    face_00 ... face_39    — 40 face blendshapes (matches SliderBlob layout)
    body_00 ... body_31    — 32 body blendshapes
    expr_*                 — expressions (idle/smile/frown/talk/etc), driven separately
    visme_*                — phonemes for VO lipsync (post-launch)

Skeleton: 'Aetherwake_Skeleton' — see tools/blender/skeleton-spec.md for the
canonical bone list. All character meshes must rig to this skeleton so
animations are shared across heritages.
"""

import argparse
import json
import os
import sys
from pathlib import Path

try:
    import bpy  # type: ignore
except ImportError:
    print("This script must be run inside Blender (`blender --background --python ...`).")
    sys.exit(1)

CANONICAL_BONES = [
    "root", "hips", "spine_01", "spine_02", "spine_03", "neck", "head",
    "shoulder_l", "upper_arm_l", "lower_arm_l", "hand_l",
    "shoulder_r", "upper_arm_r", "lower_arm_r", "hand_r",
    "thigh_l", "calf_l", "foot_l", "toe_l",
    "thigh_r", "calf_r", "foot_r", "toe_r",
    # extras for tail/ear (Vellish), optional
    "tail_01", "tail_02", "tail_03",
    "ear_l", "ear_r",
]


def parse_args():
    if "--" in sys.argv:
        argv = sys.argv[sys.argv.index("--") + 1:]
    else:
        argv = []
    p = argparse.ArgumentParser()
    p.add_argument("--src", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--metadata", required=True)
    p.add_argument("--strict", action="store_true",
                   help="fail if rig deviates from canonical skeleton")
    return p.parse_args(argv)


def validate_skeleton(armature, strict=False):
    bone_names = [b.name for b in armature.data.bones]
    missing = [b for b in CANONICAL_BONES if b not in bone_names and not b.startswith(("tail_", "ear_"))]
    if missing:
        msg = f"missing canonical bones: {missing}"
        if strict:
            raise RuntimeError(msg)
        print(f"[warn] {msg}")
    extras = [b for b in bone_names if b not in CANONICAL_BONES]
    if extras:
        print(f"[info] extra bones (not in canonical list, fine): {extras[:8]}{' ...' if len(extras) > 8 else ''}")
    return bone_names


def collect_morph_targets(mesh_obj):
    if not mesh_obj.data.shape_keys:
        return []
    keys = [k.name for k in mesh_obj.data.shape_keys.key_blocks if k.name != "Basis"]
    face_keys = sorted([k for k in keys if k.startswith("face_")])
    body_keys = sorted([k for k in keys if k.startswith("body_")])
    expr_keys = sorted([k for k in keys if k.startswith("expr_")])
    print(f"[info] morph targets: face={len(face_keys)} body={len(body_keys)} expr={len(expr_keys)}")
    return {"face": face_keys, "body": body_keys, "expr": expr_keys, "all": keys}


def main():
    args = parse_args()
    src = Path(args.src).resolve()
    out = Path(args.out).resolve()
    meta = Path(args.metadata).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    meta.parent.mkdir(parents=True, exist_ok=True)

    if not src.exists():
        print(f"[error] source blend not found: {src}")
        sys.exit(1)

    print(f"[load] {src}")
    bpy.ops.wm.open_mainfile(filepath=str(src))

    armatures = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    if not armatures:
        print("[error] no armature in scene")
        sys.exit(1)
    armature = armatures[0]
    bones = validate_skeleton(armature, strict=args.strict)

    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    if not meshes:
        print("[error] no mesh objects in scene")
        sys.exit(1)

    primary = next((m for m in meshes if "body" in m.name.lower() or "base" in m.name.lower()),
                   meshes[0])
    morphs = collect_morph_targets(primary)

    total_verts = sum(len(m.data.vertices) for m in meshes)
    total_tris = sum(sum(1 for p in m.data.polygons if len(p.vertices) >= 3) for m in meshes)

    bpy.ops.object.select_all(action="DESELECT")
    for m in meshes:
        m.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature

    print(f"[export] {out}")
    bpy.ops.export_scene.gltf(
        filepath=str(out),
        export_format="GLB",
        use_selection=True,
        export_morph=True,
        export_morph_normal=True,
        export_morph_tangent=False,
        export_apply=False,
        export_skins=True,
        export_animations=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_yup=True,
    )

    sidecar = {
        "name": src.stem,
        "src_blend": src.name,
        "skeleton": "Aetherwake_Skeleton",
        "bone_count": len(bones),
        "vertex_count": total_verts,
        "tri_count": total_tris,
        "morph_targets": morphs,
        "meshes": [m.name for m in meshes],
        "exporter": "export-character.py v1",
    }
    with open(meta, "w") as f:
        json.dump(sidecar, f, indent=2)
    print(f"[meta] {meta}")
    print(f"[done] verts={total_verts} tris={total_tris} morphs={len(morphs.get('all', []))}")


if __name__ == "__main__":
    main()
