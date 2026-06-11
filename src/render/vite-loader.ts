import type { SvelteLookConfig } from '../types.js'
import type { ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createServer as createHttpServer, type Server } from 'node:http'
import { cleanup_temp_root, create_temp_root, get_persistent_cache_dir } from './temp-root.js'

let cached_server: ViteDevServer | null = null
let cached_temp_root: string | null = null
let http_server: Server | null = null
let mount_server_url: string | null = null

export async function create_vite_loader({ cwd }: { cwd: string }): Promise<{ vite: ViteDevServer, temp_root: string }> {
  if (cached_server && cached_temp_root)
    return { vite: cached_server, temp_root: cached_temp_root }

  // Run Vite against a temp dir of symlinks so SvelteKit's generated files and any
  // other write-on-startup side effects don't touch the consumer project tree.
  // Persistent external cacheDir keeps dep optimization fast across invocations.
  const temp_root = create_temp_root({ real_cwd: cwd })
  const cache_dir = get_persistent_cache_dir({ real_cwd: cwd })

  // SvelteKit's Vite plugin captures `process.cwd()` at import time and forces
  // Vite's `root` to that value, overriding our setting. So chdir before importing
  // vite (which transitively imports the user's vite.config → kit plugin).
  process.chdir(temp_root)

  const { createServer } = await import('vite')

  cached_server = await createServer({
    root: temp_root,
    cacheDir: cache_dir,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
    plugins: [app_state_shim_plugin()],
  })
  cached_temp_root = temp_root

  return { vite: cached_server, temp_root }
}

export function app_state_shim_plugin() {
  return {
    name: 'svelte-look-app-state-shim',
    enforce: 'pre' as const,

    load(id: string) {
      // Intercept the browser-side $app/state client module so CSR components read from our page data
      // Only intercept client.js (not index.js) to preserve SSR's getContext('__request__') path
      if (id.includes('/runtime/app/state/client.js')) {
        return `
export const page = new Proxy({}, {
  get(_, prop) {
    const data = window.__svelte_look_page__ || {}
    return data[prop]
  }
})
export const navigating = { current: null }
export const updated = { current: false, check: async () => false }
`
      }
    },
  }
}

export function generate_mount_html({ component_path, story_name, is_page, mocks_path, flavor_name, css_imports_str }: {
  component_path: string
  story_name: string
  is_page: boolean
  mocks_path: string
  flavor_name: string
  css_imports_str: string
}): string {
  const component_src = `/src${component_path}.svelte`
  const stories_src = find_stories_src_path({ component_path })
  const mocks_import = mocks_path ? `import * as mocks from '/${mocks_path}'` : ''
  const mocks_ref = mocks_path ? 'mocks' : '{}'

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>body { font-family: sans-serif; margin: 0; }</style>
</head>
<body>
<script type="module">
    ${css_imports_str}
    import { mount } from 'svelte'
    import Component from '${component_src}'
    import * as stories from '${stories_src}'
    ${mocks_import}

    const story = stories['${story_name}'] ?? { props: {} }
    const shared = stories.shared_meta

    const mock_data = ${mocks_ref}
    const is_page = ${is_page}
    const flavor_name = '${flavor_name}'
    const flavor = flavor_name && mock_data.flavors ? mock_data.flavors[flavor_name] : undefined

    const page_data = {
      ...(mock_data.default_page_data ?? {}),
      ...(flavor?.page_data ?? {}),
      ...(shared?.page_data ?? {}),
      ...(story.page_data ?? {}),
    }

    const params = {
      ...(shared?.params ?? {}),
      ...(story.params ?? {}),
    }

    let props = story.props ?? {}
    if (is_page) {
      props = { data: { ...page_data, ...props } }
    }

    const all_contexts = [
      ...(mock_data.default_contexts ?? []),
      ...(shared?.contexts ?? []),
      ...(story.contexts ?? []),
    ]
    const seen_keys = new Map()
    for (const { key, value } of all_contexts)
      seen_keys.set(key, value)
    const context = seen_keys

    // Populate page state for $app/state shim (intercepted by svelte-look Vite plugin)
    window.__svelte_look_page__ = {
      data: page_data,
      error: null,
      form: null,
      params,
      route: { id: '${component_path}' },
      state: {},
      status: 200,
      url: new URL(window.location.href),
    }

    mount(Component, { target: document.body, props, context })
    window.__svelte_look_mounted__ = true
</script>
</body>
</html>`
}

export function build_css_imports({ config }: { config: SvelteLookConfig }): { css_imports_str: string } {
  const local_css_imports = (config.css_files ?? [])
    .map(file => `import '/${file}'`)
  const module_css_imports = (config.css_imports ?? [])
    .map(mod => `import '${mod}'`)
  const css_imports_str = [...module_css_imports, ...local_css_imports]
    .join('\n    ')

  return { css_imports_str }
}

export async function start_mount_server({ vite, cwd, config }: {
  vite: ViteDevServer
  cwd: string
  config: SvelteLookConfig
}): Promise<string> {
  if (mount_server_url)
    return mount_server_url

  const { css_imports_str } = build_css_imports({ config })

  async function mount_handler(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const req_url = req.url ?? ''
    if (!req_url.startsWith('/__svelte-look__/mount'))
      return next()

    try {
      const url = new URL(req_url, 'http://localhost')
      const component_path = url.searchParams.get('component') ?? ''
      const story_name = url.searchParams.get('story') ?? 'Default'
      const is_page = url.searchParams.get('is_page') === 'true'
      const mocks_path = url.searchParams.get('mocks') ?? ''
      const flavor_name = url.searchParams.get('flavor') ?? ''

      const html = generate_mount_html({ component_path, story_name, is_page, mocks_path, flavor_name, css_imports_str })
      const transformed = await vite.transformIndexHtml(req_url, html)
      res.setHeader('Content-Type', 'text/html')
      res.end(transformed)
    } catch (err) {
      console.error('mount_handler error:', err)
      res.statusCode = 500
      res.end(String(err))
    }
  }

  // Prepend our handler before Vite's middleware stack
  const stack = vite.middlewares.stack as Array<{ route: string, handle: any }>
  stack.unshift({ route: '', handle: mount_handler })

  http_server = createHttpServer(vite.middlewares)

  await new Promise<void>(resolve => http_server!.listen(0, resolve))
  const address = http_server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  mount_server_url = `http://localhost:${port}`

  return mount_server_url
}

export function find_stories_src_path({ component_path }: { component_path: string }): string {
  const base = component_path.slice(1) // remove leading /
  const standard = `/src/${base}.stories.ts`
  const alt = `/src/${base.replace(/\+page$/, '_page').replace(/\+layout$/, '_layout')}.stories.ts`
  return standard.includes('+') ? alt : standard
}

export async function close_vite_loader(): Promise<void> {
  if (http_server) {
    await new Promise<void>(resolve => http_server!.close(() => resolve()))
    http_server = null
    mount_server_url = null
  }
  if (cached_server) {
    await cached_server.close()
    cached_server = null
  }
  if (cached_temp_root) {
    cleanup_temp_root({ temp_root: cached_temp_root })
    cached_temp_root = null
  }
}
