# Verifying svelte-look doesn't trigger consumer dev server reloads

## Why mtime checks alone aren't enough

Checking file mtimes before/after a run misses:
- Files that were written with the **same content** (some tools stat-first and skip identical writes — we'd miss legitimate "no-op" writes that still fire watcher events on some configurations)
- Create-then-delete cycles within the run window

## Use `inotifywait`

chokidar (the watcher inside Vite/SvelteKit) uses inotify under the hood on Linux. Kernel-level inotify events are the ground truth: if zero events fire, the consumer dev server's watcher literally cannot react.

### Method

```bash
# Terminal 1: start watch
inotifywait -m -r -e modify,create,delete,move \
  /path/to/consumer/.svelte-kit \
  /path/to/consumer/node_modules/.vite \
  > /tmp/inotify.log &

# Terminal 2: run svelte-look (MCP or CLI)
cd /path/to/consumer && npx svelte-look /some/component --output /tmp/x.png

# Terminal 1: stop watch, inspect
kill %1
wc -l /tmp/inotify.log   # should be 0
```

Any non-zero count indicates svelte-look is writing somewhere the consumer watches → potential reload trigger.

### Typical offenders to watch

- `.svelte-kit/generated/**` — SvelteKit regenerating route files
- `.svelte-kit/tsconfig.json` + `.svelte-kit/ambient.d.ts` — kit's TS setup
- `node_modules/.vite/deps/**` — Vite dep optimizer cache
- `.vite-cache/` (only if misconfigured; ours lives in `~/.cache/svelte-look/`)

### End-to-end with a real dev server

For the most realistic test, have the consumer's dev server actually running (`pnpm dev` or similar). `ss -tlnp | grep <port>` confirms it's live. Run svelte-look. The inotify trace catches any real-world reload trigger.

### Baseline verified

As of 2026-04-20, running svelte-look against tutor (dev server active on port 7878) produces **0 inotify events** on both `.svelte-kit/` and `node_modules/.vite/` during cold and warm runs. This is the acceptance criterion for the temp-root fix.
