import {
  Scene,
  TransformNode,
  Vector3,
  Quaternion,
  Color3,
} from "@babylonjs/core";
import {
  buildBean,
  defaultBeanLook,
  type Bean,
  type BeanHatId,
  type BeanEyeStyle,
  type BeanMouthStyle,
} from "@game/systems/character/Bean";
import type { Heritage } from "@game/systems/character/SliderBlob";
import { BeanAnimator } from "@game/systems/character/BeanAnimator";
import { useMatch } from "@state/match";

const HERITAGES: Heritage[] = ["hjari", "sivit", "korr", "vellish"];

const FUN_HATS: BeanHatId[] = ["wizard", "crown", "propeller", "helmet", "horns", "tophat", "halo"];
const EYE_STYLES: BeanEyeStyle[] = ["round", "sparkle", "angry", "swirl", "heart"];
const MOUTHS: BeanMouthStyle[] = ["smile", "grin", "smug", "tongue", "neutral"];

const FUN_COLORS: [number, number, number][] = [
  [1.0, 0.45, 0.45], [0.45, 0.85, 1.0], [0.45, 1.0, 0.55],
  [1.0, 0.85, 0.32], [0.85, 0.45, 1.0], [1.0, 0.55, 0.85],
  [0.55, 1.0, 0.85], [0.95, 0.62, 0.32],
];

/**
 * AI Dummy — smarter party-game opponent. Three behaviour modes:
 *   - chase: pick a target (nearest live bean) and steer toward them
 *   - dive:  if close enough, lunge forward 0.4s + apply knockback to whoever
 *            is still in range when dive ends
 *   - wander: idle drift if no target / between dive cooldowns
 *
 * Per-tick AI tick chooses the mode based on distance + cooldowns. Beans
 * that get hit go into a stun + knockback phase (existing behaviour).
 */

interface AiTargetSource {
  /** All possible targets the AI can dive at */
  getTargets: () => { root: TransformNode; alive: boolean }[];
  /** Hit callback — caller applies knockback */
  onBonk: (target: TransformNode, attacker: AiDummyController) => void;
}

export class AiDummyController {
  scene: Scene;
  root: TransformNode;
  bean: Bean;
  animator: BeanAnimator;
  alive = true;
  velocity = new Vector3(0, 0, 0);
  grounded = true;
  stunTimer = 0;
  diveTimer = 0;
  diveCooldown = 0;

  /** Wired by the arena scene if it wants AI to attack the player too. */
  attackSource: AiTargetSource | null = null;

  /** Aggression scale 0..1 — higher = picks targets faster + dives sooner. */
  aggression = 0.6;

  private wanderTimer = 0;
  private wanderDir = new Vector3(1, 0, 0);
  private renderObserver: ReturnType<Scene["onBeforeRenderObservable"]["add"]>;

  constructor(scene: Scene, root: TransformNode, bean: Bean) {
    this.scene = scene;
    this.root = root;
    this.bean = bean;
    this.animator = new BeanAnimator({ bean });
    this.renderObserver = scene.onBeforeRenderObservable.add(() => this.tick());
    this.pickWander();
  }

  dispose() {
    if (this.renderObserver) this.scene.onBeforeRenderObservable.remove(this.renderObserver);
    this.animator.dispose();
    this.bean.dispose();
    this.root.dispose();
  }

  applyKnockback(impulse: Vector3, stunSeconds = 0) {
    this.velocity.x += impulse.x;
    this.velocity.y = Math.max(this.velocity.y, 1) + impulse.y;
    this.velocity.z += impulse.z;
    this.stunTimer = Math.max(this.stunTimer, stunSeconds);
    this.grounded = false;
    this.animator.triggerBonkHit();
  }

  setAttackSource(source: AiTargetSource) {
    this.attackSource = source;
  }

  private pickWander() {
    const angle = Math.random() * Math.PI * 2;
    this.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
    this.wanderTimer = 1.5 + Math.random() * 2.5;
  }

  /**
   * Pick the closest valid target (alive, not self). Returns null if no targets.
   */
  private findTarget(): { root: TransformNode; dist: number } | null {
    if (!this.attackSource) return null;
    const targets = this.attackSource.getTargets();
    let best: { root: TransformNode; dist: number } | null = null;
    for (const t of targets) {
      if (!t.alive) continue;
      if (t.root === this.root) continue;
      const dx = t.root.position.x - this.root.position.x;
      const dz = t.root.position.z - this.root.position.z;
      const d = Math.hypot(dx, dz);
      if (!best || d < best.dist) best = { root: t.root, dist: d };
    }
    return best;
  }

  private startDive(towardX: number, towardZ: number) {
    const dx = towardX - this.root.position.x;
    const dz = towardZ - this.root.position.z;
    const len = Math.hypot(dx, dz) || 1;
    this.velocity.x = (dx / len) * 8;
    this.velocity.z = (dz / len) * 8;
    this.velocity.y = Math.max(this.velocity.y, 1.2);
    this.diveTimer = 0.45;
    this.diveCooldown = 1.5 + Math.random() * 1.0;
    this.animator.triggerDive();
  }

  private tick() {
    if (!this.alive) return;
    const dt = this.scene.getEngine().getDeltaTime() / 1000;

    // Decrement timers
    if (this.stunTimer > 0) this.stunTimer = Math.max(0, this.stunTimer - dt);
    if (this.diveTimer > 0) this.diveTimer = Math.max(0, this.diveTimer - dt);
    if (this.diveCooldown > 0) this.diveCooldown = Math.max(0, this.diveCooldown - dt);

    // === BEHAVIOUR ===
    // No diving / chasing during countdown phase — beans wait politely.
    const matchPlayable = useMatch.getState().isPlayable();
    if (this.stunTimer <= 0 && this.grounded && this.diveTimer <= 0 && matchPlayable) {
      const target = this.findTarget();

      if (target && target.dist < 1.6 && this.diveCooldown <= 0) {
        this.startDive(target.root.position.x, target.root.position.z);
      } else if (target && target.dist < 12) {
        // Chase mode — steer toward target
        const dx = target.root.position.x - this.root.position.x;
        const dz = target.root.position.z - this.root.position.z;
        const len = Math.hypot(dx, dz) || 1;
        const speed = 2.6 + this.aggression * 1.5;
        this.velocity.x = (dx / len) * speed;
        this.velocity.z = (dz / len) * speed;
      } else {
        // Wander mode (no target / target far)
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) this.pickWander();

        const distFromCenter = Math.hypot(this.root.position.x, this.root.position.z);
        let dirX = this.wanderDir.x;
        let dirZ = this.wanderDir.z;
        if (distFromCenter > 9) {
          const inwardX = -this.root.position.x / distFromCenter;
          const inwardZ = -this.root.position.z / distFromCenter;
          dirX = dirX * 0.3 + inwardX * 0.7;
          dirZ = dirZ * 0.3 + inwardZ * 0.7;
          const len = Math.hypot(dirX, dirZ);
          if (len > 0) { dirX /= len; dirZ /= len; }
        }
        this.velocity.x = dirX * 1.8;
        this.velocity.z = dirZ * 1.8;
      }
    } else if (this.stunTimer > 0) {
      // Friction during stun
      this.velocity.x *= Math.pow(0.4, dt);
      this.velocity.z *= Math.pow(0.4, dt);
    }
    // Diving — keep current velocity, no input

    // === DIVE HIT DETECTION ===
    if (this.diveTimer > 0 && this.attackSource) {
      const reach = 1.5;
      for (const t of this.attackSource.getTargets()) {
        if (!t.alive) continue;
        if (t.root === this.root) continue;
        const dx = t.root.position.x - this.root.position.x;
        const dz = t.root.position.z - this.root.position.z;
        if (Math.hypot(dx, dz) < reach) {
          this.attackSource.onBonk(t.root, this);
          this.animator.triggerBonkHit();
          this.diveTimer = 0; // one-and-done
          break;
        }
      }
    }

    // === GRAVITY + INTEGRATION ===
    if (!this.grounded) {
      this.velocity.y += -22 * dt;
    }

    this.root.position.x += this.velocity.x * dt;
    this.root.position.y += this.velocity.y * dt;
    this.root.position.z += this.velocity.z * dt;

    // Ground check — use arena floor predicate if wired up via attackSource
    // (which carries the surface ref); fall back to y=0 / r=12 default.
    const surface = (this.attackSource as unknown as { surface?: { inside: (x:number,z:number)=>boolean; floorY:(x:number,z:number)=>number } })?.surface;
    if (surface) {
      const onSurface = surface.inside(this.root.position.x, this.root.position.z);
      const floorY = onSurface ? surface.floorY(this.root.position.x, this.root.position.z) : -Infinity;
      if (onSurface && this.root.position.y <= floorY + 0.01) {
        this.root.position.y = floorY;
        if (!this.grounded) this.animator.triggerLand();
        this.velocity.y = 0;
        this.grounded = true;
      } else if (!onSurface || this.root.position.y > floorY + 0.05) {
        this.grounded = false;
      }
    } else if (this.root.position.y <= 0) {
      const r = Math.hypot(this.root.position.x, this.root.position.z);
      if (r <= 12) {
        this.root.position.y = 0;
        if (!this.grounded) this.animator.triggerLand();
        this.velocity.y = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }
    }

    // Face direction of motion
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (horizSpeed > 0.2 && this.stunTimer <= 0) {
      const yaw = Math.atan2(this.velocity.x, this.velocity.z);
      if (!this.root.rotationQuaternion) {
        this.root.rotationQuaternion = Quaternion.RotationYawPitchRoll(yaw, 0, 0);
      } else {
        const target = Quaternion.RotationYawPitchRoll(yaw, 0, 0);
        Quaternion.SlerpToRef(
          this.root.rotationQuaternion,
          target,
          Math.min(1, dt * 8),
          this.root.rotationQuaternion,
        );
      }
    }

    // Sync animator state
    this.animator.setState(
      this.stunTimer > 0
        ? "stunned"
        : this.diveTimer > 0
        ? "dive"
        : horizSpeed > 0.3
        ? "walk"
        : "idle",
    );
  }
}

export function spawnAiDummy(scene: Scene, position: Vector3, seed: number): AiDummyController {
  const heritage = HERITAGES[seed % HERITAGES.length]!;
  const colorTuple = FUN_COLORS[seed % FUN_COLORS.length]!;
  const look = defaultBeanLook(heritage);
  look.bodyColor = new Color3(colorTuple[0], colorTuple[1], colorTuple[2]);
  look.eyeStyle = EYE_STYLES[seed % EYE_STYLES.length]!;
  look.mouthStyle = MOUTHS[seed % MOUTHS.length]!;
  look.hat = FUN_HATS[seed % FUN_HATS.length]!;
  if (seed % 3 === 0) look.outfit = "cape";
  if (seed % 4 === 0) look.accessory = "glasses";
  if (seed % 5 === 0) look.pattern = "stripes";

  const root = new TransformNode(`dummy-root-${seed}`, scene);
  root.position = position.clone();
  const bean = buildBean(scene, root, look);

  const controller = new AiDummyController(scene, root, bean);
  controller.aggression = 0.4 + (seed * 0.13) % 0.5; // 0.4-0.9 random per-bean
  return controller;
}
