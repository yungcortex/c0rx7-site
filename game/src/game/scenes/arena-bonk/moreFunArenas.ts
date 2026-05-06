import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  Vector3,
  TransformNode,
  Animation,
  Mesh,
  ParticleSystem,
  Texture,
} from "@babylonjs/core";
import type { ArenaSurface, DynamicHazard } from "@game/scenes/arena-bonk/arenaVariants";

/**
 * 4 more Fall Guys-style arenas:
 *   - Slime Climb:  ramp + obstacle climb with rising green slime that kills below
 *   - Roll Out:     rotating cylinders, stay on top to survive
 *   - Door Dash:    rows of doors, some fake (collide), some real (pass through)
 *   - Tail Tag:     small ring with tagged tails — solo simplification
 */

function flatMat(scene: Scene, name: string, c: Color3, em = 0.1): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = c;
  m.specularColor = new Color3(0.1, 0.1, 0.1);
  m.emissiveColor = c.scale(em);
  return m;
}

// ============== SLIME CLIMB ==============
export function buildSlimeClimb(scene: Scene): ArenaSurface {
  const root = new TransformNode("slime-climb", scene);
  scene.clearColor = new Color4(0.32, 0.62, 0.55, 1);
  scene.fogColor = new Color3(0.42, 0.72, 0.62);
  scene.fogDensity = 0.012;

  // Linear ramp climbing from z=0 → z=40, slope rising y=0 → y=8
  const SECTIONS = 8;
  const SECTION_LEN = 5;
  const RISE_PER_SECTION = 1.0;

  for (let i = 0; i < SECTIONS; i++) {
    const z = i * SECTION_LEN;
    const y = i * RISE_PER_SECTION;
    const ramp = MeshBuilder.CreateBox(
      `slime-ramp-${i}`,
      { width: 6, height: 0.6, depth: SECTION_LEN },
      scene,
    );
    ramp.parent = root;
    ramp.position.set(0, y - 0.3, z + SECTION_LEN / 2);
    ramp.rotation.x = -Math.atan2(RISE_PER_SECTION, SECTION_LEN);
    ramp.material = flatMat(
      scene,
      `slime-ramp-mat-${i}`,
      i % 2 === 0 ? new Color3(0.85, 0.55, 0.32) : new Color3(0.95, 0.65, 0.42),
    );

    // Mid-section obstacles
    if (i % 2 === 1) {
      const obstacle = MeshBuilder.CreateBox(
        `slime-obs-${i}`,
        { width: 1.2, height: 0.8, depth: 0.5 },
        scene,
      );
      obstacle.parent = root;
      const xOff = (Math.random() - 0.5) * 4;
      obstacle.position.set(xOff, y + 0.4, z + SECTION_LEN / 2);
      obstacle.material = flatMat(scene, `slime-obs-mat-${i}`, new Color3(0.95, 0.32, 0.45), 0.4);
    }
  }

  // Goal pad at top
  const goal = MeshBuilder.CreateCylinder(
    "slime-goal",
    { diameter: 4, height: 0.4, tessellation: 32 },
    scene,
  );
  goal.parent = root;
  goal.position.set(0, SECTIONS * RISE_PER_SECTION, SECTIONS * SECTION_LEN + 1);
  goal.material = flatMat(scene, "slime-goal-mat", new Color3(1, 0.85, 0.42), 0.5);

  // RISING SLIME PLANE (kills if you fall to/below it)
  const slime = MeshBuilder.CreateBox(
    "slime",
    { width: 22, height: 0.6, depth: SECTIONS * SECTION_LEN + 6 },
    scene,
  );
  slime.parent = root;
  const slimeStartY = -3;
  slime.position.set(0, slimeStartY, (SECTIONS * SECTION_LEN) / 2);
  const slimeMat = new StandardMaterial("slime-mat", scene);
  slimeMat.diffuseColor = new Color3(0.55, 1, 0.45);
  slimeMat.emissiveColor = new Color3(0.3, 0.65, 0.25);
  slimeMat.alpha = 0.85;
  slime.material = slimeMat;

  const aiSpawns: Vector3[] = [];
  for (let i = 0; i < 5; i++) aiSpawns.push(new Vector3(-2 + i, 0.5, 1.5));

  const totalLen = SECTIONS * SECTION_LEN;

  return {
    inside: (x, z) => {
      if (Math.abs(x) > 3) return false;
      if (z < 0 || z > totalLen + 3) return false;
      // Goal disc
      if (Math.hypot(x, z - (totalLen + 1)) < 2) return true;
      return true;
    },
    floorY: (_x, z) => {
      if (z >= 0 && z <= totalLen) {
        const i = Math.floor(z / SECTION_LEN);
        return i * RISE_PER_SECTION;
      }
      if (z > totalLen) return SECTIONS * RISE_PER_SECTION;
      return 0;
    },
    playerSpawn: new Vector3(0, 0.6, 1),
    aiSpawns,
    hazards: [],
    tick: (dt) => {
      // Slime rises 0.18 m/s — slow but inexorable
      slime.position.y += 0.18 * dt;
      // (kill detection handled by killFloor in BonkController via floorY)
    },
    dispose: () => root.dispose(),
  };
}

// ============== ROLL OUT ==============
export function buildRollOut(scene: Scene): ArenaSurface {
  const root = new TransformNode("roll-out", scene);
  scene.clearColor = new Color4(0.42, 0.32, 0.55, 1);
  scene.fogColor = new Color3(0.55, 0.42, 0.7);
  scene.fogDensity = 0.012;

  // 5 rotating cylinders, side by side, you stand on top
  const cylinders: { mesh: Mesh; speed: number; baseY: number }[] = [];
  const CYL_COUNT = 5;
  const CYL_RADIUS = 1.6;
  const CYL_LEN = 6;
  const GAP = 0.4;

  for (let i = 0; i < CYL_COUNT; i++) {
    const cyl = MeshBuilder.CreateCylinder(
      `roll-cyl-${i}`,
      { diameter: CYL_RADIUS * 2, height: CYL_LEN, tessellation: 24 },
      scene,
    );
    cyl.parent = root;
    cyl.rotation.z = Math.PI / 2;
    const x = (i - (CYL_COUNT - 1) / 2) * (CYL_RADIUS * 2 + GAP);
    cyl.position.set(x, 0.5, 0);
    cyl.material = flatMat(
      scene,
      `roll-mat-${i}`,
      i % 2 === 0 ? new Color3(0.95, 0.55, 0.32) : new Color3(0.85, 0.45, 0.95),
      0.2,
    );
    // Alternate spin direction; speed scales with index
    const speed = (i % 2 === 0 ? 1 : -1) * (1.5 + i * 0.3);
    cylinders.push({ mesh: cyl, speed, baseY: 0.5 });
  }

  // Surrounding death pit visual
  const pit = MeshBuilder.CreateDisc(
    "roll-pit",
    { radius: 18, tessellation: 48 },
    scene,
  );
  pit.parent = root;
  pit.rotation.x = Math.PI / 2;
  pit.position.y = -2.2;
  pit.material = flatMat(scene, "roll-pit-mat", new Color3(0.32, 0.18, 0.22), 0.04);

  const aiSpawns: Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 2;
    aiSpawns.push(new Vector3(x, 2.5, 0));
  }

  const totalWidth = CYL_COUNT * (CYL_RADIUS * 2 + GAP);

  return {
    inside: (x, z) => {
      if (Math.abs(x) > totalWidth / 2) return false;
      if (Math.abs(z) > CYL_LEN / 2) return false;
      // Find which cylinder we're on
      const xInGrid = x + totalWidth / 2;
      const cylWidth = CYL_RADIUS * 2 + GAP;
      const idx = Math.floor(xInGrid / cylWidth);
      if (idx < 0 || idx >= CYL_COUNT) return false;
      const localX = xInGrid - idx * cylWidth - CYL_RADIUS;
      // Bean has to be on the top hemisphere — within radius - 0.4
      return Math.abs(localX) < CYL_RADIUS - 0.4;
    },
    floorY: () => CYL_RADIUS + 0.5,
    playerSpawn: new Vector3(0, 3, 0),
    aiSpawns,
    hazards: [],
    tick: (dt) => {
      const t = performance.now() / 1000;
      void t;
      for (const c of cylinders) {
        c.mesh.rotation.x += c.speed * dt;
      }
    },
    dispose: () => root.dispose(),
  };
}

// ============== DOOR DASH ==============
export function buildDoorDash(scene: Scene): ArenaSurface {
  const root = new TransformNode("door-dash", scene);
  scene.clearColor = new Color4(0.45, 0.35, 0.65, 1);
  scene.fogColor = new Color3(0.55, 0.45, 0.78);
  scene.fogDensity = 0.012;

  // Long platform + 3 rows of doors. Each row has 5 doors; ~3 are real
  // (pass-through) and ~2 are fake (solid). Player figures out which by
  // running and bouncing off — Fall Guys signature.
  const platform = MeshBuilder.CreateBox(
    "dd-platform",
    { width: 16, height: 1, depth: 30 },
    scene,
  );
  platform.parent = root;
  platform.position.y = -0.5;
  platform.material = flatMat(scene, "dd-mat", new Color3(0.65, 0.55, 0.85));

  interface Door {
    mesh: Mesh;
    isReal: boolean;
    x: number;
    z: number;
  }
  const doors: Door[] = [];
  const ROWS = 3;
  for (let r = 0; r < ROWS; r++) {
    const z = -10 + r * 8;
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 3;
      // Randomize 3 of 5 to be REAL (no collision); the rest are FAKE
      const isReal = Math.random() < 0.6;
      const door = MeshBuilder.CreateBox(
        `dd-door-${r}-${i}`,
        { width: 2.4, height: 3, depth: 0.3 },
        scene,
      );
      door.parent = root;
      door.position.set(x, 1.5, z);
      door.material = flatMat(
        scene,
        `dd-door-mat-${r}-${i}`,
        isReal ? new Color3(0.42, 0.78, 0.95) : new Color3(0.95, 0.42, 0.55),
        isReal ? 0.3 : 0.2,
      );
      doors.push({ mesh: door, isReal, x, z });
    }
  }

  // Goal at the far end
  const goal = MeshBuilder.CreateCylinder(
    "dd-goal",
    { diameter: 4, height: 0.4, tessellation: 32 },
    scene,
  );
  goal.parent = root;
  goal.position.set(0, 0.2, 14);
  goal.material = flatMat(scene, "dd-goal-mat", new Color3(1, 0.85, 0.42), 0.5);

  const aiSpawns: Vector3[] = [];
  for (let i = 0; i < 5; i++) aiSpawns.push(new Vector3(-2 + i * 1.0, 1, -14));

  const hazards: DynamicHazard[] = [];

  return {
    inside: (x, z) => Math.abs(x) <= 8 && z >= -16 && z <= 16,
    floorY: () => 0,
    playerSpawn: new Vector3(0, 1, -14),
    aiSpawns,
    hazards,
    tick: () => {
      // Fake doors are hazards that knockback the player when touched
      hazards.length = 0;
      for (const d of doors) {
        if (!d.isReal) {
          hazards.push({
            pos: new Vector3(d.x, 1.5, d.z),
            radius: 1.2,
            kind: "spike",
          });
        }
      }
    },
    dispose: () => root.dispose(),
  };
}

// ============== TAIL TAG ==============
export function buildTailTag(scene: Scene): ArenaSurface {
  const root = new TransformNode("tail-tag", scene);
  scene.clearColor = new Color4(0.65, 0.45, 0.32, 1);
  scene.fogColor = new Color3(0.85, 0.55, 0.42);
  scene.fogDensity = 0.012;

  const ARENA_R = 9;

  const platform = MeshBuilder.CreateCylinder(
    "tt-platform",
    { diameterTop: ARENA_R * 2, diameterBottom: ARENA_R * 2 + 0.5, height: 1.0, tessellation: 64 },
    scene,
  );
  platform.parent = root;
  platform.position.y = -0.5;
  platform.material = flatMat(scene, "tt-mat", new Color3(0.95, 0.62, 0.45));

  // Decorative center pillar
  const pillar = MeshBuilder.CreateCylinder(
    "tt-pillar",
    { diameter: 1.2, height: 1.5, tessellation: 16 },
    scene,
  );
  pillar.parent = root;
  pillar.position.y = 0.75;
  pillar.material = flatMat(scene, "tt-pillar-mat", new Color3(0.55, 0.32, 0.42), 0.18);

  // Floating tail icons (visual flair) — for now decorative
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    const tail = MeshBuilder.CreateCylinder(
      `tt-tail-${i}`,
      { diameterTop: 0.0, diameterBottom: 0.32, height: 0.8, tessellation: 8 },
      scene,
    );
    tail.parent = root;
    tail.position.set(Math.cos(ang) * 5, 2.5, Math.sin(ang) * 5);
    tail.rotation.z = ang;
    tail.material = flatMat(scene, `tt-tail-mat-${i}`, new Color3(0.95, 0.42, 0.55), 0.45);

    const spin = new Animation(`tt-tail-spin-${i}`, "rotation.y", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
    spin.setKeys([{ frame: 0, value: 0 }, { frame: 240, value: Math.PI * 2 }]);
    tail.animations.push(spin);
    scene.beginAnimation(tail, 0, 240, true, 0.5);
  }

  // Edge gold trim
  const trim = MeshBuilder.CreateTorus("tt-trim", { diameter: ARENA_R * 2 - 0.3, thickness: 0.16, tessellation: 64 }, scene);
  trim.parent = root;
  trim.position.y = 0.04;
  trim.material = flatMat(scene, "tt-trim-mat", new Color3(1, 0.85, 0.42), 0.5);

  const aiSpawns: Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 + 0.4;
    aiSpawns.push(new Vector3(Math.cos(ang) * 6, 1, Math.sin(ang) * 6));
  }

  return {
    inside: (x, z) => Math.hypot(x, z) <= ARENA_R,
    floorY: () => 0,
    playerSpawn: new Vector3(0, 1, 6),
    aiSpawns,
    hazards: [],
    dispose: () => root.dispose(),
  };
}

// (Texture import is referenced but the function above doesn't use it — keep for atmosphere helpers)
const _unused: typeof Texture | typeof ParticleSystem = Texture;
void _unused;
