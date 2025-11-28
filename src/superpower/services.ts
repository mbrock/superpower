/**
 * VS Code / Cursor Service Access
 *
 * Extracts the instantiationService by briefly pausing on an event handler,
 * saving a global reference, then resuming immediately. No frozen UI!
 *
 * @example
 * ```ts
 * const svc = await getServices()
 * const title = await svc.run((s) => s.editorGroupsService.activeGroup.activeEditor?.getName())
 * await svc.run((s) => s.commandService.executeCommand('workbench.action.toggleSidebar'))
 * ```
 */

import { CDP, type CDPTarget } from "./cdp"

// ============================================================================
// Types
// ============================================================================

export interface Services {
  /** The underlying CDP client */
  cdp: CDP

  /** Run a function with access to the services object */
  run<T>(fn: (services: ServiceMap) => T): Promise<Awaited<T>>

  /** List all registered service names */
  list(): Promise<string[]>

  /** Get a service by name and inspect its shape */
  inspect(name: string): Promise<{ className: string; keys: string[] } | null>

  /** Close the CDP connection */
  close(): void
}

export interface ServiceMap {
  instantiationService: any
  editorGroupsService: any
  editorService: any
  commandService: any
  configurationService: any
  layoutService: any
  contextKeyService: any
  storageService: any
  themeService: any
  keybindingService: any
  [key: string]: any
}

interface EventListener {
  type: string
  scriptId: string
  lineNumber: number
  columnNumber: number
}

// Global variable name we'll use to store the services
const GLOBAL_KEY = "__superpower_services__"

// ============================================================================
// Main API
// ============================================================================

/**
 * Get access to VS Code's internal services.
 *
 * This works by:
 * 1. Finding an event handler that has access to the service container
 * 2. Briefly pausing execution on it
 * 3. Saving a reference to `this` (the services) as a global variable
 * 4. Immediately resuming - no frozen UI!
 *
 * After this, we can call `run()` to execute code with service access.
 */
export async function getServices(
  options: {
    predicate?: (target: CDPTarget) => boolean
    timeout?: number
  } = {}
): Promise<Services> {
  const {
    predicate = (t) => t.url.includes("workbench.html"),
    timeout = 5000,
  } = options

  const cdp = await CDP.connect(predicate)

  try {
    await cdp.send("Runtime.enable")
    await cdp.send("DOM.enable")
    await cdp.debuggerEnable()

    // Check if we already have the global (from a previous run)
    const existing = await cdp.eval<boolean>(`typeof ${GLOBAL_KEY} !== 'undefined'`)

    if (!existing) {
      // Need to extract services via breakpoint
      await extractServices(cdp, timeout)
    }

    // Verify we got it
    const verified = await cdp.eval<boolean>(
      `typeof ${GLOBAL_KEY} !== 'undefined' && ${GLOBAL_KEY}.instantiationService != null`
    )

    if (!verified) {
      throw new Error("Failed to extract services - global not set correctly")
    }

    return createClient(cdp)
  } catch (err) {
    // Always close on error so we don't leave things broken
    cdp.close()
    throw err
  }
}

// ============================================================================
// Extraction
// ============================================================================

async function extractServices(cdp: CDP, timeout: number): Promise<void> {
  // Get document's event listeners
  const docResult = await cdp.send<{ result: { objectId: string } }>(
    "Runtime.evaluate",
    { expression: "document", returnByValue: false }
  )

  const { listeners } = await cdp.send<{ listeners: EventListener[] }>(
    "DOMDebugger.getEventListeners",
    { objectId: docResult.result.objectId, depth: 1 }
  )

  // Find a handler that has service access
  const target = listeners.find((l) => l.type === "mouseout")
    || listeners.find((l) => l.type === "mousemove")
    || listeners.find((l) => l.type === "focusin")

  if (!target) {
    throw new Error("No suitable event listener found for service extraction")
  }

  // Set breakpoint
  const bp = await cdp.send<{ breakpointId: string }>("Debugger.setBreakpoint", {
    location: {
      scriptId: target.scriptId,
      lineNumber: target.lineNumber,
      columnNumber: target.columnNumber,
    },
  })

  try {
    // Dispatch synthetic event to trigger the breakpoint
    await cdp.run(
      (g, eventType) => {
        setTimeout(() => {
          const event = new MouseEvent(eventType, {
            bubbles: true,
            clientX: 100,
            clientY: 100,
          })
          g.document.dispatchEvent(event)
        }, 50)
      },
      target.type
    )

    // Wait for pause
    const paused = await cdp.waitForPause(timeout)
    const frameId = paused.callFrames[0].callFrameId

    // Save `this` (the service container) to a global variable
    await cdp.send("Debugger.evaluateOnCallFrame", {
      callFrameId: frameId,
      expression: `globalThis.${GLOBAL_KEY} = this`,
      returnByValue: false,
    })
  } finally {
    // Always clean up: remove breakpoint and resume
    await cdp.send("Debugger.removeBreakpoint", { breakpointId: bp.breakpointId }).catch(() => {})
    await cdp.debuggerResume().catch(() => {})
  }
}

// ============================================================================
// Client
// ============================================================================

function createClient(cdp: CDP): Services {
  // Run with additional args that get JSON-serialized into the call
  const runWithArgs = async <T, A extends unknown[]>(
    fn: (services: ServiceMap, ...args: A) => T,
    ...args: A
  ): Promise<Awaited<T>> => {
    const argsJson = JSON.stringify(args)
    const result = await cdp.eval<T>(
      `(${fn.toString()})(${GLOBAL_KEY}, ...${argsJson})`
    )
    return result as Awaited<T>
  }

  const run = async <T>(fn: (services: ServiceMap) => T): Promise<Awaited<T>> => {
    return runWithArgs(fn)
  }

  return {
    cdp,
    run,

    list: () => run((s) => {
      const svc = s.instantiationService?._services
      if (!svc) return []
      const entries = svc._entries || svc
      const names: string[] = []
      for (const [key] of entries.entries?.() || entries) {
        names.push(String(key))
      }
      return names.sort()
    }),

    inspect: (name: string) => runWithArgs(
      (s, n) => {
        const svc = s.instantiationService?._services
        if (!svc) return null
        const entries = svc._entries || svc
        for (const [key, value] of entries.entries?.() || entries) {
          if (String(key) === n) {
            const instance = value?.value || value
            if (instance && typeof instance === "object") {
              return {
                className: instance.constructor?.name || "Object",
                keys: Object.keys(instance).slice(0, 100),
              }
            }
            return { className: typeof instance, keys: [] }
          }
        }
        return null
      },
      name
    ),

    close: () => cdp.close(),
  }
}
