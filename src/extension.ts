import * as vscode from "vscode"
import { cssToString, tokenStyles } from "./tokenStyles"
import { createSuperpowerLauncher } from "./createSuperpowerLauncher"
import { getSemanticTokenRanges } from "./getSemanticTokenRanges"
import { testCDP } from "./testCDP"

let outputChannel: vscode.OutputChannel
let decorations: Map<string, vscode.TextEditorDecorationType> = new Map()
let updateTimeout: NodeJS.Timeout | undefined

export function log(message: string) {
  outputChannel.appendLine(message)
}

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("Linen Glow", {
    log: true,
  })

  context.subscriptions.push(outputChannel)

  createDecorationTypes()
  setupSemanticDecorating(context)

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "linenGlow.createSuperpowerLauncher",
      createSuperpowerLauncher,
    ),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("linenGlow.testCDP", testCDP),
  )
}

function setupSemanticDecorating(context: vscode.ExtensionContext) {
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

export function deactivate() {
  log("Extension deactivating")
  disposeDecorations()
}
