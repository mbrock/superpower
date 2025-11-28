#!/usr/bin/env bun
/**
 * Test the new services API
 *
 * Run with: bun src/superpower/test-services.ts
 */

import { getServices } from "./services"

async function main() {
  console.log("\n🔌 Getting services...\n")

  const svc = await getServices()
  console.log("✅ Got services! (UI should NOT be frozen)\n")

  // ============================================================================
  // Basic info
  // ============================================================================

  const services = await svc.list()
  console.log(`📋 ${services.length} services available`)

  // ============================================================================
  // Run with real functions - no code strings!
  // ============================================================================

  console.log("\n" + "=".repeat(50))
  console.log("📊 LIVE STATE")
  console.log("=".repeat(50))

  const editor = await svc.run((s) => {
    const egs = s.editorGroupsService
    const active = egs?.activeGroup?.activeEditor
    return {
      groups: egs?.count,
      activeFile: active?.getName?.(),
      resource: active?.resource?.path,
    }
  })
  console.log("\n📝 Editor:", editor)

  // Helper to get a service from the DI container
  const getService = (s: any, name: string) => {
    const entries = s.instantiationService._services._entries
    for (const [key, value] of entries.entries()) {
      if (String(key) === name) return value?.value || value
    }
    return null
  }

  const config = await svc.run((s) => {
    const entries = s.instantiationService._services._entries
    for (const [key, value] of entries.entries()) {
      if (String(key) === "configurationService") {
        const cs = value?.value || value
        return {
          fontSize: cs.getValue?.("editor.fontSize"),
          theme: cs.getValue?.("workbench.colorTheme"),
        }
      }
    }
    return null
  })
  console.log("⚙️ Config:", config)

  // ============================================================================
  // Try executing a command!
  // ============================================================================

  console.log("\n" + "=".repeat(50))
  console.log("🚀 COMMAND EXECUTION")
  console.log("=".repeat(50))

  const cmdInfo = await svc.run((s) => {
    const entries = s.instantiationService._services._entries
    for (const [key, value] of entries.entries()) {
      if (String(key) === "commandService") {
        const cs = value?.value || value
        return {
          hasExecuteCommand: typeof cs.executeCommand === "function",
          keys: Object.keys(cs).slice(0, 10),
        }
      }
    }
    return null
  })
  console.log("\n📜 Command service:", cmdInfo)

  // Let's actually toggle something!
  console.log("\n⚡ Toggling sidebar in 2 seconds...")
  await new Promise((r) => setTimeout(r, 2000))

  await svc.run((s) => {
    const entries = s.instantiationService._services._entries
    for (const [key, value] of entries.entries()) {
      if (String(key) === "commandService") {
        const cs = value?.value || value
        cs.executeCommand("workbench.action.toggleSidebarVisibility")
        return true
      }
    }
    return false
  })

  console.log("✅ Sidebar toggled!")

  // ============================================================================
  // Done
  // ============================================================================

  console.log("\n" + "=".repeat(50))
  svc.close()
  console.log("👋 Done!\n")
}

main().catch((err) => {
  console.error("❌ Error:", err)
  process.exit(1)
})
