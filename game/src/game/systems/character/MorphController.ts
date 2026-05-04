import {
  Scene,
  Mesh,
  MeshBuilder,
  MorphTargetManager,
  TransformNode,
  Vector3,
  StandardMaterial,
  Color3,
} from "@babylonjs/core";
import type { SliderState } from "@game/systems/character/SliderBlob";

/**
 * MorphController owns the visible character avatar in a scene and applies a
 * SliderState to it: morph targets, bone scales, colors.
 *
 * Phase 1 stage: we don't yet have a real glTF base mesh with baked morph
 * targets, so this implementation drives a parametric placeholder built from
 * primitives. The slider→morph mapping is named so when we swap to a real
 * mesh in Phase 1.5, only the loader changes.
 */

export interface CharacterAvatar {
  root: TransformNode;
  body: Mesh;
  head: Mesh;
  hair: Mesh;
  skinMat: StandardMaterial;
  hairMat: StandardMaterial;
  eyeMatL: StandardMaterial;
  eyeMatR: StandardMaterial;
  morphManager: MorphTargetManager | null;
  /** registry of morph-target influence setters by slider name */
  morphSetters: Map<string, (v01: number) => void>;
}

const SKIN_PALETTES: ReadonlyArray<{ rgb: [number, number, number] }> = [
  // Warm-light to deep, then cool-light to deep
  { rgb: [0.94, 0.82, 0.71] },
  { rgb: [0.91, 0.78, 0.66] },
  { rgb: [0.86, 0.72, 0.59] },
  { rgb: [0.79, 0.64, 0.5] },
  { rgb: [0.69, 0.54, 0.42] },
  { rgb: [0.58, 0.43, 0.33] },
  { rgb: [0.45, 0.32, 0.24] },
  { rgb: [0.34, 0.23, 0.18] },
  { rgb: [0.24, 0.16, 0.13] },
  { rgb: [0.16, 0.11, 0.09] },

  { rgb: [0.93, 0.84, 0.78] },
  { rgb: [0.88, 0.79, 0.74] },
  { rgb: [0.82, 0.72, 0.68] },
  { rgb: [0.74, 0.64, 0.6] },
  { rgb: [0.65, 0.55, 0.51] },
  { rgb: [0.55, 0.46, 0.43] },
  { rgb: [0.45, 0.36, 0.34] },
  { rgb: [0.35, 0.28, 0.26] },
  { rgb: [0.25, 0.2, 0.19] },
  { rgb: [0.16, 0.13, 0.13] },
];

function hsvToRgb(h: number, s: number, v: number): Color3 {
  // h: 0..255 maps to 0..360, s/v: 0..255 maps to 0..1
  const hh = (h / 255) * 360;
  const ss = s / 255;
  const vv = v / 255;
  const c = vv * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = vv - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) {
    r = c;
    g = x;
  } else if (hh < 120) {
    r = x;
    g = c;
  } else if (hh < 180) {
    g = c;
    b = x;
  } else if (hh < 240) {
    g = x;
    b = c;
  } else if (hh < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return new Color3(r + m, g + m, b + m);
}

export class MorphController {
  private avatar: CharacterAvatar | null = null;

  attach(avatar: CharacterAvatar) {
    this.avatar = avatar;
  }

  detach() {
    this.avatar = null;
  }

  apply(state: SliderState) {
    if (!this.avatar) return;
    const a = this.avatar;

    // ---- Build proportions (scale-based placeholder; real mesh will use bone scales)
    const heightScale = 0.92 + (state.height / 255) * 0.16; // 92%..108%
    const buildScale = 0.85 + (state.buildWeight / 255) * 0.3; // 85%..115%
    const muscleScale = 0.95 + (state.muscle / 255) * 0.15;

    a.root.scaling.set(buildScale, heightScale, buildScale);
    a.body.scaling.set(muscleScale, 1, muscleScale * 0.95);

    // ---- Heritage silhouette tweaks
    switch (state.heritage) {
      case "sivit":
        a.root.scaling.y *= 1.07;
        a.body.scaling.x *= 0.92;
        a.body.scaling.z *= 0.92;
        break;
      case "korr":
        if (state.subBuild === 1) {
          // Short-Korr
          a.root.scaling.set(buildScale * 0.85, heightScale * 0.78, buildScale * 0.85);
          a.body.scaling.x *= 1.18;
          a.body.scaling.z *= 1.15;
        } else {
          a.root.scaling.set(buildScale * 1.05, heritageHeight("korr", state.height), buildScale * 1.08);
          a.body.scaling.x *= 1.15;
          a.body.scaling.z *= 1.12;
        }
        break;
      case "vellish":
        a.body.scaling.x *= 0.95;
        a.body.scaling.z *= 0.95;
        break;
      case "ashen":
        a.body.scaling.x *= 0.96;
        a.body.scaling.z *= 0.96;
        break;
    }

    // ---- Body-type slider (continuous masc↔fem) — placeholder narrows hips/shoulders
    const fem = state.bodyType / 255;
    a.body.scaling.x *= 1 + (fem - 0.5) * -0.06;
    a.body.scaling.z *= 1 + (fem - 0.5) * 0.04;

    // ---- Skin
    const palette = SKIN_PALETTES[state.skin.paletteIndex] ?? SKIN_PALETTES[12]!;
    const baseSkin = new Color3(...palette.rgb);
    const undertoneShift = (state.skin.undertone - 2) * 0.04;
    const skinTint = baseSkin
      .add(new Color3(undertoneShift, 0, -undertoneShift))
      .scale(1);
    skinTint.r = Math.max(0, Math.min(1, skinTint.r));
    skinTint.g = Math.max(0, Math.min(1, skinTint.g));
    skinTint.b = Math.max(0, Math.min(1, skinTint.b));
    a.skinMat.diffuseColor = skinTint;
    a.skinMat.specularColor = skinTint.scale(0.18);

    // ---- Hair (use first gradient stop as primary tone)
    const hairStop = state.hair.gradient[0] ?? { h: 30, s: 80, v: 32 };
    const hairColor = hsvToRgb(hairStop.h, hairStop.s, hairStop.v);
    a.hairMat.diffuseColor = hairColor;
    a.hairMat.specularColor = hairColor.scale(0.15);
    a.hair.scaling.y = 0.5 + (state.hair.density / 255) * 0.8;
    a.hair.setEnabled(state.hair.style > 0);

    // ---- Eyes
    a.eyeMatL.diffuseColor = hsvToRgb(
      state.eyes.leftHsv.h,
      state.eyes.leftHsv.s,
      state.eyes.leftHsv.v,
    );
    a.eyeMatR.diffuseColor = hsvToRgb(
      state.eyes.rightHsv.h,
      state.eyes.rightHsv.s,
      state.eyes.rightHsv.v,
    );
    const glow = state.eyes.glow / 255;
    a.eyeMatL.emissiveColor = a.eyeMatL.diffuseColor.scale(glow * 0.7);
    a.eyeMatR.emissiveColor = a.eyeMatR.diffuseColor.scale(glow * 0.7);

    // ---- Morph targets (real mesh; no-op when placeholder)
    if (a.morphManager) {
      for (let i = 0; i < state.faceBlendshapes.length; i++) {
        const setter = a.morphSetters.get(`face_${i}`);
        if (setter) setter((state.faceBlendshapes[i]! - 128) / 127);
      }
      for (let i = 0; i < state.bodyBlendshapes.length; i++) {
        const setter = a.morphSetters.get(`body_${i}`);
        if (setter) setter((state.bodyBlendshapes[i]! - 128) / 127);
      }
    }
  }
}

function heritageHeight(heritage: SliderState["heritage"], heightSlider: number): number {
  // Map 0..255 to a heritage-specific height multiplier.
  const t = heightSlider / 255;
  switch (heritage) {
    case "sivit":
      return 0.99 + t * 0.18; // 0.99..1.17
    case "korr":
      return 0.78 + t * 0.18; // 0.78..0.96 (tall-korr range)
    case "vellish":
      return 0.95 + t * 0.16;
    case "ashen":
      return 0.93 + t * 0.16;
    case "hjari":
    default:
      return 0.93 + t * 0.18;
  }
}

/**
 * Build a parametric humanoid placeholder. Returns a CharacterAvatar with
 * the nodes/materials wired up so MorphController can drive it. Eventually
 * replaced by a real glTF loader pulling from assets/models/character/.
 */
export function buildPlaceholderAvatar(scene: Scene): CharacterAvatar {
  const root = new TransformNode("avatar-root", scene);

  const skinMat = new StandardMaterial("skin-mat", scene);
  skinMat.diffuseColor = new Color3(0.85, 0.72, 0.58);
  skinMat.specularColor = new Color3(0.18, 0.15, 0.12);
  skinMat.specularPower = 32;

  const hairMat = new StandardMaterial("hair-mat", scene);
  hairMat.diffuseColor = new Color3(0.18, 0.1, 0.05);
  hairMat.specularColor = new Color3(0.15, 0.08, 0.04);

  const eyeMatL = new StandardMaterial("eye-mat-l", scene);
  eyeMatL.diffuseColor = new Color3(0.18, 0.32, 0.45);
  eyeMatL.emissiveColor = new Color3(0.04, 0.08, 0.12);

  const eyeMatR = new StandardMaterial("eye-mat-r", scene);
  eyeMatR.diffuseColor = new Color3(0.18, 0.32, 0.45);
  eyeMatR.emissiveColor = new Color3(0.04, 0.08, 0.12);

  // Body — capsule
  const body = MeshBuilder.CreateCapsule(
    "avatar-body",
    { radius: 0.32, height: 1.7, tessellation: 16 },
    scene,
  );
  body.parent = root;
  body.position.y = 1.0;
  body.material = skinMat;

  // Head — sphere
  const head = MeshBuilder.CreateSphere("avatar-head", { diameter: 0.42, segments: 24 }, scene);
  head.parent = root;
  head.position.y = 1.95;
  head.material = skinMat;

  // Hair — torus + sphere top
  const hair = MeshBuilder.CreateSphere(
    "avatar-hair",
    { diameter: 0.46, segments: 16, slice: 0.6 },
    scene,
  );
  hair.parent = root;
  hair.position.y = 2.04;
  hair.scaling.y = 0.6;
  hair.material = hairMat;

  const eyeL = MeshBuilder.CreateSphere("eye-l", { diameter: 0.06 }, scene);
  eyeL.parent = head;
  eyeL.position.set(-0.07, 0.02, 0.18);
  eyeL.material = eyeMatL;

  const eyeR = MeshBuilder.CreateSphere("eye-r", { diameter: 0.06 }, scene);
  eyeR.parent = head;
  eyeR.position.set(0.07, 0.02, 0.18);
  eyeR.material = eyeMatR;

  // Pivot the root so it sits on the ground (y=0)
  root.position = new Vector3(0, 0, 0);

  return {
    root,
    body,
    head,
    hair,
    skinMat,
    hairMat,
    eyeMatL,
    eyeMatR,
    morphManager: null,
    morphSetters: new Map(),
  };
}
