import type * as Monaco from "monaco-editor"

// TextMate token color rule
export interface ITokenColorRule {
  name?: string
  scope?: string | string[]
  settings: {
    foreground?: string
    background?: string
    fontStyle?: string
  }
}

declare namespace Electron {
  interface IpcRendererEvent {
    sender: unknown
    senderId: number
    ports: MessagePort[]
  }

  interface ProcessMemoryInfo {
    private: number
    shared: number
  }
}

interface VSCodeIpcRenderer {
  send(channel: string, ...args: unknown[]): void

  invoke(channel: string, ...args: unknown[]): Promise<unknown>

  on(
    channel: string,
    listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void,
  ): VSCodeIpcRenderer

  once(
    channel: string,
    listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void,
  ): VSCodeIpcRenderer

  removeListener(
    channel: string,
    listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void,
  ): VSCodeIpcRenderer
}

export interface VSCodeSandboxGlobals {
  ipcRenderer: VSCodeIpcRenderer

  ipcMessagePort: {
    acquire(responseChannel: string, nonce: string): void
  }

  webFrame: {
    setZoomLevel(level: number): void
  }

  webUtils: {
    getPathForFile(file: File): string
  }

  process: {
    readonly platform: NodeJS.Platform
    readonly arch: string
    readonly env: NodeJS.ProcessEnv
    readonly versions: NodeJS.ProcessVersions & {
      electron: string
      chrome: string
    }
    readonly type: "renderer"
    readonly execPath: string
    cwd(): string
    shellEnv(): Promise<NodeJS.ProcessEnv>
    getProcessMemoryInfo(): Promise<Electron.ProcessMemoryInfo>
    on(type: string, callback: (...args: unknown[]) => void): void
  }

  context: {
    configuration(): ISandboxConfiguration | undefined
    resolveConfiguration(): Promise<ISandboxConfiguration>
  }
}

export interface ISandboxConfiguration {
  windowId: number
  appRoot: string
  userEnv: NodeJS.ProcessEnv
  product: IProductConfiguration
  zoomLevel?: number
  codeCachePath?: string
  nls: {
    messages: string[]
    language: string | undefined
  }
  cssModules?: string[]
  logsPath?: string
  machineId?: string
  mainPid?: number
  execPath?: string
  backupPath?: string
  homeDir?: string
  tmpDir?: string
  userDataDir?: string
  remoteAuthority?: string
  logLevel?: string
  isInitialStartup?: boolean
  fullscreen?: boolean
  maximized?: boolean
}

export interface IProductConfiguration {
  readonly version: string
  readonly date?: string
  readonly quality?: string
  readonly commit?: string
  readonly nameShort: string
  readonly nameLong: string
  readonly applicationName: string
  readonly urlProtocol: string
  readonly dataFolderName: string
  readonly serverApplicationName: string
  readonly darwinBundleIdentifier?: string
  readonly extensionsGallery?: {
    readonly serviceUrl: string
    readonly controlUrl: string
    readonly extensionUrlTemplate: string
    readonly resourceUrlTemplate: string
    readonly nlsBaseUrl: string
  }
  readonly enableTelemetry?: boolean
  readonly reportIssueUrl?: string
  readonly downloadUrl?: string
  readonly updateUrl?: string
  readonly releaseNotesUrl?: string
}

export type MonacoEditorAPI = typeof Monaco

export interface VSCodeRenderer extends Window {
  vscode: VSCodeSandboxGlobals

  instantiationService: any

  mermaid: {
    render(
      id: string,
      text: string,
      container?: Element,
    ): Promise<{ svg: string }>
    parse(text: string): Promise<boolean>
    initialize(config: Record<string, unknown>): void
  }

  globalThis: VSCodeRenderer
}
