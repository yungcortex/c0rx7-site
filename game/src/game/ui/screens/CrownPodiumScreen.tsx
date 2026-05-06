import { useEffect } from "react";
import { useTournament } from "@state/tournament";
import { useEconomy } from "@state/economy";
import { explorerUrl } from "@net/solanaClient";
import { playSfx } from "@game/systems/audio/SoundManager";

interface Props {
  onClose: () => void;
}

/**
 * Top-of-podium moment shown after the player wins the tournament final.
 * Three colored bean silhouettes (gold/silver/bronze) on tiered podiums,
 * confetti backdrop via CSS animation, crown+pot copy.
 */
export function CrownPodiumScreen({ onClose }: Props) {
  const qualified = useTournament((s) => s.qualified);
  const eliminated = useTournament((s) => s.eliminated);
  const economy = useEconomy((s) => s.entry);
  const isPaid = economy && economy.potSol > 0;
  const winnerPayout = economy ? economy.potSol * 0.92 : 0;

  // Top 3: winner first (qualified), then 2nd & 3rd from most-recently eliminated
  const winner = qualified[0];
  const recentLosers = eliminated.slice(-2).reverse();
  const second = recentLosers[0];
  const third = recentLosers[1];

  useEffect(() => {
    playSfx("crown");
  }, []);

  if (!winner) return null;

  return (
    <div className="podium-screen">
      <div className="podium-confetti-bg" aria-hidden />
      <div className="podium-card">
        <header className="podium-head">
          <div className="podium-crown">♛</div>
          <h1 className="podium-title">CROWN ROYALE</h1>
          <p className="podium-sub">{winner.username} TAKES THE BEAN</p>
          {isPaid && (
            <p className="podium-payout">
              + {winnerPayout.toFixed(3)} SOL → your wallet
              {economy?.depositSig && (
                <a
                  href={explorerUrl(economy.depositSig)}
                  target="_blank"
                  rel="noreferrer"
                  className="tx-link"
                  style={{ marginLeft: 8 }}
                >
                  view ↗
                </a>
              )}
            </p>
          )}
        </header>

        <div className="podium-stage">
          {/* Second */}
          <div className="podium-slot podium-slot-2">
            <div className="podium-bean" style={{ background: second?.color ?? "#888" }}>
              <div className="bean-eyes">
                <span /><span />
              </div>
              <div className="bean-mouth">︶</div>
            </div>
            <div className="podium-block podium-block-2">
              <div className="podium-rank">2</div>
              <div className="podium-name">{second?.username ?? "—"}</div>
            </div>
          </div>
          {/* First (winner) */}
          <div className="podium-slot podium-slot-1">
            <div className="podium-crown-floating">♛</div>
            <div className="podium-bean podium-bean-winner" style={{ background: winner.color }}>
              <div className="bean-eyes">
                <span /><span />
              </div>
              <div className="bean-mouth">︶</div>
            </div>
            <div className="podium-block podium-block-1">
              <div className="podium-rank">1</div>
              <div className="podium-name">{winner.username}</div>
            </div>
          </div>
          {/* Third */}
          <div className="podium-slot podium-slot-3">
            <div className="podium-bean" style={{ background: third?.color ?? "#888" }}>
              <div className="bean-eyes">
                <span /><span />
              </div>
              <div className="bean-mouth">︶</div>
            </div>
            <div className="podium-block podium-block-3">
              <div className="podium-rank">3</div>
              <div className="podium-name">{third?.username ?? "—"}</div>
            </div>
          </div>
        </div>

        <footer className="podium-foot">
          <button
            className="primary-btn"
            onClick={() => {
              playSfx("click");
              onClose();
            }}
          >
            back to lobby
          </button>
        </footer>
      </div>
    </div>
  );
}
