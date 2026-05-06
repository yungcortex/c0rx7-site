import { playSfx } from "@game/systems/audio/SoundManager";
import { useMatch } from "@state/match";
import { useTournament, STANDARD_TOURNAMENT } from "@state/tournament";
import { useProfile } from "@state/profile";
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
    desc: "Tiered pink bowl with bounce pads + spike beams. Last bean standing.",
    entry: "Free Trial",
    pot: "—",
    available: true,
  },
  {
    id: "bean-race",
    title: "Bean Race",
    desc: "Obstacle course: spinning bars, swinging hammers, drop-tile gauntlet, bouncepad finish.",
    entry: "Free Trial",
    pot: "—",
    available: true,
  },
  {
    id: "jump-club",
    title: "Jump Club",
    desc: "Sweeping beam at the center. Jump it, or be knocked off. Speeds up over time.",
    entry: "Free Trial",
    pot: "—",
    available: true,
  },
  {
    id: "hex-a-gone",
    title: "Hex-A-Gone",
    desc: "Hex tiles vanish 0.35s after you step on them. Three tiers below to fall to.",
    entry: "Free Trial",
    pot: "—",
    available: true,
  },
  {
    id: "block-party",
    title: "Block Party",
    desc: "Sliding walls rush at you. Find the gap. Don't get squished.",
    entry: "Free Trial",
    pot: "—",
    available: true,
  },
  {
    id: "king-of-bell",
    title: "King of the Bell",
    desc: "Hold the central golden zone under the rotating bell. Hazard rings spin around you.",
    entry: "Free Trial",
    pot: "—",
    available: true,
  },
  {
    id: "hot-bean",
    title: "Hot Bean",
    desc: "Volcano ring with falling tiles, lava jets, and a pulsing danger pillar.",
    entry: "Free Trial",
    pot: "—",
    available: true,
  },
  {
    id: "slime-climb",
    title: "Slime Climb",
    desc: "Race up a ramp staircase. Rising green slime kills below — keep moving.",
    entry: "Free Trial",
    pot: "—",
    available: true,
  },
  {
    id: "roll-out",
    title: "Roll Out",
    desc: "5 rotating cylinders. Stay on top. Counter-rotation makes it harder.",
    entry: "Free Trial",
    pot: "—",
    available: true,
  },
  {
    id: "door-dash",
    title: "Door Dash",
    desc: "3 rows of doors. ~60% are real (pass-through), ~40% solid. Pick wrong = bounced back.",
    entry: "Free Trial",
    pot: "—",
    available: true,
  },
  {
    id: "tail-tag",
    title: "Tail Tag",
    desc: "Snatch tails from other beans. Last bean with tails standing wins.",
    entry: "Free Trial",
    pot: "—",
    available: true,
  },
];

export function LobbyScreen({ onClose, onCustomize, onEnterMatch, onShop }: Props) {
  const startTournament = useTournament((s) => s.start);
  const profile = useProfile((s) => s.profile);

  // The actual start (called after the deposit screen confirms)
  const startActualTournament = () => {
    playSfx("win");
    const playerName = profile?.username ?? "Bean";
    const playerColor = profile?.color ?? "#a3e7c4";
    startTournament(STANDARD_TOURNAMENT, playerName, playerColor);
    useMatch.getState().setVariant(STANDARD_TOURNAMENT[0]!.variant);
    onEnterMatch();
  };

  // Lobby clicks the tournament card → opens deposit screen → confirms → starts
  const onPickTournament = () => {
    playSfx("click");
    // Show deposit screen via App.tsx state — we set a flag here that the
    // parent reads. We pass through onEnterMatch which actually starts.
    const evt = new CustomEvent("bean-royale:open-deposit");
    window.dispatchEvent(evt);
  };
  // Listen for deposit-confirm event to actually launch
  if (typeof window !== "undefined" && !((window as unknown) as { _beanRoyaleListenerAttached?: boolean })._beanRoyaleListenerAttached) {
    window.addEventListener("bean-royale:start-tournament", () => startActualTournament());
    ((window as unknown) as { _beanRoyaleListenerAttached: boolean })._beanRoyaleListenerAttached = true;
  }

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
          <button
            className="lobby-mode lobby-mode-tournament"
            onClick={onPickTournament}
          >
            <span className="lobby-mode-title">★ TOURNAMENT</span>
            <span className="lobby-mode-desc">
              3 rounds, 24 beans. Brawl → Hot Bean → King of the Bell. Last bean takes the crown + the SOL pot.
            </span>
            <div className="lobby-mode-meta">
              <span>Entry: Free Trial / 0.05 SOL</span>
              <span>Rounds: 3</span>
            </div>
          </button>
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
