import { playSfx } from "@game/systems/audio/SoundManager";

interface Props {
  onClose: () => void;
  onCustomize: () => void;
  onEnterMatch: () => void;
  onShop: () => void;
}

const MODES = [
  {
    id: "bonk-brawl",
    title: "Bonk Brawl",
    desc: "Last bean standing. 6-bot solo for now.",
    entry: "Free Trial",
    pot: "—",
    available: true,
  },
  {
    id: "bean-race",
    title: "Bean Race",
    desc: "Obstacle course. First to the bell wins.",
    entry: "0.05 SOL",
    pot: "0.45 SOL",
    available: false,
  },
  {
    id: "king-of-bell",
    title: "King of the Bell",
    desc: "Hold the central area for cumulative time.",
    entry: "0.05 SOL",
    pot: "0.40 SOL",
    available: false,
  },
  {
    id: "aspect-trial",
    title: "Aspect Trial",
    desc: "Solo PvE story. No entry fee. Free cosmetics.",
    entry: "Free",
    pot: "Cosmetics",
    available: false,
  },
];

export function LobbyScreen({ onClose, onCustomize, onEnterMatch, onShop }: Props) {
  return (
    <div className="lobby-screen">
      <div className="lobby-card">
        <header className="lobby-head">
          <button className="ghost-btn" onClick={() => { playSfx("click"); onClose(); }}>← back</button>
          <h2>BEAN LOBBY</h2>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="ghost-btn" onClick={() => { playSfx("click"); onShop(); }}>shop</button>
            <button className="ghost-btn" onClick={() => { playSfx("click"); onCustomize(); }}>customize</button>
          </div>
        </header>

        <div className="lobby-modes">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`lobby-mode ${m.available ? "" : "is-locked"}`}
              disabled={!m.available}
              onClick={m.available ? () => { playSfx("click"); onEnterMatch(); } : undefined}
            >
              <span className="lobby-mode-title">{m.title}</span>
              <span className="lobby-mode-desc">{m.desc}</span>
              <div className="lobby-mode-meta">
                <span>Entry: {m.entry}</span>
                <span>Pot: {m.pot}</span>
              </div>
              {!m.available && <span className="lobby-mode-locked">coming soon</span>}
            </button>
          ))}
        </div>

        <footer className="lobby-foot">
          <p className="hint">
            Solo bonk-brawl with 5 AI dummies is live. Multiplayer + real SOL pots land in Phase 2-3.
          </p>
        </footer>
      </div>
    </div>
  );
}
