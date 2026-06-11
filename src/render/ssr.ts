import type { ViteDevServer } from 'vite'
import type { ResolvedStory } from '../types.js'
import { join } from 'node:path'

export async function ssr_render_component({ vite, component_path, resolved_story, cwd, is_page }: {
  vite: ViteDevServer
  component_path: string
  resolved_story: ResolvedStory
  cwd: string
  is_page: boolean
}): Promise<{ body: string, head: string, svelte_file: string }> {
  const svelte_file = join(cwd, 'src', `${component_path.slice(1)}.svelte`)
  const component_module = await vite.ssrLoadModule(svelte_file)
  const component = component_module.default

  const { render } = await vite.ssrLoadModule('svelte/server')

  const props = is_page
    ? { data: { ...resolved_story.page_data, ...resolved_story.props } }
    : resolved_story.props

  const page_data = { ...resolved_story.page_data, ...resolved_story.props }

  const context = new Map(
    resolved_story.contexts.map(({ key, value }) => [key, value]),
  )

  // Populate SvelteKit's __request__ context so $app/state works during SSR
  context.set('__request__', {
    page: {
      data: page_data,
      error: null,
      form: null,
      params: resolved_story.params,
      route: { id: component_path },
      state: {},
      status: 200,
      url: new URL(`http://localhost${component_path}`),
    },
  })

  const rendered = render(component, { props, context })

  return {
    body: clean_svelte_html(rendered.body),
    head: clean_svelte_head(rendered.head),
    svelte_file,
  }
}

/** Strip Svelte 5 SSR control-flow comment markers for cleaner screenshot HTML. */
function clean_svelte_html(html: string): string {
  return html.replace(/<!--(?:\[(?:!|-?\d+)?|\]|[a-z0-9]{6}|)-->/gi, '')
}

function clean_svelte_head(head: string): string {
  const css_sourcemaps = /\/\*.*?\*\//gs
  const style_tags = /<\/?style[^>]*>/g
  const empty_css_rules = /(\*|\.[\w-]+)\s*\{\s*\}/g

  return head
    .replace(css_sourcemaps, '')
    .replace(style_tags, '')
    .replace(empty_css_rules, '')
    .trim()
}
