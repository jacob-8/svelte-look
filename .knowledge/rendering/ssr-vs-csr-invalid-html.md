# Invalid HTML breaks SSR screenshots but not CSR

## The gotcha

A component can look correct in the dev UI / CSR screenshot but render **wrong** in the
default SSR screenshot — specifically when its markup is *invalid HTML*, most commonly
**nested interactive elements**: an `<a>` (or `<button>`) inside another `<a>`.

Real example that triggered this (House preview cards): an outer `<a class="preview-card">`
wrapping the whole card, with an inner `<a class="verse-link">` (and admin `<button>`s)
in the body. CSR rendered the card as a normal flex row; SSR rendered it as a broken
vertical stack with chunks of content missing.

## Why the two paths differ

- **CSR** (`csr: true`): svelte-look mounts via Svelte's `mount()` in a real browser. The
  DOM is built **programmatically**, node by node — the HTML parser's "tag soup" repair
  rules never run, so technically-invalid nesting is preserved as authored and the layout
  holds.
- **SSR** (default): svelte-look calls `render()` from `svelte/server` to get an HTML
  **string**, then hands it to Puppeteer via `page.setContent(html)`. The browser **parses
  that string**, and the parser *auto-corrects* invalid nesting per the HTML spec — e.g. it
  **closes the open outer `<a>` the moment it sees a nested `<a>`**. That silently
  restructures the DOM (the flex container gets closed early), so siblings reflow / stack
  and styled descendants end up outside their intended parent.

So the divergence is not a svelte-look bug — it's the HTML parser doing spec-mandated
repair on a string that the programmatic CSR path never had to round-trip through.

## Symptoms

- A flex/grid card "collapses" to a vertical stack only under SSR.
- Trailing content (badges, verse links, action buttons) is missing or mispositioned in
  the SSR PNG but present in the CSR PNG.
- Published/simple variants look fine; the variant that adds a nested `<a>`/`<button>` is
  the one that breaks.

## How to confirm

Render the same story both ways and diff: it renders correctly with `csr: true` and breaks
without it. Then look for nested interactive elements in the component markup.

## Fixes (in the consuming component — svelte-look can't repair invalid HTML)

- **Stretched-link pattern**: make the card a `<div position:relative>`, drop in one
  absolutely-positioned overlay `<a class="card-link" inset:0 z-index:1>` (carry the href +
  an `aria-label`), and give the real secondary links/buttons `position:relative; z-index:2`
  so they sit above the overlay and stay clickable. Whole-card click + hover are preserved,
  the HTML is valid, and a11y improves (no nested interactive elements).
- Or simply don't nest interactive elements (e.g. the primary link wraps only the
  non-interactive media + title; verse links sit as siblings).

After fixing, the component renders identically under SSR and the story can drop `csr: true`.

## Takeaway

If an SSR screenshot looks structurally broken but CSR is fine, suspect **invalid HTML**
(nested anchors/buttons are the usual culprit) before suspecting svelte-look's CSS loading
or the temp-root setup.
