import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  Vector3,
  TransformNode,
  Animation,
  ParticleSystem,
  Texture,
} from "@babylonjs/core";

/**
 * Bubbly Fall Guys-style decorations: balloons, banners, confetti bursts,
 * floating flags. Used by arenas to add atmosphere.
 */

function flatMat(scene: Scene, name: string, c: Color3, em = 0.15): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = c;
  m.specularColor = new Color3(0.1, 0.1, 0.1);
  m.emissiveColor = c.scale(em);
  return m;
}

const PARTY_COLORS = [
  new Color3(1.0, 0.4, 0.5),   // pink
  new Color3(1.0, 0.85, 0.32), // gold
  new Color3(0.45, 0.8, 1.0),  // sky
  new Color3(0.6, 1.0, 0.55),  // lime
  new Color3(0.85, 0.55, 1.0), // purple
  new Color3(1.0, 0.6, 0.32),  // tangerine
];

/**
 * Build a cluster of bobbing balloons attached at `anchor`. Sits in air
 * above the arena and gently sways.
 */
export function spawnBalloonCluster(
  scene: Scene,
  parent: TransformNode,
  anchor: Vector3,
  count = 5,
): TransformNode {
  const root = new TransformNode("balloon-cluster", scene);
  root.parent = parent;
  root.position.copyFrom(anchor);

  for (let i = 0; i < count; i++) {
    const colorIdx = i % PARTY_COLORS.length;
    const balloon = MeshBuilder.CreateSphere(
      `balloon-${i}`,
      { diameter: 0.8 + Math.random() * 0.3, segments: 14 },
      scene,
    );
    balloon.parent = root;
    balloon.scaling.y = 1.25;
    const xOff = (Math.random() - 0.5) * 1.5;
    const zOff = (Math.random() - 0.5) * 1.5;
    const yOff = (Math.random() - 0.5) * 1.0;
    balloon.position.set(xOff, yOff, zOff);
    balloon.material = flatMat(scene, `balloon-mat-${i}`, PARTY_COLORS[colorIdx]!, 0.3);
    balloon.renderOutline = true;
    balloon.outlineWidth = 0.025;
    balloon.outlineColor = new Color3(0.05, 0.03, 0.08);

    // Tiny knot at bottom
    const knot = MeshBuilder.CreateCylinder(
      `balloon-knot-${i}`,
      { diameterTop: 0.05, diameterBottom: 0.08, height: 0.1, tessellation: 6 },
      scene,
    );
    knot.parent = balloon;
    knot.position.y = -0.5;
    knot.material = balloon.material;

    // Bob animation — staggered phase per balloon
    const bob = new Animation(
      `balloon-bob-${i}`,
      "position.y",
      30,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE,
    );
    const baseY = balloon.position.y;
    bob.setKeys([
      { frame: 0, value: baseY },
      { frame: 60, value: baseY + 0.4 },
      { frame: 120, value: baseY },
    ]);
    balloon.animations.push(bob);
    scene.beginAnimation(balloon, 0, 120, true, 0.5 + Math.random() * 0.4);
  }

  return root;
}

/**
 * Hanging triangular bunting/flags strung between two posts.
 */
export function spawnBunting(
  scene: Scene,
  parent: TransformNode,
  startPos: Vector3,
  endPos: Vector3,
  flagCount = 12,
): TransformNode {
  const root = new TransformNode("bunting", scene);
  root.parent = parent;

  for (let i = 0; i < flagCount; i++) {
    const t = i / (flagCount - 1);
    // Catenary-ish sag: midpoint dips slightly
    const sag = Math.sin(t * Math.PI) * 0.6;
    const x = startPos.x + (endPos.x - startPos.x) * t;
    const y = startPos.y + (endPos.y - startPos.y) * t - sag;
    const z = startPos.z + (endPos.z - startPos.z) * t;

    const flag = MeshBuilder.CreateCylinder(
      `flag-${i}`,
      { diameterTop: 0, diameterBottom: 0.18, height: 0.32, tessellation: 4 },
      scene,
    );
    flag.parent = root;
    flag.position.set(x, y - 0.18, z);
    flag.rotation.x = Math.PI; // point down
    flag.material = flatMat(scene, `flag-mat-${i}`, PARTY_COLORS[i % PARTY_COLORS.length]!, 0.3);

    // Gentle wave
    const wave = new Animation(
      `flag-wave-${i}`,
      "rotation.z",
      30,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE,
    );
    wave.setKeys([
      { frame: 0, value: -0.15 },
      { frame: 60, value: 0.15 },
      { frame: 120, value: -0.15 },
    ]);
    flag.animations.push(wave);
    scene.beginAnimation(flag, 0, 120, true, 0.6 + (i % 3) * 0.2);
  }

  return root;
}

/**
 * Burst of confetti at a position — used on win / qualify moments.
 * Auto-disposes after 4s.
 */
export function spawnConfettiBurst(scene: Scene, position: Vector3): void {
  const tex = (() => {
    const cnv = document.createElement("canvas");
    cnv.width = 16;
    cnv.height = 16;
    const ctx = cnv.getContext("2d")!;
    ctx.fillStyle = "rgba(255, 255, 255, 1)";
    ctx.fillRect(0, 0, 16, 16);
    const t = new Texture(cnv.toDataURL(), scene);
    t.hasAlpha = true;
    return t;
  })();

  const ps = new ParticleSystem("confetti", 300, scene);
  ps.particleTexture = tex;
  ps.emitter = position;
  ps.minEmitBox = new Vector3(-0.2, 0, -0.2);
  ps.maxEmitBox = new Vector3(0.2, 0.2, 0.2);
  ps.color1 = new Color4(1, 0.4, 0.5, 1);
  ps.color2 = new Color4(0.45, 0.85, 1.0, 1);
  ps.colorDead = new Color4(0.6, 0.6, 0.6, 0);
  ps.minSize = 0.08;
  ps.maxSize = 0.22;
  ps.minLifeTime = 1.2;
  ps.maxLifeTime = 3.5;
  ps.emitRate = 0;
  ps.manualEmitCount = 200;
  ps.minEmitPower = 6;
  ps.maxEmitPower = 14;
  ps.gravity = new Vector3(0, -8, 0);
  ps.direction1 = new Vector3(-1, 1.5, -1);
  ps.direction2 = new Vector3(1, 4, 1);
  ps.minAngularSpeed = -Math.PI * 4;
  ps.maxAngularSpeed = Math.PI * 4;
  ps.start();
  setTimeout(() => ps.dispose(), 4500);
}

/**
 * Low-cost ambient confetti rain that runs continuously above the arena.
 * Adds party vibes without overwhelming the scene.
 */
export function spawnAmbientConfetti(
  scene: Scene,
  parent: TransformNode,
  area = 14,
): ParticleSystem {
  const tex = (() => {
    const cnv = document.createElement("canvas");
    cnv.width = 16;
    cnv.height = 16;
    const ctx = cnv.getContext("2d")!;
    ctx.fillStyle = "rgba(255,255,255,1)";
    ctx.fillRect(0, 0, 16, 16);
    const t = new Texture(cnv.toDataURL(), scene);
    t.hasAlpha = true;
    return t;
  })();
  const ps = new ParticleSystem("ambient-confetti", 80, scene);
  ps.particleTexture = tex;
  ps.emitter = parent as unknown as Vector3;
  ps.minEmitBox = new Vector3(-area, 12, -area);
  ps.maxEmitBox = new Vector3(area, 18, area);
  ps.color1 = new Color4(1, 0.55, 0.7, 0.95);
  ps.color2 = new Color4(1, 0.85, 0.4, 0.95);
  ps.colorDead = new Color4(0.6, 0.6, 0.6, 0);
  ps.minSize = 0.06;
  ps.maxSize = 0.14;
  ps.minLifeTime = 6;
  ps.maxLifeTime = 11;
  ps.emitRate = 8;
  ps.gravity = new Vector3(0, -1.4, 0);
  ps.direction1 = new Vector3(-0.4, -0.5, -0.4);
  ps.direction2 = new Vector3(0.4, -1.2, 0.4);
  ps.minAngularSpeed = -Math.PI * 2;
  ps.maxAngularSpeed = Math.PI * 2;
  ps.start();
  return ps;
}
