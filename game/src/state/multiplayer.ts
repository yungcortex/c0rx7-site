import { create } from "zustand";
import type { RemotePlayerSnapshot, MultiplayerClient } from "@net/multiplayer";

interface MultiplayerState {
  client: MultiplayerClient | null;
  remotes: Map<string, RemotePlayerSnapshot>;
  connected: boolean;
  setClient: (c: MultiplayerClient | null) => void;
  upsertRemote: (p: RemotePlayerSnapshot) => void;
  removeRemote: (id: string) => void;
  clearRemotes: () => void;
  setConnected: (b: boolean) => void;
}

export const useMultiplayer = create<MultiplayerState>((set) => ({
  client: null,
  remotes: new Map(),
  connected: false,
  setClient: (c) => set({ client: c, connected: !!c }),
  upsertRemote: (p) =>
    set((state) => {
      const next = new Map(state.remotes);
      next.set(p.id, p);
      return { remotes: next };
    }),
  removeRemote: (id) =>
    set((state) => {
      const next = new Map(state.remotes);
      next.delete(id);
      return { remotes: next };
    }),
  clearRemotes: () => set({ remotes: new Map() }),
  setConnected: (b) => set({ connected: b }),
}));
