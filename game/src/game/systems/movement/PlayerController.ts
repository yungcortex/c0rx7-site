import {
  Scene,
  ArcRotateCamera,
  Vector3,
  TransformNode,
  Quaternion,
  Ray,
  KeyboardEventTypes,
  KeyboardInfo,
} from "@babylonjs/core";

interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  run: boolean;
  interact: boolean;
}

export type LocomotionState = "idle" | "walk" | "run" | "jump" | "fall";

export interface PlayerControllerOptions {
  scene: Scene;
  root: TransformNode;
  camera: ArcRotateCamera;
  onMove?: (pos: Vector3, rot: number) => void;
  onInteract?: () => void;
  walkSpeed?: number;
  runSpeed?: number;
  jumpVelocity?: number;
  gravity?: number;
}

/**
 * Third-person player controller. Reads keyboard input, advances the player
 * root each tick, drives the camera to follow, exposes a state machine for
 * animation hookups. Movement is camera-relative so WASD is intuitive with
 * the camera angle.
 */
export class PlayerController {
  private scene: Scene;
  private root: TransformNode;
  private camera: ArcRotateCamera;
  private input: InputState = {
    forward: false,
    back: false,
    left: false,
    right: false,
    jump: false,
    run: false,
    interact: false,
  };
  private velocity = new Vector3(0, 0, 0);
  private grounded = true;
  private state: LocomotionState = "idle";
  private moveSpeed: number;
  private runSpeed: number;
  private jumpVelocity: number;
  private gravity: number;
  private lastBroadcast = 0;
  private onMove?: (pos: Vector3, rot: number) => void;
  private onInteract?: () => void;
  private keyboardObserver: ReturnType<Scene["onKeyboardObservable"]["add"]> | null;
  private renderObserver: ReturnType<Scene["onBeforeRenderObservable"]["add"]> | null;
  enabled = true;

  constructor(opts: PlayerControllerOptions) {
    this.scene = opts.scene;
    this.root = opts.root;
    this.camera = opts.camera;
    this.onMove = opts.onMove;
    this.onInteract = opts.onInteract;
    this.moveSpeed = opts.walkSpeed ?? 3.6;
    this.runSpeed = opts.runSpeed ?? 6.5;
    this.jumpVelocity = opts.jumpVelocity ?? 7;
    this.gravity = opts.gravity ?? -22;

    this.keyboardObserver = this.scene.onKeyboardObservable.add((kb) =>
      this.handleKeyboard(kb),
    );
    this.renderObserver = this.scene.onBeforeRenderObservable.add(() => this.tick());

    this.camera.lockedTarget = this.root;
    this.camera.radius = 6;
    this.camera.lowerRadiusLimit = 3;
    this.camera.upperRadiusLimit = 9;
    this.camera.lowerBetaLimit = 0.4;
    this.camera.upperBetaLimit = 1.5;
    this.camera.targetScreenOffset.set(0, -0.4);
  }

  getState(): LocomotionState {
    return this.state;
  }

  dispose() {
    if (this.keyboardObserver) this.scene.onKeyboardObservable.remove(this.keyboardObserver);
    if (this.renderObserver) this.scene.onBeforeRenderObservable.remove(this.renderObserver);
  }

  private handleKeyboard(kb: KeyboardInfo) {
    const down = kb.type === KeyboardEventTypes.KEYDOWN;
    const k = kb.event.code;
    switch (k) {
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
        if (down && this.grounded && this.enabled) {
          this.velocity.y = this.jumpVelocity;
          this.grounded = false;
          this.state = "jump";
        }
        this.input.jump = down;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        this.input.run = down;
        break;
      case "KeyE":
        if (down && this.enabled && this.onInteract) this.onInteract();
        this.input.interact = down;
        break;
    }
  }

  private tick() {
    if (!this.enabled) return;

    const dt = this.scene.getEngine().getDeltaTime() / 1000;

    // Build camera-relative input vector
    const camFwd = this.camera.getForwardRay().direction.clone();
    camFwd.y = 0;
    if (camFwd.lengthSquared() > 0.0001) camFwd.normalize();
    const camRight = new Vector3(camFwd.z, 0, -camFwd.x);

    let dirX = 0;
    let dirZ = 0;
    if (this.input.forward) {
      dirX += camFwd.x;
      dirZ += camFwd.z;
    }
    if (this.input.back) {
      dirX -= camFwd.x;
      dirZ -= camFwd.z;
    }
    if (this.input.right) {
      dirX += camRight.x;
      dirZ += camRight.z;
    }
    if (this.input.left) {
      dirX -= camRight.x;
      dirZ -= camRight.z;
    }

    const moving = dirX !== 0 || dirZ !== 0;
    if (moving) {
      const len = Math.hypot(dirX, dirZ);
      dirX /= len;
      dirZ /= len;
    }

    const speed = this.input.run ? this.runSpeed : this.moveSpeed;
    this.velocity.x = dirX * speed;
    this.velocity.z = dirZ * speed;

    // Gravity
    if (!this.grounded) {
      this.velocity.y += this.gravity * dt;
    }

    // Apply velocity
    this.root.position.x += this.velocity.x * dt;
    this.root.position.y += this.velocity.y * dt;
    this.root.position.z += this.velocity.z * dt;

    // Ground check (Y=0 plane for v1)
    if (this.root.position.y <= 0) {
      this.root.position.y = 0;
      this.velocity.y = 0;
      if (!this.grounded) this.grounded = true;
    } else if (this.velocity.y < 0) {
      this.state = "fall";
    }

    // Soft world bounds (keep player on the plaza disc, r=24)
    const r = Math.hypot(this.root.position.x, this.root.position.z);
    if (r > 30) {
      const k = 30 / r;
      this.root.position.x *= k;
      this.root.position.z *= k;
    }

    // Facing
    if (moving) {
      const targetYaw = Math.atan2(dirX, dirZ);
      if (!this.root.rotationQuaternion) {
        this.root.rotationQuaternion = Quaternion.RotationYawPitchRoll(targetYaw, 0, 0);
      } else {
        const target = Quaternion.RotationYawPitchRoll(targetYaw, 0, 0);
        Quaternion.SlerpToRef(
          this.root.rotationQuaternion,
          target,
          Math.min(1, dt * 12),
          this.root.rotationQuaternion,
        );
      }
    }

    // State machine
    if (this.grounded) {
      if (moving) this.state = this.input.run ? "run" : "walk";
      else this.state = "idle";
    }

    // Broadcast position at 10Hz when moving
    const now = performance.now();
    if (this.onMove && (moving || now - this.lastBroadcast > 1000) && now - this.lastBroadcast > 100) {
      this.lastBroadcast = now;
      const yaw = this.root.rotationQuaternion
        ? Math.atan2(2 * (this.root.rotationQuaternion.w * this.root.rotationQuaternion.y), 1 - 2 * this.root.rotationQuaternion.y * this.root.rotationQuaternion.y)
        : 0;
      this.onMove(this.root.position, yaw);
    }
  }
}

const _unused: Ray | null = null;
void _unused;
