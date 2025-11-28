#!/usr/bin/env bun
import { getServices } from "./services"

const svc = await getServices()

// Helper to find service by name
const getService = (is: any, name: string) => {
  for (const [k, v] of is._services._entries.entries()) {
    if (String(k) === name) return (v as any)?.value || v
  }
}

const editor = await svc.run((g) => {
  const find = (name: string) => {
    for (const [k, v] of g.instantiationService._services._entries.entries()) {
      if (String(k) === name) return (v as any)?.value || v
    }
  }
  const egs = find("editorGroupsService")
  return {
    groups: egs?.count,
    active: egs?.activeGroup?.activeEditor?.getName?.(),
  }
})
console.log("editor:", editor)

const config = await svc.run((g) => {
  for (const [k, v] of g.instantiationService._services._entries.entries()) {
    if (String(k) === "configurationService") {
      const cs = (v as any)?.value || v
      return {
        fontSize: cs?.getValue?.("editor.fontSize"),
        theme: cs?.getValue?.("workbench.colorTheme"),
      }
    }
  }
})
console.log("config:", config)

console.log("toggling sidebar...")
await svc.run((g) => {
  for (const [k, v] of g.instantiationService._services._entries.entries()) {
    if (String(k) === "commandService") {
      const cs = (v as any)?.value || v
      cs?.executeCommand("workbench.action.toggleSidebarVisibility")
    }
  }
})

svc.close()
