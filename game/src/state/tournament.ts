import { create } from "zustand";
import type { ArenaVariantId } from "@game/scenes/arena-bonk/arenaVariants";

export type TournamentMode =
  | "elimination" // last N beans qualify
  | "survival"   // last bean standing wins
  | "race"       // first to finish wins
  | "final";     // 1v1 or 4-player survival

export interface TournamentRound {
  variant: ArenaVariantId;
  mode: TournamentMode;
  /** Number of beans that move to the next round. Final = 1. */
  qualifyCount: number;
  title: string;
  blurb: string;
}

export interface TournamentBean {
  id: string;
  username: string;
  /** Hex color for bracket display */
  color: string;
  isPlayer: boolean;
  alive: boolean;
}

interface TournamentState {
  active: boolean;
  rounds: TournamentRound[];
  roundIdx: number;
  beans: TournamentBean[];
  /** Beans qualified in the most recently completed round, in order. */
  qualified: TournamentBean[];
  /** Beans eliminated this tournament, oldest first. */
  eliminated: TournamentBean[];
  /** Pending after-round modal — shows qualifying bracket. */
  showRoundResult: boolean;
  start: (rounds: TournamentRound[], playerName: string, playerColor: string) => void;
  recordRoundResult: (qualifiedIds: string[]) => void;
  acknowledgeRoundResult: () => void;
  abort: () => void;
}

const FUNNY_NAMES = [
  "BeanZilla", "TopBonk", "JellyKnight", "CrumbWizard", "SoftServe",
  "MeanBean", "DiveLord", "HopMaster", "TumbleBean", "GrandLeggo",
  "BounceBoi", "WafflePunch", "NoodleArm", "FuzzMop", "SqueakHero",
  "BloopKnight", "PlumpPunch", "GooLord", "FluffJab", "ChonkClown",
  "ZestKick", "GiggleBomb", "PuffPoke", "QuibblePop", "SnootJab",
];
const COLORS = [
  "#ff6b6b", "#4ecdc4", "#ffd93d", "#6bcfff", "#a3e7c4",
  "#f9a826", "#bf85ff", "#ff8db1", "#7afcc7", "#ffa766",
  "#85e0ff", "#fff685", "#ff85ad", "#85ff9c", "#ff9f85",
  "#85b1ff", "#ffd685", "#c785ff", "#85ff8a", "#ff85e0",
];

function fillRoster(playerName: string, playerColor: string, count = 24): TournamentBean[] {
  const list: TournamentBean[] = [
    { id: "player", username: playerName, color: playerColor, isPlayer: true, alive: true },
  ];
  const used = new Set<number>();
  for (let i = 0; i < count - 1; i++) {
    let nameIdx = Math.floor(Math.random() * FUNNY_NAMES.length);
    while (used.has(nameIdx)) nameIdx = Math.floor(Math.random() * FUNNY_NAMES.length);
    used.add(nameIdx);
    list.push({
      id: `npc-${i}`,
      username: FUNNY_NAMES[nameIdx]! + (Math.floor(Math.random() * 99)),
      color: COLORS[i % COLORS.length]!,
      isPlayer: false,
      alive: true,
    });
  }
  return list;
}

export const useTournament = create<TournamentState>((set, get) => ({
  active: false,
  rounds: [],
  roundIdx: 0,
  beans: [],
  qualified: [],
  eliminated: [],
  showRoundResult: false,
  start: (rounds, playerName, playerColor) =>
    set({
      active: true,
      rounds,
      roundIdx: 0,
      beans: fillRoster(playerName, playerColor, 24),
      qualified: [],
      eliminated: [],
      showRoundResult: false,
    }),
  recordRoundResult: (qualifiedIds) => {
    const { beans } = get();
    const qSet = new Set(qualifiedIds);
    const qualified: TournamentBean[] = [];
    const newEliminated: TournamentBean[] = [];
    for (const b of beans) {
      if (qSet.has(b.id)) qualified.push({ ...b, alive: true });
      else newEliminated.push({ ...b, alive: false });
    }
    set((s) => ({
      qualified,
      eliminated: [...s.eliminated, ...newEliminated],
      showRoundResult: true,
    }));
  },
  acknowledgeRoundResult: () => {
    const { roundIdx, qualified, rounds } = get();
    const nextIdx = roundIdx + 1;
    if (nextIdx >= rounds.length || qualified.length <= 1) {
      set({ active: false, showRoundResult: false });
    } else {
      set({
        roundIdx: nextIdx,
        beans: qualified,
        qualified: [],
        showRoundResult: false,
      });
    }
  },
  abort: () =>
    set({
      active: false,
      rounds: [],
      roundIdx: 0,
      beans: [],
      qualified: [],
      eliminated: [],
      showRoundResult: false,
    }),
}));

// 3-round tournament: Race opener → Bonk Brawl → Final.
// Mixed pacing — qualifier first, brawl second, intimate final third.
export const STANDARD_TOURNAMENT: TournamentRound[] = [
  {
    variant: "bean-race",
    mode: "race",
    qualifyCount: 12,
    title: "Round 1 · Bean Race",
    blurb: "Sprint the obstacle course. First 12 beans across the line qualify.",
  },
  {
    variant: "bonk-island",
    mode: "elimination",
    qualifyCount: 6,
    title: "Round 2 · Bonk Brawl",
    blurb: "Tiered pink bowl with bouncepads. Last 6 beans standing survive.",
  },
  {
    variant: "king-of-bell",
    mode: "final",
    qualifyCount: 1,
    title: "Final · King of the Bell",
    blurb: "Hold the golden zone under the bell. One bean wins the crown + the pot.",
  },
];
