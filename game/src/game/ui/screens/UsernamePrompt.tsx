import { useState, type FormEvent } from "react";
import { useProfile, makeNewProfile, isUsernameValid } from "@state/profile";
import { useWallet } from "@state/wallet";
import { useAuth } from "@state/auth";
import { playSfx } from "@game/systems/audio/SoundManager";

interface Props {
  onClose: () => void;
}

const SUGGESTIONS = ["BeanZilla", "TopBonk", "JellyKnight", "CrumbWizard", "SoftServe", "MeanBean"];

export function UsernamePrompt({ onClose }: Props) {
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const setProfile = useProfile((s) => s.setProfile);
  const wallet = useWallet((s) => s.info);
  const user = useAuth((s) => s.user);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!isUsernameValid(name)) {
      setErr("3-18 characters, letters / numbers / _ / - only.");
      return;
    }
    const identity = wallet?.pubkey ?? user?.id ?? `guest-${crypto.randomUUID()}`;
    setProfile(makeNewProfile(name.trim(), identity));
    playSfx("win");
    onClose();
  };

  const random = () => {
    const pick = SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)] + Math.floor(Math.random() * 99);
    setName(pick);
    playSfx("click");
  };

  return (
    <div className="modal-shroud" onClick={onClose}>
      <div className="auth-card" onClick={(e) => e.stopPropagation()}>
        <h2>Bean Up</h2>
        <p className="auth-sub">Pick a name. The crowd has to chant something when you bonk.</p>
        <form onSubmit={submit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="your bean name"
            autoFocus
            maxLength={18}
            required
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="ghost-btn" onClick={random}>
              random
            </button>
            <button type="submit" style={{ flex: 1 }}>
              create profile
            </button>
          </div>
          {err && <p className="auth-error">{err}</p>}
          <p className="hint" style={{ marginTop: "0.6rem" }}>
            Stored locally for now. Phase 2 syncs to Supabase + wallet identity.
          </p>
        </form>
      </div>
    </div>
  );
}
