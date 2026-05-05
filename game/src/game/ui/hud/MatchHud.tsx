import { useEffect, useState } from "react";
import { useMatch } from "@state/match";

export function MatchHud({ onExit }: { onExit: () => void }) {
  const phase = useMatch((s) => s.phase);
  const beansAlive = useMatch((s) => s.beansAlive);
  const totalBeans = useMatch((s) => s.totalBeans);
  const bonks = useMatch((s) => s.bonks);
  const startedAt = useMatch((s) => s.startedAt);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (phase !== "playing") return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [phase]);

  const elapsed = phase === "playing" ? Math.floor((now - startedAt) / 1000) : 0;
  const mins = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const secs = (elapsed % 60).toString().padStart(2, "0");

  return (
    <>
      {/* Top HUD bar */}
      <div className="match-hud-top">
        <div className="match-stat">
          <span className="match-stat-label">Beans Alive</span>
          <span className="match-stat-value">
            {beansAlive} <span className="match-stat-sub">/ {totalBeans}</span>
          </span>
        </div>
        <div className="match-stat">
          <span className="match-stat-label">Bonks</span>
          <span className="match-stat-value">{bonks}</span>
        </div>
        <div className="match-stat">
          <span className="match-stat-label">Time</span>
          <span className="match-stat-value">{mins}:{secs}</span>
        </div>
        <button className="match-exit-btn" onClick={onExit}>
          ← exit
        </button>
      </div>

      {/* Controls hint (bottom-center) */}
      <div className="match-controls-hint">
        <span><kbd>WASD</kbd> move</span>
        <span><kbd>R</kbd> run</span>
        <span><kbd>SPACE</kbd> jump</span>
        <span className="hot"><kbd>T</kbd> tackle</span>
        <span><kbd>1-4</kbd> emote</span>
      </div>

      {/* End screens */}
      {phase === "won" && (
        <div className="match-end-overlay">
          <div className="match-end-card">
            <h2 className="match-end-title win">VICTORY ROYALE</h2>
            <p className="match-end-sub">Last bean standing. The pot is yours.</p>
            <div className="match-end-stats">
              <div><span>{bonks}</span> bonks</div>
              <div><span>{mins}:{secs}</span> match time</div>
            </div>
            <button className="primary-btn" onClick={onExit}>
              back to lobby
            </button>
          </div>
        </div>
      )}
      {phase === "lost" && (
        <div className="match-end-overlay">
          <div className="match-end-card">
            <h2 className="match-end-title lose">BEAN DOWN</h2>
            <p className="match-end-sub">You fell. Dust thyself off and re-enter.</p>
            <div className="match-end-stats">
              <div><span>{bonks}</span> bonks</div>
              <div><span>{mins}:{secs}</span> survived</div>
            </div>
            <button className="primary-btn" onClick={onExit}>
              back to lobby
            </button>
          </div>
        </div>
      )}
    </>
  );
}
