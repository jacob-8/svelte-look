import type { MocksModule, StoriesModule } from '../types.js'
import type { ViteDevServer } from 'vite'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export async function load_stories_module({ vite, component_path, cwd }: {
  vite: ViteDevServer
  component_path: string
  cwd: string
}): Promise<StoriesModule | null> {
  const base = component_path.slice(1) // remove leading /
  const stories_path = join(cwd, 'src', `${base}.stories.ts`)

  // Page/layout stories use _ prefix instead of +
  const alt_stories_path = join(cwd, 'src', `${base.replace(/\+page$/, '_page').replace(/\+layout$/, '_layout')}.stories.ts`)

  const resolved_path = existsSync(stories_path) ? stories_path : existsSync(alt_stories_path) ? alt_stories_path : null
  if (!resolved_path)
    return null

  try {
    return await vite.ssrLoadModule(resolved_path) as StoriesModule
  } catch (error) {
    console.error('Error loading stories:', error)
    return null
  }
}

export async function load_mocks_module({ vite, mocks_path, cwd }: {
  vite: ViteDevServer
  mocks_path: string
  cwd: string
}): Promise<MocksModule> {
  const full_path = join(cwd, mocks_path)
  if (!existsSync(full_path))
    return {}

  try {
    return await vite.ssrLoadModule(full_path) as MocksModule
  } catch (error) {
    console.error('Error loading mocks:', error)
    return {}
  }
}
