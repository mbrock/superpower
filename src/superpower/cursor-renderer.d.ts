/**
 * Type definitions for the Cursor/VS Code renderer context
 *
 * Use with CDP.connect() to get a typed client:
 *
 * @example
 * ```ts
 * import { CDP } from "./cdp"
 * import type { CursorRenderer } from "./cursor-renderer"
 *
 * const cursor = await CDP.connect<CursorRenderer>(
 *   t => t.url.includes("workbench.html")
 * )
 *
 * await cursor.run((r) => ({
 *   title: r.document.title,
 *   platform: r.vscode.process.platform,
 * }))
 * ```
 */

import type * as Monaco from "monaco-editor"

// ============================================================================
// Electron types
// ============================================================================

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

// ============================================================================
// VS Code Sandbox API
// ============================================================================

interface VSCodeIpcRenderer {
  send(channel: string, ...args: unknown[]): void
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
  on(
    channel: string,
    listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void
  ): VSCodeIpcRenderer
  once(
    channel: string,
    listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void
  ): VSCodeIpcRenderer
  removeListener(
    channel: string,
    listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void
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

// ============================================================================
// Monaco API
// ============================================================================

export type MonacoEditorAPI = typeof Monaco

// ============================================================================
// Main export: CursorRenderer
// ============================================================================

/**
 * The Cursor/VS Code renderer's global scope.
 * Use as the type parameter for CDP.connect<CursorRenderer>()
 */
export interface CursorRenderer {
  // DOM
  document: Document
  window: Window
  location: Location
  navigator: Navigator
  localStorage: Storage
  sessionStorage: Storage

  // VS Code / Cursor specific
  vscode: VSCodeSandboxGlobals
  monaco?: MonacoEditorAPI

  // Monaco bootstrap
  MonacoPerformanceMarks: {
    mark(name: string): void
    getMarks(): PerformanceEntry[]
  }
  MonacoBootstrapWindow: {
    load(
      modulePaths: string[],
      resultCallback: (result: unknown) => void,
      options?: { forceEnableDeveloperKeybindings?: boolean }
    ): void
  }

  // NLS
  _VSCODE_NLS_MESSAGES: string[]
  _VSCODE_NLS_LANGUAGE: string | undefined
  _VSCODE_FILE_ROOT: string

  // Superpower: extracted service container
  __superpower__: any

  // Cursor extras
  _CURSOR_SENTRY: unknown
  __STATSIG__: {
    instance: unknown
    SDK_VERSION: string
    instances: unknown[]
  }
  mermaid: {
    render(
      id: string,
      text: string,
      container?: Element
    ): Promise<{ svg: string }>
    parse(text: string): Promise<boolean>
    initialize(config: Record<string, unknown>): void
  }

  // Standard globals
  globalThis: CursorRenderer
  setTimeout: typeof setTimeout
  setInterval: typeof setInterval
  clearTimeout: typeof clearTimeout
  clearInterval: typeof clearInterval
  fetch: typeof fetch
  console: Console
  JSON: JSON
  Math: Math
  Date: DateConstructor
  Array: ArrayConstructor
  Object: ObjectConstructor
  Promise: PromiseConstructor
  Map: MapConstructor
  Set: SetConstructor
  WeakMap: WeakMapConstructor
  WeakSet: WeakSetConstructor
  Proxy: ProxyConstructor
  Reflect: typeof Reflect
  Symbol: SymbolConstructor
  Error: ErrorConstructor
  RegExp: RegExpConstructor
  Number: NumberConstructor
  String: StringConstructor
  Boolean: BooleanConstructor
  BigInt: BigIntConstructor
  Intl: typeof Intl
  atob: typeof atob
  btoa: typeof btoa
  queueMicrotask: typeof queueMicrotask
  requestAnimationFrame: typeof requestAnimationFrame
  cancelAnimationFrame: typeof cancelAnimationFrame
  requestIdleCallback: typeof requestIdleCallback
  cancelIdleCallback: typeof cancelIdleCallback
  getComputedStyle: typeof getComputedStyle
  matchMedia: typeof matchMedia
  performance: Performance
  crypto: Crypto
  indexedDB: IDBFactory
  URL: typeof URL
  URLSearchParams: typeof URLSearchParams
  Blob: typeof Blob
  File: typeof File
  FileReader: typeof FileReader
  FormData: typeof FormData
  Headers: typeof Headers
  Request: typeof Request
  Response: typeof Response
  WebSocket: typeof WebSocket
  Worker: typeof Worker
  MessageChannel: typeof MessageChannel
  MessagePort: typeof MessagePort
  TextEncoder: typeof TextEncoder
  TextDecoder: typeof TextDecoder
  MutationObserver: typeof MutationObserver
  ResizeObserver: typeof ResizeObserver
  IntersectionObserver: typeof IntersectionObserver
}

// ============================================================================
// Usage
// ============================================================================

/**
 * To connect to the Cursor workbench:
 *
 * ```ts
 * import { CDP } from "./cdp"
 * import type { CursorRenderer } from "./cursor-renderer"
 *
 * const cursor = await CDP.connect<CursorRenderer>(
 *   t => t.url.includes("workbench.html")
 * )
 *
 * await cursor.run(r => r.document.title)
 * ```
 */
