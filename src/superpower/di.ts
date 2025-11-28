/**
 * VS Code / Cursor Dependency Injection Service Extractor
 *
 * Uses CDP to extract the instantiationService from a running instance,
 * giving you access to all internal services.
 *
 * @example
 * ```ts
 * const di = await extractDI()
 * const title = await di.eval(`editorGroupsService.activeGroup.activeEditor?.getName()`)
 * const services = await di.listServices()
 * di.close()
 * ```
 */

import { CDP, type CDPTarget } from "./cdp"

// ============================================================================
// Types
// ============================================================================

export interface DIClient {
  /** The underlying CDP client */
  cdp: CDP

  /** The call frame ID where services are accessible */
  frameId: string

  /** Evaluate an expression with access to all services in scope */
  eval<T = unknown>(expression: string): Promise<T>

  /** Run a function with access to the service container */
  run<T>(fn: (services: ServiceContainer) => T): Promise<Awaited<T>>

  /** List all registered service names */
  listServices(): Promise<string[]>

  /** Get info about a specific service */
  getServiceInfo(name: string): Promise<ServiceInfo | null>

  /** Close the connection and resume execution */
  close(): Promise<void>
}

export interface ServiceContainer {
  instantiationService: any
  editorGroupsService: any
  layoutService: any
  contextKeyService: any
  storageService: any
  logService: any
  [key: string]: any
}

export interface ServiceInfo {
  className: string
  keys: string[]
}

interface EventListener {
  type: string
  scriptId: string
  lineNumber: number
  columnNumber: number
}

// ============================================================================
// Extraction
// ============================================================================

/**
 * Extract the DI service container from a running VS Code / Cursor instance.
 *
 * This works by:
 * 1. Finding an event handler on document that has access to services
 * 2. Setting a breakpoint on it
 * 3. Dispatching a synthetic event to trigger it
 * 4. Capturing the call frame where services are in scope
 *
 * The returned client keeps the debugger paused so you can evaluate
 * expressions with full access to the service container.
 */
export async function extractDI(
  options: {
    predicate?: (target: CDPTarget) => boolean
    timeout?: number
  } = {}
): Promise<DIClient> {
  const {
    predicate = (t) => t.url.includes("workbench.html"),
    timeout = 5000,
  } = options

  const cdp = await CDP.connect(predicate)

  await cdp.send("Runtime.enable")
  await cdp.send("DOM.enable")
  await cdp.debuggerEnable()

  // Get document's event listeners
  const docResult = await cdp.send<{ result: { objectId: string } }>(
    "Runtime.evaluate",
    { expression: "document", returnByValue: false }
  )

  const { listeners } = await cdp.send<{ listeners: EventListener[] }>(
    "DOMDebugger.getEventListeners",
    { objectId: docResult.result.objectId, depth: 1 }
  )

  // Find a handler that has service access (mouseout/mousemove work well)
  const target = listeners.find((l) => l.type === "mouseout")
    || listeners.find((l) => l.type === "mousemove")
    || listeners.find((l) => l.type === "focusin")

  if (!target) {
    cdp.close()
    throw new Error("No suitable event listener found for DI extraction")
  }

  // Set breakpoint
  const bp = await cdp.send<{ breakpointId: string }>("Debugger.setBreakpoint", {
    location: {
      scriptId: target.scriptId,
      lineNumber: target.lineNumber,
      columnNumber: target.columnNumber,
    },
  })

  // Dispatch synthetic event
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

  // Remove breakpoint immediately (we'll stay paused)
  await cdp.send("Debugger.removeBreakpoint", { breakpointId: bp.breakpointId })

  const frameId = paused.callFrames[0].callFrameId

  // Build the client
  const client: DIClient = {
    cdp,
    frameId,

    async eval<T = unknown>(expression: string): Promise<T> {
      const result = await cdp.send<{
        result?: { value: unknown }
        exceptionDetails?: { text: string; exception?: { description: string } }
      }>("Debugger.evaluateOnCallFrame", {
        callFrameId: frameId,
        expression,
        returnByValue: true,
      })

      if (result.exceptionDetails) {
        const d = result.exceptionDetails
        throw new Error(d.exception?.description || d.text)
      }
      return result.result?.value as T
    },

    async run<T>(fn: (services: ServiceContainer) => T): Promise<Awaited<T>> {
      // Build a services object from what's available on `this`
      const expression = `
        (() => {
          const services = {
            instantiationService: this.instantiationService,
            editorGroupsService: this.editorGroupsService,
            layoutService: this.layoutService,
            contextKeyService: this.contextKeyService,
            storageService: this.storageService,
            logService: this.logService,
            appLayoutService: this.appLayoutService,
            experimentService: this.experimentService,
          }
          return (${fn.toString()})(services)
        })()
      `
      return client.eval<Awaited<T>>(expression)
    },

    async listServices(): Promise<string[]> {
      return client.eval<string[]>(`
        (() => {
          const svc = this.instantiationService?._services
          if (!svc) return []
          const entries = svc._entries || svc
          const names = []
          for (const [key] of entries.entries?.() || entries) {
            names.push(String(key))
          }
          return names.sort()
        })()
      `)
    },

    async getServiceInfo(name: string): Promise<ServiceInfo | null> {
      return client.eval<ServiceInfo | null>(`
        (() => {
          const svc = this.instantiationService?._services
          if (!svc) return null
          const entries = svc._entries || svc
          for (const [key, value] of entries.entries?.() || entries) {
            if (String(key) === ${JSON.stringify(name)}) {
              const instance = value?.value || value
              if (instance && typeof instance === 'object') {
                return {
                  className: instance.constructor?.name || 'Object',
                  keys: Object.keys(instance).slice(0, 100)
                }
              }
              return { className: typeof instance, keys: [] }
            }
          }
          return null
        })()
      `)
    },

    async close(): Promise<void> {
      await cdp.debuggerResume()
      cdp.close()
    },
  }

  return client
}
