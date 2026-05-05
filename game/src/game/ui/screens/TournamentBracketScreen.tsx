import { useTournament } from "@state/tournament";
import { playSfx } from "@game/systems/audio/SoundManager";

interface Props {
  onContinue: () => void;
  onAbort: () => void;
}

export function TournamentBracketScreen({ onContinue, onAbort }: Props) {
  const rounds = useTournament((s) => s.rounds);
  const roundIdx = useTournament((s) => s.roundIdx);
  const qualified = useTournament((s) => s.qualified);
  const eliminated = useTournament((s) => s.eliminated);
  const ack = useTournament((s) => s.acknowledgeRoundResult);

  const round = rounds[roundIdx];
  const playerQualified = qualified.some((b) => b.isPlayer);
  const isFinalDone = roundIdx + 1 >= rounds.length || qualified.length <= 1;

  return (
    <div className="bracket-screen">
      <div className="bracket-card">
        <header className="bracket-head">
          <div className="bracket-round-tag">
            ROUND {roundIdx + 1} / {rounds.length}
          </div>
          <h2>{round?.title ?? "Tournament Result"}</h2>
        </header>

        <div className="bracket-result">
          {isFinalDone ? (
            playerQualified ? (
              <h3 className="bracket-win">CROWN ROYALE — YOU WIN</h3>
            ) : (
              <h3 className="bracket-lose">CROWN GOES TO ANOTHER BEAN</h3>
            )
          ) : (
            <h3 className={playerQualified ? "bracket-win" : "bracket-lose"}>
              {playerQualified ? "QUALIFIED ✓" : "ELIMINATED ✗"}
            </h3>
          )}
        </div>

        <div className="bracket-cols">
          <div className="bracket-col">
            <h4>Qualified · {qualified.length}</h4>
            <div className="bracket-list">
              {qualified.map((b) => (
                <div
                  key={b.id}
                  className={`bracket-bean ${b.isPlayer ? "is-player" : ""}`}
                  style={{ borderLeftColor: b.color }}
                >
                  <span>{b.username}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bracket-col">
            <h4>Eliminated · {eliminated.length}</h4>
            <div className="bracket-list eliminated">
              {eliminated.slice(-12).reverse().map((b) => (
                <div
                  key={b.id}
                  className={`bracket-bean ${b.isPlayer ? "is-player" : ""}`}
                  style={{ borderLeftColor: b.color, opacity: 0.5 }}
                >
                  <span>{b.username}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className="bracket-foot">
          {isFinalDone || !playerQualified ? (
            <button
              className="primary-btn"
              onClick={() => {
                playSfx("click");
                onAbort();
              }}
            >
              back to lobby
            </button>
          ) : (
            <button
              className="primary-btn"
              onClick={() => {
                playSfx("jump");
                ack();
                onContinue();
              }}
            >
              next round →
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
