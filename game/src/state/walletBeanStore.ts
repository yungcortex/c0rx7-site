import type { SliderState } from "@game/systems/character/SliderBlob";
import type { CosmeticState } from "@state/character";

/**
 * Per-wallet bean save store. When a wallet connects, we load the bean
 * customization that was last saved against that pubkey. When the user
 * binds a bean while wallet is connected, we save under the wallet
 * pubkey so re-connecting later restores the look.
 *
 * Storage: localStorage key "bean-royale-beans-by-wallet" → JSON map
 * { [pubkey]: { sliders, cosmetic, name, savedAt } }.
 *
 * Phase 2 syncs this map to Supabase (per-wallet row) so the bean
 * follows the user across devices.
 */

interface SavedBean {
  sliders: SerializedSliders;
  cosmetic: CosmeticState;
  name: string;
  savedAt: number;
}

// SliderState contains Uint8Array fields which don't serialize directly to JSON.
// Convert to plain arrays on save, back on load.
interface SerializedSliders {
  version: number;
  heritage: SliderState["heritage"];
  subBuild: number;
  bodyType: number;
  muscle: number;
  height: number;
  buildWeight: number;
  faceBlendshapes: number[];
  bodyBlendshapes: number[];
  skin: SliderState["skin"];
  hair: SliderState["hair"];
  eyes: SliderState["eyes"];
  voice: SliderState["voice"];
  backstory: SliderState["backstory"];
  tattoos: SliderState["tattoos"];
  paintMarkings: SliderState["paintMarkings"];
}

const KEY = "bean-royale-beans-by-wallet";

function readMap(): Record<string, SavedBean> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, SavedBean>;
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, SavedBean>) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch (err) {
    console.warn("[walletBeanStore] write failed", err);
  }
}

function serializeSliders(s: SliderState): SerializedSliders {
  return {
    version: s.version,
    heritage: s.heritage,
    subBuild: s.subBuild,
    bodyType: s.bodyType,
    muscle: s.muscle,
    height: s.height,
    buildWeight: s.buildWeight,
    faceBlendshapes: Array.from(s.faceBlendshapes),
    bodyBlendshapes: Array.from(s.bodyBlendshapes),
    skin: s.skin,
    hair: s.hair,
    eyes: s.eyes,
    voice: s.voice,
    backstory: s.backstory,
    tattoos: s.tattoos,
    paintMarkings: s.paintMarkings,
  };
}

function deserializeSliders(s: SerializedSliders): SliderState {
  return {
    version: s.version,
    heritage: s.heritage,
    subBuild: s.subBuild,
    bodyType: s.bodyType,
    muscle: s.muscle,
    height: s.height,
    buildWeight: s.buildWeight,
    faceBlendshapes: new Uint8Array(s.faceBlendshapes),
    bodyBlendshapes: new Uint8Array(s.bodyBlendshapes),
    skin: s.skin,
    hair: s.hair,
    eyes: s.eyes,
    voice: s.voice,
    backstory: s.backstory,
    tattoos: s.tattoos,
    paintMarkings: s.paintMarkings,
  };
}

export function saveBeanForWallet(
  pubkey: string,
  sliders: SliderState,
  cosmetic: CosmeticState,
  name: string,
): void {
  const map = readMap();
  map[pubkey] = {
    sliders: serializeSliders(sliders),
    cosmetic,
    name,
    savedAt: Date.now(),
  };
  writeMap(map);
}

export function loadBeanForWallet(
  pubkey: string,
): { sliders: SliderState; cosmetic: CosmeticState; name: string } | null {
  const map = readMap();
  const saved = map[pubkey];
  if (!saved) return null;
  return {
    sliders: deserializeSliders(saved.sliders),
    cosmetic: saved.cosmetic,
    name: saved.name,
  };
}

export function listWallets(): string[] {
  return Object.keys(readMap());
}
