/**
 * CDP (Chrome DevTools Protocol) client
 */

const DEFAULT_HOST = "localhost"
const DEFAULT_PORT = 9222

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
  result?: { value: unknown; objectId?: string; type: string }
  exceptionDetails?: { text: string; exception?: { description: string } }
}

type PendingRequest = { resolve: (value: unknown) => void; reject: (error: Error) => void }
type EventHandler = (params: unknown) => void

export interface PausedEvent {
  callFrames: { callFrameId: string; functionName: string }[]
  reason: string
}

export async function getTargets(host = DEFAULT_HOST, port = DEFAULT_PORT): Promise<CDPTarget[]> {
  return (await fetch(`http://${host}:${port}/json/list`)).json()
}

export class CDP<TRemote = typeof globalThis> {
  private ws: WebSocket
  private nextId = 1
  private pending = new Map<number, PendingRequest>()
  private events = new Map<string, EventHandler[]>()
  private ready: Promise<void>

  private constructor(public readonly target: CDPTarget, ws: WebSocket) {
    this.ws = ws
    this.ws.onmessage = (e) => {
      const msg: CDPMessage = JSON.parse(e.data.toString())
      if (msg.id !== undefined) {
        const req = this.pending.get(msg.id)
        if (req) {
          this.pending.delete(msg.id)
          msg.error ? req.reject(new Error(msg.error.message)) : req.resolve(msg.result)
        }
      }
      if (msg.method) {
        for (const h of this.events.get(msg.method) || []) h(msg.params)
      }
    }
    this.ws.onerror = () => {
      for (const r of this.pending.values()) r.reject(new Error("WebSocket error"))
      this.pending.clear()
    }
    this.ready = new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) resolve()
      else { this.ws.onopen = () => resolve(); this.ws.onerror = () => reject(new Error("Failed to connect")) }
    })
  }

  static async connect<T = typeof globalThis>(predicate: (t: CDPTarget) => boolean, host = DEFAULT_HOST, port = DEFAULT_PORT): Promise<CDP<T>> {
    const targets = await getTargets(host, port)
    const target = targets.find(predicate)
    if (!target) throw new Error(`No matching target at ${host}:${port}`)
    const client = new CDP<T>(target, new WebSocket(target.webSocketDebuggerUrl))
    await client.ready
    return client
  }

  send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  on(event: string, handler: EventHandler): () => void {
    if (!this.events.has(event)) this.events.set(event, [])
    this.events.get(event)!.push(handler)
    return () => {
      const handlers = this.events.get(event)
      if (handlers) {
        const i = handlers.indexOf(handler)
        if (i !== -1) handlers.splice(i, 1)
      }
    }
  }

  once<T = unknown>(event: string, timeout = 5000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { unsub(); reject(new Error(`Timeout: ${event}`)) }, timeout)
      const unsub = this.on(event, (p) => { clearTimeout(timer); unsub(); resolve(p as T) })
    })
  }

  close() {
    this.ws.close()
    for (const r of this.pending.values()) r.reject(new Error("Connection closed"))
    this.pending.clear()
  }

  async eval<T = unknown>(expression: string): Promise<T> {
    const r = await this.send<EvalResult>("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
    return r.result?.value as T
  }

  async run<T, A extends unknown[]>(fn: (g: TRemote, ...args: A) => T, ...args: A): Promise<Awaited<T>> {
    return this.eval(`(${fn.toString()}).apply(null, [globalThis, ...${JSON.stringify(args)}])`)
  }

  async enableDebugger() { await this.send("Runtime.enable"); await this.send("Debugger.enable") }
  async resume() { await this.send("Debugger.resume") }
  async waitForPause(timeout = 5000) { return this.once<PausedEvent>("Debugger.paused", timeout) }

  async evalOnFrame(frameId: string, expression: string, returnByValue = true) {
    const r = await this.send<EvalResult>("Debugger.evaluateOnCallFrame", { callFrameId: frameId, expression, returnByValue })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
    return r.result?.value
  }

  async runOnFrame<T, A extends unknown[]>(frameId: string, fn: (g: TRemote, frameThis: unknown, ...args: A) => T, ...args: A): Promise<Awaited<T>> {
    return this.evalOnFrame(frameId, `(${fn.toString()}).apply(null, [globalThis, this, ...${JSON.stringify(args)}])`) as Promise<Awaited<T>>
  }

  async getObjectId<T>(fn: (g: TRemote) => T): Promise<string> {
    const r = await this.send<EvalResult>("Runtime.evaluate", {
      expression: `(${fn.toString()})(globalThis)`,
      returnByValue: false,
    })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
    return r.result?.objectId!
  }
}

if (import.meta.main) {
  const [cmd, ...rest] = Bun.argv.slice(2)
  const arg = rest.join(" ")

  if (cmd === "list" || cmd === "ls") {
    for (const t of await getTargets()) console.log(`[${t.type}] ${t.title}\n  ${t.url}`)
  } else if (cmd === "eval" || cmd === "e") {
    const c = await CDP.connect((t) => t.type === "page")
    try { const r = await c.eval(arg); if (r !== undefined) console.log(typeof r === "object" ? JSON.stringify(r, null, 2) : r) }
    finally { c.close() }
  } else if (cmd === "repl") {
    const c = await CDP.connect((t) => t.type === "page")
    console.log(`Connected: ${c.target.title}\n`)
    process.stdout.write("> ")
    for await (const line of console) {
      if (line.trim()) try { const r = await c.eval(line); if (r !== undefined) console.log(typeof r === "object" ? JSON.stringify(r, null, 2) : r) } catch (e) { console.error(e instanceof Error ? e.message : e) }
      process.stdout.write("> ")
    }
    c.close()
  } else {
    console.log("CDP client\n  bun cdp.ts list|eval <expr>|repl")
  }
}
