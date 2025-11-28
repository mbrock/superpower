#!/usr/bin/env bun
import { getServices } from "./services"

const svc = await getServices()

const editor = await svc.run((g) => ({
  groups: g.__superpower__.editorGroupsService?.count,
  active: g.__superpower__.editorGroupsService?.activeGroup?.activeEditor?.getName?.(),
}))
console.log("editor:", editor)

const config = await svc.run((g) => {
  const s = g.__superpower__
  for (const [k, v] of s.instantiationService._services._entries.entries()) {
    if (String(k) === "configurationService") {
      const cs = (v as any)?.value || v
      return {
        fontSize: cs.getValue?.("editor.fontSize"),
        theme: cs.getValue?.("workbench.colorTheme"),
      }
    }
  }
})
console.log("config:", config)

console.log("toggling sidebar...")
await svc.run((g) => {
  const s = g.__superpower__
  for (const [k, v] of s.instantiationService._services._entries.entries()) {
    if (String(k) === "commandService") {
      ;((v as any)?.value || v).executeCommand("workbench.action.toggleSidebarVisibility")
    }
  }
})

svc.close()
