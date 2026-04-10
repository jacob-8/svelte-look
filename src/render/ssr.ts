import type { ViteDevServer } from 'vite'
import type { ResolvedStory } from '../types.js'
import { join } from 'node:path'

export async function ssr_render_component({ vite, component_path, resolved_story, cwd, is_page }: {
  vite: ViteDevServer
  component_path: string
  resolved_story: ResolvedStory
  cwd: string
  is_page: boolean
}): Promise<{ body: string, head: string }> {
  const svelte_file = join(cwd, 'src', `${component_path.slice(1)}.svelte`)
  const component_module = await vite.ssrLoadModule(svelte_file)
  const component = component_module.default

  const { render } = await vite.ssrLoadModule('svelte/server')

  const props = is_page
    ? { data: { ...resolved_story.page_data, ...resolved_story.props } }
    : resolved_story.props

  const context = new Map(
    resolved_story.contexts.map(({ key, value }) => [key, value]),
  )

  const rendered = render(component, { props, context })

  return {
    body: clean_svelte_html(rendered.body),
    head: clean_svelte_head(rendered.head),
  }
}

function clean_svelte_html(html: string): string {
  return html
    .replaceAll('<!---->', '')
    .replaceAll('<!--[-->', '')
    .replaceAll('<!--[!-->', '')
    .replaceAll('<!--]-->', '')
    .replace(/<!--[a-z0-9]{6}-->/gi, '')
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
