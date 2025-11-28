/**
 * SuperpowerClient - Manages CDP connection to VS Code's renderer process.
 *
 * Provides access to VS Code internals via Chrome DevTools Protocol:
 * - Run typed functions in the renderer context
 * - Extract and cache VS Code's instantiationService
 * - Connection lifecycle management with status events
 */

import * as vscode from "vscode"
import * as fs from "node:fs"
import { CDP } from "./cdp"
import type { VSCodeRenderer } from "./vscode-renderer"

export type ConnectionStatus = "disconnected" | "connecting" | "connected"

const LAUNCHER_PATH = "/Applications/Cursor CDP.app"

export class SuperpowerConnectionError extends Error {
  constructor(
    message: string,
    public readonly launcherExists: boolean,
  ) {
    super(message)
    this.name = "SuperpowerConnectionError"
  }

  get suggestion(): string {
    if (this.launcherExists) {
      return "Launch 'Cursor CDP' from Applications to enable superpower mode."
    }
    return "Run 'Create Superpower Launcher' command first, then launch 'Cursor CDP' from Applications."
  }
}

export class SuperpowerClient implements vscode.Disposable {
  private cdp: CDP<VSCodeRenderer> | null = null
  private statusBar: vscode.StatusBarItem
  private _status: ConnectionStatus = "disconnected"
  private _onStatusChange = new vscode.EventEmitter<ConnectionStatus>()
  private disposables: vscode.Disposable[] = []

  readonly onStatusChange = this._onStatusChange.event

  constructor(private outputChannel: vscode.OutputChannel) {
    this.statusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    )
    this.statusBar.command = "linenGlow.toggleCDP"
    this.disposables.push(this.statusBar, this._onStatusChange)
    this.updateStatus("disconnected")
  }

  get status(): ConnectionStatus {
    return this._status
  }

  get isConnected(): boolean {
    return this.cdp !== null && this._status === "connected"
  }

  /**
   * Connect to VS Code's renderer process via CDP.
   * Automatically extracts and caches the instantiationService.
   */
  async connect(): Promise<void> {
    if (this.isConnected) return

    this.updateStatus("connecting")
    this.log("Connecting to CDP...")

    try {
      this.cdp = await CDP.connect<VSCodeRenderer>((t) =>
        t.url.includes("workbench.html"),
      )
      this.log(`Connected to: ${this.cdp.target.title}`)

      // Check if services already extracted, if not do it
      const hasServices = await this.cdp.run((g) => "instantiationService" in g)
      if (!hasServices) {
        this.log("Extracting VS Code services...")
        await this.extractServices()
        this.log("Services extracted successfully")
      } else {
        this.log("Services already available")
      }

      this.updateStatus("connected")
    } catch (err) {
      this.cdp = null
      this.updateStatus("disconnected")
      const msg = err instanceof Error ? err.message : String(err)
      this.log(`Connection failed: ${msg}`)
      throw new SuperpowerConnectionError(msg, this.launcherExists())
    }
  }

  /**
   * Check if the CDP launcher app exists.
   */
  launcherExists(): boolean {
    try {
      return fs.existsSync(LAUNCHER_PATH)
    } catch {
      return false
    }
  }

  /**
   * Disconnect from CDP.
   */
  disconnect(): void {
    if (this.cdp) {
      this.cdp.close()
      this.cdp = null
      this.log("Disconnected from CDP")
    }
    this.updateStatus("disconnected")
  }

  /**
   * Toggle connection state.
   */
  async toggle(): Promise<void> {
    if (this.isConnected) {
      this.disconnect()
    } else {
      await this.connect()
    }
  }

  /**
   * Run a typed function in the VS Code renderer context.
   * Auto-connects if not already connected.
   */
  async run<T, A extends unknown[]>(
    fn: (g: VSCodeRenderer, ...args: A) => T,
    ...args: A
  ): Promise<Awaited<T>> {
    if (!this.cdp) {
      await this.connect()
    }
    return this.cdp!.run(fn, ...args)
  }

  /**
   * Evaluate an expression in the renderer context.
   */
  async eval<T = unknown>(expression: string): Promise<T> {
    if (!this.cdp) {
      await this.connect()
    }
    return this.cdp!.eval<T>(expression)
  }

  /**
   * Get the raw CDP client for advanced usage.
   */
  get raw(): CDP<VSCodeRenderer> | null {
    return this.cdp
  }

  /**
   * Extract VS Code's internal instantiationService by setting a breakpoint
   * on an event listener and capturing `this`.
   */
  private async extractServices(): Promise<void> {
    if (!this.cdp) throw new Error("Not connected")

    await this.cdp.DOM.enable()
    await this.cdp.Runtime.enable()
    await this.cdp.Debugger.enable()

    const docId = await this.cdp.getObjectId((g) => g.document)
    const listeners = await this.cdp.DOMDebugger.getEventListeners(docId)

    const target = listeners.find((l) => l.type === "mouseout")
    if (!target) throw new Error("No mouseout listener found")

    const breakpointId = await this.cdp.Debugger.setBreakpoint(
      target.scriptId,
      target.lineNumber,
      target.columnNumber,
    )

    try {
      // Trigger the mouseout event
      await this.cdp.run((g) => {
        setTimeout(
          () =>
            g.document.dispatchEvent(
              new MouseEvent("mouseout", { bubbles: true }),
            ),
          50,
        )
      })

      // Wait for breakpoint hit and extract service from call frame
      const { callFrames } = await this.cdp.Debugger.waitForPause()
      await this.cdp.runOnFrame(
        callFrames[0].callFrameId,
        (g, frameThis: { instantiationService: unknown }) => {
          g.instantiationService = frameThis.instantiationService
        },
      )
    } finally {
      await this.cdp.Debugger.removeBreakpoint(breakpointId)
      await this.cdp.Debugger.resume()
    }
  }

  private updateStatus(status: ConnectionStatus): void {
    this._status = status
    const display: Record<
      ConnectionStatus,
      { icon: string; label: string; tooltip: string }
    > = {
      connected: {
        icon: "$(zap)",
        label: "Superpower",
        tooltip: "Superpower active — click to disconnect",
      },
      disconnected: {
        icon: "$(plug)",
        label: "Superpower off",
        tooltip: "Click to connect (requires Cursor CDP app)",
      },
      connecting: {
        icon: "$(sync~spin)",
        label: "Connecting...",
        tooltip: "Connecting to Cursor CDP...",
      },
    }
    const { icon, label, tooltip } = display[status]
    this.statusBar.text = `${icon} ${label}`
    this.statusBar.tooltip = tooltip
    this.statusBar.backgroundColor =
      status === "connected"
        ? new vscode.ThemeColor("statusBarItem.warningBackground")
        : undefined
    this.statusBar.show()
    this._onStatusChange.fire(status)
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[CDP] ${message}`)
  }

  dispose(): void {
    this.disconnect()
    for (const d of this.disposables) {
      d.dispose()
    }
  }
}

