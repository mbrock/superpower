/**
 * Access VS Code/Cursor internal services via CDP.
 */

import { CDP } from "./cdp"
import type { CursorRenderer } from "./cursor-renderer"

export async function getServices() {
  const cdp = await CDP.connect<CursorRenderer>((t) => t.url.includes("workbench.html"))

  const exists = await cdp.run((g) => "instantiationService" in g)
  if (!exists) {
    await extractAndCache(cdp)
  }

  return {
    run: cdp.run.bind(cdp),
    close: () => cdp.close(),
  }
}

async function extractAndCache(cdp: CDP<CursorRenderer>) {
  await cdp.send("DOM.enable")
  await cdp.enableDebugger()

  const docId = await cdp.getObjectId((g) => g.document)

  const { listeners } = await cdp.send<{
    listeners: { type: string; scriptId: string; lineNumber: number; columnNumber: number }[]
  }>("DOMDebugger.getEventListeners", { objectId: docId, depth: 1 })

  const target = listeners.find((l) => l.type === "mouseout")
  if (!target) throw new Error("No mouseout listener found")

  const { breakpointId } = await cdp.send<{ breakpointId: string }>("Debugger.setBreakpoint", {
    location: { scriptId: target.scriptId, lineNumber: target.lineNumber, columnNumber: target.columnNumber },
  })

  try {
    await cdp.run((g) => {
      setTimeout(() => g.document.dispatchEvent(new MouseEvent("mouseout", { bubbles: true })), 50)
    })

    const { callFrames } = await cdp.waitForPause()
    await cdp.runOnFrame(callFrames[0].callFrameId, (g, frameThis: { instantiationService: unknown }) => {
      g.instantiationService = frameThis.instantiationService
    })
  } finally {
    await cdp.send("Debugger.removeBreakpoint", { breakpointId }).catch(() => {})
    await cdp.resume().catch(() => {})
  }
}
