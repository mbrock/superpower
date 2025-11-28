import { fs } from "node:fs/promises";
import * as path from "path";
import * as vscode from "vscode";
import { log } from "./extension";

export async function createSuperpowerLauncher() {
  const appName = "Cursor CDP";
  const appPath = path.join("/Applications", `${appName}.app`);
  const contentsPath = path.join(appPath, "Contents");
  const macosPath = path.join(contentsPath, "MacOS");
  const resourcesPath = path.join(contentsPath, "Resources");

  // Shell script that launches Cursor with CDP enabled
  const launchScript = `#!/bin/bash
exec /Applications/Cursor.app/Contents/MacOS/Cursor --remote-debugging-port=9222 "$@"
`;

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
  <string>com.mbrock.cursor-cdp</string>
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
`;

  try {
    // Create directory structure
    await fs.mkdir(macosPath, { recursive: true });
    await fs.mkdir(resourcesPath, { recursive: true });

    // Write the launch script
    const launchScriptPath = path.join(macosPath, "launch");
    await fs.writeFile(launchScriptPath, launchScript, { mode: 0o755 });

    // Write Info.plist
    await fs.writeFile(path.join(contentsPath, "Info.plist"), infoPlist);

    // Copy Cursor's icon
    const cursorIconPath = "/Applications/Cursor.app/Contents/Resources/Cursor.icns";
    const destIconPath = path.join(resourcesPath, "AppIcon.icns");
    try {
      await fs.copyFile(cursorIconPath, destIconPath);
    } catch {
      // Icon copy failed, app will still work just without custom icon
      log("Could not copy Cursor icon, continuing without it");
    }

    vscode.window.showInformationMessage(
      `Created ${appName}.app in /Applications. Launch it to start Cursor with CDP on port 9222.`
    );
    log(`Created superpower launcher at ${appPath}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(
      `Failed to create launcher: ${message}. Try running VS Code as admin or create manually.`
    );
    log(`Failed to create launcher: ${message}`);
  }
}
