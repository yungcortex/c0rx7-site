import { useEffect, useState } from "react";
import type { GameEngine } from "@game/engine/Engine";
import { useAuth } from "@state/auth";
import { useScene } from "@state/scene";
import { useWorld } from "@state/world";
import { TitleScreen } from "@ui/screens/TitleScreen";
import { AuthScreen } from "@ui/screens/AuthScreen";
import { CharacterSelectScreen } from "@ui/screens/CharacterSelectScreen";
import { CharacterCreatorScreen } from "@ui/screens/CharacterCreatorScreen";
import { HubHud } from "@ui/hud/HubHud";

interface Props {
  engine: GameEngine;
}

export function App({ engine }: Props) {
  const { init, loading, session } = useAuth();
  const current = useScene((s) => s.current);
  const setCurrent = useScene((s) => s.setCurrent);
  const setActiveCharacter = useWorld((s) => s.setActiveCharacter);
  const [showAuth, setShowAuth] = useState(false);

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
            if (session) {
              engine.go("character-select");
            } else {
              setShowAuth(true);
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
          onBack={() => engine.go("character-select")}
          onConfirm={() => engine.go("character-select")}
        />
      )}
      {current === "hub" && <HubHud />}
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
