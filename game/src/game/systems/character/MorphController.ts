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
 * Build a parametric humanoid placeholder using cel-shaded materials and
 * card-based hair. The mesh is still primitive — we'll replace with real
 * MakeHuman/Blender output in Tier 2 — but every surface is now stylized.
 *
 *   Skin / hair / outfit / eyes all use a 3-band cel shader with warm-shadow
 *   / cool-highlight tinting + Fresnel rim. Each gets an inverted-hull outline
 *   pass at half-thickness for a hand-drawn read.
 */
export function buildPlaceholderAvatar(scene: Scene): CharacterAvatar {
  const root = new TransformNode("avatar-root", scene);

  const skinMat = createCelMaterial(scene, {
    baseColor: new Color3(0.85, 0.72, 0.58),
    bands: 3,
    shadowTint: new Color3(0.55, 0.4, 0.55),
    highlightTint: new Color3(1.05, 1.0, 0.95),
    rimColor: new Color3(0.95, 0.85, 0.65),
    rimPower: 3.5,
    rimIntensity: 0.6,
    ambient: 0.32,
  });
  const hairMat = createCelMaterial(scene, {
    baseColor: new Color3(0.18, 0.1, 0.05),
    bands: 4,
    shadowTint: new Color3(0.4, 0.3, 0.5),
    highlightTint: new Color3(1.3, 1.15, 0.9),
    rimColor: new Color3(1, 0.9, 0.7),
    rimPower: 2.5,
    rimIntensity: 1.4,
    ambient: 0.22,
  });
  const browMat = createCelMaterial(scene, {
    baseColor: new Color3(0.12, 0.07, 0.04),
    bands: 2,
    rimIntensity: 0,
    ambient: 0.5,
  });
  const outfitTopMat = createCelMaterial(scene, {
    baseColor: new Color3(0.32, 0.22, 0.36),
    bands: 3,
    shadowTint: new Color3(0.4, 0.25, 0.5),
    highlightTint: new Color3(1.05, 1.0, 1.05),
    rimColor: new Color3(0.6, 0.7, 1.0),
    rimPower: 3,
    rimIntensity: 0.5,
    ambient: 0.25,
  });
  const outfitBottomMat = createCelMaterial(scene, {
    baseColor: new Color3(0.18, 0.13, 0.22),
    bands: 3,
    shadowTint: new Color3(0.3, 0.2, 0.4),
    highlightTint: new Color3(1.0, 0.95, 1.0),
    rimColor: new Color3(0.5, 0.6, 0.9),
    rimPower: 3,
    rimIntensity: 0.45,
    ambient: 0.22,
  });
  const eyeMatL = createCelMaterial(scene, {
    baseColor: new Color3(0.18, 0.32, 0.45),
    bands: 2,
    rimColor: new Color3(0.4, 0.8, 1),
    rimIntensity: 1.2,
    ambient: 0.6,
  });
  const eyeMatR = createCelMaterial(scene, {
    baseColor: new Color3(0.18, 0.32, 0.45),
    bands: 2,
    rimColor: new Color3(0.4, 0.8, 1),
    rimIntensity: 1.2,
    ambient: 0.6,
  });

  const OUTLINE = { thickness: 0.018, color: new Color3(0.04, 0.02, 0.08) };

  // Torso (outfit top) — wraps the chest
  const outfitTop = MeshBuilder.CreateCapsule(
    "avatar-outfit-top",
    { radius: 0.34, height: 0.95, tessellation: 16 },
    scene,
  );
  outfitTop.parent = root;
  outfitTop.position.y = 1.2;
  outfitTop.material = outfitTopMat;
  addOutline(outfitTop, scene, OUTLINE);

  // Lower body (pants)
  const outfitBottom = MeshBuilder.CreateCapsule(
    "avatar-outfit-bottom",
    { radius: 0.3, height: 0.95, tessellation: 16 },
    scene,
  );
  outfitBottom.parent = root;
  outfitBottom.position.y = 0.55;
  outfitBottom.material = outfitBottomMat;
  addOutline(outfitBottom, scene, OUTLINE);

  // Body — bare skin around the joint between top and bottom (neck/wrists area)
  const body = MeshBuilder.CreateCapsule(
    "avatar-body",
    { radius: 0.31, height: 1.7, tessellation: 16 },
    scene,
  );
  body.parent = root;
  body.position.y = 1.0;
  body.material = skinMat;
  body.isPickable = false;
  body.visibility = 0.0; // hidden — outfit covers, but kept for proportion + outlining

  // Arms (skin) — show forearm-down
  const armL = MeshBuilder.CreateCapsule(
    "avatar-arm-l",
    { radius: 0.085, height: 0.7, tessellation: 12 },
    scene,
  );
  armL.parent = root;
  armL.position.set(-0.4, 1.05, 0);
  armL.rotation.z = 0.05;
  armL.material = skinMat;
  addOutline(armL, scene, OUTLINE);

  const armR = MeshBuilder.CreateCapsule(
    "avatar-arm-r",
    { radius: 0.085, height: 0.7, tessellation: 12 },
    scene,
  );
  armR.parent = root;
  armR.position.set(0.4, 1.05, 0);
  armR.rotation.z = -0.05;
  armR.material = skinMat;
  addOutline(armR, scene, OUTLINE);

  // Head — sphere with soft cel skin
  const head = MeshBuilder.CreateSphere("avatar-head", { diameter: 0.42, segments: 24 }, scene);
  head.parent = root;
  head.position.y = 1.95;
  head.material = skinMat;
  addOutline(head, scene, { ...OUTLINE, thickness: 0.014 });

  // Eyes — flatter discs with rim glow
  const eyeL = MeshBuilder.CreateSphere("eye-l", { diameter: 0.07, segments: 12 }, scene);
  eyeL.parent = head;
  eyeL.position.set(-0.07, 0.018, 0.175);
  eyeL.scaling.set(1, 0.7, 0.5);
  eyeL.material = eyeMatL;

  const eyeR = MeshBuilder.CreateSphere("eye-r", { diameter: 0.07, segments: 12 }, scene);
  eyeR.parent = head;
  eyeR.position.set(0.07, 0.018, 0.175);
  eyeR.scaling.set(1, 0.7, 0.5);
  eyeR.material = eyeMatR;

  // Eyebrows — small flattened cards
  const browL = MeshBuilder.CreateBox(
    "brow-l",
    { width: 0.075, height: 0.012, depth: 0.018 },
    scene,
  );
  browL.parent = head;
  browL.position.set(-0.07, 0.07, 0.19);
  browL.rotation.z = 0.18;
  browL.material = browMat;

  const browR = MeshBuilder.CreateBox(
    "brow-r",
    { width: 0.075, height: 0.012, depth: 0.018 },
    scene,
  );
  browR.parent = head;
  browR.position.set(0.07, 0.07, 0.19);
  browR.rotation.z = -0.18;
  browR.material = browMat;

  // Hair — multi-card layered fan instead of single sphere
  const hairRoot = new TransformNode("hair-root", scene);
  hairRoot.parent = root;
  hairRoot.position.y = 2.04;

  const hairCards: Mesh[] = [];
  // Crown / scalp piece
  const crown = MeshBuilder.CreateSphere(
    "hair-crown",
    { diameter: 0.46, segments: 14, slice: 0.55 },
    scene,
  );
  crown.parent = hairRoot;
  crown.scaling.set(1.05, 0.65, 1.05);
  crown.material = hairMat;
  addOutline(crown, scene, OUTLINE);
  hairCards.push(crown);

  // Side & back fringe cards (planes that fan out)
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const card = MeshBuilder.CreatePlane(
      `hair-card-${i}`,
      { width: 0.18, height: 0.36 },
      scene,
    );
    card.parent = hairRoot;
    card.position.set(Math.cos(ang) * 0.18, -0.12, Math.sin(ang) * 0.18);
    card.rotation.y = ang + Math.PI;
    card.rotation.x = -0.05;
    card.material = hairMat;
    hairCards.push(card);
  }
  // Front fringe pair (slightly forward)
  for (let i = 0; i < 3; i++) {
    const offset = (i - 1) * 0.12;
    const fringe = MeshBuilder.CreatePlane(
      `hair-fringe-${i}`,
      { width: 0.16, height: 0.22 },
      scene,
    );
    fringe.parent = hairRoot;
    fringe.position.set(offset, 0.02, 0.2);
    fringe.rotation.x = 0.4;
    fringe.material = hairMat;
    hairCards.push(fringe);
  }

  // Pivot the root so it sits on the ground (y=0)
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
