/**
 * CDP (Chrome DevTools Protocol) client
 *
 * @example
 * ```ts
 * const client = await CDP.connect(t => t.url.includes("myapp"))
 * const title = await client.run((g) => g.document.title)
 * client.close()
 * ```
 */

const DEFAULT_HOST = "localhost"
const DEFAULT_PORT = 9222

// ============================================================================
// Types
// ============================================================================

export interface CDPTarget {
  id: string
  title: string
  type: string
  url: string
  webSocketDebuggerUrl: string
}

interface CDPMessage {
  id?: number
  method?: string
  params?: unknown
  error?: { message: string }
  result?: unknown
}

interface EvalResult {
  result?: { value: unknown; objectId?: string; type: string; className?: string; description?: string }
  exceptionDetails?: { text: string; exception?: { description: string } }
}

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

type EventHandler = (params: unknown) => void

// ============================================================================
// Debugger Types
// ============================================================================

export interface RemoteObject {
  type: "object" | "function" | "undefined" | "string" | "number" | "boolean" | "symbol" | "bigint"
  subtype?: string
  className?: string
  value?: unknown
  description?: string
  objectId?: string
}

export interface Scope {
  type: string
  object: RemoteObject
  name?: string
}

export interface CallFrame {
  callFrameId: string
  functionName: string
  location: { scriptId: string; lineNumber: number; columnNumber: number }
  url: string
  scopeChain: Scope[]
  this: RemoteObject
}

export interface PausedEvent {
  callFrames: CallFrame[]
  reason: string
  data?: unknown
}

export interface PropertyDescriptor {
  name: string
  value?: RemoteObject
  configurable: boolean
  enumerable: boolean
}

// ============================================================================
// Low-level functions
// ============================================================================

/** Get list of debuggable targets */
export async function getTargets(
  host = DEFAULT_HOST,
  port = DEFAULT_PORT
): Promise<CDPTarget[]> {
  const res = await fetch(`http://${host}:${port}/json/list`)
  return res.json()
}

/** Find a target by predicate */
export async function findTarget(
  predicate: (target: CDPTarget) => boolean,
  host = DEFAULT_HOST,
  port = DEFAULT_PORT
): Promise<CDPTarget | undefined> {
  const targets = await getTargets(host, port)
  return targets.find(predicate)
}

// ============================================================================
// CDP Client class
// ============================================================================

export interface CDPOptions {
  host?: string
  port?: number
}

/**
 * CDP client with persistent WebSocket connection
 */
export class CDP<TRemote = typeof globalThis> {
  private ws: WebSocket
  private nextId = 1
  private pending = new Map<number, PendingRequest>()
  private eventHandlers = new Map<string, EventHandler[]>()
  private ready: Promise<void>

  private constructor(
    public readonly target: CDPTarget,
    ws: WebSocket,
  ) {
    this.ws = ws

    // Set up message handler
    this.ws.onmessage = (event) => {
      const data: CDPMessage = JSON.parse(event.data.toString())

      // Handle responses to our requests
      if (data.id !== undefined) {
        const request = this.pending.get(data.id)
        if (request) {
          this.pending.delete(data.id)
          if (data.error) {
            request.reject(new Error(data.error.message))
          } else {
            request.resolve(data.result)
          }
        }
      }

      // Handle events from the browser
      if (data.method) {
        const handlers = this.eventHandlers.get(data.method)
        if (handlers) {
          for (const handler of handlers) {
            handler(data.params)
          }
        }
      }
    }

    this.ws.onerror = () => {
      // Reject all pending requests
      for (const request of this.pending.values()) {
        request.reject(new Error("WebSocket error"))
      }
      this.pending.clear()
    }

    // Wait for connection to be ready
    this.ready = new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) {
        resolve()
      } else {
        this.ws.onopen = () => resolve()
        this.ws.onerror = () => reject(new Error("Failed to connect"))
      }
    })
  }

  /** Connect to a target matching a predicate */
  static async connect<T = typeof globalThis>(
    predicate: (target: CDPTarget) => boolean,
    options: CDPOptions = {}
  ): Promise<CDP<T>> {
    const { host = DEFAULT_HOST, port = DEFAULT_PORT } = options
    const target = await findTarget(predicate, host, port)
    if (!target) {
      throw new Error(`No matching CDP target found at ${host}:${port}`)
    }

    const ws = new WebSocket(target.webSocketDebuggerUrl)
    const client = new CDP<T>(target, ws)
    await client.ready
    return client
  }

  /** Connect to the first page target */
  static async connectPage<T = typeof globalThis>(
    options: CDPOptions = {}
  ): Promise<CDP<T>> {
    return CDP.connect<T>((t) => t.type === "page", options)
  }

  // ============================================================================
  // Core methods
  // ============================================================================

  /** Send a CDP command */
  send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  /** Subscribe to a CDP event */
  on(event: string, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)!.push(handler)
    return () => {
      const handlers = this.eventHandlers.get(event)
      if (handlers) {
        const idx = handlers.indexOf(handler)
        if (idx !== -1) handlers.splice(idx, 1)
      }
    }
  }

  /** Wait for a CDP event once */
  once<T = unknown>(event: string, timeout = 5000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe()
        reject(new Error(`Timeout waiting for ${event}`))
      }, timeout)
      const unsubscribe = this.on(event, (params) => {
        clearTimeout(timer)
        unsubscribe()
        resolve(params as T)
      })
    })
  }

  /** Close the WebSocket connection */
  close(): void {
    this.ws.close()
    for (const request of this.pending.values()) {
      request.reject(new Error("Connection closed"))
    }
    this.pending.clear()
  }

  /** Check if connected */
  get connected(): boolean {
    return this.ws.readyState === WebSocket.OPEN
  }

  // ============================================================================
  // Runtime domain
  // ============================================================================

  /** Evaluate a raw JS expression */
  async eval<T = unknown>(expression: string): Promise<T> {
    const result = await this.send<EvalResult>("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (result.exceptionDetails) {
      const d = result.exceptionDetails
      throw new Error(d.exception?.description || d.text)
    }
    return result.result?.value as T
  }

  /**
   * Run a function in the remote context.
   * The function receives `globalThis` as its first argument.
   */
  async run<T, A extends unknown[]>(
    fn: (remote: TRemote, ...args: A) => T,
    ...args: A
  ): Promise<Awaited<T>> {
    const serializedArgs = JSON.stringify(args)
    const expression = `(${fn.toString()}).apply(null, [globalThis, ...${serializedArgs}])`
    return this.eval<Awaited<T>>(expression)
  }

  /** Get properties of a remote object */
  async getProperties(
    objectId: string,
    options: { ownProperties?: boolean; includeInternal?: boolean } = {},
  ): Promise<{ result: PropertyDescriptor[]; internalProperties?: PropertyDescriptor[] }> {
    const result = await this.send<{
      result: PropertyDescriptor[]
      internalProperties?: PropertyDescriptor[]
    }>("Runtime.getProperties", {
      objectId,
      ownProperties: options.ownProperties ?? true,
      generatePreview: true,
    })
    return { result: result.result, internalProperties: result.internalProperties }
  }

  // ============================================================================
  // Debugger domain
  // ============================================================================

  /** Enable the Debugger domain */
  async debuggerEnable(): Promise<void> {
    await this.send("Debugger.enable")
  }

  /** Pause execution */
  async debuggerPause(): Promise<void> {
    await this.send("Debugger.pause")
  }

  /** Resume execution */
  async debuggerResume(): Promise<void> {
    await this.send("Debugger.resume")
  }

  /** Wait for pause and get call frames */
  async waitForPause(timeout = 5000): Promise<PausedEvent> {
    return this.once<PausedEvent>("Debugger.paused", timeout)
  }

  /** Evaluate expression on a specific call frame */
  async evalOnFrame<T = unknown>(callFrameId: string, expression: string): Promise<T> {
    const result = await this.send<EvalResult>("Debugger.evaluateOnCallFrame", {
      callFrameId,
      expression,
      returnByValue: true,
    })
    if (result.exceptionDetails) {
      const d = result.exceptionDetails
      throw new Error(d.exception?.description || d.text)
    }
    return result.result?.value as T
  }

  /**
   * Run a function on a specific call frame.
   * The function receives `this` from that frame as its first argument.
   */
  async runOnFrame<T, A extends unknown[]>(
    callFrameId: string,
    fn: (frameThis: unknown, ...args: A) => T,
    ...args: A
  ): Promise<Awaited<T>> {
    const serializedArgs = JSON.stringify(args)
    const expression = `(${fn.toString()}).apply(null, [this, ...${serializedArgs}])`
    return this.evalOnFrame<Awaited<T>>(callFrameId, expression)
  }
}

// ============================================================================
// CLI
// ============================================================================

if (import.meta.main) {
  const [cmd, ...rest] = Bun.argv.slice(2)
  const arg = rest.join(" ")

  const commands: Record<string, () => Promise<void>> = {
    async list() {
      const targets = await getTargets()
      for (const t of targets) {
        const icon =
          t.type === "page" ? "📄" : t.type === "worker" ? "⚙️" : "❓"
        console.log(`${icon} ${t.type.padEnd(8)} ${t.title}`)
        console.log(`   ${t.url}`)
      }
    },

    async eval() {
      const client = await CDP.connectPage()
      try {
        const result = await client.eval(arg)
        if (result !== undefined) {
          console.log(
            typeof result === "object" ? JSON.stringify(result, null, 2) : result
          )
        }
      } finally {
        client.close()
      }
    },

    async repl() {
      const client = await CDP.connectPage()
      console.log(`Connected to: ${client.target.title}`)
      console.log("Type JS to evaluate. Ctrl+D to exit.\n")

      const prompt = "\x1b[36m❯\x1b[0m "
      process.stdout.write(prompt)

      try {
        for await (const line of console) {
          if (line.trim()) {
            try {
              const result = await client.eval(line)
              if (result !== undefined) {
                console.log(
                  typeof result === "object"
                    ? JSON.stringify(result, null, 2)
                    : result
                )
              }
            } catch (e) {
              console.error(
                "\x1b[31m" + (e instanceof Error ? e.message : e) + "\x1b[0m"
              )
            }
          }
          process.stdout.write(prompt)
        }
      } finally {
        client.close()
      }
    },

    async help() {
      console.log(`
\x1b[1mCDP - Chrome DevTools Protocol client\x1b[0m

\x1b[33mCLI:\x1b[0m
  bun cdp.ts list              List CDP targets
  bun cdp.ts eval <expr>       Evaluate JS in first page
  bun cdp.ts repl              Interactive REPL

\x1b[33mAPI:\x1b[0m
  import { CDP } from "./cdp"

  const client = await CDP.connect(t => t.url.includes("myapp"))
  await client.run((g) => g.document.title)
  await client.run((g, msg) => g.console.log(msg), "Hello!")
  client.close()

\x1b[90mTarget must have remote debugging enabled (--remote-debugging-port=9222)\x1b[0m
`)
    },
  }

  commands.ls = commands.list
  commands.e = commands.eval

  await (commands[cmd] || commands.help)()
}
