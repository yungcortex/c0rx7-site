import { playSfx } from "@game/systems/audio/SoundManager";
import { useMatch } from "@state/match";
import type { ArenaVariantId } from "@game/scenes/arena-bonk/arenaVariants";

interface Props {
  onClose: () => void;
  onCustomize: () => void;
  onEnterMatch: () => void;
  onShop: () => void;
}

interface ModeCard {
  id: ArenaVariantId;
  title: string;
  desc: string;
  entry: string;
  pot: string;
  available: boolean;
}

const MODES: ModeCard[] = [
  {
    id: "bonk-island",
    title: "Bonk Brawl",
    desc: "Last bean standing on the floating island. Bonk all 5 dummies.",
    entry: "Free Trial",
    pot: "—",
    available: true,
  },
  {
    id: "bean-race",
    title: "Bean Race",
    desc: "Linear platform path. Reach the goal bell at the end.",
    entry: "Free Trial",
    pot: "—",
    available: true,
  },
  {
    id: "king-of-bell",
    title: "King of the Bell",
    desc: "Hold the central golden zone under the floating bell.",
    entry: "Free Trial",
    pot: "—",
    available: true,
  },
  {
    id: "hot-bean",
    title: "Hot Bean",
    desc: "Ring arena with a pulsating danger pillar. Don't get cornered.",
    entry: "Free Trial",
    pot: "—",
    available: true,
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
              onClick={m.available ? () => {
                playSfx("click");
                useMatch.getState().setVariant(m.id);
                onEnterMatch();
              } : undefined}
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
            All four solo modes are playable against AI. Multiplayer + real SOL pots land in Phase 2-3.
          </p>
        </footer>
      </div>
    </div>
  );
}
