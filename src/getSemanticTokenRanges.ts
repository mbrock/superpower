import * as vscode from "vscode"

export async function getSemanticTokenRanges(
  document: vscode.TextDocument,
  tokenTypes: Iterable<string>,
): Promise<Map<string, vscode.Range[]> | null> {
  try {
    const legend =
      await vscode.commands.executeCommand<vscode.SemanticTokensLegend>(
        "vscode.provideDocumentSemanticTokensLegend",
        document.uri,
      )
    if (!legend) return null

    const tokens =
      await vscode.commands.executeCommand<vscode.SemanticTokens>(
        "vscode.provideDocumentSemanticTokens",
        document.uri,
      )
    if (!tokens) return null

    const result = new Map<string, vscode.Range[]>()

    // Initialize arrays for token types we care about
    for (const tokenType of tokenTypes) {
      result.set(tokenType, [])
    }

    // Decode semantic tokens (delta-encoded)
    let line = 0
    let char = 0

    for (let i = 0; i < tokens.data.length; i += 5) {
      const deltaLine = tokens.data[i]
      const deltaChar = tokens.data[i + 1]
      const length = tokens.data[i + 2]
      const tokenTypeIndex = tokens.data[i + 3]
      const tokenModifiersBitset = tokens.data[i + 4]

      if (deltaLine > 0) {
        line += deltaLine
        char = deltaChar
      } else {
        char += deltaChar
      }

      const baseType = legend.tokenTypes[tokenTypeIndex]

      // Build modifier suffixes (e.g., "declaration", "readonly")
      const modifiers: string[] = []
      for (let bit = 0; bit < legend.tokenModifiers.length; bit++) {
        if (tokenModifiersBitset & (1 << bit)) {
          modifiers.push(legend.tokenModifiers[bit])
        }
      }

      // Try to match most specific first: "function.declaration", then "function"
      const range = new vscode.Range(line, char, line, char + length)
      let matched = false

      // Try with each modifier
      for (const mod of modifiers) {
        const key = `${baseType}.${mod}`
        const ranges = result.get(key)
        if (ranges) {
          ranges.push(range)
          matched = true
          break
        }
      }

      // Fall back to base type if no modifier matched
      if (!matched) {
        const ranges = result.get(baseType)
        if (ranges) {
          ranges.push(range)
        }
      }
    }

    return result
  } catch (e) {
    return null
  }
}
