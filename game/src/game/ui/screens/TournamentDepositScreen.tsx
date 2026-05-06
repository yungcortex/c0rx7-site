import { useEffect, useState } from "react";
import { useWallet } from "@state/wallet";
import { useEconomy, TOURNAMENT_ENTRY_FEE_SOL, TOURNAMENT_BEAN_COUNT, TOURNAMENT_TOTAL_POT_SOL, HOUSE_CUT_BPS } from "@state/economy";
import { connectWallet } from "@net/wallet";
import { payEntryFee, getBalanceSol, getNetworkLabel, explorerUrl, isSolanaConfigured } from "@net/solanaClient";
import { shortPubkey } from "@net/wallet";
import { playSfx } from "@game/systems/audio/SoundManager";

interface Props {
  onCancel: () => void;
  onConfirm: () => void;
}

type DepositPhase = "review" | "depositing" | "success" | "error" | "free";

export function TournamentDepositScreen({ onCancel, onConfirm }: Props) {
  const wallet = useWallet((s) => s.info);
  const setEntry = useEconomy((s) => s.setEntry);
  const [balance, setBalance] = useState<number | null>(null);
  const [phase, setPhase] = useState<DepositPhase>("review");
  const [error, setError] = useState<string | null>(null);
  const [sig, setSig] = useState<string | null>(null);
  const network = getNetworkLabel();
  const housePct = HOUSE_CUT_BPS / 100;
  const winnerPayoutSol = TOURNAMENT_TOTAL_POT_SOL * (1 - HOUSE_CUT_BPS / 10_000);

  useEffect(() => {
    if (!wallet) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    getBalanceSol(wallet.pubkey).then((b) => {
      if (!cancelled) setBalance(b);
    });
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  const onConnect = async () => {
    playSfx("click");
    await connectWallet();
    // The useWallet store auto-updates via init() / external connect
    setTimeout(() => {
      if ((window as any).solana?.publicKey) {
        useWallet.setState({ info: {
          pubkey: (window as any).solana.publicKey.toString(),
          walletName: "phantom",
        }});
      }
    }, 100);
  };

  const onDeposit = async () => {
    if (!wallet) return;
    if (balance !== null && balance < TOURNAMENT_ENTRY_FEE_SOL) {
      setError(`Insufficient ${network} SOL. You have ${balance.toFixed(4)} SOL, need ${TOURNAMENT_ENTRY_FEE_SOL}.`);
      setPhase("error");
      return;
    }
    setPhase("depositing");
    setError(null);
    playSfx("click");

    const result = await payEntryFee(wallet.pubkey, TOURNAMENT_ENTRY_FEE_SOL);
    if ("error" in result) {
      setError(result.error);
      setPhase("error");
      return;
    }
    setSig(result.signature);
    setEntry({
      lobbyId: `tour-${Date.now()}`,
      network,
      depositSig: result.signature,
      potSol: TOURNAMENT_TOTAL_POT_SOL,
      feeSol: TOURNAMENT_ENTRY_FEE_SOL,
      payerPubkey: wallet.pubkey,
    });
    playSfx("win");
    setPhase("success");
  };

  const playFree = () => {
    playSfx("click");
    setPhase("free");
    setEntry({
      lobbyId: `free-${Date.now()}`,
      network: "free-trial",
      depositSig: "",
      potSol: 0,
      feeSol: 0,
      payerPubkey: wallet?.pubkey ?? "guest",
    });
    setTimeout(onConfirm, 250);
  };

  return (
    <div className="deposit-screen">
      <div className="deposit-card">
        <header className="deposit-head">
          <button className="ghost-btn" onClick={() => { playSfx("click"); onCancel(); }}>← back</button>
          <h2>TOURNAMENT ENTRY</h2>
          <span className={`net-tag net-${network}`}>{network.toUpperCase()}</span>
        </header>

        {phase === "review" && (
          <>
            <section className="deposit-pot">
              <div className="pot-label">PRIZE POT</div>
              <div className="pot-value">
                {TOURNAMENT_TOTAL_POT_SOL.toFixed(2)} <span>SOL</span>
              </div>
              <div className="pot-breakdown">
                <span>winner takes {winnerPayoutSol.toFixed(3)} SOL</span>
                <span>·</span>
                <span>house cut {housePct}%</span>
              </div>
            </section>

            <section className="deposit-rows">
              <div className="deposit-row">
                <span className="deposit-row-label">Entry fee</span>
                <span className="deposit-row-value">{TOURNAMENT_ENTRY_FEE_SOL} SOL</span>
              </div>
              <div className="deposit-row">
                <span className="deposit-row-label">Players</span>
                <span className="deposit-row-value">{TOURNAMENT_BEAN_COUNT} beans</span>
              </div>
              <div className="deposit-row">
                <span className="deposit-row-label">Format</span>
                <span className="deposit-row-value">4 rounds · elimination</span>
              </div>
              <div className="deposit-row">
                <span className="deposit-row-label">Wallet</span>
                <span className="deposit-row-value">
                  {wallet ? shortPubkey(wallet.pubkey) : "not connected"}
                </span>
              </div>
              <div className="deposit-row">
                <span className="deposit-row-label">Balance</span>
                <span className="deposit-row-value">
                  {wallet ? (balance !== null ? `${balance.toFixed(4)} SOL` : "loading…") : "—"}
                </span>
              </div>
            </section>

            <section className="deposit-actions">
              {!wallet ? (
                <button className="primary-btn full" onClick={onConnect}>
                  Connect wallet to deposit
                </button>
              ) : (
                <button
                  className="primary-btn full"
                  onClick={onDeposit}
                  disabled={!isSolanaConfigured() && network !== "devnet"}
                >
                  Deposit {TOURNAMENT_ENTRY_FEE_SOL} {network} SOL & enter
                </button>
              )}
              <button className="ghost-btn full" onClick={playFree}>
                or play a free-trial tournament
              </button>
            </section>

            <p className="hint deposit-hint">
              {network === "devnet"
                ? "Devnet SOL is free test currency — get some at faucet.solana.com. No real money at risk."
                : "Real SOL flow. Audited contract required for mainnet — currently devnet only."}
            </p>
          </>
        )}

        {phase === "depositing" && (
          <section className="deposit-state">
            <div className="depositing-spinner" />
            <h3>Confirm in your wallet</h3>
            <p className="hint">Phantom should pop up asking you to approve the {TOURNAMENT_ENTRY_FEE_SOL} SOL transfer.</p>
          </section>
        )}

        {phase === "success" && (
          <section className="deposit-state">
            <div className="check-icon">✓</div>
            <h3 className="bracket-win">DEPOSIT CONFIRMED</h3>
            <p className="hint">
              Tx: {sig && (
                <a href={explorerUrl(sig)} target="_blank" rel="noreferrer" className="tx-link">
                  {sig.slice(0, 8)}…{sig.slice(-8)} ↗
                </a>
              )}
            </p>
            <button className="primary-btn full" onClick={() => { playSfx("jump"); onConfirm(); }}>
              start tournament →
            </button>
          </section>
        )}

        {phase === "error" && (
          <section className="deposit-state">
            <div className="cross-icon">✗</div>
            <h3 className="bracket-lose">DEPOSIT FAILED</h3>
            <p className="hint">{error}</p>
            <button className="ghost-btn full" onClick={() => setPhase("review")}>
              try again
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
