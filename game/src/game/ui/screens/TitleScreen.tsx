import { useEffect, useState } from "react";
import { WalletPill } from "@ui/components/WalletPill";

interface Props {
  onPressStart: () => void;
}

export function TitleScreen({ onPressStart }: Props) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 700);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") onPressStart();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onPressStart]);

  return (
    <div className={`title-screen ${revealed ? "is-revealed" : ""}`}>
      <div className="title-corner">
        <WalletPill />
      </div>
      <div className="title-mark">
        <h1 className="title-logo">BEAN ROYALE</h1>
        <p className="title-tagline">Bonk for glory. Win the pot. Buy hats.</p>
      </div>
      <button className="press-start" onClick={onPressStart}>
        <span>PRESS START</span>
      </button>
      <div className="title-foot">
        <span>v0.1.0 — bean alpha</span>
        <span>·</span>
        <span>c0r7x.com</span>
      </div>
    </div>
  );
}
