import { useState, type ChangeEvent } from "react";
import { useCreator, useCharacters } from "@state/character";
import { useAuth } from "@state/auth";
import { createCharacter } from "@game/systems/save/characterRepo";
import {
  HERITAGES,
  type Heritage,
} from "@game/systems/character/SliderBlob";
import {
  getCreatorContext,
  type LightPreset,
} from "@game/scenes/character-creator/CharacterCreatorScene";
import type {
  BeanEyeStyle,
  BeanMouthStyle,
  BeanPattern,
  BeanHatId,
  BeanOutfitId,
  BeanAccessoryId,
} from "@game/systems/character/Bean";

interface Props {
  onBack: () => void;
  onConfirm: () => void;
}

type Tab =
  | "heritage"
  | "body"
  | "color"
  | "eyes"
  | "mouth"
  | "pattern"
  | "hat"
  | "outfit"
  | "accessory";

const TABS: { id: Tab; label: string }[] = [
  { id: "heritage", label: "Shape" },
  { id: "body", label: "Body" },
  { id: "color", label: "Color" },
  { id: "eyes", label: "Eyes" },
  { id: "mouth", label: "Mouth" },
  { id: "pattern", label: "Pattern" },
  { id: "hat", label: "Hat" },
  { id: "outfit", label: "Outfit" },
  { id: "accessory", label: "Extra" },
];

const HERITAGE_LABEL: Record<Heritage, string> = {
  hjari: "Classic",
  sivit: "Tall + Eared",
  korr: "Wide + Round",
  vellish: "Cat + Tail",
  ashen: "Slim Ghost",
};

const HERITAGE_BLURB: Record<Heritage, string> = {
  hjari: "Standard medium bean. Friendly silhouette. The default.",
  sivit: "Tall slim bean with long bunny-elf ears. Twiggy energy.",
  korr: "Wide round ball. Deeply unbreakable. Tiny legs.",
  vellish: "Smaller bean with cat ears + curly tail. Smug by design.",
  ashen: "Slim ghostly bean. Translucent vibe. Locked at launch.",
};

const EYE_STYLES: { id: BeanEyeStyle; label: string }[] = [
  { id: "round", label: "Round" },
  { id: "sparkle", label: "Sparkle" },
  { id: "sleepy", label: "Sleepy" },
  { id: "angry", label: "Angry" },
  { id: "dead", label: "Dead X" },
  { id: "heart", label: "Heart" },
  { id: "swirl", label: "Swirl" },
];

const MOUTH_STYLES: { id: BeanMouthStyle; label: string }[] = [
  { id: "smile", label: "Smile" },
  { id: "grin", label: "Grin" },
  { id: "frown", label: "Frown" },
  { id: "gasp", label: "Gasp" },
  { id: "smug", label: "Smug" },
  { id: "tongue", label: "Tongue" },
  { id: "neutral", label: "Neutral" },
];

const PATTERNS: { id: BeanPattern; label: string }[] = [
  { id: "none", label: "None" },
  { id: "stripes", label: "Stripes" },
  { id: "dots", label: "Dots" },
  { id: "split", label: "Split" },
  { id: "gradient", label: "Gradient" },
];

const HATS: { id: BeanHatId; label: string }[] = [
  { id: "none", label: "None" },
  { id: "wizard", label: "Wizard" },
  { id: "crown", label: "Crown" },
  { id: "propeller", label: "Propeller" },
  { id: "helmet", label: "Helmet" },
  { id: "horns", label: "Horns" },
  { id: "tophat", label: "Top Hat" },
  { id: "halo", label: "Halo" },
];

const OUTFITS: { id: BeanOutfitId; label: string }[] = [
  { id: "none", label: "None" },
  { id: "cape", label: "Cape" },
  { id: "scarf", label: "Scarf" },
  { id: "armor", label: "Armor" },
  { id: "robe-trim", label: "Robe Trim" },
  { id: "bowtie", label: "Bowtie" },
];

const ACCESSORIES: { id: BeanAccessoryId; label: string }[] = [
  { id: "none", label: "None" },
  { id: "glasses", label: "Glasses" },
  { id: "monocle", label: "Monocle" },
  { id: "mustache", label: "Mustache" },
  { id: "earrings", label: "Earrings" },
];

export function CharacterCreatorScreen({ onBack, onConfirm }: Props) {
  const [tab, setTab] = useState<Tab>("heritage");
  const [light, setLight] = useState<LightPreset>("town");
  const [error, setError] = useState<string | null>(null);
  const user = useAuth((s) => s.user);
  const sliders = useCreator((s) => s.sliders);
  const cosmetic = useCreator((s) => s.cosmetic);
  const name = useCreator((s) => s.name);
  const saving = useCreator((s) => s.saving);
  const setName = useCreator((s) => s.setName);
  const setHeritage = useCreator((s) => s.setHeritage);
  const setSliderState = useCreator((s) => s.set);
  const setFaceSlider = useCreator((s) => s.setFaceSlider);
  const setBodySlider = useCreator((s) => s.setBodySlider);
  const setCosmetic = useCreator((s) => s.setCosmetic);
  const setSaving = useCreator((s) => s.setSaving);
  const reset = useCreator((s) => s.reset);
  const addCharacter = useCharacters((s) => s.add);
  const setSelected = useCharacters((s) => s.setSelected);
  const characterList = useCharacters((s) => s.list);

  const setLightPreset = (preset: LightPreset) => {
    setLight(preset);
    getCreatorContext()?.setLightPreset(preset);
  };

  const onBindBean = async () => {
    setError(null);
    if (name.trim().length < 2) {
      setError("Your bean needs a name.");
      return;
    }
    if (!user) {
      setError("Sign in to save your bean across cycles.");
      return;
    }
    setSaving(true);
    const usedSlots = new Set(characterList.map((c) => c.slot));
    let nextSlot = 1;
    while (usedSlots.has(nextSlot) && nextSlot <= 8) nextSlot++;
    if (nextSlot > 8) {
      setError("All bean slots are full. Unbind one first.");
      setSaving(false);
      return;
    }
    const created = await createCharacter({
      slot: nextSlot,
      name: name.trim(),
      heritage: sliders.heritage,
      sliders,
    });
    setSaving(false);
    if (!created) {
      setError("The city refused to remember. Save failed.");
      return;
    }
    addCharacter(created);
    setSelected(created);
    reset();
    onConfirm();
  };

  return (
    <div className="creator-screen">
      <header className="creator-head">
        <button className="ghost-btn" onClick={onBack}>
          ← back
        </button>
        <h2>Bean Forge</h2>
        <div className="light-presets">
          {(["sunset", "dungeon", "town"] as LightPreset[]).map((p) => (
            <button
              key={p}
              className={`pill ${light === p ? "is-active" : ""}`}
              onClick={() => setLightPreset(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </header>

      <aside className="creator-panel">
        <nav className="creator-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab-btn ${tab === t.id ? "is-active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="creator-content">
          {tab === "heritage" && (
            <section>
              <h3>Shape</h3>
              <div className="heritage-grid">
                {HERITAGES.filter((h) => h !== "ashen").map((h) => (
                  <button
                    key={h}
                    className={`heritage-card ${sliders.heritage === h ? "is-active" : ""}`}
                    onClick={() => setHeritage(h)}
                  >
                    <span className="heritage-name">{HERITAGE_LABEL[h]}</span>
                    <span className="heritage-blurb">{HERITAGE_BLURB[h]}</span>
                  </button>
                ))}
                <div className="heritage-card is-locked">
                  <span className="heritage-name">{HERITAGE_LABEL.ashen}</span>
                  <span className="heritage-blurb">{HERITAGE_BLURB.ashen}</span>
                </div>
              </div>
            </section>
          )}

          {tab === "body" && (
            <section>
              <h3>Body Proportions</h3>
              <Slider
                label="Width"
                value={sliders.buildWeight}
                onChange={(v) => setSliderState((s) => (s.buildWeight = v))}
              />
              <Slider
                label="Height"
                value={sliders.height}
                onChange={(v) => setSliderState((s) => (s.height = v))}
              />
              <Slider
                label="Head size"
                value={sliders.faceBlendshapes[8] ?? 128}
                onChange={(v) =>
                  setFaceSlider(8, v)
                }
              />
              <Slider
                label="Eye size"
                value={sliders.faceBlendshapes[4] ?? 128}
                onChange={(v) => setFaceSlider(4, v)}
              />
              <Slider
                label="Eye spacing"
                value={sliders.faceBlendshapes[2] ?? 128}
                onChange={(v) => setFaceSlider(2, v)}
              />
              <Slider
                label="Hand size"
                value={sliders.bodyBlendshapes[3] ?? 128}
                onChange={(v) => setBodySlider(3, v)}
              />
              <Slider
                label="Foot size"
                value={sliders.bodyBlendshapes[7] ?? 128}
                onChange={(v) => setBodySlider(7, v)}
              />
              <Slider
                label="Outline thickness"
                value={sliders.muscle}
                onChange={(v) => setSliderState((s) => (s.muscle = v))}
              />
              <p className="hint">
                Drag any slider — your bean updates live.
              </p>
            </section>
          )}

          {tab === "color" && (
            <section>
              <h3>Body Color</h3>
              <PaletteRow
                count={20}
                value={sliders.skin.paletteIndex}
                onChange={(v) => setSliderState((s) => (s.skin.paletteIndex = v))}
              />
              <p className="hint">Click a swatch to change your bean's body colour.</p>
              <h4 style={{ marginTop: "1.4rem" }}>Accent Color (hands / ears / tail)</h4>
              <Slider
                label="Hue"
                value={sliders.hair.gradient[0]?.h ?? 30}
                onChange={(v) =>
                  setSliderState((s) => {
                    s.hair.gradient[0]!.h = v;
                  })
                }
              />
              <Slider
                label="Saturation"
                value={sliders.hair.gradient[0]?.s ?? 80}
                onChange={(v) =>
                  setSliderState((s) => {
                    s.hair.gradient[0]!.s = v;
                  })
                }
              />
              <Slider
                label="Value"
                value={sliders.hair.gradient[0]?.v ?? 32}
                onChange={(v) =>
                  setSliderState((s) => {
                    s.hair.gradient[0]!.v = v;
                  })
                }
              />
              <p className="hint">Tints the bean's hands, ears, and tail — and feet when a pattern is active.</p>
            </section>
          )}

          {tab === "eyes" && (
            <section>
              <h3>Eye Style</h3>
              <div className="cosmetic-grid">
                {EYE_STYLES.map((o) => (
                  <button
                    key={o.id}
                    className={`cosmetic-card ${cosmetic.eyeStyle === o.id ? "is-active" : ""}`}
                    onClick={() => setCosmetic((c) => (c.eyeStyle = o.id))}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <h4 style={{ marginTop: "1.4rem" }}>Eye Color</h4>
              <Slider
                label="Hue"
                value={sliders.eyes.leftHsv.h}
                onChange={(v) => setSliderState((s) => {
                  s.eyes.leftHsv.h = v;
                  s.eyes.rightHsv.h = v;
                })}
              />
              <Slider
                label="Saturation"
                value={sliders.eyes.leftHsv.s}
                onChange={(v) => setSliderState((s) => {
                  s.eyes.leftHsv.s = v;
                  s.eyes.rightHsv.s = v;
                })}
              />
              <Slider
                label="Brightness"
                value={sliders.eyes.leftHsv.v}
                onChange={(v) => setSliderState((s) => {
                  s.eyes.leftHsv.v = v;
                  s.eyes.rightHsv.v = v;
                })}
              />
            </section>
          )}

          {tab === "mouth" && (
            <CosmeticGrid
              title="Mouth"
              options={MOUTH_STYLES}
              value={cosmetic.mouthStyle}
              onChange={(v) => setCosmetic((c) => (c.mouthStyle = v))}
            />
          )}

          {tab === "pattern" && (
            <CosmeticGrid
              title="Body Pattern"
              options={PATTERNS}
              value={cosmetic.pattern}
              onChange={(v) => setCosmetic((c) => (c.pattern = v))}
            />
          )}

          {tab === "hat" && (
            <CosmeticGrid
              title="Hat"
              options={HATS}
              value={cosmetic.hat}
              onChange={(v) => setCosmetic((c) => (c.hat = v))}
            />
          )}

          {tab === "outfit" && (
            <CosmeticGrid
              title="Outfit"
              options={OUTFITS}
              value={cosmetic.outfit}
              onChange={(v) => setCosmetic((c) => (c.outfit = v))}
            />
          )}

          {tab === "accessory" && (
            <CosmeticGrid
              title="Extra"
              options={ACCESSORIES}
              value={cosmetic.accessory}
              onChange={(v) => setCosmetic((c) => (c.accessory = v))}
            />
          )}
        </div>

        <footer className="creator-footer">
          <input
            type="text"
            className="name-input"
            placeholder="name your bean"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            maxLength={24}
          />
          <button className="ghost-btn" onClick={reset}>
            reset
          </button>
          <button
            className="primary-btn"
            disabled={name.trim().length < 2 || saving}
            onClick={onBindBean}
          >
            {saving ? "binding…" : "bind bean"}
          </button>
        </footer>
        {error && <div className="creator-error">{error}</div>}
      </aside>
    </div>
  );
}

interface CosmeticGridProps<T extends string> {
  title: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

function CosmeticGrid<T extends string>({ title, options, value, onChange }: CosmeticGridProps<T>) {
  return (
    <section>
      <h3>{title}</h3>
      <div className="cosmetic-grid">
        {options.map((o) => (
          <button
            key={o.id}
            className={`cosmetic-card ${value === o.id ? "is-active" : ""}`}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </section>
  );
}

interface SliderProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}

function Slider({ label, value, onChange, min = 0, max = 255 }: SliderProps) {
  return (
    <label className="slider-row">
      <span className="slider-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
      />
      <span className="slider-value">{value}</span>
    </label>
  );
}

interface PaletteProps {
  count: number;
  value: number;
  onChange: (i: number) => void;
}

function PaletteRow({ count, value, onChange }: PaletteProps) {
  return (
    <div className="palette-row">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          className={`palette-swatch palette-swatch-${i} ${value === i ? "is-active" : ""}`}
          onClick={() => onChange(i)}
          aria-label={`palette ${i}`}
        />
      ))}
    </div>
  );
}
