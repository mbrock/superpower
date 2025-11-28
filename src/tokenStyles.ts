import type { PropertiesHyphen } from "csstype";

// OKLCH color helpers
// oklch(L% C H / alpha) - L: lightness, C: chroma, H: hue (degrees)
const oklch = (l: number, c: number, h: number, a: number = 1) =>
  `oklch(${l}% ${c} ${h} / ${a})`

// Define our palette in OKLCH
// Keeping consistent lightness/chroma for harmony
export const palette = {
  // Hues: purple ~300, cyan ~195, teal ~165, orange ~70, warm ~85
  purple: (a: number) => oklch(65, 0.25, 300, a),
  cyan: (a: number) => oklch(75, 0.15, 195, a),
  teal: (a: number) => oklch(70, 0.15, 165, a),
  orange: (a: number) => oklch(70, 0.18, 55, a),
  warm: (a: number) => oklch(75, 0.08, 85, a),
  neutral: (a: number) => oklch(90, 0, 0, a),
}

export const tokenStyles: Record<string, CSS> = {
  function: {
    "background-color": palette.purple(0.15),
    padding: "0 0.25ch",
    "box-shadow": `0 0 2ch 0ch ${palette.purple(0.08)}`,
  },
  method: {
    "background-color": palette.purple(0.17),
  },
  class: {
    position: "relative",
    "&::before": {
      content: '""',
      position: "absolute",
      inset: "-0.5ch -1ch",
      "background-color": palette.cyan(0.12),
      border: `2px solid ${palette.cyan(0.17)}`,
      "border-radius": "0.5ch",
      "z-index": "-1",
    },
  },
  interface: {
    "background-color": palette.cyan(0.12),
  },
  type: {
    "background-color": palette.cyan(0.12),
  },
  enum: {
    "background-color": palette.cyan(0.12),
  },
  typeParameter: {
    "background-color": palette.cyan(0.08),
  },
  namespace: {
    "background-color": palette.teal(0.12),
  },
  parameter: {
    "background-color": palette.warm(0.08),
  },
  variable: {
    "background-color": palette.warm(0.05),
  },
  property: {
    "background-color": palette.neutral(0.04),
  },
  enumMember: {
    "background-color": palette.orange(0.12),
  },
};

export type CSS = PropertiesHyphen & { [selector: `&${string}`]: CSS}

export function cssToString(css: CSS): string {
  return Object.entries(css)
    .map(([prop, value]) => {
      if (typeof value === "string") {
        return `${prop}: ${value}`
      } else {
        // Nested block (e.g. "&::before": { ... })
        return `${prop} { ${cssToString(value)} }`
      }
    })
    .join("; ")
}
