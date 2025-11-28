import * as vscode from "vscode";
import { tokenStyles } from "./tokenStyles";

export async function getSemanticTokenRanges(
  document: vscode.TextDocument): Promise<Map<string, vscode.Range[]> | null> {
  try {
    const legend = await vscode.commands.executeCommand<vscode.SemanticTokensLegend>(
      "vscode.provideDocumentSemanticTokensLegend",
      document.uri
    );
    if (!legend) return null;

    const tokens = await vscode.commands.executeCommand<vscode.SemanticTokens>(
      "vscode.provideDocumentSemanticTokens",
      document.uri
    );
    if (!tokens) return null;

    const result = new Map<string, vscode.Range[]>();

    // Initialize arrays for token types we care about
    for (const tokenType of Object.keys(tokenStyles)) {
      result.set(tokenType, []);
    }

    // Decode semantic tokens (delta-encoded)
    let line = 0;
    let char = 0;

    for (let i = 0; i < tokens.data.length; i += 5) {
      const deltaLine = tokens.data[i];
      const deltaChar = tokens.data[i + 1];
      const length = tokens.data[i + 2];
      const tokenTypeIndex = tokens.data[i + 3];
      // const tokenModifiersBitset = tokens.data[i + 4]; // available if needed
      if (deltaLine > 0) {
        line += deltaLine;
        char = deltaChar;
      } else {
        char += deltaChar;
      }

      const tokenType = legend.tokenTypes[tokenTypeIndex];
      const ranges = result.get(tokenType);
      if (ranges) {
        ranges.push(new vscode.Range(line, char, line, char + length));
      }
    }

    return result;
  } catch (e) {
    return null;
  }
}
