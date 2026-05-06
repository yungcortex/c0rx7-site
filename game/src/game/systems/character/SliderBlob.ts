/**
 * SliderBlob — packed 256-byte binary representation of a character's
 * appearance. Layout is versioned so future additions don't break old saves.
 *
 *  byte 0      version           (currently 1)
 *  byte 1      heritage          0=hjari 1=sivit 2=korr 3=vellish 4=ashen
 *  byte 2      sub-build         korr: 0=tall 1=short, vellish: 0=feline 1=lupine
 *  byte 3      reserved
 *
 *  byte 4      body_type         0..255  continuous masculine↔feminine
 *  byte 5      muscle            0..255
 *  byte 6      height            0..255  (mapped per-heritage to range)
 *  byte 7      build_weight      0..255
 *
 *  byte 8..47  face_blendshapes  40 bytes, each slider 0..255
 *  byte 48..79 body_blendshapes  32 bytes
 *
 *  byte 80     skin_palette      index into heritage skin palette
 *  byte 81     skin_undertone    0..4
 *  byte 82..84 skin_tint_hsv     fine-tune
 *  byte 85     freckles          0..255
 *  byte 86     scarring_pattern  index
 *  byte 87     scarring_intensity 0..255
 *
 *  byte 88     hair_style        index
 *  byte 89..100 hair_gradient_hsv  4 stops × 3 bytes
 *  byte 101    hair_density      0..255
 *
 *  byte 102..103 eye_iris_l_hs    h, s
 *  byte 104    eye_value_l       v
 *  byte 105    eye_pattern_l     index
 *  byte 106..107 eye_iris_r_hs    h, s
 *  byte 108    eye_value_r       v
 *  byte 109    eye_pattern_r     index
 *  byte 110    eye_glow          0..255  (Waker glow intensity)
 *
 *  byte 111    voice_set         0..7
 *  byte 112    voice_pitch       0..4
 *
 *  byte 113    backstory_quiz_1  0..3
 *  byte 114    backstory_quiz_2  0..3
 *  byte 115    backstory_quiz_3  0..3
 *  byte 116    backstory_quiz_4  0..3
 *
 *  byte 117..136  tattoo_pattern_index, tattoo_placement, tattoo_color  (4 sets × 5 bytes)
 *  byte 137..144  paint_marking_pattern × 4
 *
 *  byte 145..251  reserved for future expansion
 *  byte 252..255  crc32 of bytes 0..251 (little-endian)
 */

export const SLIDER_BLOB_VERSION = 1;
export const SLIDER_BLOB_SIZE = 256;

export const HERITAGES = ["hjari", "sivit", "korr", "vellish", "ashen"] as const;
export type Heritage = (typeof HERITAGES)[number];

export interface SliderState {
  version: number;
  heritage: Heritage;
  subBuild: number;

  bodyType: number;
  muscle: number;
  height: number;
  buildWeight: number;

  faceBlendshapes: Uint8Array;   // length 40
  bodyBlendshapes: Uint8Array;   // length 32

  skin: {
    paletteIndex: number;
    undertone: number;
    hueShift: number;
    saturationShift: number;
    valueShift: number;
    freckles: number;
    scarringPattern: number;
    scarringIntensity: number;
  };

  hair: {
    style: number;
    gradient: Array<{ h: number; s: number; v: number }>; // 4 stops
    density: number;
  };

  eyes: {
    leftHsv: { h: number; s: number; v: number };
    leftPattern: number;
    rightHsv: { h: number; s: number; v: number };
    rightPattern: number;
    glow: number;
  };

  voice: {
    set: number;
    pitch: number;
  };

  backstory: [number, number, number, number];

  tattoos: Array<{ pattern: number; placement: number; r: number; g: number; b: number }>;
  paintMarkings: number[];
}

export function makeDefaultSliderState(heritage: Heritage = "hjari"): SliderState {
  return {
    version: SLIDER_BLOB_VERSION,
    heritage,
    subBuild: 0,
    bodyType: 128,
    muscle: 96,
    height: 128,
    buildWeight: 128,
    faceBlendshapes: new Uint8Array(40).fill(128),
    bodyBlendshapes: new Uint8Array(32).fill(128),
    skin: {
      paletteIndex: 12,
      undertone: 2,
      hueShift: 128,
      saturationShift: 128,
      valueShift: 128,
      freckles: 0,
      scarringPattern: 0,
      scarringIntensity: 0,
    },
    hair: {
      style: 1,
      gradient: [
        { h: 30, s: 80, v: 32 },
        { h: 30, s: 75, v: 48 },
        { h: 30, s: 70, v: 64 },
        { h: 30, s: 65, v: 80 },
      ],
      density: 192,
    },
    eyes: {
      leftHsv: { h: 30, s: 180, v: 200 },
      leftPattern: 0,
      rightHsv: { h: 30, s: 180, v: 200 },
      rightPattern: 0,
      glow: 64,
    },
    voice: { set: 0, pitch: 2 },
    backstory: [0, 0, 0, 0],
    tattoos: [],
    paintMarkings: [],
  };
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function packSliderState(s: SliderState): Uint8Array {
  const buf = new Uint8Array(SLIDER_BLOB_SIZE);
  const dv = new DataView(buf.buffer);

  buf[0] = SLIDER_BLOB_VERSION;
  buf[1] = HERITAGES.indexOf(s.heritage);
  buf[2] = s.subBuild & 0xff;
  buf[3] = 0;

  buf[4] = s.bodyType;
  buf[5] = s.muscle;
  buf[6] = s.height;
  buf[7] = s.buildWeight;

  buf.set(s.faceBlendshapes.subarray(0, 40), 8);
  buf.set(s.bodyBlendshapes.subarray(0, 32), 48);

  buf[80] = s.skin.paletteIndex;
  buf[81] = s.skin.undertone;
  buf[82] = s.skin.hueShift;
  buf[83] = s.skin.saturationShift;
  buf[84] = s.skin.valueShift;
  buf[85] = s.skin.freckles;
  buf[86] = s.skin.scarringPattern;
  buf[87] = s.skin.scarringIntensity;

  buf[88] = s.hair.style;
  for (let i = 0; i < 4; i++) {
    const stop = s.hair.gradient[i] ?? { h: 0, s: 0, v: 0 };
    buf[89 + i * 3] = stop.h & 0xff;
    buf[90 + i * 3] = stop.s & 0xff;
    buf[91 + i * 3] = stop.v & 0xff;
  }
  buf[101] = s.hair.density;

  buf[102] = s.eyes.leftHsv.h;
  buf[103] = s.eyes.leftHsv.s;
  buf[104] = s.eyes.leftHsv.v;
  buf[105] = s.eyes.leftPattern;
  buf[106] = s.eyes.rightHsv.h;
  buf[107] = s.eyes.rightHsv.s;
  buf[108] = s.eyes.rightHsv.v;
  buf[109] = s.eyes.rightPattern;
  buf[110] = s.eyes.glow;

  buf[111] = s.voice.set;
  buf[112] = s.voice.pitch;

  buf[113] = s.backstory[0];
  buf[114] = s.backstory[1];
  buf[115] = s.backstory[2];
  buf[116] = s.backstory[3];

  for (let i = 0; i < 4; i++) {
    const t = s.tattoos[i];
    const off = 117 + i * 5;
    if (t) {
      buf[off] = t.pattern;
      buf[off + 1] = t.placement;
      buf[off + 2] = t.r;
      buf[off + 3] = t.g;
      buf[off + 4] = t.b;
    }
  }
  for (let i = 0; i < 4; i++) buf[137 + i] = s.paintMarkings[i] ?? 0;

  const crc = crc32(buf.subarray(0, 252));
  dv.setUint32(252, crc, true);
  return buf;
}

export function unpackSliderState(buf: Uint8Array): SliderState {
  if (buf.length !== SLIDER_BLOB_SIZE) throw new Error(`bad blob size: ${buf.length}`);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const expectedCrc = dv.getUint32(252, true);
  const actualCrc = crc32(buf.subarray(0, 252));
  if (expectedCrc !== actualCrc) throw new Error("slider blob crc mismatch");

  const version = buf[0]!;
  if (version !== SLIDER_BLOB_VERSION) throw new Error(`unsupported blob version ${version}`);

  const heritageIdx = buf[1]!;
  const heritage = HERITAGES[heritageIdx] ?? "hjari";

  return {
    version,
    heritage,
    subBuild: buf[2]!,
    bodyType: buf[4]!,
    muscle: buf[5]!,
    height: buf[6]!,
    buildWeight: buf[7]!,
    faceBlendshapes: new Uint8Array(buf.subarray(8, 48)),
    bodyBlendshapes: new Uint8Array(buf.subarray(48, 80)),
    skin: {
      paletteIndex: buf[80]!,
      undertone: buf[81]!,
      hueShift: buf[82]!,
      saturationShift: buf[83]!,
      valueShift: buf[84]!,
      freckles: buf[85]!,
      scarringPattern: buf[86]!,
      scarringIntensity: buf[87]!,
    },
    hair: {
      style: buf[88]!,
      gradient: Array.from({ length: 4 }, (_, i) => ({
        h: buf[89 + i * 3]!,
        s: buf[90 + i * 3]!,
        v: buf[91 + i * 3]!,
      })),
      density: buf[101]!,
    },
    eyes: {
      leftHsv: { h: buf[102]!, s: buf[103]!, v: buf[104]! },
      leftPattern: buf[105]!,
      rightHsv: { h: buf[106]!, s: buf[107]!, v: buf[108]! },
      rightPattern: buf[109]!,
      glow: buf[110]!,
    },
    voice: { set: buf[111]!, pitch: buf[112]! },
    backstory: [buf[113]!, buf[114]!, buf[115]!, buf[116]!],
    tattoos: Array.from({ length: 4 }, (_, i) => {
      const off = 117 + i * 5;
      return {
        pattern: buf[off]!,
        placement: buf[off + 1]!,
        r: buf[off + 2]!,
        g: buf[off + 3]!,
        b: buf[off + 4]!,
      };
    }).filter((t) => t.pattern !== 0),
    paintMarkings: Array.from({ length: 4 }, (_, i) => buf[137 + i]!).filter((p) => p !== 0),
  };
}

export function blobToBase64(blob: Uint8Array): string {
  let s = "";
  for (let i = 0; i < blob.length; i++) s += String.fromCharCode(blob[i]!);
  return btoa(s);
}

export function base64ToBlob(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
