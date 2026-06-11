import type { SvelteLookConfig } from '../types.js'
import type { ViteDevServer } from 'vite'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function load_universal_css({ config, cwd }: {
  config: SvelteLookConfig
  cwd: string
}): string {
  const css_files = config.css_files ?? []
  const parts: string[] = []

  for (const relative_path of css_files) {
    const full_path = join(cwd, relative_path)
    if (!existsSync(full_path)) {
      console.warn(`CSS file not found: ${full_path}`)
      continue
    }
    const css = readFileSync(full_path, 'utf-8')
      .replace(/@import[^;]+;/g, '') // strip font @imports
    parts.push(css)
  }

  return parts.join('\n')
}

// Matches @sveltejs/vite-plugin-svelte's externally-extracted scoped CSS virtual
// modules, e.g. `/abs/path/Foo.svelte?svelte&type=style&lang.css`. Copied verbatim
// from vite-plugin-svelte (utils/constants.js SVELTE_VIRTUAL_STYLE_ID_REGEX) rather
// than imported, because the plugin doesn't expose it from its public entry.
const SVELTE_VIRTUAL_STYLE_ID_REGEX = /[?&]svelte&type=style&lang\.css$/

/**
 * Load the native Svelte 5 scoped CSS for a component (and every component it
 * imports transitively).
 *
 * By default, vite-plugin-svelte extracts each component's `<style>` block to a
 * separate virtual CSS module instead of inlining it into `render().head` (that
 * inlining only happens with `<svelte:options css="injected" />`). SSR mode never
 * fetches those virtual modules, so scoped styles go missing from the screenshot.
 *
 * We walk the module graph from the root .svelte file, collect every dependency id
 * matching `SVELTE_VIRTUAL_STYLE_ID_REGEX`, and load each via the plugin container
 * (the svelte plugin's load hook returns the raw CSS string).
 */
export async function load_native_svelte_css({ vite, svelte_file }: {
  vite: ViteDevServer
  svelte_file: string
}): Promise<string> {
  const parts: string[] = []
  const seen = new Set<string>()

  async function find_root_node() {
    const direct = vite.moduleGraph.getModuleById(svelte_file)
    if (direct) return direct
    const by_url = await vite.moduleGraph.getModuleByUrl(svelte_file).catch(() => undefined)
    if (by_url) return by_url
    // svelte-look runs Vite against a temp dir of symlinks while Vite stores
    // resolved real paths, so id/url lookups can miss. Fall back to matching the
    // component's basename against every node in the graph.
    const basename = svelte_file.split(/[/\\]/).pop() ?? ''
    if (!basename) return undefined
    for (const node of vite.moduleGraph.idToModuleMap.values()) {
      if (node.id && !SVELTE_VIRTUAL_STYLE_ID_REGEX.test(node.id) && node.id.endsWith(basename))
        return node
    }
    return undefined
  }

  async function walk(node: { id?: string | null, importedModules: Set<any> } | undefined) {
    if (!node) return
    const node_id = node.id ?? ''
    if (node_id && seen.has(node_id)) return
    if (node_id) seen.add(node_id)

    for (const dep of node.importedModules) {
      const id: string | null = dep.id
      if (!id) continue
      if (SVELTE_VIRTUAL_STYLE_ID_REGEX.test(id)) {
        try {
          const loaded = await vite.pluginContainer.load(id, { ssr: true })
          if (loaded) {
            const code = typeof loaded === 'string' ? loaded : (loaded.code ?? '')
            if (code) parts.push(code)
          }
        } catch (error) {
          console.warn(`native Svelte scoped CSS load failed for ${id}:`, error)
        }
        continue
      }
      await walk(dep)
    }
  }

  await walk(await find_root_node())
  return parts.join('\n')
}

export function build_styled_html({ body, component_css, universal_css, native_svelte_css, dark }: {
  body: string
  component_css: string
  universal_css: string
  native_svelte_css?: string
  dark?: boolean
}): string {
  const styles = [universal_css, native_svelte_css ?? '', component_css]
    .filter(Boolean)
    .join('\n')

  const html_attrs = dark ? ' class="dark"' : ''

  const result = `<!DOCTYPE html>
<html${html_attrs}>
<head>
<meta charset="utf-8">
<style>${styles}
body { font-family: sans-serif; background: var(--background, #ffffff); color: var(--color, #000000); }</style>
</head>
<body>${body}</body>
</html>`
  return result
}
