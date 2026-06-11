# svelte-look - Agent Instructions

## Project Overview

**svelte-look** is a CLI tool for screenshotting Svelte components + a Vite plugin for browsing stories in dev mode. Two modes:

1. **CLI**: Write/update a `.stories.ts` file → `npx svelte-look /lib/components/Button --story Primary` → get a PNG screenshot
2. **Dev UI**: Add `svelte_look()` Vite plugin → navigate to `/__look/` → browse and preview all component stories interactively

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
│   └── css.ts                # CSS augmentation: universal CSS, native Svelte scoped CSS, styled HTML assembly
├── stories/
│   ├── load.ts               # Load .stories.ts and mocks files via vite.ssrLoadModule
│   └── resolve.ts            # Merge mocks + shared_meta + story → ResolvedStory
├── screenshot/
│   └── puppeteer.ts          # Puppeteer browser management + HTML-to-PNG
├── plugin/
│   ├── index.ts              # Vite plugin: dev UI at /__look/ + mount handler
│   ├── api.ts                # Scan for .stories.ts files, load story metadata
│   └── ui.ts                 # HTML template for the dev UI
├── config.ts                 # Load svelte-look.config.ts via vite.ssrLoadModule
├── types.ts                  # All type definitions
└── index.ts                  # Public exports (types + define_config)
dist/                         # tsc output
package.json
tsconfig.json

example/                      # Test SvelteKit app for development
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
| `cd example && npx svelte-look /lib/components/Button --output /tmp/test.png` | Test screenshot (viewport only) |
| `cd example && npx svelte-look /lib/components/Button --full-page --output /tmp/test.png` | Test screenshot (full scrollable page) |

## Two Rendering Paths

### SSR (default)
```
story → vite.ssrLoadModule → svelte/server render() → HTML string
  → augment with theme CSS + native Svelte scoped CSS → page.setContent() → screenshot
```
- Used for simple components that don't need interactivity
- CSS augmented manually: universal CSS files (`css_files`) + native Svelte scoped `<style>` CSS (`load_native_svelte_css`) + any inlined CSS from render().head

### CSR (`csr: true` in story)
```
story → start HTTP server with Vite middleware → serve mount page HTML
  → Puppeteer navigates to mount URL → Svelte mount() in real browser
  → run interactions(page) → screenshot
```
- Used for components needing `$state` reactivity, `onMount`, browser APIs, or click interactions
- CSS handled automatically by Vite (component scoped CSS, theme imports)
- Mount page HTML goes through `vite.transformIndexHtml()` to rewrite bare module specifiers
- Mount middleware is prepended to `vite.middlewares.stack` (must be before Vite's 404 handler)

## Key Architecture Details

### Vite as module compiler
- `vite.createServer({ server: { middlewareMode: true }, appType: 'custom' })` — not an HTTP server
- `vite.ssrLoadModule()` loads .svelte, .stories.ts, and config files from the consuming project
- For CSR, a Node HTTP server wraps `vite.middlewares` to serve the mount page

### SvelteKit `$app/state` support
- **SSR**: Populates the `__request__` Svelte context key with the story's page data, so `page.data.*` works during server rendering. This mimics what SvelteKit does internally during its request pipeline.
- **CSR**: A Vite plugin (`app_state_shim_plugin` in `vite-loader.ts`) intercepts `$app/state`'s `client.js` module and replaces it with a proxy that reads from `window.__svelte_look_page__`. The mount handler sets this global before calling `mount()`. Only `client.js` is intercepted (not `index.js`) to preserve SSR's `getContext('__request__')` path. This avoids importing SvelteKit's full client runtime which hangs due to deep dependency chains (`state.svelte.js` → `utils.js` → `$app/paths` → full SvelteKit client`).

### Story resolution order (later overrides earlier)
1. `default_page_data` / `default_contexts` from mocks file
2. Flavor `page_data` (if flavors exist in mocks)
3. `shared_meta` from stories file
4. Individual story

### Viewport resolution
- **Page/layout** (`+page.svelte`, `+layout.svelte`): story → shared_meta → config `page_viewports`
- **Regular components**: story → shared_meta → **error if none defined**

### Styling model (native Svelte CSS only)
svelte-look is Svelte-native-CSS-only. There is no UnoCSS / utility-class support. Components get styled from:
- **Scoped `<style>` blocks** — Svelte 5 extracts each component's `<style>` to a separate virtual CSS module (`?svelte&type=style&lang.css`) rather than inlining it into `render().head` (inlining only happens with `<svelte:options css="injected" />`). SSR never fetches those virtual modules on its own, so `load_native_svelte_css` (in `css.ts`) walks the module graph from the root .svelte file, collects every matching virtual style id, and loads each via the Vite plugin container to recover the scoped CSS. CSR gets this automatically from the Vite dev server.
- **Global stylesheets** via `css_files` / `css_imports` (see CSS imports below).

### Svelte HTML cleanup
SSR output contains Svelte 5 control-flow comment markers that serve no purpose in static screenshot HTML. `clean_svelte_html` (in `ssr.ts`) strips them with `<!--(?:\[(?:!|-?\d+)?|\]|[a-z0-9]{6}|)-->`. The markers Svelte 5 emits:

- `<!---->` empty placeholder
- `<!--[-->` fragment open (each/if/await/key)
- `<!--[!-->` else-branch open
- `<!--]-->` fragment close
- `<!--[N-->` / `<!--[-N-->` keyed-each numeric anchors (e.g. `<!--[0-->`, `<!--[-1-->`)
- `<!--<6 hex>-->` boundary hash (e.g. `<!--abc123-->`)

### SvelteKit route file naming
`+page.svelte` → `_page.stories.ts`, `+layout.svelte` → `_layout.stories.ts` (the `+` prefix has special meaning in SvelteKit routing)

### CSS imports
Two config options for loading CSS into CSR mount pages:
- `css_files`: Local file paths relative to project root (e.g. `'src/lib/theme.css'`) — imported as `import '/${file}'`
- `css_imports`: Module specifiers resolved by Vite (e.g. `'modern-normalize/modern-normalize.css'`) — imported as `import 'module'`. Used for CSS from npm packages that can't be referenced by file path.

Both are injected into the CSR mount page HTML. For SSR, `css_files` are loaded via `load_universal_css` (reads from disk); `css_imports` are not needed for SSR since the consuming project's Vite plugins handle module resolution.

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

### Screenshot clipping
- **Default**: Screenshots are clipped to the viewport dimensions (the viewport defined in the story or config's `page_viewports`). This produces consistent, predictable image sizes.
- **`--full-page`**: Captures the entire scrollable content. Useful for seeing all rendered content but produces variable-height images.

## Dev UI (Vite Plugin)

### Routes
- `/__look/` — Main UI with sidebar component tree, filter, iframe preview
- `/__look/api/components` — JSON API listing all components with story names and flavors
- `/__svelte-look__/mount?component=...&story=...` — Renders a single story (used by iframe)

### Architecture
- The `svelte_look()` plugin returns an array: `[app_state_shim_plugin, dev_ui_plugin]`
- Uses `configureServer` to add middleware to the user's Vite dev server
- Loads `svelte-look.config.ts` and stories via `vite.ssrLoadModule()` on first request
- The mount handler reuses `generate_mount_html()` from `render/vite-loader.ts`
- Dark mode: adds `class="dark"` to `<html>` and passes `&dark=1` query param
- Everything renders CSR in the dev UI (the SSR path is CLI-only for screenshots)

## Important Gotchas

- `vite.ssrLoadModule()` always compiles `.svelte` with `generate: 'server'` — cannot mount client-side in Node.js. This is why CSR uses Puppeteer navigation instead.
- `vite.transformIndexHtml()` is required for mount pages — browsers can't resolve bare specifiers like `import { mount } from 'svelte'`
- The mount middleware must be prepended (`stack.unshift`) to Vite's middleware stack, not appended
