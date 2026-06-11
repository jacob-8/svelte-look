# Temp-root isolation for Vite

## The problem

When svelte-look's CLI runs against a project whose dev server is already running (e.g. tutor with `pnpm dev` on port 7878), the browser reloads every screenshot. Root cause: svelte-look spins up a **second Vite + SvelteKit instance** against the same project root. The secondary instance writes files that the primary dev server watches:

- `<root>/.svelte-kit/generated/**` — SvelteKit's plugin regenerates route manifest, `$types`, root.svelte, client-manifest on every startup
- `<root>/node_modules/.vite/deps/**` — Vite's dep optimizer

Primary dev server sees inotify events → HMR/full reload fires → browser reload.

## The fix (implemented)

`src/render/temp-root.ts` + `src/render/vite-loader.ts` run Vite against a **temp directory** that mirrors the project:

- Top-level **directories** → symlinked from real_cwd (src/, node_modules/, static/, etc.)
- Top-level **files** → **copied** (vite.config.ts, svelte.config.js, tsconfig.json, package.json, .env*, etc.)
- `.svelte-kit/` → excluded entirely so SvelteKit generates a fresh one inside temp_root

`cacheDir` is set to `~/.cache/svelte-look/<basename>-<hash>/` — outside both trees. Persistent across invocations so dep optimization stays warm; invisible to the consumer dev server.

## Why files are copied, not symlinked

A symlinked `tsconfig.json` has its real path in the original project. Node/Vite's config resolution (esbuild's tsconfig loader, etc.) follows the symlink and resolves relative paths like `"extends": "./.svelte-kit/tsconfig.json"` against the **real** project dir, not temp_root. That breaks when real_cwd's `.svelte-kit/` doesn't exist and subtly defeats the isolation when it does.

Copying the file anchors its "real path" inside temp_root, so relative refs resolve correctly inside the temp tree.

Directories still need to be symlinks — copying `node_modules/` (gigabytes) is absurd, and `src/` is big enough that the per-call cost would regress. The asymmetry is fine because files inside a symlinked dir aren't typically subject to the same "resolve relative to my location" lookups.

## Why not `preserveSymlinks: true`

Vite supports `resolve.preserveSymlinks: true` which tells it not to realpath modules. This would fix the tsconfig walk-up issue in theory, but **breaks pnpm** — pnpm stores packages in `node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>/` and exposes them via symlinks. Without realpath resolution, peer-dep resolution fails (`Could not resolve "esm-env" imported from ...`).

Tested, confirmed broken, reverted. Copy-files/symlink-dirs is the right axis.

## Cleanup

`close_vite_loader()` removes the temp dir on graceful shutdown. A `process.on('exit')` + SIGINT/SIGTERM handler in `temp-root.ts` covers abrupt exits. SIGKILL leaks the temp dir but `/tmp` gets cleaned periodically by the OS.

## Performance cost

Measured on tutor with a running dev server:
- Cold call: ~4.48s (no meaningful change vs pre-fix)
- Warm call (persistent cache hit): ~4.36s (cold-start cost of Node + Vite + Puppeteer dominates; dep optimization is a small fraction)
- Top-level file copy step: microseconds (~156KB of text files)
- Persistent cache size: ~30MB per project

**Zero per-call slowdown vs pre-fix**, because SvelteKit was already regenerating those files on every invocation — we just redirect the writes to a disposable location.

## Verified behavior

`inotifywait -m -r` on tutor's `.svelte-kit/` and `node_modules/.vite/` during a full svelte-look run reports **0 events**. Since chokidar (Vite's watcher) uses inotify under the hood, zero kernel events guarantees no HMR/reload fires.
