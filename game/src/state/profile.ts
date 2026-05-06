import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface ProfileStats {
  matchesPlayed: number;
  wins: number;
  bonks: number;
  beanCoins: number; // off-chain currency for v1
}

export interface Profile {
  username: string;
  /** Phantom pubkey OR supabase user.id; client treats them as the canonical identity */
  identity: string;
  /** Avatar bean color preview (rgb hex) */
  color: string;
  createdAt: number;
  stats: ProfileStats;
}

interface ProfileState {
  profile: Profile | null;
  setProfile: (p: Profile) => void;
  setUsername: (u: string) => void;
  registerWin: () => void;
  registerLoss: () => void;
  addBonks: (count: number) => void;
  earnCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  reset: () => void;
}

const STARTING_COINS = 250;

export const useProfile = create<ProfileState>()(
  persist(
    (set, get) => ({
      profile: null,
      setProfile: (p) => set({ profile: p }),
      setUsername: (u) =>
        set((state) =>
          state.profile ? { profile: { ...state.profile, username: u } } : {},
        ),
      registerWin: () =>
        set((state) => {
          if (!state.profile) return {};
          return {
            profile: {
              ...state.profile,
              stats: {
                ...state.profile.stats,
                matchesPlayed: state.profile.stats.matchesPlayed + 1,
                wins: state.profile.stats.wins + 1,
                beanCoins: state.profile.stats.beanCoins + 100,
              },
            },
          };
        }),
      registerLoss: () =>
        set((state) => {
          if (!state.profile) return {};
          return {
            profile: {
              ...state.profile,
              stats: {
                ...state.profile.stats,
                matchesPlayed: state.profile.stats.matchesPlayed + 1,
                beanCoins: state.profile.stats.beanCoins + 25,
              },
            },
          };
        }),
      addBonks: (count) =>
        set((state) => {
          if (!state.profile) return {};
          return {
            profile: {
              ...state.profile,
              stats: {
                ...state.profile.stats,
                bonks: state.profile.stats.bonks + count,
              },
            },
          };
        }),
      earnCoins: (amount) =>
        set((state) => {
          if (!state.profile) return {};
          return {
            profile: {
              ...state.profile,
              stats: {
                ...state.profile.stats,
                beanCoins: state.profile.stats.beanCoins + amount,
              },
            },
          };
        }),
      spendCoins: (amount) => {
        const cur = get().profile;
        if (!cur) return false;
        if (cur.stats.beanCoins < amount) return false;
        set({
          profile: {
            ...cur,
            stats: { ...cur.stats, beanCoins: cur.stats.beanCoins - amount },
          },
        });
        return true;
      },
      reset: () => set({ profile: null }),
    }),
    {
      name: "bean-royale-profile",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export function makeNewProfile(username: string, identity: string): Profile {
  return {
    username: username.slice(0, 18),
    identity,
    color: "#a3e7c4",
    createdAt: Date.now(),
    stats: {
      matchesPlayed: 0,
      wins: 0,
      bonks: 0,
      beanCoins: STARTING_COINS,
    },
  };
}

export function isUsernameValid(name: string): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 18) return false;
  return /^[A-Za-z0-9_-]+$/.test(trimmed);
}
