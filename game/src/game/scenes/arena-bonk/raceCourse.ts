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
 * Bean Race obstacle course — proper Fall Guys-style runner. Linear path
 * from spawn to goal, segmented by gates with different challenges:
 *   1. straight start (warm-up)
 *   2. spinning bars (jump over)
 *   3. swinging hammers (time the gap)
 *   4. drop-tile gauntlet (tiles fall when stepped on)
 *   5. moving platforms (gap-jumping)
 *   6. bouncepad finish jump → goal pillar
 *
 * Returns ArenaSurface with hazards array updated per tick so the player
 * controller can read knockback impulses and lava-floor kill conditions.
 */

function flatMat(scene: Scene, name: string, c: Color3, em = 0.1): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = c;
  m.specularColor = new Color3(0.1, 0.1, 0.1);
  m.emissiveColor = c.scale(em);
  return m;
}

const PINK = new Color3(0.95, 0.55, 0.78);
const BLUE = new Color3(0.45, 0.7, 1.0);
const GREEN = new Color3(0.55, 1.0, 0.6);
const GOLD = new Color3(1, 0.85, 0.32);
const HAZARD = new Color3(0.95, 0.32, 0.45);

interface Segment {
  /** Returns true if (x, z) is on a valid standing surface for this segment, and floor Y. */
  inside: (x: number, z: number) => { ok: boolean; y: number };
  /** Per-tick update; can mutate hazards array. */
  tick?: (dt: number, hazards: DynamicHazard[]) => void;
}

export function buildBeanRaceCourse(scene: Scene): ArenaSurface {
  const root = new TransformNode("bean-race-course", scene);

  scene.clearColor = new Color4(0.45, 0.55, 0.85, 1);
  scene.fogColor = new Color3(0.55, 0.7, 0.95);
  scene.fogDensity = 0.01;

  const segments: Segment[] = [];
  let zCursor = 0;

  // Widened track: 14m wide (was 6m). Player has way more room to dodge.
  const TRACK_HALF_WIDTH = 7;
  const TRACK_WIDTH = TRACK_HALF_WIDTH * 2;

  // ============== 1. START PAD ==============
  const startLen = 8;
  const startPad = MeshBuilder.CreateBox(
    "race-start",
    { width: TRACK_WIDTH, height: 1, depth: startLen },
    scene,
  );
  startPad.parent = root;
  startPad.position.set(0, -0.5, startLen / 2);
  startPad.material = flatMat(scene, "race-start-mat", PINK);

  // Banner / arch above start
  for (const side of [-1, 1] as const) {
    const post = MeshBuilder.CreateCylinder(
      `race-arch-post-${side}`,
      { diameter: 0.4, height: 4, tessellation: 12 },
      scene,
    );
    post.parent = root;
    post.position.set(side * (TRACK_HALF_WIDTH - 1), 2, 0.5);
    post.material = flatMat(scene, `arch-post-${side}`, GOLD, 0.4);
  }
  const archTop = MeshBuilder.CreateBox(
    "race-arch-top",
    { width: TRACK_WIDTH - 1, height: 0.4, depth: 0.4 },
    scene,
  );
  archTop.parent = root;
  archTop.position.set(0, 4.0, 0.5);
  archTop.material = flatMat(scene, "arch-top-mat", GOLD, 0.4);

  segments.push({
    inside: (x, z) => ({
      ok: Math.abs(x) <= TRACK_HALF_WIDTH && z >= 0 && z <= startLen,
      y: 0,
    }),
  });
  zCursor += startLen;

  // ============== 2. SPINNING BARS GATE ==============
  const barsZStart = zCursor;
  const barsLen = 14;

  // Floor segments with a 2m gap mid-section
  const barsFloorA = MeshBuilder.CreateBox(
    "bars-floor-a",
    { width: TRACK_WIDTH, height: 0.8, depth: barsLen / 2 - 1 },
    scene,
  );
  barsFloorA.parent = root;
  barsFloorA.position.set(0, -0.4, barsZStart + (barsLen / 2 - 1) / 2);
  barsFloorA.material = flatMat(scene, "bars-floor-a-mat", BLUE);

  const barsFloorB = MeshBuilder.CreateBox(
    "bars-floor-b",
    { width: TRACK_WIDTH, height: 0.8, depth: barsLen / 2 - 1 },
    scene,
  );
  barsFloorB.parent = root;
  barsFloorB.position.set(0, -0.4, barsZStart + barsLen / 2 + 1 + (barsLen / 2 - 1) / 2);
  barsFloorB.material = flatMat(scene, "bars-floor-b-mat", BLUE);

  // Spinning bars — wider so they sweep more of the track (but leave room
  // to dodge between them) and SHORTER than full track so the player can
  // duck around the ends
  const spinningBars: { mesh: Mesh; baseZ: number; speed: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const bar = MeshBuilder.CreateBox(
      `race-bar-${i}`,
      { width: TRACK_WIDTH * 0.7, height: 0.4, depth: 0.5 },
      scene,
    );
    const barZ = barsZStart + 2.5 + i * 4;
    bar.parent = root;
    bar.position.set(0, 0.6, barZ);
    bar.material = flatMat(scene, `race-bar-mat-${i}`, HAZARD, 0.4);
    spinningBars.push({ mesh: bar, baseZ: barZ, speed: (i % 2 === 0 ? 1 : -1) * 1.0 });
  }

  segments.push({
    inside: (x, z) => {
      if (Math.abs(x) > TRACK_HALF_WIDTH) return { ok: false, y: 0 };
      const localZ = z - barsZStart;
      if (localZ >= 0 && localZ <= barsLen / 2 - 1) return { ok: true, y: 0 };
      if (localZ > barsLen / 2 - 1 && localZ < barsLen / 2 + 1) return { ok: false, y: 0 };
      if (localZ >= barsLen / 2 + 1 && localZ <= barsLen) return { ok: true, y: 0 };
      return { ok: false, y: 0 };
    },
    tick: (_dt, hazards) => {
      const t = performance.now() / 1000;
      for (const b of spinningBars) {
        b.mesh.rotation.y = t * b.speed;
        // Add 8 hazard sample points along the bar length
        for (let s = -3.5; s <= 3.5; s += 1) {
          const cos = Math.cos(b.mesh.rotation.y);
          const sin = Math.sin(b.mesh.rotation.y);
          hazards.push({
            pos: new Vector3(s * cos, 0.6, b.baseZ + s * sin),
            radius: 0.5,
            kind: "spike",
          });
        }
      }
    },
  });
  zCursor += barsLen;

  // ============== 3. SWINGING HAMMERS ==============
  const hammerZStart = zCursor;
  const hammerLen = 14;

  const hammerFloor = MeshBuilder.CreateBox(
    "hammer-floor",
    { width: TRACK_WIDTH, height: 0.8, depth: hammerLen },
    scene,
  );
  hammerFloor.parent = root;
  hammerFloor.position.set(0, -0.4, hammerZStart + hammerLen / 2);
  hammerFloor.material = flatMat(scene, "hammer-floor-mat", PINK);

  const hammers: { pivot: TransformNode; head: Mesh; speed: number; phase: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const pivot = new TransformNode(`hammer-pivot-${i}`, scene);
    pivot.parent = root;
    const z = hammerZStart + 3 + i * 4;
    pivot.position.set(0, 5, z);

    const handle = MeshBuilder.CreateCylinder(
      `hammer-handle-${i}`,
      { diameter: 0.18, height: 4, tessellation: 8 },
      scene,
    );
    handle.parent = pivot;
    handle.position.y = -2;
    handle.material = flatMat(scene, `hammer-handle-mat-${i}`, new Color3(0.4, 0.25, 0.15));

    const head = MeshBuilder.CreateBox(
      `hammer-head-${i}`,
      { width: 1.4, height: 1.0, depth: 1.4 },
      scene,
    );
    head.parent = pivot;
    head.position.y = -4.2;
    head.material = flatMat(scene, `hammer-head-mat-${i}`, HAZARD, 0.5);

    hammers.push({ pivot, head, speed: 1.6, phase: i * (Math.PI / 1.6) });
  }

  segments.push({
    inside: (x, z) => ({
      ok: Math.abs(x) <= TRACK_HALF_WIDTH && z >= hammerZStart && z <= hammerZStart + hammerLen,
      y: 0,
    }),
    tick: (_dt, hazards) => {
      const t = performance.now() / 1000;
      for (const h of hammers) {
        h.pivot.rotation.x = Math.sin(t * h.speed + h.phase) * 1.2;
        // Hammer head world position approx
        const headX = 0;
        const headY = 5 - 4.2 * Math.cos(h.pivot.rotation.x);
        const headZ = h.pivot.position.z + 4.2 * Math.sin(h.pivot.rotation.x);
        hazards.push({
          pos: new Vector3(headX, headY, headZ),
          radius: 1.1,
          kind: "spike",
        });
      }
    },
  });
  zCursor += hammerLen;

  // ============== 4. DROP-TILE GAUNTLET ==============
  const dropZStart = zCursor;
  const dropLen = 14;
  const tileSize = 1.6;
  const tileGrid = 9; // 9 columns × Z rows for the wider track
  const dropTiles: { mesh: Mesh; baseY: number; falling: boolean; respawnAt: number; gx: number; gz: number }[] = [];

  for (let zi = 0; zi < 8; zi++) {
    for (let xi = -4; xi <= 4; xi++) {
      const tile = MeshBuilder.CreateBox(
        `drop-tile-${zi}-${xi}`,
        { width: tileSize - 0.05, height: 0.3, depth: tileSize - 0.05 },
        scene,
      );
      tile.parent = root;
      tile.position.set(xi * tileSize, 0, dropZStart + 0.8 + zi * 1.7);
      tile.material = flatMat(
        scene,
        `drop-tile-mat-${zi}-${xi}`,
        (zi + xi) % 2 === 0 ? new Color3(0.85, 0.55, 1) : new Color3(0.45, 0.65, 1),
      );
      dropTiles.push({
        mesh: tile,
        baseY: 0,
        falling: false,
        respawnAt: 0,
        gx: xi,
        gz: zi,
      });
    }
  }
  void tileGrid;

  segments.push({
    inside: (x, z) => {
      if (Math.abs(x) > 4.5 * tileSize) return { ok: false, y: 0 };
      const localZ = z - dropZStart;
      if (localZ < 0 || localZ > dropLen) return { ok: false, y: 0 };
      // Find the tile under the player
      const xi = Math.round(x / tileSize);
      const zi = Math.floor((localZ - 0.8) / 1.7);
      const tile = dropTiles.find((t) => t.gx === xi && t.gz === zi);
      if (!tile) return { ok: false, y: 0 };
      if (tile.falling) return { ok: false, y: 0 };
      // Trigger fall — unique "approached" flag
      const now = performance.now() / 1000;
      if (!tile.falling && tile.respawnAt < now) {
        // schedule fall with small delay
        tile.respawnAt = now + 0.4;
        // mark for the tick method to start the fall
        (tile as unknown as { triggered: boolean }).triggered = true;
      }
      return { ok: true, y: 0 };
    },
    tick: (dt) => {
      const now = performance.now() / 1000;
      for (const tile of dropTiles) {
        const trig = (tile as unknown as { triggered: boolean }).triggered;
        if (trig && !tile.falling && now >= tile.respawnAt) {
          tile.falling = true;
          tile.respawnAt = now + 4;
          (tile as unknown as { triggered: boolean }).triggered = false;
        }
        if (tile.falling) {
          tile.mesh.position.y -= 9 * dt;
          if (now >= tile.respawnAt && tile.mesh.position.y < -2) {
            tile.mesh.position.y = tile.baseY;
            tile.falling = false;
          }
        }
      }
    },
  });
  zCursor += dropLen;

  // ============== 5. MOVING PLATFORM GAP ==============
  const movZStart = zCursor;
  const movLen = 12;

  // Static start pad
  const movStart = MeshBuilder.CreateBox(
    "mov-start",
    { width: TRACK_WIDTH, height: 0.8, depth: 3 },
    scene,
  );
  movStart.parent = root;
  movStart.position.set(0, -0.4, movZStart + 1.5);
  movStart.material = flatMat(scene, "mov-start-mat", BLUE);

  // 3 moving platforms (was 2) — wider track allows more
  const movingPlats: { mesh: Mesh; phase: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const plat = MeshBuilder.CreateBox(
      `mov-plat-${i}`,
      { width: 4, height: 0.4, depth: 3 },
      scene,
    );
    plat.parent = root;
    plat.position.set(0, 0, movZStart + 3.5 + i * 2.5);
    plat.material = flatMat(scene, `mov-plat-mat-${i}`, GREEN, 0.3);
    movingPlats.push({ mesh: plat, phase: i * (Math.PI * 0.7) });
  }

  // Static end pad
  const movEnd = MeshBuilder.CreateBox(
    "mov-end",
    { width: TRACK_WIDTH, height: 0.8, depth: 3 },
    scene,
  );
  movEnd.parent = root;
  movEnd.position.set(0, -0.4, movZStart + movLen - 1.5);
  movEnd.material = flatMat(scene, "mov-end-mat", BLUE);

  segments.push({
    inside: (x, z) => {
      if (Math.abs(x) > TRACK_HALF_WIDTH) return { ok: false, y: 0 };
      const localZ = z - movZStart;
      if (localZ >= 0 && localZ <= 3) return { ok: true, y: 0 };
      if (localZ >= movLen - 3 && localZ <= movLen) return { ok: true, y: 0 };
      for (const p of movingPlats) {
        const dx = Math.abs(x - p.mesh.position.x);
        const dz = Math.abs(z - p.mesh.position.z);
        if (dx <= 2 && dz <= 1.5) return { ok: true, y: 0.2 };
      }
      return { ok: false, y: 0 };
    },
    tick: () => {
      const t = performance.now() / 1000;
      for (let i = 0; i < movingPlats.length; i++) {
        const p = movingPlats[i]!;
        // Sweep left ↔ right across more of the track now that it's wider
        p.mesh.position.x = Math.sin(t * 0.8 + p.phase) * (TRACK_HALF_WIDTH - 2);
      }
    },
  });
  zCursor += movLen;

  // ============== 6. BOUNCEPAD + GOAL ==============
  const goalZStart = zCursor;
  const goalLen = 8;

  const ramp = MeshBuilder.CreateBox(
    "race-ramp",
    { width: TRACK_WIDTH, height: 0.8, depth: 4 },
    scene,
  );
  ramp.parent = root;
  ramp.position.set(0, -0.4, goalZStart + 2);
  ramp.rotation.x = -0.25;
  ramp.material = flatMat(scene, "race-ramp-mat", PINK);

  const bouncepad = MeshBuilder.CreateCylinder(
    "race-bouncepad",
    { diameter: 2.4, height: 0.3, tessellation: 32 },
    scene,
  );
  bouncepad.parent = root;
  bouncepad.position.set(0, 0.4, goalZStart + 4);
  bouncepad.material = flatMat(scene, "race-bouncepad-mat", GREEN, 0.7);

  const padPulse = new Animation(
    "pad-pulse",
    "scaling.y",
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  padPulse.setKeys([{ frame: 0, value: 0.7 }, { frame: 30, value: 1.4 }, { frame: 60, value: 0.7 }]);
  bouncepad.animations.push(padPulse);
  scene.beginAnimation(bouncepad, 0, 60, true, 1.2);

  const goalPad = MeshBuilder.CreateCylinder(
    "race-goal-pad",
    { diameter: 5, height: 0.4, tessellation: 32 },
    scene,
  );
  goalPad.parent = root;
  goalPad.position.set(0, 1.5, goalZStart + 7);
  goalPad.material = flatMat(scene, "race-goal-pad-mat", GOLD, 0.5);

  const goalBell = MeshBuilder.CreateCylinder(
    "race-goal-bell",
    { diameterTop: 2.2, diameterBottom: 0.6, height: 1.8, tessellation: 16 },
    scene,
  );
  goalBell.parent = root;
  goalBell.position.set(0, 3, goalZStart + 7);
  goalBell.material = flatMat(scene, "race-goal-bell-mat", GOLD, 0.6);

  const sway = new Animation(
    "race-bell-sway",
    "rotation.z",
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  sway.setKeys([{ frame: 0, value: -0.12 }, { frame: 60, value: 0.12 }, { frame: 120, value: -0.12 }]);
  goalBell.animations.push(sway);
  scene.beginAnimation(goalBell, 0, 120, true, 0.6);

  const hazardsPostBouncepad: DynamicHazard[] = [
    { pos: new Vector3(0, 0.4, goalZStart + 4), radius: 1.2, kind: "bouncepad" },
  ];

  segments.push({
    inside: (x, z) => {
      if (Math.abs(x) > TRACK_HALF_WIDTH) return { ok: false, y: 0 };
      const localZ = z - goalZStart;
      if (localZ >= 0 && localZ <= 4) return { ok: true, y: 0 };
      if (Math.hypot(x, z - (goalZStart + 7)) < 2.5) return { ok: true, y: 1.7 };
      return { ok: false, y: 0 };
    },
  });
  zCursor += goalLen;

  // ============== ATMOSPHERE ==============
  // Cloud sphere decorations along the path
  for (let i = 0; i < 12; i++) {
    const cloud = MeshBuilder.CreateSphere(
      `race-cloud-${i}`,
      { diameter: 2.5 + Math.random() * 2 },
      scene,
    );
    cloud.parent = root;
    cloud.position.set(
      -14 + Math.random() * 28,
      4 + Math.random() * 6,
      Math.random() * zCursor,
    );
    cloud.scaling.y = 0.45;
    cloud.material = flatMat(scene, `race-cloud-mat-${i}`, new Color3(1, 1, 1), 0.4);
  }

  // Sparkle particles
  const sparkleTex = (() => {
    const cnv = document.createElement("canvas");
    cnv.width = 32;
    cnv.height = 32;
    const ctx = cnv.getContext("2d")!;
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(180, 220, 255, 1)");
    grad.addColorStop(0.5, "rgba(140, 200, 255, 0.5)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    const tex = new Texture(cnv.toDataURL(), scene);
    tex.hasAlpha = true;
    return tex;
  })();
  const sparkles = new ParticleSystem("race-sparkles", 200, scene);
  sparkles.particleTexture = sparkleTex;
  sparkles.emitter = root as unknown as Vector3;
  sparkles.minEmitBox = new Vector3(-15, 0, 0);
  sparkles.maxEmitBox = new Vector3(15, 12, zCursor);
  sparkles.color1 = new Color4(0.7, 0.85, 1, 0.6);
  sparkles.color2 = new Color4(1, 1, 1, 0.5);
  sparkles.colorDead = new Color4(0.4, 0.5, 0.7, 0);
  sparkles.minSize = 0.1;
  sparkles.maxSize = 0.25;
  sparkles.minLifeTime = 5;
  sparkles.maxLifeTime = 9;
  sparkles.emitRate = 25;
  sparkles.gravity = new Vector3(0, 0.05, 0);
  sparkles.direction1 = new Vector3(-0.1, 0.2, -0.1);
  sparkles.direction2 = new Vector3(0.1, 0.5, 0.1);
  sparkles.start();

  // ============== AI SPAWNS ==============
  // Spread the AI across the wider track at the starting line
  const aiSpawns: Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    aiSpawns.push(new Vector3(-5 + i * 2.5, 1, 1.5));
  }

  const hazards: DynamicHazard[] = [];

  return {
    inside: (x, z) => {
      for (const seg of segments) {
        const r = seg.inside(x, z);
        if (r.ok) return true;
      }
      return false;
    },
    floorY: (x, z) => {
      for (const seg of segments) {
        const r = seg.inside(x, z);
        if (r.ok) return r.y;
      }
      return -10;
    },
    playerSpawn: new Vector3(0, 1, 2),
    aiSpawns,
    hazards,
    tick: (dt) => {
      // Reset hazards array each tick (just from bouncepad + segment-driven)
      hazards.length = 0;
      hazards.push(...hazardsPostBouncepad);
      for (const seg of segments) {
        if (seg.tick) seg.tick(dt, hazards);
      }
    },
    dispose: () => {
      sparkles.dispose();
      root.dispose();
    },
  };
}
