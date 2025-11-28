/**
 * Superpower - VS Code CDP integration
 *
 * Two usage patterns:
 *
 * 1. VS Code Extension (with lifecycle management):
 *    import { SuperpowerClient } from "./superpower/client"
 *    const client = new SuperpowerClient(outputChannel)
 *    await client.connect()
 *    await client.run(g => g.document.title)
 *
 * 2. Standalone Bun Scripts (simpler API):
 *    import { getServices } from "./superpower/services"
 *    const svc = await getServices()
 *    await svc.run(g => g.document.title)
 *    svc.close()
 */

// VS Code extension client with lifecycle management
export {
  SuperpowerClient,
  SuperpowerConnectionError,
  type ConnectionStatus,
} from "./client"

// Standalone/CLI utilities
export { getServices } from "./services"
export { CDP, getTargets, type CDPTarget, type PausedEvent } from "./cdp"

// Types
export type { VSCodeRenderer } from "./vscode-renderer"

