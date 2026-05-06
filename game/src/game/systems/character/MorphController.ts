import {
  Scene,
  Mesh,
  MeshBuilder,
  MorphTargetManager,
  TransformNode,
  Vector3,
  ShaderMaterial,
  Color3,
} from "@babylonjs/core";
import type { SliderState } from "@game/systems/character/SliderBlob";
import { createCelMaterial, addOutline } from "@game/shaders/celMaterial";

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
  hairRoot: TransformNode;
  hairCards: Mesh[];
  outfitTop: Mesh;
  outfitBottom: Mesh;
  eyebrows: Mesh[];
  skinMat: ShaderMaterial;
  hairMat: ShaderMaterial;
  outfitTopMat: ShaderMaterial;
  outfitBottomMat: ShaderMaterial;
  browMat: ShaderMaterial;
  eyeMatL: ShaderMaterial;
  eyeMatR: ShaderMaterial;
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
    const skinTint = baseSkin.add(new Color3(undertoneShift, 0, -undertoneShift));
    skinTint.r = Math.max(0, Math.min(1, skinTint.r));
    skinTint.g = Math.max(0, Math.min(1, skinTint.g));
    skinTint.b = Math.max(0, Math.min(1, skinTint.b));
    a.skinMat.setColor3("baseColor", skinTint);

    // ---- Hair (use first gradient stop as primary tone)
    const hairStop = state.hair.gradient[0] ?? { h: 30, s: 80, v: 32 };
    const hairColor = hsvToRgb(hairStop.h, hairStop.s, hairStop.v);
    a.hairMat.setColor3("baseColor", hairColor);
    a.browMat.setColor3("baseColor", hairColor.scale(0.7));
    a.hairRoot.scaling.set(1, 0.6 + (state.hair.density / 255) * 0.8, 1);
    a.hairRoot.setEnabled(state.hair.style > 0);

    // ---- Outfit (default neutral palette tinted by Aspect when known)
    const outfitTopColor = new Color3(0.32, 0.22, 0.36);
    const outfitBottomColor = new Color3(0.18, 0.13, 0.22);
    a.outfitTopMat.setColor3("baseColor", outfitTopColor);
    a.outfitBottomMat.setColor3("baseColor", outfitBottomColor);

    // ---- Eyes
    const lc = hsvToRgb(state.eyes.leftHsv.h, state.eyes.leftHsv.s, state.eyes.leftHsv.v);
    const rc = hsvToRgb(state.eyes.rightHsv.h, state.eyes.rightHsv.s, state.eyes.rightHsv.v);
    a.eyeMatL.setColor3("baseColor", lc);
    a.eyeMatR.setColor3("baseColor", rc);
    const glow = state.eyes.glow / 255;
    a.eyeMatL.setColor3("rimColor", lc.scale(1 + glow * 1.5));
    a.eyeMatR.setColor3("rimColor", rc.scale(1 + glow * 1.5));
    a.eyeMatL.setFloat("rimIntensity", 0.6 + glow * 1.4);
    a.eyeMatR.setFloat("rimIntensity", 0.6 + glow * 1.4);

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
 * Build a parametric humanoid placeholder with **proper anatomy** —
 * separated head/neck/torso/arms/hands/legs/feet, layered hair cards,
 * visible facial features. Total ~32 primitives. Cel-shaded with outlines.
 *
 * Forward axis is +Z. The character faces +Z by default.
 */
export function buildPlaceholderAvatar(scene: Scene): CharacterAvatar {
  const root = new TransformNode("avatar-root", scene);

  // ---- Materials
  const skinMat = createCelMaterial(scene, {
    baseColor: new Color3(0.92, 0.78, 0.62),
    bands: 3,
    shadowTint: new Color3(0.65, 0.45, 0.55),
    highlightTint: new Color3(1.08, 1.02, 0.95),
    rimColor: new Color3(1.0, 0.85, 0.65),
    rimPower: 3.5,
    rimIntensity: 0.5,
    ambient: 0.45,
  });
  const hairMat = createCelMaterial(scene, {
    baseColor: new Color3(0.22, 0.12, 0.06),
    bands: 4,
    shadowTint: new Color3(0.35, 0.25, 0.45),
    highlightTint: new Color3(1.5, 1.25, 0.95),
    rimColor: new Color3(1, 0.9, 0.7),
    rimPower: 2.2,
    rimIntensity: 1.6,
    ambient: 0.28,
  });
  const browMat = createCelMaterial(scene, {
    baseColor: new Color3(0.14, 0.07, 0.04),
    bands: 2,
    rimIntensity: 0,
    ambient: 0.6,
  });
  const lipMat = createCelMaterial(scene, {
    baseColor: new Color3(0.7, 0.35, 0.4),
    bands: 2,
    rimIntensity: 0.3,
    ambient: 0.55,
  });
  const outfitTopMat = createCelMaterial(scene, {
    baseColor: new Color3(0.4, 0.28, 0.42),
    bands: 3,
    shadowTint: new Color3(0.45, 0.3, 0.55),
    highlightTint: new Color3(1.08, 1.0, 1.08),
    rimColor: new Color3(0.65, 0.75, 1.0),
    rimPower: 3,
    rimIntensity: 0.55,
    ambient: 0.32,
  });
  const outfitBottomMat = createCelMaterial(scene, {
    baseColor: new Color3(0.22, 0.16, 0.28),
    bands: 3,
    shadowTint: new Color3(0.32, 0.22, 0.42),
    highlightTint: new Color3(1.04, 0.98, 1.04),
    rimColor: new Color3(0.55, 0.65, 0.9),
    rimPower: 3,
    rimIntensity: 0.45,
    ambient: 0.28,
  });
  const bootMat = createCelMaterial(scene, {
    baseColor: new Color3(0.12, 0.08, 0.08),
    bands: 2,
    shadowTint: new Color3(0.3, 0.2, 0.4),
    highlightTint: new Color3(1.1, 1.0, 1.0),
    rimColor: new Color3(0.6, 0.5, 0.7),
    rimIntensity: 0.5,
    ambient: 0.3,
  });
  const beltMat = createCelMaterial(scene, {
    baseColor: new Color3(0.85, 0.7, 0.32),
    bands: 3,
    rimColor: new Color3(1, 0.95, 0.7),
    rimIntensity: 1.0,
    ambient: 0.55,
  });
  const eyeMatL = createCelMaterial(scene, {
    baseColor: new Color3(0.32, 0.55, 0.75),
    bands: 2,
    rimColor: new Color3(0.5, 0.85, 1),
    rimIntensity: 1.4,
    rimPower: 1.5,
    ambient: 0.85,
  });
  const eyeMatR = createCelMaterial(scene, {
    baseColor: new Color3(0.32, 0.55, 0.75),
    bands: 2,
    rimColor: new Color3(0.5, 0.85, 1),
    rimIntensity: 1.4,
    rimPower: 1.5,
    ambient: 0.85,
  });
  const eyeWhiteMat = createCelMaterial(scene, {
    baseColor: new Color3(0.92, 0.88, 0.82),
    bands: 2,
    rimIntensity: 0,
    ambient: 0.85,
  });

  const OUTLINE_BODY = { thickness: 0.022, color: new Color3(0.04, 0.02, 0.08) };
  const OUTLINE_FACE = { thickness: 0.015, color: new Color3(0.04, 0.02, 0.08) };
  const OUTLINE_THIN = { thickness: 0.01, color: new Color3(0.04, 0.02, 0.08) };

  // ============ TORSO ============
  // Chest box (broader at top, tapered)
  const chest = MeshBuilder.CreateBox(
    "chest",
    { width: 0.56, height: 0.55, depth: 0.34 },
    scene,
  );
  chest.parent = root;
  chest.position.y = 1.32;
  chest.material = outfitTopMat;
  addOutline(chest, scene, OUTLINE_BODY);

  // Waist (narrower)
  const waist = MeshBuilder.CreateBox(
    "waist",
    { width: 0.46, height: 0.18, depth: 0.3 },
    scene,
  );
  waist.parent = root;
  waist.position.y = 0.96;
  waist.material = outfitTopMat;
  addOutline(waist, scene, OUTLINE_BODY);

  // Belt
  const belt = MeshBuilder.CreateBox(
    "belt",
    { width: 0.5, height: 0.08, depth: 0.32 },
    scene,
  );
  belt.parent = root;
  belt.position.y = 0.86;
  belt.material = beltMat;

  // Hips
  const hips = MeshBuilder.CreateBox(
    "hips",
    { width: 0.5, height: 0.18, depth: 0.32 },
    scene,
  );
  hips.parent = root;
  hips.position.y = 0.78;
  hips.material = outfitBottomMat;
  addOutline(hips, scene, OUTLINE_BODY);

  // ============ LEGS ============
  for (const side of [-1, 1] as const) {
    const thigh = MeshBuilder.CreateCapsule(
      `thigh-${side}`,
      { radius: 0.11, height: 0.5, tessellation: 12 },
      scene,
    );
    thigh.parent = root;
    thigh.position.set(side * 0.13, 0.5, 0);
    thigh.material = outfitBottomMat;
    addOutline(thigh, scene, OUTLINE_BODY);

    const calf = MeshBuilder.CreateCapsule(
      `calf-${side}`,
      { radius: 0.095, height: 0.46, tessellation: 12 },
      scene,
    );
    calf.parent = root;
    calf.position.set(side * 0.13, 0.18, 0);
    calf.material = outfitBottomMat;
    addOutline(calf, scene, OUTLINE_BODY);

    const boot = MeshBuilder.CreateBox(
      `boot-${side}`,
      { width: 0.16, height: 0.13, depth: 0.28 },
      scene,
    );
    boot.parent = root;
    boot.position.set(side * 0.13, 0.06, 0.04);
    boot.material = bootMat;
    addOutline(boot, scene, OUTLINE_BODY);
  }

  // ============ ARMS ============
  for (const side of [-1, 1] as const) {
    const shoulder = MeshBuilder.CreateSphere(
      `shoulder-${side}`,
      { diameter: 0.2, segments: 12 },
      scene,
    );
    shoulder.parent = root;
    shoulder.position.set(side * 0.34, 1.5, 0);
    shoulder.material = outfitTopMat;
    addOutline(shoulder, scene, OUTLINE_BODY);

    const upperArm = MeshBuilder.CreateCapsule(
      `upper-arm-${side}`,
      { radius: 0.085, height: 0.4, tessellation: 12 },
      scene,
    );
    upperArm.parent = root;
    upperArm.position.set(side * 0.36, 1.25, 0);
    upperArm.material = outfitTopMat;
    addOutline(upperArm, scene, OUTLINE_BODY);

    const forearm = MeshBuilder.CreateCapsule(
      `forearm-${side}`,
      { radius: 0.078, height: 0.4, tessellation: 12 },
      scene,
    );
    forearm.parent = root;
    forearm.position.set(side * 0.36, 0.95, 0);
    forearm.material = skinMat;
    addOutline(forearm, scene, OUTLINE_BODY);

    const hand = MeshBuilder.CreateBox(
      `hand-${side}`,
      { width: 0.09, height: 0.13, depth: 0.06 },
      scene,
    );
    hand.parent = root;
    hand.position.set(side * 0.36, 0.74, 0);
    hand.material = skinMat;
    addOutline(hand, scene, OUTLINE_THIN);
  }

  // ============ NECK + HEAD ============
  const neck = MeshBuilder.CreateCapsule(
    "neck",
    { radius: 0.07, height: 0.14, tessellation: 12 },
    scene,
  );
  neck.parent = root;
  neck.position.y = 1.66;
  neck.material = skinMat;

  // Head — slightly egg-shaped (taller than wide)
  const head = MeshBuilder.CreateSphere(
    "avatar-head",
    { diameterX: 0.36, diameterY: 0.42, diameterZ: 0.38, segments: 32 } as any,
    scene,
  );
  head.parent = root;
  head.position.y = 1.93;
  head.material = skinMat;
  addOutline(head, scene, OUTLINE_FACE);

  // Jaw chip — give the chin definition
  const jaw = MeshBuilder.CreateSphere(
    "jaw",
    { diameterX: 0.25, diameterY: 0.16, diameterZ: 0.22, segments: 16 } as any,
    scene,
  );
  jaw.parent = head;
  jaw.position.set(0, -0.13, 0.02);
  jaw.material = skinMat;

  // ============ FACE FEATURES ============
  // Eye whites (reads from a distance)
  const eyeWhiteL = MeshBuilder.CreateSphere(
    "eye-white-l",
    { diameterX: 0.085, diameterY: 0.05, diameterZ: 0.04, segments: 12 } as any,
    scene,
  );
  eyeWhiteL.parent = head;
  eyeWhiteL.position.set(-0.075, 0.025, 0.18);
  eyeWhiteL.material = eyeWhiteMat;

  const eyeWhiteR = MeshBuilder.CreateSphere(
    "eye-white-r",
    { diameterX: 0.085, diameterY: 0.05, diameterZ: 0.04, segments: 12 } as any,
    scene,
  );
  eyeWhiteR.parent = head;
  eyeWhiteR.position.set(0.075, 0.025, 0.18);
  eyeWhiteR.material = eyeWhiteMat;

  // Iris (bigger so it reads at distance)
  const eyeL = MeshBuilder.CreateSphere(
    "eye-l",
    { diameter: 0.05, segments: 14 },
    scene,
  );
  eyeL.parent = head;
  eyeL.position.set(-0.075, 0.025, 0.205);
  eyeL.scaling.set(1, 1, 0.4);
  eyeL.material = eyeMatL;

  const eyeR = MeshBuilder.CreateSphere(
    "eye-r",
    { diameter: 0.05, segments: 14 },
    scene,
  );
  eyeR.parent = head;
  eyeR.position.set(0.075, 0.025, 0.205);
  eyeR.scaling.set(1, 1, 0.4);
  eyeR.material = eyeMatR;

  // Eyebrows — angled cards above eyes
  const browL = MeshBuilder.CreateBox(
    "brow-l",
    { width: 0.085, height: 0.014, depth: 0.025 },
    scene,
  );
  browL.parent = head;
  browL.position.set(-0.075, 0.085, 0.21);
  browL.rotation.z = 0.18;
  browL.material = browMat;

  const browR = MeshBuilder.CreateBox(
    "brow-r",
    { width: 0.085, height: 0.014, depth: 0.025 },
    scene,
  );
  browR.parent = head;
  browR.position.set(0.075, 0.085, 0.21);
  browR.rotation.z = -0.18;
  browR.material = browMat;

  // Nose — small wedge
  const nose = MeshBuilder.CreateBox(
    "nose",
    { width: 0.04, height: 0.07, depth: 0.045 },
    scene,
  );
  nose.parent = head;
  nose.position.set(0, -0.025, 0.21);
  nose.material = skinMat;

  // Mouth — flattened ellipsoid for lips
  const mouth = MeshBuilder.CreateSphere(
    "mouth",
    { diameterX: 0.07, diameterY: 0.022, diameterZ: 0.025, segments: 12 } as any,
    scene,
  );
  mouth.parent = head;
  mouth.position.set(0, -0.08, 0.2);
  mouth.material = lipMat;

  // Ears — flatter spheres on the sides
  for (const side of [-1, 1] as const) {
    const ear = MeshBuilder.CreateSphere(
      `ear-${side}`,
      { diameterX: 0.05, diameterY: 0.1, diameterZ: 0.05, segments: 12 } as any,
      scene,
    );
    ear.parent = head;
    ear.position.set(side * 0.18, 0.0, 0);
    ear.material = skinMat;
  }

  // ============ HAIR (cards, properly placed on the back/top of head)
  const hairRoot = new TransformNode("hair-root", scene);
  hairRoot.parent = head;
  hairRoot.position.set(0, 0.05, 0);

  const hairCards: Mesh[] = [];

  // Scalp/crown — partial sphere covering top + back
  const crown = MeshBuilder.CreateSphere(
    "hair-crown",
    { diameter: 0.4, segments: 18, slice: 0.6 },
    scene,
  );
  crown.parent = hairRoot;
  crown.scaling.set(1.08, 0.85, 1.12);
  crown.position.y = 0.04;
  crown.material = hairMat;
  addOutline(crown, scene, OUTLINE_THIN);
  hairCards.push(crown);

  // Side bangs (wider, vertical cards near temples)
  for (const side of [-1, 1] as const) {
    const bang = MeshBuilder.CreatePlane(
      `hair-bang-${side}`,
      { width: 0.15, height: 0.32 },
      scene,
    );
    bang.parent = hairRoot;
    bang.position.set(side * 0.16, -0.05, 0.06);
    bang.rotation.y = side * 0.4;
    bang.rotation.x = -0.1;
    bang.material = hairMat;
    hairCards.push(bang);
  }

  // Back hair (short cape, three cards)
  for (let i = 0; i < 3; i++) {
    const back = MeshBuilder.CreatePlane(
      `hair-back-${i}`,
      { width: 0.18, height: 0.3 },
      scene,
    );
    back.parent = hairRoot;
    back.position.set((i - 1) * 0.13, -0.08, -0.16);
    back.rotation.y = Math.PI;
    back.rotation.x = -0.15;
    back.material = hairMat;
    hairCards.push(back);
  }

  // Front fringe (parted bangs across forehead)
  for (let i = 0; i < 4; i++) {
    const fringe = MeshBuilder.CreatePlane(
      `hair-fringe-${i}`,
      { width: 0.11, height: 0.16 },
      scene,
    );
    fringe.parent = hairRoot;
    fringe.position.set((i - 1.5) * 0.08, 0.06, 0.18);
    fringe.rotation.x = 0.4;
    fringe.rotation.y = (i - 1.5) * 0.15;
    fringe.material = hairMat;
    hairCards.push(fringe);
  }

  // ============ KEEP API STABLE ============
  // Body shim (kept for the typed surface; not visually significant since
  // every visible part has its own mesh). Hidden.
  const body = MeshBuilder.CreateBox("avatar-body-shim", { size: 0.01 }, scene);
  body.parent = root;
  body.visibility = 0;

  // Outfit shims pointing at chest/hips so external code can still query
  const outfitTop = chest;
  const outfitBottom = hips;

  root.position = new Vector3(0, 0, 0);

  return {
    root,
    body,
    head,
    hairRoot,
    hairCards,
    outfitTop,
    outfitBottom,
    eyebrows: [browL, browR],
    skinMat,
    hairMat,
    outfitTopMat,
    outfitBottomMat,
    browMat,
    eyeMatL,
    eyeMatR,
    morphManager: null,
    morphSetters: new Map(),
  };
}
