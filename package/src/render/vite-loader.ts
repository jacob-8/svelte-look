import type { SvelteLookConfig } from '../types.js'
import type { ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createServer as createHttpServer, type Server } from 'node:http'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

let cached_server: ViteDevServer | null = null
let http_server: Server | null = null
let mount_server_url: string | null = null

export async function create_vite_loader({ cwd }: { cwd: string }): Promise<ViteDevServer> {
  if (cached_server)
    return cached_server

  const { createServer } = await import('vite')

  cached_server = await createServer({
    root: cwd,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  })

  return cached_server
}

export async function start_mount_server({ vite, cwd, config }: {
  vite: ViteDevServer
  cwd: string
  config: SvelteLookConfig
}): Promise<string> {
  if (mount_server_url)
    return mount_server_url

  const css_imports = (config.css_files ?? [])
    .map(file => `import '/${file}'`)
    .join('\n    ')

  const uno_config_path = config.uno_config ?? 'uno.config.ts'
  const has_uno = existsSync(join(cwd, uno_config_path))
  const uno_import = has_uno ? `import 'virtual:uno.css'` : ''

  function mount_handler(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const req_url = req.url ?? ''
    if (!req_url.startsWith('/__svelte-look__/mount'))
      return next()

    const url = new URL(req_url, 'http://localhost')
    const component_path = url.searchParams.get('component') ?? ''
    const story_name = url.searchParams.get('story') ?? 'Default'
    const is_page = url.searchParams.get('is_page') === 'true'
    const mocks_path = url.searchParams.get('mocks') ?? ''

    const component_src = `/src${component_path}.svelte`
    const stories_src = find_stories_src_path({ component_path })
    const mocks_import = mocks_path ? `import * as mocks from '/${mocks_path}'` : ''
    const mocks_ref = mocks_path ? 'mocks' : '{}'

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>body { font-family: sans-serif; margin: 0; }</style>
</head>
<body>
<script type="module">
    ${css_imports}
    ${uno_import}
    import { mount } from 'svelte'
    import Component from '${component_src}'
    import * as stories from '${stories_src}'
    ${mocks_import}

    const story = stories['${story_name}'] ?? { props: {} }
    const shared = stories.shared_meta

    const mock_data = ${mocks_ref}
    const is_page = ${is_page}

    let props = story.props ?? {}
    if (is_page) {
      const page_data = {
        ...(mock_data.default_page_data ?? {}),
        ...(shared?.page_data ?? {}),
        ...(story.page_data ?? {}),
      }
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

    mount(Component, { target: document.body, props, context })
    window.__svelte_look_mounted__ = true
</script>
</body>
</html>`

    vite.transformIndexHtml(req_url, html).then(transformed => {
      res.setHeader('Content-Type', 'text/html')
      res.end(transformed)
    }).catch(err => {
      console.error('transformIndexHtml error:', err)
      res.statusCode = 500
      res.end(String(err))
    })
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

function find_stories_src_path({ component_path }: { component_path: string }): string {
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
}
