import type { StoriesModule, MocksModule, SvelteLookConfig } from '../types.js'
import type { ViteDevServer } from 'vite'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

export interface ComponentInfo {
  component_path: string
  stories: string[]
  flavor_names: string[]
}

export async function get_components_with_stories({ vite, cwd, config }: {
  vite: ViteDevServer
  cwd: string
  config: SvelteLookConfig
}): Promise<ComponentInfo[]> {
  const src_dir = join(cwd, 'src')
  const stories_files: string[] = []
  find_stories_files({ dir: src_dir, src_dir }, stories_files)

  const mocks = config.mocks ? await load_mocks({ vite, mocks_path: config.mocks, cwd }) : {}
  const flavor_names = mocks.flavors ? Object.keys(mocks.flavors) : []

  const components: ComponentInfo[] = []

  for (const stories_file of stories_files) {
    const component_path = stories_file_to_component_path(stories_file)
    const stories_module = await load_stories({ vite, stories_file: join(src_dir, stories_file) })
    if (!stories_module) continue

    const story_names = Object.keys(stories_module).filter(key => key !== 'shared_meta')
    if (story_names.length === 0) continue

    components.push({
      component_path,
      stories: story_names,
      flavor_names,
    })
  }

  return components
}

function find_stories_files({ dir, src_dir }: { dir: string, src_dir: string }, results: string[]): void {
  if (!existsSync(dir)) return

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full_path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.svelte-kit')
        find_stories_files({ dir: full_path, src_dir }, results)
    } else if (entry.name.endsWith('.stories.ts')) {
      results.push(relative(src_dir, full_path))
    }
  }
}

function stories_file_to_component_path(stories_file: string): string {
  return '/' + stories_file
    .replace(/\.stories\.ts$/, '')
    .replace(/_page$/, '+page')
    .replace(/_layout$/, '+layout')
}

async function load_stories({ vite, stories_file }: {
  vite: ViteDevServer
  stories_file: string
}): Promise<StoriesModule | null> {
  try {
    return await vite.ssrLoadModule(stories_file) as StoriesModule
  } catch {
    return null
  }
}

async function load_mocks({ vite, mocks_path, cwd }: {
  vite: ViteDevServer
  mocks_path: string
  cwd: string
}): Promise<MocksModule> {
  const full_path = join(cwd, mocks_path)
  if (!existsSync(full_path)) return {}

  try {
    return await vite.ssrLoadModule(full_path) as MocksModule
  } catch {
    return {}
  }
}
