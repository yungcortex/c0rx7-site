import { useState, type ChangeEvent } from "react";
import { useCreator } from "@state/character";
import {
  HERITAGES,
  type Heritage,
} from "@game/systems/character/SliderBlob";
import { getCreatorContext, type LightPreset } from "@game/scenes/character-creator/CharacterCreatorScene";

interface Props {
  onBack: () => void;
  onConfirm: () => void;
}

type Tab = "heritage" | "face" | "body" | "skin" | "hair" | "eyes" | "voice" | "backstory";

const TABS: { id: Tab; label: string }[] = [
  { id: "heritage", label: "Heritage" },
  { id: "face", label: "Face" },
  { id: "body", label: "Body" },
  { id: "skin", label: "Skin" },
  { id: "hair", label: "Hair" },
  { id: "eyes", label: "Eyes" },
  { id: "voice", label: "Voice" },
  { id: "backstory", label: "Backstory" },
];

const HERITAGE_LABEL: Record<Heritage, string> = {
  hjari: "Hjari · The Carried",
  sivit: "Sivit · The Long Listeners",
  korr: "Korr · The Stone-Heavy",
  vellish: "Vellish · The Walked-In",
  ashen: "Ashen · The Half-Lit",
};

const HERITAGE_BLURB: Record<Heritage, string> = {
  hjari: "Humanlike. The heart of the city. Memorial stones. Three-part names.",
  sivit: "Tall, slender, long-eared. Watchful. Court archivists and Choir clergy.",
  korr: "Short or tall, broad and dense. Stoneworkers, brewmasters, midwives. The Cycles cannot move them.",
  vellish: "Beastfolk — feline or lupine. Walked in from the Nightlands. Watch frontline. Quiet Hand sympathizers.",
  ashen: "Half-undead Wakers. Eyes that won't stop glowing. (Locked at launch.)",
};

const VOICE_SETS = [
  "Warm-low",
  "Sharp-high",
  "Soft-mid",
  "Rough-low",
  "Bright-mid",
  "Dry-low",
  "Husky-mid",
  "Clipped-high",
];

const BACKSTORY_QUESTIONS = [
  {
    q: "What is your earliest memory?",
    options: [
      "A working hand on a tool",
      "A song sung in a quiet room",
      "Running between districts on errands",
      "Walking in alone from the dark",
    ],
  },
  {
    q: "Who were you, before you Woke?",
    options: ["Apprentice", "Witness", "Inheritor", "Outsider"],
  },
  {
    q: "What do you fear?",
    options: [
      "Being forgotten",
      "Forgetting someone",
      "Standing still",
      "Being seen",
    ],
  },
  {
    q: "What calls you?",
    options: [
      "An edge that wants swinging",
      "A song that wants finishing",
      "An oath that wants keeping",
      "A door that wants opening",
    ],
  },
];

export function CharacterCreatorScreen({ onBack, onConfirm }: Props) {
  const [tab, setTab] = useState<Tab>("heritage");
  const [light, setLight] = useState<LightPreset>("town");
  const sliders = useCreator((s) => s.sliders);
  const name = useCreator((s) => s.name);
  const setName = useCreator((s) => s.setName);
  const setHeritage = useCreator((s) => s.setHeritage);
  const setSubBuild = useCreator((s) => s.setSubBuild);
  const setSliderState = useCreator((s) => s.set);
  const setFaceSlider = useCreator((s) => s.setFaceSlider);
  const setBodySlider = useCreator((s) => s.setBodySlider);
  const reset = useCreator((s) => s.reset);

  const setLightPreset = (preset: LightPreset) => {
    setLight(preset);
    getCreatorContext()?.setLightPreset(preset);
  };

  return (
    <div className="creator-screen">
      <header className="creator-head">
        <button className="ghost-btn" onClick={onBack}>
          ← back
        </button>
        <h2>Wake a Waker</h2>
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
              <h3>Heritage</h3>
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

              {(sliders.heritage === "korr" || sliders.heritage === "vellish") && (
                <div className="sub-build">
                  <label>Sub-build</label>
                  <div className="sub-build-row">
                    <button
                      className={`pill ${sliders.subBuild === 0 ? "is-active" : ""}`}
                      onClick={() => setSubBuild(0)}
                    >
                      {sliders.heritage === "korr" ? "Tall" : "Feline"}
                    </button>
                    <button
                      className={`pill ${sliders.subBuild === 1 ? "is-active" : ""}`}
                      onClick={() => setSubBuild(1)}
                    >
                      {sliders.heritage === "korr" ? "Short" : "Lupine"}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === "body" && (
            <section>
              <h3>Body</h3>
              <Slider
                label="Height"
                value={sliders.height}
                onChange={(v) => setSliderState((s) => (s.height = v))}
              />
              <Slider
                label="Build"
                value={sliders.buildWeight}
                onChange={(v) => setSliderState((s) => (s.buildWeight = v))}
              />
              <Slider
                label="Muscle"
                value={sliders.muscle}
                onChange={(v) => setSliderState((s) => (s.muscle = v))}
              />
              <Slider
                label="Body type (masc ↔ fem)"
                value={sliders.bodyType}
                onChange={(v) => setSliderState((s) => (s.bodyType = v))}
              />
              <h4>Body blendshapes</h4>
              {Array.from({ length: 8 }, (_, i) => (
                <Slider
                  key={i}
                  label={BODY_LABELS[i] ?? `Body ${i}`}
                  value={sliders.bodyBlendshapes[i] ?? 128}
                  onChange={(v) => setBodySlider(i, v)}
                />
              ))}
            </section>
          )}

          {tab === "face" && (
            <section>
              <h3>Face</h3>
              {Array.from({ length: 12 }, (_, i) => (
                <Slider
                  key={i}
                  label={FACE_LABELS[i] ?? `Face ${i}`}
                  value={sliders.faceBlendshapes[i] ?? 128}
                  onChange={(v) => setFaceSlider(i, v)}
                />
              ))}
            </section>
          )}

          {tab === "skin" && (
            <section>
              <h3>Skin</h3>
              <PaletteRow
                count={20}
                value={sliders.skin.paletteIndex}
                onChange={(v) => setSliderState((s) => (s.skin.paletteIndex = v))}
              />
              <Slider
                label="Undertone"
                value={sliders.skin.undertone * 64}
                onChange={(v) =>
                  setSliderState((s) => (s.skin.undertone = Math.round(v / 64)))
                }
                max={255}
              />
              <Slider
                label="Freckles"
                value={sliders.skin.freckles}
                onChange={(v) => setSliderState((s) => (s.skin.freckles = v))}
              />
              <Slider
                label="Scarring intensity"
                value={sliders.skin.scarringIntensity}
                onChange={(v) => setSliderState((s) => (s.skin.scarringIntensity = v))}
              />
            </section>
          )}

          {tab === "hair" && (
            <section>
              <h3>Hair</h3>
              <Slider
                label="Style index"
                value={sliders.hair.style * 8}
                onChange={(v) => setSliderState((s) => (s.hair.style = Math.round(v / 8)))}
              />
              <Slider
                label="Density"
                value={sliders.hair.density}
                onChange={(v) => setSliderState((s) => (s.hair.density = v))}
              />
              <Slider
                label="Hue (primary)"
                value={sliders.hair.gradient[0]?.h ?? 30}
                onChange={(v) =>
                  setSliderState((s) => {
                    s.hair.gradient[0]!.h = v;
                  })
                }
              />
              <Slider
                label="Saturation (primary)"
                value={sliders.hair.gradient[0]?.s ?? 80}
                onChange={(v) =>
                  setSliderState((s) => {
                    s.hair.gradient[0]!.s = v;
                  })
                }
              />
              <Slider
                label="Value (primary)"
                value={sliders.hair.gradient[0]?.v ?? 32}
                onChange={(v) =>
                  setSliderState((s) => {
                    s.hair.gradient[0]!.v = v;
                  })
                }
              />
            </section>
          )}

          {tab === "eyes" && (
            <section>
              <h3>Eyes</h3>
              <Slider
                label="Hue (left)"
                value={sliders.eyes.leftHsv.h}
                onChange={(v) => setSliderState((s) => (s.eyes.leftHsv.h = v))}
              />
              <Slider
                label="Saturation (left)"
                value={sliders.eyes.leftHsv.s}
                onChange={(v) => setSliderState((s) => (s.eyes.leftHsv.s = v))}
              />
              <Slider
                label="Value (left)"
                value={sliders.eyes.leftHsv.v}
                onChange={(v) => setSliderState((s) => (s.eyes.leftHsv.v = v))}
              />
              <button
                className="pill"
                style={{ marginTop: 12 }}
                onClick={() =>
                  setSliderState((s) => {
                    s.eyes.rightHsv = { ...s.eyes.leftHsv };
                  })
                }
              >
                match right to left
              </button>
              <h4 style={{ marginTop: 18 }}>Right eye (heterochromia)</h4>
              <Slider
                label="Hue (right)"
                value={sliders.eyes.rightHsv.h}
                onChange={(v) => setSliderState((s) => (s.eyes.rightHsv.h = v))}
              />
              <Slider
                label="Saturation (right)"
                value={sliders.eyes.rightHsv.s}
                onChange={(v) => setSliderState((s) => (s.eyes.rightHsv.s = v))}
              />
              <Slider
                label="Value (right)"
                value={sliders.eyes.rightHsv.v}
                onChange={(v) => setSliderState((s) => (s.eyes.rightHsv.v = v))}
              />
              <Slider
                label="Waker glow"
                value={sliders.eyes.glow}
                onChange={(v) => setSliderState((s) => (s.eyes.glow = v))}
              />
            </section>
          )}

          {tab === "voice" && (
            <section>
              <h3>Voice</h3>
              <div className="voice-grid">
                {VOICE_SETS.map((v, i) => (
                  <button
                    key={v}
                    className={`voice-card ${sliders.voice.set === i ? "is-active" : ""}`}
                    onClick={() => setSliderState((s) => (s.voice.set = i))}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <Slider
                label="Pitch"
                value={sliders.voice.pitch * 64}
                onChange={(v) =>
                  setSliderState((s) => (s.voice.pitch = Math.round(v / 64)))
                }
              />
              <p className="hint">Voice sample preview lands in Phase 1.5 (audio asset pipeline).</p>
            </section>
          )}

          {tab === "backstory" && (
            <section>
              <h3>Backstory</h3>
              {BACKSTORY_QUESTIONS.map((q, i) => (
                <div key={i} className="backstory-question">
                  <p className="backstory-q">{q.q}</p>
                  <div className="backstory-row">
                    {q.options.map((opt, j) => (
                      <button
                        key={j}
                        className={`backstory-opt ${sliders.backstory[i] === j ? "is-active" : ""}`}
                        onClick={() =>
                          setSliderState((s) => {
                            s.backstory[i] = j;
                          })
                        }
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>

        <footer className="creator-footer">
          <input
            type="text"
            className="name-input"
            placeholder="name your Waker"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            maxLength={24}
          />
          <button className="ghost-btn" onClick={reset}>
            randomize
          </button>
          <button
            className="primary-btn"
            disabled={name.trim().length < 2}
            onClick={onConfirm}
          >
            bind aspect
          </button>
        </footer>
      </aside>
    </div>
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

const FACE_LABELS = [
  "Brow height",
  "Brow tilt",
  "Eye spacing",
  "Eye tilt",
  "Eye size",
  "Nose bridge",
  "Nose length",
  "Nose tip",
  "Cheekbone height",
  "Cheek depth",
  "Jaw width",
  "Chin shape",
  "Mouth size",
  "Lip volume (upper)",
  "Lip volume (lower)",
  "Mouth corner tilt",
];

const BODY_LABELS = [
  "Shoulder width",
  "Neck length",
  "Torso length",
  "Arm thickness",
  "Hand size",
  "Hip width",
  "Leg length",
  "Calf shape",
];
