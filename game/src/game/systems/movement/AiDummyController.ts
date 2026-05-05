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
 * AI Dummy — a target-practice bean. Walks around aimlessly, can be bonked
 * off the platform. No real combat AI yet; just "wander + react to knockback."
 */
export class AiDummyController {
  scene: Scene;
  root: TransformNode;
  bean: Bean;
  animator: BeanAnimator;
  alive = true;
  velocity = new Vector3(0, 0, 0);
  grounded = true;
  stunTimer = 0;

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

  private pickWander() {
    const angle = Math.random() * Math.PI * 2;
    this.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
    this.wanderTimer = 1.5 + Math.random() * 2.5;
  }

  private tick() {
    if (!this.alive) return;
    const dt = this.scene.getEngine().getDeltaTime() / 1000;

    // Wander steering
    if (this.stunTimer <= 0 && this.grounded) {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) this.pickWander();

      // Steer back toward center if too close to edge (so dummies don't all walk off)
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
    } else {
      // Friction during stun
      this.velocity.x *= Math.pow(0.4, dt);
      this.velocity.z *= Math.pow(0.4, dt);
    }

    // Gravity
    if (!this.grounded) {
      this.velocity.y += -22 * dt;
    }

    this.root.position.x += this.velocity.x * dt;
    this.root.position.y += this.velocity.y * dt;
    this.root.position.z += this.velocity.z * dt;

    // Ground check at y=0 if on platform
    if (this.root.position.y <= 0) {
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

    // Sync animator state for walking AI
    const horizSpeed2 = Math.hypot(this.velocity.x, this.velocity.z);
    this.animator.setState(
      this.stunTimer > 0 ? "stunned" : horizSpeed2 > 0.3 ? "walk" : "idle",
    );

    // Stun decay
    if (this.stunTimer > 0) this.stunTimer = Math.max(0, this.stunTimer - dt);

    // Face direction of motion
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    void horizSpeed;
    if (Math.hypot(this.velocity.x, this.velocity.z) > 0.2 && this.stunTimer <= 0) {
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

  return new AiDummyController(scene, root, bean);
}
