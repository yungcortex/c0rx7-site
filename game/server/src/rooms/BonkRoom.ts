import { Room, Client } from "@colyseus/core";
import { Schema, type, MapSchema } from "@colyseus/schema";

class PlayerSchema extends Schema {
  @type("string") username = "";
  @type("string") color = "#a3e7c4";
  @type("string") hat = "none";
  @type("number") x = 0;
  @type("number") y = 1;
  @type("number") z = 0;
  @type("number") yaw = 0;
  @type("boolean") alive = true;
  @type("number") bonks = 0;
}

class RoomState extends Schema {
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type("string") variant = "bonk-island";
  @type("string") phase = "lobby"; // "lobby" | "countdown" | "playing" | "ended"
  @type("number") startsAt = 0;
}

interface JoinOptions {
  username?: string;
  color?: string;
  hat?: string;
  variant?: string;
}

interface InputMessage {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  dive: boolean;
  bonk: boolean;
}

const TICK_HZ = 30;
const ARENA_R = 12;
const KILL_FLOOR = -8;

export class BonkRoom extends Room<RoomState> {
  maxClients = 8;

  onCreate(options: JoinOptions) {
    this.setState(new RoomState());
    if (options.variant) this.state.variant = options.variant;

    this.onMessage("input", (client, msg: InputMessage) => {
      this.handleInput(client, msg);
    });

    this.setSimulationInterval(() => this.tick(), 1000 / TICK_HZ);
  }

  onJoin(client: Client, options: JoinOptions) {
    const player = new PlayerSchema();
    player.username = options.username ?? "Bean";
    player.color = options.color ?? "#a3e7c4";
    player.hat = options.hat ?? "none";
    // Spawn on outer ring
    const idx = this.state.players.size;
    const ang = (idx / 8) * Math.PI * 2;
    player.x = Math.cos(ang) * 7;
    player.z = Math.sin(ang) * 7;
    player.y = 1;
    this.state.players.set(client.sessionId, player);

    // Auto-start countdown when 2+ players
    if (this.state.players.size >= 2 && this.state.phase === "lobby") {
      this.state.phase = "countdown";
      this.state.startsAt = Date.now() + 5000;
      this.clock.setTimeout(() => {
        if (this.state.phase === "countdown") this.state.phase = "playing";
      }, 5000);
    }
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    if (this.state.phase === "playing" && this.state.players.size <= 1) {
      this.state.phase = "ended";
    }
  }

  private handleInput(client: Client, msg: InputMessage) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.alive || this.state.phase !== "playing") return;

    // For v1 we just store the latest input; tick() applies it. v2 will
    // include client-tick + reconciliation.
    (player as any)._input = msg;
  }

  private tick() {
    if (this.state.phase !== "playing") return;
    const dt = 1 / TICK_HZ;
    const SPEED = 6;

    this.state.players.forEach((p) => {
      if (!p.alive) return;
      const input: InputMessage | undefined = (p as any)._input;
      if (!input) return;

      let dx = 0, dz = 0;
      if (input.forward) dz += 1;
      if (input.back) dz -= 1;
      if (input.right) dx += 1;
      if (input.left) dx -= 1;
      const len = Math.hypot(dx, dz);
      if (len > 0) {
        dx /= len;
        dz /= len;
        p.yaw = Math.atan2(dx, dz);
      }
      p.x += dx * SPEED * dt;
      p.z += dz * SPEED * dt;

      // Falloff check
      if (Math.hypot(p.x, p.z) > ARENA_R) {
        p.y -= 22 * dt;
        if (p.y < KILL_FLOOR) {
          p.alive = false;
        }
      }
    });

    // Bonk collision: any two players within 1.5m, the diving one knocks
    // the other away. v2 will use the input.dive flag + diveTimer authority.
    const list = Array.from(this.state.players.values());
    for (let i = 0; i < list.length; i++) {
      const a = list[i]!;
      if (!a.alive) continue;
      const aInput: InputMessage | undefined = (a as any)._input;
      if (!aInput?.dive) continue;
      for (let j = 0; j < list.length; j++) {
        if (i === j) continue;
        const b = list[j]!;
        if (!b.alive) continue;
        if (Math.hypot(b.x - a.x, b.z - a.z) < 1.5) {
          // Knock b in the direction of a→b
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const d = Math.hypot(dx, dz) || 1;
          b.x += (dx / d) * 4;
          b.z += (dz / d) * 4;
          a.bonks++;
        }
      }
    }

    // Check for victory condition
    const alive = list.filter((p) => p.alive);
    if (alive.length <= 1 && list.length > 1) {
      this.state.phase = "ended";
    }
  }
}
