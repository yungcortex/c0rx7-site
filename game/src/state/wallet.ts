import { create } from "zustand";
import {
  connectWallet,
  disconnectWallet,
  silentReconnect,
  type WalletInfo,
} from "@net/wallet";

interface WalletState {
  info: WalletInfo | null;
  connecting: boolean;
  init: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useWallet = create<WalletState>((set) => ({
  info: null,
  connecting: false,
  init: async () => {
    const info = await silentReconnect();
    if (info) set({ info });
  },
  connect: async () => {
    set({ connecting: true });
    const info = await connectWallet();
    set({ info, connecting: false });
  },
  disconnect: async () => {
    await disconnectWallet();
    set({ info: null });
  },
}));
