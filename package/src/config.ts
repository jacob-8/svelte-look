import type { SvelteLookConfig } from './types.js'
import type { ViteDevServer } from 'vite'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const DEFAULT_CONFIG: SvelteLookConfig = {
  page_viewports: [{ width: 400, height: 700 }],
}

export async function load_config({ vite, cwd }: { vite: ViteDevServer, cwd: string }): Promise<SvelteLookConfig> {
  const config_path = join(cwd, 'svelte-look.config.ts')
  if (!existsSync(config_path))
    return DEFAULT_CONFIG

  try {
    const module = await vite.ssrLoadModule(config_path) as { default: SvelteLookConfig }
    return { ...DEFAULT_CONFIG, ...module.default }
  } catch (error) {
    console.error('Error loading svelte-look.config.ts:', error)
    return DEFAULT_CONFIG
  }
}
