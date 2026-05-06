import {
  Scene,
  ParticleSystem,
  Texture,
  Vector3,
  Color4,
  TransformNode,
} from "@babylonjs/core";

/**
 * Per-bean trail effects: run-dust, jump-puff, land-smoke, dive-streak.
 * All particle systems are owned by the bean root so they auto-dispose.
 */

let cachedDustTex: Texture | null = null;
function dustTexture(scene: Scene): Texture {
  if (cachedDustTex && cachedDustTex.getScene() === scene) return cachedDustTex;
  const cnv = document.createElement("canvas");
  cnv.width = 32;
  cnv.height = 32;
  const ctx = cnv.getContext("2d")!;
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, "rgba(255,255,255,0.95)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.4)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  const tex = new Texture(cnv.toDataURL(), scene);
  tex.hasAlpha = true;
  cachedDustTex = tex;
  return tex;
}

export interface TrailHandles {
  runDust: ParticleSystem;
  /** Burst particles on jump — call .start() then schedule stop. */
  jumpPuff: ParticleSystem;
  /** Burst particles on land. */
  landSmoke: ParticleSystem;
  /** Streak left during dive. */
  diveStreak: ParticleSystem;
  setRunning: (on: boolean) => void;
  burstJump: () => void;
  burstLand: () => void;
  setDiving: (on: boolean) => void;
  dispose: () => void;
}

export function attachBeanTrails(scene: Scene, beanRoot: TransformNode): TrailHandles {
  const tex = dustTexture(scene);

  // ===== Run Dust — continuous low-rate puffs from feet while running =====
  const runDust = new ParticleSystem("run-dust", 60, scene);
  runDust.particleTexture = tex;
  runDust.emitter = beanRoot as unknown as Vector3;
  runDust.minEmitBox = new Vector3(-0.25, 0.05, -0.1);
  runDust.maxEmitBox = new Vector3(0.25, 0.18, 0.05);
  runDust.color1 = new Color4(0.95, 0.92, 0.82, 0.7);
  runDust.color2 = new Color4(0.85, 0.78, 0.62, 0.6);
  runDust.colorDead = new Color4(0.6, 0.55, 0.45, 0);
  runDust.minSize = 0.18;
  runDust.maxSize = 0.42;
  runDust.minLifeTime = 0.35;
  runDust.maxLifeTime = 0.7;
  runDust.emitRate = 0; // toggled by setRunning
  runDust.gravity = new Vector3(0, 0.4, 0);
  runDust.direction1 = new Vector3(-0.5, 0.3, -0.5);
  runDust.direction2 = new Vector3(0.5, 1.0, 0.5);
  runDust.minEmitPower = 0.5;
  runDust.maxEmitPower = 1.4;
  runDust.minAngularSpeed = -1;
  runDust.maxAngularSpeed = 1;
  runDust.start();

  // ===== Jump Puff — short upward burst at feet =====
  const jumpPuff = new ParticleSystem("jump-puff", 30, scene);
  jumpPuff.particleTexture = tex;
  jumpPuff.emitter = beanRoot as unknown as Vector3;
  jumpPuff.minEmitBox = new Vector3(-0.3, 0.05, -0.3);
  jumpPuff.maxEmitBox = new Vector3(0.3, 0.15, 0.3);
  jumpPuff.color1 = new Color4(1, 1, 0.95, 0.85);
  jumpPuff.color2 = new Color4(0.85, 0.85, 0.78, 0.7);
  jumpPuff.colorDead = new Color4(0.6, 0.6, 0.55, 0);
  jumpPuff.minSize = 0.22;
  jumpPuff.maxSize = 0.5;
  jumpPuff.minLifeTime = 0.25;
  jumpPuff.maxLifeTime = 0.55;
  jumpPuff.emitRate = 0;
  jumpPuff.manualEmitCount = 0;
  jumpPuff.gravity = new Vector3(0, -1.5, 0);
  jumpPuff.direction1 = new Vector3(-1, 0.2, -1);
  jumpPuff.direction2 = new Vector3(1, 1.2, 1);
  jumpPuff.minEmitPower = 1.5;
  jumpPuff.maxEmitPower = 3.5;
  jumpPuff.start();

  // ===== Land Smoke — bigger lateral puff =====
  const landSmoke = new ParticleSystem("land-smoke", 40, scene);
  landSmoke.particleTexture = tex;
  landSmoke.emitter = beanRoot as unknown as Vector3;
  landSmoke.minEmitBox = new Vector3(-0.4, 0.02, -0.4);
  landSmoke.maxEmitBox = new Vector3(0.4, 0.12, 0.4);
  landSmoke.color1 = new Color4(0.98, 0.95, 0.82, 0.85);
  landSmoke.color2 = new Color4(0.85, 0.8, 0.7, 0.65);
  landSmoke.colorDead = new Color4(0.55, 0.5, 0.45, 0);
  landSmoke.minSize = 0.32;
  landSmoke.maxSize = 0.7;
  landSmoke.minLifeTime = 0.35;
  landSmoke.maxLifeTime = 0.75;
  landSmoke.emitRate = 0;
  landSmoke.gravity = new Vector3(0, 0.2, 0);
  landSmoke.direction1 = new Vector3(-2, 0.1, -2);
  landSmoke.direction2 = new Vector3(2, 0.6, 2);
  landSmoke.minEmitPower = 1.2;
  landSmoke.maxEmitPower = 3.2;
  landSmoke.start();

  // ===== Dive Streak — pink/cyan trail behind diving bean =====
  const diveStreak = new ParticleSystem("dive-streak", 80, scene);
  diveStreak.particleTexture = tex;
  diveStreak.emitter = beanRoot as unknown as Vector3;
  diveStreak.minEmitBox = new Vector3(-0.2, 0.4, -0.2);
  diveStreak.maxEmitBox = new Vector3(0.2, 0.8, 0.2);
  diveStreak.color1 = new Color4(1, 0.55, 0.85, 0.9);
  diveStreak.color2 = new Color4(0.55, 0.85, 1, 0.85);
  diveStreak.colorDead = new Color4(0.5, 0.5, 0.5, 0);
  diveStreak.minSize = 0.18;
  diveStreak.maxSize = 0.4;
  diveStreak.minLifeTime = 0.18;
  diveStreak.maxLifeTime = 0.42;
  diveStreak.emitRate = 0;
  diveStreak.gravity = new Vector3(0, 0.6, 0);
  diveStreak.direction1 = new Vector3(-0.3, 0.2, -0.3);
  diveStreak.direction2 = new Vector3(0.3, 0.8, 0.3);
  diveStreak.minEmitPower = 0.5;
  diveStreak.maxEmitPower = 1.4;
  diveStreak.start();

  return {
    runDust,
    jumpPuff,
    landSmoke,
    diveStreak,
    setRunning(on: boolean) {
      runDust.emitRate = on ? 35 : 0;
    },
    burstJump() {
      jumpPuff.manualEmitCount = 14;
    },
    burstLand() {
      landSmoke.manualEmitCount = 22;
    },
    setDiving(on: boolean) {
      diveStreak.emitRate = on ? 45 : 0;
    },
    dispose() {
      runDust.dispose();
      jumpPuff.dispose();
      landSmoke.dispose();
      diveStreak.dispose();
    },
  };
}
