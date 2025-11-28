/**
 * Access VS Code/Cursor internal services via CDP breakpoint extraction.
 */

import { CDP } from "./cdp"

const GLOBAL = "__superpower__"

export interface Services {
  run<T, A extends unknown[]>(fn: (services: any, ...args: A) => T, ...args: A): Promise<Awaited<T>>
  close(): void
}

export async function getServices(): Promise<Services> {
  const cdp = await CDP.connect((t) => t.url.includes("workbench.html"))

  // Check if already cached
  const exists = await cdp.eval<boolean>(`typeof ${GLOBAL} !== 'undefined'`)
  if (!exists) {
    await extractAndCache(cdp)
  }

  return {
    run: (fn, ...args) => cdp.eval(`(${fn.toString()})(${GLOBAL}, ...${JSON.stringify(args)})`),
    close: () => cdp.close(),
  }
}

async function extractAndCache(cdp: CDP) {
  await cdp.send("DOM.enable")
  await cdp.enableDebugger()

  // Find mouseout listener on document
  const doc = await cdp.send<{ result: { objectId: string } }>("Runtime.evaluate", {
    expression: "document",
    returnByValue: false,
  })

  const { listeners } = await cdp.send<{
    listeners: { type: string; scriptId: string; lineNumber: number; columnNumber: number }[]
  }>("DOMDebugger.getEventListeners", { objectId: doc.result.objectId, depth: 1 })

  const target = listeners.find((l) => l.type === "mouseout")
  if (!target) throw new Error("No mouseout listener found")

  // Set breakpoint on the handler
  const { breakpointId } = await cdp.send<{ breakpointId: string }>("Debugger.setBreakpoint", {
    location: { scriptId: target.scriptId, lineNumber: target.lineNumber, columnNumber: target.columnNumber },
  })

  try {
    // Trigger it with a synthetic event
    await cdp.run((g) => {
      setTimeout(() => g.document.dispatchEvent(new MouseEvent("mouseout", { bubbles: true })), 50)
    })

    // Wait for pause, save `this` to global
    const { callFrames } = await cdp.waitForPause()
    await cdp.evalOnFrame(callFrames[0].callFrameId, `globalThis.${GLOBAL} = this`, false)
  } finally {
    await cdp.send("Debugger.removeBreakpoint", { breakpointId }).catch(() => {})
    await cdp.resume().catch(() => {})
  }
}
