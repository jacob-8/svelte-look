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

export async function generate_uno_css({ html, cwd, vite, config }: {
  html: string
  cwd: string
  vite: ViteDevServer
  config: SvelteLookConfig
}): Promise<string> {
  const uno_config_path = config.uno_config ?? 'uno.config.ts'
  const full_config_path = join(cwd, uno_config_path)

  if (!existsSync(full_config_path))
    return ''

  try {
    const unocss = await vite.ssrLoadModule('unocss') as any
    const app_config = (await vite.ssrLoadModule(full_config_path)).default

    const generator = await unocss.createGenerator(app_config)

    const { css } = await generator.generate(html)
    return css
  } catch (error) {
    console.warn('UnoCSS generation failed:', error)
    return ''
  }
}

export function build_styled_html({ body, component_css, universal_css, uno_css }: {
  body: string
  component_css: string
  universal_css: string
  uno_css: string
}): string {
  const styles = [universal_css, uno_css, component_css]
    .filter(Boolean)
    .join('\n')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>${styles}
body { font-family: sans-serif; }</style>
</head>
<body>${body}</body>
</html>`
}
