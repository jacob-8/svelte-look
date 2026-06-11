import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, join } from 'node:path'

// Top-level entries we refuse to symlink. SvelteKit writes into .svelte-kit/ based on
// Vite's root — we want a fresh dir inside the temp root, not the real project's one.
// .git is excluded because it's large and never needed for rendering.
const EXCLUDED_ENTRIES = new Set(['.svelte-kit', '.git'])

let tracked_temp_roots: string[] = []
let exit_handler_registered = false

/**
 * Create a temp directory mirroring real_cwd's top level: directories are symlinked,
 * regular files are copied. Vite uses the temp dir as root, so SvelteKit's generated
 * files (and any other write-on-startup side effects) land inside the temp dir
 * instead of the consumer project tree — invisible to any dev server watching it.
 *
 * Files are copied rather than symlinked so that relative references inside them
 * (e.g. tsconfig.json's `"extends": "./.svelte-kit/tsconfig.json"`) resolve against
 * temp_root. Node/Vite's path resolution follows symlinks to the real file location,
 * so a symlinked tsconfig.json would resolve `./` to the real project dir. Copies
 * keep the path identity anchored to temp_root.
 */
export function create_temp_root({ real_cwd }: { real_cwd: string }): string {
  const temp_root = mkdtempSync(join(tmpdir(), 'svelte-look-'))

  for (const entry of readdirSync(real_cwd, { withFileTypes: true })) {
    if (EXCLUDED_ENTRIES.has(entry.name))
      continue
    const src = join(real_cwd, entry.name)
    const dst = join(temp_root, entry.name)
    if (entry.isDirectory())
      symlinkSync(src, dst)
    else
      copyFileSync(src, dst)
  }

  tracked_temp_roots.push(temp_root)
  register_exit_handler()
  return temp_root
}

export function cleanup_temp_root({ temp_root }: { temp_root: string }): void {
  rmSync(temp_root, { recursive: true, force: true })
  tracked_temp_roots = tracked_temp_roots.filter(dir => dir !== temp_root)
}

/**
 * Persistent cache dir for Vite's dep optimizer, outside the real project tree.
 * Keyed by real_cwd so each project gets its own cache and they don't collide.
 * Living outside the real project means writes here don't trigger the consumer's
 * dev server, while persistence means we don't pay cold-start esbuild costs on every run.
 */
export function get_persistent_cache_dir({ real_cwd }: { real_cwd: string }): string {
  const hash = createHash('sha256').update(real_cwd).digest('hex').slice(0, 12)
  const name = basename(real_cwd) || 'root'
  const dir = join(homedir(), '.cache', 'svelte-look', `${name}-${hash}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function register_exit_handler(): void {
  if (exit_handler_registered)
    return
  exit_handler_registered = true

  const cleanup = () => {
    for (const dir of tracked_temp_roots) {
      try {
        rmSync(dir, { recursive: true, force: true })
      } catch {
        // best-effort on exit
      }
    }
    tracked_temp_roots = []
  }

  process.on('exit', cleanup)
  process.on('SIGINT', () => { cleanup(); process.exit(130) })
  process.on('SIGTERM', () => { cleanup(); process.exit(143) })
}
