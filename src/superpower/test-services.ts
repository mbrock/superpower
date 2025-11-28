#!/usr/bin/env bun
/**
 * Test the services API
 *
 * Run with: bun src/superpower/test-services.ts
 */

import { getServices } from "./services"

const svc = await getServices()
console.log("✅ Got services!\n")

// Direct access to services on the cached object
const editor = await svc.run((s) => ({
  groups: s.editorGroupsService?.count,
  active: s.editorGroupsService?.activeGroup?.activeEditor?.getName?.(),
}))
console.log("📝 Editor:", editor)

// Get config via instantiation service
const config = await svc.run((s) => {
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
console.log("⚙️ Config:", config)

// Toggle sidebar
console.log("\n⚡ Toggling sidebar...")
await svc.run((s) => {
  for (const [k, v] of s.instantiationService._services._entries.entries()) {
    if (String(k) === "commandService") {
      ;((v as any)?.value || v).executeCommand("workbench.action.toggleSidebarVisibility")
    }
  }
})
console.log("✅ Done!")

svc.close()
