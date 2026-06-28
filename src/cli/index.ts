#!/usr/bin/env node

import type { Flavor, MocksModule, StoriesModule } from '../types.js'
import { load_config } from '../config.js'
import { build_styled_html, load_native_svelte_css, load_universal_css } from '../render/css.js'
import { csr_render_component } from '../render/csr.js'
import { ssr_render_component } from '../render/ssr.js'
import { create_vite_loader, close_vite_loader } from '../render/vite-loader.js'
import { close_browser, html_to_png } from '../screenshot/puppeteer.js'
import { load_mocks_module, load_stories_module } from '../stories/load.js'
import { resolve_story } from '../stories/resolve.js'

/**
 * svelte-look's stdout is a machine-readable protocol: base64 PNG(s) for the screenshot
 * command, or one component path per line for `list`. The screenshot path, however,
 * renders an arbitrary user app through Vite SSR in THIS process — so any `console.log`
 * the app (or a dependency) emits during module load or render would interleave with, and
 * corrupt, that stream. (This is exactly what broke the MCP server: a consumer app logged
 * `[snapshot-cron] …` on import, and those lines got treated as base64 PNGs.) So we claim
 * stdout for ourselves: keep a private handle for protocol output, and funnel every other
 * write to stderr where it stays visible without poisoning the protocol.
 */
const write_protocol = process.stdout.write.bind(process.stdout)
process.stdout.write = ((chunk: unknown, ...rest: unknown[]) =>
  (process.stderr.write as (...writeArgs: unknown[]) => boolean)(chunk, ...rest)) as typeof process.stdout.write

const args = process.argv.slice(2)

function parse_flag(flag: string): string | undefined {
  const index = args.indexOf(flag)
  if (index !== -1)
    return args[index + 1]
}

const BOOLEAN_FLAGS = ['--all-flavors', '--full-page', '--help']

function get_positional_args(): string[] {
  const positional: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      if (!BOOLEAN_FLAGS.includes(args[i]))
        i++ // skip flag value
    } else {
      positional.push(args[i])
    }
  }
  return positional
}

function has_flag(flag: string): boolean {
  return args.includes(flag)
}

function print_usage() {
  console.error(`Usage: svelte-look <component_path> [--story <name>] [--output <path>]
       svelte-look list

Commands:
  <component_path>       Screenshot a component (default command)
  list                   List all Svelte components in src/

Options:
  --story <name>         Screenshot a specific story (default: all stories)
  --output <path>        Save PNG to file instead of base64 stdout
  --flavor <name>        Use a specific flavor from the mocks file
  --all-flavors          Screenshot all flavors (default: first flavor only)
  --full-page            Capture the full scrollable page (default: viewport only)

Examples:
  npx svelte-look /lib/components/Button --story Default
  npx svelte-look /lib/components/Button --output screenshots/Button.png
  npx svelte-look "/routes/(app)/+page" --output screenshots/_page.png
  npx svelte-look /lib/components/Button --flavor china
  npx svelte-look /lib/components/Button --all-flavors
  npx svelte-look list
`)
}

async function main() {
  const positional = get_positional_args()
  const command = positional[0]

  if (!command || command === 'help' || command === '--help') {
    print_usage()
    process.exit(command ? 0 : 1)
  }

  const real_cwd = process.cwd()

  if (command === 'list') {
    const { list_components } = await import('./list.js')
    const components = list_components({ cwd: real_cwd })
    for (const component of components)
      write_protocol(`${component}\n`)
    return
  }

  // Default: screenshot command
  const component_path = command
  const story_name = parse_flag('--story')
  const output_path = parse_flag('--output')
  const flavor_flag = parse_flag('--flavor')
  const all_flavors = has_flag('--all-flavors')
  const full_page = has_flag('--full-page')

  try {
    const { vite, temp_root: cwd } = await create_vite_loader({ cwd: real_cwd })
    const config = await load_config({ vite, cwd })

    const stories_module = await load_stories_module({ vite, component_path, cwd })
    const mocks = config.mocks
      ? await load_mocks_module({ vite, mocks_path: config.mocks, cwd })
      : {}

    const is_page = component_path.includes('+page') || component_path.includes('+layout')
    const default_page_viewports = config.page_viewports ?? [{ width: 400, height: 700 }]

    const stories_to_render = get_stories_to_render({ stories_module, story_name })
    const universal_css = load_universal_css({ config, cwd })

    const flavors_to_render = get_flavors_to_render({ mocks, flavor_flag, all_flavors })

    const dark_mode_enabled = config.dark_mode === true
    const all_buffers: Array<{ buffer: Buffer, suffix: string }> = []

    for (const { name, story, shared_meta } of stories_to_render) {
      const flavors_disabled = story.flavors === false || shared_meta?.flavors === false
      const effective_flavors = flavors_disabled ? [{ flavor_name: undefined, flavor: undefined }] : flavors_to_render
      const dark_disabled = story.dark === false || shared_meta?.dark === false
      const render_dark = dark_mode_enabled && !dark_disabled

      for (const { flavor_name, flavor } of effective_flavors) {
        const resolved = resolve_story({
          story,
          shared_meta,
          mocks,
          is_page,
          default_page_viewports,
          flavor,
          flavor_name,
        })

        for (const viewport of resolved.viewports) {
          const dark_variants: Array<{ dark: boolean, label?: string }> = render_dark
            ? [{ dark: false }, { dark: true, label: 'dark' }]
            : [{ dark: false }]

          for (const variant of dark_variants) {
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
                dark: variant.dark,
                full_page,
              })
            } else {
              const { body, head, svelte_file } = await ssr_render_component({
                vite,
                component_path,
                resolved_story: resolved,
                cwd,
                is_page,
              })

              const native_svelte_css = await load_native_svelte_css({ vite, svelte_file })
              const styled_html = build_styled_html({
                body,
                component_css: head,
                universal_css,
                native_svelte_css,
                dark: variant.dark,
              })

              png_buffer = await html_to_png({ html: styled_html, viewport, dark: variant.dark, full_page })
            }

            const suffix = [name, flavor_name, variant.label].filter(Boolean).join('_')
            all_buffers.push({ buffer: png_buffer, suffix })
          }
        }
      }
    }

    const has_multiple_outputs = all_buffers.length > 1

    for (const { buffer, suffix } of all_buffers) {
      if (output_path) {
        const { writeFileSync, mkdirSync } = await import('node:fs')
        const { dirname, extname, isAbsolute, resolve } = await import('node:path')

        let file_path = output_path
        if (has_multiple_outputs) {
          const ext = extname(output_path)
          const base = output_path.slice(0, -ext.length)
          file_path = `${base}_${suffix}${ext}`
        }

        // Resolve against real_cwd because we chdir'd to a temp root for Vite
        const abs_path = isAbsolute(file_path) ? file_path : resolve(real_cwd, file_path)
        mkdirSync(dirname(abs_path), { recursive: true })
        writeFileSync(abs_path, buffer)
        console.error(`Screenshot saved to ${abs_path}`)
      } else {
        const base64 = buffer.toString('base64')
        write_protocol(base64)
        if (has_multiple_outputs)
          write_protocol('\n')
      }
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error)
    process.exitCode = 1
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

function get_flavors_to_render({ mocks, flavor_flag, all_flavors }: {
  mocks: MocksModule
  flavor_flag?: string
  all_flavors: boolean
}): Array<{ flavor_name?: string, flavor?: Flavor }> {
  const available_flavors = mocks.flavors
  if (!available_flavors || Object.keys(available_flavors).length === 0)
    return [{ flavor_name: undefined, flavor: undefined }]

  if (flavor_flag) {
    const flavor = available_flavors[flavor_flag]
    if (!flavor) {
      console.error(`Flavor "${flavor_flag}" not found. Available: ${Object.keys(available_flavors).join(', ')}`)
      process.exit(1)
    }
    return [{ flavor_name: flavor_flag, flavor }]
  }

  const entries = Object.entries(available_flavors)

  if (all_flavors)
    return entries.map(([flavor_name, flavor]) => ({ flavor_name, flavor }))

  const [first_name, first_flavor] = entries[0]
  return [{ flavor_name: first_name, flavor: first_flavor }]
}

/**
 * Force-exit once the work is done. svelte-look is a one-shot CLI: as soon as the
 * PNG(s) (or `list` output) are written, its job is over. But rendering a story runs
 * the consumer app's modules in THIS process, and apps legitimately start background
 * handles on server-module import — un-`unref`'d cron `setInterval`s, queue drainers,
 * DB connection pools. Any one of those keeps Node's event loop alive forever, so
 * relying on the loop to drain naturally means we hang indefinitely *after* the
 * screenshot is already saved (observed: house's `hooks.server.ts` crons). So we exit
 * explicitly. We first flush the protocol stream — `write_protocol` is the real stdout
 * (process.stdout.write is redirected to stderr at the top of this file), and base64
 * output to a pipe (MCP mode) can still be buffered — so `process.exit` never truncates it.
 */
async function finish(): Promise<never> {
  await new Promise<void>(resolve => void write_protocol('', () => resolve()))
  process.exit(process.exitCode ?? 0)
}

main()
  .then(finish)
  .catch((error) => {
    console.error('Error:', error instanceof Error ? error.message : error)
    process.exitCode = 1
    return finish()
  })
