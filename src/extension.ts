import * as vscode from "vscode"
import type { PropertiesHyphen } from "csstype"
import { promises as fs } from "fs"
import * as path from "path"

// Output channel for debugging
let outputChannel: vscode.OutputChannel

// Decoration types mapped by token type
let decorations: Map<string, vscode.TextEditorDecorationType> = new Map()

// Timeout for debouncing decoration updates
let updateTimeout: NodeJS.Timeout | undefined

function log(message: string) {
  outputChannel.appendLine(message)
}

// OKLCH color helpers
// oklch(L% C H / alpha) - L: lightness, C: chroma, H: hue (degrees)
const oklch = (l: number, c: number, h: number, a: number = 1) =>
  `oklch(${l}% ${c} ${h} / ${a})`

// Define our palette in OKLCH
// Keeping consistent lightness/chroma for harmony
const palette = {
  // Hues: purple ~300, cyan ~195, teal ~165, orange ~70, warm ~85
  purple: (a: number) => oklch(65, 0.25, 300, a),
  cyan: (a: number) => oklch(75, 0.15, 195, a),
  teal: (a: number) => oklch(70, 0.15, 165, a),
  orange: (a: number) => oklch(70, 0.18, 55, a),
  warm: (a: number) => oklch(75, 0.08, 85, a),
  neutral: (a: number) => oklch(90, 0, 0, a),
}

// Recursive CSS type - csstype properties plus nested selectors
type CSS = PropertiesHyphen & { [selector: `&${string}`]: CSS }

const tokenStyles: Record<string, CSS> = {
  function: {
    "background-color": palette.purple(0.15),
    padding: "0 0.25ch",
    "box-shadow": `0 0 2ch 0ch ${palette.purple(0.08)}`,
  },
  method: {
    "background-color": palette.purple(0.17),
  },
  class: {
    position: "relative",
    "&::before": {
      content: '""',
      position: "absolute",
      inset: "-0.5ch -1ch",
      "background-color": palette.cyan(0.12),
      border: `2px solid ${palette.cyan(0.17)}`,
      "border-radius": "0.5ch",
      "z-index": "-1",
    },
  },
  interface: {
    "background-color": palette.cyan(0.12),
  },
  type: {
    "background-color": palette.cyan(0.12),
  },
  enum: {
    "background-color": palette.cyan(0.12),
  },
  typeParameter: {
    "background-color": palette.cyan(0.08),
  },
  namespace: {
    "background-color": palette.teal(0.12),
  },
  parameter: {
    "background-color": palette.warm(0.08),
  },
  variable: {
    "background-color": palette.warm(0.05),
  },
  property: {
    "background-color": palette.neutral(0.04),
  },
  enumMember: {
    "background-color": palette.orange(0.12),
  },
}

// Convert CSS object to string, recursively handling nested blocks
function cssToString(css: CSS): string {
  return Object.entries(css)
    .map(([prop, value]) => {
      if (typeof value === "string") {
        return `${prop}: ${value}`
      } else {
        // Nested block (e.g. "&::before": { ... })
        return `${prop} { ${cssToString(value)} }`
      }
    })
    .join("; ")
}

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("Linen Glow", {
    log: true,
  })
  context.subscriptions.push(outputChannel)

  log("Extension activated")

  outputChannel.show(true) // Show and preserve focus

  createDecorationTypes()

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("linenGlow")) {
        disposeDecorations()
        createDecorationTypes()
        triggerUpdateDecorations()
      }
    }),
  )

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        triggerUpdateDecorations()
      }
    }),
  )

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor
      if (editor && event.document === editor.document) {
        triggerUpdateDecorations()
      }
    }),
  )

  if (vscode.window.activeTextEditor) {
    triggerUpdateDecorations()
  }

  // Register the superpower launcher command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "linenGlow.createSuperpowerLauncher",
      createSuperpowerLauncher,
    ),
  )
}

async function createSuperpowerLauncher() {
  const appName = "Cursor CDP"
  const appPath = path.join("/Applications", `${appName}.app`)
  const contentsPath = path.join(appPath, "Contents")
  const macosPath = path.join(contentsPath, "MacOS")
  const resourcesPath = path.join(contentsPath, "Resources")

  // Shell script that launches Cursor with CDP enabled
  const launchScript = `#!/bin/bash
exec /Applications/Cursor.app/Contents/MacOS/Cursor --remote-debugging-port=9222 "$@"
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

    // Copy Cursor's icon
    const cursorIconPath =
      "/Applications/Cursor.app/Contents/Resources/Cursor.icns"
    const destIconPath = path.join(resourcesPath, "AppIcon.icns")
    try {
      await fs.copyFile(cursorIconPath, destIconPath)
    } catch {
      // Icon copy failed, app will still work just without custom icon
      log("Could not copy Cursor icon, continuing without it")
    }

    vscode.window.showInformationMessage(
      `Created ${appName}.app in /Applications. Launch it to start Cursor with CDP on port 9222.`,
    )
    log(`Created superpower launcher at ${appPath}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    vscode.window.showErrorMessage(
      `Failed to create launcher: ${message}. Try running VS Code as admin or create manually.`,
    )
    log(`Failed to create launcher: ${message}`)
  }
}

function createDecorationTypes() {
  const config = vscode.workspace.getConfiguration("linenGlow")
  if (!config.get("enabled", true)) return

  for (const [tokenType, css] of Object.entries(tokenStyles)) {
    // Inject arbitrary CSS via the textDecoration hack
    // VS Code doesn't sanitize the value, so "none; background: red" works
    const injectedCSS = `none; ${cssToString(css)}`

    decorations.set(
      tokenType,
      vscode.window.createTextEditorDecorationType({
        textDecoration: injectedCSS,
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      }),
    )
  }

  log(`Created ${decorations.size} decoration types`)
}

function disposeDecorations() {
  for (const decoration of decorations.values()) {
    decoration.dispose()
  }
  decorations.clear()
}

function triggerUpdateDecorations() {
  if (updateTimeout) {
    clearTimeout(updateTimeout)
  }
  updateTimeout = setTimeout(updateDecorations, 100)
}

async function updateDecorations() {
  const editor = vscode.window.activeTextEditor
  if (!editor) return

  const config = vscode.workspace.getConfiguration("linenGlow")
  if (!config.get("enabled", true)) {
    for (const decoration of decorations.values()) {
      editor.setDecorations(decoration, [])
    }
    return
  }

  const document = editor.document
  const fileName = document.fileName.split("/").pop()

  const tokensByType = await getSemanticTokenRanges(document)

  if (tokensByType) {
    let total = 0
    for (const [tokenType, ranges] of tokensByType.entries()) {
      const decoration = decorations.get(tokenType)
      if (decoration) {
        editor.setDecorations(decoration, ranges)
        total += ranges.length
      }
    }
    log(`${fileName}: decorated ${total} tokens`)
  } else {
    log(`${fileName}: no semantic tokens`)
    for (const decoration of decorations.values()) {
      editor.setDecorations(decoration, [])
    }
  }
}

async function getSemanticTokenRanges(
  document: vscode.TextDocument,
): Promise<Map<string, vscode.Range[]> | null> {
  try {
    const legend =
      await vscode.commands.executeCommand<vscode.SemanticTokensLegend>(
        "vscode.provideDocumentSemanticTokensLegend",
        document.uri,
      )
    if (!legend) return null

    const tokens =
      await vscode.commands.executeCommand<vscode.SemanticTokens>(
        "vscode.provideDocumentSemanticTokens",
        document.uri,
      )
    if (!tokens) return null

    const result = new Map<string, vscode.Range[]>()

    // Initialize arrays for token types we care about
    for (const tokenType of Object.keys(tokenStyles)) {
      result.set(tokenType, [])
    }

    // Decode semantic tokens (delta-encoded)
    let line = 0
    let char = 0

    for (let i = 0; i < tokens.data.length; i += 5) {
      const deltaLine = tokens.data[i]
      const deltaChar = tokens.data[i + 1]
      const length = tokens.data[i + 2]
      const tokenTypeIndex = tokens.data[i + 3]
      // const tokenModifiersBitset = tokens.data[i + 4]; // available if needed

      if (deltaLine > 0) {
        line += deltaLine
        char = deltaChar
      } else {
        char += deltaChar
      }

      const tokenType = legend.tokenTypes[tokenTypeIndex]
      const ranges = result.get(tokenType)
      if (ranges) {
        ranges.push(new vscode.Range(line, char, line, char + length))
      }
    }

    return result
  } catch (e) {
    return null
  }
}

export function deactivate() {
  log("Extension deactivating")
  disposeDecorations()
}
