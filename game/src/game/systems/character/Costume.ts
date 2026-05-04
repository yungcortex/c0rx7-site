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
 * Procedural accessory layer. The base glb provides the character's body and
 * clothing; this system adds *small* heritage-distinctive props on top —
 * weapon on back, particle aura, halo, pendant — without obscuring the
 * silhouette.
 *
 * Earlier versions of this file added cylinder robes / box chestplates /
 * sphere hoods that swallowed the underlying mesh. Those are gone. We only
 * add things you'd see in a JRPG hero portrait *between* the character and
 * the camera: weapon and aura.
 */

export interface CostumeOptions {
  heritage: Heritage;
}

export interface Costume {
  root: TransformNode;
  meshes: Mesh[];
  particles: ParticleSystem[];
  dispose: () => void;
}

const ASPECT_GOLD = new Color3(0.9, 0.74, 0.32);
const COOL_BLUE = new Color3(0.45, 0.75, 1.0);
const EMBER_RED = new Color3(0.95, 0.5, 0.18);
const FOREST_GREEN = new Color3(0.6, 0.85, 0.45);
const ASH_WHITE = new Color3(0.85, 0.85, 0.92);

function makeMat(scene: Scene, name: string, color: Color3, emissive = 0.18): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  m.specularColor = color.scale(0.25);
  m.emissiveColor = color.scale(emissive);
  m.specularPower = 32;
  return m;
}

function applyOutline(mesh: Mesh, width = 0.02) {
  mesh.renderOutline = true;
  mesh.outlineWidth = width;
  mesh.outlineColor = new Color3(0.04, 0.02, 0.08);
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
      buildHjariProps(scene, root, meshes, particles);
      break;
    case "sivit":
      buildSivitProps(scene, root, meshes, particles);
      break;
    case "korr":
      buildKorrProps(scene, root, meshes, particles);
      break;
    case "vellish":
      buildVellishProps(scene, root, meshes, particles);
      break;
    case "ashen":
      buildAshenProps(scene, root, meshes, particles);
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

// ============== HJARI — Wandering Blade ==============
function buildHjariProps(scene: Scene, root: TransformNode, meshes: Mesh[], particles: ParticleSystem[]) {
  const goldMat = makeMat(scene, "hjari-gold", ASPECT_GOLD, 0.4);
  const swordMat = makeMat(scene, "hjari-blade", new Color3(0.85, 0.86, 0.95), 0.25);
  const gripMat = makeMat(scene, "hjari-grip", new Color3(0.45, 0.25, 0.15), 0.05);

  // Sheathed greatsword on back — diagonal across the shoulders
  const blade = MeshBuilder.CreateBox("hjari-blade", { width: 0.08, height: 1.2, depth: 0.04 }, scene);
  blade.parent = root;
  blade.position.set(0.18, 1.5, -0.15);
  blade.rotation.z = 0.45;
  blade.material = swordMat;
  meshes.push(blade);

  const guard = MeshBuilder.CreateBox("hjari-guard", { width: 0.28, height: 0.04, depth: 0.06 }, scene);
  guard.parent = root;
  guard.position.set(0.06, 0.95, -0.15);
  guard.rotation.z = 0.45;
  guard.material = goldMat;
  meshes.push(guard);

  const grip = MeshBuilder.CreateCylinder("hjari-grip", { diameter: 0.05, height: 0.16, tessellation: 8 }, scene);
  grip.parent = root;
  grip.position.set(-0.02, 0.85, -0.15);
  grip.rotation.z = 0.45;
  grip.material = gripMat;
  meshes.push(grip);

  const pommel = MeshBuilder.CreateSphere("hjari-pommel", { diameter: 0.07, segments: 12 }, scene);
  pommel.parent = root;
  pommel.position.set(-0.06, 0.78, -0.15);
  pommel.material = goldMat;
  meshes.push(pommel);

  particles.push(makeAuraParticles(scene, root, ASPECT_GOLD, 0.7, 0.5, 18));
}

// ============== SIVIT — Court Mage ==============
function buildSivitProps(scene: Scene, root: TransformNode, meshes: Mesh[], particles: ParticleSystem[]) {
  const staffMat = makeMat(scene, "sivit-staff", new Color3(0.32, 0.2, 0.1), 0.08);
  const crystalMat = makeMat(scene, "sivit-crystal", COOL_BLUE, 0.7);
  const orbMat = makeMat(scene, "sivit-orb", COOL_BLUE.scale(1.2), 1.0);

  // Floating staff held just outside the character's right side
  const staff = MeshBuilder.CreateCylinder(
    "sivit-staff",
    { diameterTop: 0.04, diameterBottom: 0.05, height: 1.7, tessellation: 8 },
    scene,
  );
  staff.parent = root;
  staff.position.set(0.42, 1.0, 0.05);
  staff.rotation.z = -0.04;
  staff.material = staffMat;
  meshes.push(staff);

  // Crystal head — octahedron
  const crystal = MeshBuilder.CreatePolyhedron("sivit-crystal", { type: 1, size: 0.13 }, scene);
  crystal.parent = root;
  crystal.position.set(0.42, 1.95, 0.05);
  crystal.material = crystalMat;
  meshes.push(crystal);

  const spin = new Animation(
    "sivit-crystal-spin",
    "rotation.y",
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  spin.setKeys([{ frame: 0, value: 0 }, { frame: 240, value: Math.PI * 2 }]);
  crystal.animations.push(spin);
  scene.beginAnimation(crystal, 0, 240, true, 0.7);

  // Three small orbiting orbs
  for (let i = 0; i < 3; i++) {
    const orb = MeshBuilder.CreateSphere(`sivit-orb-${i}`, { diameter: 0.05, segments: 10 }, scene);
    orb.parent = root;
    const baseAngle = (i / 3) * Math.PI * 2;
    const radius = 0.4;
    orb.position.set(Math.cos(baseAngle) * radius, 1.5 + i * 0.05, Math.sin(baseAngle) * radius);
    orb.material = orbMat;
    meshes.push(orb);

    const orbit = new Animation(
      `sivit-orbit-${i}`,
      "rotation.y",
      30,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE,
    );
    orbit.setKeys([{ frame: 0, value: 0 }, { frame: 480, value: Math.PI * 2 }]);
    orb.animations.push(orbit);
    scene.beginAnimation(orb, 0, 480, true, 0.4);
  }

  particles.push(makeAuraParticles(scene, root, COOL_BLUE, 0.9, 0.4, 22));
}

// ============== KORR — Stone-Heavy Warrior ==============
function buildKorrProps(scene: Scene, root: TransformNode, meshes: Mesh[], particles: ParticleSystem[]) {
  const hammerMat = makeMat(scene, "korr-hammer-head", new Color3(0.45, 0.45, 0.5), 0.18);
  const haftMat = makeMat(scene, "korr-haft", new Color3(0.32, 0.18, 0.08), 0.06);
  const trimMat = makeMat(scene, "korr-trim", ASPECT_GOLD, 0.35);

  // Warhammer slung diagonally across the back
  const haft = MeshBuilder.CreateCylinder(
    "korr-haft",
    { diameter: 0.06, height: 1.25, tessellation: 8 },
    scene,
  );
  haft.parent = root;
  haft.position.set(0, 1.45, -0.15);
  haft.rotation.z = 0.45;
  haft.material = haftMat;
  meshes.push(haft);

  const head = MeshBuilder.CreateBox("korr-hammer-head", { width: 0.26, height: 0.26, depth: 0.32 }, scene);
  head.parent = root;
  head.position.set(0.28, 1.95, -0.15);
  head.rotation.z = 0.45;
  head.material = hammerMat;
  meshes.push(head);

  // Hammer trim ring
  const trim = MeshBuilder.CreateTorus("korr-hammer-trim", { diameter: 0.36, thickness: 0.022, tessellation: 16 }, scene);
  trim.parent = root;
  trim.position.set(0.28, 1.95, -0.15);
  trim.rotation.x = 0;
  trim.rotation.z = 0.45;
  trim.material = trimMat;
  meshes.push(trim);

  particles.push(makeAuraParticles(scene, root, EMBER_RED, 0.8, 0.55, 28));
}

// ============== VELLISH — Walked-In Hunter ==============
function buildVellishProps(scene: Scene, root: TransformNode, meshes: Mesh[], particles: ParticleSystem[]) {
  const leatherMat = makeMat(scene, "vellish-leather", new Color3(0.32, 0.22, 0.16), 0.05);
  const fletchMat = makeMat(scene, "vellish-fletch", FOREST_GREEN, 0.2);

  // Quiver on the back
  const quiver = MeshBuilder.CreateCylinder(
    "vellish-quiver",
    { diameter: 0.16, height: 0.45, tessellation: 12 },
    scene,
  );
  quiver.parent = root;
  quiver.position.set(0.1, 1.5, -0.18);
  quiver.rotation.z = -0.4;
  quiver.material = leatherMat;
  meshes.push(quiver);

  // Three arrow shafts visible
  for (let i = 0; i < 3; i++) {
    const shaft = MeshBuilder.CreateCylinder(
      `vellish-arrow-${i}`,
      { diameter: 0.012, height: 0.36, tessellation: 6 },
      scene,
    );
    shaft.parent = root;
    shaft.position.set(0.13 + (i - 1) * 0.022, 1.85, -0.2);
    shaft.rotation.z = -0.4;
    shaft.material = leatherMat;
    meshes.push(shaft);

    // Fletching at the top
    const fletch = MeshBuilder.CreateCylinder(
      `vellish-fletch-${i}`,
      { diameterTop: 0.01, diameterBottom: 0.04, height: 0.06, tessellation: 6 },
      scene,
    );
    fletch.parent = root;
    fletch.position.set(0.16 + (i - 1) * 0.022, 2.05, -0.21);
    fletch.rotation.z = -0.4;
    fletch.material = fletchMat;
    meshes.push(fletch);
  }

  particles.push(makeLeafParticles(scene, root));
}

// ============== ASHEN — Half-Lit ==============
function buildAshenProps(scene: Scene, root: TransformNode, meshes: Mesh[], particles: ParticleSystem[]) {
  const ashenMat = makeMat(scene, "ashen-halo", ASH_WHITE, 0.65);
  const bloodMat = makeMat(scene, "ashen-pendant", new Color3(0.78, 0.18, 0.22), 0.4);

  // Floating halo ring behind the head
  const halo = MeshBuilder.CreateTorus(
    "ashen-halo",
    { diameter: 0.55, thickness: 0.02, tessellation: 32 },
    scene,
  );
  halo.parent = root;
  halo.position.set(0, 1.92, -0.12);
  halo.rotation.x = Math.PI / 2;
  halo.material = ashenMat;
  meshes.push(halo);

  const halospin = new Animation(
    "ashen-halospin",
    "rotation.y",
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  halospin.setKeys([{ frame: 0, value: 0 }, { frame: 720, value: Math.PI * 2 }]);
  halo.animations.push(halospin);
  scene.beginAnimation(halo, 0, 720, true, 0.4);

  // Crimson pendant at chest — a small octahedron
  const pendant = MeshBuilder.CreatePolyhedron("ashen-pendant", { type: 1, size: 0.06 }, scene);
  pendant.parent = root;
  pendant.position.set(0, 1.4, 0.22);
  pendant.material = bloodMat;
  meshes.push(pendant);

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
  grad.addColorStop(0.55, color.replace(/, 1\)/, ", 0.5)"));
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
  ringRadius = 0.8,
  size = 0.4,
  rate = 20,
): ParticleSystem {
  const ps = new ParticleSystem("aura", 60, scene);
  ps.particleTexture = dotTexture(
    scene,
    `rgba(${(color.r * 255) | 0}, ${(color.g * 255) | 0}, ${(color.b * 255) | 0}, 1)`,
  );
  ps.emitter = emitter as unknown as Vector3;
  ps.minEmitBox = new Vector3(-ringRadius, 0.0, -ringRadius);
  ps.maxEmitBox = new Vector3(ringRadius, 0.4, ringRadius);
  ps.color1 = new Color4(color.r, color.g, color.b, 0.7);
  ps.color2 = new Color4(color.r * 0.85, color.g * 0.85, color.b * 1.1, 0.5);
  ps.colorDead = new Color4(0, 0, 0, 0);
  ps.minSize = 0.04 * size;
  ps.maxSize = 0.14 * size;
  ps.minLifeTime = 1.4;
  ps.maxLifeTime = 2.6;
  ps.emitRate = rate;
  ps.gravity = new Vector3(0, 0.45, 0);
  ps.direction1 = new Vector3(-0.05, 0.6, -0.05);
  ps.direction2 = new Vector3(0.05, 1.0, 0.05);
  ps.minAngularSpeed = 0;
  ps.maxAngularSpeed = Math.PI;
  ps.start();
  return ps;
}

function makeLeafParticles(scene: Scene, emitter: TransformNode): ParticleSystem {
  const ps = new ParticleSystem("leaves", 50, scene);
  ps.particleTexture = dotTexture(scene, "rgba(140, 200, 90, 1)");
  ps.emitter = emitter as unknown as Vector3;
  ps.minEmitBox = new Vector3(-1.2, 2.4, -1.2);
  ps.maxEmitBox = new Vector3(1.2, 2.7, 1.2);
  ps.color1 = new Color4(0.55, 0.78, 0.35, 0.7);
  ps.color2 = new Color4(0.85, 0.7, 0.3, 0.6);
  ps.colorDead = new Color4(0.3, 0.18, 0.05, 0);
  ps.minSize = 0.04;
  ps.maxSize = 0.1;
  ps.minLifeTime = 3;
  ps.maxLifeTime = 6;
  ps.emitRate = 8;
  ps.gravity = new Vector3(0, -0.35, 0);
  ps.direction1 = new Vector3(-0.25, -0.2, -0.25);
  ps.direction2 = new Vector3(0.25, -0.5, 0.25);
  ps.start();
  return ps;
}

function makeMistParticles(scene: Scene, emitter: TransformNode): ParticleSystem {
  const ps = new ParticleSystem("mist", 80, scene);
  ps.particleTexture = dotTexture(scene, "rgba(200, 200, 220, 1)");
  ps.emitter = emitter as unknown as Vector3;
  ps.minEmitBox = new Vector3(-0.7, 0, -0.7);
  ps.maxEmitBox = new Vector3(0.7, 0.25, 0.7);
  ps.color1 = new Color4(0.85, 0.85, 0.95, 0.45);
  ps.color2 = new Color4(0.7, 0.65, 0.85, 0.35);
  ps.colorDead = new Color4(0.3, 0.3, 0.4, 0);
  ps.minSize = 0.18;
  ps.maxSize = 0.55;
  ps.minLifeTime = 2;
  ps.maxLifeTime = 4;
  ps.emitRate = 12;
  ps.gravity = new Vector3(0, 0.3, 0);
  ps.direction1 = new Vector3(-0.2, 0.5, -0.2);
  ps.direction2 = new Vector3(0.2, 1.2, 0.2);
  ps.start();
  return ps;
}
