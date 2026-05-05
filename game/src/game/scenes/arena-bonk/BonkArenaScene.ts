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

export interface BonkArenaContext {
  scene: Scene;
  controller: BonkController | null;
  dummies: AiDummyController[];
  dispose: () => void;
}

let activeArena: BonkArenaContext | null = null;

export function getArenaContext(): BonkArenaContext | null {
  return activeArena;
}

const ARENA_RADIUS = 12;
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

  // ---- Floating island platform
  const platform = MeshBuilder.CreateCylinder(
    "arena-platform",
    {
      diameterTop: ARENA_RADIUS * 2 - 0.5,
      diameterBottom: ARENA_RADIUS * 2 + 1.0,
      height: 1.4,
      tessellation: 48,
    },
    scene,
  );
  platform.position.y = -0.7;
  const platformMat = new StandardMaterial("plat-mat", scene);
  platformMat.diffuseColor = new Color3(0.65, 0.45, 0.7);
  platformMat.specularColor = new Color3(0.12, 0.1, 0.2);
  platform.material = platformMat;

  // Hex tile decoration ring (visual interest)
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2;
    const r = ARENA_RADIUS - 1.6;
    const tile = MeshBuilder.CreateCylinder(
      `tile-${i}`,
      { diameter: 1.4, height: 0.06, tessellation: 6 },
      scene,
    );
    tile.position.set(Math.cos(angle) * r, 0.03, Math.sin(angle) * r);
    const m = new StandardMaterial(`tile-mat-${i}`, scene);
    m.diffuseColor = new Color3(0.85, 0.55, 0.78);
    m.emissiveColor = new Color3(0.15, 0.08, 0.12);
    tile.material = m;
  }

  // Edge gold ring
  const edgeRing = MeshBuilder.CreateTorus(
    "arena-ring",
    { diameter: ARENA_RADIUS * 2 - 0.4, thickness: 0.18, tessellation: 64 },
    scene,
  );
  edgeRing.position.y = 0.04;
  const ringMat = new StandardMaterial("ring-mat", scene);
  ringMat.diffuseColor = new Color3(1, 0.85, 0.42);
  ringMat.emissiveColor = new Color3(0.85, 0.6, 0.22);
  edgeRing.material = ringMat;

  // Center plate (slightly raised, decorative)
  const plate = MeshBuilder.CreateCylinder(
    "center-plate",
    { diameter: 4, height: 0.18, tessellation: 32 },
    scene,
  );
  plate.position.y = 0.12;
  const plateMat = new StandardMaterial("plate-mat", scene);
  plateMat.diffuseColor = new Color3(0.95, 0.78, 0.32);
  plateMat.emissiveColor = new Color3(0.25, 0.18, 0.05);
  plate.material = plateMat;

  // ---- Below-arena floating debris (depth + scale signal)
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const r = ARENA_RADIUS + 6 + (i % 3) * 2;
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
  motes.minEmitBox = new Vector3(-ARENA_RADIUS, 0, -ARENA_RADIUS);
  motes.maxEmitBox = new Vector3(ARENA_RADIUS, 12, ARENA_RADIUS);
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
  playerRoot.position = new Vector3(0, 1.0, 6);

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

  // ---- AI DUMMIES (3-7 of them, randomly coloured / hatted)
  const dummies: AiDummyController[] = [];
  const dummyCount = 5;
  for (let i = 0; i < dummyCount; i++) {
    const ang = (i / dummyCount) * Math.PI * 2 + 0.4;
    const r = 7;
    const pos = new Vector3(Math.cos(ang) * r, 1.0, Math.sin(ang) * r);
    const dummy = spawnAiDummy(scene, pos, i);
    dummies.push(dummy);
  }

  // ---- PLAYER CONTROLLER (movement + bonk)
  const opts: BonkControllerOptions = {
    scene,
    root: playerRoot,
    bean: playerBean,
    camera,
    arenaRadius: ARENA_RADIUS,
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

  // Match-state init
  useMatch.getState().reset(dummyCount + 1);

  // Camera target lerps toward the player (smooth follow, not snapped)
  const camLook = new Vector3(0, 1.5, 0);

  // Per-tick: check elimination, update HUD
  scene.onBeforeRenderObservable.add(() => {
    const dt = engine.getDeltaTime() / 1000;

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

  activeArena = {
    scene,
    controller,
    dummies,
    dispose: () => {
      controller.dispose();
      dummies.forEach((d) => d.dispose());
      playerBean.dispose();
      activeArena = null;
    },
  };

  scene.onDisposeObservable.add(() => {
    if (activeArena) activeArena.dispose();
    activeArena = null;
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
