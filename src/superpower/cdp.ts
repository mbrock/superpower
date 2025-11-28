/**
 * Minimal CDP (Chrome DevTools Protocol) client for injecting into Cursor/VS Code
 *
 * Launch Cursor with: --remote-debugging-port=9222
 * Then use this to inject JS/CSS into the renderer.
 */

const CDP_PORT = 9222

export interface CDPTarget {
  id: string
  title: string
  type: string
  url: string
  webSocketDebuggerUrl: string
}

/** Get list of debuggable targets */
export async function getTargets(): Promise<CDPTarget[]> {
  const res = await fetch(`http://localhost:${CDP_PORT}/json/list`)
  return res.json()
}

/** Find the main workbench window */
export async function findWorkbench(): Promise<CDPTarget | undefined> {
  const targets = await getTargets()
  return targets.find(
    (t) => t.type === "page" && t.url.includes("workbench.html"),
  )
}

/** Evaluate JS in a target */
export async function evaluate(
  wsUrl: string,
  expression: string,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: {
            expression,
            returnByValue: true,
            awaitPromise: true,
          },
        }),
      )
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data.toString())
      if (data.id === 1) {
        ws.close()
        if (data.error) {
          reject(new Error(data.error.message))
        } else if (data.result.exceptionDetails) {
          reject(new Error(data.result.exceptionDetails.text))
        } else {
          resolve(data.result.result?.value)
        }
      }
    }

    ws.onerror = (err) => reject(err)
  })
}

/** Inject CSS into a target */
export async function injectCSS(wsUrl: string, css: string): Promise<void> {
  const escaped = css.replace(/\\/g, "\\\\").replace(/`/g, "\\`")
  await evaluate(
    wsUrl,
    `
    (() => {
      let style = document.getElementById('superpower-css');
      if (!style) {
        style = document.createElement('style');
        style.id = 'superpower-css';
        document.head.appendChild(style);
      }
      style.textContent = \`${escaped}\`;
    })()
  `,
  )
}

/** Inject JS into a target (runs once) */
export async function injectJS(wsUrl: string, code: string): Promise<any> {
  return evaluate(wsUrl, code)
}

/** Bootstrap superpower API in the renderer */
export async function bootstrap(wsUrl: string): Promise<void> {
  await evaluate(
    wsUrl,
    `
    if (!window.superpower) {
      window.superpower = {
        version: '1.0.0',

        injectCSS(id, css) {
          let style = document.getElementById('superpower-' + id);
          if (!style) {
            style = document.createElement('style');
            style.id = 'superpower-' + id;
            document.head.appendChild(style);
          }
          style.textContent = css;
          return style;
        },

        removeCSS(id) {
          document.getElementById('superpower-' + id)?.remove();
        },

        query(selector) {
          return [...document.querySelectorAll(selector)];
        },

        // Access monaco if available
        get monaco() { return window.monaco; },

        // Access VS Code's token styles
        get tokenStyles() {
          return document.querySelector('.vscode-tokens-styles')?.textContent;
        },

        // Get theme CSS variables
        getThemeVars() {
          const el = document.querySelector('.monaco-workbench');
          if (!el) return {};
          const computed = getComputedStyle(el);
          const vars = {};
          for (const prop of computed) {
            if (prop.startsWith('--vscode-')) {
              vars[prop] = computed.getPropertyValue(prop).trim();
            }
          }
          return vars;
        }
      };
      console.log('[Superpower] Bootstrapped!');
    }
    'ok'
  `,
  )
}

// CLI usage
if (import.meta.main) {
  const cmd = Bun.argv[2]

  if (cmd === "list") {
    const targets = await getTargets()
    console.log(JSON.stringify(targets, null, 2))
  } else if (cmd === "inject") {
    const code = Bun.argv[3]
    const target = await findWorkbench()
    if (!target) {
      console.error("No workbench found. Is Cursor running with --remote-debugging-port=9222?")
      process.exit(1)
    }
    const result = await evaluate(target.webSocketDebuggerUrl, code)
    console.log("Result:", result)
  } else if (cmd === "bootstrap") {
    const target = await findWorkbench()
    if (!target) {
      console.error("No workbench found.")
      process.exit(1)
    }
    await bootstrap(target.webSocketDebuggerUrl)
    console.log("Bootstrapped superpower in:", target.title)
  } else if (cmd === "css") {
    const css = Bun.argv[3]
    const target = await findWorkbench()
    if (!target) {
      console.error("No workbench found.")
      process.exit(1)
    }
    await injectCSS(target.webSocketDebuggerUrl, css)
    console.log("Injected CSS")
  } else {
    console.log(`
Usage:
  bun src/superpower/cdp.ts list                    - List CDP targets
  bun src/superpower/cdp.ts inject <js-code>        - Evaluate JS
  bun src/superpower/cdp.ts bootstrap               - Install window.superpower
  bun src/superpower/cdp.ts css <css-string>        - Inject CSS

First launch Cursor with:
  /Applications/Cursor.app/Contents/MacOS/Cursor --remote-debugging-port=9222
`)
  }
}
