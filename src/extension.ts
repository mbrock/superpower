import * as vscode from "vscode"
import { cssToString, tokenStyles } from "./tokenStyles"
import { createSuperpowerLauncher } from "./createSuperpowerLauncher"
import { getSemanticTokenRanges } from "./getSemanticTokenRanges"
import {
  SuperpowerClient,
  SuperpowerConnectionError,
} from "./superpower/client"

let outputChannel: vscode.OutputChannel
let decorations: Map<string, vscode.TextEditorDecorationType> = new Map()
let updateTimeout: NodeJS.Timeout | undefined
let superpowerClient: SuperpowerClient | undefined

export function log(message: string) {
  outputChannel.appendLine(message)
}

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("Linen Glow", {
    log: true,
  })

  context.subscriptions.push(outputChannel)

  // Initialize superpower client
  superpowerClient = new SuperpowerClient(outputChannel)
  context.subscriptions.push(superpowerClient)

  createDecorationTypes()
  setupSemanticDecorating(context)
  registerCommands(context)

  vscode.languages.getLanguages().then((languages) => {
    log(`Languages: ${languages.join(", ")}`)
  })
}

function registerCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "linenGlow.createSuperpowerLauncher",
      createSuperpowerLauncher,
    ),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("linenGlow.toggleCDP", async () => {
      try {
        await superpowerClient?.toggle()
        if (superpowerClient?.isConnected) {
          vscode.window.showInformationMessage("$(zap) Superpower activated!")
        }
      } catch (err) {
        handleSuperpowerError(err)
      }
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("linenGlow.testCDP", async () => {
      if (!superpowerClient) return

      try {
        const info = await superpowerClient.run((r) => ({
          title: r.document.title,
          windowId: r.vscode.context.configuration()?.windowId,
          platform: r.vscode.process.platform,
          electron: r.vscode.process.versions.electron,
          editorGroups: r.document.querySelectorAll(".editor-group-container")
            .length,
        }))

        log(`CDP info: ${JSON.stringify(info, null, 2)}`)
        vscode.window.showInformationMessage(
          `Window: ${info.title} | Platform: ${info.platform} | Electron: ${info.electron} | Editor Groups: ${info.editorGroups}`,
        )
      } catch (err) {
        handleSuperpowerError(err)
      }
    }),
  )

  // Example command showing service access
  context.subscriptions.push(
    vscode.commands.registerCommand("linenGlow.showServices", async () => {
      if (!superpowerClient) return

      try {
        const hasService = await superpowerClient.run(
          (g) => "instantiationService" in g,
        )

        if (hasService) {
          vscode.window.showInformationMessage(
            "VS Code instantiationService is available!",
          )
          log("instantiationService is cached and available")
        } else {
          vscode.window.showWarningMessage(
            "instantiationService not yet extracted. Connect via CDP first.",
          )
        }
      } catch (err) {
        handleSuperpowerError(err)
      }
    }),
  )
}

async function handleSuperpowerError(err: unknown) {
  if (err instanceof SuperpowerConnectionError) {
    log(`Superpower error: ${err.message}`)
    const action = err.launcherExists ? "Open Applications" : "Create Launcher"
    const choice = await vscode.window.showErrorMessage(
      err.suggestion,
      action,
    )
    if (choice === "Create Launcher") {
      vscode.commands.executeCommand("linenGlow.createSuperpowerLauncher")
    } else if (choice === "Open Applications") {
      vscode.env.openExternal(vscode.Uri.file("/Applications"))
    }
  } else {
    const msg = err instanceof Error ? err.message : String(err)
    log(`Superpower error: ${msg}`)
    vscode.window.showErrorMessage(`Superpower error: ${msg}`)
  }
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
    for (const decoration of decorations.values()) {
      editor.setDecorations(decoration, [])
    }
  }
}

export function deactivate() {
  log("Extension deactivating")
  disposeDecorations()
}
