#!/usr/bin/env bun
/**
 * Demo of the typed CDP API
 */

import { CDP } from "./cdp"
import type { CursorRenderer } from "./cursor-renderer"

// Connect to Cursor's workbench with full typing
const cursor = await CDP.connect<CursorRenderer>((t) =>
  t.url.includes("workbench.html"),
)

console.log("Connected to:", cursor.target.title)

// `r` is fully typed as CursorRenderer
const info = await cursor.run((r) => ({
  title: r.document.title,
  windowId: r.vscode.context.configuration()?.windowId,
  platform: r.vscode.process.platform,
  electron: r.vscode.process.versions.electron,
  chrome: r.vscode.process.versions.chrome,
  editorGroups: r.document.querySelectorAll(".editor-group-container").length,
}))

console.log("\n📊 Window Info:")
console.log(info)

// Pass additional arguments after the function
await cursor.run(
  (r, msg) => r.console.log(`%c${msg}`, "color: #ff69b4; font-size: 20px"),
  "Hello from CDP! 🎉",
)

console.log("\n📝 Logged a message to the Cursor console")

// Access theme info
const tokenCount = await cursor.run((r) => {
  const style = r.document.querySelector(".vscode-tokens-styles")
  return style?.textContent?.match(/\.mtk\d+/g)?.length ?? 0
})

console.log(`\n🎨 Theme has ${tokenCount} token color classes`)

cursor.close()
