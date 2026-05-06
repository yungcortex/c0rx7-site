import { create } from "zustand";

/**
 * Tournament economy state. Tracks the current match's entry-fee deposit
 * (signature, lobby id) so the post-match settlement can call back into
 * the program with the right lobby reference.
 *
 * All prices in SOL. Set on tournament start → cleared on tournament end.
 */

export interface TournamentEntry {
  /** "lobby PDA address" (or stub for v1 paper-deposit flow) */
  lobbyId: string;
  /** Network label for display */
  network: string;
  /** Player's deposit tx signature */
  depositSig: string;
  /** Total pot in SOL (entry × players) */
  potSol: number;
  /** Fee paid (in SOL) */
  feeSol: number;
  /** Wallet address that paid */
  payerPubkey: string;
}

interface EconomyState {
  entry: TournamentEntry | null;
  setEntry: (e: TournamentEntry) => void;
  clearEntry: () => void;
}

export const useEconomy = create<EconomyState>((set) => ({
  entry: null,
  setEntry: (e) => set({ entry: e }),
  clearEntry: () => set({ entry: null }),
}));

export const TOURNAMENT_ENTRY_FEE_SOL = 0.05;
export const TOURNAMENT_BEAN_COUNT = 8;
export const TOURNAMENT_TOTAL_POT_SOL = TOURNAMENT_ENTRY_FEE_SOL * TOURNAMENT_BEAN_COUNT;
export const HOUSE_CUT_BPS = 800; // 8%
