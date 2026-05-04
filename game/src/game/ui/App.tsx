import { useEffect, useState } from "react";
import type { GameEngine } from "@game/engine/Engine";
import { useAuth } from "@state/auth";
import { useScene } from "@state/scene";
import { TitleScreen } from "@ui/screens/TitleScreen";
import { AuthScreen } from "@ui/screens/AuthScreen";
import { CharacterSelectScreen } from "@ui/screens/CharacterSelectScreen";

interface Props {
  engine: GameEngine;
}

export function App({ engine }: Props) {
  const { init, loading, session } = useAuth();
  const current = useScene((s) => s.current);
  const setCurrent = useScene((s) => s.setCurrent);
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
        <CharacterSelectScreen onBack={() => engine.go("title")} />
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
