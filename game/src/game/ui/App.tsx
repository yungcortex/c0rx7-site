import { useEffect, useState } from "react";
import type { GameEngine } from "@game/engine/Engine";
import { useAuth } from "@state/auth";
import { useScene } from "@state/scene";
import { useWorld } from "@state/world";
import { TitleScreen } from "@ui/screens/TitleScreen";
import { AuthScreen } from "@ui/screens/AuthScreen";
import { CharacterSelectScreen } from "@ui/screens/CharacterSelectScreen";
import { CharacterCreatorScreen } from "@ui/screens/CharacterCreatorScreen";
import { LobbyScreen } from "@ui/screens/LobbyScreen";
import { ShopScreen } from "@ui/screens/ShopScreen";
import { ProfileScreen } from "@ui/screens/ProfileScreen";
import { UsernamePrompt } from "@ui/screens/UsernamePrompt";
import { TournamentBracketScreen } from "@ui/screens/TournamentBracketScreen";
import { useProfile } from "@state/profile";
import { useTournament } from "@state/tournament";
import { useMatch } from "@state/match";
import { HubHud } from "@ui/hud/HubHud";
import { MatchHud } from "@ui/hud/MatchHud";
import { playSfx } from "@game/systems/audio/SoundManager";
import { music } from "@game/systems/audio/MusicManager";

interface Props {
  engine: GameEngine;
}

export function App({ engine }: Props) {
  const { init, loading } = useAuth();
  const current = useScene((s) => s.current);
  const setCurrent = useScene((s) => s.setCurrent);
  const setActiveCharacter = useWorld((s) => s.setActiveCharacter);
  const [showAuth, setShowAuth] = useState(false);
  const [showLobby, setShowLobby] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showUsername, setShowUsername] = useState(false);
  const profile = useProfile((s) => s.profile);
  const tournamentActive = useTournament((s) => s.active);
  const tournamentShowResult = useTournament((s) => s.showRoundResult);
  const tournamentRounds = useTournament((s) => s.rounds);
  const tournamentRoundIdx = useTournament((s) => s.roundIdx);
  const abortTournament = useTournament((s) => s.abort);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    return engine.sceneManager.onChange((id) => setCurrent(id));
  }, [engine, setCurrent]);

  // Music routing — fade between loops as scenes change
  useEffect(() => {
    if (current === "title") music.play(showLobby ? "lobby" : "title");
    else if (current === "character-creator" || current === "character-select") music.play("lobby");
    else if (current === "arena-bonk") music.play("match");
    else if (current === "hub") music.play("lobby");
  }, [current, showLobby]);

  if (loading) return null;

  return (
    <>
      {current === "title" && (
        <TitleScreen
          onPressStart={() => {
            if (!profile) {
              setShowUsername(true);
            } else {
              setShowLobby(true);
            }
          }}
          onProfile={profile ? () => setShowProfile(true) : undefined}
        />
      )}
      {current === "character-select" && (
        <CharacterSelectScreen
          onBack={() => engine.go("title")}
          onNew={() => engine.go("character-creator")}
          onEnter={(c) => {
            setActiveCharacter(c);
            engine.go("hub");
          }}
        />
      )}
      {current === "character-creator" && (
        <CharacterCreatorScreen
          onBack={() => {
            setShowLobby(true);
            engine.go("title");
          }}
          onConfirm={() => {
            setShowLobby(true);
            engine.go("title");
          }}
        />
      )}
      {current === "hub" && <HubHud />}
      {current === "arena-bonk" && !tournamentShowResult && (
        <MatchHud
          onExit={() => {
            if (tournamentActive) {
              // record fake result + advance via bracket
              const tState = useTournament.getState();
              const playerWon = useMatch.getState().phase === "won";
              // Simple: random qualifyCount survivors including player iff won
              const qList = tState.beans
                .filter((b) => b.isPlayer ? playerWon : Math.random() < 0.5)
                .slice(0, tournamentRounds[tournamentRoundIdx]?.qualifyCount ?? 1);
              tState.recordRoundResult(qList.map((b) => b.id));
            } else {
              engine.go("title");
              setShowLobby(true);
            }
          }}
        />
      )}
      {tournamentShowResult && (
        <TournamentBracketScreen
          onContinue={() => {
            // Set next round's variant + (re-)launch arena
            const next = tournamentRounds[tournamentRoundIdx + 1];
            if (next) {
              useMatch.getState().setVariant(next.variant);
              engine.go("arena-bonk");
            }
          }}
          onAbort={() => {
            abortTournament();
            engine.go("title");
            setShowLobby(true);
          }}
        />
      )}
      {showLobby && current === "title" && !showShop && (
        <LobbyScreen
          onClose={() => setShowLobby(false)}
          onCustomize={() => {
            setShowLobby(false);
            engine.go("character-creator");
          }}
          onEnterMatch={() => {
            playSfx("jump");
            setShowLobby(false);
            engine.go("arena-bonk");
          }}
          onShop={() => setShowShop(true)}
        />
      )}
      {showShop && (
        <ShopScreen onClose={() => setShowShop(false)} />
      )}
      {showProfile && (
        <ProfileScreen
          onClose={() => setShowProfile(false)}
          onLogout={() => setShowProfile(false)}
        />
      )}
      {showUsername && (
        <UsernamePrompt
          onClose={() => {
            setShowUsername(false);
            setShowLobby(true);
          }}
        />
      )}
      {showAuth && (
        <AuthScreen
          onClose={() => setShowAuth(false)}
          onAuthed={() => {
            setShowAuth(false);
            engine.go("character-select");
          }}
        />
      )}
    </>
  );
}
