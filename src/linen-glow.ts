/**
 * Linen Glow — Thin TypeScript shell over Prolog theme definitions
 *
 * The theme logic lives in theme.pl. This module:
 * 1. Queries Prolog for theme data (OKLCH colors)
 * 2. Converts OKLCH to hex for VS Code
 * 3. Formats the result as theme JSON
 */

import { load, Prolog } from "trealla"
import { readFileSync } from "fs"
import { dirname, join } from "path"
import { formatHex, formatHex8, oklch as culoriOklch, clampChroma } from "culori"
import type { ITokenColorRule } from "./superpower/vscode-renderer"

// OKLCH to hex conversion (the one thing Prolog shouldn't do)
export interface OKLCH {
  l: number
  c: number
  h: number
  a: number
}

const toHex = (color: OKLCH): string => {
  const culori = culoriOklch({ l: color.l / 100, c: color.c, h: color.h, alpha: color.a })
  // Don't clamp - let out-of-gamut colors clip naturally
  // This matches how the browser renders oklch() in CSS
  return color.a < 1 ? formatHex8(culori) : formatHex(culori)
}

export type Mode = "dark" | "light"

// Prolog interface
let pl: Prolog | null = null

async function getProlog(): Promise<Prolog> {
  if (!pl) {
    await load()
    pl = new Prolog({ quiet: true })
    const program = readFileSync(join(dirname(__filename), "theme.pl"), "utf-8")
    await pl.consultText(program)
    await pl.queryOnce("use_module(theme).")
  }
  return pl
}

// Parse OKLCH from Prolog term: oklch(L, C, H, A)
function parseOklch(term: any): OKLCH {
  if (term?.functor === "oklch" && term.args?.length === 4) {
    return {
      l: Number(term.args[0]),
      c: Number(term.args[1]),
      h: Number(term.args[2]),
      a: Number(term.args[3]),
    }
  }
  throw new Error(`Invalid OKLCH term: ${JSON.stringify(term)}`)
}

// Query helpers
async function queryAll<T>(goal: string, transform: (answer: any) => T): Promise<T[]> {
  const prolog = await getProlog()
  const results: T[] = []
  for await (const answer of prolog.query(goal)) {
    if (answer.status === "success" && answer.answer) {
      results.push(transform(answer.answer))
    }
  }
  return results
}

// Theme JSON types
export interface ThemeJSON {
  name: string
  type: "dark" | "light"
  colors: Record<string, string>
  tokenColors: ITokenColorRule[]
  semanticHighlighting: boolean
  semanticTokenColors: Record<string, any>
}

// Main export: generate theme JSON from Prolog
export async function generateThemeJSON(mode: Mode): Promise<ThemeJSON> {
  // Query UI colors
  const uiColors: Record<string, string> = {}
  for (const { key, color } of await queryAll(
    `ui_color(${mode}, Key, Color).`,
    (a) => ({ key: a.Key.functor, color: parseOklch(a.Color) })
  )) {
    uiColors[key] = toHex(color)
  }

  // Query token styles
  const tokenColors: ITokenColorRule[] = []
  for (const { group, scopes, fg, bold } of await queryAll(
    `token_style(${mode}, Group, Scopes, FG, Bold).`,
    (a) => ({
      group: a.Group.functor,
      scopes: a.Scopes.map((s: any) => s.functor),
      fg: parseOklch(a.FG),
      bold: a.Bold.functor === "true",
    })
  )) {
    const settings: any = { foreground: toHex(fg) }
    if (bold) settings.fontStyle = "bold"
    tokenColors.push({
      name: group.replace(/_/g, " "),
      scope: scopes,
      settings,
    })
  }

  // Query semantic token colors
  const semanticTokenColors: Record<string, any> = {}
  for (const { token, fg, bold } of await queryAll(
    `semantic_color(${mode}, Token, FG, Bold).`,
    (a) => ({
      token: a.Token.functor ?? String(a.Token),
      fg: parseOklch(a.FG),
      bold: a.Bold.functor === "true",
    })
  )) {
    semanticTokenColors[token] = {
      foreground: toHex(fg),
      ...(bold && { bold: true }),
    }
  }

  return {
    name: mode === "dark" ? "Linen Glow" : "Linen Glow Light",
    type: mode,
    colors: uiColors,
    tokenColors,
    semanticHighlighting: true,
    semanticTokenColors,
  }
}

// Decoration styles for semantic highlighting extension
export async function getDecorationStyles(mode: Mode = "dark"): Promise<Map<string, string>> {
  const result = new Map<string, string>()

  for (const { token, color } of await queryAll(
    `decoration_style(${mode}, Token, Color).`,
    (a) => ({
      token: a.Token.functor ?? String(a.Token),
      color: parseOklch(a.Color),
    })
  )) {
    const { l, c, h, a } = color
    result.set(token, `background-color: oklch(${l}% ${c} ${h} / ${a})`)
  }

  return result
}

// Token color rules for extension
export async function getTokenColorRules(mode: Mode = "dark"): Promise<ITokenColorRule[]> {
  const theme = await generateThemeJSON(mode)
  return theme.tokenColors
}

// Legacy exports for compatibility
export const oklch = (l: number, c: number, h: number): OKLCH => ({ l, c, h, a: 1 })
export const toCSS = (color: OKLCH): string =>
  `oklch(${color.l}% ${color.c} ${color.h}${color.a < 1 ? ` / ${color.a}` : ""})`
export const hue = { coral: 25, orange: 55, gold: 85, green: 150, aqua: 175, cyan: 195, sky: 235, blue: 250, purple: 300, magenta: 320 }
export const alpha = { hint: 0.15, soft: 0.30, medium: 0.45, strong: 0.60 }
export const palette = { dark: { mode: "dark" as const }, light: { mode: "light" as const } }
