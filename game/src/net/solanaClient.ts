/**
 * Solana / Anchor client wiring. Devnet-only for now. The Anchor program
 * code lives in `programs/escrow/src/lib.rs`; once it's built + deployed,
 * we get an IDL JSON and a program-id that we feed in here.
 *
 * Provides three high-level operations:
 *   createLobby(modeId, entryFeeSol, maxPlayers) → lobbyAddress
 *   depositEntry(lobbyAddress) → tx signature
 *   settleMatch(lobbyAddress, winnerPubkey) → tx signature  (server-side)
 *
 * For Phase 3 (now): build + sign + send via Phantom. Phase 4 audit gates
 * mainnet flip.
 */

const RPC_URL =
  (import.meta.env.VITE_SOLANA_RPC_URL as string | undefined) ??
  "https://api.devnet.solana.com";

const PROGRAM_ID =
  (import.meta.env.VITE_BEAN_ROYALE_PROGRAM_ID as string | undefined) ??
  "BEANRoYAL3eSCRoW1111111111111111111111111111";

const HOUSE_PUBKEY =
  (import.meta.env.VITE_BEAN_ROYALE_HOUSE as string | undefined) ?? "";

export interface LobbyDescriptor {
  modeId: number;
  entryFeeSol: number;
  maxPlayers: number;
}

export function getRpcUrl(): string {
  return RPC_URL;
}

export function getProgramId(): string {
  return PROGRAM_ID;
}

export function isSolanaConfigured(): boolean {
  return Boolean(HOUSE_PUBKEY);
}

/**
 * Lazily import @solana/web3.js so non-paying solo players never download
 * the wallet/RPC packages.
 */
async function loadWeb3() {
  // @ts-ignore -- optional dep, declared in package.json but lazy-loaded
  const mod = await import("@solana/web3.js" as any).catch(() => null);
  return mod;
}

/**
 * Build + sign + send a SystemProgram::transfer to a fixed lobby PDA stub.
 *
 * v1 (now): straight SystemProgram transfer to the house pubkey, no PDA, no
 * Anchor — just proves the wallet integration works end-to-end on devnet.
 *
 * v2: replace with Anchor program deposit_entry CPI.
 */
export async function payEntryFee(
  walletPubkey: string,
  entryFeeSol: number,
): Promise<{ signature: string } | { error: string }> {
  const web3 = await loadWeb3();
  if (!web3) return { error: "@solana/web3.js not bundled — install in Phase 3" };

  const { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } = web3;
  const conn = new Connection(RPC_URL, "confirmed");

  const fromPk = new PublicKey(walletPubkey);
  const toPk = HOUSE_PUBKEY ? new PublicKey(HOUSE_PUBKEY) : fromPk; // self-transfer if unset
  const lamports = Math.floor(entryFeeSol * LAMPORTS_PER_SOL);

  const { blockhash } = await conn.getLatestBlockhash();

  const tx = new Transaction({ feePayer: fromPk, recentBlockhash: blockhash });
  tx.add(SystemProgram.transfer({ fromPubkey: fromPk, toPubkey: toPk, lamports }));

  // Phantom wallet adapter signs + sends
  const wallet = (window as any).solana;
  if (!wallet?.signAndSendTransaction) {
    return { error: "no Phantom signer detected" };
  }

  try {
    const { signature } = await wallet.signAndSendTransaction(tx);
    await conn.confirmTransaction(signature, "confirmed");
    return { signature };
  } catch (err) {
    return { error: String(err) };
  }
}

/**
 * Returns lamport balance of `pubkey` on the configured RPC, or null on error.
 * Useful for the lobby to display "you have X SOL" so the player knows if
 * they can afford the entry.
 */
export async function getBalanceSol(pubkey: string): Promise<number | null> {
  const web3 = await loadWeb3();
  if (!web3) return null;
  try {
    const { Connection, PublicKey, LAMPORTS_PER_SOL } = web3;
    const conn = new Connection(RPC_URL, "confirmed");
    const lamports = await conn.getBalance(new PublicKey(pubkey));
    return lamports / LAMPORTS_PER_SOL;
  } catch (err) {
    console.warn("[solana] getBalance failed", err);
    return null;
  }
}
