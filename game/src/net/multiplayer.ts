/**
 * Multiplayer skeleton — Colyseus client wrapper. Tries to connect to a
 * dev/staging server and falls back gracefully to "local-only" mode if no
 * endpoint is configured. The full Colyseus deploy + room schema lands in
 * Phase 2; this scaffolding lets us iterate on the *client* code now.
 *
 * Server-authoritative tick pattern:
 *   client → ROOM.send("input", {wasd, dive, jump})
 *   server tick (30Hz) → ROOM.broadcast("state", players[])
 *   client lerps remote bean positions toward broadcast targets
 *
 * Schema (when server lands):
 *   PlayerSchema { id, username, color, hat, x, y, z, yaw, alive, bonks }
 *   RoomState { players: MapSchema<PlayerSchema>, mode, phase }
 */

export interface RemotePlayerSnapshot {
  id: string;
  username: string;
  color: string;
  hat: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  alive: boolean;
  bonks: number;
}

export type RoomEventHandler =
  | { type: "joined"; sessionId: string }
  | { type: "left"; reason?: string }
  | { type: "state"; players: RemotePlayerSnapshot[] }
  | { type: "error"; message: string };

export interface MultiplayerClient {
  isConnected: () => boolean;
  send: (event: string, payload: unknown) => void;
  disconnect: () => void;
}

const SERVER_URL = (import.meta.env.VITE_COLYSEUS_URL as string | undefined) ?? "";

/**
 * Connect to a Colyseus room. Pass-through implementation — when SERVER_URL
 * is empty, returns null and the caller falls back to single-player. The
 * actual websocket / colyseus.js dependency is loaded dynamically so the
 * bundle stays small for solo-only players.
 */
export async function joinRoom(
  roomName: string,
  options: Record<string, unknown>,
  onEvent: (e: RoomEventHandler) => void,
): Promise<MultiplayerClient | null> {
  if (!SERVER_URL) {
    console.info("[mp] no VITE_COLYSEUS_URL set — single-player mode");
    return null;
  }

  try {
    // Dynamic import — only ship the colyseus client to players who actually MP.
    // We `@ts-ignore` because colyseus.js isn't a build-time dep yet — when the
    // server lands in Phase 2, we add it to package.json and remove this guard.
    // @ts-ignore -- optional dep
    const colyseusMod = await import("colyseus.js" as any).catch(() => null);
    if (!colyseusMod) {
      console.info("[mp] colyseus.js not bundled — install in Phase 2");
      return null;
    }
    const Client = (colyseusMod as any).Client;
    const client = new Client(SERVER_URL);
    const room = await client.joinOrCreate(roomName, options);

    onEvent({ type: "joined", sessionId: room.sessionId });

    room.onMessage("state", (data: { players: RemotePlayerSnapshot[] }) => {
      onEvent({ type: "state", players: data.players });
    });

    room.onLeave((code: number) => {
      onEvent({ type: "left", reason: `code ${code}` });
    });

    room.onError((code: number, message?: string) => {
      onEvent({ type: "error", message: `${code} ${message ?? ""}` });
    });

    return {
      isConnected: () => true,
      send: (event: string, payload: unknown) => room.send(event, payload),
      disconnect: () => room.leave(),
    };
  } catch (err) {
    console.warn("[mp] connect failed; falling back to solo", err);
    onEvent({ type: "error", message: String(err) });
    return null;
  }
}

/**
 * Convenience predicate — does the build know about a Colyseus server?
 * Used by lobby UI to decorate "multiplayer" badges.
 */
export function isMultiplayerConfigured(): boolean {
  return Boolean(SERVER_URL);
}
