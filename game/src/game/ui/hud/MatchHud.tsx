import { useEffect, useRef, useState } from "react";
import { useMatch } from "@state/match";
import { useTournament } from "@state/tournament";
import { playSfx } from "@game/systems/audio/SoundManager";
import type { ArenaVariantId } from "@game/scenes/arena-bonk/arenaVariants";

const ARENA_TITLES: Record<ArenaVariantId, { name: string; tag: string }> = {
  "bonk-island": { name: "Bonk Brawl", tag: "Last Bean Standing" },
  "bean-race": { name: "Bean Race", tag: "First Across the Finish" },
  "king-of-bell": { name: "King of the Bell", tag: "Hold the Golden Zone" },
  "hot-bean": { name: "Hot Bean", tag: "Survive the Volcano" },
  "jump-club": { name: "Jump Club", tag: "Hop the Sweeping Beam" },
  "hex-a-gone": { name: "Hex-A-Gone", tag: "Tiles Vanish, Don't Fall" },
  "block-party": { name: "Block Party", tag: "Find the Gap" },
  "slime-climb": { name: "Slime Climb", tag: "Race the Rising Slime" },
  "roll-out": { name: "Roll Out", tag: "Stay on the Cylinders" },
  "door-dash": { name: "Door Dash", tag: "Pick the Real Doors" },
  "tail-tag": { name: "Tail Tag", tag: "Snatch the Tails" },
};

export function MatchHud({ onExit }: { onExit: () => void }) {
  const phase = useMatch((s) => s.phase);
  const variant = useMatch((s) => s.variant);
  const beansAlive = useMatch((s) => s.beansAlive);
  const totalBeans = useMatch((s) => s.totalBeans);
  const bonks = useMatch((s) => s.bonks);
  const startedAt = useMatch((s) => s.startedAt);
  const playableAt = useMatch((s) => s.playableAt);
  const endedAt = useMatch((s) => s.endedAt);
  const invulnerableUntil = useMatch((s) => s.invulnerableUntil);
  const tournamentActive = useTournament((s) => s.active);
  const tournamentRoundIdx = useTournament((s) => s.roundIdx);
  const tournamentRounds = useTournament((s) => s.rounds);
  const [now, setNow] = useState(Date.now());
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (phase !== "playing" && phase !== "countdown") return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [phase]);

  // Elapsed time tracks from countdown-end to match-end (frozen) or now.
  const referenceTime =
    phase === "won" || phase === "lost"
      ? endedAt
      : phase === "playing"
      ? now
      : playableAt;
  const elapsedMs = Math.max(0, referenceTime - playableAt);
  const elapsed = Math.floor(elapsedMs / 1000);
  const mins = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const secs = (elapsed % 60).toString().padStart(2, "0");

  // Countdown number (3, 2, 1, GO)
  const countdownMs = playableAt - now;
  const countdownLabel =
    phase === "countdown" || countdownMs > 0
      ? countdownMs > 2500
        ? "3"
        : countdownMs > 1500
        ? "2"
        : countdownMs > 500
        ? "1"
        : "GO!"
      : null;

  // Play countdown beep when label changes (3 → 2 → 1 → GO!)
  const lastBeep = useRef<string | null>(null);
  useEffect(() => {
    if (countdownLabel && countdownLabel !== lastBeep.current) {
      lastBeep.current = countdownLabel;
      if (countdownLabel === "GO!") playSfx("go");
      else playSfx("countdown");
    }
    if (!countdownLabel) lastBeep.current = null;
  }, [countdownLabel]);

  // Round-start splash (1.7s) — fades in, holds, fades out
  useEffect(() => {
    setShowSplash(true);
    const id = window.setTimeout(() => setShowSplash(false), 1700);
    return () => window.clearTimeout(id);
  }, [variant]);

  const arenaInfo = ARENA_TITLES[variant];
  const roundLabel = tournamentActive
    ? `Round ${tournamentRoundIdx + 1} / ${tournamentRounds.length}`
    : "Free Match";

  const invulnRemaining = Math.max(0, (invulnerableUntil - now) / 1000);
  void startedAt;

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

      {/* Controls hint (bottom-center) — bigger, friendlier UX */}
      <div className="match-controls-hint">
        <span><kbd>WASD</kbd> move</span>
        <span><kbd>SHIFT</kbd> or <kbd>R</kbd> run</span>
        <span><kbd>SPACE</kbd> jump</span>
        <span className="hot"><kbd>T</kbd> or <kbd>F</kbd> tackle</span>
        <span><kbd>1-4</kbd> emote</span>
      </div>

      {/* Round-start splash */}
      {showSplash && arenaInfo && (
        <div className="match-splash">
          <div className="match-splash-tag">{roundLabel}</div>
          <div className="match-splash-name">{arenaInfo.name}</div>
          <div className="match-splash-sub">{arenaInfo.tag}</div>
        </div>
      )}

      {/* Countdown overlay */}
      {countdownLabel && (
        <div className="match-countdown">
          <span className={countdownLabel === "GO!" ? "go" : ""}>{countdownLabel}</span>
        </div>
      )}

      {/* Invulnerability indicator */}
      {phase === "playing" && invulnRemaining > 0 && (
        <div className="match-invuln">
          <span className="match-invuln-icon">✦</span>
          <span>SHIELD {invulnRemaining.toFixed(1)}s</span>
        </div>
      )}

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
