import { Scene, Vector3, Quaternion, TransformNode } from "@babylonjs/core";
import {
  buildPlaceholderAvatar,
  MorphController,
  type CharacterAvatar,
} from "@game/systems/character/MorphController";
import {
  makeDefaultSliderState,
  type Heritage,
} from "@game/systems/character/SliderBlob";
import { useWorld } from "@state/world";

interface RemoteAvatarInstance {
  avatar: CharacterAvatar;
  morph: MorphController;
  targetPos: Vector3;
  targetRot: number;
  lerpSpeed: number;
  lastUpdate: number;
  namePlate?: TransformNode;
}

const MAX_VISIBLE = 24;
const STALE_MS = 30_000;

/**
 * PresenceManager spawns/updates/despawns remote player avatars in the active
 * scene by subscribing to the world store's remotePlayers map. Lerps remote
 * positions toward broadcast targets for smooth movement.
 */
export class PresenceManager {
  private scene: Scene;
  private avatars = new Map<string, RemoteAvatarInstance>();
  private unsubscribe: () => void;
  private renderObserver: ReturnType<Scene["onBeforeRenderObservable"]["add"]>;

  constructor(scene: Scene) {
    this.scene = scene;
    this.unsubscribe = useWorld.subscribe((s) => this.sync(s.remotePlayers));
    this.renderObserver = this.scene.onBeforeRenderObservable.add(() => this.tick());
  }

  dispose() {
    this.unsubscribe();
    if (this.renderObserver) this.scene.onBeforeRenderObservable.remove(this.renderObserver);
    for (const a of this.avatars.values()) {
      a.avatar.root.dispose(false, true);
    }
    this.avatars.clear();
  }

  private sync(remotes: Map<string, ReturnType<typeof useWorld.getState>["remotePlayers"] extends Map<string, infer V> ? V : never>) {
    const seen = new Set<string>();
    let visible = 0;
    for (const [id, p] of remotes) {
      if (visible >= MAX_VISIBLE) break;
      visible++;
      seen.add(id);
      let inst = this.avatars.get(id);
      if (!inst) {
        inst = this.spawn(id, p.heritage as Heritage, p.name);
      }
      inst.targetPos.set(p.position.x, p.position.y, p.position.z);
      inst.targetRot = p.position.r;
      inst.lastUpdate = p.last_seen;
    }
    for (const [id, inst] of this.avatars) {
      if (!seen.has(id) || Date.now() - inst.lastUpdate > STALE_MS) {
        inst.avatar.root.dispose(false, true);
        this.avatars.delete(id);
      }
    }
  }

  private spawn(id: string, heritage: Heritage, _name: string): RemoteAvatarInstance {
    const avatar = buildPlaceholderAvatar(this.scene);
    const morph = new MorphController();
    morph.attach(avatar);
    morph.apply(makeDefaultSliderState(heritage));
    avatar.root.name = `remote-${id}`;
    const inst: RemoteAvatarInstance = {
      avatar,
      morph,
      targetPos: avatar.root.position.clone(),
      targetRot: 0,
      lerpSpeed: 8,
      lastUpdate: Date.now(),
    };
    this.avatars.set(id, inst);
    return inst;
  }

  private tick() {
    const dt = this.scene.getEngine().getDeltaTime() / 1000;
    for (const inst of this.avatars.values()) {
      const k = Math.min(1, dt * inst.lerpSpeed);
      const cur = inst.avatar.root.position;
      cur.x += (inst.targetPos.x - cur.x) * k;
      cur.y += (inst.targetPos.y - cur.y) * k;
      cur.z += (inst.targetPos.z - cur.z) * k;

      if (!inst.avatar.root.rotationQuaternion) {
        inst.avatar.root.rotationQuaternion = Quaternion.RotationYawPitchRoll(
          inst.targetRot,
          0,
          0,
        );
      } else {
        const target = Quaternion.RotationYawPitchRoll(inst.targetRot, 0, 0);
        Quaternion.SlerpToRef(
          inst.avatar.root.rotationQuaternion,
          target,
          k,
          inst.avatar.root.rotationQuaternion,
        );
      }
    }
  }
}

let active: PresenceManager | null = null;

export function startPresence(scene: Scene): PresenceManager {
  if (active) active.dispose();
  active = new PresenceManager(scene);
  return active;
}

export function stopPresence() {
  if (active) {
    active.dispose();
    active = null;
  }
}
