import { useState } from "react";
import {
  useInventory,
  SHOP_CATALOG,
  RARITY_COLOR,
  type Rarity,
  type ShopItem,
} from "@state/inventory";
import { useWallet } from "@state/wallet";
import { playSfx } from "@game/systems/audio/SoundManager";

interface Props {
  onClose: () => void;
}

const TABS: { id: "hats" | "outfits" | "accessories"; label: string }[] = [
  { id: "hats", label: "Hats" },
  { id: "outfits", label: "Outfits" },
  { id: "accessories", label: "Accessories" },
];

export function ShopScreen({ onClose }: Props) {
  const [tab, setTab] = useState<"hats" | "outfits" | "accessories">("hats");
  const [confirming, setConfirming] = useState<ShopItem | null>(null);
  const owned = useInventory((s) => s.owned);
  const has = useInventory((s) => s.has);
  const unlock = useInventory((s) => s.unlock);
  const wallet = useWallet((s) => s.info);

  const slotForTab = tab === "hats" ? "hat" : tab === "outfits" ? "outfit" : "accessory";
  const items = SHOP_CATALOG.filter((i) => i.slot === slotForTab);

  const onPurchase = (item: ShopItem) => {
    // v1: mock purchase. v3 will trigger Anchor escrow purchase tx.
    playSfx("click");
    unlock(item.slot, item.itemId);
    setConfirming(null);
  };

  return (
    <div className="shop-screen">
      <div className="shop-card">
        <header className="shop-head">
          <button className="ghost-btn" onClick={() => { playSfx("click"); onClose(); }}>← back</button>
          <h2>BEAN BOUTIQUE</h2>
          <div className="shop-balance">
            {wallet ? (
              <>
                <span className="shop-balance-label">Wallet</span>
                <span className="shop-balance-value">connected</span>
              </>
            ) : (
              <>
                <span className="shop-balance-label">Wallet</span>
                <span className="shop-balance-value muted">not connected</span>
              </>
            )}
          </div>
        </header>

        <nav className="shop-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`shop-tab ${tab === t.id ? "is-active" : ""}`}
              onClick={() => { playSfx("click"); setTab(t.id); }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="shop-grid">
          {items.map((item) => {
            const isOwned = has(item.slot, item.itemId);
            return (
              <div
                key={`${item.slot}:${item.itemId}`}
                className={`shop-item rarity-${item.rarity} ${isOwned ? "is-owned" : ""}`}
              >
                <div className="shop-item-thumb">
                  <span className="shop-item-icon">{item.label[0]}</span>
                </div>
                <div className="shop-item-body">
                  <span className="shop-item-name">{item.label}</span>
                  <span
                    className="shop-item-rarity"
                    style={{ color: RARITY_COLOR[item.rarity as Rarity] }}
                  >
                    {item.rarity}
                  </span>
                </div>
                <div className="shop-item-foot">
                  {isOwned ? (
                    <span className="shop-item-owned">OWNED</span>
                  ) : (
                    <button
                      className="shop-buy-btn"
                      onClick={() => { playSfx("click"); setConfirming(item); }}
                    >
                      <span className="shop-buy-price">{item.priceSol}</span>
                      <span className="shop-buy-sol">SOL</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <footer className="shop-foot">
          <p className="hint">
            Purchases are mocked in this build. Real on-chain Anchor escrow swap arrives in Phase 3.
            Win Bonk Brawls to earn cosmetic crates for free.
          </p>
          <p className="shop-stats">{owned.length} items owned</p>
        </footer>
      </div>

      {confirming && (
        <div className="shop-confirm-shroud" onClick={() => setConfirming(null)}>
          <div className="shop-confirm-card" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Purchase</h3>
            <p>
              <strong>{confirming.label}</strong> — {confirming.rarity}
            </p>
            <p className="shop-confirm-price">
              {confirming.priceSol} <span>SOL</span>
            </p>
            <p className="hint">
              {wallet
                ? "Mock purchase — real SOL flow lands at Phase 3 audit."
                : "No wallet detected. Purchase will be free / off-chain in this build."}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                className="primary-btn"
                onClick={() => onPurchase(confirming)}
              >
                buy
              </button>
              <button className="ghost-btn" onClick={() => setConfirming(null)}>
                cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
