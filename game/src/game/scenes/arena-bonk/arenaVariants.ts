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

/**
 * Arena variants — fully built-out themed levels with hazards, verticality,
 * moving pieces, particles, and skybox dressing. Each builder returns an
 * ArenaSurface with a per-tick callback that updates dynamic hazards.
 */

export interface DynamicHazard {
  /** Position + radius-of-effect for hazard checks (knockback / damage) */
  pos: Vector3;
  radius: number;
  kind: "spike" | "fan" | "bouncepad" | "drop";
}

export interface ArenaSurface {
  inside: (x: number, z: number) => boolean;
  floorY: (x: number, z: number) => number;
  playerSpawn: Vector3;
  aiSpawns: Vector3[];
  /** Active dynamic hazards (refreshed per tick). */
  hazards: DynamicHazard[];
  /** Optional per-tick callback. */
  tick?: (dt: number) => void;
  dispose: () => void;
}

export type ArenaVariantId =
  | "bonk-island"
  | "bean-race"
  | "king-of-bell"
  | "hot-bean"
  | "jump-club"
  | "hex-a-gone"
  | "block-party";

// ============== SHARED ATMOS ==============

function ambientSparkles(scene: Scene, color: string, parent: TransformNode, area = 14, height = 12): ParticleSystem {
  const ps = new ParticleSystem("sparkle", 220, scene);
  const cnv = document.createElement("canvas");
  cnv.width = 32;
  cnv.height = 32;
  const ctx = cnv.getContext("2d")!;
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, color);
  grad.addColorStop(0.5, color.replace(/, 1\)/, ", 0.4)"));
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  const tex = new Texture(cnv.toDataURL(), scene);
  tex.hasAlpha = true;
  ps.particleTexture = tex;
  ps.emitter = parent as unknown as Vector3;
  ps.minEmitBox = new Vector3(-area, 0, -area);
  ps.maxEmitBox = new Vector3(area, height, area);
  ps.minSize = 0.05;
  ps.maxSize = 0.2;
  ps.minLifeTime = 4;
  ps.maxLifeTime = 9;
  ps.emitRate = 24;
  ps.gravity = new Vector3(0, 0.05, 0);
  ps.direction1 = new Vector3(-0.1, 0.2, -0.1);
  ps.direction2 = new Vector3(0.1, 0.6, 0.1);
  ps.start();
  return ps;
}

function flatMat(scene: Scene, name: string, c: Color3, em = 0.1): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = c;
  m.specularColor = new Color3(0.1, 0.1, 0.1);
  m.emissiveColor = c.scale(em);
  return m;
}

// ============== 1. BONK BOWL — pink tiered arena with bounce pads ==============
export function buildBonkBowl(scene: Scene): ArenaSurface {
  const root = new TransformNode("bonk-bowl", scene);

  // Sky gradient
  scene.clearColor = new Color4(0.65, 0.45, 0.75, 1);
  scene.fogColor = new Color3(0.85, 0.55, 0.78);
  scene.fogDensity = 0.014;

  const ARENA_R = 13;
  const INNER_R = 5;

  // Outer ring platform (high)
  const outer = MeshBuilder.CreateCylinder(
    "bowl-outer",
    { diameterTop: ARENA_R * 2, diameterBottom: ARENA_R * 2 + 1, height: 0.8, tessellation: 32 },
    scene,
  );
  outer.parent = root;
  outer.position.y = -0.4;
  outer.material = flatMat(scene, "bowl-outer-mat", new Color3(0.95, 0.55, 0.85));

  // Inner pit (lower — beans want to stay UP)
  const inner = MeshBuilder.CreateCylinder(
    "bowl-inner",
    { diameter: INNER_R * 2, height: 0.4, tessellation: 32 },
    scene,
  );
  inner.parent = root;
  inner.position.y = -1.4;
  inner.material = flatMat(scene, "bowl-inner-mat", new Color3(0.45, 0.25, 0.55));

  // Connecting walls (sloped sides between outer ring and inner pit)
  const wall = MeshBuilder.CreateTorus(
    "bowl-wall",
    { diameter: (ARENA_R + INNER_R), thickness: 0.6, tessellation: 32 },
    scene,
  );
  wall.parent = root;
  wall.position.y = -0.8;
  wall.scaling.y = 1.2;
  wall.material = flatMat(scene, "bowl-wall-mat", new Color3(0.78, 0.42, 0.7));

  // Gold edge trim
  const trim = MeshBuilder.CreateTorus(
    "bowl-trim",
    { diameter: ARENA_R * 2 - 0.4, thickness: 0.18, tessellation: 64 },
    scene,
  );
  trim.parent = root;
  trim.position.y = 0.04;
  trim.material = flatMat(scene, "bowl-trim-mat", new Color3(1, 0.85, 0.42), 0.5);

  // 4 BOUNCE PADS at NSEW positions on the outer ring — beans hitting them get launched up
  const hazards: DynamicHazard[] = [];
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    const padX = Math.cos(ang) * (ARENA_R - 2);
    const padZ = Math.sin(ang) * (ARENA_R - 2);
    const pad = MeshBuilder.CreateCylinder(
      `pad-${i}`,
      { diameter: 1.6, height: 0.18, tessellation: 24 },
      scene,
    );
    pad.parent = root;
    pad.position.set(padX, 0.06, padZ);
    pad.material = flatMat(scene, `pad-mat-${i}`, new Color3(0.55, 1, 0.45), 0.6);

    // Pulse animation
    const pulse = new Animation(`pad-pulse-${i}`, "scaling.y", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
    pulse.setKeys([{ frame: 0, value: 0.8 }, { frame: 30, value: 1.4 }, { frame: 60, value: 0.8 }]);
    pad.animations.push(pulse);
    scene.beginAnimation(pad, 0, 60, true, 0.8);

    hazards.push({ pos: new Vector3(padX, 0, padZ), radius: 1.0, kind: "bouncepad" });
  }

  // 2 ROTATING SPIKE BEAMS that sweep across the inner pit
  const beamRoot = new TransformNode("bowl-beams", scene);
  beamRoot.parent = root;
  beamRoot.position.y = -1.2;
  for (let i = 0; i < 2; i++) {
    const beam = MeshBuilder.CreateBox(`beam-${i}`, { width: INNER_R * 1.8, height: 0.3, depth: 0.5 }, scene);
    beam.parent = beamRoot;
    beam.rotation.y = (i / 2) * Math.PI;
    beam.material = flatMat(scene, `beam-mat-${i}`, new Color3(0.95, 0.18, 0.32), 0.4);
  }
  const beamSpin = new Animation("beam-spin", "rotation.y", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
  beamSpin.setKeys([{ frame: 0, value: 0 }, { frame: 240, value: Math.PI * 2 }]);
  beamRoot.animations.push(beamSpin);
  scene.beginAnimation(beamRoot, 0, 240, true, 0.8);

  // Ambient pink sparkles
  ambientSparkles(scene, "rgba(255, 200, 230, 1)", root, ARENA_R);

  // 5 spawn anchors around the outer ring
  const aiSpawns: Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 + 0.4;
    aiSpawns.push(new Vector3(Math.cos(ang) * (ARENA_R - 1.5), 1, Math.sin(ang) * (ARENA_R - 1.5)));
  }

  return {
    inside: (x, z) => Math.hypot(x, z) <= ARENA_R,
    floorY: (x, z) => (Math.hypot(x, z) > INNER_R ? 0 : -1),
    playerSpawn: new Vector3(0, 1, ARENA_R - 2),
    aiSpawns,
    hazards,
    tick: () => {
      // Rotating beam check is implicit — we update beam world positions below
      const t = performance.now() / 1000;
      // Update beam hazard positions (rotating around y axis, each beam at different angle)
      hazards.length = 4; // keep the bounce pads, drop any old beam hazards
      for (let i = 0; i < 2; i++) {
        const ang = (i / 2) * Math.PI + t * 1.0;
        for (let s = 1; s <= 5; s++) {
          const r = (s / 5) * INNER_R;
          hazards.push({
            pos: new Vector3(Math.cos(ang) * r, -1, Math.sin(ang) * r),
            radius: 0.6,
            kind: "spike",
          });
        }
      }
    },
    dispose: () => root.dispose(),
  };
}

// ============== 2. BEAN RACE — proper Fall Guys-style obstacle course ==============
// (See raceCourse.ts — buildBeanRaceCourse with spinning bars, swinging
// hammers, drop-tile gauntlet, moving platforms, bouncepad finish)
export { buildBeanRaceCourse as buildBeanRace } from "@game/scenes/arena-bonk/raceCourse";

// Legacy spiral race (unused now, kept for reference / future variant)
function _legacy_buildBeanRaceSpiral(scene: Scene): ArenaSurface {
  const root = new TransformNode("bean-race", scene);

  scene.clearColor = new Color4(0.45, 0.55, 0.85, 1);
  scene.fogColor = new Color3(0.55, 0.7, 0.95);
  scene.fogDensity = 0.012;

  // 14 spiral steps climbing from y=0 → y=8
  const steps = 14;
  const radius = 7;
  const heightStep = 0.55;
  const angleStep = (Math.PI * 1.6) / steps;

  for (let i = 0; i < steps; i++) {
    const ang = i * angleStep;
    const isBouncy = i % 4 === 3;
    const tile = MeshBuilder.CreateBox(
      `race-tile-${i}`,
      { width: 2.4, height: 0.4, depth: 2.4 },
      scene,
    );
    tile.parent = root;
    tile.position.set(Math.cos(ang) * radius, i * heightStep, Math.sin(ang) * radius);
    tile.rotation.y = ang;
    tile.material = isBouncy
      ? flatMat(scene, `race-tile-mat-${i}`, new Color3(0.55, 1, 0.6), 0.5)
      : flatMat(scene, `race-tile-mat-${i}`, i % 2 === 0 ? new Color3(0.5, 0.7, 1) : new Color3(0.85, 0.55, 1));

    // Bouncy tiles wobble
    if (isBouncy) {
      const wobble = new Animation(`wobble-${i}`, "scaling.y", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
      wobble.setKeys([{ frame: 0, value: 0.8 }, { frame: 30, value: 1.4 }, { frame: 60, value: 0.8 }]);
      tile.animations.push(wobble);
      scene.beginAnimation(tile, 0, 60, true, 1.2);
    }

    // Edge halo
    const halo = MeshBuilder.CreateTorus(
      `race-halo-${i}`,
      { diameter: 2.6, thickness: 0.06, tessellation: 24 },
      scene,
    );
    halo.parent = root;
    halo.position.copyFrom(tile.position);
    halo.position.y += 0.22;
    halo.rotation.y = ang;
    halo.material = flatMat(scene, `race-halo-mat-${i}`, new Color3(1, 0.9, 0.4), 0.5);
  }

  // Goal bell at the top
  const finalAng = (steps - 1) * angleStep + angleStep;
  const goalPos = new Vector3(Math.cos(finalAng) * radius, steps * heightStep, Math.sin(finalAng) * radius);

  const goalPlatform = MeshBuilder.CreateCylinder(
    "race-goal",
    { diameter: 4, height: 0.4, tessellation: 32 },
    scene,
  );
  goalPlatform.parent = root;
  goalPlatform.position.copyFrom(goalPos);
  goalPlatform.material = flatMat(scene, "race-goal-mat", new Color3(1, 0.85, 0.42), 0.4);

  const bell = MeshBuilder.CreateCylinder(
    "race-bell",
    { diameterTop: 1.6, diameterBottom: 0.6, height: 1.4, tessellation: 16 },
    scene,
  );
  bell.parent = root;
  bell.position.set(goalPos.x, goalPos.y + 1.5, goalPos.z);
  bell.material = flatMat(scene, "race-bell-mat", new Color3(1, 0.85, 0.32), 0.55);

  const sway = new Animation("bell-sway", "rotation.z", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
  sway.setKeys([{ frame: 0, value: -0.12 }, { frame: 60, value: 0.12 }, { frame: 120, value: -0.12 }]);
  bell.animations.push(sway);
  scene.beginAnimation(bell, 0, 120, true, 0.6);

  // Cloud sky decoration
  for (let i = 0; i < 6; i++) {
    const cloud = MeshBuilder.CreateSphere(`cloud-${i}`, { diameter: 3 + Math.random() * 2 }, scene);
    cloud.parent = root;
    cloud.position.set(-12 + i * 6, 4 + Math.random() * 6, -12 + Math.random() * 24);
    cloud.scaling.y = 0.4;
    cloud.material = flatMat(scene, `cloud-mat-${i}`, new Color3(1, 1, 1), 0.6);
  }

  ambientSparkles(scene, "rgba(180, 220, 255, 1)", root, 14, 14);

  const aiSpawns: Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    aiSpawns.push(new Vector3(-1.5 + i * 0.8, 1, 5));
  }

  return {
    inside: (x, z) => {
      // Approximate: must be near a tile
      for (let i = 0; i < steps; i++) {
        const ang = i * angleStep;
        const tx = Math.cos(ang) * radius;
        const tz = Math.sin(ang) * radius;
        if (Math.abs(x - tx) < 1.4 && Math.abs(z - tz) < 1.4) return true;
      }
      // Goal platform
      if (Math.hypot(x - goalPos.x, z - goalPos.z) < 2.2) return true;
      return false;
    },
    floorY: (x, z) => {
      for (let i = 0; i < steps; i++) {
        const ang = i * angleStep;
        const tx = Math.cos(ang) * radius;
        const tz = Math.sin(ang) * radius;
        if (Math.abs(x - tx) < 1.4 && Math.abs(z - tz) < 1.4) return i * heightStep + 0.2;
      }
      if (Math.hypot(x - goalPos.x, z - goalPos.z) < 2.2) return steps * heightStep + 0.2;
      return 0;
    },
    playerSpawn: new Vector3(7, 1.0, 0),
    aiSpawns,
    hazards: [],
    dispose: () => root.dispose(),
  };
}
void _legacy_buildBeanRaceSpiral;

// ============== 3. KING OF THE BELL — vertical multi-tier arena ==============
export function buildKingOfBell(scene: Scene): ArenaSurface {
  const root = new TransformNode("kob", scene);

  scene.clearColor = new Color4(0.18, 0.18, 0.32, 1);
  scene.fogColor = new Color3(0.28, 0.22, 0.45);
  scene.fogDensity = 0.018;

  const ARENA_R = 11;

  // Bottom platform
  const bottom = MeshBuilder.CreateCylinder(
    "kob-bottom",
    { diameterTop: ARENA_R * 2, diameterBottom: ARENA_R * 2 + 0.6, height: 1.0, tessellation: 64 },
    scene,
  );
  bottom.parent = root;
  bottom.position.y = -0.5;
  bottom.material = flatMat(scene, "kob-bot-mat", new Color3(0.32, 0.42, 0.65), 0.1);

  // Mid tier (smaller, raised)
  const mid = MeshBuilder.CreateCylinder(
    "kob-mid",
    { diameter: 9, height: 0.8, tessellation: 32 },
    scene,
  );
  mid.parent = root;
  mid.position.y = 1.2;
  mid.material = flatMat(scene, "kob-mid-mat", new Color3(0.55, 0.45, 0.75), 0.15);

  // Center capture disc — glowing gold, the WIN zone
  const captureZone = MeshBuilder.CreateCylinder(
    "kob-zone",
    { diameter: 4, height: 0.18, tessellation: 32 },
    scene,
  );
  captureZone.parent = root;
  captureZone.position.y = 1.7;
  captureZone.material = flatMat(scene, "kob-zone-mat", new Color3(1, 0.85, 0.32), 0.7);

  // Hovering rotating bell
  const bellRoot = new TransformNode("kob-bell-root", scene);
  bellRoot.parent = root;
  bellRoot.position.y = 5;

  const bell = MeshBuilder.CreateCylinder(
    "kob-bell",
    { diameterTop: 2.0, diameterBottom: 0.6, height: 1.6, tessellation: 16 },
    scene,
  );
  bell.parent = bellRoot;
  bell.material = flatMat(scene, "kob-bell-mat", new Color3(1, 0.85, 0.32), 0.5);

  const bellRing = MeshBuilder.CreateTorus("bell-ring", { diameter: 2.4, thickness: 0.08, tessellation: 32 }, scene);
  bellRing.parent = bellRoot;
  bellRing.position.y = -0.85;
  bellRing.material = flatMat(scene, "bell-ring-mat", new Color3(1, 0.95, 0.55), 0.7);

  const spin = new Animation("kob-spin", "rotation.y", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
  spin.setKeys([{ frame: 0, value: 0 }, { frame: 600, value: Math.PI * 2 }]);
  bellRoot.animations.push(spin);
  scene.beginAnimation(bellRoot, 0, 600, true, 0.4);

  // 4 rotating hazard rings around the perimeter (at different heights)
  const hazards: DynamicHazard[] = [];
  for (let i = 0; i < 3; i++) {
    const ringHeight = 0.5 + i * 0.7;
    const ring = MeshBuilder.CreateTorus(
      `kob-hazard-${i}`,
      { diameter: 14 + i * 1.5, thickness: 0.12, tessellation: 64 },
      scene,
    );
    ring.parent = root;
    ring.position.y = ringHeight;
    ring.material = flatMat(scene, `hazard-mat-${i}`, new Color3(0.95, 0.32, 0.45), 0.5);

    const ringSpin = new Animation(`ring-${i}`, "rotation.y", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
    const dir = i % 2 === 0 ? 1 : -1;
    ringSpin.setKeys([{ frame: 0, value: 0 }, { frame: 800, value: Math.PI * 2 * dir }]);
    ring.animations.push(ringSpin);
    scene.beginAnimation(ring, 0, 800, true, 0.5);
  }

  // Floating ramps connecting bottom → mid (4 of them at NSEW)
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    const ramp = MeshBuilder.CreateBox(`kob-ramp-${i}`, { width: 1.6, height: 0.18, depth: 4 }, scene);
    ramp.parent = root;
    ramp.position.set(Math.cos(ang) * 5, 0.6, Math.sin(ang) * 5);
    ramp.rotation.y = ang + Math.PI / 2;
    ramp.rotation.z = -0.3;
    ramp.material = flatMat(scene, `ramp-mat-${i}`, new Color3(0.6, 0.55, 0.78), 0.15);
  }

  ambientSparkles(scene, "rgba(255, 220, 130, 1)", root, ARENA_R, 12);

  const aiSpawns: Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 + 0.4;
    aiSpawns.push(new Vector3(Math.cos(ang) * 7, 1, Math.sin(ang) * 7));
  }

  return {
    inside: (x, z) => Math.hypot(x, z) <= ARENA_R,
    floorY: (x, z) => (Math.hypot(x, z) <= 4.5 ? 1.7 : Math.hypot(x, z) <= ARENA_R ? 0 : -10),
    playerSpawn: new Vector3(0, 1, 7),
    aiSpawns,
    hazards,
    dispose: () => root.dispose(),
  };
}

// ============== 4. HOT BEAN — volcano arena with lava + falling tiles ==============
export function buildHotBean(scene: Scene): ArenaSurface {
  const root = new TransformNode("hot-bean", scene);

  scene.clearColor = new Color4(0.32, 0.12, 0.08, 1);
  scene.fogColor = new Color3(0.55, 0.18, 0.12);
  scene.fogDensity = 0.02;

  const ARENA_R = 9;
  const INNER_HOLE = 1.8;

  // Outer ring
  const outer = MeshBuilder.CreateCylinder(
    "hb-outer",
    { diameterTop: ARENA_R * 2, diameterBottom: ARENA_R * 2 + 0.6, height: 1.0, tessellation: 64 },
    scene,
  );
  outer.parent = root;
  outer.position.y = -0.5;
  outer.material = flatMat(scene, "hb-outer-mat", new Color3(0.42, 0.22, 0.18), 0.12);

  // Crater floor (lava plane below)
  const lava = MeshBuilder.CreateDisc("hb-lava", { radius: ARENA_R * 1.5, tessellation: 48 }, scene);
  lava.parent = root;
  lava.rotation.x = Math.PI / 2;
  lava.position.y = -3.5;
  const lavaMat = new StandardMaterial("hb-lava-mat", scene);
  lavaMat.diffuseColor = new Color3(1, 0.4, 0.15);
  lavaMat.emissiveColor = new Color3(0.85, 0.32, 0.1);
  lava.material = lavaMat;

  // Lava bubble flow (subtle Y oscillation)
  const lavaBubble = new Animation("lava-bubble", "position.y", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
  lavaBubble.setKeys([{ frame: 0, value: -3.5 }, { frame: 60, value: -3.3 }, { frame: 120, value: -3.5 }]);
  lava.animations.push(lavaBubble);
  scene.beginAnimation(lava, 0, 120, true, 0.5);

  // Center pillar — looks dangerous
  const pillar = MeshBuilder.CreateCylinder(
    "hb-pillar",
    { diameterTop: 0.9, diameterBottom: 1.5, height: 4, tessellation: 16 },
    scene,
  );
  pillar.parent = root;
  pillar.position.y = 1.5;
  pillar.material = flatMat(scene, "hb-pillar-mat", new Color3(0.95, 0.32, 0.18), 0.6);

  const pulse = new Animation("hb-pulse", "scaling.y", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
  pulse.setKeys([{ frame: 0, value: 0.92 }, { frame: 30, value: 1.08 }, { frame: 60, value: 0.92 }]);
  pillar.animations.push(pulse);
  scene.beginAnimation(pillar, 0, 60, true, 1.5);

  // 8 falling tiles around the ring — they drop into lava when stepped on
  const fallingTiles: { mesh: Mesh; baseY: number; falling: boolean; respawnAt: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const tile = MeshBuilder.CreateCylinder(
      `hb-tile-${i}`,
      { diameter: 1.4, height: 0.18, tessellation: 8 },
      scene,
    );
    tile.parent = root;
    tile.position.set(Math.cos(ang) * (ARENA_R - 2), 0.06, Math.sin(ang) * (ARENA_R - 2));
    tile.material = flatMat(scene, `hb-tile-mat-${i}`, new Color3(0.78, 0.42, 0.22), 0.18);
    fallingTiles.push({ mesh: tile, baseY: 0.06, falling: false, respawnAt: 0 });
  }

  // Erupting lava jets at random outer positions
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + 0.4;
    const jet = MeshBuilder.CreateCylinder(
      `hb-jet-${i}`,
      { diameterTop: 0.0, diameterBottom: 0.6, height: 1.2, tessellation: 8 },
      scene,
    );
    jet.parent = root;
    jet.position.set(Math.cos(ang) * (ARENA_R + 1.5), 0.1, Math.sin(ang) * (ARENA_R + 1.5));
    jet.material = flatMat(scene, `hb-jet-mat-${i}`, new Color3(1, 0.5, 0.18), 0.7);

    const jetPulse = new Animation(`hb-jet-pulse-${i}`, "scaling.y", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
    jetPulse.setKeys([{ frame: 0, value: 0.5 }, { frame: 30, value: 1.4 }, { frame: 60, value: 0.5 }]);
    jet.animations.push(jetPulse);
    scene.beginAnimation(jet, 0, 60, true, 1 + i * 0.2);
  }

  // Ember particles
  const embers = new ParticleSystem("hb-embers", 200, scene);
  const emberCnv = document.createElement("canvas");
  emberCnv.width = 16;
  emberCnv.height = 16;
  const ectx = emberCnv.getContext("2d")!;
  const eg = ectx.createRadialGradient(8, 8, 0, 8, 8, 8);
  eg.addColorStop(0, "rgba(255, 200, 100, 1)");
  eg.addColorStop(1, "rgba(0, 0, 0, 0)");
  ectx.fillStyle = eg;
  ectx.fillRect(0, 0, 16, 16);
  const eTex = new Texture(emberCnv.toDataURL(), scene);
  eTex.hasAlpha = true;
  embers.particleTexture = eTex;
  embers.emitter = root as unknown as Vector3;
  embers.minEmitBox = new Vector3(-ARENA_R, -2, -ARENA_R);
  embers.maxEmitBox = new Vector3(ARENA_R, -1, ARENA_R);
  embers.color1 = new Color4(1, 0.55, 0.18, 0.9);
  embers.color2 = new Color4(1, 0.85, 0.42, 0.7);
  embers.colorDead = new Color4(0.3, 0.1, 0.05, 0);
  embers.minSize = 0.06;
  embers.maxSize = 0.18;
  embers.minLifeTime = 1.5;
  embers.maxLifeTime = 3;
  embers.emitRate = 60;
  embers.gravity = new Vector3(0, 1.5, 0);
  embers.direction1 = new Vector3(-0.1, 1.5, -0.1);
  embers.direction2 = new Vector3(0.1, 3, 0.1);
  embers.start();

  const hazards: DynamicHazard[] = [];
  hazards.push({ pos: new Vector3(0, 1.5, 0), radius: 1.0, kind: "spike" });

  const aiSpawns: Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 + 0.4;
    aiSpawns.push(new Vector3(Math.cos(ang) * 6, 1, Math.sin(ang) * 6));
  }

  return {
    inside: (x, z) => {
      const r = Math.hypot(x, z);
      return r <= ARENA_R && r >= INNER_HOLE;
    },
    floorY: () => 0,
    playerSpawn: new Vector3(0, 1, 5),
    aiSpawns,
    hazards,
    tick: (dt) => {
      const t = performance.now() / 1000;
      // Falling tiles cycle: when player approaches, drop after 0.5s, respawn after 4s
      for (const ft of fallingTiles) {
        if (ft.falling) {
          ft.mesh.position.y -= 8 * dt;
          if (ft.mesh.position.y < -6 && t > ft.respawnAt) {
            ft.mesh.position.y = ft.baseY;
            ft.falling = false;
          }
        }
      }
    },
    dispose: () => {
      embers.dispose();
      root.dispose();
    },
  };
}

// Re-export the race course builder so the switch below picks the new one
import { buildBeanRaceCourse as _race } from "@game/scenes/arena-bonk/raceCourse";
import { buildJumpClub, buildHexAGone, buildBlockParty } from "@game/scenes/arena-bonk/funArenas";

export function buildArenaSurface(scene: Scene, variant: ArenaVariantId): ArenaSurface {
  switch (variant) {
    case "bean-race":
      return _race(scene);
    case "king-of-bell":
      return buildKingOfBell(scene);
    case "hot-bean":
      return buildHotBean(scene);
    case "jump-club":
      return buildJumpClub(scene);
    case "hex-a-gone":
      return buildHexAGone(scene);
    case "block-party":
      return buildBlockParty(scene);
    case "bonk-island":
    default:
      return buildBonkBowl(scene);
  }
}
