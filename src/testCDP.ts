import * as vscode from "vscode";
import { log } from "./extension";
import { CDP } from "./superpower/cdp";
import type { CursorRenderer } from "./superpower/cursor-renderer";

export async function testCDP() {
  try {
    log("Connecting to CDP...");

    // Connect to the Cursor workbench with full typing
    const cursor = await CDP.connect<CursorRenderer>(
      (t) => t.url.includes("workbench.html")
    );
    log(`Connected to: ${cursor.target.title}`);

    // Run a typed function - `r` is the remote globalThis
    const info = await cursor.run((r) => ({
      title: r.document.title,
      windowId: r.vscode.context.configuration()?.windowId,
      platform: r.vscode.process.platform,
      editorGroups: r.document.querySelectorAll(".editor-group-container").length,
    }));

    log(`CDP info: ${JSON.stringify(info, null, 2)}`);
    vscode.window.showInformationMessage(
      `CDP connected! Window: ${info.title}, Groups: ${info.editorGroups}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`CDP error: ${msg}`);
    vscode.window.showErrorMessage(`CDP failed: ${msg}`);
  }
}
