import {
  Scene,
  TransformNode,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Animation,
  DynamicTexture,
} from "@babylonjs/core";
import type { Heritage } from "@game/systems/character/SliderBlob";

/**
 * Bean character — procedural blob hero in the Fall Guys / Among Us / Pikmin
 * vein. Built entirely from primitives so the "art" IS the aesthetic, not a
 * placeholder waiting for proper character meshes.
 *
 * Anatomy:
 *   - body         oversized rounded capsule (slightly squashed)
 *   - eyes         two big white spheres + pupil discs in front
 *   - mouth        a curve drawn into a small dynamic-texture plane on the face
 *   - feet         two small spheres, animated for idle bob
 *   - hands        two small spheres at sides (optional)
 *   - ears/tail    Vellish + Sivit add small extras
 *   - hat          procedural slot above head (cosmetic)
 *   - cape         optional flat plane behind body (cosmetic)
 *   - aura         optional particle ring (cosmetic)
 *
 * Bold black inverted-hull outlines on every part = Fall Guys signature.
 */

export interface BeanLook {
  heritage: Heritage;
  bodyColor: Color3;          // primary
  patternColor?: Color3;      // accent for stripes/spots/hands/feet
  eyeColor?: Color3;          // overrides default iris colour
  pattern?: BeanPattern;
  eyeStyle: BeanEyeStyle;
  mouthStyle: BeanMouthStyle;
  hat?: BeanHatId;
  outfit?: BeanOutfitId;
  accessory?: BeanAccessoryId;
  trailColor?: Color3;
  /** physical proportion sliders, all 0..1, default 0.5 = neutral */
  proportions?: BeanProportions;
}

export interface BeanProportions {
  /** body width (X / Z scale), 0..1 ↔ 0.7..1.4 */
  width: number;
  /** body height (Y scale), 0..1 ↔ 0.7..1.4 */
  height: number;
  /** head/face plate size, 0..1 ↔ 0.75..1.3 */
  headSize: number;
  /** eye size, 0..1 ↔ 0.7..1.4 */
  eyeSize: number;
  /** eye spacing, 0..1 ↔ 0.6..1.3 */
  eyeSpacing: number;
  /** hand size, 0..1 ↔ 0.6..1.5 */
  handSize: number;
  /** foot size, 0..1 ↔ 0.6..1.5 */
  footSize: number;
  /** outline thickness scale, 0..1 ↔ 0.4..1.6 */
  outline: number;
}

export const DEFAULT_PROPORTIONS: BeanProportions = {
  width: 0.5, height: 0.5, headSize: 0.5, eyeSize: 0.5,
  eyeSpacing: 0.5, handSize: 0.5, footSize: 0.5, outline: 0.5,
};

function mix(t: number, a: number, b: number): number {
  return a + Math.max(0, Math.min(1, t)) * (b - a);
}

export type BeanPattern = "none" | "stripes" | "dots" | "split" | "gradient";
export type BeanEyeStyle = "round" | "sparkle" | "sleepy" | "angry" | "dead" | "heart" | "swirl";
export type BeanMouthStyle = "smile" | "grin" | "frown" | "gasp" | "smug" | "tongue" | "neutral";
export type BeanHatId =
  | "none"
  | "wizard"
  | "crown"
  | "propeller"
  | "helmet"
  | "horns"
  | "tophat"
  | "halo";
export type BeanOutfitId = "none" | "cape" | "scarf" | "armor" | "robe-trim" | "bowtie";
export type BeanAccessoryId = "none" | "glasses" | "monocle" | "mustache" | "earrings";

export interface Bean {
  root: TransformNode;
  body: Mesh;
  bodyMat: StandardMaterial;
  eyes: { left: Mesh; right: Mesh; pupilL: Mesh; pupilR: Mesh; };
  faceTex: DynamicTexture;
  faceMat: StandardMaterial;
  facePlane: Mesh;
  feet: Mesh[];
  hands: Mesh[];
  ears: Mesh[];
  tail: Mesh | null;
  hatRoot: TransformNode;
  outfitRoot: TransformNode;
  accessoryRoot: TransformNode;
  /** Soft elliptical drop shadow on the ground beneath the bean. */
  shadow: Mesh;
  secondaryMats: StandardMaterial[];
  eyeSizeMul: number;
  hp: HeritageProportions;
  /** Animator reads these each tick to compute squash/stretch. Updated by
   *  applyProportions whenever sliders change so animation never clobbers
   *  the user's chosen body shape. */
  bodyRestScale: Vector3;
  feetRestY: number[];
  handsRestY: number[];
  hatRestY: number;
  setLook: (look: BeanLook) => void;
  setProportions: (p: BeanProportions) => void;
  dispose: () => void;
}

interface HeritageProportions {
  bodyRX: number;       // body radius scale on X
  bodyRZ: number;       // body radius scale on Z
  bodyHeight: number;   // body height multiplier
  squash: number;       // y-scale of body sphere (1 = round, <1 = squashed)
  hasEars: boolean;
  hasTail: boolean;
  earStyle: "long" | "fluffy" | null;
  tint: Color3;         // default body tint suggestion
}

const HERITAGE_PROPS: Record<Heritage, HeritageProportions> = {
  hjari: {
    bodyRX: 1.0, bodyRZ: 1.0, bodyHeight: 1.0, squash: 1.0,
    hasEars: false, hasTail: false, earStyle: null,
    tint: new Color3(1.0, 0.78, 0.55),
  },
  sivit: {
    bodyRX: 0.85, bodyRZ: 0.85, bodyHeight: 1.25, squash: 0.95,
    hasEars: true, hasTail: false, earStyle: "long",
    tint: new Color3(0.78, 0.85, 1.0),
  },
  korr: {
    bodyRX: 1.25, bodyRZ: 1.25, bodyHeight: 0.85, squash: 1.05,
    hasEars: false, hasTail: false, earStyle: null,
    tint: new Color3(0.95, 0.62, 0.45),
  },
  vellish: {
    bodyRX: 0.95, bodyRZ: 0.95, bodyHeight: 0.95, squash: 1.0,
    hasEars: true, hasTail: true, earStyle: "fluffy",
    tint: new Color3(0.85, 0.55, 0.85),
  },
  ashen: {
    bodyRX: 0.9, bodyRZ: 0.9, bodyHeight: 1.05, squash: 1.0,
    hasEars: false, hasTail: false, earStyle: null,
    tint: new Color3(0.85, 0.92, 1.0),
  },
};

const OUTLINE_COLOR = new Color3(0.05, 0.03, 0.08);
const OUTLINE_WIDTH = 0.04;

function applyOutline(m: Mesh, w = OUTLINE_WIDTH) {
  m.renderOutline = true;
  m.outlineWidth = w;
  m.outlineColor = OUTLINE_COLOR;
}

function flatMat(scene: Scene, name: string, color: Color3, emissive = 0.04): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = color;
  mat.specularColor = new Color3(0.05, 0.05, 0.05);
  mat.emissiveColor = color.scale(emissive);
  return mat;
}

export function buildBean(scene: Scene, parent: TransformNode, look: BeanLook): Bean {
  const root = new TransformNode("bean", scene);
  root.parent = parent;

  const props = HERITAGE_PROPS[look.heritage];

  // ---- BODY (capsule, slightly squashed)
  const body = MeshBuilder.CreateCapsule(
    "bean-body",
    { radius: 0.6, height: 1.4, tessellation: 24 },
    scene,
  );
  body.parent = root;
  body.position.y = 0.85;
  body.scaling = new Vector3(
    props.bodyRX,
    props.bodyHeight * props.squash,
    props.bodyRZ,
  );
  const bodyMat = flatMat(scene, "bean-body-mat", look.bodyColor);
  body.material = bodyMat;
  applyOutline(body, OUTLINE_WIDTH);

  // ---- FACE PLATE — DynamicTexture for mouth + pattern. Rendered AFTER body
  // (renderingGroupId=1) and pushed past the inverted-hull outline so the
  // pattern + mouth never z-fight with the outline pass.
  const faceTex = new DynamicTexture(
    "bean-face-tex",
    { width: 512, height: 512 },
    scene,
    false,
  );
  faceTex.hasAlpha = true;
  const faceMat = new StandardMaterial("bean-face-mat", scene);
  faceMat.diffuseTexture = faceTex;
  faceMat.useAlphaFromDiffuseTexture = true;
  faceMat.emissiveColor = new Color3(0.85, 0.85, 0.85);
  faceMat.specularColor = new Color3(0, 0, 0);
  faceMat.disableLighting = true;
  faceMat.backFaceCulling = false;
  const facePlane = MeshBuilder.CreatePlane(
    "bean-face",
    { width: 1.2 * props.bodyRX, height: 1.3 * props.bodyHeight * props.squash },
    scene,
  );
  facePlane.parent = root;
  facePlane.position.set(0, 1.05, 0.6 * props.bodyRZ + 0.12);
  facePlane.material = faceMat;
  facePlane.isPickable = false;
  facePlane.renderingGroupId = 1;

  // ---- EYES (two big white spheres + black pupils)
  const eyeWhite = flatMat(scene, "bean-eye-white", new Color3(1, 1, 1), 0.5);
  const pupilMat = flatMat(scene, "bean-pupil", new Color3(0.04, 0.02, 0.08), 0.0);

  const eyeOffsetX = 0.22 * props.bodyRX;
  const eyeOffsetY = 1.18 * props.squash;
  const eyeOffsetZ = 0.55 * props.bodyRZ;

  const eyeL = MeshBuilder.CreateSphere(
    "bean-eye-l",
    { diameter: 0.42, segments: 18 },
    scene,
  );
  eyeL.parent = root;
  eyeL.position.set(-eyeOffsetX, eyeOffsetY, eyeOffsetZ);
  eyeL.scaling.set(1, 1.1, 0.6);
  eyeL.material = eyeWhite;
  applyOutline(eyeL, 0.025);

  const eyeR = MeshBuilder.CreateSphere(
    "bean-eye-r",
    { diameter: 0.42, segments: 18 },
    scene,
  );
  eyeR.parent = root;
  eyeR.position.set(eyeOffsetX, eyeOffsetY, eyeOffsetZ);
  eyeR.scaling.set(1, 1.1, 0.6);
  eyeR.material = eyeWhite;
  applyOutline(eyeR, 0.025);

  const pupilL = MeshBuilder.CreateSphere(
    "bean-pupil-l",
    { diameter: 0.18, segments: 12 },
    scene,
  );
  pupilL.parent = root;
  pupilL.position.set(-eyeOffsetX, eyeOffsetY, eyeOffsetZ + 0.07);
  pupilL.material = pupilMat;

  const pupilR = MeshBuilder.CreateSphere(
    "bean-pupil-r",
    { diameter: 0.18, segments: 12 },
    scene,
  );
  pupilR.parent = root;
  pupilR.position.set(eyeOffsetX, eyeOffsetY, eyeOffsetZ + 0.07);
  pupilR.material = pupilMat;

  // ---- FEET (own material so they tint with patternColor)
  const feetMat = flatMat(scene, "bean-feet-mat", OUTLINE_COLOR.scale(2.0), 0.0);
  const feet: Mesh[] = [];
  for (const side of [-1, 1] as const) {
    const foot = MeshBuilder.CreateSphere(
      `bean-foot-${side}`,
      { diameter: 0.36, segments: 14 },
      scene,
    );
    foot.parent = root;
    foot.position.set(side * 0.22 * props.bodyRX, 0.18, 0.05);
    foot.scaling.set(1.2, 0.7, 1.5);
    foot.material = feetMat;
    applyOutline(foot, 0.02);
    feet.push(foot);
  }

  // ---- HANDS (own material so they tint with patternColor)
  const handsMat = flatMat(scene, "bean-hands-mat", new Color3(1, 1, 1), 0.0);
  const hands: Mesh[] = [];
  for (const side of [-1, 1] as const) {
    const hand = MeshBuilder.CreateSphere(
      `bean-hand-${side}`,
      { diameter: 0.32, segments: 14 },
      scene,
    );
    hand.parent = root;
    hand.position.set(side * (0.55 * props.bodyRX), 0.85, 0);
    hand.material = handsMat;
    applyOutline(hand, 0.02);
    hands.push(hand);
  }

  // ---- HERITAGE EARS / TAIL — own material so they accent
  const earsMat = flatMat(scene, "bean-ears-mat", new Color3(1, 1, 1), 0.0);
  const tailMat = flatMat(scene, "bean-tail-mat", new Color3(1, 1, 1), 0.0);
  const ears: Mesh[] = [];
  if (props.hasEars && props.earStyle === "long") {
    for (const side of [-1, 1] as const) {
      const ear = MeshBuilder.CreateCapsule(
        `bean-ear-${side}`,
        { radius: 0.08, height: 0.6, tessellation: 12 },
        scene,
      );
      ear.parent = root;
      ear.position.set(side * 0.18, 1.85 * props.squash, 0);
      ear.rotation.z = side * 0.15;
      ear.material = earsMat;
      applyOutline(ear, 0.025);
      ears.push(ear);
    }
  } else if (props.hasEars && props.earStyle === "fluffy") {
    for (const side of [-1, 1] as const) {
      const ear = MeshBuilder.CreateCylinder(
        `bean-ear-${side}`,
        { diameterTop: 0, diameterBottom: 0.22, height: 0.32, tessellation: 4 },
        scene,
      );
      ear.parent = root;
      ear.position.set(side * 0.22, 1.65 * props.squash, 0);
      ear.rotation.z = side * 0.12;
      ear.material = earsMat;
      applyOutline(ear, 0.025);
      ears.push(ear);
    }
  }

  let tail: Mesh | null = null;
  if (props.hasTail) {
    tail = MeshBuilder.CreateCapsule(
      "bean-tail",
      { radius: 0.07, height: 0.4, tessellation: 10 },
      scene,
    );
    tail.parent = root;
    tail.position.set(0, 0.6, -0.55 * props.bodyRZ);
    tail.rotation.x = -0.6;
    tail.material = tailMat;
    applyOutline(tail, 0.022);
  }

  // ---- SOFT DROP SHADOW (radial-gradient disc on the ground)
  const shadowTex = new DynamicTexture("bean-shadow-tex", { width: 128, height: 128 }, scene, false);
  const sctx = shadowTex.getContext() as CanvasRenderingContext2D;
  const shadowGrad = sctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  shadowGrad.addColorStop(0, "rgba(0,0,0,0.55)");
  shadowGrad.addColorStop(0.55, "rgba(0,0,0,0.28)");
  shadowGrad.addColorStop(1, "rgba(0,0,0,0)");
  sctx.fillStyle = shadowGrad;
  sctx.fillRect(0, 0, 128, 128);
  shadowTex.hasAlpha = true;
  shadowTex.update();
  const shadowMat = new StandardMaterial("bean-shadow-mat", scene);
  shadowMat.diffuseTexture = shadowTex;
  shadowMat.useAlphaFromDiffuseTexture = true;
  shadowMat.specularColor = new Color3(0, 0, 0);
  shadowMat.emissiveColor = new Color3(0, 0, 0);
  shadowMat.disableLighting = true;
  shadowMat.backFaceCulling = false;
  const shadow = MeshBuilder.CreatePlane(
    "bean-shadow",
    { width: 1.6 * props.bodyRX, height: 1.4 * props.bodyRZ },
    scene,
  );
  shadow.parent = root;
  shadow.position.set(0, 0.02, 0); // slight Y offset to avoid z-fight with floor
  shadow.rotation.x = Math.PI / 2;
  shadow.material = shadowMat;
  shadow.isPickable = false;
  shadow.renderingGroupId = 0;

  // ---- HAT / OUTFIT / ACCESSORY ROOT NODES
  // Hat sits on top of body — initial Y matches body top with the
  // default-height capsule (will be recomputed in setProportions).
  const hatRoot = new TransformNode("bean-hat-root", scene);
  hatRoot.parent = root;
  hatRoot.position.y = 0.85 + 0.72 * props.bodyHeight * props.squash;

  const outfitRoot = new TransformNode("bean-outfit-root", scene);
  outfitRoot.parent = root;

  const accessoryRoot = new TransformNode("bean-accessory-root", scene);
  accessoryRoot.parent = root;
  accessoryRoot.position.y = 1.18 * props.squash;
  accessoryRoot.position.z = 0.6 * props.bodyRZ;

  // ---- IDLE BOB ANIMATION (squash + stretch)
  const bob = new Animation(
    "bean-bob",
    "scaling.y",
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  const baseY = props.bodyHeight * props.squash;
  bob.setKeys([
    { frame: 0, value: baseY },
    { frame: 30, value: baseY * 1.06 },
    { frame: 60, value: baseY },
    { frame: 90, value: baseY * 0.96 },
    { frame: 120, value: baseY },
  ]);
  body.animations.push(bob);
  scene.beginAnimation(body, 0, 120, true, 0.7);

  // Subtle eye-blink occasionally — squash whites every 2-4 sec
  const blink = new Animation(
    "bean-blink",
    "scaling.y",
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  blink.setKeys([
    { frame: 0, value: 1.1 },
    { frame: 60, value: 1.1 },
    { frame: 62, value: 0.1 },
    { frame: 64, value: 1.1 },
    { frame: 240, value: 1.1 },
  ]);
  eyeL.animations.push(blink);
  eyeR.animations.push(blink);
  scene.beginAnimation(eyeL, 0, 240, true, 1);
  scene.beginAnimation(eyeR, 0, 240, true, 1);

  // ---- SET LOOK (re-applies all customizable bits)
  const bean: Bean = {
    root,
    body,
    bodyMat,
    eyes: { left: eyeL, right: eyeR, pupilL, pupilR },
    faceTex,
    faceMat,
    facePlane,
    feet,
    hands,
    ears,
    tail,
    hatRoot,
    outfitRoot,
    accessoryRoot,
    shadow,
    secondaryMats: [feetMat, handsMat, earsMat, tailMat],
    eyeSizeMul: 1,
    hp: props,
    bodyRestScale: new Vector3(props.bodyRX, props.bodyHeight * props.squash, props.bodyRZ),
    feetRestY: feet.map((f) => f.position.y),
    handsRestY: hands.map((h) => h.position.y),
    hatRestY: 0.85 + 0.85 * props.bodyHeight * props.squash,
    setLook: (newLook: BeanLook) => applyBeanLook(scene, bean, newLook, props),
    setProportions: (p: BeanProportions) => applyProportions(bean, p, props),
    dispose: () => {
      faceTex.dispose();
      root.dispose();
    },
  };

  // Apply proportions FIRST so applyBeanLook's paintEyeStyle has the
  // current eyeSizeMul as a base.
  if (look.proportions) applyProportions(bean, look.proportions, props);
  applyBeanLook(scene, bean, look, props);
  return bean;
}

/**
 * Apply per-slider physical proportions to the bean. All sliders are 0..1.
 * Heritage proportions still drive the base silhouette; this is a multiplier
 * on top.
 *
 * Pupils are NOT scaled here — paintEyeStyle owns pupil shape, and uses
 * bean.eyeSizeMul as its base size so the Eye Size slider still drives
 * pupils, but the Eye Style picker can re-shape them per style.
 */
function applyProportions(bean: Bean, p: BeanProportions, hp: HeritageProportions) {
  const widthMul = mix(p.width, 0.7, 1.5);
  const heightMul = mix(p.height, 0.65, 1.55);
  const restX = hp.bodyRX * widthMul;
  const restY = hp.bodyHeight * hp.squash * heightMul;
  const restZ = hp.bodyRZ * widthMul;

  bean.body.scaling.set(restX, restY, restZ);
  bean.bodyRestScale.set(restX, restY, restZ);

  // HEAD SIZE — scales face plane AND eye whites + pupils together so the
  // whole "face area" visibly grows / shrinks. 0.6..1.5 range for impact.
  const headMul = mix(p.headSize, 0.6, 1.5);
  bean.facePlane.scaling.x = headMul;
  bean.facePlane.scaling.y = headMul;

  // EYE SIZE (independent of head) + spacing
  const eyeMul = mix(p.eyeSize, 0.6, 1.6) * headMul;
  const eyeSpread = mix(p.eyeSpacing, 0.55, 1.4);
  const baseSpread = 0.22 * hp.bodyRX * widthMul;
  bean.eyes.left.scaling.set(eyeMul, eyeMul * 1.1, eyeMul * 0.6);
  bean.eyes.right.scaling.set(eyeMul, eyeMul * 1.1, eyeMul * 0.6);
  bean.eyes.left.position.x = -baseSpread * eyeSpread;
  bean.eyes.right.position.x = baseSpread * eyeSpread;
  bean.eyes.pupilL.position.x = -baseSpread * eyeSpread;
  bean.eyes.pupilR.position.x = baseSpread * eyeSpread;
  bean.eyeSizeMul = eyeMul;

  const handMul = mix(p.handSize, 0.5, 1.7);
  bean.hands.forEach((h, i) => {
    h.scaling.set(handMul, handMul, handMul);
    h.position.x = (i === 0 ? -1 : 1) * 0.55 * restX;
  });

  const footMul = mix(p.footSize, 0.5, 1.7);
  for (const f of bean.feet) f.scaling.set(1.2 * footMul, 0.7 * footMul, 1.5 * footMul);

  const outlineMul = mix(p.outline, 0.3, 1.8);
  bean.body.outlineWidth = OUTLINE_WIDTH * outlineMul;
  for (const f of bean.feet) f.outlineWidth = 0.02 * outlineMul;
  for (const h of bean.hands) h.outlineWidth = 0.02 * outlineMul;
  for (const e of bean.ears) e.outlineWidth = 0.025 * outlineMul;
  if (bean.tail) bean.tail.outlineWidth = 0.022 * outlineMul;
  bean.eyes.left.outlineWidth = 0.025 * outlineMul;
  bean.eyes.right.outlineWidth = 0.025 * outlineMul;

  // ============== POSITION RECOMPUTES ==============
  // Body pivot at y=0.85. Capsule of height 1.4 + radius 0.6 extends ~0.7
  // above pivot at scale 1. Hat sits at ~0.72 (right at body top, no float).
  const bodyTop = 0.85 + 0.72 * restY;
  bean.hatRoot.position.y = bodyTop;
  bean.hatRestY = bodyTop;

  // Face plate pushed 0.12m past body radius — well beyond the outline
  // (~0.04m) so mouth + pattern never z-fight. renderingGroupId=1 set in
  // builder so it draws after the outline pass.
  bean.facePlane.position.z = (0.6 * restZ) + 0.12;
  bean.facePlane.position.y = 0.85 + 0.45 * restY;

  // Eyes at upper-mid body. Was 0.65 (above the head). Now 0.5.
  const eyeY = 0.85 + 0.5 * restY;
  bean.eyes.left.position.y = eyeY;
  bean.eyes.right.position.y = eyeY;
  bean.eyes.pupilL.position.y = eyeY;
  bean.eyes.pupilR.position.y = eyeY;
  bean.eyes.pupilL.position.z = (0.55 * restZ) + 0.08;
  bean.eyes.pupilR.position.z = (0.55 * restZ) + 0.08;
  bean.eyes.left.position.z = 0.55 * restZ;
  bean.eyes.right.position.z = 0.55 * restZ;

  // Hands hover at chest height — track to body height
  const handY = 0.85 * restY;
  bean.hands.forEach((h, i) => {
    h.position.y = handY;
    bean.handsRestY[i] = handY;
  });

  // Feet plant at body bottom — height-aware
  bean.feet.forEach((f, i) => {
    f.position.y = 0.18;
    bean.feetRestY[i] = 0.18;
  });

  // Shadow tracks body width
  bean.shadow.scaling.x = 1.0 + (restX - 1.0) * 0.85;
  bean.shadow.scaling.y = 1.0 + (restZ - 1.0) * 0.85;
}

function applyBeanLook(
  scene: Scene,
  bean: Bean,
  look: BeanLook,
  props: HeritageProportions,
) {
  // Body color
  bean.bodyMat.diffuseColor = look.bodyColor;
  bean.bodyMat.emissiveColor = look.bodyColor.scale(0.05);

  // Secondary tint — hands / ears / tail use patternColor if set, else body.
  // Feet stay dark by default (boot-like), tinted patternColor if user picks
  // a pattern (so the accent slider always has SOMEWHERE visible to land).
  const accent = look.patternColor ?? look.bodyColor;
  for (const h of bean.hands) {
    if (h.material instanceof StandardMaterial) {
      h.material.diffuseColor = accent;
      h.material.emissiveColor = accent.scale(0.06);
    }
  }
  for (const e of bean.ears) {
    if (e.material instanceof StandardMaterial) {
      e.material.diffuseColor = accent;
      e.material.emissiveColor = accent.scale(0.06);
    }
  }
  if (bean.tail?.material instanceof StandardMaterial) {
    bean.tail.material.diffuseColor = accent;
    bean.tail.material.emissiveColor = accent.scale(0.06);
  }
  // Feet stay grounded-dark always. (Was tinted with accent when a pattern
  // was active, which made the user think the pattern only affected feet.
  // Feet now decoupled — pattern shows on body, accent tints hands/ears/tail.)
  const feetColor = OUTLINE_COLOR.scale(2.0);
  for (const f of bean.feet) {
    if (f.material instanceof StandardMaterial) {
      f.material.diffuseColor = feetColor;
      f.material.emissiveColor = feetColor.scale(0.05);
    }
  }

  // ---- EYE COLOR override
  if (look.eyeColor) {
    if (bean.eyes.pupilL.material instanceof StandardMaterial) {
      bean.eyes.pupilL.material.diffuseColor = look.eyeColor;
      bean.eyes.pupilL.material.emissiveColor = look.eyeColor.scale(0.2);
    }
    if (bean.eyes.pupilR.material instanceof StandardMaterial) {
      bean.eyes.pupilR.material.diffuseColor = look.eyeColor;
      bean.eyes.pupilR.material.emissiveColor = look.eyeColor.scale(0.2);
    }
  }

  // ---- FACE TEXTURE (mouth + pattern)
  drawFace(bean.faceTex, look, props);

  // ---- EYE STYLE — repaint pupils
  paintEyeStyle(bean, look.eyeStyle);

  // ---- HAT
  bean.hatRoot.getChildMeshes().forEach((m) => m.dispose());
  bean.hatRoot.getChildren().forEach((c) => c.dispose());
  if (look.hat && look.hat !== "none") {
    buildHat(scene, bean.hatRoot, look.hat);
  }

  // ---- OUTFIT
  bean.outfitRoot.getChildMeshes().forEach((m) => m.dispose());
  bean.outfitRoot.getChildren().forEach((c) => c.dispose());
  if (look.outfit && look.outfit !== "none") {
    buildOutfit(scene, bean.outfitRoot, look.outfit, props);
  }

  // ---- ACCESSORY
  bean.accessoryRoot.getChildMeshes().forEach((m) => m.dispose());
  bean.accessoryRoot.getChildren().forEach((c) => c.dispose());
  if (look.accessory && look.accessory !== "none") {
    buildAccessory(scene, bean.accessoryRoot, look.accessory);
  }
}

// ============== FACE TEXTURE ==============

function drawFace(tex: DynamicTexture, look: BeanLook, _props: HeritageProportions) {
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const W = 512;
  const H = 512;
  ctx.clearRect(0, 0, W, H);

  // PATTERN — drawn first so mouth sits on top
  if (look.pattern && look.pattern !== "none") {
    drawPattern(ctx, look.pattern, look.bodyColor, look.patternColor ?? new Color3(1, 1, 1), W, H);
  }

  // MOUTH
  drawMouth(ctx, look.mouthStyle, W, H);

  tex.update();
}

function drawPattern(
  ctx: CanvasRenderingContext2D,
  pattern: BeanPattern,
  _body: Color3,
  accent: Color3,
  W: number,
  H: number,
) {
  const r = (accent.r * 255) | 0;
  const g = (accent.g * 255) | 0;
  const b = (accent.b * 255) | 0;
  const accentRgb = `rgb(${r}, ${g}, ${b})`;
  ctx.fillStyle = accentRgb;

  if (pattern === "stripes") {
    // Bigger / thicker stripes that fill more of the chest
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(0, 70 + i * 80, W, 38);
    }
  } else if (pattern === "dots") {
    // 5×4 grid of fat dots
    ctx.beginPath();
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 5; col++) {
        const x = 60 + col * 100;
        const y = 90 + row * 100;
        ctx.moveTo(x + 36, y);
        ctx.arc(x, y, 36, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  } else if (pattern === "split") {
    ctx.fillRect(0, H / 2, W, H / 2);
  } else if (pattern === "gradient") {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.3)`);
    grad.addColorStop(1, accentRgb);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawMouth(ctx: CanvasRenderingContext2D, style: BeanMouthStyle, W: number, _H: number) {
  // Bigger, thicker mouth so it reads from a distance + survives pattern overlay
  ctx.lineWidth = 26;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#0a0410";
  ctx.fillStyle = "#0a0410";
  const cx = W / 2;
  const cy = 380;

  ctx.beginPath();
  switch (style) {
    case "smile":
      ctx.arc(cx, cy - 30, 80, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      break;
    case "grin":
      ctx.arc(cx, cy - 30, 95, Math.PI * 0.05, Math.PI * 0.95);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.fillRect(cx - 75, cy + 5, 150, 22);
      ctx.fillStyle = "#0a0410";
      break;
    case "frown":
      ctx.arc(cx, cy + 60, 80, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      break;
    case "gasp":
      ctx.beginPath();
      ctx.arc(cx, cy, 38, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "smug":
      ctx.moveTo(cx - 80, cy);
      ctx.bezierCurveTo(cx - 40, cy + 22, cx + 40, cy - 22, cx + 80, cy);
      ctx.stroke();
      break;
    case "tongue":
      ctx.arc(cx, cy - 30, 80, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
      ctx.fillStyle = "#d44a6a";
      ctx.beginPath();
      ctx.arc(cx + 40, cy + 18, 26, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "neutral":
      ctx.moveTo(cx - 60, cy);
      ctx.lineTo(cx + 60, cy);
      ctx.stroke();
      break;
  }
}

// ============== EYE STYLES ==============

function paintEyeStyle(bean: Bean, style: BeanEyeStyle) {
  const { pupilL, pupilR, left, right } = bean.eyes;
  const m = bean.eyeSizeMul; // base size from proportions

  pupilL.setEnabled(true);
  pupilR.setEnabled(true);

  // Sleepy collapses both whites + pupils vertically
  if (style === "sleepy") {
    left.scaling.set(m, m * 0.55, m * 0.6);
    right.scaling.set(m, m * 0.55, m * 0.6);
    pupilL.scaling.set(m, m * 0.55, m);
    pupilR.scaling.set(m, m * 0.55, m);
    return;
  }

  // Otherwise eye-white scaling already set by applyProportions; we just
  // shape the pupils per style, scaled by m.
  switch (style) {
    case "round":
      pupilL.scaling.set(m, m, m);
      pupilR.scaling.set(m, m, m);
      break;
    case "sparkle":
      // small + bright (highlight effect)
      pupilL.scaling.set(m * 0.9, m * 0.9, m * 0.9);
      pupilR.scaling.set(m * 0.9, m * 0.9, m * 0.9);
      break;
    case "angry":
      // narrow vertical slits
      pupilL.scaling.set(m * 1.1, m * 0.55, m);
      pupilR.scaling.set(m * 1.1, m * 0.55, m);
      break;
    case "dead":
      pupilL.setEnabled(false);
      pupilR.setEnabled(false);
      break;
    case "heart":
      // Wide squat pupils — closest we get without custom geometry
      pupilL.scaling.set(m * 1.2, m * 0.95, m);
      pupilR.scaling.set(m * 1.2, m * 0.95, m);
      break;
    case "swirl":
      pupilL.scaling.set(m * 0.85, m * 0.85, m * 0.85);
      pupilR.scaling.set(m * 0.85, m * 0.85, m * 0.85);
      break;
  }
}

// ============== HATS ==============

function buildHat(scene: Scene, parent: TransformNode, hat: BeanHatId) {
  switch (hat) {
    case "wizard":
      buildWizardHat(scene, parent);
      break;
    case "crown":
      buildCrown(scene, parent);
      break;
    case "propeller":
      buildPropeller(scene, parent);
      break;
    case "helmet":
      buildHelmet(scene, parent);
      break;
    case "horns":
      buildHorns(scene, parent);
      break;
    case "tophat":
      buildTopHat(scene, parent);
      break;
    case "halo":
      buildHalo(scene, parent);
      break;
  }
}

function buildWizardHat(scene: Scene, parent: TransformNode) {
  const hat = MeshBuilder.CreateCylinder(
    "wizard-hat",
    { diameterTop: 0.0, diameterBottom: 0.65, height: 0.85, tessellation: 18 },
    scene,
  );
  hat.parent = parent;
  hat.position.y = 0.4;
  hat.material = flatMat(scene, "wizard-hat-mat", new Color3(0.18, 0.12, 0.45));
  applyOutline(hat, 0.04);

  const brim = MeshBuilder.CreateTorus("wizard-brim", { diameter: 0.85, thickness: 0.06, tessellation: 24 }, scene);
  brim.parent = parent;
  brim.position.y = 0.0;
  brim.material = hat.material;
  applyOutline(brim, 0.03);

  // Star on the side
  const star = MeshBuilder.CreatePolyhedron("wizard-star", { type: 0, size: 0.08 }, scene);
  star.parent = parent;
  star.position.set(0, 0.5, 0.32);
  star.material = flatMat(scene, "wizard-star-mat", new Color3(1, 0.85, 0.32), 0.4);
  applyOutline(star, 0.02);
}

function buildCrown(scene: Scene, parent: TransformNode) {
  const ring = MeshBuilder.CreateCylinder(
    "crown-ring",
    { diameterTop: 0.7, diameterBottom: 0.7, height: 0.18, tessellation: 18 },
    scene,
  );
  ring.parent = parent;
  ring.position.y = 0.05;
  const goldMat = flatMat(scene, "crown-gold", new Color3(1, 0.82, 0.32), 0.35);
  ring.material = goldMat;
  applyOutline(ring, 0.04);

  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    const spike = MeshBuilder.CreateCylinder(
      `crown-spike-${i}`,
      { diameterTop: 0, diameterBottom: 0.1, height: 0.18, tessellation: 6 },
      scene,
    );
    spike.parent = parent;
    spike.position.set(Math.cos(ang) * 0.35, 0.22, Math.sin(ang) * 0.35);
    spike.material = goldMat;
    applyOutline(spike, 0.025);
  }

  const gem = MeshBuilder.CreateSphere("crown-gem", { diameter: 0.1, segments: 12 }, scene);
  gem.parent = parent;
  gem.position.set(0, 0.05, 0.36);
  gem.material = flatMat(scene, "crown-gem-mat", new Color3(0.85, 0.18, 0.32), 0.4);
  applyOutline(gem, 0.02);
}

function buildPropeller(scene: Scene, parent: TransformNode) {
  const cap = MeshBuilder.CreateSphere(
    "prop-cap",
    { diameter: 0.65, segments: 16, slice: 0.5 },
    scene,
  );
  cap.parent = parent;
  cap.scaling.set(1, 0.5, 1);
  cap.position.y = 0.06;
  const stripeMat1 = flatMat(scene, "prop-cap-mat", new Color3(0.95, 0.32, 0.32));
  cap.material = stripeMat1;
  applyOutline(cap, 0.04);

  const stem = MeshBuilder.CreateCylinder(
    "prop-stem",
    { diameter: 0.08, height: 0.18, tessellation: 8 },
    scene,
  );
  stem.parent = parent;
  stem.position.y = 0.42;
  stem.material = flatMat(scene, "prop-stem-mat", new Color3(0.95, 0.85, 0.18));
  applyOutline(stem, 0.02);

  const bladeRoot = new TransformNode("prop-blade-root", scene);
  bladeRoot.parent = parent;
  bladeRoot.position.y = 0.55;

  for (let i = 0; i < 3; i++) {
    const blade = MeshBuilder.CreateBox(`prop-blade-${i}`, { width: 0.55, height: 0.04, depth: 0.1 }, scene);
    blade.parent = bladeRoot;
    blade.rotation.y = (i / 3) * Math.PI * 2;
    blade.material = flatMat(scene, "prop-blade-mat", new Color3(0.32, 0.62, 0.95));
    applyOutline(blade, 0.025);
  }

  const spin = new Animation(
    "prop-spin",
    "rotation.y",
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  spin.setKeys([{ frame: 0, value: 0 }, { frame: 30, value: Math.PI * 2 }]);
  bladeRoot.animations.push(spin);
  scene.beginAnimation(bladeRoot, 0, 30, true, 1);
}

function buildHelmet(scene: Scene, parent: TransformNode) {
  const dome = MeshBuilder.CreateSphere(
    "helmet-dome",
    { diameter: 0.85, segments: 18, slice: 0.55 },
    scene,
  );
  dome.parent = parent;
  dome.position.y = 0.05;
  dome.scaling.set(1, 0.85, 1);
  dome.material = flatMat(scene, "helmet-mat", new Color3(0.55, 0.6, 0.65), 0.1);
  applyOutline(dome, 0.04);

  // Plume
  const plume = MeshBuilder.CreateCylinder(
    "helmet-plume",
    { diameterTop: 0.1, diameterBottom: 0.18, height: 0.4, tessellation: 8 },
    scene,
  );
  plume.parent = parent;
  plume.position.y = 0.5;
  plume.material = flatMat(scene, "helmet-plume-mat", new Color3(0.85, 0.18, 0.18), 0.2);
  applyOutline(plume, 0.025);
}

function buildHorns(scene: Scene, parent: TransformNode) {
  const hornMat = flatMat(scene, "horns-mat", new Color3(0.18, 0.1, 0.18));
  for (const side of [-1, 1] as const) {
    const horn = MeshBuilder.CreateCylinder(
      `horn-${side}`,
      { diameterTop: 0, diameterBottom: 0.15, height: 0.45, tessellation: 8 },
      scene,
    );
    horn.parent = parent;
    horn.position.set(side * 0.18, 0.22, 0);
    horn.rotation.z = side * 0.4;
    horn.material = hornMat;
    applyOutline(horn, 0.025);
  }
}

function buildTopHat(scene: Scene, parent: TransformNode) {
  const cylinder = MeshBuilder.CreateCylinder(
    "top-cyl",
    { diameter: 0.5, height: 0.55, tessellation: 24 },
    scene,
  );
  cylinder.parent = parent;
  cylinder.position.y = 0.32;
  const blackMat = flatMat(scene, "top-mat", new Color3(0.1, 0.08, 0.12));
  cylinder.material = blackMat;
  applyOutline(cylinder, 0.04);

  const brim = MeshBuilder.CreateCylinder(
    "top-brim",
    { diameter: 0.85, height: 0.05, tessellation: 24 },
    scene,
  );
  brim.parent = parent;
  brim.position.y = 0.05;
  brim.material = blackMat;
  applyOutline(brim, 0.04);

  // Red band
  const band = MeshBuilder.CreateCylinder(
    "top-band",
    { diameter: 0.51, height: 0.08, tessellation: 24 },
    scene,
  );
  band.parent = parent;
  band.position.y = 0.1;
  band.material = flatMat(scene, "top-band-mat", new Color3(0.85, 0.25, 0.32));
  applyOutline(band, 0.02);
}

function buildHalo(scene: Scene, parent: TransformNode) {
  const halo = MeshBuilder.CreateTorus(
    "halo",
    { diameter: 0.65, thickness: 0.045, tessellation: 32 },
    scene,
  );
  halo.parent = parent;
  halo.position.y = 0.18;
  halo.rotation.x = Math.PI / 2;
  const goldEmissive = flatMat(scene, "halo-mat", new Color3(1, 0.95, 0.55), 0.7);
  halo.material = goldEmissive;
  applyOutline(halo, 0.025);

  const rotate = new Animation(
    "halo-rot",
    "rotation.y",
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  rotate.setKeys([{ frame: 0, value: 0 }, { frame: 360, value: Math.PI * 2 }]);
  halo.animations.push(rotate);
  scene.beginAnimation(halo, 0, 360, true, 0.5);
}

// ============== OUTFITS ==============

function buildOutfit(scene: Scene, parent: TransformNode, outfit: BeanOutfitId, props: HeritageProportions) {
  switch (outfit) {
    case "cape":
      buildCape(scene, parent, props);
      break;
    case "scarf":
      buildScarf(scene, parent, props);
      break;
    case "armor":
      buildArmor(scene, parent, props);
      break;
    case "robe-trim":
      buildRobeTrim(scene, parent, props);
      break;
    case "bowtie":
      buildBowtie(scene, parent, props);
      break;
  }
}

function buildCape(scene: Scene, parent: TransformNode, props: HeritageProportions) {
  const cape = MeshBuilder.CreatePlane("cape", { width: 1.0 * props.bodyRX, height: 1.4 * props.bodyHeight * props.squash }, scene);
  cape.parent = parent;
  cape.position.set(0, 0.85, -0.65 * props.bodyRZ);
  cape.material = flatMat(scene, "cape-mat", new Color3(0.62, 0.18, 0.22));
  applyOutline(cape, 0.03);
}

function buildScarf(scene: Scene, parent: TransformNode, props: HeritageProportions) {
  const scarf = MeshBuilder.CreateTorus("scarf", { diameter: 1.05 * props.bodyRX, thickness: 0.13, tessellation: 24 }, scene);
  scarf.parent = parent;
  scarf.position.set(0, 1.0 * props.squash, 0);
  scarf.rotation.x = Math.PI / 2;
  scarf.material = flatMat(scene, "scarf-mat", new Color3(0.95, 0.32, 0.18));
  applyOutline(scarf, 0.025);

  const tail = MeshBuilder.CreatePlane("scarf-tail", { width: 0.18, height: 0.7 }, scene);
  tail.parent = parent;
  tail.position.set(0.4, 0.65, 0.55 * props.bodyRZ);
  tail.rotation.z = -0.2;
  tail.material = scarf.material;
  applyOutline(tail, 0.025);
}

function buildArmor(scene: Scene, parent: TransformNode, props: HeritageProportions) {
  const chestplate = MeshBuilder.CreateCapsule("chestplate", { radius: 0.62 * props.bodyRX, height: 1.2 * props.bodyHeight * props.squash, tessellation: 16 }, scene);
  chestplate.parent = parent;
  chestplate.position.y = 0.92;
  chestplate.scaling.set(1.05, 0.95, 1.05);
  chestplate.material = flatMat(scene, "armor-mat", new Color3(0.55, 0.62, 0.7), 0.08);
  applyOutline(chestplate, 0.04);

  // Pauldrons
  for (const side of [-1, 1] as const) {
    const pauldron = MeshBuilder.CreateSphere(`pauldron-${side}`, { diameter: 0.35, segments: 14, slice: 0.5 }, scene);
    pauldron.parent = parent;
    pauldron.position.set(side * 0.5 * props.bodyRX, 1.3 * props.squash, 0);
    pauldron.scaling.set(1, 0.7, 1);
    pauldron.material = chestplate.material;
    applyOutline(pauldron, 0.03);
  }
}

function buildRobeTrim(scene: Scene, parent: TransformNode, props: HeritageProportions) {
  const trim = MeshBuilder.CreateTorus("robe-trim", { diameter: 1.4 * props.bodyRX, thickness: 0.08, tessellation: 32 }, scene);
  trim.parent = parent;
  trim.position.y = 0.18;
  trim.material = flatMat(scene, "robe-trim-mat", new Color3(0.85, 0.7, 0.32), 0.3);
  applyOutline(trim, 0.025);
}

function buildBowtie(scene: Scene, parent: TransformNode, props: HeritageProportions) {
  for (const side of [-1, 1] as const) {
    const bow = MeshBuilder.CreateBox(`bow-${side}`, { width: 0.18, height: 0.14, depth: 0.04 }, scene);
    bow.parent = parent;
    bow.position.set(side * 0.13, 1.0 * props.squash, 0.6 * props.bodyRZ);
    bow.rotation.z = side * 0.25;
    bow.material = flatMat(scene, "bow-mat", new Color3(0.85, 0.18, 0.32));
    applyOutline(bow, 0.02);
  }
  const knot = MeshBuilder.CreateBox("bow-knot", { width: 0.07, height: 0.1, depth: 0.05 }, scene);
  knot.parent = parent;
  knot.position.set(0, 1.0 * props.squash, 0.6 * props.bodyRZ);
  knot.material = flatMat(scene, "bow-knot-mat", new Color3(0.62, 0.1, 0.22));
  applyOutline(knot, 0.02);
}

// ============== ACCESSORIES ==============

function buildAccessory(scene: Scene, parent: TransformNode, acc: BeanAccessoryId) {
  switch (acc) {
    case "glasses":
      buildGlasses(scene, parent);
      break;
    case "monocle":
      buildMonocle(scene, parent);
      break;
    case "mustache":
      buildMustache(scene, parent);
      break;
    case "earrings":
      buildEarrings(scene, parent);
      break;
  }
}

function buildGlasses(scene: Scene, parent: TransformNode) {
  const frameMat = flatMat(scene, "glasses-frame", new Color3(0.05, 0.03, 0.08));
  for (const side of [-1, 1] as const) {
    const lens = MeshBuilder.CreateTorus(`glasses-${side}`, { diameter: 0.28, thickness: 0.025, tessellation: 24 }, scene);
    lens.parent = parent;
    lens.position.set(side * 0.16, 0, 0.1);
    lens.rotation.y = Math.PI / 2;
    lens.material = frameMat;
  }
  const bridge = MeshBuilder.CreateBox("glasses-bridge", { width: 0.06, height: 0.02, depth: 0.02 }, scene);
  bridge.parent = parent;
  bridge.position.set(0, 0, 0.1);
  bridge.material = frameMat;
}

function buildMonocle(scene: Scene, parent: TransformNode) {
  const mat = flatMat(scene, "mono-mat", new Color3(0.85, 0.7, 0.32), 0.3);
  const lens = MeshBuilder.CreateTorus("mono", { diameter: 0.32, thickness: 0.03, tessellation: 24 }, scene);
  lens.parent = parent;
  lens.position.set(0.18, 0, 0.1);
  lens.rotation.y = Math.PI / 2;
  lens.material = mat;
}

function buildMustache(scene: Scene, parent: TransformNode) {
  const mat = flatMat(scene, "stache-mat", new Color3(0.18, 0.1, 0.06));
  const stache = MeshBuilder.CreateBox("mustache", { width: 0.32, height: 0.06, depth: 0.05 }, scene);
  stache.parent = parent;
  stache.position.set(0, -0.25, 0.05);
  stache.material = mat;
  applyOutline(stache, 0.02);
}

function buildEarrings(scene: Scene, parent: TransformNode) {
  const mat = flatMat(scene, "earring-mat", new Color3(0.95, 0.85, 0.32), 0.4);
  for (const side of [-1, 1] as const) {
    const earring = MeshBuilder.CreateSphere(`earring-${side}`, { diameter: 0.06, segments: 12 }, scene);
    earring.parent = parent;
    earring.position.set(side * 0.32, -0.18, 0);
    earring.material = mat;
    applyOutline(earring, 0.02);
  }
}

// ============== DEFAULT LOOK ==============

export function defaultBeanLook(heritage: Heritage): BeanLook {
  return {
    heritage,
    bodyColor: HERITAGE_PROPS[heritage].tint,
    pattern: "none",
    eyeStyle: "round",
    mouthStyle: "smile",
    hat: "none",
    outfit: "none",
    accessory: "none",
    proportions: { ...DEFAULT_PROPORTIONS },
  };
}
