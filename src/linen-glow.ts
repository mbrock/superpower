/**
 * Linen Glow — unified theme definition
 *
 * Colors are defined by hue alone; lightness and chroma come from profiles.
 * Both dark and light themes are derived from the same definitions.
 */

import { formatHex, formatHex8, oklch as culoriOklch, clampChroma } from "culori"
import type { PropertiesHyphen } from "csstype"
import type { ITokenColorRule } from "./superpower/vscode-renderer"

// ─────────────────────────────────────────────────────────────────────────────
// Color system
// ─────────────────────────────────────────────────────────────────────────────

export interface OKLCH {
  l: number // lightness 0-100
  c: number // chroma 0-0.4
  h: number // hue 0-360
}

const oklch = (l: number, c: number, h: number): OKLCH => ({ l, c, h })

const toCulori = (color: OKLCH, alpha = 1) =>
  culoriOklch({ l: color.l / 100, c: color.c, h: color.h, alpha })

export const toCSS = (color: OKLCH, alpha = 1): string =>
  `oklch(${color.l}% ${color.c} ${color.h}${alpha < 1 ? ` / ${alpha}` : ""})`

export const toHex = (color: OKLCH, alpha = 1): string => {
  const clamped = clampChroma(toCulori(color, alpha), "oklch")
  return alpha < 1 ? formatHex8(clamped) : formatHex(clamped)
}

// ─────────────────────────────────────────────────────────────────────────────
// Hues — the soul of each color
// ─────────────────────────────────────────────────────────────────────────────

export const hue = {
  gray:    0,
  gold:    85,
  orange:  55,
  coral:   25,
  green:   150,
  cyan:    195,
  aqua:    175,
  blue:    250,
  sky:     235,
  purple:  300,
  magenta: 320,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Profiles — L/C for different roles
// ─────────────────────────────────────────────────────────────────────────────

interface Profile { l: number; c: number }

interface ModeProfiles {
  fg: Profile
  accent: Profile
  soft: Profile
  muted: Profile
  tint: Profile
  bg: Profile
}

export const profiles: Record<Mode, ModeProfiles> = {
  dark: {
    fg:     { l: 97, c: 0.02 },
    accent: { l: 80, c: 0.18 },
    soft:   { l: 75, c: 0.12 },
    muted:  { l: 65, c: 0.00 },
    tint:   { l: 30, c: 0.08 },
    bg:     { l: 0,  c: 0.00 },
  },
  light: {
    fg:     { l: 25, c: 0.02 },
    accent: { l: 58, c: 0.6 },   // vibrant!
    soft:   { l: 52, c: 0.20 },   // also punchy
    muted:  { l: 50, c: 0.00 },
    tint:   { l: 96, c: 0.5 },   // very light pastel tints
    bg:     { l: 99, c: 0.005 },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Palette generation
// ─────────────────────────────────────────────────────────────────────────────

export type Mode = "dark" | "light"

const color = (h: number, p: Profile): OKLCH => oklch(p.l, p.c, h)

export interface Palette {
  fg: OKLCH
  bg: OKLCH
  gold: OKLCH
  orange: OKLCH
  coral: OKLCH
  green: OKLCH
  cyan: OKLCH
  aqua: OKLCH
  blue: OKLCH
  sky: OKLCH
  purple: OKLCH
  magenta: OKLCH
  gray: { soft: OKLCH; muted: OKLCH }
  tint: { gold: OKLCH; green: OKLCH; purple: OKLCH; warm: OKLCH }
}

function makePalette(mode: Mode): Palette {
  const p = profiles[mode]
  return {
    fg: color(hue.gray, p.fg),
    bg: color(hue.gray, p.bg),
    gold:    color(hue.gold, p.accent),
    orange:  color(hue.orange, p.accent),
    coral:   color(hue.coral, p.accent),
    green:   color(hue.green, p.accent),
    cyan:    color(hue.cyan, p.accent),
    aqua:    color(hue.aqua, p.accent),
    blue:    color(hue.blue, p.accent),
    sky:     color(hue.sky, p.soft),
    purple:  color(hue.purple, p.accent),
    magenta: color(hue.magenta, p.accent),
    gray: {
      soft:  color(hue.gray, p.soft),
      muted: color(hue.gray, p.muted),
    },
    tint: {
      gold:   color(hue.gold, p.tint),
      green:  color(hue.aqua, p.tint),
      purple: color(hue.purple, p.tint),
      warm:   color(hue.gold, { l: p.tint.l, c: p.tint.c * 0.5 }),
    },
  }
}

export const palette = {
  dark: makePalette("dark"),
  light: makePalette("light"),
}

// ─────────────────────────────────────────────────────────────────────────────
// Style types & helpers
// ─────────────────────────────────────────────────────────────────────────────

type FontStyle = "bold" | "italic" | "bold italic" | "underline"

export interface Style {
  fg: OKLCH
  style?: FontStyle
  bg?: { color: OKLCH; alpha: number }
}

const fg = (color: OKLCH): Style => ({ fg: color })
const bold = (color: OKLCH): Style => ({ fg: color, style: "bold" })
const tint = (fg: OKLCH, bg: OKLCH, alpha = 0.15): Style => ({ fg, bg: { color: bg, alpha } })

// ─────────────────────────────────────────────────────────────────────────────
// Style definitions — parameterized by palette
// ─────────────────────────────────────────────────────────────────────────────

export type StyleName =
  | "comment" | "docComment" | "keyword" | "function" | "functionDecl"
  | "string" | "interpolation" | "number" | "constant"
  | "variable" | "specialVar" | "type" | "interface" | "property"
  | "operator" | "punctuation" | "tag" | "attribute"
  | "regex" | "escape" | "invalid" | "decorator"

function makeStyles(p: Palette): Record<StyleName, Style> {
  return {
    comment:       bold(p.gold),
    docComment:    bold(p.orange),
    keyword:       tint(p.green, p.tint.green, 0.4),
    function:      tint(p.blue, p.tint.purple, 0.25),
    functionDecl:  { ...tint(p.blue, p.tint.purple, 0.3), style: "bold" },
    string:        fg(p.cyan),
    interpolation: fg(p.aqua),
    number:        fg(p.coral),
    constant:      tint(p.orange, p.tint.warm, 0.15),
    variable:      tint(p.fg, p.tint.warm, 0.08),
    specialVar:    fg(p.magenta),
    type:          tint(p.sky, p.tint.green, 0.15),
    interface:     tint(p.aqua, p.tint.green, 0.12),
    property:      tint(p.gray.soft, p.tint.warm, 0.05),
    operator:      fg(p.gray.muted),
    punctuation:   fg(p.gray.muted),
    tag:           fg(p.green),
    attribute:     fg(p.gold),
    regex:         fg(p.purple),
    escape:        fg(p.magenta),
    invalid:       tint(p.coral, p.coral, 0.2),
    decorator:     fg(p.gold),
  }
}

export const styles = {
  dark: makeStyles(palette.dark),
  light: makeStyles(palette.light),
}

// ─────────────────────────────────────────────────────────────────────────────
// Scope mappings (shared between modes)
// ─────────────────────────────────────────────────────────────────────────────

export const textmateScopes: Record<StyleName, string[]> = {
  comment: ["comment", "punctuation.definition.comment"],
  docComment: [
    "comment.block.documentation", "comment.block.javadoc",
    "comment.block.documentation punctuation",
    "storage.type.class.jsdoc", "entity.name.type.instance.jsdoc",
  ],
  keyword: [
    "keyword", "keyword.control", "keyword.operator.new",
    "keyword.operator.expression", "keyword.operator.logical",
    "keyword.operator.delete", "keyword.operator.typeof",
    "keyword.operator.instanceof", "storage.type", "storage.modifier",
  ],
  function: [
    "entity.name.function", "support.function",
    "meta.function-call", "variable.function",
  ],
  functionDecl: [
    "meta.definition.function entity.name.function",
    "meta.function entity.name.function",
  ],
  string: ["string", "string.quoted", "string.template"],
  interpolation: [
    "string.interpolated", "punctuation.definition.template-expression",
    "punctuation.section.embedded",
  ],
  number: [
    "constant.numeric", "constant.numeric.integer",
    "constant.numeric.float", "constant.numeric.hex",
  ],
  constant: [
    "constant", "constant.language", "constant.character",
    "variable.other.constant",
  ],
  variable: ["variable", "variable.other", "variable.parameter"],
  specialVar: [
    "variable.language.this", "variable.language.self",
    "variable.language.super",
  ],
  type: [
    "entity.name.type", "entity.name.class", "entity.name.namespace",
    "entity.name.module", "support.type", "support.class",
  ],
  interface: ["entity.name.type.interface", "entity.name.type.parameter"],
  property: [
    "variable.other.property", "variable.other.object.property",
    "support.variable.property",
  ],
  operator: ["keyword.operator", "punctuation.accessor"],
  punctuation: [
    "punctuation", "punctuation.definition", "punctuation.separator",
    "punctuation.terminator", "meta.brace",
  ],
  tag: ["entity.name.tag", "punctuation.definition.tag"],
  attribute: ["entity.other.attribute-name"],
  regex: ["string.regexp"],
  escape: ["constant.character.escape"],
  invalid: ["invalid", "invalid.illegal"],
  decorator: ["meta.decorator", "meta.annotation", "storage.type.annotation"],
}

export const semanticTokens: Partial<Record<StyleName, string[]>> = {
  function:     ["function", "method"],
  functionDecl: ["function.declaration", "method.declaration"],
  constant:     ["variable.readonly", "property.readonly", "enumMember"],
  variable:     ["variable", "parameter"],
  type:         ["type", "class", "namespace", "enum"],
  interface:    ["interface", "typeParameter"],
  property:     ["property"],
}

// ─────────────────────────────────────────────────────────────────────────────
// Compilation
// ─────────────────────────────────────────────────────────────────────────────

type CSS = PropertiesHyphen & { [selector: `&${string}`]: CSS }

const styleNames: Record<StyleName, string> = {
  comment: "Comments", docComment: "Documentation comments",
  keyword: "Keywords", function: "Functions", functionDecl: "Function definitions",
  string: "Strings", interpolation: "String interpolation",
  number: "Numbers", constant: "Constants",
  variable: "Variables", specialVar: "Special variables",
  type: "Types and classes", interface: "Interfaces", property: "Properties",
  operator: "Operators", punctuation: "Punctuation",
  tag: "Tags", attribute: "Attributes",
  regex: "Regex", escape: "Escape characters",
  invalid: "Invalid", decorator: "Decorators",
}

export function toTokenColors(mode: Mode = "dark"): ITokenColorRule[] {
  const modeStyles = styles[mode]
  return (Object.keys(modeStyles) as StyleName[])
    .filter((name) => textmateScopes[name]?.length > 0)
    .map((name) => {
      const style = modeStyles[name]
      return {
        name: styleNames[name],
        scope: textmateScopes[name],
        settings: {
          foreground: toHex(style.fg),
          fontStyle: style.style,
          ...(style.bg && { background: toHex(style.bg.color, style.bg.alpha) }),
        },
      }
    })
}

export function toSemanticTokenColors(mode: Mode = "dark"): Record<string, { foreground: string; bold?: boolean; italic?: boolean }> {
  const modeStyles = styles[mode]
  const result: Record<string, any> = {}
  for (const [styleName, tokens] of Object.entries(semanticTokens)) {
    const style = modeStyles[styleName as StyleName]
    for (const token of tokens!) {
      result[token] = {
        foreground: toHex(style.fg),
        ...(style.style?.includes("bold") && { bold: true }),
        ...(style.style?.includes("italic") && { italic: true }),
      }
    }
  }
  return result
}

export function toDecorationStyles(mode: Mode = "dark"): Record<string, CSS> {
  const modeStyles = styles[mode]
  const result: Record<string, CSS> = {}
  for (const [styleName, tokens] of Object.entries(semanticTokens)) {
    const style = modeStyles[styleName as StyleName]
    for (const token of tokens!) {
      const css: CSS = {}
      if (style.bg) css["background-color"] = toCSS(style.bg.color, style.bg.alpha)
      if (Object.keys(css).length > 0) result[token] = css
    }
  }
  return result
}

export function cssToString(css: CSS): string {
  return Object.entries(css)
    .map(([prop, value]) =>
      typeof value === "string" ? `${prop}: ${value}` : `${prop} { ${cssToString(value as CSS)} }`
    )
    .join("; ")
}

// ─────────────────────────────────────────────────────────────────────────────
// Full theme JSON generation
// ─────────────────────────────────────────────────────────────────────────────

export interface ThemeJSON {
  name: string
  type: "dark" | "light"
  colors: Record<string, string>
  tokenColors: ITokenColorRule[]
  semanticHighlighting: boolean
  semanticTokenColors: Record<string, any>
}

export function generateThemeJSON(mode: Mode): ThemeJSON {
  const p = palette[mode]

  // UI colors
  const colors: Record<string, string> = {
    "editor.background": toHex(p.bg),
    "editor.foreground": toHex(p.fg),
    "editorCursor.foreground": toHex(p.fg),
    "editorLineNumber.foreground": toHex(p.gray.muted),
    "editorLineNumber.activeForeground": toHex(p.gray.soft),
    "editor.selectionBackground": toHex(p.tint.purple, 0.4),
    "editor.wordHighlightBackground": toHex(p.tint.purple, 0.25),
    "editor.findMatchBackground": toHex(p.gold, 0.4),
    "editor.findMatchHighlightBackground": toHex(p.gold, 0.2),
    "editorBracketMatch.background": toHex(p.green, 0.2),
    "editorBracketMatch.border": toHex(p.green),
    "focusBorder": toHex(p.gold, 0.5),
    "foreground": toHex(p.fg),
    "errorForeground": toHex(p.coral),
    "editorError.foreground": toHex(p.coral),
    "editorWarning.foreground": toHex(p.gold),
    "editorInfo.foreground": toHex(p.blue),
    "gitDecoration.modifiedResourceForeground": toHex(p.gold),
    "gitDecoration.deletedResourceForeground": toHex(p.coral),
    "gitDecoration.untrackedResourceForeground": toHex(p.green),
    "gitDecoration.conflictingResourceForeground": toHex(p.magenta),
    "terminal.foreground": toHex(p.fg),
    "terminal.background": toHex(p.bg),
    "terminal.ansiRed": toHex(p.coral),
    "terminal.ansiGreen": toHex(p.green),
    "terminal.ansiYellow": toHex(p.gold),
    "terminal.ansiBlue": toHex(p.blue),
    "terminal.ansiMagenta": toHex(p.magenta),
    "terminal.ansiCyan": toHex(p.cyan),
  }

  // Add mode-specific UI colors
  if (mode === "dark") {
    Object.assign(colors, {
      "activityBar.background": toHex(oklch(8, 0, 0)),
      "sideBar.background": toHex(oklch(5, 0, 0)),
      "statusBar.background": toHex(oklch(20, 0, 0)),
      "titleBar.activeBackground": toHex(oklch(10, 0, 0)),
      "tab.activeBackground": toHex(p.bg),
      "tab.inactiveBackground": toHex(oklch(8, 0, 0)),
      "panel.background": toHex(oklch(5, 0, 0)),
      "input.background": toHex(oklch(10, 0, 0)),
      "dropdown.background": toHex(oklch(10, 0, 0)),
      "list.activeSelectionBackground": toHex(p.tint.purple, 0.5),
      "list.hoverBackground": toHex(oklch(15, 0, 0)),
      "button.background": toHex(p.gold),
      "button.foreground": toHex(oklch(0, 0, 0)),
    })
  } else {
    Object.assign(colors, {
      "activityBar.background": toHex(oklch(95, 0.01, 0)),
      "sideBar.background": toHex(oklch(97, 0.01, 0)),
      "statusBar.background": toHex(oklch(90, 0.01, 0)),
      "titleBar.activeBackground": toHex(oklch(95, 0.01, 0)),
      "tab.activeBackground": toHex(p.bg),
      "tab.inactiveBackground": toHex(oklch(95, 0.01, 0)),
      "panel.background": toHex(oklch(97, 0.01, 0)),
      "input.background": toHex(oklch(100, 0, 0)),
      "dropdown.background": toHex(oklch(100, 0, 0)),
      "list.activeSelectionBackground": toHex(p.tint.purple, 0.3),
      "list.hoverBackground": toHex(oklch(95, 0.01, 0)),
      "button.background": toHex(p.gold),
      "button.foreground": toHex(oklch(100, 0, 0)),
    })
  }

  return {
    name: mode === "dark" ? "Linen Glow" : "Linen Glow Light",
    type: mode,
    colors,
    tokenColors: toTokenColors(mode),
    semanticHighlighting: true,
    semanticTokenColors: toSemanticTokenColors(mode),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports for extension
// ─────────────────────────────────────────────────────────────────────────────

export function getTokenColorRules(mode: Mode = "dark"): ITokenColorRule[] {
  return toTokenColors(mode)
}

export function getDecorationStyles(mode: Mode = "dark"): Map<string, string> {
  const s = toDecorationStyles(mode)
  return new Map(Object.entries(s).map(([k, v]) => [k, cssToString(v)]))
}
