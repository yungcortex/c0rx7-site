import { useState, type FormEvent } from "react";
import { signInWithMagicLink, isSupabaseReady } from "@net/supabase";

interface Props {
  onClose: () => void;
  onAuthed: () => void;
}

export function AuthScreen({ onClose, onAuthed }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;
    if (!isSupabaseReady()) {
      setErrMsg("Auth offline. Continuing as guest — saves disabled.");
      setStatus("error");
      setTimeout(onAuthed, 800);
      return;
    }
    setStatus("sending");
    const { error } = await signInWithMagicLink(email);
    if (error) {
      setStatus("error");
      setErrMsg(error);
    } else {
      setStatus("sent");
    }
  };

  return (
    <div className="modal-shroud" onClick={onClose}>
      <div className="auth-card" onClick={(e) => e.stopPropagation()}>
        <h2>Wake Cycle</h2>
        <p className="auth-sub">Sign the soulbind. We'll mail you a link.</p>

        {status === "sent" ? (
          <div className="auth-success">
            <p>Check your inbox. Tap the link to enter Hyrr.</p>
            <button className="ghost-btn" onClick={onClose}>
              close
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@somewhere.com"
              autoFocus
              required
            />
            <button type="submit" disabled={status === "sending"}>
              {status === "sending" ? "binding…" : "send link"}
            </button>
            {errMsg && <p className="auth-error">{errMsg}</p>}
            <button type="button" className="ghost-btn" onClick={onAuthed}>
              continue as guest
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
