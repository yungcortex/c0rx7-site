import { useTournament } from "@state/tournament";
import { useEconomy } from "@state/economy";
import { explorerUrl } from "@net/solanaClient";
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
  const economy = useEconomy((s) => s.entry);
  const isPaidTournament = economy && economy.potSol > 0;
  const winnerPayout = economy ? economy.potSol * 0.92 : 0;

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
              <>
                <h3 className="bracket-win">CROWN ROYALE — YOU WIN</h3>
                {isPaidTournament && (
                  <p className="bracket-payout">
                    + {winnerPayout.toFixed(3)} SOL paid to your wallet
                  </p>
                )}
              </>
            ) : (
              <>
                <h3 className="bracket-lose">CROWN GOES TO ANOTHER BEAN</h3>
                {isPaidTournament && (
                  <p className="bracket-payout">
                    your {economy?.feeSol} SOL deposit went to the winner's pot
                  </p>
                )}
              </>
            )
          ) : (
            <h3 className={playerQualified ? "bracket-win" : "bracket-lose"}>
              {playerQualified ? "QUALIFIED ✓" : "ELIMINATED ✗"}
            </h3>
          )}
          {economy?.depositSig && (
            <p className="hint" style={{ marginTop: 8 }}>
              <a
                href={explorerUrl(economy.depositSig)}
                target="_blank"
                rel="noreferrer"
                className="tx-link"
              >
                view deposit on explorer ↗
              </a>
            </p>
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
