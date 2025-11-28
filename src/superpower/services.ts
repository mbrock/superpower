/**
 * Access VS Code / Cursor internal services via CDP.
 *
 * @example
 * ```ts
 * const svc = await getServices()
 * await svc.run((s) => s.commandService.executeCommand('workbench.action.toggleSidebar'))
 * svc.close()
 * ```
 */

import { CDP } from "./cdp"

const GLOBAL = "__superpower__"

export interface Services {
  run<T, A extends unknown[]>(fn: (services: any, ...args: A) => T, ...args: A): Promise<Awaited<T>>
  close(): void
}

export async function getServices(): Promise<Services> {
  const cdp = await CDP.connect((t) => t.url.includes("workbench.html"))

  try {
    await cdp.cacheFromEvent(GLOBAL, "mouseout")
  } catch (err) {
    cdp.close()
    throw err
  }

  return {
    run: (fn, ...args) => cdp.runWithGlobal(GLOBAL, fn, ...args),
    close: () => cdp.close(),
  }
}
