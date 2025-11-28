import * as fs from "node:fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import { log } from "./extension"

// Detect which VS Code variant we're running in
function detectVSCodeVariant(): {
  name: string
  appPath: string
  bundleId: string
} {
  const appName = vscode.env.appName.toLowerCase()

  if (appName.includes("cursor")) {
    return {
      name: "Cursor",
      appPath: "/Applications/Cursor.app/Contents/MacOS/Cursor",
      bundleId: "com.todesktop.230313mzl4w4u92",
    }
  }

  // Default to VS Code
  return {
    name: "Code",
    appPath: "/Applications/Visual Studio Code.app/Contents/MacOS/Electron",
    bundleId: "com.microsoft.VSCode",
  }
}

export async function createSuperpowerLauncher() {
  const variant = detectVSCodeVariant()
  const appName = `${variant.name} CDP`
  const appPath = path.join("/Applications", `${appName}.app`)
  const contentsPath = path.join(appPath, "Contents")
  const macosPath = path.join(contentsPath, "MacOS")
  const resourcesPath = path.join(contentsPath, "Resources")

  // Shell script that launches the editor with CDP enabled
  const launchScript = `#!/bin/bash
exec "${variant.appPath}" --remote-debugging-port=9222 "$@"
`

  // Info.plist for macOS app bundle
  const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>launch</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleIdentifier</key>
  <string>com.superpower.${variant.name.toLowerCase()}-cdp</string>
  <key>CFBundleName</key>
  <string>${appName}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleVersion</key>
  <string>1.0</string>
  <key>LSMinimumSystemVersion</key>
  <string>10.13</string>
</dict>
</plist>
`

  try {
    // Create directory structure
    await fs.mkdir(macosPath, { recursive: true })
    await fs.mkdir(resourcesPath, { recursive: true })

    // Write the launch script
    const launchScriptPath = path.join(macosPath, "launch")
    await fs.writeFile(launchScriptPath, launchScript, { mode: 0o755 })

    // Write Info.plist
    await fs.writeFile(path.join(contentsPath, "Info.plist"), infoPlist)

    // Try to copy the source app's icon
    const sourceIconPath = variant.appPath.replace(
      /\/Contents\/MacOS\/.*$/,
      `/Contents/Resources/${variant.name}.icns`,
    )
    const destIconPath = path.join(resourcesPath, "AppIcon.icns")
    try {
      await fs.copyFile(sourceIconPath, destIconPath)
    } catch {
      log("Could not copy app icon, continuing without it")
    }

    vscode.window.showInformationMessage(
      `Created ${appName}.app in /Applications. Launch it to start ${variant.name} with CDP on port 9222.`,
    )
    log(`Created superpower launcher at ${appPath}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    vscode.window.showErrorMessage(
      `Failed to create launcher: ${message}. Try running as admin or create manually.`,
    )
    log(`Failed to create launcher: ${message}`)
  }
}
