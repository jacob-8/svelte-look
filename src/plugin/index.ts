import type { SvelteLookConfig } from '../types.js'
import type { Plugin, ViteDevServer } from 'vite'
import { build_css_imports, generate_mount_html } from '../render/vite-loader.js'
import { get_components_with_stories } from './api.js'
import { render_index_page } from './ui.js'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// IMPORTANT: the public return type must NOT reference vite's `Plugin` type.
//
// When svelte-look is consumed via a workspace symlink (pnpm link / monorepo),
// its own colocated `node_modules/vite` (a devDependency, needed to type-check
// our own source) gets followed by TypeScript's module resolution and produces
// a SECOND `Plugin<A=any>` identity distinct from the consuming project's
// vite. Both `Plugin` types carry the deeply recursive
// `UserConfig['plugins'] → PluginOption → Plugin` cycle, and tsgo
// (`svelte-check --tsgo`) blows up with "Excessive stack depth comparing
// types 'Plugin<any>[]' and 'Plugin<any>[]'" when comparing them in the
// consumer's `defineConfig({ plugins: [...] })` array.
//
// Exposing a minimal local structural type instead lets the consumer assign
// our result to the shallow `{ name: string }` arm of vite's `PluginOption`
// union, skipping the recursive `Plugin` arm entirely. Internally we still
// build a real `Plugin` so the implementation stays fully type-checked.
export interface SvelteLookPlugin {
  name: string
  [key: string]: any
}

export function svelte_look(): SvelteLookPlugin[] {
  return build_plugins()
}

function build_plugins(): Plugin[] {
  let vite: ViteDevServer
  let config: SvelteLookConfig
  let cwd: string
  let css_imports_str: string

  return [
    {
      name: 'svelte-look-dev-ui',
      apply: 'serve',

      configureServer(server) {
        vite = server
        cwd = server.config.root

        server.middlewares.use(async (req, res, next) => {
          const url = req.url ?? ''

          if (!url.startsWith('/__look'))
            return next()

          try {
            if (!config)
              config = await load_look_config({ vite, cwd })

            if (!css_imports_str) {
              const imports = build_css_imports({ config })
              css_imports_str = imports.css_imports_str
            }

            if (url === '/__look' || url === '/__look/') {
              const components = await get_components_with_stories({ vite, cwd, config })
              const html = render_index_page({ components, config })
              res.setHeader('Content-Type', 'text/html')
              res.end(html)
              return
            }

            if (url.startsWith('/__look/api/components')) {
              const components = await get_components_with_stories({ vite, cwd, config })
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(components))
              return
            }
          } catch (error) {
            console.error('[svelte-look]', error)
            res.statusCode = 500
            res.end(String(error))
            return
          }

          next()
        })

        server.middlewares.use(async (req, res, next) => {
          const req_url = req.url ?? ''
          if (!req_url.startsWith('/__svelte-look__/mount'))
            return next()

          try {
            if (!config)
              config = await load_look_config({ vite, cwd })

            if (!css_imports_str) {
              const imports = build_css_imports({ config })
              css_imports_str = imports.css_imports_str
            }

            const url = new URL(req_url, 'http://localhost')
            const component_path = url.searchParams.get('component') ?? ''
            const story_name = url.searchParams.get('story') ?? 'Default'
            const is_page = url.searchParams.get('is_page') === 'true'
            const mocks_path = url.searchParams.get('mocks') ?? ''
            const flavor_name = url.searchParams.get('flavor') ?? ''
            const dark = url.searchParams.get('dark') === '1'

            let html = generate_mount_html({ component_path, story_name, is_page, mocks_path, flavor_name, css_imports_str })

            if (dark) {
              html = html.replace('<html>', '<html class="dark">')
              html = html.replace(
                'mount(Component, { target: document.body, props, context })',
                `document.documentElement.classList.add('dark')
    mount(Component, { target: document.body, props, context })`,
              )
            } else {
              // Force light mode to override system dark preference (e.g. @media prefers-color-scheme: dark on :root)
              html = html.replace('<html>', '<html class="light">')
            }

            const transformed = await vite.transformIndexHtml(req_url, html)
            res.setHeader('Content-Type', 'text/html')
            res.end(transformed)
          } catch (error) {
            console.error('[svelte-look] mount error:', error)
            res.statusCode = 500
            res.end(String(error))
          }
        })
      },
    },
  ]
}

async function load_look_config({ vite, cwd }: { vite: ViteDevServer, cwd: string }): Promise<SvelteLookConfig> {
  const config_path = join(cwd, 'svelte-look.config.ts')
  if (!existsSync(config_path))
    return { page_viewports: [{ width: 400, height: 700 }] }

  try {
    const module = await vite.ssrLoadModule(config_path) as { default: SvelteLookConfig }
    return { page_viewports: [{ width: 400, height: 700 }], ...module.default }
  } catch (error) {
    console.error('[svelte-look] Error loading config:', error)
    return { page_viewports: [{ width: 400, height: 700 }] }
  }
}
