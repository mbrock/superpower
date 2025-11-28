/**
 * Set breakpoint on real event handlers using DOMDebugger info
 *
 * Run with: bun src/superpower/debugger-explore.ts
 */

import {
  CDP,
  type CallFrame,
  type RemoteObject,
  type PropertyDescriptor,
} from "./cdp"

interface EventListener {
  type: string
  useCapture: boolean
  passive: boolean
  once: boolean
  scriptId: string
  lineNumber: number
  columnNumber: number
  handler?: RemoteObject
  originalHandler?: RemoteObject
  backendNodeId?: number
}

function printRemoteObject(obj: RemoteObject, indent = "") {
  console.log(`${indent}type: ${obj.type}`)
  if (obj.subtype) console.log(`${indent}subtype: ${obj.subtype}`)
  if (obj.className) console.log(`${indent}className: ${obj.className}`)
  if (obj.description) {
    const desc =
      obj.description.length > 100
        ? obj.description.slice(0, 100) + "..."
        : obj.description
    console.log(`${indent}description: ${desc}`)
  }
}

async function printScopeChain(client: CDP, frame: CallFrame) {
  for (const scope of frame.scopeChain) {
    if (scope.type === "global") continue // skip global, too big

    console.log(
      `\n      🔗 ${scope.type}${scope.name ? ` "${scope.name}"` : ""}:`,
    )

    if (scope.object.objectId) {
      try {
        const { result: props } = await client.getProperties(
          scope.object.objectId,
        )
        const interesting = props
          .filter(
            (p) =>
              p.value &&
              p.value.type !== "undefined" &&
              !p.name.startsWith("__"),
          )
          .slice(0, 10)

        for (const p of interesting) {
          if (p.value) {
            const v = p.value
            const desc = v.className || v.description?.slice(0, 50) || v.type
            console.log(`         ${p.name}: ${desc}`)
          }
        }
      } catch {
        // ignore
      }
    }
  }
}

async function explore() {
  console.log("\n🔍 CDP Breakpoint Explorer\n")

  const client = await CDP.connect((t) => t.url.includes("workbench.html"))
  console.log(`✅ Connected to: ${client.target.title}\n`)

  await client.send("Runtime.enable")
  await client.send("DOM.enable")
  await client.debuggerEnable()

  // Get document's event listeners
  const docResult = await client.send<{ result: { objectId: string } }>(
    "Runtime.evaluate",
    {
      expression: "document",
      returnByValue: false,
    },
  )

  const { listeners } = await client.send<{ listeners: EventListener[] }>(
    "DOMDebugger.getEventListeners",
    {
      objectId: docResult.result.objectId,
      depth: 1,
    },
  )

  console.log(`📋 Document has ${listeners.length} event listeners:\n`)

  // Group and show listeners
  const byType = new Map<string, EventListener[]>()
  for (const l of listeners) {
    if (!byType.has(l.type)) byType.set(l.type, [])
    byType.get(l.type)!.push(l)
  }

  for (const [type, handlers] of byType) {
    console.log(`   ${type}: ${handlers.length} handler(s)`)
    for (const h of handlers.slice(0, 2)) {
      console.log(
        `      script:${h.scriptId} @ ${h.lineNumber}:${h.columnNumber}`,
      )
    }
  }

  // Find handler with services - mouseout/mousemove on document have the service container
  const target =
    listeners.find((l) => l.type === "mouseout") ||
    listeners.find((l) => l.type === "mousemove") ||
    listeners.find((l) => l.type === "focusin") ||
    listeners[0]

  if (!target) {
    console.log("\n❌ No listeners found!")
    client.close()
    return
  }

  console.log(`\n🎯 Setting breakpoint on "${target.type}" handler:`)
  console.log(`   scriptId: ${target.scriptId}`)
  console.log(
    `   location: line ${target.lineNumber}, column ${target.columnNumber}`,
  )

  // Set the breakpoint
  const bp = await client.send<{
    breakpointId: string
    actualLocation: {
      scriptId: string
      lineNumber: number
      columnNumber: number
    }
  }>("Debugger.setBreakpoint", {
    location: {
      scriptId: target.scriptId,
      lineNumber: target.lineNumber,
      columnNumber: target.columnNumber,
    },
  })

  console.log(`   ✅ Breakpoint set: ${bp.breakpointId}`)
  console.log(
    `   actual location: ${bp.actualLocation.lineNumber}:${bp.actualLocation.columnNumber}`,
  )

  console.log(`\n⏳ Waiting for ${target.type} event (3s timeout)...\n`)

  // Schedule event dispatch in the browser (will fire after we start waiting)
  await client.run((g, eventType) => {
    setTimeout(() => {
      const event = new MouseEvent(eventType, {
        bubbles: true,
        clientX: 100,
        clientY: 100,
      })
      g.document.dispatchEvent(event)
    }, 50)
  }, target.type)

  // Wait for pause with short timeout and cleanup on error
  let event
  try {
    event = await client.waitForPause(3000)
  } catch (e) {
    console.log(`⏰ Timeout - removing breakpoint and exiting`)
    await client.send("Debugger.removeBreakpoint", {
      breakpointId: bp.breakpointId,
    })
    await client.debuggerResume().catch(() => {})
    client.close()
    return
  }

  console.log(`⏸️  PAUSED! Reason: ${event.reason}`)
  console.log(`   ${event.callFrames.length} call frames\n`)
  console.log("=".repeat(70))

  // Explore the call frames
  for (let i = 0; i < Math.min(event.callFrames.length, 8); i++) {
    const frame = event.callFrames[i]

    console.log(`\n📍 FRAME ${i}: ${frame.functionName || "(anonymous)"}`)
    console.log("-".repeat(50))

    const urlPart = frame.url
      ? frame.url.split("/").slice(-2).join("/")
      : `script:${frame.location.scriptId}`
    console.log(
      `   location: ${urlPart} @ ${frame.location.lineNumber}:${frame.location.columnNumber}`,
    )

    // Show `this`
    console.log(`\n   📌 this:`)
    printRemoteObject(frame.this, "      ")

    // If this is an interesting object, dig in
    if (
      frame.this.objectId &&
      frame.this.type === "object" &&
      frame.this.subtype !== "null"
    ) {
      try {
        const { result: props } = await client.getProperties(
          frame.this.objectId,
        )
        const interesting = props
          .filter(
            (p) =>
              p.name.startsWith("_") ||
              p.name.includes("Service") ||
              p.name.includes("Context") ||
              p.name.includes("controller"),
          )
          .slice(0, 8)

        if (interesting.length > 0) {
          console.log(`\n   📦 this properties (${props.length} total):`)
          for (const p of interesting) {
            if (p.value) {
              const desc =
                p.value.className ||
                p.value.description?.slice(0, 40) ||
                p.value.type
              console.log(`      .${p.name}: ${desc}`)
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // Show scope chain
    await printScopeChain(client, frame)
  }

  console.log("\n" + "=".repeat(70))

  // Extract comprehensive service info
  const frame0 = event.callFrames[0]
  if (frame0.this.objectId) {
    console.log("\n🔬 Extracting full service info to JSON...\n")

    try {
      const fullInfo = await client.runOnFrame(
        frame0.callFrameId,
        (self: any) => {
          // Helper to safely get object shape
          const getShape = (obj: any, depth = 0, maxDepth = 2): any => {
            if (depth > maxDepth) return "[max depth]"
            if (obj === null) return null
            if (obj === undefined) return undefined

            const type = typeof obj
            if (type === "function") {
              return `[Function: ${obj.name || "anonymous"}]`
            }
            if (type !== "object") {
              return obj
            }
            if (Array.isArray(obj)) {
              if (obj.length === 0) return []
              return [`[Array(${obj.length})]`]
            }

            // For objects, get keys and recurse for some
            const result: Record<string, any> = {}
            const keys = Object.keys(obj)
            result._className = obj.constructor?.name || "Object"
            result._keyCount = keys.length

            for (const key of keys.slice(0, 50)) {
              try {
                const val = obj[key]
                if (typeof val === "function") {
                  result[key] = `[Function: ${val.name || key}]`
                } else if (typeof val === "object" && val !== null) {
                  if (depth < maxDepth - 1) {
                    result[key] = getShape(val, depth + 1, maxDepth)
                  } else {
                    result[key] = `[${val.constructor?.name || "Object"}]`
                  }
                } else {
                  result[key] = val
                }
              } catch {
                result[key] = "[error accessing]"
              }
            }
            if (keys.length > 50) {
              result._truncated = `${keys.length - 50} more keys`
            }
            return result
          }

          const info: Record<string, any> = {
            _timestamp: new Date().toISOString(),
            _callFrameContext: self.constructor?.name,
          }

          // Top-level services on this
          info.thisObject = {
            className: self.constructor?.name,
            keys: Object.keys(self),
          }

          // InstantiationService
          if (self.instantiationService) {
            const is = self.instantiationService
            info.instantiationService = {
              className: is.constructor?.name,
              keys: Object.keys(is),
            }

            // Get all registered services
            if (is._services) {
              const services = is._services
              const entries = services._entries || services
              const serviceMap: Record<string, any> = {}

              const iterator =
                entries.entries?.() || entries[Symbol.iterator]?.()
              if (iterator) {
                for (const [key, value] of iterator) {
                  const keyStr = String(key)
                  try {
                    const svc = value?.value || value
                    if (svc && typeof svc === "object") {
                      serviceMap[keyStr] = {
                        className: svc.constructor?.name,
                        keys: Object.keys(svc).slice(0, 30),
                      }
                    } else {
                      serviceMap[keyStr] = { type: typeof svc }
                    }
                  } catch {
                    serviceMap[keyStr] = { error: "could not inspect" }
                  }
                }
              }
              info.registeredServices = serviceMap
            }
          }

          // Editor info
          if (self.editorGroupsService) {
            const egs = self.editorGroupsService
            info.editorGroupsService = {
              className: egs.constructor?.name,
              count: egs.count,
              groups: egs.groups?.map((g: any) => ({
                id: g.id,
                index: g.index,
                label: g.label,
                editorCount: g.count,
                activeEditor: g.activeEditor
                  ? {
                      name: g.activeEditor.getName?.(),
                      resource: g.activeEditor.resource?.toString(),
                      typeId: g.activeEditor.typeId,
                    }
                  : null,
                editors: g.editors?.map((e: any) => ({
                  name: e.getName?.(),
                  resource: e.resource?.toString(),
                })),
              })),
            }
          }

          // Context keys
          if (self.contextKeyService) {
            const cks = self.contextKeyService
            info.contextKeyService = {
              className: cks.constructor?.name,
              keys: Object.keys(cks).slice(0, 30),
            }

            // Try to get current context values
            if (cks.getContext) {
              try {
                const ctx = cks.getContext(null)
                if (ctx && ctx.getValue) {
                  const contextValues: Record<string, any> = {}
                  // Common context keys
                  const commonKeys = [
                    "editorFocus",
                    "textInputFocus",
                    "inputFocus",
                    "editorTextFocus",
                    "editorHasSelection",
                    "activeEditor",
                    "resourceScheme",
                    "resourcePath",
                    "inDebugMode",
                    "debugState",
                  ]
                  for (const k of commonKeys) {
                    try {
                      contextValues[k] = ctx.getValue(k)
                    } catch {}
                  }
                  info.contextKeyService.contextValues = contextValues
                }
              } catch {}
            }
          }

          // Layout service
          if (self.layoutService) {
            const ls = self.layoutService
            info.layoutService = {
              className: ls.constructor?.name,
              keys: Object.keys(ls).slice(0, 30),
            }
          }

          // Storage service
          if (self.storageService) {
            const ss = self.storageService
            info.storageService = {
              className: ss.constructor?.name,
              keys: Object.keys(ss).slice(0, 30),
            }
          }

          // Log service
          if (self.logService) {
            const ls = self.logService
            info.logService = {
              className: ls.constructor?.name,
              keys: Object.keys(ls).slice(0, 20),
            }
          }

          return info
        },
      )

      // Write to JSON file
      const outputPath = "src/superpower/vscode-services.json"
      await Bun.write(outputPath, JSON.stringify(fullInfo, null, 2))
      console.log(`✅ Wrote service info to ${outputPath}`)
      console.log(
        `   ${Object.keys(fullInfo.registeredServices || {}).length} registered services found`,
      )
    } catch (e) {
      console.log(`   Error: ${e}`)
    }
  }

  console.log("\n" + "=".repeat(70))

  // Remove breakpoint and resume
  await client.send("Debugger.removeBreakpoint", {
    breakpointId: bp.breakpointId,
  })
  console.log("\n🗑️  Breakpoint removed")

  await client.debuggerResume()
  console.log("▶️  Resumed")

  await new Promise((r) => setTimeout(r, 200))

  console.log("👋 Done!\n")
  client.close()
}

explore().catch(console.error)
