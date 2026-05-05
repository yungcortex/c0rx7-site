import { useProfile } from "@state/profile";
import { useInventory } from "@state/inventory";
import { useWallet } from "@state/wallet";
import { shortPubkey } from "@net/wallet";
import { playSfx } from "@game/systems/audio/SoundManager";

interface Props {
  onClose: () => void;
  onLogout?: () => void;
}

export function ProfileScreen({ onClose, onLogout }: Props) {
  const profile = useProfile((s) => s.profile);
  const reset = useProfile((s) => s.reset);
  const owned = useInventory((s) => s.owned);
  const wallet = useWallet((s) => s.info);

  if (!profile) return null;
  const winRate = profile.stats.matchesPlayed
    ? ((profile.stats.wins / profile.stats.matchesPlayed) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="profile-screen">
      <div className="profile-card">
        <header className="profile-head">
          <button className="ghost-btn" onClick={() => { playSfx("click"); onClose(); }}>← back</button>
          <h2>BEAN PROFILE</h2>
          <button
            className="ghost-btn"
            onClick={() => {
              playSfx("click");
              reset();
              if (onLogout) onLogout();
            }}
          >
            log out
          </button>
        </header>

        <section className="profile-hero">
          <div className="profile-hero-bean" />
          <div className="profile-hero-text">
            <h3>{profile.username}</h3>
            <span className="profile-hero-id">
              {wallet ? shortPubkey(wallet.pubkey) : "no wallet"}
            </span>
            <span className="profile-hero-since">
              joined · {new Date(profile.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="profile-coins">
            <span className="profile-coins-icon">◎</span>
            <span className="profile-coins-value">{profile.stats.beanCoins}</span>
            <span className="profile-coins-label">bean coins</span>
          </div>
        </section>

        <section className="profile-stats">
          <Stat label="Matches" value={profile.stats.matchesPlayed} />
          <Stat label="Wins" value={profile.stats.wins} />
          <Stat label="Win Rate" value={`${winRate}%`} />
          <Stat label="Total Bonks" value={profile.stats.bonks} />
          <Stat label="Items" value={owned.length} />
          <Stat label="Wallet" value={wallet ? "connected" : "—"} />
        </section>

        <section className="profile-recent">
          <h4>Recent Cosmetics</h4>
          <div className="profile-recent-grid">
            {owned
              .filter((o) => o.acquiredAt > 0)
              .sort((a, b) => b.acquiredAt - a.acquiredAt)
              .slice(0, 6)
              .map((o) => (
                <div key={`${o.slot}:${o.itemId}`} className="profile-recent-item">
                  <span className="profile-recent-slot">{o.slot}</span>
                  <span className="profile-recent-id">{o.itemId}</span>
                </div>
              ))}
            {owned.filter((o) => o.acquiredAt > 0).length === 0 && (
              <p className="hint">No items earned yet. Win a match or visit the shop.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="profile-stat">
      <span className="profile-stat-value">{value}</span>
      <span className="profile-stat-label">{label}</span>
    </div>
  );
}
