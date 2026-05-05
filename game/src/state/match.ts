import { create } from "zustand";
import { playSfx } from "@game/systems/audio/SoundManager";
import type { ArenaVariantId } from "@game/scenes/arena-bonk/arenaVariants";

export type MatchPhase = "ready" | "playing" | "won" | "lost";

interface MatchState {
  phase: MatchPhase;
  variant: ArenaVariantId;
  totalBeans: number;
  beansAlive: number;
  bonks: number;
  startedAt: number;
  setVariant: (v: ArenaVariantId) => void;
  reset: (totalBeans: number) => void;
  registerKO: () => void;
  setPlayerDead: () => void;
  incrementBonks: () => void;
}

export const useMatch = create<MatchState>((set, get) => ({
  phase: "ready",
  variant: "bonk-island",
  totalBeans: 0,
  beansAlive: 0,
  bonks: 0,
  startedAt: 0,
  setVariant: (v) => set({ variant: v }),
  reset: (totalBeans) =>
    set({
      phase: "playing",
      totalBeans,
      beansAlive: totalBeans,
      bonks: 0,
      startedAt: Date.now(),
    }),
  registerKO: () => {
    const next = Math.max(0, get().beansAlive - 1);
    if (next <= 1) {
      set({ beansAlive: next, phase: "won" });
      playSfx("win");
    } else {
      set({ beansAlive: next });
    }
  },
  setPlayerDead: () => {
    set({ phase: "lost" });
  },
  incrementBonks: () => set((s) => ({ bonks: s.bonks + 1 })),
}));
