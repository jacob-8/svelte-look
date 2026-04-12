# svelte-look - Agent Instructions

## Project Overview

**svelte-look** is a CLI tool for screenshotting Svelte components. The agent workflow:
1. Write/update a `.stories.ts` file next to a component
2. Call `npx svelte-look /lib/components/Button --story Primary` → get a PNG screenshot

Uses Vite internally as a programmatic module compiler (not HTTP server) for SSR, and as a dev server for CSR rendering in Puppeteer.

## Tech Stack

| Category | Technology |
|----------|------------|
| Language | TypeScript (ESM) |
| Build | `tsc` (outputs to `dist/`) |
| Runtime | Node.js |
| Dependencies | `puppeteer-core`, `chrome-launcher` |
| Peer deps | `svelte ^5`, `vite ^6\|\|^7`, `@sveltejs/vite-plugin-svelte ^5\|\|^6\|\|^7` |
| Package Manager | pnpm |

## Project Structure

```
src/                          # Package source
├── cli/
│   ├── index.ts              # CLI entry point (bin: svelte-look)
│   └── list.ts               # List all .svelte files in src/
├── render/
│   ├── vite-loader.ts        # Vite server creation + HTTP mount server for CSR
│   ├── ssr.ts                # SSR render via svelte/server render()
│   ├── csr.ts                # CSR render via Puppeteer navigating to Vite-served mount page
│   └── css.ts                # CSS augmentation: universal CSS, UnoCSS generation, styled HTML assembly
├── stories/
│   ├── load.ts               # Load .stories.ts and mocks files via vite.ssrLoadModule
│   └── resolve.ts            # Merge mocks + shared_meta + story → ResolvedStory
├── screenshot/
│   └── puppeteer.ts          # Puppeteer browser management + HTML-to-PNG
├── config.ts                 # Load svelte-look.config.ts via vite.ssrLoadModule
├── types.ts                  # All type definitions
└── index.ts                  # Public exports (types + define_config)
dist/                         # tsc output
package.json
tsconfig.json

example/                      # Test SvelteKit + UnoCSS app for development
├── src/
├── svelte-look.config.ts
└── package.json
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Build with tsc |
| `pnpm dev` | Build in watch mode |
| `cd example && npx svelte-look list` | Test list command |
| `cd example && npx svelte-look /lib/components/Button --output /tmp/test.png` | Test screenshot |

## Two Rendering Paths

### SSR (default)
```
story → vite.ssrLoadModule → svelte/server render() → HTML string
  → augment with theme CSS + UnoCSS → page.setContent() → screenshot
```
- Used for simple components that don't need interactivity
- CSS augmented manually: universal CSS files + UnoCSS generation + component scoped CSS from render().head

### CSR (`csr: true` in story)
```
story → start HTTP server with Vite middleware → serve mount page HTML
  → Puppeteer navigates to mount URL → Svelte mount() in real browser
  → run interactions(page) → screenshot
```
- Used for components needing `$state` reactivity, `onMount`, browser APIs, or click interactions
- CSS handled automatically by Vite (UnoCSS plugin, component CSS, theme imports)
- Mount page HTML goes through `vite.transformIndexHtml()` to rewrite bare module specifiers
- Mount middleware is prepended to `vite.middlewares.stack` (must be before Vite's 404 handler)

## Key Architecture Details

### Vite as module compiler
- `vite.createServer({ server: { middlewareMode: true }, appType: 'custom' })` — not an HTTP server
- `vite.ssrLoadModule()` loads .svelte, .stories.ts, config files, and even `unocss` from the consuming project
- For CSR, a Node HTTP server wraps `vite.middlewares` to serve the mount page

### SvelteKit `$app/state` support
SSR populates the `__request__` Svelte context key with the story's page data, so `page.data.*` works during server rendering without needing `csr: true`. This mimics what SvelteKit does internally during its request pipeline.

### Story resolution order (later overrides earlier)
1. `default_page_data` / `default_contexts` from mocks file
2. Flavor `page_data` (if flavors exist in mocks)
3. `shared_meta` from stories file
4. Individual story

### Viewport resolution
- **Page/layout** (`+page.svelte`, `+layout.svelte`): story → shared_meta → config `page_viewports`
- **Regular components**: story → shared_meta → **error if none defined**

### UnoCSS integration
- Uses `vite.ssrLoadModule('unocss')` to load UnoCSS from the consuming project (not a direct dependency)
- Loads project's `uno.config.ts` via vite for the generator config
- For SSR: scans cleaned HTML (Svelte comment markers stripped) to generate utility CSS
- For CSR: UnoCSS Vite plugin handles everything automatically

### Svelte HTML cleanup
SSR output contains comment markers (`<!--[-->`, `<!--]-->`, `<!---->`, etc.) that must be stripped before UnoCSS scanning or they break class detection.

### SvelteKit route file naming
`+page.svelte` → `_page.stories.ts`, `+layout.svelte` → `_layout.stories.ts` (the `+` prefix has special meaning in SvelteKit routing)

### Flavors
Named sets of `page_data` overrides defined in the mocks file:
```ts
export const flavors: Record<string, Flavor> = {
  world: { page_data: { region: 'world', mother: 'en' } },
  china: { page_data: { region: 'china', mother: 'zh' } },
}
```
- Auto-inferred from mocks `flavors` export — no config needed
- First flavor used by default, `--flavor <name>` for specific, `--all-flavors` for all
- Stories opt out with `flavors: false` on shared_meta or individual story
- Merge order: `default_page_data → flavor.page_data → shared_meta.page_data → story.page_data`

### Dark mode
- Enabled via `dark_mode: true` in `svelte-look.config.ts`
- Renders both light and dark variants as separate images
- SSR: adds `class="dark"` to `<html>` + `prefers-color-scheme: dark` media emulation
- CSR: same plus `document.documentElement.classList.add('dark')` after navigation
- Stories opt out with `dark: false` on shared_meta or individual story
- Output filenames get `_dark` suffix; base64 stdout outputs as separate newline-delimited chunks
- Body defaults: `background: var(--background, #ffffff); color: var(--color, #000000)` — consuming projects override via CSS custom properties

## Important Gotchas

- `vite.ssrLoadModule()` always compiles `.svelte` with `generate: 'server'` — cannot mount client-side in Node.js. This is why CSR uses Puppeteer navigation instead.
- `vite.transformIndexHtml()` is required for mount pages — browsers can't resolve bare specifiers like `import { mount } from 'svelte'`
- The mount middleware must be prepended (`stack.unshift`) to Vite's middleware stack, not appended
- UnoCSS `import('unocss')` from svelte-look's dist/ fails — must use `vite.ssrLoadModule('unocss')` which resolves from the consuming project's node_modules
