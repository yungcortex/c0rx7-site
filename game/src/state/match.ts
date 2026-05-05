import { create } from "zustand";
import { playSfx } from "@game/systems/audio/SoundManager";
import type { ArenaVariantId } from "@game/scenes/arena-bonk/arenaVariants";

export type MatchPhase = "ready" | "countdown" | "playing" | "won" | "lost";

interface MatchState {
  phase: MatchPhase;
  variant: ArenaVariantId;
  totalBeans: number;
  beansAlive: number;
  bonks: number;
  startedAt: number;
  /** ms timestamp until which the player is invulnerable (spawn protection) */
  invulnerableUntil: number;
  /** ms timestamp at which countdown ends and play begins */
  playableAt: number;
  setVariant: (v: ArenaVariantId) => void;
  reset: (totalBeans: number) => void;
  beginCountdown: (countdownSec: number, invulnSec: number) => void;
  beginPlay: () => void;
  registerKO: () => void;
  setPlayerDead: () => void;
  incrementBonks: () => void;
  isInvulnerable: () => boolean;
  isPlayable: () => boolean;
}

export const useMatch = create<MatchState>((set, get) => ({
  phase: "ready",
  variant: "bonk-island",
  totalBeans: 0,
  beansAlive: 0,
  bonks: 0,
  startedAt: 0,
  invulnerableUntil: 0,
  playableAt: 0,
  setVariant: (v) => set({ variant: v }),
  reset: (totalBeans) => {
    const now = Date.now();
    set({
      phase: "countdown",
      totalBeans,
      beansAlive: totalBeans,
      bonks: 0,
      startedAt: now,
      playableAt: now + 3500, // 3-2-1-GO
      invulnerableUntil: now + 5500, // extra 2s grace after countdown
    });
  },
  beginCountdown: (countdownSec, invulnSec) => {
    const now = Date.now();
    set({
      phase: "countdown",
      startedAt: now,
      playableAt: now + countdownSec * 1000,
      invulnerableUntil: now + (countdownSec + invulnSec) * 1000,
    });
  },
  beginPlay: () => set({ phase: "playing" }),
  isInvulnerable: () => Date.now() < get().invulnerableUntil,
  isPlayable: () => Date.now() >= get().playableAt,
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
