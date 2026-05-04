import { useState } from "react";

interface Props {
  onBack: () => void;
}

interface CharacterStub {
  id: string;
  name: string;
  heritage: string;
  level: number;
  aspect: string;
}

const PLACEHOLDERS: CharacterStub[] = [
  { id: "1", name: "— empty —", heritage: "", level: 0, aspect: "" },
  { id: "2", name: "— empty —", heritage: "", level: 0, aspect: "" },
  { id: "3", name: "— empty —", heritage: "", level: 0, aspect: "" },
];

export function CharacterSelectScreen({ onBack }: Props) {
  const [selected, setSelected] = useState(0);

  return (
    <div className="select-screen">
      <header className="select-head">
        <button className="ghost-btn" onClick={onBack}>
          ← title
        </button>
        <h2>Choose Your Waker</h2>
        <div style={{ width: 80 }} />
      </header>

      <div className="select-rail">
        {PLACEHOLDERS.map((c, i) => (
          <button
            key={c.id}
            className={`slot-btn ${selected === i ? "is-active" : ""}`}
            onClick={() => setSelected(i)}
          >
            <span className="slot-num">{i + 1}</span>
            <span className="slot-name">{c.name}</span>
            {c.level > 0 && (
              <span className="slot-meta">
                {c.heritage} · {c.aspect} · lv {c.level}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="select-actions">
        <button className="primary-btn" disabled>
          enter Hyrr
        </button>
        <button className="primary-btn">
          new Waker
        </button>
      </div>
    </div>
  );
}
