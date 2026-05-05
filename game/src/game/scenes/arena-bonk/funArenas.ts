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
 * Three more Fall Guys-style mini-game arenas:
 *   - Jump Club:  rotating beam at center sweeps through arena, jump it
 *   - Hex-A-Gone: tiered hexagonal tile floors that disappear when stepped on
 *   - Block Party: walls slide toward you, dodge through gaps
 */

function flatMat(scene: Scene, name: string, c: Color3, em = 0.1): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = c;
  m.specularColor = new Color3(0.1, 0.1, 0.1);
  m.emissiveColor = c.scale(em);
  return m;
}

function ambientSparkle(scene: Scene, color: string, parent: TransformNode, area = 14): ParticleSystem {
  const cnv = document.createElement("canvas");
  cnv.width = 32; cnv.height = 32;
  const ctx = cnv.getContext("2d")!;
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, color);
  grad.addColorStop(0.5, color.replace(/, 1\)/, ", 0.4)"));
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  const tex = new Texture(cnv.toDataURL(), scene);
  tex.hasAlpha = true;
  const ps = new ParticleSystem("sparkle", 220, scene);
  ps.particleTexture = tex;
  ps.emitter = parent as unknown as Vector3;
  ps.minEmitBox = new Vector3(-area, 0, -area);
  ps.maxEmitBox = new Vector3(area, 12, area);
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

// ============== JUMP CLUB ==============
export function buildJumpClub(scene: Scene): ArenaSurface {
  const root = new TransformNode("jump-club", scene);

  scene.clearColor = new Color4(0.18, 0.32, 0.65, 1);
  scene.fogColor = new Color3(0.32, 0.45, 0.78);
  scene.fogDensity = 0.012;

  const ARENA_R = 10;

  const platform = MeshBuilder.CreateCylinder(
    "jc-platform",
    { diameterTop: ARENA_R * 2, diameterBottom: ARENA_R * 2 + 0.8, height: 1.0, tessellation: 64 },
    scene,
  );
  platform.parent = root;
  platform.position.y = -0.5;
  platform.material = flatMat(scene, "jc-mat", new Color3(0.3, 0.55, 0.95));

  // Center pillar (decorative)
  const pillar = MeshBuilder.CreateCylinder(
    "jc-pillar",
    { diameter: 1.2, height: 1.4, tessellation: 16 },
    scene,
  );
  pillar.parent = root;
  pillar.position.y = 0.7;
  pillar.material = flatMat(scene, "jc-pillar-mat", new Color3(0.95, 0.85, 0.32), 0.45);

  // The dreaded sweeping beam
  const beam = MeshBuilder.CreateBox(
    "jc-beam",
    { width: ARENA_R * 1.95, height: 0.5, depth: 0.7 },
    scene,
  );
  beam.parent = root;
  beam.position.y = 0.65;
  beam.material = flatMat(scene, "jc-beam-mat", new Color3(0.95, 0.32, 0.45), 0.55);

  // Spin animation — picks up speed as match goes (Fall Guys style)
  const spin = new Animation("jc-spin", "rotation.y", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
  spin.setKeys([{ frame: 0, value: 0 }, { frame: 360, value: Math.PI * 2 }]);
  beam.animations.push(spin);
  scene.beginAnimation(beam, 0, 360, true, 0.7);

  // Outer hazard ring (visual only)
  const ring = MeshBuilder.CreateTorus(
    "jc-ring",
    { diameter: ARENA_R * 2 - 0.6, thickness: 0.12, tessellation: 64 },
    scene,
  );
  ring.parent = root;
  ring.position.y = 0.05;
  ring.material = flatMat(scene, "jc-ring-mat", new Color3(1, 0.85, 0.42), 0.5);

  ambientSparkle(scene, "rgba(180, 220, 255, 1)", root, ARENA_R);

  const aiSpawns: Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 + 0.5;
    aiSpawns.push(new Vector3(Math.cos(ang) * 7, 1, Math.sin(ang) * 7));
  }

  const hazards: DynamicHazard[] = [];

  return {
    inside: (x, z) => Math.hypot(x, z) <= ARENA_R,
    floorY: () => 0,
    playerSpawn: new Vector3(0, 1, 7),
    aiSpawns,
    hazards,
    tick: () => {
      const t = performance.now() / 1000;
      // Beam hazard sweeps; populate hazard array along its world length
      hazards.length = 0;
      const ang = beam.rotation.y;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      // Speed up over time (Fall Guys gets faster every cycle)
      beam.rotation.y += 0.005 + Math.min(0.02, t * 0.0003);
      for (let s = -ARENA_R * 0.95; s <= ARENA_R * 0.95; s += 1) {
        hazards.push({
          pos: new Vector3(s * cos, 0.65, s * sin),
          radius: 0.7,
          kind: "spike",
        });
      }
    },
    dispose: () => root.dispose(),
  };
}

// ============== HEX-A-GONE ==============
export function buildHexAGone(scene: Scene): ArenaSurface {
  const root = new TransformNode("hex-a-gone", scene);

  scene.clearColor = new Color4(0.18, 0.55, 0.92, 1);
  scene.fogColor = new Color3(0.42, 0.7, 1);
  scene.fogDensity = 0.012;

  // Multiple tiers of hex tiles, each tier 3m below the next
  const TIER_COUNT = 3;
  const tiers: { mesh: Mesh; baseY: number; falling: boolean; respawnAt: number; gx: number; gz: number; tier: number }[] = [];

  const HEX_SIZE = 1.4;
  const ROWS = 8;
  const COLS = 8;

  for (let tier = 0; tier < TIER_COUNT; tier++) {
    const tierY = -tier * 3.2;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const xOff = (c - COLS / 2) * HEX_SIZE * Math.sqrt(3);
        const zOff = (r - ROWS / 2) * HEX_SIZE * 1.5;
        const x = xOff + (r % 2 === 0 ? 0 : (HEX_SIZE * Math.sqrt(3)) / 2);
        const z = zOff;
        // Skip outer corners to make a roundish shape
        if (Math.hypot(x, z) > 9) continue;

        const tile = MeshBuilder.CreateCylinder(
          `hex-${tier}-${r}-${c}`,
          { diameter: HEX_SIZE * 1.7, height: 0.4, tessellation: 6 },
          scene,
        );
        tile.parent = root;
        tile.position.set(x, tierY, z);
        tile.material = flatMat(
          scene,
          `hex-mat-${tier}-${r}-${c}`,
          tier === 0
            ? new Color3(0.55, 0.85, 1)
            : tier === 1
            ? new Color3(0.85, 0.55, 1)
            : new Color3(1, 0.55, 0.85),
        );
        tiers.push({
          mesh: tile,
          baseY: tierY,
          falling: false,
          respawnAt: 0,
          gx: x,
          gz: z,
          tier,
        });
      }
    }
  }

  ambientSparkle(scene, "rgba(180, 240, 255, 1)", root, 14);

  const aiSpawns: Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 + 0.4;
    aiSpawns.push(new Vector3(Math.cos(ang) * 6, 1, Math.sin(ang) * 6));
  }

  return {
    inside: (x, z) => {
      // Find the topmost (highest tier) non-falling tile under the point
      for (const tile of tiers) {
        if (tile.falling) continue;
        const dx = x - tile.gx;
        const dz = z - tile.gz;
        if (Math.hypot(dx, dz) < HEX_SIZE * 0.85) {
          // Mark for fall (Fall Guys: ~0.35s telegraph)
          if (tile.respawnAt === 0) {
            tile.respawnAt = performance.now() / 1000 + 0.35;
          }
          return true;
        }
      }
      return false;
    },
    floorY: (x, z) => {
      for (const tile of tiers) {
        if (tile.falling) continue;
        const dx = x - tile.gx;
        const dz = z - tile.gz;
        if (Math.hypot(dx, dz) < HEX_SIZE * 0.85) return tile.baseY + 0.2;
      }
      return -10;
    },
    playerSpawn: new Vector3(0, 1, 6),
    aiSpawns,
    hazards: [],
    tick: (dt) => {
      const now = performance.now() / 1000;
      for (const tile of tiers) {
        if (!tile.falling && tile.respawnAt > 0 && now >= tile.respawnAt) {
          tile.falling = true;
          tile.respawnAt = 0;
        }
        if (tile.falling) {
          tile.mesh.position.y -= 9 * dt;
          if (tile.mesh.position.y < tile.baseY - 50) {
            tile.mesh.setEnabled(false);
          }
        }
      }
    },
    dispose: () => root.dispose(),
  };
}

// ============== BLOCK PARTY ==============
export function buildBlockParty(scene: Scene): ArenaSurface {
  const root = new TransformNode("block-party", scene);

  scene.clearColor = new Color4(0.55, 0.32, 0.65, 1);
  scene.fogColor = new Color3(0.78, 0.45, 0.85);
  scene.fogDensity = 0.012;

  // Long platform: 6m wide, 30m deep (player walks/runs to dodge walls)
  const platform = MeshBuilder.CreateBox(
    "bp-platform",
    { width: 12, height: 1, depth: 30 },
    scene,
  );
  platform.parent = root;
  platform.position.y = -0.5;
  platform.material = flatMat(scene, "bp-mat", new Color3(0.42, 0.32, 0.55));

  // Sliding walls — each is a U-shape with a gap. They start far away and
  // slide toward the player, then off the back edge.
  interface BPWall {
    mesh: Mesh;
    speed: number;
    // gap offset along X — player must align with gap
    gapX: number;
    initialZ: number;
  }
  const walls: BPWall[] = [];
  const wallGapWidth = 3.5;

  for (let i = 0; i < 5; i++) {
    const startZ = 12 + i * 5;
    const gapX = (Math.random() - 0.5) * 6;

    // Two halves: left segment + right segment with a gap between them
    const leftWidth = (gapX + 6) - wallGapWidth / 2;
    const rightWidth = (6 - gapX) - wallGapWidth / 2;
    if (leftWidth > 0.2) {
      const left = MeshBuilder.CreateBox(`bp-wall-${i}-l`, { width: leftWidth, height: 2.2, depth: 0.5 }, scene);
      left.parent = root;
      left.position.set(-6 + leftWidth / 2, 1.1, startZ);
      left.material = flatMat(scene, `bp-wall-mat-${i}-l`, new Color3(0.95, 0.5, 0.32), 0.3);
      walls.push({ mesh: left, speed: 4 + i * 0.3, gapX, initialZ: startZ });
    }
    if (rightWidth > 0.2) {
      const right = MeshBuilder.CreateBox(`bp-wall-${i}-r`, { width: rightWidth, height: 2.2, depth: 0.5 }, scene);
      right.parent = root;
      right.position.set(6 - rightWidth / 2, 1.1, startZ);
      right.material = flatMat(scene, `bp-wall-mat-${i}-r`, new Color3(0.95, 0.5, 0.32), 0.3);
      walls.push({ mesh: right, speed: 4 + i * 0.3, gapX, initialZ: startZ });
    }
  }

  // Edge trim
  for (const side of [-1, 1] as const) {
    const trim = MeshBuilder.CreateBox(`bp-trim-${side}`, { width: 0.4, height: 0.5, depth: 30 }, scene);
    trim.parent = root;
    trim.position.set(side * 6.2, 0.08, 0);
    trim.material = flatMat(scene, `bp-trim-mat-${side}`, new Color3(1, 0.85, 0.42), 0.5);
  }

  ambientSparkle(scene, "rgba(255, 180, 220, 1)", root, 14);

  const aiSpawns: Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    aiSpawns.push(new Vector3(-2 + i * 1.0, 1, -10));
  }

  return {
    inside: (x, z) => Math.abs(x) <= 6 && z >= -15 && z <= 15,
    floorY: () => 0,
    playerSpawn: new Vector3(0, 1, -10),
    aiSpawns,
    hazards: [],
    tick: (dt) => {
      // Walls slide TOWARD -Z (toward player who starts at z=-10)
      for (const w of walls) {
        w.mesh.position.z -= w.speed * dt;
        if (w.mesh.position.z < -16) {
          // Re-spawn on the far side at +15, randomize gap
          const newGapX = (Math.random() - 0.5) * 6;
          // Approximate: left wall has center on left half, right wall on right half
          const isLeft = w.mesh.position.x < 0;
          const halfWidth = isLeft
            ? (newGapX + 6) - wallGapWidth / 2
            : (6 - newGapX) - wallGapWidth / 2;
          if (halfWidth > 0.2) {
            w.mesh.position.x = isLeft ? -6 + halfWidth / 2 : 6 - halfWidth / 2;
            w.mesh.scaling.x = halfWidth / w.mesh.getBoundingInfo().boundingBox.extendSize.x / 2;
          }
          w.mesh.position.z = 15 + Math.random() * 4;
          w.gapX = newGapX;
        }
      }
    },
    dispose: () => root.dispose(),
  };
}
