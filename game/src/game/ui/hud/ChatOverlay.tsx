import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useChat } from "@state/world";
import { dispatchSlash } from "@game/systems/chat/chatBus";

const CHANNEL_COLORS: Record<string, string> = {
  say: "#d8cdb1",
  shout: "#e8c878",
  yell: "#ffb96b",
  world: "#8da9d4",
  whisper: "#c89adb",
  system: "#b7c2c2",
};

export function ChatOverlay() {
  const lines = useChat((s) => s.lines);
  const inputOpen = useChat((s) => s.inputOpen);
  const setInputOpen = useChat((s) => s.setInputOpen);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.code === "Enter") {
        if (!inputOpen) {
          setInputOpen(true);
          setTimeout(() => inputRef.current?.focus(), 30);
          e.preventDefault();
        }
      } else if (e.code === "Escape" && inputOpen) {
        setInputOpen(false);
        setDraft("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inputOpen, setInputOpen]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [lines]);

  const submit = () => {
    if (draft.trim()) dispatchSlash(draft);
    setDraft("");
    setInputOpen(false);
  };

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.code === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="chat-overlay">
      <div className="chat-list" ref={listRef}>
        {lines.slice(-30).map((l) => (
          <div key={l.id} className="chat-line">
            <span className="chat-channel" style={{ color: CHANNEL_COLORS[l.channel] }}>
              [{l.channel}]
            </span>
            {l.author && <span className="chat-author">{l.author}:</span>}
            <span className="chat-body">{l.body}</span>
          </div>
        ))}
      </div>
      {inputOpen && (
        <div className="chat-input">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onInputKey}
            onBlur={() => setInputOpen(false)}
            placeholder="/say · /shout · /world · or just type"
            maxLength={480}
          />
        </div>
      )}
    </div>
  );
}
