import {
  Scene,
  TransformNode,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  Vector3,
  ParticleSystem,
  Texture,
  Animation,
} from "@babylonjs/core";
import type { Heritage } from "@game/systems/character/SliderBlob";

/**
 * Procedural costume system. Each heritage gets a layered set of meshes
 * (cape, pauldrons, hood, ornaments, weapon) attached to the avatar root.
 * The base glb keeps its skeletal animation; the costume is a sibling layer
 * that follows root motion.
 *
 * This is the "make stock models look like JRPG heroes" trick — the same
 * Soldier/Xbot/HVGirl underneath, but visually they read as Sivit-mage and
 * Korr-warrior because of distinct silhouettes built from primitives.
 */

export interface CostumeOptions {
  heritage: Heritage;
  primaryColor?: Color3;
  accentColor?: Color3;
  metalColor?: Color3;
}

export interface Costume {
  root: TransformNode;
  meshes: Mesh[];
  particles: ParticleSystem[];
  dispose: () => void;
}

const ASPECT_GOLD = new Color3(0.85, 0.7, 0.32);
const DEEP_PURPLE = new Color3(0.32, 0.18, 0.42);
const BLOOD_RED = new Color3(0.62, 0.18, 0.22);
const FOREST_GREEN = new Color3(0.22, 0.4, 0.28);
const SHADOW_BLUE = new Color3(0.18, 0.22, 0.36);
const ASH_WHITE = new Color3(0.85, 0.85, 0.92);

function makeCelMat(scene: Scene, name: string, color: Color3, emissive = 0.12): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  m.specularColor = color.scale(0.18);
  m.emissiveColor = color.scale(emissive);
  m.specularPower = 32;
  return m;
}

function applyOutline(mesh: Mesh, width = 0.025, color = new Color3(0.04, 0.02, 0.08)) {
  mesh.renderOutline = true;
  mesh.outlineWidth = width;
  mesh.outlineColor = color;
}

export function buildCostume(
  scene: Scene,
  parent: TransformNode,
  options: CostumeOptions,
): Costume {
  const root = new TransformNode(`costume-${options.heritage}`, scene);
  root.parent = parent;

  const meshes: Mesh[] = [];
  const particles: ParticleSystem[] = [];

  switch (options.heritage) {
    case "hjari":
      buildHjariOutfit(scene, root, meshes, particles);
      break;
    case "sivit":
      buildSivitOutfit(scene, root, meshes, particles);
      break;
    case "korr":
      buildKorrOutfit(scene, root, meshes, particles);
      break;
    case "vellish":
      buildVellishOutfit(scene, root, meshes, particles);
      break;
    case "ashen":
      buildAshenOutfit(scene, root, meshes, particles);
      break;
  }

  meshes.forEach((m) => applyOutline(m));

  return {
    root,
    meshes,
    particles,
    dispose: () => {
      particles.forEach((p) => p.dispose());
      meshes.forEach((m) => m.dispose());
      root.dispose();
    },
  };
}

// ============== HJARI — Adventurer / Wandering Blade ==============
function buildHjariOutfit(scene: Scene, root: TransformNode, meshes: Mesh[], particles: ParticleSystem[]) {
  const cloakMat = makeCelMat(scene, "hjari-cloak", DEEP_PURPLE);
  const beltMat = makeCelMat(scene, "hjari-belt", new Color3(0.32, 0.2, 0.12));
  const goldMat = makeCelMat(scene, "hjari-gold", ASPECT_GOLD, 0.4);
  const swordMat = makeCelMat(scene, "hjari-sword", new Color3(0.8, 0.82, 0.92), 0.2);
  const swordGripMat = makeCelMat(scene, "hjari-grip", new Color3(0.45, 0.25, 0.15));

  // Cloak — flat mesh draping behind shoulders
  const cloak = MeshBuilder.CreatePlane("hjari-cloak", { width: 1.4, height: 1.8 }, scene);
  cloak.parent = root;
  cloak.position.set(0, 1.1, -0.25);
  cloak.rotation.x = 0.05;
  cloak.material = cloakMat;
  meshes.push(cloak);

  // Cloak collar
  const collar = MeshBuilder.CreateTorus("hjari-collar", { diameter: 0.36, thickness: 0.08, tessellation: 16 }, scene);
  collar.parent = root;
  collar.position.set(0, 1.65, 0);
  collar.rotation.x = Math.PI / 2;
  collar.material = goldMat;
  meshes.push(collar);

  // Belt
  const belt = MeshBuilder.CreateTorus("hjari-belt", { diameter: 0.62, thickness: 0.06, tessellation: 16 }, scene);
  belt.parent = root;
  belt.position.set(0, 0.95, 0);
  belt.rotation.x = Math.PI / 2;
  belt.material = beltMat;
  meshes.push(belt);

  // Belt buckle
  const buckle = MeshBuilder.CreateBox("hjari-buckle", { width: 0.12, height: 0.1, depth: 0.04 }, scene);
  buckle.parent = root;
  buckle.position.set(0, 0.95, 0.32);
  buckle.material = goldMat;
  meshes.push(buckle);

  // Sword on back — sheathed greatsword silhouette
  const swordBlade = MeshBuilder.CreateBox("hjari-blade", { width: 0.1, height: 1.4, depth: 0.05 }, scene);
  swordBlade.parent = root;
  swordBlade.position.set(0.18, 1.4, -0.32);
  swordBlade.rotation.z = 0.3;
  swordBlade.material = swordMat;
  meshes.push(swordBlade);

  const guard = MeshBuilder.CreateBox("hjari-guard", { width: 0.32, height: 0.05, depth: 0.06 }, scene);
  guard.parent = root;
  guard.position.set(0.06, 0.78, -0.32);
  guard.rotation.z = 0.3;
  guard.material = goldMat;
  meshes.push(guard);

  const grip = MeshBuilder.CreateCylinder("hjari-grip", { diameter: 0.06, height: 0.18, tessellation: 8 }, scene);
  grip.parent = root;
  grip.position.set(-0.04, 0.65, -0.32);
  grip.rotation.z = 0.3;
  grip.material = swordGripMat;
  meshes.push(grip);

  // Pauldron (single, asymmetric — adds interest)
  const pauldron = MeshBuilder.CreateSphere("hjari-pauldron", { diameter: 0.4, segments: 16, slice: 0.5 }, scene);
  pauldron.parent = root;
  pauldron.position.set(-0.32, 1.55, 0);
  pauldron.scaling.set(1, 0.7, 1);
  pauldron.rotation.z = -0.4;
  pauldron.material = goldMat;
  meshes.push(pauldron);

  particles.push(makeAuraParticles(scene, root, ASPECT_GOLD));
}

// ============== SIVIT — Court Mage / Long-Listener ==============
function buildSivitOutfit(scene: Scene, root: TransformNode, meshes: Mesh[], particles: ParticleSystem[]) {
  const robeMat = makeCelMat(scene, "sivit-robe", SHADOW_BLUE);
  const robeAccentMat = makeCelMat(scene, "sivit-accent", ASPECT_GOLD, 0.35);
  const staffMat = makeCelMat(scene, "sivit-staff", new Color3(0.3, 0.18, 0.08));
  const crystalMat = makeCelMat(scene, "sivit-crystal", new Color3(0.5, 0.85, 1.0), 0.6);

  // Long flowing robes (cylinder-skirt)
  const robe = MeshBuilder.CreateCylinder(
    "sivit-robe",
    { diameterTop: 0.7, diameterBottom: 1.4, height: 1.5, tessellation: 24 },
    scene,
  );
  robe.parent = root;
  robe.position.set(0, 0.7, 0);
  robe.material = robeMat;
  meshes.push(robe);

  // Hood
  const hood = MeshBuilder.CreateSphere(
    "sivit-hood",
    { diameter: 0.65, segments: 16, slice: 0.55 },
    scene,
  );
  hood.parent = root;
  hood.position.set(0, 1.85, -0.05);
  hood.rotation.x = 0.15;
  hood.material = robeMat;
  meshes.push(hood);

  // Hood gold trim
  const trim = MeshBuilder.CreateTorus(
    "sivit-trim",
    { diameter: 0.6, thickness: 0.04, tessellation: 24 },
    scene,
  );
  trim.parent = root;
  trim.position.set(0, 1.7, 0.08);
  trim.rotation.x = Math.PI / 2 - 0.2;
  trim.material = robeAccentMat;
  meshes.push(trim);

  // Stole (long fabric strip down the front)
  const stole = MeshBuilder.CreatePlane("sivit-stole", { width: 0.18, height: 1.3 }, scene);
  stole.parent = root;
  stole.position.set(0, 1.0, 0.32);
  stole.material = robeAccentMat;
  meshes.push(stole);

  // Staff (held in right hand area)
  const staff = MeshBuilder.CreateCylinder(
    "sivit-staff",
    { diameterTop: 0.04, diameterBottom: 0.06, height: 1.9, tessellation: 8 },
    scene,
  );
  staff.parent = root;
  staff.position.set(0.42, 1.0, 0.05);
  staff.rotation.z = -0.05;
  staff.material = staffMat;
  meshes.push(staff);

  // Staff crystal head
  const crystal = MeshBuilder.CreatePolyhedron("sivit-crystal", { type: 1, size: 0.13 }, scene);
  crystal.parent = root;
  crystal.position.set(0.42, 2.05, 0.05);
  crystal.material = crystalMat;
  meshes.push(crystal);

  // Slow rotation on the crystal
  const spin = new Animation(
    "sivit-crystal-spin",
    "rotation.y",
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  spin.setKeys([
    { frame: 0, value: 0 },
    { frame: 240, value: Math.PI * 2 },
  ]);
  crystal.animations.push(spin);
  scene.beginAnimation(crystal, 0, 240, true, 0.7);

  // Floating sparkle aura
  particles.push(makeAuraParticles(scene, root, new Color3(0.5, 0.85, 1.0), 1.4, 0.5));
}

// ============== KORR — Stone-Heavy Warrior ==============
function buildKorrOutfit(scene: Scene, root: TransformNode, meshes: Mesh[], particles: ParticleSystem[]) {
  const armorMat = makeCelMat(scene, "korr-armor", new Color3(0.38, 0.32, 0.22));
  const trimMat = makeCelMat(scene, "korr-trim", new Color3(0.7, 0.6, 0.32), 0.3);
  const hammerMat = makeCelMat(scene, "korr-hammer", new Color3(0.45, 0.45, 0.5), 0.15);
  const hammerHaftMat = makeCelMat(scene, "korr-haft", new Color3(0.32, 0.18, 0.08));

  // Large pauldrons (both shoulders, oversized)
  for (const side of [-1, 1] as const) {
    const pauldron = MeshBuilder.CreateSphere(
      `korr-pauldron-${side}`,
      { diameter: 0.6, segments: 16, slice: 0.5 },
      scene,
    );
    pauldron.parent = root;
    pauldron.position.set(side * 0.42, 1.55, 0);
    pauldron.scaling.set(1, 0.6, 1);
    pauldron.rotation.z = side * -0.3;
    pauldron.material = armorMat;
    meshes.push(pauldron);

    // Spike on top of each pauldron
    const spike = MeshBuilder.CreateCylinder(
      `korr-spike-${side}`,
      { diameterTop: 0.0, diameterBottom: 0.08, height: 0.18, tessellation: 6 },
      scene,
    );
    spike.parent = root;
    spike.position.set(side * 0.42, 1.78, 0);
    spike.material = trimMat;
    meshes.push(spike);
  }

  // Chest plate
  const chestPlate = MeshBuilder.CreateBox("korr-chest", { width: 0.7, height: 0.55, depth: 0.42 }, scene);
  chestPlate.parent = root;
  chestPlate.position.set(0, 1.3, 0);
  chestPlate.material = armorMat;
  meshes.push(chestPlate);

  // Chest emblem (round disc)
  const emblem = MeshBuilder.CreateCylinder(
    "korr-emblem",
    { diameter: 0.25, height: 0.04, tessellation: 16 },
    scene,
  );
  emblem.parent = root;
  emblem.position.set(0, 1.3, 0.22);
  emblem.rotation.x = Math.PI / 2;
  emblem.material = trimMat;
  meshes.push(emblem);

  // Heavy belt
  const belt = MeshBuilder.CreateBox("korr-belt", { width: 0.7, height: 0.12, depth: 0.42 }, scene);
  belt.parent = root;
  belt.position.set(0, 0.95, 0);
  belt.material = makeCelMat(scene, "korr-leather", new Color3(0.22, 0.14, 0.08));
  meshes.push(belt);

  // Warhammer on back — head + haft
  const haft = MeshBuilder.CreateCylinder(
    "korr-haft",
    { diameter: 0.07, height: 1.5, tessellation: 8 },
    scene,
  );
  haft.parent = root;
  haft.position.set(0, 1.4, -0.34);
  haft.rotation.z = 0.4;
  haft.material = hammerHaftMat;
  meshes.push(haft);

  const head = MeshBuilder.CreateBox("korr-hammer-head", { width: 0.32, height: 0.32, depth: 0.4 }, scene);
  head.parent = root;
  head.position.set(0.34, 2.05, -0.34);
  head.rotation.z = 0.4;
  head.material = hammerMat;
  meshes.push(head);

  // Ember-like floating particles
  particles.push(makeAuraParticles(scene, root, new Color3(0.95, 0.55, 0.18), 0.9, 0.6, 35));
}

// ============== VELLISH — Walked-In Hunter ==============
function buildVellishOutfit(scene: Scene, root: TransformNode, meshes: Mesh[], particles: ParticleSystem[]) {
  const leatherMat = makeCelMat(scene, "vellish-leather", new Color3(0.32, 0.22, 0.16));
  const greenMat = makeCelMat(scene, "vellish-green", FOREST_GREEN);
  const goldMat = makeCelMat(scene, "vellish-gold", ASPECT_GOLD, 0.3);
  const daggerMat = makeCelMat(scene, "vellish-dagger", new Color3(0.7, 0.74, 0.78), 0.18);

  // Vest / chestpiece (open V)
  const vest = MeshBuilder.CreateCapsule(
    "vellish-vest",
    { radius: 0.35, height: 0.6, tessellation: 16 },
    scene,
  );
  vest.parent = root;
  vest.position.set(0, 1.3, 0);
  vest.material = leatherMat;
  meshes.push(vest);

  // Hood (loose)
  const hood = MeshBuilder.CreateSphere(
    "vellish-hood",
    { diameter: 0.55, segments: 14, slice: 0.55 },
    scene,
  );
  hood.parent = root;
  hood.position.set(0, 1.85, -0.05);
  hood.rotation.x = 0.1;
  hood.material = greenMat;
  meshes.push(hood);

  // Quiver on back (cylinder)
  const quiver = MeshBuilder.CreateCylinder(
    "vellish-quiver",
    { diameter: 0.18, height: 0.5, tessellation: 12 },
    scene,
  );
  quiver.parent = root;
  quiver.position.set(0.15, 1.55, -0.3);
  quiver.rotation.z = -0.4;
  quiver.material = leatherMat;
  meshes.push(quiver);

  // 3 arrow shafts visible
  for (let i = 0; i < 3; i++) {
    const arrow = MeshBuilder.CreateCylinder(
      `vellish-arrow-${i}`,
      { diameter: 0.015, height: 0.3, tessellation: 6 },
      scene,
    );
    arrow.parent = root;
    arrow.position.set(0.18 + (i - 1) * 0.025, 1.85, -0.32);
    arrow.material = goldMat;
    meshes.push(arrow);
  }

  // Twin daggers at hips
  for (const side of [-1, 1] as const) {
    const blade = MeshBuilder.CreateBox(
      `vellish-dagger-${side}`,
      { width: 0.05, height: 0.28, depth: 0.025 },
      scene,
    );
    blade.parent = root;
    blade.position.set(side * 0.32, 0.85, 0.1);
    blade.rotation.z = side * 0.2;
    blade.material = daggerMat;
    meshes.push(blade);

    const handle = MeshBuilder.CreateCylinder(
      `vellish-handle-${side}`,
      { diameter: 0.04, height: 0.1, tessellation: 8 },
      scene,
    );
    handle.parent = root;
    handle.position.set(side * 0.32, 0.7, 0.1);
    handle.rotation.z = side * 0.2;
    handle.material = leatherMat;
    meshes.push(handle);
  }

  // Belt with pouches
  const belt = MeshBuilder.CreateTorus(
    "vellish-belt",
    { diameter: 0.66, thickness: 0.05, tessellation: 16 },
    scene,
  );
  belt.parent = root;
  belt.position.set(0, 0.92, 0);
  belt.rotation.x = Math.PI / 2;
  belt.material = leatherMat;
  meshes.push(belt);

  // Falling leaf particles (Nightlands-walker vibe)
  particles.push(makeLeafParticles(scene, root));
}

// ============== ASHEN — Half-Lit ==============
function buildAshenOutfit(scene: Scene, root: TransformNode, meshes: Mesh[], particles: ParticleSystem[]) {
  const shroudMat = makeCelMat(scene, "ashen-shroud", new Color3(0.18, 0.18, 0.22));
  const ashenAccent = makeCelMat(scene, "ashen-accent", ASH_WHITE, 0.5);
  const bloodMat = makeCelMat(scene, "ashen-blood", BLOOD_RED, 0.3);

  // Tattered shroud (bottom)
  const shroud = MeshBuilder.CreateCylinder(
    "ashen-shroud",
    { diameterTop: 0.6, diameterBottom: 1.2, height: 1.2, tessellation: 16 },
    scene,
  );
  shroud.parent = root;
  shroud.position.set(0, 0.75, 0);
  shroud.material = shroudMat;
  meshes.push(shroud);

  // Hood
  const hood = MeshBuilder.CreateSphere(
    "ashen-hood",
    { diameter: 0.65, segments: 14, slice: 0.55 },
    scene,
  );
  hood.parent = root;
  hood.position.set(0, 1.85, -0.05);
  hood.rotation.x = 0.15;
  hood.material = shroudMat;
  meshes.push(hood);

  // Ashen halo behind head
  const halo = MeshBuilder.CreateTorus(
    "ashen-halo",
    { diameter: 0.7, thickness: 0.025, tessellation: 32 },
    scene,
  );
  halo.parent = root;
  halo.position.set(0, 1.95, -0.15);
  halo.rotation.x = Math.PI / 2;
  halo.material = ashenAccent;
  meshes.push(halo);

  // Pendant — red gem at chest
  const pendant = MeshBuilder.CreatePolyhedron("ashen-pendant", { type: 1, size: 0.07 }, scene);
  pendant.parent = root;
  pendant.position.set(0, 1.5, 0.32);
  pendant.material = bloodMat;
  meshes.push(pendant);

  // Slow halo spin
  const halospin = new Animation(
    "ashen-halospin",
    "rotation.y",
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  halospin.setKeys([
    { frame: 0, value: 0 },
    { frame: 720, value: Math.PI * 2 },
  ]);
  halo.animations.push(halospin);
  scene.beginAnimation(halo, 0, 720, true, 0.4);

  // Ghostly mist particles
  particles.push(makeMistParticles(scene, root));
}

// ============== PARTICLE HELPERS ==============

function dotTexture(scene: Scene, color: string): Texture {
  const size = 64;
  const cnv = document.createElement("canvas");
  cnv.width = size;
  cnv.height = size;
  const ctx = cnv.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(0.5, color.replace(/, 1\)/, ", 0.6)"));
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new Texture(cnv.toDataURL(), scene);
  tex.hasAlpha = true;
  return tex;
}

function makeAuraParticles(
  scene: Scene,
  emitter: TransformNode,
  color: Color3,
  ringRadius = 1.0,
  size = 0.4,
  rate = 25,
): ParticleSystem {
  const ps = new ParticleSystem("aura", 80, scene);
  ps.particleTexture = dotTexture(
    scene,
    `rgba(${(color.r * 255) | 0}, ${(color.g * 255) | 0}, ${(color.b * 255) | 0}, 1)`,
  );
  ps.emitter = emitter as unknown as Vector3;
  ps.minEmitBox = new Vector3(-ringRadius, 0.2, -ringRadius);
  ps.maxEmitBox = new Vector3(ringRadius, 0.6, ringRadius);
  ps.color1 = new Color4(color.r, color.g, color.b, 0.7);
  ps.color2 = new Color4(color.r * 0.8, color.g * 0.8, color.b * 1.1, 0.5);
  ps.colorDead = new Color4(0, 0, 0, 0);
  ps.minSize = 0.04 * size;
  ps.maxSize = 0.16 * size;
  ps.minLifeTime = 1.2;
  ps.maxLifeTime = 2.4;
  ps.emitRate = rate;
  ps.gravity = new Vector3(0, 0.4, 0);
  ps.direction1 = new Vector3(-0.05, 0.5, -0.05);
  ps.direction2 = new Vector3(0.05, 1.0, 0.05);
  ps.minAngularSpeed = 0;
  ps.maxAngularSpeed = Math.PI;
  ps.start();
  return ps;
}

function makeLeafParticles(scene: Scene, emitter: TransformNode): ParticleSystem {
  const ps = new ParticleSystem("leaves", 60, scene);
  ps.particleTexture = dotTexture(scene, "rgba(140, 200, 90, 1)");
  ps.emitter = emitter as unknown as Vector3;
  ps.minEmitBox = new Vector3(-1.4, 2.5, -1.4);
  ps.maxEmitBox = new Vector3(1.4, 2.8, 1.4);
  ps.color1 = new Color4(0.55, 0.78, 0.35, 0.7);
  ps.color2 = new Color4(0.85, 0.7, 0.3, 0.6);
  ps.colorDead = new Color4(0.3, 0.18, 0.05, 0);
  ps.minSize = 0.05;
  ps.maxSize = 0.12;
  ps.minLifeTime = 3;
  ps.maxLifeTime = 6;
  ps.emitRate = 10;
  ps.gravity = new Vector3(0, -0.4, 0);
  ps.direction1 = new Vector3(-0.3, -0.2, -0.3);
  ps.direction2 = new Vector3(0.3, -0.5, 0.3);
  ps.start();
  return ps;
}

function makeMistParticles(scene: Scene, emitter: TransformNode): ParticleSystem {
  const ps = new ParticleSystem("mist", 100, scene);
  ps.particleTexture = dotTexture(scene, "rgba(200, 200, 220, 1)");
  ps.emitter = emitter as unknown as Vector3;
  ps.minEmitBox = new Vector3(-0.8, 0, -0.8);
  ps.maxEmitBox = new Vector3(0.8, 0.3, 0.8);
  ps.color1 = new Color4(0.85, 0.85, 0.95, 0.5);
  ps.color2 = new Color4(0.7, 0.65, 0.85, 0.4);
  ps.colorDead = new Color4(0.3, 0.3, 0.4, 0);
  ps.minSize = 0.2;
  ps.maxSize = 0.6;
  ps.minLifeTime = 2;
  ps.maxLifeTime = 4;
  ps.emitRate = 15;
  ps.gravity = new Vector3(0, 0.3, 0);
  ps.direction1 = new Vector3(-0.2, 0.5, -0.2);
  ps.direction2 = new Vector3(0.2, 1.2, 0.2);
  ps.start();
  return ps;
}
