import {
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  DirectionalLight,
  Vector3,
  Color3,
  Color4,
  MeshBuilder,
  StandardMaterial,
  Engine,
  TransformNode,
  GlowLayer,
  ParticleSystem,
  Texture,
  Animation,
} from "@babylonjs/core";
import { applyCelShade } from "@game/shaders/celShade";
import { buildBean, type BeanLook } from "@game/systems/character/Bean";
import { useCreator } from "@state/character";
import { useMatch } from "@state/match";
import { hsvToRgbColor, paletteIndexToColor } from "@game/systems/character/colorMap";
import { BonkController, type BonkControllerOptions } from "@game/systems/movement/BonkController";
import { spawnAiDummy, AiDummyController } from "@game/systems/movement/AiDummyController";
import { buildArenaSurface, type ArenaSurface } from "@game/scenes/arena-bonk/arenaVariants";

export interface BonkArenaContext {
  scene: Scene;
  controller: BonkController | null;
  dummies: AiDummyController[];
  surface: ArenaSurface;
  dispose: () => void;
}

let activeArena: BonkArenaContext | null = null;

export function getArenaContext(): BonkArenaContext | null {
  return activeArena;
}

const KILL_FLOOR_Y = -8;

export function buildBonkArenaScene(engine: Engine, canvas: HTMLCanvasElement): Scene {
  const scene = new Scene(engine);

  // ---- Sky / atmosphere
  scene.clearColor = new Color4(0.18, 0.1, 0.28, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.012;
  scene.fogColor = new Color3(0.22, 0.12, 0.32);

  // ---- Camera (third-person follow)
  const camera = new ArcRotateCamera(
    "arena-cam",
    -Math.PI / 2,
    Math.PI / 2.5,
    18,
    new Vector3(0, 1.5, 0),
    scene,
  );
  camera.attachControl(canvas, true);
  camera.minZ = 0.1;
  camera.fov = 0.95;
  camera.wheelPrecision = 30;
  camera.panningSensibility = 0;

  // ---- Lights
  const ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0.2), scene);
  ambient.intensity = 0.7;
  ambient.diffuse = new Color3(0.95, 0.85, 1.0);
  ambient.groundColor = new Color3(0.2, 0.12, 0.28);

  const key = new DirectionalLight("key", new Vector3(-0.4, -0.6, -0.5), scene);
  key.intensity = 1.4;
  key.diffuse = new Color3(1, 0.9, 0.78);

  const rim = new DirectionalLight("rim", new Vector3(0.5, 0.1, 0.8), scene);
  rim.intensity = 0.55;
  rim.diffuse = new Color3(0.55, 0.85, 1.0);

  // ---- ARENA SURFACE (variant-driven)
  const variant = useMatch.getState().variant;
  const surface = buildArenaSurface(scene, variant);
  const arenaRadius = 14; // generous bound; surface.inside() does the real check

  // ---- Below-arena floating debris (depth + scale signal)
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const r = 18 + (i % 3) * 2;
    const debris = MeshBuilder.CreatePolyhedron(
      `debris-${i}`,
      { type: 0, size: 0.6 + (i % 4) * 0.3 },
      scene,
    );
    debris.position.set(
      Math.cos(ang) * r,
      -3 - (i % 4) * 1.2,
      Math.sin(ang) * r,
    );
    const dm = new StandardMaterial(`debris-mat-${i}`, scene);
    dm.diffuseColor = new Color3(0.45, 0.32, 0.5);
    dm.specularColor = new Color3(0.08, 0.08, 0.12);
    debris.material = dm;
  }

  // ---- Ambient particles (party-game vibe)
  const motes = new ParticleSystem("arena-motes", 200, scene);
  const motesTex = createDot(scene, "rgba(255, 220, 180, 1)");
  motes.particleTexture = motesTex;
  motes.emitter = new Vector3(0, 4, 0);
  motes.minEmitBox = new Vector3(-arenaRadius, 0, -arenaRadius);
  motes.maxEmitBox = new Vector3(arenaRadius, 12, arenaRadius);
  motes.color1 = new Color4(1, 0.85, 0.55, 0.5);
  motes.color2 = new Color4(0.78, 0.55, 1, 0.45);
  motes.colorDead = new Color4(0.4, 0.3, 0.5, 0);
  motes.minSize = 0.06;
  motes.maxSize = 0.18;
  motes.minLifeTime = 4;
  motes.maxLifeTime = 9;
  motes.emitRate = 25;
  motes.gravity = new Vector3(0, 0.05, 0);
  motes.direction1 = new Vector3(-0.05, 0.2, -0.05);
  motes.direction2 = new Vector3(0.05, 0.5, 0.05);
  motes.start();

  // ---- PLAYER BEAN
  const playerRoot = new TransformNode("arena-player-root", scene);
  playerRoot.position = surface.playerSpawn.clone();

  const sliders = useCreator.getState().sliders;
  const cosmetic = useCreator.getState().cosmetic;
  const baseColor = paletteIndexToColor(sliders.skin.paletteIndex);
  const hairStop = sliders.hair.gradient[0] ?? { h: 30, s: 80, v: 32 };
  const accentColor = hsvToRgbColor(hairStop.h, hairStop.s, hairStop.v);
  const playerLook: BeanLook = {
    heritage: sliders.heritage,
    bodyColor: baseColor,
    patternColor: accentColor,
    pattern: cosmetic.pattern,
    eyeStyle: cosmetic.eyeStyle,
    mouthStyle: cosmetic.mouthStyle,
    hat: cosmetic.hat,
    outfit: cosmetic.outfit,
    accessory: cosmetic.accessory,
  };
  const playerBean = buildBean(scene, playerRoot, playerLook);

  // ---- AI DUMMIES (one per arena's spawn anchors)
  const dummies: AiDummyController[] = [];
  surface.aiSpawns.forEach((pos, i) => {
    const dummy = spawnAiDummy(scene, pos, i);
    dummies.push(dummy);
  });
  const dummyCount = dummies.length;

  // Wire AI: each dummy gets surface ref (for floor) + targets list
  for (const ai of dummies) {
    const attackSource: any = {
      surface,
      getTargets: () => [
        { root: playerRoot, alive: true },
        ...dummies
          .filter((d) => d !== ai && d.alive)
          .map((d) => ({ root: d.root, alive: d.alive })),
      ],
      onBonk: (target: TransformNode, attacker: AiDummyController) => {
        const dir = target.position.subtract(attacker.root.position).normalize();
        if (target === playerRoot) {
          controller.applyKnockback(dir.scale(8), 1.5);
          spawnBonkBurst(scene, target.position.clone());
          cameraShake(camera, 0.12, 0.18);
        } else {
          const targetDummy = dummies.find((d) => d.root === target);
          if (targetDummy) {
            targetDummy.applyKnockback(dir.scale(9), 2);
            spawnBonkBurst(scene, target.position.clone());
          }
        }
      },
    };
    ai.setAttackSource(attackSource);
  }

  // ---- PLAYER CONTROLLER (movement + bonk)
  const opts: BonkControllerOptions = {
    scene,
    root: playerRoot,
    bean: playerBean,
    camera,
    arenaRadius,
    isOnSurface: (x, z) => surface.inside(x, z),
    surfaceFloorY: (x, z) => surface.floorY(x, z),
    killFloorY: KILL_FLOOR_Y,
    targets: dummies.map((d) => d.root),
    onDeath: () => {
      useMatch.getState().setPlayerDead();
    },
    onBonk: (target) => {
      const d = dummies.find((d) => d.root === target);
      if (d) {
        const dir = target.position.subtract(playerRoot.position).normalize();
        d.applyKnockback(dir.scale(14), 4);
        useMatch.getState().incrementBonks();
        spawnBonkBurst(scene, target.position.clone());
        // Camera shake
        cameraShake(camera, 0.18, 0.25);
      }
    },
  };
  const controller = new BonkController(opts);

  // Match-state init — starts in countdown phase, switches to playing after 3.5s
  useMatch.getState().reset(dummyCount + 1);
  // Auto-flip to playing once the playable timestamp passes
  const playabilityChecker = setInterval(() => {
    const ms = useMatch.getState();
    if (ms.phase === "countdown" && ms.isPlayable()) {
      ms.beginPlay();
      clearInterval(playabilityChecker);
    }
  }, 100);
  scene.onDisposeObservable.add(() => clearInterval(playabilityChecker));

  // Camera target lerps toward the player (smooth follow, not snapped)
  const camLook = new Vector3(0, 1.5, 0);

  // Per-tick: check elimination, update HUD, run hazard checks
  scene.onBeforeRenderObservable.add(() => {
    const dt = engine.getDeltaTime() / 1000;

    // Run arena's own per-tick (animates moving hazards, drop tiles, etc.)
    if (surface.tick) surface.tick(dt);

    // Hazard collision check vs player + dummies (arena's hazards array
    // is rebuilt each tick by surface.tick so it's always fresh)
    if (useMatch.getState().isPlayable() && !useMatch.getState().isInvulnerable()) {
      for (const hz of surface.hazards) {
        const dx = playerRoot.position.x - hz.pos.x;
        const dy = playerRoot.position.y - hz.pos.y;
        const dz = playerRoot.position.z - hz.pos.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < hz.radius * hz.radius) {
          const len = Math.sqrt(d2) || 1;
          if (hz.kind === "spike") {
            // Spikes knock the bean UP and away (don't punt directly off edge)
            controller.applyKnockback(
              new Vector3((dx / len) * 6, 7, (dz / len) * 6),
              1.0,
            );
            spawnBonkBurst(scene, playerRoot.position.clone());
            cameraShake(camera, 0.12, 0.2);
          } else if (hz.kind === "bouncepad") {
            // Always launch UP, regardless of invuln
            controller.applyKnockback(new Vector3(0, 14, 0), 0);
          }
          break;
        }
      }
    }

    // Check dummies fallen
    for (const d of dummies) {
      if (d.alive && d.root.position.y < KILL_FLOOR_Y) {
        d.alive = false;
        d.root.setEnabled(false);
        useMatch.getState().registerKO();
      }
    }

    // Smooth camera lerp toward player position (face-height target)
    const target = playerRoot.position;
    const k = Math.min(1, dt * 5);
    camLook.x += (target.x - camLook.x) * k;
    camLook.y += (target.y + 1.0 - camLook.y) * k;
    camLook.z += (target.z - camLook.z) * k;
    camera.target = camLook;
  });

  const glow = new GlowLayer("arena-glow", scene);
  glow.intensity = 0.55;

  applyCelShade(scene, camera);

  const myArena: BonkArenaContext = {
    scene,
    controller,
    dummies,
    surface,
    dispose: () => {
      controller.dispose();
      dummies.forEach((d) => d.dispose());
      playerBean.dispose();
      surface.dispose();
    },
  };
  activeArena = myArena;

  // Only clear activeArena if it still points at THIS scene's arena.
  // (When the arena is rebuilt mid-tournament, the new scene mounts its
  // own myArena into activeArena before the old scene disposes — without
  // this guard, the old scene's onDispose would tear down the new one.)
  scene.onDisposeObservable.add(() => {
    myArena.dispose();
    if (activeArena === myArena) activeArena = null;
  });

  return scene;
}

function createDot(scene: Scene, color: string): Texture {
  const size = 32;
  const cnv = document.createElement("canvas");
  cnv.width = size;
  cnv.height = size;
  const ctx = cnv.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(0.6, color.replace(/, 1\)/, ", 0.5)"));
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new Texture(cnv.toDataURL(), scene);
  tex.hasAlpha = true;
  return tex;
}

/** Bonk impact burst — short-lived stars/sparkles particle system. */
function spawnBonkBurst(scene: Scene, position: Vector3) {
  const burst = new ParticleSystem("bonk-burst", 80, scene);
  burst.particleTexture = createDot(scene, "rgba(255, 230, 140, 1)");
  burst.emitter = position;
  burst.minEmitBox = new Vector3(-0.1, -0.1, -0.1);
  burst.maxEmitBox = new Vector3(0.1, 0.1, 0.1);
  burst.color1 = new Color4(1, 0.85, 0.45, 1);
  burst.color2 = new Color4(1, 0.5, 0.65, 1);
  burst.colorDead = new Color4(0.4, 0.3, 0.2, 0);
  burst.minSize = 0.12;
  burst.maxSize = 0.32;
  burst.minLifeTime = 0.3;
  burst.maxLifeTime = 0.7;
  burst.emitRate = 0; // we'll manualEmitCount + start
  burst.manualEmitCount = 60;
  burst.minEmitPower = 6;
  burst.maxEmitPower = 12;
  burst.gravity = new Vector3(0, -8, 0);
  burst.direction1 = new Vector3(-1, 1, -1);
  burst.direction2 = new Vector3(1, 1.5, 1);
  burst.start();
  // Auto-dispose after lifetime
  setTimeout(() => burst.dispose(), 1200);
}

/**
 * Quick decaying noise-shake on the ArcRotateCamera by jittering its
 * targetScreenOffset for `duration` seconds. Returns to zero on its own.
 */
function cameraShake(camera: ArcRotateCamera, magnitude: number, duration: number) {
  const start = performance.now();
  const initial = camera.targetScreenOffset.clone();
  const interval = setInterval(() => {
    const t = (performance.now() - start) / 1000;
    if (t >= duration) {
      camera.targetScreenOffset.copyFrom(initial);
      clearInterval(interval);
      return;
    }
    const decay = 1 - t / duration;
    const dx = (Math.random() - 0.5) * 2 * magnitude * decay;
    const dy = (Math.random() - 0.5) * 2 * magnitude * decay;
    camera.targetScreenOffset.set(initial.x + dx, initial.y + dy);
  }, 16);
}

/** Lightweight unused — kept for future sound + animation hooks. */
const _animUnused: typeof Animation = Animation;
void _animUnused;
