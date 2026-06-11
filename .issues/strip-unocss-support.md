# Remove UnoCSS support entirely from svelte-look

svelte-look currently has substantial machinery to handle UnoCSS (both stock `unocss/vite` and `@unocss/svelte-scoped/vite`). The maintainer is removing UnoCSS from all consuming projects and wants svelte-look to be **Svelte-native-CSS-only**: scoped `<style>` blocks (already handled by `load_native_svelte_css`), global stylesheets via `css_files` / `css_imports`, and that's it.

This is a deliberate scoping decision: svelte-look drops UnoCSS support as a feature. Any consumer still on UnoCSS would need to either stay on an older version or migrate off UnoCSS.

## Context: how rendering works after this change

- **SSR path** (default): `render()` from `svelte/server` → body + head; then `load_native_svelte_css` walks the module graph for `?svelte&type=style&lang.css` virtual modules (Svelte 5 scoped CSS) → concatenate with `css_files` → screenshot. (The `load_native_svelte_css` function was just added in `.issues/ssr-native-svelte-scoped-css.md` and is the reason scoped CSS now works in SSR without `csr: true`.)
- **CSR path** (`csr: true`): mount in real browser via Vite dev server, which serves all CSS imports automatically. No UnoCSS warm-up needed once UnoCSS is gone.

## Prerequisite

The sibling fix `.issues/ssr-native-svelte-scoped-css.md` (load native Svelte scoped CSS in SSR) MUST be complete first — it's what makes SSR work for styled components without UnoCSS. (As of writing it's implemented and verified; just confirm `load_native_svelte_css` exists in `src/render/css.ts` before starting.)

## Decisions locked in

| # | Decision | Choice |
|---|---|---|
| 1 | Scope | Full removal — core lib + example app + docs. End state: zero UnoCSS references in `src/`, example app rewritten to native scoped CSS. |
| 2 | `css_imports` config field | **KEEP** — it's general-purpose (import any CSS module by specifier, e.g. a design-system reset). Only update its doc comment which currently references `@unocss/reset/tailwind.css`. |
| 3 | `css_files` config field | KEEP — unchanged. |
| 4 | `uno_config` config field | REMOVE from `SvelteLookConfig`. |
| 5 | `clean_svelte_html()` in ssr.ts | **KEEP the function** (stripping Svelte comment markers still yields cleaner screenshot HTML) but **trim the big UnoCSS-rationale comment block** down to a one-liner. |
| 6 | Example app components | Rewrite all 8 (Alert, Badge, Button, Card, Counter, Tabs, TextInput, Toggle) from UnoCSS utility classes to native scoped `<style>` blocks. Keep visual output as close as reasonable — these are just dev fixtures, exact pixel parity not required, but they should look intentional and exercise the theme CSS vars. |
| 7 | Example `uno.config.ts` | DELETE. |
| 8 | Example `vite.config.ts` | Remove `UnoCSS()` plugin + import. |
| 9 | Example `package.json` | Remove `unocss` devDependency. |
| 10 | `NativeScopedCard` fixture | KEEP (added by the sibling issue as the SSR-scoped-CSS regression guard). |
| 11 | Verification | Re-render every example component (CLI) + dev UI (`/__look/`) loads; all render correctly in light + dark. `tsc` build clean. |

## Inventory of UnoCSS code to remove

### `src/render/css.ts`
- [ ] DELETE `generate_uno_css()` (entire function, ~lines 31–64).
- [ ] DELETE `generate_svelte_scoped_css()` (entire helper, ~lines 66–126).
- [ ] DELETE `escape_regex()` (~lines 128–130) — only used by `generate_svelte_scoped_css`. **VERIFY** `load_native_svelte_css` doesn't use it (it doesn't — it uses `endsWith`).
- [ ] Update import on line 5: `import { is_svelte_scoped_project, start_mount_server } from './vite-loader.js'` — both become unused in this file after deletions. **Remove the entire import line.** (`start_mount_server` is still used by `csr.ts`, just not here.)
- [ ] Remove the stale comment lines 7–8 (`// `cwd` retained in signature...`).
- [ ] `build_styled_html`: remove the `uno_css` param and its slot in the `styles` array. New signature: `{ body, component_css, universal_css, native_svelte_css, dark }`. New array: `[universal_css, native_svelte_css ?? '', component_css]`.
- [ ] KEEP `load_universal_css`, `SVELTE_VIRTUAL_STYLE_ID_REGEX`, `load_native_svelte_css`.

### `src/render/vite-loader.ts`
- [ ] DELETE `is_svelte_scoped_project()` (~lines 180–187).
- [ ] DELETE `prepare_unocss_for_mount()` (~lines 239–261).
- [ ] DELETE `warmup_module_tree()` (~lines 263–280) — only used by `prepare_unocss_for_mount`.
- [ ] DELETE `invalidate_unocss_modules()` + `UNOCSS_RESOLVED_ID_RE` (~lines 282–291).
- [ ] `build_css_imports()`: strip the svelte-scoped branch + `uno_import`/`virtual:uno.css` logic. New return type: `{ css_imports_str: string }` only. Remove `existsSync`/`join` usage if now unused (check — `join` may still be used elsewhere; `existsSync` likely becomes unused → remove import).
- [ ] `generate_mount_html()`: remove `uno_import` and `head_extra` params + the `${uno_import}` line in the template. (Keep `${head_extra ?? ''}` removal too — head_extra only carried the svelte-scoped global `<link>`.)
- [ ] `start_mount_server()`: remove the `prepare_unocss_for_mount({ vite, component_path })` call (line ~212); update the `build_css_imports` destructure to just `{ css_imports_str }`; update the `generate_mount_html` call args.
- [ ] KEEP: `create_vite_loader`, `app_state_shim_plugin`, `find_stories_src_path`, `close_vite_loader`, `start_mount_server` (minus uno bits).

### `src/render/csr.ts`
- [ ] DELETE the "belt-and-suspenders for UnoCSS" block (~lines 52–70) — the `page.evaluate` that finds `style[data-vite-dev-id*="uno"]` and cache-busts it. After removal, CSR just relies on `networkidle0` + `waitForFunction('window.__svelte_look_mounted__')`. Keep the interactions call + screenshot.

### `src/plugin/index.ts`
- [ ] Remove `prepare_unocss_for_mount` from the import on line 3.
- [ ] Remove the `uno_import` and `head_extra` local vars (lines 39–40) and their assignments (lines 64, 65, 104, 105).
- [ ] Remove the `prepare_unocss_for_mount({ vite, component_path })` call (line 116).
- [ ] Update both `build_css_imports` destructures to `{ css_imports_str }` and the `generate_mount_html` call args.

### `src/cli/index.ts`
- [ ] Remove `generate_uno_css` from the import on line 5.
- [ ] Remove the `const uno_css = await generate_uno_css(...)` line (~159) and the `uno_css` arg passed to `build_styled_html` (~165).

### `src/types.ts`
- [ ] Remove `uno_config?: string` (line 74).
- [ ] Update the `css_imports` comment (line 72): drop the `@unocss/reset/tailwind.css` example; use a neutral example like `'modern-normalize/modern-normalize.css'` or `'@fontsource/inter'`.

### `src/render/ssr.ts`
- [ ] Trim the `clean_svelte_html` doc comment (lines ~50–67): keep a 1-line explanation ("Strip Svelte 5 SSR control-flow comment markers for cleaner screenshot HTML"), drop the UnoCSS-extractor rationale. Keep the function + regex.

### Docs — `AGENTS.md`
- [ ] Remove/rewrite all UnoCSS sections: the "UnoCSS integration" section (~lines 109–125), the comment-marker UnoCSS-killer rationale, the `css_imports` unocss-reset example (~line 133), the `vite.ssrLoadModule('unocss')` note (~line 183), and references on lines 34, 51, 72, 75, 84, 92. Replace with the simplified native-CSS-only model.

### Example app — `example/`
- [ ] DELETE `example/uno.config.ts`.
- [ ] `example/vite.config.ts`: remove `import UnoCSS from 'unocss/vite'` and the `UnoCSS()` plugin entry.
- [ ] `example/package.json`: remove `"unocss"` devDependency. Run `pnpm install` after.
- [ ] Rewrite all 8 components to native scoped `<style>` (read each, port utility classes to CSS using the theme vars in `example/src/lib/theme.css`):
  - `Alert.svelte`, `Badge.svelte`, `Button.svelte`, `Card.svelte`, `Counter.svelte`, `Tabs.svelte`, `TextInput.svelte`, `Toggle.svelte`
  - Note: some use `class:` directives with arbitrary-value utilities (e.g. Button's `class:bg-[var(--primary)]={variant === 'primary'}`) — convert to `class={['btn', variant]}` + scoped rules per variant.
- [ ] Check `example/src/routes/+page.svelte` (also uses utility classes) — convert too.

## Phases

### Phase 0 — Confirm prerequisite
- [ ] Confirm `load_native_svelte_css` exists in `src/render/css.ts` and SSR renders scoped CSS (sibling issue done). If not, stop and finish that first.

### Phase 1 — Strip core library
- [ ] Edit `css.ts`, `vite-loader.ts`, `csr.ts`, `plugin/index.ts`, `cli/index.ts`, `types.ts`, `ssr.ts` per inventory above.
- [ ] `pnpm build` (tsc) clean — fix any now-unused imports (`existsSync`, `join`, etc.).

### Phase 2 — Rewrite example app
- [ ] Delete `uno.config.ts`; edit `vite.config.ts`, `package.json`; `pnpm install`.
- [ ] Rewrite all 8 components + `+page.svelte` to native scoped CSS.

### Phase 3 — Verify
- [ ] `pnpm build` clean.
- [ ] CLI: render each example component — `cd example && node ../dist/cli/index.js /lib/components/<Name>`. All render styled in light + dark.
- [ ] Render `NativeScopedCard` (regression guard) — still correct.
- [ ] Dev UI: `cd example && pnpm dev`, open `/__look/`, confirm sidebar + previews work (light/dark/flavor toggles).
- [ ] Grep sweep: `grep -rni 'uno\|svelte-scoped' src/ example/` returns nothing (except possibly historical `.issues/` notes, which are fine).

### Phase 4 — Docs + wrap-up
- [ ] Update `AGENTS.md`.
- [ ] Update README if it mentions UnoCSS (it currently does NOT — verify).
- [ ] Update SKILL.md if needed (currently no UnoCSS mention — verify).
- [ ] Bump notes / changelog if the repo keeps one.
- [ ] Report to maintainer; on confirmation extract any lessons to `.knowledge/` and delete this issue file. **Do not commit unless told.**

## Gotchas

- `start_mount_server` is shared: used by `csr.ts` (keep) — only its internal uno bits go. Don't delete the function.
- `build_css_imports` return shape changes from 3 fields to 1 — update ALL call sites (vite-loader `start_mount_server`, plugin/index.ts ×2).
- `generate_mount_html` signature changes — update both call sites (vite-loader, plugin).
- After removing `existsSync`/`join` usage, check each file's imports for now-unused symbols (tsc with the repo's settings may or may not error on unused; lint might). Clean them up.
- The example app is svelte-look's only test harness — if a component renders wrong after rewrite, that's a real signal. Compare against git-stashed pre-rewrite screenshots if unsure.
- Don't touch the pre-existing unrelated uncommitted work in the repo (there's in-progress work across several files from prior sessions). Scope edits to UnoCSS removal only.

## Progress

- ✅ Phase 0 — `load_native_svelte_css` confirmed present in `css.ts`.
- ✅ Phase 1 — core lib stripped: `css.ts`, `vite-loader.ts`, `csr.ts`, `plugin/index.ts`, `cli/index.ts`, `types.ts`, `ssr.ts`. `tsc` clean.
- ✅ Phase 2 — deleted `uno.config.ts`; removed UnoCSS from `vite.config.ts` + `package.json`; `pnpm install`; rewrote all 8 components + `+page.svelte` to native scoped CSS.
- ✅ Phase 3 — rebuilt clean; rendered every example component (light+dark) via CLI; NativeScopedCard regression guard correct; dev UI `/__look/`, API, and mount endpoint all return 200 and styled.
- ✅ Phase 4 — updated `AGENTS.md`; verified README/SKILL had no UnoCSS refs; removed obsolete `.knowledge/unocss/` category + index links; cleaned `temp-root-isolation.md` example.

## Lessons learned

- `build_css_imports` no longer needs `cwd`/`vite` — now `{ config }` → `{ css_imports_str }`. Updated all 3 call sites (vite-loader `start_mount_server`, plugin ×2). `start_mount_server`/`csr.ts`/`css.ts` still pass `cwd` to `start_mount_server` (unused now but harmless; tsconfig has no `noUnusedParameters`).
- After removing UnoCSS, the CSR "belt-and-suspenders" cache-bust step in `csr.ts` was no longer needed — CSR relies purely on `networkidle0` + `__svelte_look_mounted__`.
- Svelte 5 `class={['btn', variant]}` and `class={['tab', { active }]}` array/object syntax works cleanly as a replacement for `class:` directives with arbitrary-value utilities.
- Native scoped descendant selectors (e.g. `.track.checked .thumb`) scope and render correctly in both SSR (via `load_native_svelte_css`) and CSR.
