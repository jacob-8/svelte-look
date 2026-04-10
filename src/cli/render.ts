import type { SvelteLookConfig } from '../types.js'
import type { ViteDevServer } from 'vite'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generate_uno_css, load_universal_css } from '../render/css.js'
import { close_browser, html_to_png } from '../screenshot/puppeteer.js'

export async function render_snapshots({ cwd, vite, config }: {
  cwd: string
  vite: ViteDevServer
  config: SvelteLookConfig
}): Promise<void> {
  const src_dir = join(cwd, 'src')
  const snapshot_dirs = find_snapshot_dirs(src_dir)
  const html_files: string[] = []

  for (const snapshot_dir of snapshot_dirs) {
    for (const file of readdirSync(snapshot_dir)) {
      if (file.endsWith('.html'))
        html_files.push(join(snapshot_dir, file))
    }
  }

  if (html_files.length === 0) {
    console.error('No snapshot HTML files found.')
    return
  }

  console.error(`Found ${html_files.length} snapshot(s)`)

  const universal_css = load_universal_css({ config, cwd })
  const default_viewport = config.page_viewports?.[0] ?? { width: 400, height: 700 }

  for (const html_path of html_files) {
    const raw_html = readFileSync(html_path, 'utf-8')
    const uno_css = await generate_uno_css({ html: raw_html, cwd, vite, config })

    const styled_html = raw_html.replace(
      '</head>',
      `<style>${universal_css}\n${uno_css}\nbody { font-family: sans-serif; }</style></head>`,
    )

    const png_buffer = await html_to_png({ html: styled_html, viewport: default_viewport })
    const png_path = html_path.replace(/\.html$/, '.png')
    writeFileSync(png_path, png_buffer)

    const relative_path = png_path.replace(cwd + '/', '')
    console.error(`  ✓ ${relative_path}`)
  }

  await close_browser()
  console.error('Done.')
}

function find_snapshot_dirs(dir: string): string[] {
  const results: string[] = []
  if (!existsSync(dir))
    return results

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__snapshots__')
        results.push(full)
      else if (entry.name !== 'node_modules')
        results.push(...find_snapshot_dirs(full))
    }
  }
  return results
}
