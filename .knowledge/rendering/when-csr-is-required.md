# When a story actually needs `csr: true` (and how to verify dropping it)

Most stories should be SSR (the default). `csr: true` exists for the cases where the
*visible* output depends on a real browser mount. Knowing which is which — and
**never trusting a static code scan to decide** — saves a lot of silently-wrong screenshots.

## `csr: true` IS genuinely required when…

- **`onMount` / `$effect` produces visible content** — e.g. a client-side search index built
  in `onMount` (results are empty under SSR), a rich-text editor mounted via dynamic import
  (body renders blank under SSR), or layout measured after mount.
- **A browser-only API is touched** — `window`, `document`, `localStorage`,
  `devicePixelRatio`, observers, etc. Watch the subtle case: the API may be touched at the
  **top level of an imported module**, not in the component itself — that *crashes* SSR
  (tutor's `Auth` story crashed on `localStorage is not defined` from an import, not from its
  own template).
- **A live network fetch happens in `onMount`** — e.g. a House video tile with no
  pre-supplied `uri`/`pictures` fetches its Vimeo thumbnail on mount; SSR can't run that, so
  the thumbnail is missing. Note this is **per-story / per-data**: the *same component* is
  SSR-safe when the story pre-supplies the data (House `PreviewVideo` ships `uri`+`pictures`
  → SSR fine) and needs CSR when it doesn't (`SideMargin` renders a real video with neither).
- **`$state` is mutated after mount, or the story has `interactions`** (clicks etc.).

## `csr: true` is NOT required for…

- **Scoped `<style>` CSS** — this used to be the #1 *false* reason to add `csr: true`.
  Since `load_native_svelte_css`, SSR loads Svelte 5's native scoped CSS (see AGENTS.md
  "Styling model"). A component that only needed CSR to look styled can drop the flag.
- (Historically) **UnoCSS utility classes** — moot now that UnoCSS support is removed and
  all consumers are on native scoped CSS.

## Verification discipline — render, don't reason

A static "is this component pure?" scan is **not sufficient** to justify dropping `csr: true`.
Always render the story under SSR and **visually compare** to a CSR baseline before keeping
the change. Two distinct failure classes, caught two different ways:

- **Crashes** → non-zero exit code. Easy to catch automatically.
- **Silent wrongness** (exit 0, but the PNG is wrong) → must be caught **by eye**:
  - *Blank / missing content* — client-mounted output (editors, search results, live-fetch
    thumbnails) that SSR never produced.
  - *Layout breaks* — usually invalid HTML reparsed by `setContent`; see
    [ssr-vs-csr-invalid-html.md](./ssr-vs-csr-invalid-html.md).

So the loop is: drop `csr`, render SSR for *every* variant in the file, eyeball each against
its CSR baseline, and only keep the removal where they match. Re-add (with a comment stating
the *real* reason) wherever they don't.
