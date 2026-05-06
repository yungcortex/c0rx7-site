import { useEffect, useState } from "react";
import { useAuth } from "@state/auth";
import { useCharacters } from "@state/character";
import { listCharacters, deleteCharacter } from "@game/systems/save/characterRepo";
import type { Character } from "@game/systems/character/Character";

interface Props {
  onBack: () => void;
  onNew: () => void;
  onEnter: (c: Character) => void;
}

const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export function CharacterSelectScreen({ onBack, onNew, onEnter }: Props) {
  const user = useAuth((s) => s.user);
  const { list, selected, loading, setList, setSelected, setLoading, remove } = useCharacters();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    listCharacters(user.id)
      .then((cs) => setList(cs))
      .finally(() => setLoading(false));
  }, [user, setList, setLoading]);

  const slots = SLOTS.map((slot) => list.find((c) => c.slot === slot));

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
        {slots.slice(0, 4).map((c, i) => (
          <SlotCard
            key={i}
            slot={i + 1}
            character={c}
            active={selected?.id === c?.id}
            onSelect={() => c && setSelected(c)}
            onDelete={() => c && setConfirmDelete(c.id)}
            onNew={onNew}
          />
        ))}
      </div>

      {loading && <div className="select-status">Reading the registry…</div>}
      {!loading && !user && (
        <div className="select-status">Guest mode — sign in to save Wakers across cycles.</div>
      )}

      <div className="select-actions">
        <button
          className="primary-btn"
          disabled={!selected}
          onClick={() => selected && onEnter(selected)}
        >
          enter Hyrr
        </button>
        <button className="primary-btn" onClick={onNew} disabled={list.length >= 8}>
          new Waker
        </button>
      </div>

      {confirmDelete && (
        <div className="modal-shroud" onClick={() => setConfirmDelete(null)}>
          <div className="auth-card" onClick={(e) => e.stopPropagation()}>
            <h2>Unbind this Waker?</h2>
            <p className="auth-sub">Their name returns to the city's forgetting. This cannot be undone.</p>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                className="primary-btn"
                onClick={async () => {
                  const id = confirmDelete;
                  setConfirmDelete(null);
                  if (await deleteCharacter(id)) remove(id);
                }}
              >
                unbind
              </button>
              <button className="ghost-btn" onClick={() => setConfirmDelete(null)}>
                keep
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SlotProps {
  slot: number;
  character: Character | undefined;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onNew: () => void;
}

function SlotCard({ slot, character, active, onSelect, onDelete, onNew }: SlotProps) {
  if (!character) {
    return (
      <button className="slot-btn slot-empty" onClick={onNew}>
        <span className="slot-num">{slot}</span>
        <span className="slot-name">— empty —</span>
        <span className="slot-meta">tap to bind a new Waker</span>
      </button>
    );
  }
  return (
    <div
      className={`slot-btn ${active ? "is-active" : ""}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
    >
      <span className="slot-num">{slot}</span>
      <span className="slot-name">{character.name}</span>
      <span className="slot-meta">
        {character.heritage} · {character.active_aspect} · lv {character.level}
      </span>
      <button
        className="slot-delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="unbind"
      >
        ×
      </button>
    </div>
  );
}
