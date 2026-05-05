import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3, TransformNode, Animation } from "@babylonjs/core";

/**
 * Arena variants — modular platform builders. Each builder returns the
 * arena bounds + spawn anchors + an optional per-tick callback for
 * dynamic mechanics (rotating platforms, moving hazards, etc.).
 */

export interface ArenaSurface {
  /** Predicate: is the (x, z) point on a valid standing surface? */
  inside: (x: number, z: number) => boolean;
  /** Floor Y at a given (x, z); usually 0. */
  floorY: (x: number, z: number) => number;
  /** Where to spawn the player. */
  playerSpawn: Vector3;
  /** Pre-computed AI spawn positions. */
  aiSpawns: Vector3[];
  /** Optional per-tick callback. */
  tick?: (dt: number) => void;
  dispose: () => void;
}

export type ArenaVariantId = "bonk-island" | "bean-race" | "king-of-bell" | "hot-bean";

const PLATFORM_DARK = new Color3(0.18, 0.12, 0.24);
const ACCENT_PINK = new Color3(0.85, 0.4, 0.65);
const ACCENT_BLUE = new Color3(0.42, 0.65, 0.95);
const ACCENT_GOLD = new Color3(1, 0.85, 0.42);

// ============== BONK ISLAND (default) ==============
export function buildBonkIsland(scene: Scene): ArenaSurface {
  const ARENA_RADIUS = 12;
  const root = new TransformNode("bonk-island", scene);

  const platform = MeshBuilder.CreateCylinder(
    "bonk-island-platform",
    { diameterTop: ARENA_RADIUS * 2 - 0.5, diameterBottom: ARENA_RADIUS * 2 + 1, height: 1.4, tessellation: 48 },
    scene,
  );
  platform.parent = root;
  platform.position.y = -0.7;
  const platMat = new StandardMaterial("bonk-island-mat", scene);
  platMat.diffuseColor = new Color3(0.65, 0.45, 0.7);
  platform.material = platMat;

  const aiSpawns: Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 + 0.4;
    aiSpawns.push(new Vector3(Math.cos(ang) * 7, 1, Math.sin(ang) * 7));
  }

  return {
    inside: (x, z) => Math.hypot(x, z) <= ARENA_RADIUS,
    floorY: () => 0,
    playerSpawn: new Vector3(0, 1, 6),
    aiSpawns,
    dispose: () => root.dispose(),
  };
}

// ============== BEAN RACE (linear platform path) ==============
export function buildBeanRace(scene: Scene): ArenaSurface {
  const root = new TransformNode("bean-race", scene);
  const segments = 6;
  const segmentWidth = 4;
  const segmentLength = 8;
  const gap = 1.2;
  const totalLength = segments * (segmentLength + gap);

  for (let i = 0; i < segments; i++) {
    const segment = MeshBuilder.CreateBox(
      `race-seg-${i}`,
      { width: segmentWidth, height: 1, depth: segmentLength },
      scene,
    );
    segment.parent = root;
    segment.position.set(0, -0.5, i * (segmentLength + gap));
    const m = new StandardMaterial(`race-seg-mat-${i}`, scene);
    // Alternate pink and blue for visual rhythm
    m.diffuseColor = i % 2 === 0 ? ACCENT_PINK : ACCENT_BLUE;
    m.emissiveColor = m.diffuseColor.scale(0.18);
    segment.material = m;

    // Edge trim torus (visual indicator of safe zone)
    const trim = MeshBuilder.CreateTorus(
      `race-trim-${i}`,
      { diameter: segmentLength * 1.05, thickness: 0.06, tessellation: 24 },
      scene,
    );
    trim.parent = root;
    trim.position.set(0, 0.04, i * (segmentLength + gap));
    trim.scaling.set(segmentWidth / segmentLength, 1, 1);
    const tm = new StandardMaterial(`race-trim-mat-${i}`, scene);
    tm.diffuseColor = ACCENT_GOLD;
    tm.emissiveColor = ACCENT_GOLD.scale(0.5);
    trim.material = tm;
  }

  // Goal bell at the end
  const bell = MeshBuilder.CreateCylinder(
    "race-bell",
    { diameterTop: 1.6, diameterBottom: 0.6, height: 1.4, tessellation: 16 },
    scene,
  );
  bell.parent = root;
  bell.position.set(0, 1.5, totalLength - segmentLength / 2);
  const bellMat = new StandardMaterial("race-bell-mat", scene);
  bellMat.diffuseColor = ACCENT_GOLD;
  bellMat.emissiveColor = ACCENT_GOLD.scale(0.5);
  bell.material = bellMat;

  // Bell sway
  const sway = new Animation("bell-sway", "rotation.z", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
  sway.setKeys([{ frame: 0, value: -0.1 }, { frame: 60, value: 0.1 }, { frame: 120, value: -0.1 }]);
  bell.animations.push(sway);
  scene.beginAnimation(bell, 0, 120, true, 0.6);

  const aiSpawns: Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    aiSpawns.push(new Vector3(-1.5 + i * 0.8, 1, 0));
  }

  return {
    inside: (x, z) => {
      // Player must stand on a segment OR within the gap penalty range
      if (Math.abs(x) > segmentWidth / 2) return false;
      const segIdx = Math.floor(z / (segmentLength + gap));
      if (segIdx < 0 || segIdx >= segments) return false;
      const localZ = z - segIdx * (segmentLength + gap);
      return localZ >= -0.1 && localZ <= segmentLength + 0.1;
    },
    floorY: () => 0,
    playerSpawn: new Vector3(0, 1, 0),
    aiSpawns,
    dispose: () => root.dispose(),
  };
}

// ============== KING OF THE BELL (rotating platform with bell) ==============
export function buildKingOfBell(scene: Scene): ArenaSurface {
  const ARENA_RADIUS = 10;
  const root = new TransformNode("kob", scene);

  const platform = MeshBuilder.CreateCylinder(
    "kob-platform",
    { diameterTop: ARENA_RADIUS * 2, diameterBottom: ARENA_RADIUS * 2 + 0.6, height: 1.0, tessellation: 64 },
    scene,
  );
  platform.parent = root;
  platform.position.y = -0.5;
  const platMat = new StandardMaterial("kob-mat", scene);
  platMat.diffuseColor = new Color3(0.32, 0.42, 0.65);
  platform.material = platMat;

  // Center capture zone — glowing disc
  const zone = MeshBuilder.CreateCylinder(
    "kob-zone",
    { diameter: 4.5, height: 0.18, tessellation: 32 },
    scene,
  );
  zone.parent = root;
  zone.position.y = 0.05;
  const zoneMat = new StandardMaterial("kob-zone-mat", scene);
  zoneMat.diffuseColor = ACCENT_GOLD;
  zoneMat.emissiveColor = ACCENT_GOLD.scale(0.6);
  zone.material = zoneMat;

  // Hovering bell at the center, slowly rotating
  const bell = MeshBuilder.CreateCylinder(
    "kob-bell",
    { diameterTop: 1.4, diameterBottom: 0.5, height: 1.2, tessellation: 16 },
    scene,
  );
  bell.parent = root;
  bell.position.y = 4;
  const bellMat = new StandardMaterial("kob-bell-mat", scene);
  bellMat.diffuseColor = ACCENT_GOLD;
  bellMat.emissiveColor = ACCENT_GOLD.scale(0.45);
  bell.material = bellMat;

  // Slow orbit + spin
  const spin = new Animation("kob-bell-spin", "rotation.y", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
  spin.setKeys([{ frame: 0, value: 0 }, { frame: 600, value: Math.PI * 2 }]);
  bell.animations.push(spin);
  scene.beginAnimation(bell, 0, 600, true, 0.4);

  // Outer hazard ring — slow rotating (just visual for now, no collision)
  const ring = MeshBuilder.CreateTorus(
    "kob-hazard-ring",
    { diameter: ARENA_RADIUS * 2 - 1.5, thickness: 0.1, tessellation: 64 },
    scene,
  );
  ring.parent = root;
  ring.position.y = 0.05;
  const ringMat = new StandardMaterial("kob-ring-mat", scene);
  ringMat.diffuseColor = ACCENT_PINK;
  ringMat.emissiveColor = ACCENT_PINK.scale(0.45);
  ring.material = ringMat;

  const ringSpin = new Animation("kob-ring-spin", "rotation.y", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
  ringSpin.setKeys([{ frame: 0, value: 0 }, { frame: 1200, value: Math.PI * 2 }]);
  ring.animations.push(ringSpin);
  scene.beginAnimation(ring, 0, 1200, true, 0.3);

  const aiSpawns: Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 + 0.4;
    aiSpawns.push(new Vector3(Math.cos(ang) * 6, 1, Math.sin(ang) * 6));
  }

  return {
    inside: (x, z) => Math.hypot(x, z) <= ARENA_RADIUS,
    floorY: () => 0,
    playerSpawn: new Vector3(0, 1, 4),
    aiSpawns,
    dispose: () => root.dispose(),
  };
}

// ============== HOT BEAN (small ring with center spike) ==============
export function buildHotBean(scene: Scene): ArenaSurface {
  const ARENA_RADIUS = 8;
  const root = new TransformNode("hot-bean", scene);

  const platform = MeshBuilder.CreateCylinder(
    "hot-bean-platform",
    { diameterTop: ARENA_RADIUS * 2, diameterBottom: ARENA_RADIUS * 2 + 0.4, height: 1.0, tessellation: 32 },
    scene,
  );
  platform.parent = root;
  platform.position.y = -0.5;
  const platMat = new StandardMaterial("hot-bean-mat", scene);
  platMat.diffuseColor = new Color3(0.85, 0.42, 0.22);
  platMat.emissiveColor = platMat.diffuseColor.scale(0.18);
  platform.material = platMat;

  // Center pillar — danger zone
  const pillar = MeshBuilder.CreateCylinder(
    "hot-bean-pillar",
    { diameterTop: 0.8, diameterBottom: 1.2, height: 3, tessellation: 16 },
    scene,
  );
  pillar.parent = root;
  pillar.position.y = 1.4;
  const pillarMat = new StandardMaterial("pillar-mat", scene);
  pillarMat.diffuseColor = new Color3(0.95, 0.32, 0.18);
  pillarMat.emissiveColor = pillarMat.diffuseColor.scale(0.6);
  pillar.material = pillarMat;

  // Pulse animation on pillar (urgent feel)
  const pulse = new Animation("pillar-pulse", "scaling.y", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
  pulse.setKeys([{ frame: 0, value: 1 }, { frame: 30, value: 1.15 }, { frame: 60, value: 1 }]);
  pillar.animations.push(pulse);
  scene.beginAnimation(pillar, 0, 60, true, 1.5);

  const aiSpawns: Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    aiSpawns.push(new Vector3(Math.cos(ang) * 5, 1, Math.sin(ang) * 5));
  }

  return {
    inside: (x, z) => {
      const r = Math.hypot(x, z);
      return r <= ARENA_RADIUS && r >= 1.6;
    },
    floorY: () => 0,
    playerSpawn: new Vector3(0, 1, 4),
    aiSpawns,
    dispose: () => root.dispose(),
  };
}

export function buildArenaSurface(scene: Scene, variant: ArenaVariantId): ArenaSurface {
  switch (variant) {
    case "bean-race":
      return buildBeanRace(scene);
    case "king-of-bell":
      return buildKingOfBell(scene);
    case "hot-bean":
      return buildHotBean(scene);
    case "bonk-island":
    default:
      return buildBonkIsland(scene);
  }
}

// keep imports used
const _unused: Color3 = PLATFORM_DARK;
void _unused;
