#!/usr/bin/env bun
/**
 * Demo of the typed CDP API
 */

import { CDP } from "./cdp"
import type { VSCodeRenderer } from "./vscode-renderer"

const client = await CDP.connect<VSCodeRenderer>((t) =>
  t.url.includes("workbench.html"),
)

console.log("Connected to:", client.target.title)

const info = await client.run((r) => ({
  title: r.document.title,
  windowId: r.vscode.context.configuration()?.windowId,
  platform: r.vscode.process.platform,
  electron: r.vscode.process.versions.electron,
  chrome: r.vscode.process.versions.chrome,
  editorGroups: r.document.querySelectorAll(".editor-group-container").length,
}))

console.log("\n📊 Window Info:")
console.log(info)

await client.run(
  (_, msg) => console.log(`%c${msg}`, "color: #ff69b4; font-size: 20px"),
  "Hello from CDP! 🎉",
)

console.log("\n📝 Logged a message to the devtools console")

// Access theme info
const tokenCount = await client.run((r) => {
  const style = r.document.querySelector(".vscode-tokens-styles")
  return style?.textContent?.match(/\.mtk\d+/g)?.length ?? 0
})

console.log(`\n🎨 Theme has ${tokenCount} token color classes`)

client.close()
