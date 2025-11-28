#!/usr/bin/env bun
/**
 * Test script for the DI extraction API
 *
 * Run with: bun src/superpower/test-di.ts
 */

import { extractDI } from "./di"

async function main() {
  console.log("\n🔌 Extracting DI services...\n")

  const di = await extractDI()
  console.log("✅ Connected and paused!\n")

  // ============================================================================
  // List services
  // ============================================================================

  console.log("=".repeat(60))
  console.log("📋 AVAILABLE SERVICES")
  console.log("=".repeat(60))

  const services = await di.listServices()
  console.log(`\nFound ${services.length} services\n`)

  const interesting = services.filter(s =>
    s.includes("editor") || s.includes("command") || s.includes("theme")
  ).slice(0, 10)
  console.log("Interesting:", interesting.join(", "))

  // ============================================================================
  // Use run() with real functions
  // ============================================================================

  console.log("\n" + "=".repeat(60))
  console.log("📊 LIVE STATE")
  console.log("=".repeat(60))

  const editorInfo = await di.run((svc) => {
    const egs = svc.editorGroupsService
    if (!egs) return { error: "no editorGroupsService" }

    const activeGroup = egs.activeGroup
    const activeEditor = activeGroup?.activeEditor

    return {
      groupCount: egs.count,
      activeGroupId: activeGroup?.id,
      activeEditorName: activeEditor?.getName?.(),
      resource: activeEditor?.resource?.toString(),
    }
  })

  console.log("\n📝 Editor:", editorInfo)

  // Try getting layout info
  const layoutInfo = await di.run((svc) => {
    const layout = svc.layoutService
    if (!layout) return { error: "no layoutService" }

    return {
      className: layout.constructor?.name,
      isVisible: {
        sidebar: layout.isVisible?.(0), // Parts.SIDEBAR_PART
        panel: layout.isVisible?.(1),
      },
    }
  })

  console.log("📐 Layout:", layoutInfo)

  // ============================================================================
  // Get service details
  // ============================================================================

  console.log("\n" + "=".repeat(60))
  console.log("🔍 SERVICE INFO")
  console.log("=".repeat(60))

  for (const name of ["editorService", "commandService", "themeService"]) {
    const info = await di.getServiceInfo(name)
    if (info) {
      console.log(`\n📦 ${name} (${info.className})`)
      console.log(`   ${info.keys.slice(0, 6).join(", ")}...`)
    }
  }

  // ============================================================================
  // Done!
  // ============================================================================

  console.log("\n" + "=".repeat(60))
  await di.close()
  console.log("✅ Done!\n")
}

main().catch((err) => {
  console.error("❌ Error:", err)
  process.exit(1)
})
