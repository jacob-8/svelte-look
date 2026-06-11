# UnoCSS extraction in svelte-look — two unrelated bugs

The original "newly-created files don't get UnoCSS classes" report turned out to
involve TWO separate issues. The plan below covered the first (CSR race). After
fixing it, screenshots STILL came out unstyled, leading to the second discovery
documented at the bottom: a Svelte 5 SSR comment marker that silently kills
UnoCSS extraction.

## Bug 1 — CSR mount race ✅ fixed

### Symptom (reported by tutor)

Newly-created `.svelte` files in a consumer project don't get their UnoCSS utility
classes applied in svelte-look screenshots. Even `bg-red-500` on the outer span
produces no red background. Other components with UnoCSS classes (defined as
shortcuts in `uno.config.ts`, e.g. `btn`) DO render correctly. Clearing
`~/.cache/svelte-look/` doesn't help.

After a successful render, subsequent renders of the same file work fine. Only
the FIRST render of a brand-new file is broken.

## Root cause

`@unocss/vite` GlobalModeDevPlugin (in `node_modules/@unocss/vite/dist/index.mjs`):

- `transform(code, id)` queues an extraction task per transformed file.
- `load('virtual:uno.css')` calls `flushTasks()` then `uno.generate(tokens)` and
  returns CSS. CSS only contains classes from files extracted up to that moment.
- A post-plugin appends an HMR hook to the loaded CSS that, after a 100ms
  setTimeout in the browser, sends `unocss:hmr` over the WS. If the hash
  changed (more tokens accumulated since), the server pushes an HMR update and
  the browser swaps stylesheets.

Our `generate_mount_html` (in `src/render/vite-loader.ts`) emits:

```html
<script type="module">
  import 'virtual:uno.css'
  import Component from '/src/.../Foo.svelte'
  ...
</script>
```

Both fetches start in parallel. `virtual:uno.css` is small and resolves first
→ at that moment, `Foo.svelte` has not yet been transformed, so its tokens are
not in the generator → returned CSS has no rules for it. Then `Foo.svelte` is
fetched, UnoCSS extracts its tokens, the post-plugin's 100ms timer fires, WS
roundtrip happens, HMR update is queued.

The puppeteer wait in `src/render/csr.ts`:

```js
await page.waitForFunction(() => {
  const sheets = Array.from(document.querySelectorAll('style[data-vite-dev-id*="uno"]'))
  return sheets.some(s => s.textContent && s.textContent.length > 100)
}, { timeout: 5000 }).catch(() => {})
```

is satisfied immediately by config-time shortcuts (which DO live in the first
CSS response). So we screenshot before the HMR update lands.

### Why "newly created" specifically

`cached_server` in `vite-loader.ts` lives across MCP calls. UnoCSS's `tokens`
set is in-process. Once a file has been transformed once, its tokens persist
in the generator. The very first `load('virtual:uno.css')` of subsequent
renders already includes them — no race. Only files never transformed before
hit the race.

### Why clearing `~/.cache/svelte-look/` didn't help

That dir is Vite's `cacheDir` (esbuild dep optimizer). UnoCSS's token set is
in-memory in the running Vite plugin instance — unrelated.

## Fix

Two layers — server-side warmup + a deterministic puppeteer backstop.

### 1. Pre-warm the component module graph before serving the mount HTML

In both `src/render/vite-loader.ts` `mount_handler` and the equivalent in
`src/plugin/index.ts` middleware, walk the component's import graph via
`vite.warmupRequest()` BEFORE generating the HTML. Every file the browser is
about to load will have already passed through UnoCSS's `transform` hook, so
the very first `load('virtual:uno.css')` request returns CSS that includes
everything.

```ts
async function warmup_module_tree({ vite, url, seen }: {
  vite: ViteDevServer
  url: string
  seen: Set<string>
}): Promise<void> {
  if (seen.has(url)) return
  seen.add(url)
  try {
    await vite.warmupRequest(url)
  } catch { return }
  const mod = await vite.moduleGraph.getModuleByUrl(url)
  if (!mod) return
  for (const dep of mod.importedModules) {
    if (dep.url) await warmup_module_tree({ vite, url: dep.url, seen })
  }
}
```

Then in mount handlers, before `generate_mount_html`:

```ts
const component_src = `/src${component_path}.svelte`
const stories_src = find_stories_src_path({ component_path })
const seen = new Set<string>()
await warmup_module_tree({ vite, url: component_src, seen })
await warmup_module_tree({ vite, url: stories_src, seen })
// Force virtual:uno.css to be regenerated next request with fresh tokens.
const uno_mod = vite.moduleGraph.getModuleById('\0virtual:uno.css')
if (uno_mod) vite.moduleGraph.invalidateModule(uno_mod)
```

Subsequent renders are cheap — Vite caches transforms in the module graph.

### 2. Make the puppeteer wait deterministic

Replace the "any uno sheet > 100 chars" heuristic in `src/render/csr.ts` with
a deterministic re-fetch right before screenshot. After
`__svelte_look_mounted__` is true, do:

```ts
await page.evaluate(async () => {
  const response = await fetch(`/@id/__x00__virtual:uno.css?t=${Date.now()}`)
  if (!response.ok) return
  const css = await response.text()
  const style = document.createElement('style')
  style.setAttribute('data-svelte-look-uno-final', '')
  style.textContent = css
  document.head.appendChild(style)
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
})
```

Belt-and-suspenders: even if (1) misses an edge case, the synchronous fetch
captures everything UnoCSS has accumulated by the time mount finishes.

### Plan ✅ complete

- ✅ Add `warmup_module_tree` helper in `src/render/vite-loader.ts` and export it.
- ✅ Wire it into the CLI's mount_handler in `vite-loader.ts`.
- ✅ Wire it into the dev-UI plugin's `/__svelte-look__/mount` middleware.
- ✅ Update `src/render/csr.ts`: replaced the existence-of-uno-style heuristic
      with a deterministic dynamic-import re-fetch of the existing uno style tag.
- ✅ Build (`pnpm build`).

### Notes

- UnoCSS's resolved virtual module id is `/__uno.css` (default `virtualModulePrefix`
  is `__uno`), NOT `\0virtual:uno.css`. `invalidate_unocss_modules` matches the
  `__uno*.css` shape via regex.
- The dev-UI middleware is a near-duplicate of the CLI mount handler — small
  refactor opportunity but not urgent.

## Bug 2 — Svelte 5 SSR comment marker breaks UnoCSS extraction ✅ fixed

After Bug 1 was fixed, tutor's `Line.svelte` SCREENSHOT was still unstyled. Bug 1
only affects CSR; tutor's CLI invocations use SSR (no `csr: true` on stories).

### Diagnosis

The SSR path in `src/render/css.ts` calls `generator.generate(html)` directly
against the cleaned SSR body. Dumping the inputs and running UnoCSS by hand:

- 12060-char SSR body → cleaned to 11025 chars → only **3** matched tokens
  (`leading-1.2`, `[overflow-wrap:normal]`, `[word-break:normal]`)
- The HTML clearly contains 22+ unique classes (`inline-flex`, `flex-col`,
  `items-center`, `flex`, `whitespace-nowrap`, `cursor-pointer`, `block`,
  `h-2em`, etc.) — they were just being silently dropped from extraction

Bisecting by character offset showed extraction worked up to offset 208 (8
matches), then collapsed to 1 match at offset 209 — the boundary was the closing
`]` of the arbitrary-value class `text-[var(--color-secondary)]`.

But isolated tests of that exact arbitrary-value utility worked fine. Eventually
narrowed it down: the trigger is the combination of `text-[var(--color-secondary)]`
PLUS an earlier `<!--[-1-->` comment elsewhere in the input.

`<!--[-1-->` is one of two new Svelte 5 SSR comment markers the existing cleaner
didn't strip:
- `<!--[N-->` and `<!--[-N-->` — keyed-each numeric anchors
- The original cleaner only handled `<!---->`, `<!--[-->`, `<!--[!-->`, `<!--]-->`,
  and `<!--[a-z0-9]{6}-->` (boundary hashes)

### Why it kills UnoCSS

UnoCSS's default `extractorSplit` splits on `\\?[\s'"`;{}]+`. The token
`<!--[-1-->` doesn't get split internally (no whitespace/quote/etc inside it),
so it becomes one giant token. When UnoCSS later sees the arbitrary-value
`[overflow-wrap:normal]` style class, something in its matcher path interacts
with the leftover `[-1` token and aborts further matching for the entire input.
This is a UnoCSS bug we can't fix upstream from svelte-look, but stripping ALL
Svelte SSR comments before extraction sidesteps it entirely.

### Fix

Replace the brittle list-of-replaceAll calls in `src/render/ssr.ts` `clean_svelte_html`
with one comprehensive regex covering every comment shape Svelte 5 emits:

```ts
function clean_svelte_html(html: string): string {
  return html.replace(/<!--(?:\[(?:!|-?\d+)?|\]|[a-z0-9]{6}|)-->/gi, '')
}
```

This matches:
- `<!---->` (empty alternative at end)
- `<!--[-->`, `<!--[!-->`, `<!--[0-->`, `<!--[-1-->`, etc.
- `<!--]-->`
- `<!--<6 hex>-->`

### Verification

- ✅ Re-ran tutor CLI: `Line.svelte` screenshot now renders pinyin above /
  definition below with full vertical stacking — `inline-flex flex-col items-center`
  etc. all work.
- ✅ MCP screenshot of `CodeSwitchZhWithEnglish` story: same fix, same result.
- ✅ `AGENTS.md` updated to document all six Svelte SSR comment shapes and warn
  about the `<!--[-1-->` + arbitrary-value-utility interaction.
