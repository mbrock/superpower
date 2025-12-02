/**
 * Generate theme JSON files from the TypeScript definitions
 */

import { generateThemeJSON } from "../src/linen-glow"
import { writeFileSync } from "fs"

const themes = [
  { mode: "dark" as const, file: "linen-glow-color-theme.json" },
  { mode: "light" as const, file: "linen-glow-light-color-theme.json" },
]

async function main() {
  for (const { mode, file } of themes) {
    const theme = await generateThemeJSON(mode)
    const path = `themes/${file}`
    writeFileSync(path, JSON.stringify(theme, null, 2) + "\n")
    console.log(`✓ ${path}`)
  }
}

main()
