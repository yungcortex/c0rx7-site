import {
  Scene,
  ArcRotateCamera,
  Vector3,
  TransformNode,
  Quaternion,
  KeyboardEventTypes,
  KeyboardInfo,
  Mesh,
} from "@babylonjs/core";
import type { Bean } from "@game/systems/character/Bean";
import { playSfx } from "@game/systems/audio/SoundManager";
import { BeanAnimator, type BeanState } from "@game/systems/character/BeanAnimator";
import { useMatch } from "@state/match";
import { attachBeanTrails, type TrailHandles } from "@game/systems/effects/Trails";

interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  bonk: boolean;
}

export type BonkState = "idle" | "walk" | "run" | "jump" | "fall" | "dive" | "stunned";

export interface BonkControllerOptions {
  scene: Scene;
  root: TransformNode;
  bean: Bean;
  camera: ArcRotateCamera;
  arenaRadius: number;
  /** Per-arena predicate: is (x, z) on a valid standing surface? */
  isOnSurface?: (x: number, z: number) => boolean;
  /** Per-arena Y of the floor at (x, z) — varies per arena (ramps, tiers). */
  surfaceFloorY?: (x: number, z: number) => number;
  killFloorY: number;
  targets: TransformNode[];
  onDeath?: () => void;
  onBonk?: (target: TransformNode) => void;
  walkSpeed?: number;
  runSpeed?: number;
  jumpVelocity?: number;
  diveVelocity?: number;
  diveForward?: number;
  gravity?: number;
}

/**
 * BonkController — Fall-Guys-style player controller. WASD + space to jump,
 * shift to run, F (or right-click / E) to DIVE. Diving lunges forward + down.
 * Hitting another bean while diving = bonk → knockback impulse.
 *
 * No physics engine: hand-rolled kinematic with simple velocities + an
 * internal AABB-style proximity hit-test for bonks. Lightweight, predictable,
 * portable to the future server-authoritative tick.
 */
export class BonkController {
  scene: Scene;
  root: TransformNode;
  bean: Bean;
  camera: ArcRotateCamera;
  arenaRadius: number;
  isOnSurface?: (x: number, z: number) => boolean;
  killFloorY: number;
  targets: TransformNode[];
  onDeath?: () => void;
  onBonk?: (target: TransformNode) => void;

  walkSpeed: number;
  runSpeed: number;
  jumpVelocity: number;
  diveVelocity: number;
  diveForward: number;
  gravity: number;

  velocity = new Vector3(0, 0, 0);
  grounded = true;
  state: BonkState = "idle";
  diveTimer = 0;
  stunTimer = 0;
  alive = true;

  animator: BeanAnimator;
  trails: TrailHandles;

  private input: InputState = {
    forward: false,
    back: false,
    left: false,
    right: false,
    jump: false,
    bonk: false,
  };

  private kbObserver: ReturnType<Scene["onKeyboardObservable"]["add"]> | null;
  private renderObserver: ReturnType<Scene["onBeforeRenderObservable"]["add"]> | null;

  constructor(opts: BonkControllerOptions) {
    this.scene = opts.scene;
    this.root = opts.root;
    this.bean = opts.bean;
    this.camera = opts.camera;
    this.arenaRadius = opts.arenaRadius;
    this.isOnSurface = opts.isOnSurface;
    this.killFloorY = opts.killFloorY;
    this.targets = opts.targets;
    this.onDeath = opts.onDeath;
    this.onBonk = opts.onBonk;
    this.walkSpeed = opts.walkSpeed ?? 4.2;
    this.runSpeed = opts.runSpeed ?? 7.5;
    this.jumpVelocity = opts.jumpVelocity ?? 8.0;
    this.diveVelocity = opts.diveVelocity ?? -1.0;
    this.diveForward = opts.diveForward ?? 9.5;
    this.gravity = opts.gravity ?? -22;

    this.animator = new BeanAnimator({ bean: this.bean });
    this.trails = attachBeanTrails(this.scene, this.root);

    this.kbObserver = this.scene.onKeyboardObservable.add((kb) => this.onKey(kb));
    this.renderObserver = this.scene.onBeforeRenderObservable.add(() => this.tick());

    (this.camera as ArcRotateCamera).lockedTarget = this.root;
  }

  dispose() {
    if (this.kbObserver) this.scene.onKeyboardObservable.remove(this.kbObserver);
    if (this.renderObserver) this.scene.onBeforeRenderObservable.remove(this.renderObserver);
    this.animator.dispose();
    this.trails.dispose();
  }

  emote(id: "wave" | "dance" | "sleep" | "taunt") {
    this.animator.emote(id);
  }

  applyKnockback(impulse: Vector3, stunSeconds = 0) {
    // Spawn invulnerability — ignore incoming impulses for the first ~5s
    if (useMatch.getState().isInvulnerable()) return;
    this.velocity.x += impulse.x;
    this.velocity.y = Math.max(this.velocity.y, 0) + impulse.y;
    this.velocity.z += impulse.z;
    this.stunTimer = Math.max(this.stunTimer, stunSeconds);
    this.state = "stunned";
    this.grounded = false;
  }

  private onKey(kb: KeyboardInfo) {
    const down = kb.type === KeyboardEventTypes.KEYDOWN;
    const code = kb.event.code;
    switch (code) {
      case "KeyW":
      case "ArrowUp":
        this.input.forward = down;
        break;
      case "KeyS":
      case "ArrowDown":
        this.input.back = down;
        break;
      case "KeyA":
      case "ArrowLeft":
        this.input.left = down;
        break;
      case "KeyD":
      case "ArrowRight":
        this.input.right = down;
        break;
      case "Space":
        if (down && this.grounded && this.alive && this.state !== "dive") {
          this.velocity.y = this.jumpVelocity;
          this.grounded = false;
          this.state = "jump";
          this.animator.triggerJump();
          this.trails.burstJump();
          playSfx("jump");
        }
        this.input.jump = down;
        break;
      case "Digit1": if (down) this.animator.emote("wave"); break;
      case "Digit2": if (down) this.animator.emote("dance"); break;
      case "Digit3": if (down) this.animator.emote("sleep"); break;
      case "Digit4": if (down) this.animator.emote("taunt"); break;
      // R or Shift to run
      case "KeyR":
      case "ShiftLeft":
      case "ShiftRight":
        this.input.bonk = down;
        break;
      // T or F to tackle / dive-bonk
      case "KeyT":
      case "KeyF":
      case "KeyE":
        if (down && this.alive && this.state !== "dive" && this.stunTimer <= 0) this.startDive();
        break;
    }
  }

  private startDive() {
    this.state = "dive";
    this.diveTimer = 0.55;
    const yaw = this.getYaw();
    const fwd = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    this.velocity.x = fwd.x * this.diveForward;
    this.velocity.z = fwd.z * this.diveForward;
    this.velocity.y = Math.max(this.velocity.y, 1.5);
    this.bean.body.rotation.x = -0.7;
    this.animator.triggerDive();
    this.trails.setDiving(true);
    playSfx("dive");
  }

  // squashAnim removed — replaced by BeanAnimator pulse triggers

  private smoothedInputMag(): number {
    // Approx: how much actual input is the player feeding (0..1)
    const i = this.input;
    const dx = (i.right ? 1 : 0) - (i.left ? 1 : 0);
    const dz = (i.forward ? 1 : 0) - (i.back ? 1 : 0);
    return Math.min(1, Math.hypot(dx, dz));
  }

  private getYaw(): number {
    const rq = this.root.rotationQuaternion;
    if (rq) {
      return Math.atan2(2 * (rq.w * rq.y + rq.x * rq.z), 1 - 2 * (rq.y * rq.y + rq.x * rq.x));
    }
    return this.root.rotation.y;
  }

  private tick() {
    if (!this.alive) return;
    const dt = this.scene.getEngine().getDeltaTime() / 1000;

    // Camera-relative movement
    const camFwd = this.camera.getForwardRay().direction.clone();
    camFwd.y = 0;
    if (camFwd.lengthSquared() > 0.0001) camFwd.normalize();
    const camRight = new Vector3(camFwd.z, 0, -camFwd.x);

    let dirX = 0;
    let dirZ = 0;
    if (this.stunTimer <= 0 && this.state !== "dive") {
      if (this.input.forward) { dirX += camFwd.x; dirZ += camFwd.z; }
      if (this.input.back)    { dirX -= camFwd.x; dirZ -= camFwd.z; }
      if (this.input.right)   { dirX += camRight.x; dirZ += camRight.z; }
      if (this.input.left)    { dirX -= camRight.x; dirZ -= camRight.z; }
      const len = Math.hypot(dirX, dirZ);
      if (len > 0.0001) { dirX /= len; dirZ /= len; }

      const speed = this.input.bonk ? this.runSpeed : this.walkSpeed;
      this.velocity.x = dirX * speed;
      this.velocity.z = dirZ * speed;
    }

    // Gravity
    if (!this.grounded || this.state === "dive") {
      this.velocity.y += this.gravity * dt;
    }
    if (this.state === "dive") {
      // Dive forces extra downward pull so the bean lunges
      this.velocity.y += this.diveVelocity * 4 * dt;
    }

    // Apply
    this.root.position.x += this.velocity.x * dt;
    this.root.position.y += this.velocity.y * dt;
    this.root.position.z += this.velocity.z * dt;

    // Friction — always-on light braking when grounded (so beans stop quickly
    // instead of sliding forever) plus heavy braking during stun/dive
    if (this.grounded) {
      const friction =
        this.state === "stunned" || this.state === "dive"
          ? 0.05
          : this.smoothedInputMag() < 0.1
          ? 0.0001
          : 1; // moving = let velocity fully follow input
      if (friction < 1) {
        this.velocity.x *= Math.pow(friction, dt);
        this.velocity.z *= Math.pow(friction, dt);
      }
    }

    // Ground plane (assume y=0 = arena top)
    if (this.root.position.y <= 0) {
      const onPlatform = this.onPlatform();
      if (onPlatform) {
        this.root.position.y = 0;
        this.velocity.y = 0;
        if (!this.grounded) {
          this.animator.triggerLand();
          this.trails.burstLand();
          playSfx("land");
        }
        this.grounded = true;
        if (this.state === "jump" || this.state === "fall") this.state = "idle";
      } else {
        this.grounded = false;
        this.state = "fall";
      }
    } else if (this.velocity.y < 0 && this.state !== "dive" && this.state !== "stunned") {
      this.state = "fall";
    }

    // Death by killfloor
    if (this.root.position.y < this.killFloorY) {
      this.alive = false;
      playSfx("ko");
      if (this.onDeath) this.onDeath();
      return;
    }

    // Stun decay
    if (this.stunTimer > 0) this.stunTimer = Math.max(0, this.stunTimer - dt);

    // Dive timer / hit-test for bonks
    if (this.state === "dive") {
      this.diveTimer -= dt;
      this.checkBonks();
      if (this.diveTimer <= 0) {
        this.state = this.grounded ? "idle" : "fall";
        this.bean.body.rotation.x = 0;
        this.trails.setDiving(false);
      }
    }

    // Facing toward velocity (but only when actively moving)
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (horizSpeed > 0.4 && this.stunTimer <= 0) {
      const targetYaw = Math.atan2(this.velocity.x, this.velocity.z);
      if (!this.root.rotationQuaternion) {
        this.root.rotationQuaternion = Quaternion.RotationYawPitchRoll(targetYaw, 0, 0);
      } else {
        const target = Quaternion.RotationYawPitchRoll(targetYaw, 0, 0);
        Quaternion.SlerpToRef(
          this.root.rotationQuaternion,
          target,
          Math.min(1, dt * 14),
          this.root.rotationQuaternion,
        );
      }
    }

    // State machine on grounded movement
    if (this.grounded && this.state !== "dive" && this.state !== "stunned") {
      const moving = horizSpeed > 0.3;
      this.state = moving ? (this.input.bonk ? "run" : "walk") : "idle";
    }

    // Run dust trail — only while running on the ground (not walk/idle/jump)
    this.trails.setRunning(this.grounded && this.state === "run" && horizSpeed > 1.5);

    // Sync animator state
    this.animator.setState(this.state as unknown as BeanState);
  }

  private onPlatform(): boolean {
    const x = this.root.position.x;
    const z = this.root.position.z;
    if (this.isOnSurface) return this.isOnSurface(x, z);
    return Math.hypot(x, z) <= this.arenaRadius;
  }

  private checkBonks() {
    const me = this.root.position;
    const reach = 1.5;
    for (const t of this.targets) {
      if (!t.isEnabled()) continue;
      const dx = t.position.x - me.x;
      const dy = t.position.y - me.y;
      const dz = t.position.z - me.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < reach * reach) {
        if (this.onBonk) this.onBonk(t);
        this.animator.triggerBonkHit();
        playSfx("bonk");
      }
    }
  }
}

/** Helper to compute a forward direction from a yaw angle. */
export function yawForward(yaw: number, out?: Vector3): Vector3 {
  const v = out ?? new Vector3();
  v.x = Math.sin(yaw);
  v.y = 0;
  v.z = Math.cos(yaw);
  return v;
}

/** Type-only re-export so other modules can grab Mesh-friendly target type. */
export type BonkTarget = Mesh | TransformNode;
