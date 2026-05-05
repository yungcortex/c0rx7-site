/**
 * Lightweight Solana wallet integration. We avoid pulling in the full
 * @solana/wallet-adapter-react chain right now (large dep, lots of providers)
 * and just talk to the Phantom + Solflare + Backpack window injections
 * directly. Sufficient for read-only auth + future signing.
 *
 * Future: when escrow signatures land, swap to wallet-adapter-react which
 * abstracts multi-wallet + auto-reconnect.
 */

interface InjectedSolanaWallet {
  isPhantom?: boolean;
  isBackpack?: boolean;
  isSolflare?: boolean;
  publicKey?: { toString(): string };
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  disconnect: () => Promise<void>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    solana?: InjectedSolanaWallet;
    backpack?: InjectedSolanaWallet;
    solflare?: InjectedSolanaWallet;
  }
}

export interface WalletInfo {
  pubkey: string;
  walletName: "phantom" | "backpack" | "solflare" | "unknown";
}

function detectInjected(): InjectedSolanaWallet | null {
  if (typeof window === "undefined") return null;
  if (window.solana?.isPhantom) return window.solana;
  if (window.backpack) return window.backpack;
  if (window.solflare) return window.solflare;
  if (window.solana) return window.solana;
  return null;
}

function detectName(w: InjectedSolanaWallet): WalletInfo["walletName"] {
  if (w.isPhantom) return "phantom";
  if (w.isBackpack) return "backpack";
  if (w.isSolflare) return "solflare";
  return "unknown";
}

export async function connectWallet(): Promise<WalletInfo | null> {
  const w = detectInjected();
  if (!w) {
    window.open("https://phantom.app/", "_blank");
    return null;
  }
  try {
    const res = await w.connect();
    return { pubkey: res.publicKey.toString(), walletName: detectName(w) };
  } catch (err) {
    console.warn("[wallet] connect failed", err);
    return null;
  }
}

export async function silentReconnect(): Promise<WalletInfo | null> {
  const w = detectInjected();
  if (!w) return null;
  try {
    const res = await w.connect({ onlyIfTrusted: true });
    return { pubkey: res.publicKey.toString(), walletName: detectName(w) };
  } catch {
    return null;
  }
}

export async function disconnectWallet(): Promise<void> {
  const w = detectInjected();
  if (!w) return;
  try {
    await w.disconnect();
  } catch (e) {
    console.warn("[wallet] disconnect", e);
  }
}

export function shortPubkey(pubkey: string, head = 4, tail = 4): string {
  if (pubkey.length <= head + tail + 1) return pubkey;
  return `${pubkey.slice(0, head)}…${pubkey.slice(-tail)}`;
}
