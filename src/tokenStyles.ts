/**
 * Semantic token decoration styles — re-exports from the unified theme
 */

export {
  cssToString,
  getDecorationStyles,
  toCSS,
  palette,
} from "./linen-glow"

import { toDecorationStyles, cssToString as css } from "./linen-glow"
import type { PropertiesHyphen } from "csstype"

export type CSS = PropertiesHyphen & { [selector: `&${string}`]: CSS }

// For backwards compatibility with extension.ts
export const tokenStyles = toDecorationStyles()
