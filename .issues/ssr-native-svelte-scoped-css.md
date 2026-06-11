# SSR mode should load Svelte 5's native scoped `<style>` CSS

## Problem

When a Svelte 5 component uses a native `<style>` block (i.e. plain scoped CSS, not UnoCSS utilities), SSR mode produces an unstyled screenshot. Users have to add `csr: true` to every story to get a correct render.

This was discovered during the LD `site/` UnoCSS-strip migration:

> **`csr: true` is required EVEN AFTER UnoCSS is torn down** — Lesson #1 from the tutor migration claimed this was a svelte-scoped-coexistence issue. It's actually broader: svelte-look's SSR mode in any project doesn't pick up Svelte 5's native scoped `<style>` block CSS.

Reproduction in the LD `site/` repo (post UnoCSS-teardown): remove `csr: true` from `src/lib/Welcome.stories.ts` and run `pnpm svelte-look /lib/Welcome`. The screenshot is unstyled. Re-add `csr: true` → renders correctly.

## Root cause

`src/render/ssr.ts:ssr_render_component` does:
```ts
const component_module = await vite.ssrLoadModule(svelte_file)
const component = component_module.default
const { render } = await vite.ssrLoadModule('svelte/server')
const rendered = render(component, { props, context })
return { body: rendered.body, head: clean_svelte_head(rendered.head) }
```

The assumption (documented in `.issues/initial-architecture.md` line 22) was that `rendered.head` contains the component's scoped CSS as `<style>` tags. This is **only true** when the component sets `<svelte:options css="injected" />` (which our email components do — that's why they render correctly).

By default, `@sveltejs/vite-plugin-svelte` extracts each component's scoped CSS to a separate virtual module (`SVELTE_VIRTUAL_STYLE_ID_REGEX = /[?&]svelte&type=style&lang.css$/` — see `node_modules/@sveltejs/vite-plugin-svelte/src/utils/constants.js`). In dev mode, Vite serves these via HMR as `<style>` injections from `<link>` modules. svelte-look's SSR path never asks for them.

In CSR mode this is invisible because Puppeteer loads `/__svelte-look__/mount` via Vite's dev server, which handles all CSS imports correctly.

The same pattern was already solved for UnoCSS svelte-scoped — see `generate_svelte_scoped_css` in `src/render/css.ts`. It walks `vite.moduleGraph.idToModuleMap` looking for `__uno_<Name>_<hash>.svelte.css$` IDs and loads each via `vite.pluginContainer.load(id, { ssr: true })`. We need the analogous mechanism for the native Svelte virtual CSS modules.

## Verification — currently fails

The existing `example/` app uses only utility classes (UnoCSS). None of its components have a non-utility `<style>` block, so the bug doesn't surface there. To reproduce and verify the fix we need an example component that exercises Svelte 5 native scoped CSS.

## Decisions locked in

| # | Decision | Choice |
|---|---|---|
| 1 | Where to add the loader | New function `load_native_svelte_css({ vite, svelte_file })` in `src/render/css.ts` |
| 2 | How to find scoped CSS modules | Walk `vite.moduleGraph.idToModuleMap` after `ssrLoadModule`; match IDs against `SVELTE_VIRTUAL_STYLE_ID_REGEX` (copy regex literal — don't import from vite-plugin-svelte; the plugin doesn't export it from its public entry) |
| 3 | Transitive child components | Yes — walk the import graph from the root .svelte file and collect every matching virtual style id (a parent's render imports child components, each emits its own scoped CSS module) |
| 4 | Where to inject into output | Pass as a new arg `native_svelte_css` to `build_styled_html`, concatenated after `universal_css` + `uno_css` + before `component_css`. Don't touch `clean_svelte_head` — it's still useful for the `<svelte:options css="injected" />` case |
| 5 | Coexistence with svelte-scoped | Both paths can run — IDs don't collide (svelte-scoped uses `__uno_*.svelte.css`, native uses `*.svelte?svelte&type=style&lang.css`). Adding native CSS extraction also makes the svelte-scoped + native-style mixed case work |
| 6 | Caching | None for now — the module-graph walk is cheap (in-memory map iteration). If profiling shows it's slow, cache by component_path |
| 7 | Verification fixture | Add a new component to `example/src/lib/components/` that uses ONLY native scoped CSS (no utility classes) + a story for it. Pixel-compare SSR vs CSR output — they should match (modulo CSR-specific reset timing) |
| 8 | Backward compat | Removing `csr: true` from `Welcome.stories.ts` in LD `site/` and re-running svelte-look should produce a styled screenshot identical to the CSR version |

## Phases

### Phase 1 — Verification fixture ✅
- [x] Add `example/src/lib/components/NativeScopedCard.svelte` — card with title/body/footer + native scoped `<style>` block, no utility classes.
- [x] Add `example/src/lib/components/NativeScopedCard.stories.ts` with `Default` story, viewport `400×220`. NO `csr: true`.
- [x] Run SSR baseline — **bug confirmed**: card renders fully unstyled (no border/bg/layout, title not blue). Saved to `/tmp/svelte-look-native-css/before_Default_english{,_dark}.png`.
- [x] Add `csr: true`, re-run → correct styling. Saved to `/tmp/svelte-look-native-css/csr-reference_Default_english{,_dark}.png`.
- [x] Removed `csr: true` again for fix verification.

### Phase 2 — Implementation ✅
- [x] Added `load_native_svelte_css({ vite, svelte_file })` to `src/render/css.ts` (walks module graph, matches `SVELTE_VIRTUAL_STYLE_ID_REGEX`, loads via `pluginContainer.load(id, { ssr: true })`, with symlink-temp-dir basename fallback for the root node lookup).
- [x] Extended `build_styled_html` with `native_svelte_css?` arg — inserted into `styles` array after `uno_css`, before `component_css` (SSR injected-head CSS).
- [x] `ssr_render_component` now returns `svelte_file` so the CLI reuses the same resolved path (no duplicated path logic).
- [x] Wired into `src/cli/index.ts` SSR branch.
- [x] Build clean (`pnpm build`).
- [x] **Fix verified**: SSR render of `NativeScopedCard` (no `csr: true`) now matches the CSR reference in BOTH light and dark mode. `/tmp/svelte-look-native-css/after_*.png`.

<details><summary>Original implementation sketch (kept for reference)</summary>

- [ ] In `src/render/css.ts`, add:
  ```ts
  const SVELTE_VIRTUAL_STYLE_ID_REGEX = /[?&]svelte&type=style&lang\.css$/

  export async function load_native_svelte_css({ vite, svelte_file }: {
    vite: ViteDevServer
    svelte_file: string
  }): Promise<string> {
    const parts: string[] = []
    const seen = new Set<string>()

    async function walk(file: string) {
      if (seen.has(file)) return
      seen.add(file)
      const node = vite.moduleGraph.getModuleById(file)
        ?? await vite.moduleGraph.getModuleByUrl(file).catch(() => undefined)
      if (!node) return
      for (const dep of node.importedModules) {
        const id = dep.id
        if (!id) continue
        if (SVELTE_VIRTUAL_STYLE_ID_REGEX.test(id)) {
          try {
            const loaded = await vite.pluginContainer.load(id, { ssr: true })
            const code = typeof loaded === 'string' ? loaded : loaded?.code
            if (code) parts.push(code)
          } catch (err) {
            console.warn(`[svelte-look] native scoped CSS load failed for ${id}:`, err)
          }
          continue
        }
        if (dep.id) await walk(dep.id)
      }
    }

    await walk(svelte_file)
    return parts.join('\n')
  }
  ```
- [ ] In `src/render/css.ts`, extend `build_styled_html` signature to accept `native_svelte_css?: string` and include it in the `styles` array (after `universal_css`, before `uno_css` so component-scoped rules win on conflicts, or after — verify with the fixture what feels right; I expect after `uno_css` to mirror existing CSS-layer order)
- [ ] In `src/cli/index.ts`, after `ssr_render_component`, compute the resolved svelte file path (same one ssr_render_component used: `join(cwd, 'src', component_path.slice(1) + '.svelte')`) and call `load_native_svelte_css`. Pass result to `build_styled_html`.
  - **Code-share opportunity**: extract the path computation to a small helper in `ssr.ts` and export it, or accept the svelte file path as a parameter passed from cli (cleaner). Pick one.
- [ ] Smoke-test: re-run `node dist/cli/index.js /lib/components/NativeScopedCard` (SSR, no csr flag). Output should now match the `csr-reference.png` from Phase 1.

</details>

### Phase 3 — Regression check on existing example app ✅
- [x] Re-ran svelte-look against all 8 existing example components (Button, Card, Counter, Badge, Toggle, TextInput, Alert, Tabs). All render without errors; UnoCSS styling intact (Badge green pill confirmed).
- [x] Confirmed no regression by logic: none of the existing components have native `<style>` blocks, so `load_native_svelte_css` returns `''` → byte-identical `styles` array to pre-fix. The change is purely additive.

### Phase 4 — Verify against LD `site/` ✅
- [x] `pnpm svelte-look /lib/Welcome` with `csr: true` still present — renders correctly (light + dark).
- [x] Removed `csr: true` from `src/lib/Welcome.stories.ts`, re-ran — **renders correctly now via SSR** (light + dark), identical to the CSR version. Fix verified against real consumer.
- [x] Only `Welcome.stories.ts` exists in LD `site/` — no other stories to clean up.

### Phase 5 — Cleanup + docs ✅
- [x] LD lesson learned updated (in `living-dictionaries/.issues/strip-unocss-from-site.md`): `csr: true` no longer needed solely for scoped `<style>` blocks now that svelte-look is fixed.
- [x] README — no change needed (never documented the limitation; the implicit "most components use SSR" promise is now actually true).
- [x] SKILL.md — no change needed (CSR section correctly scopes `csr: true` to `onMount`/browser-APIs/interactions; scoped CSS was never listed as a reason).
- [x] Updated `.issues/initial-architecture.md` — corrected the misleading "Gets `rendered.head` (component scoped CSS)" note to clarify it only applies to `<svelte:options css="injected" />` and to reference this issue + `load_native_svelte_css`.
- [x] Kept `example/src/lib/components/NativeScopedCard.{svelte,stories.ts}` as a permanent regression guard (the example app is svelte-look's test harness; without this fixture nothing exercises native scoped CSS in SSR).
- [ ] Commit (waiting on Jacob).

## Edge cases / gotchas to verify

- [x] **Style blocks with `<svelte:options css="injected" />`** — RESOLVED by design. In injected mode, vite-plugin-svelte inlines the CSS into the component JS (it surfaces in `render().head`) and does NOT emit a separate `?svelte&type=style&lang.css` virtual module. So the graph walk finds nothing for these components → no duplication. (LD email components use injected mode and have no svelte-look stories; they render via the email pipeline, unaffected.)
- [x] **CSS imported from a `.svelte` file's `<script>` block** (e.g. `import '$lib/foo.css'`) — not virtual style modules; the regex doesn't match them, so the walk skips them. They belong in `css_files`. Working as intended.
- [x] **Module graph populated in time** — `ssrLoadModule(svelte_file)` completes before we walk, so all transitively imported modules are in the graph. Verified empirically: `NativeScopedCard`'s scoped CSS was found and loaded.
- [x] **Symlinked temp_root** — handled. `find_root_node()` tries `getModuleById` → `getModuleByUrl` → basename match against `idToModuleMap.values()` (same fallback pattern as `generate_svelte_scoped_css`). In practice the fixture resolved fine without needing the basename fallback, but it's there for safety.

## Variant prefix mapping

(N/A — this issue is svelte-look code, no UnoCSS conversion involved.)

## Lessons learned

(empty — to be filled during execution)

## Resume notes

If picking this up in a new session:
1. Read this file's checkbox state.
2. The reproduction is in LD `site/` — `cd /home/jacob/code/living-dictionaries/site && pnpm svelte-look /lib/Welcome` after removing `csr: true` from `Welcome.stories.ts` shows the bug. Re-adding fixes it.
3. The svelte-look example app does NOT currently reproduce the bug — Phase 1 adds a fixture.
4. The fix mechanism mirrors `generate_svelte_scoped_css` in `src/render/css.ts` — same `vite.pluginContainer.load(id, { ssr: true })` pattern, different ID regex.
