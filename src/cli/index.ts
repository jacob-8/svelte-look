#!/usr/bin/env node

import type { StoriesModule } from '../types.js'
import { load_config } from '../config.js'
import { build_styled_html, generate_uno_css, load_universal_css } from '../render/css.js'
import { csr_render_component } from '../render/csr.js'
import { ssr_render_component } from '../render/ssr.js'
import { create_vite_loader, close_vite_loader } from '../render/vite-loader.js'
import { close_browser, html_to_png } from '../screenshot/puppeteer.js'
import { load_mocks_module, load_stories_module } from '../stories/load.js'
import { resolve_story } from '../stories/resolve.js'

const args = process.argv.slice(2)

function parse_flag(flag: string): string | undefined {
  const index = args.indexOf(flag)
  if (index !== -1)
    return args[index + 1]
}

function get_positional_args(): string[] {
  const positional: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      i++ // skip flag value
    } else {
      positional.push(args[i])
    }
  }
  return positional
}

function print_usage() {
  console.error(`Usage: svelte-look <component_path> [--story <name>] [--output <path>]
       svelte-look list
       svelte-look render

Commands:
  <component_path>       Screenshot a component (default command)
  list                   List all Svelte components in src/
  render                 Convert __snapshots__/*.html files to PNGs

Options:
  --story <name>         Screenshot a specific story (default: all stories)
  --output <path>        Save PNG to file instead of base64 stdout

Examples:
  npx svelte-look /lib/components/Button --story Default
  npx svelte-look /lib/components/Button --output screenshots/button.png
  npx svelte-look list
  npx svelte-look render
`)
}

async function main() {
  const positional = get_positional_args()
  const command = positional[0]

  if (!command || command === 'help' || command === '--help') {
    print_usage()
    process.exit(command ? 0 : 1)
  }

  const cwd = process.cwd()

  if (command === 'list') {
    const { list_components } = await import('./list.js')
    const components = list_components({ cwd })
    for (const component of components)
      console.log(component)
    return
  }

  if (command === 'render') {
    const vite = await create_vite_loader({ cwd })
    const config = await load_config({ vite, cwd })
    const { render_snapshots } = await import('./render.js')
    try {
      await render_snapshots({ cwd, vite, config })
    } finally {
      await close_vite_loader()
    }
    return
  }

  // Default: screenshot command
  const component_path = command
  const story_name = parse_flag('--story')
  const output_path = parse_flag('--output')

  try {
    const vite = await create_vite_loader({ cwd })
    const config = await load_config({ vite, cwd })

    const stories_module = await load_stories_module({ vite, component_path, cwd })
    const mocks = config.mocks
      ? await load_mocks_module({ vite, mocks_path: config.mocks, cwd })
      : {}

    const is_page = component_path.includes('+page') || component_path.includes('+layout')
    const default_page_viewports = config.page_viewports ?? [{ width: 400, height: 700 }]

    const stories_to_render = get_stories_to_render({ stories_module, story_name })
    const universal_css = load_universal_css({ config, cwd })

    for (const { name, story, shared_meta } of stories_to_render) {
      const resolved = resolve_story({
        story,
        shared_meta,
        mocks,
        is_page,
        default_page_viewports,
      })

      for (const viewport of resolved.viewports) {
        let png_buffer: Buffer

        if (resolved.csr) {
          png_buffer = await csr_render_component({
            vite,
            component_path,
            resolved_story: resolved,
            story_name: name,
            cwd,
            config,
            is_page,
            viewport,
          })
        } else {
          const { body, head } = await ssr_render_component({
            vite,
            component_path,
            resolved_story: resolved,
            cwd,
            is_page,
          })

          const uno_css = await generate_uno_css({ html: body, cwd, vite, config })
          const styled_html = build_styled_html({
            body,
            component_css: head,
            universal_css,
            uno_css,
          })

          png_buffer = await html_to_png({ html: styled_html, viewport })
        }

        if (output_path) {
          const { writeFileSync, mkdirSync } = await import('node:fs')
          const { dirname, extname } = await import('node:path')

          let file_path = output_path
          if (stories_to_render.length > 1) {
            const ext = extname(output_path)
            const base = output_path.slice(0, -ext.length)
            file_path = `${base}_${name}${ext}`
          }

          mkdirSync(dirname(file_path), { recursive: true })
          writeFileSync(file_path, png_buffer)
          console.error(`Screenshot saved to ${file_path}`)
        } else {
          const base64 = png_buffer.toString('base64')
          process.stdout.write(base64)
          if (stories_to_render.length > 1)
            process.stdout.write('\n')
        }
      }
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  } finally {
    await close_browser()
    await close_vite_loader()
  }
}

function get_stories_to_render({ stories_module, story_name }: {
  stories_module: StoriesModule | null
  story_name?: string
}): Array<{ name: string, story: any, shared_meta: any }> {
  if (!stories_module) {
    return [{ name: 'Default', story: { props: {} }, shared_meta: undefined }]
  }

  const shared_meta = stories_module.shared_meta
  const all_stories = Object.entries(stories_module)
    .filter(([key]) => key !== 'shared_meta')
    .map(([name, story]) => ({ name, story, shared_meta }))

  if (story_name) {
    const found = all_stories.find(s => s.name === story_name)
    if (!found) {
      console.error(`Story "${story_name}" not found. Available: ${all_stories.map(s => s.name).join(', ')}`)
      process.exit(1)
    }
    return [found]
  }

  return all_stories
}

main()
