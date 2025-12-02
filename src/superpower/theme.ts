/**
 * Theme manipulation — modify VS Code's TextMate token colorization at runtime.
 */

import type { SuperpowerClient } from "./client"
import type { ITokenColorRule } from "./vscode-renderer"

export type { ITokenColorRule }

/**
 * Get the current theme's token color rules.
 */
export async function getTokenColors(
  client: SuperpowerClient,
): Promise<ITokenColorRule[]> {
  return client.run((g) => {
    const svc = g.instantiationService
    if (!svc) throw new Error("instantiationService not available")

    const themeService = svc.invokeFunction((accessor: any) => {
      const id = { _serviceBrand: undefined, toString: () => "IWorkbenchThemeService" }
      return accessor.get(id)
    })

    return themeService.getColorTheme().tokenColors || []
  })
}

/**
 * Apply token color rules to the current theme.
 * Rules are merged by scope — existing rules with matching scopes are updated,
 * new scopes are appended.
 */
export async function applyTokenColors(
  client: SuperpowerClient,
  rules: ITokenColorRule[],
): Promise<void> {
  await client.run(
    (g, rulesArg: ITokenColorRule[]) => {
      const svc = g.instantiationService
      if (!svc) throw new Error("instantiationService not available")

      const themeService = svc.invokeFunction((accessor: any) => {
        const id = { _serviceBrand: undefined, toString: () => "IWorkbenchThemeService" }
        return accessor.get(id)
      })

      const theme = themeService.getColorTheme()
      theme.tokenColors = theme.tokenColors || []

      for (const rule of rulesArg) {
        const scopeKey = Array.isArray(rule.scope)
          ? rule.scope.join(",")
          : rule.scope

        const idx = theme.tokenColors.findIndex((r: any) => {
          const rScope = Array.isArray(r.scope) ? r.scope.join(",") : r.scope
          return rScope === scopeKey
        })

        if (idx >= 0) {
          theme.tokenColors[idx] = {
            ...theme.tokenColors[idx],
            settings: { ...theme.tokenColors[idx].settings, ...rule.settings },
          }
        } else {
          theme.tokenColors.push(rule)
        }
      }

      // Trigger theme refresh
      themeService._onColorThemeChange?.fire(theme)
    },
    rules,
  )
}

/**
 * Replace all token colors in the current theme.
 */
export async function setTokenColors(
  client: SuperpowerClient,
  rules: ITokenColorRule[],
): Promise<void> {
  await client.run(
    (g, rulesArg: ITokenColorRule[]) => {
      const svc = g.instantiationService
      if (!svc) throw new Error("instantiationService not available")

      const themeService = svc.invokeFunction((accessor: any) => {
        const id = { _serviceBrand: undefined, toString: () => "IWorkbenchThemeService" }
        return accessor.get(id)
      })

      const theme = themeService.getColorTheme()
      theme.tokenColors = rulesArg
      themeService._onColorThemeChange?.fire(theme)
    },
    rules,
  )
}

/**
 * Inject CSS into the editor. Useful for token styling that TextMate rules
 * can't do (backgrounds, shadows, etc). Targets Monaco's .mtk* classes.
 *
 * The CSS is placed in a <style id="superpower-token-styles"> element.
 * Call with empty string to remove.
 */
export async function injectCSS(
  client: SuperpowerClient,
  css: string,
): Promise<void> {
  await client.run(
    (g, cssArg: string) => {
      const id = "superpower-token-styles"
      let el = g.document.getElementById(id)

      if (!cssArg) {
        el?.remove()
        return
      }

      if (!el) {
        el = g.document.createElement("style")
        el.id = id
        g.document.head.appendChild(el)
      }
      el.textContent = cssArg
    },
    css,
  )
}
