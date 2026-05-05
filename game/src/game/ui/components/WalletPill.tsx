import { useEffect } from "react";
import { useWallet } from "@state/wallet";
import { shortPubkey } from "@net/wallet";

export function WalletPill() {
  const info = useWallet((s) => s.info);
  const connecting = useWallet((s) => s.connecting);
  const init = useWallet((s) => s.init);
  const connect = useWallet((s) => s.connect);
  const disconnect = useWallet((s) => s.disconnect);

  useEffect(() => {
    init();
  }, [init]);

  if (info) {
    return (
      <button
        className="wallet-pill is-connected"
        onClick={() => disconnect()}
        title="Click to disconnect"
      >
        <span className="wallet-dot" />
        <span className="wallet-label">{shortPubkey(info.pubkey)}</span>
      </button>
    );
  }

  return (
    <button
      className="wallet-pill"
      onClick={() => connect()}
      disabled={connecting}
    >
      <span className="wallet-icon">◈</span>
      <span className="wallet-label">{connecting ? "connecting…" : "connect wallet"}</span>
    </button>
  );
}
