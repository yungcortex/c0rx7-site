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
import { HubHud } from "@ui/hud/HubHud";
import { MatchHud } from "@ui/hud/MatchHud";
import { playSfx } from "@game/systems/audio/SoundManager";

interface Props {
  engine: GameEngine;
}

export function App({ engine }: Props) {
  const { init, loading, session } = useAuth();
  const current = useScene((s) => s.current);
  const setCurrent = useScene((s) => s.setCurrent);
  const setActiveCharacter = useWorld((s) => s.setActiveCharacter);
  const [showAuth, setShowAuth] = useState(false);
  const [showLobby, setShowLobby] = useState(false);
  const [showShop, setShowShop] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    return engine.sceneManager.onChange((id) => setCurrent(id));
  }, [engine, setCurrent]);

  if (loading) return null;

  return (
    <>
      {current === "title" && (
        <TitleScreen
          onPressStart={() => {
            // For Bean Royale: skip auth gate, go straight to lobby (we want to
            // showcase the gameplay; auth is only required for SOL flows).
            if (session) {
              setShowLobby(true);
            } else {
              setShowLobby(true); // still show — saving requires auth, playing doesn't
            }
          }}
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
      {current === "arena-bonk" && (
        <MatchHud
          onExit={() => {
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
