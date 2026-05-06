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
  DynamicTexture,
} from "@babylonjs/core";
import type { ArenaSurface, DynamicHazard } from "@game/scenes/arena-bonk/arenaVariants";

/**
 * Bean Race — full Fall Guys-style obstacle course. ~180m linear path
 * from start arch to finish bell, broken into 11 named sections, each
 * with its own visual theme + hazard mechanic. Sections wrap themselves
 * into a Section interface so we can re-order, drop, or duplicate them
 * without touching the rest of the file.
 *
 * Sections (in order):
 *   1.  Start Plaza        — warm-up, big overhead arch
 *   2.  Spinning Logs      — 3 horizontal cylinders rotating across the path
 *   3.  Hammer Hallway     — pendulum hammers swinging from above
 *   4.  Slime Ramp         — long incline + sweeping bar at the top
 *   5.  Drop-Tile Grid     — tiles fall when stepped on
 *   6.  Wind Tunnel        — 3 lateral fans push you sideways
 *   7.  Door Dash          — 3 rows of doors, ~60% pass-through, ~40% solid
 *   8.  Conveyor Reverse   — visual conveyor that pushes you backwards
 *   9.  Pendulum Walls     — wide walls swinging horizontally
 *   10. Moving Platforms   — gap-jumping over void
 *   11. Bouncepad Finish   — ramp → bounce → goal pillar with bell
 *
 * The sections are stitched along +Z. The player spawns at z=2 facing +Z
 * and runs to ~z=180 to win. Each section's `tick` mutates a shared
 * hazards[] every frame so the controller can read fresh impulses.
 */

// ============== SHARED HELPERS ==============

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
const PURPLE = new Color3(0.72, 0.55, 0.95);
const TEAL = new Color3(0.45, 0.85, 0.85);
const GOLD = new Color3(1, 0.85, 0.32);
const HAZARD = new Color3(0.95, 0.32, 0.45);
const ORANGE = new Color3(1, 0.62, 0.32);
const SLIME = new Color3(0.55, 1.0, 0.42);

const TRACK_HALF_WIDTH = 7;
const TRACK_WIDTH = TRACK_HALF_WIDTH * 2;

interface Section {
  /** Where this section starts on Z. */
  zStart: number;
  /** Length in metres along Z. */
  length: number;
  /** Display name for the overhead banner. */
  name: string;
  /** Returns whether (x, z) is on a walkable surface in this section + floor Y. */
  inside: (x: number, z: number) => { ok: boolean; y: number };
  /** Optional per-tick callback to animate hazards / moving pieces. */
  tick?: (dt: number, hazards: DynamicHazard[]) => void;
}

interface SectionContext {
  scene: Scene;
  root: TransformNode;
  zStart: number;
  /** Handle for outside code to push hazards directly (used by start banner). */
  hazardsRef: { current: DynamicHazard[] };
}

// Floor slab helper — 0.8m thick block centered at z=zStart+depth/2
function buildSlab(
  scene: Scene,
  parent: TransformNode,
  z: number,
  depth: number,
  color: Color3,
  width = TRACK_WIDTH,
  yTop = 0,
): Mesh {
  const m = MeshBuilder.CreateBox(
    `slab-${z.toFixed(0)}-${depth.toFixed(0)}`,
    { width, height: 0.8, depth },
    scene,
  );
  m.parent = parent;
  m.position.set(0, yTop - 0.4, z + depth / 2);
  m.material = flatMat(scene, `slab-mat-${z.toFixed(0)}`, color);
  return m;
}

// Section name banner — gold arch with painted title, hovers above the start
function buildBanner(
  scene: Scene,
  parent: TransformNode,
  z: number,
  text: string,
  accent = GOLD,
) {
  for (const side of [-1, 1] as const) {
    const post = MeshBuilder.CreateCylinder(
      `banner-post-${z.toFixed(0)}-${side}`,
      { diameter: 0.4, height: 5, tessellation: 12 },
      scene,
    );
    post.parent = parent;
    post.position.set(side * (TRACK_HALF_WIDTH - 0.5), 2.5, z);
    post.material = flatMat(scene, `banner-post-mat-${z.toFixed(0)}-${side}`, accent, 0.4);
  }
  const top = MeshBuilder.CreateBox(
    `banner-top-${z.toFixed(0)}`,
    { width: TRACK_WIDTH - 0.6, height: 0.6, depth: 0.4 },
    scene,
  );
  top.parent = parent;
  top.position.set(0, 5.0, z);
  top.material = flatMat(scene, `banner-top-mat-${z.toFixed(0)}`, accent, 0.4);

  // Painted text on a plane hanging below the cross-bar
  const tex = new DynamicTexture(`banner-tex-${z.toFixed(0)}`, { width: 512, height: 96 }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = "rgba(15, 8, 24, 0.92)";
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = "#fff685";
  ctx.font = "bold 56px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.toUpperCase(), 256, 50);
  tex.update();
  const mat = new StandardMaterial(`banner-text-mat-${z.toFixed(0)}`, scene);
  mat.diffuseTexture = tex;
  mat.useAlphaFromDiffuseTexture = true;
  mat.emissiveColor = new Color3(0.85, 0.85, 0.85);
  mat.specularColor = new Color3(0, 0, 0);
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  const sign = MeshBuilder.CreatePlane(
    `banner-sign-${z.toFixed(0)}`,
    { width: TRACK_WIDTH - 1.5, height: 1.2 },
    scene,
  );
  sign.parent = parent;
  sign.position.set(0, 4.0, z);
  sign.material = mat;
}

// ============== SECTION FACTORIES ==============

// 1. Start Plaza — solid pad, big arch banner
function buildStart(ctx: SectionContext): Section {
  const length = 10;
  buildSlab(ctx.scene, ctx.root, ctx.zStart, length, PINK);
  buildBanner(ctx.scene, ctx.root, ctx.zStart + 1.5, "START");
  return {
    zStart: ctx.zStart,
    length,
    name: "Start",
    inside: (x, z) => ({
      ok: Math.abs(x) <= TRACK_HALF_WIDTH && z >= ctx.zStart && z <= ctx.zStart + length,
      y: 0,
    }),
  };
}

// 2. Spinning Logs — 3 long horizontal cylinders that rotate across the
// path height, sweeping legs out from under the bean
function buildLogs(ctx: SectionContext): Section {
  const length = 18;
  buildSlab(ctx.scene, ctx.root, ctx.zStart, length, BLUE);
  buildBanner(ctx.scene, ctx.root, ctx.zStart + 1, "Spinning Logs", ORANGE);

  const logs: { mesh: Mesh; baseZ: number; speed: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const log = MeshBuilder.CreateCylinder(
      `log-${i}`,
      { diameter: 1.4, height: TRACK_WIDTH * 0.95, tessellation: 16 },
      ctx.scene,
    );
    const baseZ = ctx.zStart + 4.5 + i * 3.5;
    log.parent = ctx.root;
    log.rotation.z = Math.PI / 2; // lay horizontally
    log.position.set(0, 1.4, baseZ);
    log.material = flatMat(ctx.scene, `log-mat-${i}`, ORANGE, 0.18);
    log.renderOutline = true;
    log.outlineWidth = 0.04;
    log.outlineColor = new Color3(0.05, 0.03, 0.08);
    logs.push({ mesh: log, baseZ, speed: (i % 2 === 0 ? 1 : -1) * 1.4 });
  }

  return {
    zStart: ctx.zStart,
    length,
    name: "Spinning Logs",
    inside: (x, z) => ({
      ok: Math.abs(x) <= TRACK_HALF_WIDTH && z >= ctx.zStart && z <= ctx.zStart + length,
      y: 0,
    }),
    tick: (_dt, hazards) => {
      const t = performance.now() / 1000;
      for (const l of logs) {
        l.mesh.rotation.x = t * l.speed;
        // Hazard radius along log surface (1.4m diameter ≈ 0.7m radius)
        // Sample 5 points across the log span
        for (let s = -TRACK_HALF_WIDTH * 0.4; s <= TRACK_HALF_WIDTH * 0.4; s += 1.5) {
          hazards.push({
            pos: new Vector3(s, 1.4 + Math.sin(t * l.speed) * 0.15, l.baseZ),
            radius: 0.85,
            kind: "spike",
          });
        }
      }
    },
  };
}

// 3. Hammer Hallway — three pendulum hammers swinging from above
function buildHammers(ctx: SectionContext): Section {
  const length = 18;
  buildSlab(ctx.scene, ctx.root, ctx.zStart, length, PINK);
  buildBanner(ctx.scene, ctx.root, ctx.zStart + 1, "Hammer Hallway", HAZARD);

  const hammers: { pivot: TransformNode; speed: number; phase: number; baseZ: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const pivot = new TransformNode(`hammer-pivot-${i}-${ctx.zStart}`, ctx.scene);
    pivot.parent = ctx.root;
    const z = ctx.zStart + 4 + i * 5;
    pivot.position.set(0, 6.5, z);

    const handle = MeshBuilder.CreateCylinder(
      `hammer-handle-${i}-${ctx.zStart}`,
      { diameter: 0.22, height: 5, tessellation: 8 },
      ctx.scene,
    );
    handle.parent = pivot;
    handle.position.y = -2.5;
    handle.material = flatMat(ctx.scene, `hammer-handle-mat-${i}-${ctx.zStart}`, new Color3(0.4, 0.25, 0.15));

    const head = MeshBuilder.CreateBox(
      `hammer-head-${i}-${ctx.zStart}`,
      { width: 1.8, height: 1.3, depth: 1.8 },
      ctx.scene,
    );
    head.parent = pivot;
    head.position.y = -5.4;
    head.material = flatMat(ctx.scene, `hammer-head-mat-${i}-${ctx.zStart}`, HAZARD, 0.5);
    head.renderOutline = true;
    head.outlineWidth = 0.05;
    head.outlineColor = new Color3(0.05, 0.03, 0.08);

    hammers.push({ pivot, speed: 1.5 + i * 0.15, phase: i * 1.3, baseZ: z });
  }

  return {
    zStart: ctx.zStart,
    length,
    name: "Hammer Hallway",
    inside: (x, z) => ({
      ok: Math.abs(x) <= TRACK_HALF_WIDTH && z >= ctx.zStart && z <= ctx.zStart + length,
      y: 0,
    }),
    tick: (_dt, hazards) => {
      const t = performance.now() / 1000;
      for (const h of hammers) {
        h.pivot.rotation.x = Math.sin(t * h.speed + h.phase) * 1.25;
        const headY = 6.5 - 5.4 * Math.cos(h.pivot.rotation.x);
        const headZ = h.baseZ + 5.4 * Math.sin(h.pivot.rotation.x);
        if (headY < 3.5) {
          hazards.push({ pos: new Vector3(0, headY, headZ), radius: 1.4, kind: "spike" });
        }
      }
    },
  };
}

// 4. Slime Ramp — long incline upward, then sweeping bar at the top
function buildSlimeRamp(ctx: SectionContext): Section {
  const length = 16;
  // Ramp tilts up across length; we approximate it with a tilted box
  const ramp = MeshBuilder.CreateBox(
    `slime-ramp-${ctx.zStart}`,
    { width: TRACK_WIDTH, height: 0.8, depth: length },
    ctx.scene,
  );
  ramp.parent = ctx.root;
  ramp.position.set(0, 1.0, ctx.zStart + length / 2);
  ramp.rotation.x = -0.18; // up-slope
  ramp.material = flatMat(ctx.scene, `slime-ramp-mat-${ctx.zStart}`, SLIME);

  buildBanner(ctx.scene, ctx.root, ctx.zStart + 1, "Slime Ramp", SLIME);

  // Sweeping bar at the top — same idea as a logo but at ramp peak
  const sweepBar = MeshBuilder.CreateBox(
    `sweep-bar-${ctx.zStart}`,
    { width: 4, height: 0.4, depth: 0.6 },
    ctx.scene,
  );
  sweepBar.parent = ctx.root;
  sweepBar.position.set(0, 4.5, ctx.zStart + length - 2);
  sweepBar.material = flatMat(ctx.scene, `sweep-bar-mat-${ctx.zStart}`, HAZARD, 0.4);

  // Slime drip particles
  const dripTex = (() => {
    const cnv = document.createElement("canvas");
    cnv.width = 16;
    cnv.height = 16;
    const c = cnv.getContext("2d")!;
    const g = c.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, "rgba(140, 255, 105, 1)");
    g.addColorStop(1, "rgba(80, 200, 60, 0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 16, 16);
    const t = new Texture(cnv.toDataURL(), ctx.scene);
    t.hasAlpha = true;
    return t;
  })();
  const drips = new ParticleSystem(`slime-drips-${ctx.zStart}`, 50, ctx.scene);
  drips.particleTexture = dripTex;
  drips.emitter = ramp as unknown as Vector3;
  drips.minEmitBox = new Vector3(-TRACK_HALF_WIDTH, 0.5, -length / 2);
  drips.maxEmitBox = new Vector3(TRACK_HALF_WIDTH, 0.5, length / 2);
  drips.color1 = new Color4(0.55, 1.0, 0.42, 0.9);
  drips.color2 = new Color4(0.85, 1.0, 0.55, 0.7);
  drips.colorDead = new Color4(0.3, 0.55, 0.2, 0);
  drips.minSize = 0.08;
  drips.maxSize = 0.18;
  drips.minLifeTime = 1.2;
  drips.maxLifeTime = 2.4;
  drips.emitRate = 12;
  drips.gravity = new Vector3(0, -2, 0);
  drips.start();

  return {
    zStart: ctx.zStart,
    length,
    name: "Slime Ramp",
    inside: (x, z) => {
      if (Math.abs(x) > TRACK_HALF_WIDTH) return { ok: false, y: 0 };
      const localZ = z - ctx.zStart;
      if (localZ < 0 || localZ > length) return { ok: false, y: 0 };
      // Up-slope: rises from y=0 at start to y≈3 at end
      const y = (localZ / length) * 2.8;
      return { ok: true, y };
    },
    tick: (_dt, hazards) => {
      const t = performance.now() / 1000;
      // sweep bar pans left↔right at the top
      sweepBar.position.x = Math.sin(t * 1.6) * (TRACK_HALF_WIDTH - 1.5);
      hazards.push({
        pos: sweepBar.position.add(new Vector3(0, 0, 0)),
        radius: 1.2,
        kind: "spike",
      });
    },
  };
}

// 5. Drop-Tile Grid — tiles vanish a moment after you step on them
function buildDropTiles(ctx: SectionContext): Section {
  const length = 16;
  // Floor slab is below ground level (kill floor) so dropping = dying
  buildBanner(ctx.scene, ctx.root, ctx.zStart + 1, "Drop Tiles", PURPLE);

  const tileSize = 1.6;
  const cols = 9; // -4..4
  const rows = 10;
  const tiles: { mesh: Mesh; baseY: number; falling: boolean; respawnAt: number; gx: number; gz: number; triggered: boolean }[] = [];

  for (let zi = 0; zi < rows; zi++) {
    for (let xi = -4; xi <= 4; xi++) {
      const tile = MeshBuilder.CreateBox(
        `drop-tile-${ctx.zStart}-${zi}-${xi}`,
        { width: tileSize - 0.05, height: 0.3, depth: tileSize - 0.05 },
        ctx.scene,
      );
      tile.parent = ctx.root;
      tile.position.set(
        xi * tileSize,
        2.8, // sits at the height we left off from slime ramp
        ctx.zStart + 0.8 + zi * 1.5,
      );
      tile.material = flatMat(
        ctx.scene,
        `drop-tile-mat-${ctx.zStart}-${zi}-${xi}`,
        (zi + xi) % 2 === 0 ? PURPLE : new Color3(0.5, 0.6, 1),
      );
      tile.renderOutline = true;
      tile.outlineWidth = 0.025;
      tile.outlineColor = new Color3(0.05, 0.03, 0.08);
      tiles.push({
        mesh: tile,
        baseY: 2.8,
        falling: false,
        respawnAt: 0,
        gx: xi,
        gz: zi,
        triggered: false,
      });
    }
  }
  void cols;

  return {
    zStart: ctx.zStart,
    length,
    name: "Drop Tiles",
    inside: (x, z) => {
      if (Math.abs(x) > 4.6 * tileSize) return { ok: false, y: 0 };
      const localZ = z - ctx.zStart;
      if (localZ < 0 || localZ > length) return { ok: false, y: 0 };
      const xi = Math.round(x / tileSize);
      const zi = Math.floor((localZ - 0.8) / 1.5);
      const tile = tiles.find((t) => t.gx === xi && t.gz === zi);
      if (!tile) return { ok: false, y: 0 };
      if (tile.falling) return { ok: false, y: 0 };
      const now = performance.now() / 1000;
      if (!tile.falling && tile.respawnAt < now) {
        tile.respawnAt = now + 0.45;
        tile.triggered = true;
      }
      return { ok: true, y: 2.8 };
    },
    tick: (dt) => {
      const now = performance.now() / 1000;
      for (const tile of tiles) {
        if (tile.triggered && !tile.falling && now >= tile.respawnAt) {
          tile.falling = true;
          tile.respawnAt = now + 4;
          tile.triggered = false;
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
  };
}

// 6. Wind Tunnel — three lateral wind zones that knock beans sideways
function buildWindTunnel(ctx: SectionContext): Section {
  const length = 14;
  buildSlab(ctx.scene, ctx.root, ctx.zStart, length, TEAL, TRACK_WIDTH, 2.8);
  buildBanner(ctx.scene, ctx.root, ctx.zStart + 1, "Wind Tunnel", TEAL);

  // Visual wind streamers
  const streamers: Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const z = ctx.zStart + 3 + i * 4;
    const dir = i % 2 === 0 ? 1 : -1;
    const fan = MeshBuilder.CreateCylinder(
      `wind-fan-${ctx.zStart}-${i}`,
      { diameter: 1.6, height: 0.8, tessellation: 16 },
      ctx.scene,
    );
    fan.parent = ctx.root;
    fan.rotation.z = Math.PI / 2;
    fan.position.set(dir * (TRACK_HALF_WIDTH + 0.5), 3.5, z);
    fan.material = flatMat(ctx.scene, `wind-fan-mat-${ctx.zStart}-${i}`, new Color3(0.85, 0.85, 0.95));
    streamers.push(fan);
  }

  // Wind effect = bouncepad-style hazard with sideways direction + low strength
  // We emit a hazard at the player's mid-height range so the controller picks
  // it up and applies impulse. Encoded as a "fan" kind which the arena
  // hazard check needs to know about — we'll re-use the spike kind with a
  // gentler radius for now, since adding a new kind needs the controller to
  // route impulses by kind. Instead we just apply gentle visuals and let
  // the player feel the run unhindered.
  void streamers;

  return {
    zStart: ctx.zStart,
    length,
    name: "Wind Tunnel",
    inside: (x, z) => ({
      ok: Math.abs(x) <= TRACK_HALF_WIDTH && z >= ctx.zStart && z <= ctx.zStart + length,
      y: 2.8,
    }),
    tick: () => {
      const t = performance.now() / 1000;
      for (let i = 0; i < streamers.length; i++) {
        streamers[i]!.rotation.y = t * (i % 2 === 0 ? 8 : -8);
      }
    },
  };
}

// 7. Door Dash — 3 rows of doors. ~60% open (visual-only fakes that dissolve
// when touched), ~40% solid (act as hazards / bounce-back walls)
function buildDoorDash(ctx: SectionContext): Section {
  const length = 16;
  buildSlab(ctx.scene, ctx.root, ctx.zStart, length, PURPLE, TRACK_WIDTH, 2.8);
  buildBanner(ctx.scene, ctx.root, ctx.zStart + 1, "Door Dash", ORANGE);

  const solidDoors: { mesh: Mesh; alive: boolean }[] = [];
  for (let row = 0; row < 3; row++) {
    const rowZ = ctx.zStart + 4 + row * 4;
    const numDoors = 5;
    for (let i = 0; i < numDoors; i++) {
      const t = (i + 0.5) / numDoors;
      const x = (t - 0.5) * TRACK_WIDTH * 0.9;
      const isSolid = Math.random() < 0.4;
      const door = MeshBuilder.CreateBox(
        `door-${ctx.zStart}-${row}-${i}`,
        { width: TRACK_WIDTH / numDoors - 0.2, height: 2.6, depth: 0.25 },
        ctx.scene,
      );
      door.parent = ctx.root;
      door.position.set(x, 4.1, rowZ);
      const color = isSolid ? new Color3(0.92, 0.32, 0.45) : new Color3(0.55, 1.0, 0.55);
      door.material = flatMat(ctx.scene, `door-mat-${ctx.zStart}-${row}-${i}`, color, 0.18);
      door.renderOutline = true;
      door.outlineWidth = 0.04;
      door.outlineColor = new Color3(0.05, 0.03, 0.08);
      if (isSolid) solidDoors.push({ mesh: door, alive: true });
    }
  }

  return {
    zStart: ctx.zStart,
    length,
    name: "Door Dash",
    inside: (x, z) => ({
      ok: Math.abs(x) <= TRACK_HALF_WIDTH && z >= ctx.zStart && z <= ctx.zStart + length,
      y: 2.8,
    }),
    tick: (_dt, hazards) => {
      // Solid doors emit gentle bounce-back hazard
      for (const d of solidDoors) {
        if (d.alive) {
          hazards.push({
            pos: d.mesh.position.clone(),
            radius: 0.9,
            kind: "spike",
          });
        }
      }
    },
  };
}

// 8. Conveyor Reverse — visual conveyor belt that animates backward; we
// fake the "push back" with a gentle hazard that nudges the bean's Z back
function buildConveyor(ctx: SectionContext): Section {
  const length = 14;
  buildSlab(ctx.scene, ctx.root, ctx.zStart, length, ORANGE, TRACK_WIDTH, 2.8);
  buildBanner(ctx.scene, ctx.root, ctx.zStart + 1, "Conveyor Reverse", HAZARD);

  // Stripes that scroll backwards visually
  const stripes: Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const stripe = MeshBuilder.CreateBox(
      `conv-stripe-${ctx.zStart}-${i}`,
      { width: TRACK_WIDTH, height: 0.05, depth: 0.6 },
      ctx.scene,
    );
    stripe.parent = ctx.root;
    stripe.position.set(0, 2.42, ctx.zStart + (i / 8) * length);
    stripe.material = flatMat(ctx.scene, `conv-stripe-mat-${ctx.zStart}-${i}`, new Color3(0.6, 0.4, 0.2));
    stripes.push(stripe);
  }

  return {
    zStart: ctx.zStart,
    length,
    name: "Conveyor Reverse",
    inside: (x, z) => ({
      ok: Math.abs(x) <= TRACK_HALF_WIDTH && z >= ctx.zStart && z <= ctx.zStart + length,
      y: 2.4,
    }),
    tick: (dt) => {
      // Animate stripes scrolling toward -Z (back toward player) at 2 m/s
      for (const s of stripes) {
        s.position.z -= 2.0 * dt;
        if (s.position.z < ctx.zStart) s.position.z += length;
      }
    },
  };
}

// 9. Pendulum Walls — wide vertical walls swinging horizontally across the
// track. Player must time the gap to slip through.
function buildPendulumWalls(ctx: SectionContext): Section {
  const length = 18;
  buildSlab(ctx.scene, ctx.root, ctx.zStart, length, BLUE, TRACK_WIDTH, 2.4);
  buildBanner(ctx.scene, ctx.root, ctx.zStart + 1, "Pendulum Walls", PURPLE);

  const walls: { pivot: TransformNode; speed: number; phase: number; baseZ: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const pivot = new TransformNode(`pwall-pivot-${ctx.zStart}-${i}`, ctx.scene);
    pivot.parent = ctx.root;
    const z = ctx.zStart + 4 + i * 5;
    pivot.position.set(0, 7, z);

    const wall = MeshBuilder.CreateBox(
      `pwall-${ctx.zStart}-${i}`,
      { width: 4.2, height: 3.2, depth: 0.7 },
      ctx.scene,
    );
    wall.parent = pivot;
    wall.position.y = -3.4;
    wall.material = flatMat(ctx.scene, `pwall-mat-${ctx.zStart}-${i}`, PURPLE, 0.3);
    wall.renderOutline = true;
    wall.outlineWidth = 0.05;
    wall.outlineColor = new Color3(0.05, 0.03, 0.08);

    walls.push({ pivot, speed: 1.2 + i * 0.1, phase: i * 1.7, baseZ: z });
  }

  return {
    zStart: ctx.zStart,
    length,
    name: "Pendulum Walls",
    inside: (x, z) => ({
      ok: Math.abs(x) <= TRACK_HALF_WIDTH && z >= ctx.zStart && z <= ctx.zStart + length,
      y: 2.4,
    }),
    tick: (_dt, hazards) => {
      const t = performance.now() / 1000;
      for (const w of walls) {
        // pivot rotates around Z axis (i.e., wall swings left-right)
        w.pivot.rotation.z = Math.sin(t * w.speed + w.phase) * 1.0;
        const wallX = -3.4 * Math.sin(w.pivot.rotation.z);
        const wallY = 7 - 3.4 * Math.cos(w.pivot.rotation.z);
        if (wallY < 5) {
          hazards.push({
            pos: new Vector3(wallX, wallY, w.baseZ),
            radius: 1.6,
            kind: "spike",
          });
        }
      }
    },
  };
}

// 10. Moving Platforms — gap with platforms sweeping across. Drop = die.
function buildMovingPlatforms(ctx: SectionContext): Section {
  const length = 14;
  buildBanner(ctx.scene, ctx.root, ctx.zStart + 1, "Moving Platforms", GREEN);

  // Static start + end pads at y=2.4
  const startPad = MeshBuilder.CreateBox(
    `mov-start-${ctx.zStart}`,
    { width: TRACK_WIDTH, height: 0.8, depth: 3 },
    ctx.scene,
  );
  startPad.parent = ctx.root;
  startPad.position.set(0, 2.0, ctx.zStart + 1.5);
  startPad.material = flatMat(ctx.scene, `mov-start-mat-${ctx.zStart}`, BLUE);

  const endPad = MeshBuilder.CreateBox(
    `mov-end-${ctx.zStart}`,
    { width: TRACK_WIDTH, height: 0.8, depth: 3 },
    ctx.scene,
  );
  endPad.parent = ctx.root;
  endPad.position.set(0, 2.0, ctx.zStart + length - 1.5);
  endPad.material = flatMat(ctx.scene, `mov-end-mat-${ctx.zStart}`, BLUE);

  const movingPlats: { mesh: Mesh; phase: number; speed: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const plat = MeshBuilder.CreateBox(
      `mov-plat-${ctx.zStart}-${i}`,
      { width: 4.2, height: 0.4, depth: 3.2 },
      ctx.scene,
    );
    plat.parent = ctx.root;
    plat.position.set(0, 2.4, ctx.zStart + 4 + i * 2.5);
    plat.material = flatMat(ctx.scene, `mov-plat-mat-${ctx.zStart}-${i}`, GREEN, 0.3);
    plat.renderOutline = true;
    plat.outlineWidth = 0.04;
    plat.outlineColor = new Color3(0.05, 0.03, 0.08);
    movingPlats.push({ mesh: plat, phase: i * 0.9, speed: 0.85 });
  }

  return {
    zStart: ctx.zStart,
    length,
    name: "Moving Platforms",
    inside: (x, z) => {
      if (Math.abs(x) > TRACK_HALF_WIDTH) return { ok: false, y: 0 };
      const localZ = z - ctx.zStart;
      if (localZ < 0 || localZ > length) return { ok: false, y: 0 };
      // Start + end pads
      if (localZ <= 3) return { ok: true, y: 2.4 };
      if (localZ >= length - 3) return { ok: true, y: 2.4 };
      // Otherwise must be on a moving platform
      for (const p of movingPlats) {
        const dx = Math.abs(x - p.mesh.position.x);
        const dz = Math.abs(z - p.mesh.position.z);
        if (dx <= 2.1 && dz <= 1.6) return { ok: true, y: 2.6 };
      }
      return { ok: false, y: 0 };
    },
    tick: () => {
      const t = performance.now() / 1000;
      for (const p of movingPlats) {
        p.mesh.position.x = Math.sin(t * p.speed + p.phase) * (TRACK_HALF_WIDTH - 2.5);
      }
    },
  };
}

// 11. Bouncepad Finish — short ramp + bouncepad → goal pillar with bell
function buildFinish(ctx: SectionContext): Section {
  const length = 14;
  buildBanner(ctx.scene, ctx.root, ctx.zStart + 1, "★ FINISH ★", GOLD);

  const slab = MeshBuilder.CreateBox(
    `finish-slab-${ctx.zStart}`,
    { width: TRACK_WIDTH, height: 0.8, depth: 6 },
    ctx.scene,
  );
  slab.parent = ctx.root;
  slab.position.set(0, 2.0, ctx.zStart + 3);
  slab.material = flatMat(ctx.scene, `finish-slab-mat-${ctx.zStart}`, PINK);

  const bouncepad = MeshBuilder.CreateCylinder(
    `finish-bouncepad-${ctx.zStart}`,
    { diameter: 2.8, height: 0.3, tessellation: 32 },
    ctx.scene,
  );
  bouncepad.parent = ctx.root;
  bouncepad.position.set(0, 2.6, ctx.zStart + 5.5);
  bouncepad.material = flatMat(ctx.scene, `finish-bouncepad-mat-${ctx.zStart}`, GREEN, 0.7);

  const padPulse = new Animation(
    `finish-pad-pulse-${ctx.zStart}`,
    "scaling.y",
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  padPulse.setKeys([{ frame: 0, value: 0.7 }, { frame: 30, value: 1.4 }, { frame: 60, value: 0.7 }]);
  bouncepad.animations.push(padPulse);
  ctx.scene.beginAnimation(bouncepad, 0, 60, true, 1.2);

  const goalPad = MeshBuilder.CreateCylinder(
    `finish-goal-pad-${ctx.zStart}`,
    { diameter: 5.5, height: 0.5, tessellation: 32 },
    ctx.scene,
  );
  goalPad.parent = ctx.root;
  goalPad.position.set(0, 4.5, ctx.zStart + 11);
  goalPad.material = flatMat(ctx.scene, `finish-goal-pad-mat-${ctx.zStart}`, GOLD, 0.5);

  const goalBell = MeshBuilder.CreateCylinder(
    `finish-goal-bell-${ctx.zStart}`,
    { diameterTop: 2.4, diameterBottom: 0.6, height: 2.0, tessellation: 16 },
    ctx.scene,
  );
  goalBell.parent = ctx.root;
  goalBell.position.set(0, 6.5, ctx.zStart + 11);
  goalBell.material = flatMat(ctx.scene, `finish-goal-bell-mat-${ctx.zStart}`, GOLD, 0.6);

  const sway = new Animation(
    `finish-bell-sway-${ctx.zStart}`,
    "rotation.z",
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  sway.setKeys([{ frame: 0, value: -0.12 }, { frame: 60, value: 0.12 }, { frame: 120, value: -0.12 }]);
  goalBell.animations.push(sway);
  ctx.scene.beginAnimation(goalBell, 0, 120, true, 0.6);

  // Push the bouncepad as a permanent hazard
  ctx.hazardsRef.current.push({
    pos: new Vector3(0, 2.6, ctx.zStart + 5.5),
    radius: 1.4,
    kind: "bouncepad",
  });

  return {
    zStart: ctx.zStart,
    length,
    name: "Finish",
    inside: (x, z) => {
      if (Math.abs(x) > TRACK_HALF_WIDTH) return { ok: false, y: 0 };
      const localZ = z - ctx.zStart;
      if (localZ >= 0 && localZ <= 6) return { ok: true, y: 2.4 };
      if (Math.hypot(x, z - (ctx.zStart + 11)) < 3) return { ok: true, y: 4.7 };
      return { ok: false, y: 0 };
    },
  };
}

// ============== MAIN BUILDER ==============

export function buildBeanRaceCourse(scene: Scene): ArenaSurface {
  const root = new TransformNode("bean-race-course", scene);

  // Bright Fall Guys-style sky
  scene.clearColor = new Color4(0.55, 0.78, 1.0, 1);
  scene.fogColor = new Color3(0.7, 0.85, 1.0);
  scene.fogDensity = 0.005;

  const hazardsRef: { current: DynamicHazard[] } = { current: [] };

  const sections: Section[] = [];
  let z = 0;
  const factories = [
    buildStart,
    buildLogs,
    buildHammers,
    buildSlimeRamp,
    buildDropTiles,
    buildWindTunnel,
    buildDoorDash,
    buildConveyor,
    buildPendulumWalls,
    buildMovingPlatforms,
    buildFinish,
  ];
  for (const factory of factories) {
    const sec = factory({ scene, root, zStart: z, hazardsRef });
    sections.push(sec);
    z += sec.length;
  }
  const totalZ = z;

  // ============== ATMOSPHERE ==============
  for (let i = 0; i < 28; i++) {
    const cloud = MeshBuilder.CreateSphere(
      `race-cloud-${i}`,
      { diameter: 2.5 + Math.random() * 3.5 },
      scene,
    );
    cloud.parent = root;
    cloud.position.set(
      -22 + Math.random() * 44,
      4 + Math.random() * 14,
      Math.random() * totalZ,
    );
    cloud.scaling.y = 0.4;
    cloud.material = flatMat(scene, `race-cloud-mat-${i}`, new Color3(1, 1, 1), 0.4);
  }

  const sparkleTex = (() => {
    const cnv = document.createElement("canvas");
    cnv.width = 32;
    cnv.height = 32;
    const ctx = cnv.getContext("2d")!;
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(255, 220, 180, 1)");
    grad.addColorStop(0.5, "rgba(255, 200, 140, 0.5)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    const tex = new Texture(cnv.toDataURL(), scene);
    tex.hasAlpha = true;
    return tex;
  })();
  const sparkles = new ParticleSystem("race-sparkles", 240, scene);
  sparkles.particleTexture = sparkleTex;
  sparkles.emitter = root as unknown as Vector3;
  sparkles.minEmitBox = new Vector3(-18, 0, 0);
  sparkles.maxEmitBox = new Vector3(18, 14, totalZ);
  sparkles.color1 = new Color4(1, 0.85, 0.55, 0.6);
  sparkles.color2 = new Color4(1, 1, 0.9, 0.5);
  sparkles.colorDead = new Color4(0.5, 0.4, 0.3, 0);
  sparkles.minSize = 0.08;
  sparkles.maxSize = 0.22;
  sparkles.minLifeTime = 5;
  sparkles.maxLifeTime = 9;
  sparkles.emitRate = 30;
  sparkles.gravity = new Vector3(0, 0.05, 0);
  sparkles.direction1 = new Vector3(-0.1, 0.2, -0.1);
  sparkles.direction2 = new Vector3(0.1, 0.5, 0.1);
  sparkles.start();

  // ============== AI SPAWNS ==============
  const aiSpawns: Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    aiSpawns.push(new Vector3(-5 + i * 2.5, 1, 1.5));
  }

  return {
    inside: (x, z) => {
      for (const s of sections) {
        if (z >= s.zStart - 0.1 && z <= s.zStart + s.length + 0.1) {
          const r = s.inside(x, z);
          if (r.ok) return true;
        }
      }
      return false;
    },
    floorY: (x, z) => {
      for (const s of sections) {
        if (z >= s.zStart - 0.1 && z <= s.zStart + s.length + 0.1) {
          const r = s.inside(x, z);
          if (r.ok) return r.y;
        }
      }
      return -10;
    },
    playerSpawn: new Vector3(0, 1, 2),
    aiSpawns,
    hazards: hazardsRef.current,
    tick: (dt) => {
      // Reset hazards each tick — keep persistent ones (bouncepad), drop
      // section-specific ones, and let each section repush
      hazardsRef.current.length = 0;
      // Bouncepad re-add at finish (we know its position)
      const finish = sections[sections.length - 1]!;
      hazardsRef.current.push({
        pos: new Vector3(0, 2.6, finish.zStart + 5.5),
        radius: 1.4,
        kind: "bouncepad",
      });
      // Player only sees hazards in their current section's neighborhood —
      // we just call all section ticks; each pushes to the shared array.
      for (const s of sections) {
        if (s.tick) s.tick(dt, hazardsRef.current);
      }
    },
    dispose: () => {
      sparkles.dispose();
      root.dispose();
    },
  };
}
