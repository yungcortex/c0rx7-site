import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type InventorySlot =
  | "hat"
  | "outfit"
  | "accessory"
  | "pattern"
  | "eye"
  | "mouth";

export interface OwnedItem {
  slot: InventorySlot;
  itemId: string;
  acquiredAt: number;
}

const FREE_STARTER_ITEMS: Omit<OwnedItem, "acquiredAt">[] = [
  { slot: "hat", itemId: "none" },
  { slot: "hat", itemId: "wizard" },
  { slot: "hat", itemId: "tophat" },
  { slot: "outfit", itemId: "none" },
  { slot: "outfit", itemId: "cape" },
  { slot: "outfit", itemId: "scarf" },
  { slot: "accessory", itemId: "none" },
  { slot: "accessory", itemId: "glasses" },
  { slot: "accessory", itemId: "mustache" },
  // Eyes / mouths / patterns are all free at launch (cosmetic minimum)
  { slot: "eye", itemId: "round" },
  { slot: "eye", itemId: "sparkle" },
  { slot: "eye", itemId: "sleepy" },
  { slot: "eye", itemId: "angry" },
  { slot: "eye", itemId: "dead" },
  { slot: "eye", itemId: "heart" },
  { slot: "eye", itemId: "swirl" },
  { slot: "mouth", itemId: "smile" },
  { slot: "mouth", itemId: "grin" },
  { slot: "mouth", itemId: "frown" },
  { slot: "mouth", itemId: "gasp" },
  { slot: "mouth", itemId: "smug" },
  { slot: "mouth", itemId: "tongue" },
  { slot: "mouth", itemId: "neutral" },
  { slot: "pattern", itemId: "none" },
  { slot: "pattern", itemId: "stripes" },
  { slot: "pattern", itemId: "dots" },
  { slot: "pattern", itemId: "split" },
  { slot: "pattern", itemId: "gradient" },
];

interface InventoryState {
  owned: OwnedItem[];
  has: (slot: InventorySlot, itemId: string) => boolean;
  unlock: (slot: InventorySlot, itemId: string) => void;
}

export const useInventory = create<InventoryState>()(
  persist(
    (set, get) => ({
      owned: FREE_STARTER_ITEMS.map((i) => ({ ...i, acquiredAt: 0 })),
      has: (slot, itemId) =>
        get().owned.some((o) => o.slot === slot && o.itemId === itemId),
      unlock: (slot, itemId) =>
        set((state) => {
          if (state.owned.some((o) => o.slot === slot && o.itemId === itemId)) return state;
          return {
            owned: [...state.owned, { slot, itemId, acquiredAt: Date.now() }],
          };
        }),
    }),
    {
      name: "bean-royale-inventory",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// =================== SHOP CATALOG ===================

export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface ShopItem {
  slot: InventorySlot;
  itemId: string;
  label: string;
  rarity: Rarity;
  /** Price in SOL (mocked for v1) */
  priceSol: number;
}

export const SHOP_CATALOG: ShopItem[] = [
  // Hats
  { slot: "hat", itemId: "crown",     label: "Crown",     rarity: "epic",      priceSol: 0.25 },
  { slot: "hat", itemId: "propeller", label: "Propeller", rarity: "common",    priceSol: 0.05 },
  { slot: "hat", itemId: "helmet",    label: "Helmet",    rarity: "rare",      priceSol: 0.12 },
  { slot: "hat", itemId: "horns",     label: "Horns",     rarity: "rare",      priceSol: 0.15 },
  { slot: "hat", itemId: "halo",      label: "Halo",      rarity: "legendary", priceSol: 1.20 },
  // Outfits
  { slot: "outfit", itemId: "armor",     label: "Armor",      rarity: "rare",      priceSol: 0.18 },
  { slot: "outfit", itemId: "robe-trim", label: "Robe Trim",  rarity: "epic",      priceSol: 0.32 },
  { slot: "outfit", itemId: "bowtie",    label: "Bowtie",     rarity: "common",    priceSol: 0.04 },
  // Accessories
  { slot: "accessory", itemId: "monocle",  label: "Monocle",  rarity: "epic",   priceSol: 0.20 },
  { slot: "accessory", itemId: "earrings", label: "Earrings", rarity: "common", priceSol: 0.06 },
];

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#b7c2c2",
  rare: "#6ba9d4",
  epic: "#c89adb",
  legendary: "#e8c878",
};
