---
title: CSR rendering via Puppeteer + Vite dev server
type: feature
---

## Goal

Enable true client-side rendering for `csr: true` stories by navigating Puppeteer to a Vite-served mount page. This gives us real browser mounting, $state reactivity, onMount, and click interactivity via Puppeteer's Page API.

## Architecture

### Current SSR flow (unchanged)
```
story → Node: ssrLoadModule → svelte/server render() → HTML string
  → augment with theme CSS + UnoCSS → page.setContent() → screenshot
```

### New CSR flow
```
story → Node: load story to get interactions function
  → Start HTTP server with Vite middleware
  → Middleware serves mount page HTML that imports component + stories in browser
  → Puppeteer navigates to mount page URL → component mounts client-side
  → Run interactions(page) from Node against Puppeteer
  → Screenshot
```

Key insight: CSS "just works" in CSR mode because Vite's dev server handles everything — component scoped CSS, UnoCSS plugin, theme CSS imports. No manual CSS augmentation needed.

## Changes needed

### 1. `src/types.ts` — add interactions field
```ts
export interface StoryMeta {
  // ...existing...
  /** Puppeteer Page interactions to run before screenshot (requires csr: true) */
  interactions?: (page: any) => Promise<void>
}
```
Using `any` for Page type to avoid leaking puppeteer-core types into consuming project story files.

### 2. `src/render/vite-loader.ts` — add HTTP server
- Add middleware to vite.middlewares for `/__svelte-look__` mount route
- Create Node http.createServer using vite.middlewares
- Listen on random port (port 0)
- Export `get_mount_server_url()` function
- Mount page HTML generation: imports component, stories module, mocks module (if configured), CSS files, and `virtual:uno.css`

Mount page template (generated per-request based on URL params):
```html
<!DOCTYPE html>
<html>
<head><style>body { font-family: sans-serif; }</style></head>
<body>
<script type="module">
  import '/src/lib/theme.css'        // from config.css_files
  import 'virtual:uno.css'           // if uno.config exists
  import { mount } from 'svelte'
  import Component from '/src/lib/components/Counter.svelte'
  import * as stories from '/src/lib/components/Counter.stories.ts'

  // if mocks configured:
  import * as mocks from '/src/lib/mocks/svelte-look-mocks.ts'

  const story = stories['Default'] ?? { props: {} }
  const shared = stories.shared_meta

  // resolve props, page_data, contexts (simplified version of resolve.ts logic)
  let props = story.props ?? {}
  // for pages: props = { data: { ...mocks.default_page_data, ...shared?.page_data, ...story.page_data, ...props } }

  const contexts = [
    ...(mocks?.default_contexts ?? []),
    ...(shared?.contexts ?? []),
    ...(story.contexts ?? []),
  ]
  const context = new Map(contexts.map(({ key, value }) => [key, value]))

  mount(Component, { target: document.body, props, context })
  window.__svelte_look_mounted__ = true
</script>
</body>
</html>
```

Context keys work because browser imports the same modules the component uses (same module graph, same references).

### 3. `src/render/csr.ts` — rewrite for Puppeteer navigation
```ts
export async function csr_render_component({ ... }): Promise<Buffer> {
  const url = await get_mount_server_url(...)
  const browser = await get_browser()
  const page = await browser.newPage()
  await page.setViewport({ width, height })
  await page.goto(url, { waitUntil: 'networkidle0' })
  await page.waitForFunction('window.__svelte_look_mounted__')

  if (resolved_story.interactions)
    await resolved_story.interactions(page)

  const buffer = Buffer.from(await page.screenshot({ type: 'png', fullPage: true }))
  await page.close()
  return buffer
}
```

CSR returns a PNG Buffer directly (no separate HTML→PNG step needed).

### 4. `src/cli/index.ts` — update CSR branch
For CSR stories, skip the CSS augmentation pipeline. CSR returns a Buffer directly.

### 5. `src/stories/resolve.ts` — pass through interactions
Add `interactions` to ResolvedStory.

### 6. Sample Counter.stories.ts — add interaction story
```ts
export const Incremented: Story<typeof Component> = {
  props: {},
  viewports: [{ width: 250, height: 70 }],
  interactions: async (page) => {
    const buttons = await page.$$('button')
    await buttons[1].click()  // click +
    await buttons[1].click()  // click + again
  },
}
```

## Things to watch out for
- `virtual:uno.css` import may error if project doesn't use UnoCSS — conditionally add based on uno.config existence
- Port cleanup: close HTTP server in `close_vite_loader()`
- `networkidle0` wait should be sufficient for mount, but `__svelte_look_mounted__` flag is a safety net
- Interactions need a small delay after mount for Svelte to flush state? Probably not since mount is synchronous, but test.
- Remove happy-dom dependency since CSR no longer needs it

## Implementation order
1. ✅ Types — added `interactions` to StoryMeta and ResolvedStory
2. ✅ vite-loader.ts — HTTP server with Vite middleware + mount page handler
3. ✅ csr.ts — rewritten to navigate Puppeteer to mount URL
4. ✅ resolve.ts — passes `interactions` through
5. ✅ cli/index.ts — CSR branch returns Buffer directly, no CSS augmentation
6. ✅ Sample Counter.stories.ts — Default + Incremented (clicks + 3 times → shows 3)
7. ✅ All tests pass — SSR (Button, Card) and CSR (Counter Default, Counter Incremented)
8. ✅ Removed happy-dom dependency

## Key lessons
- `vite.transformIndexHtml()` is required — browser can't resolve bare module specifiers like `import { mount } from 'svelte'` in raw HTML. Vite's transformIndexHtml rewrites them to `/node_modules/.vite/deps/svelte.js?v=...`
- Middleware must be prepended (unshift into `vite.middlewares.stack`) since Vite's own middleware handles 404s
- CSS "just works" in CSR mode — Vite serves component CSS, UnoCSS plugin generates utilities, theme CSS is imported. No manual augmentation needed.
- `networkidle0` + `__svelte_look_mounted__` flag ensures mount completes before interactions run
- Vite HMR debug messages appear in browser console (harmless, from vite.middlewares serving dev client)
