import { Scene, Vector3 } from "@babylonjs/core";
import type { Bean } from "@game/systems/character/Bean";

/**
 * Procedural animator for the Bean character. Drives every visible part each
 * frame so the bean reads as alive — feet pump on walk, body squashes on
 * jump/land, hands swing, eyes track motion, hat bobs, tail flicks.
 *
 * Replaces the static idle bob from Bean.ts with a full state-driven system.
 *
 * Inputs per tick:
 *   velocity (world-space) — derived from root.position delta
 *   onGround — set by controller
 *   poseEvents — spike values that decay (jump, land, dive, bonk)
 */

export type BeanState = "idle" | "walk" | "run" | "jump" | "fall" | "dive" | "stunned" | "emote";

export interface BeanAnimatorOpts {
  bean: Bean;
  /** Disable feet pumping (e.g., remote bean with separate pump controller) */
  disableFeet?: boolean;
}

export class BeanAnimator {
  private bean: Bean;
  private scene: Scene;
  private observer: ReturnType<Scene["onBeforeRenderObservable"]["add"]>;

  private lastPos = new Vector3(0, 0, 0);
  private smoothedSpeed = 0;
  private walkPhase = 0;

  // Pose-event spikes (1.0 → 0.0 over a few frames)
  private jumpPulse = 0;
  private landPulse = 0;
  private divePulse = 0;
  private bonkPulse = 0;
  private emoteTimer = 0;
  private emoteId: "wave" | "dance" | "sleep" | "taunt" | null = null;

  state: BeanState = "idle";
  enabled = true;

  constructor(opts: BeanAnimatorOpts) {
    this.bean = opts.bean;
    this.scene = opts.bean.body.getScene();

    // Stop the static idle-bob animation that was on body — we drive scaling now
    this.scene.stopAnimation(this.bean.body);

    this.observer = this.scene.onBeforeRenderObservable.add(() => this.tick());
  }

  dispose() {
    if (this.observer) this.scene.onBeforeRenderObservable.remove(this.observer);
  }

  setState(s: BeanState) {
    this.state = s;
  }

  triggerJump() { this.jumpPulse = 1; }
  triggerLand() { this.landPulse = 1; }
  triggerDive() { this.divePulse = 1; }
  triggerBonkHit() { this.bonkPulse = 1; }

  emote(id: "wave" | "dance" | "sleep" | "taunt", durationSec = 1.6) {
    this.emoteId = id;
    this.emoteTimer = durationSec;
  }

  private tick() {
    if (!this.enabled) return;
    const dt = this.scene.getEngine().getDeltaTime() / 1000;
    const t = performance.now() / 1000;

    const root = this.bean.root;
    const pos = root.position;
    const vx = (pos.x - this.lastPos.x) / Math.max(dt, 0.0001);
    const vz = (pos.z - this.lastPos.z) / Math.max(dt, 0.0001);
    const horizSpeed = Math.hypot(vx, vz);
    this.smoothedSpeed += (horizSpeed - this.smoothedSpeed) * Math.min(1, dt * 12);
    this.lastPos.copyFrom(pos);

    // Walk phase advances with horizontal speed
    this.walkPhase += dt * (4 + this.smoothedSpeed * 1.5);
    const walkPump = Math.sin(this.walkPhase * Math.PI);
    const walkPumpAlt = Math.sin(this.walkPhase * Math.PI + Math.PI);

    // ============== BODY squash / stretch (bubbly Fall Guys idle) ==============
    // Bigger amplitude + slight counter-squash on X so the bean visibly breathes/bounces
    const idleBob = Math.sin(t * 2.2) * 0.085;
    const idleSquashX = -Math.sin(t * 2.2) * 0.05; // counter-squash for cartoon feel
    const idleSwayY = Math.sin(t * 0.8) * 0.018;
    const walkBob = Math.abs(walkPump) * 0.11 * Math.min(1, this.smoothedSpeed / 4);

    let bodySquashY = 1.0 + idleBob + walkBob + idleSwayY;
    let bodySquashX = 1.0 + idleSquashX * 0.6;

    // Pulse decays
    if (this.jumpPulse > 0) {
      // stretch up at start of jump
      bodySquashY += this.jumpPulse * 0.45;
      bodySquashX -= this.jumpPulse * 0.18;
      this.jumpPulse = Math.max(0, this.jumpPulse - dt * 4);
    }
    if (this.landPulse > 0) {
      // squash down on landing
      bodySquashY -= this.landPulse * 0.25;
      bodySquashX += this.landPulse * 0.18;
      this.landPulse = Math.max(0, this.landPulse - dt * 6);
    }
    if (this.divePulse > 0) {
      // forward stretch on dive
      bodySquashY -= this.divePulse * 0.18;
      bodySquashX += this.divePulse * 0.32;
      this.divePulse = Math.max(0, this.divePulse - dt * 3);
    }
    if (this.bonkPulse > 0) {
      bodySquashY -= this.bonkPulse * 0.2;
      bodySquashX += this.bonkPulse * 0.2;
      this.bonkPulse = Math.max(0, this.bonkPulse - dt * 5);
    }

    // Read live rest-scale from bean (updated by setProportions on every
    // slider change) so animation never clobbers the user's chosen body shape.
    const rs = this.bean.bodyRestScale;
    this.bean.body.scaling.x = rs.x * bodySquashX;
    this.bean.body.scaling.y = rs.y * bodySquashY;
    this.bean.body.scaling.z = rs.z * bodySquashX;

    // Body lean into motion — slerped, so it doesn't snap on direction change
    if (this.state !== "dive" && this.state !== "stunned") {
      const targetLean = -Math.min(0.25, this.smoothedSpeed * 0.045);
      const k = Math.min(1, dt * 8);
      this.bean.body.rotation.x += (targetLean - this.bean.body.rotation.x) * k;
    }

    // ============== FEET pump (alternate up/down on walk) ==============
    const footHop = Math.min(1, this.smoothedSpeed / 3.5);
    if (this.bean.feet[0]) {
      this.bean.feet[0].position.y = this.bean.feetRestY[0]! + walkPump * 0.12 * footHop + idleBob * 0.5;
    }
    if (this.bean.feet[1]) {
      this.bean.feet[1].position.y = this.bean.feetRestY[1]! + walkPumpAlt * 0.12 * footHop + idleBob * 0.5;
    }

    // ============== HANDS swing (counter to feet) ==============
    if (this.bean.hands[0]) {
      this.bean.hands[0].position.y = this.bean.handsRestY[0]! + walkPumpAlt * 0.08 * footHop;
      this.bean.hands[0].rotation.x = walkPumpAlt * 0.4 * footHop;
    }
    if (this.bean.hands[1]) {
      this.bean.hands[1].position.y = this.bean.handsRestY[1]! + walkPump * 0.08 * footHop;
      this.bean.hands[1].rotation.x = walkPump * 0.4 * footHop;
    }

    // ============== HAT bob (tracks body squash but lower amplitude) ==============
    this.bean.hatRoot.position.y = this.bean.hatRestY + (bodySquashY - 1) * 0.4 + idleBob * 0.7;
    this.bean.hatRoot.rotation.z = walkPump * 0.04 * footHop;

    // ============== TAIL flick (Vellish only, more expressive while running) ==============
    if (this.bean.tail) {
      const isRunning = this.smoothedSpeed > 4;
      const flickRate = 2.3 + (isRunning ? 4 : 0);
      const flickAmp = 0.15 + (isRunning ? 0.2 : 0);
      const tailFlick = Math.sin(t * flickRate + this.smoothedSpeed * 0.4) * flickAmp;
      this.bean.tail.rotation.y = tailFlick;
      this.bean.tail.rotation.x = -0.6 + Math.abs(walkPump) * 0.25 * footHop;
    }

    // (run-lean removed — body.rotation.x is now slerped above based on
    // smoothedSpeed, so it gracefully blends from idle → walk → run without
    // a hard snap)

    // ============== EARS twitch (Vellish/Sivit) ==============
    for (const ear of this.bean.ears) {
      const baseRotZ = Math.sign(ear.position.x) * 0.18;
      const twitch = Math.sin(t * 1.4 + ear.position.x * 8) * 0.04;
      ear.rotation.z = baseRotZ + twitch;
    }

    // ============== EYES track motion ==============
    // Pupils nudge in the direction of velocity (additive offset on top of
    // the rest position set by applyProportions).
    const yaw = this.getYaw();
    const local = this.worldVelToLocal(vx, vz, yaw);
    const lookX = Math.max(-0.04, Math.min(0.04, local.right * 0.012));
    const lookZ = Math.max(-0.025, Math.min(0.025, local.forward * 0.008));
    // We don't snapshot pupil rest positions here — they're recomputed in
    // applyProportions. Use the eye-white position as the anchor so the
    // pupil offset is small (~0.04m) and doesn't fight slider changes.
    if (this.bean.eyes.pupilL) {
      this.bean.eyes.pupilL.position.x = this.bean.eyes.left.position.x + lookX;
    }
    if (this.bean.eyes.pupilR) {
      this.bean.eyes.pupilR.position.x = this.bean.eyes.right.position.x + lookX;
    }
    void lookZ;

    // ============== EMOTES override the above ==============
    if (this.emoteTimer > 0 && this.emoteId) {
      this.applyEmote(this.emoteId, this.emoteTimer, t);
      this.emoteTimer -= dt;
      if (this.emoteTimer <= 0) {
        this.emoteId = null;
        // Reset hand rotations
        for (const h of this.bean.hands) h.rotation.set(0, 0, 0);
      }
    }
  }

  private applyEmote(id: typeof this.emoteId, _remaining: number, t: number) {
    const handL = this.bean.hands[0];
    const handR = this.bean.hands[1];
    switch (id) {
      case "wave": {
        if (handR) {
          handR.position.y = this.bean.handsRestY[1]! + 0.55;
          handR.rotation.z = -0.6 + Math.sin(t * 8) * 0.4;
        }
        break;
      }
      case "dance": {
        if (handL) {
          handL.position.y = this.bean.handsRestY[0]! + 0.5;
          handL.rotation.z = 0.7 + Math.sin(t * 6) * 0.3;
        }
        if (handR) {
          handR.position.y = this.bean.handsRestY[1]! + 0.5;
          handR.rotation.z = -0.7 - Math.sin(t * 6) * 0.3;
        }
        this.bean.body.rotation.z = Math.sin(t * 6) * 0.18;
        break;
      }
      case "sleep": {
        // Body tilts forward, eyes squashed shut
        this.bean.body.rotation.x = 0.4;
        if (this.bean.eyes.left) this.bean.eyes.left.scaling.y = 0.2;
        if (this.bean.eyes.right) this.bean.eyes.right.scaling.y = 0.2;
        break;
      }
      case "taunt": {
        const sx = this.bean.bodyRestScale.x;
        if (handL) {
          handL.position.set(-0.55 * sx, this.bean.handsRestY[0]! + 0.05, 0);
          handL.rotation.z = 0.4;
        }
        if (handR) {
          handR.position.set(0.55 * sx, this.bean.handsRestY[1]! + 0.05, 0);
          handR.rotation.z = -0.4;
        }
        this.bean.body.scaling.y *= 1 + Math.sin(t * 4) * 0.04;
        break;
      }
    }
  }

  private getYaw(): number {
    const rq = this.bean.root.rotationQuaternion;
    if (rq) {
      return Math.atan2(2 * (rq.w * rq.y + rq.x * rq.z), 1 - 2 * (rq.y * rq.y + rq.x * rq.x));
    }
    return this.bean.root.rotation.y;
  }

  private worldVelToLocal(vx: number, vz: number, yaw: number) {
    const cos = Math.cos(-yaw);
    const sin = Math.sin(-yaw);
    return {
      forward: vx * sin + vz * cos,
      right: vx * cos - vz * sin,
    };
  }
}
