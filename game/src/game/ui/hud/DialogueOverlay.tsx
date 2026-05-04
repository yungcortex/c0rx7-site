import { useEffect } from "react";
import { useDialogue } from "@state/world";

export function DialogueOverlay() {
  const active = useDialogue((s) => s.active);
  const index = useDialogue((s) => s.index);
  const next = useDialogue((s) => s.next);
  const close = useDialogue((s) => s.close);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter" || e.code === "KeyE") {
        e.preventDefault();
        next();
      } else if (e.code === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, next, close]);

  if (!active) return null;
  const line = active[index];
  if (!line) return null;

  return (
    <div className="dialogue-overlay">
      <div className="dialogue-card">
        <div className="dialogue-speaker">{line.speaker}</div>
        <div className="dialogue-body">{line.body}</div>
        <div className="dialogue-foot">
          <span className="dialogue-progress">
            {index + 1} / {active.length}
          </span>
          <button className="dialogue-next" onClick={next}>
            {index + 1 === active.length ? "close" : "next ▸"}
          </button>
        </div>
      </div>
    </div>
  );
}
