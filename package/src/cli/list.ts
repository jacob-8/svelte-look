import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

export function list_components({ cwd }: { cwd: string }): string[] {
  const src_dir = join(cwd, 'src')
  const components: string[] = []
  find_svelte_files({ dir: src_dir, src_dir }, components)
  return components
}

function find_svelte_files({ dir, src_dir }: { dir: string, src_dir: string }, results: string[]): void {
  if (!existsSync(dir))
    return

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full_path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.svelte-kit')
        find_svelte_files({ dir: full_path, src_dir }, results)
    } else if (entry.name.endsWith('.svelte')) {
      const relative_path = relative(src_dir, full_path).replace(/\.svelte$/, '')
      results.push(`/${relative_path}`)
    }
  }
}
