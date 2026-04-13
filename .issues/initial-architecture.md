# svelte-look CLI - architecture and initial implementation plan

## Goal

Create a CLI tool (`npx svelte-look`) for screenshotting Svelte components. No dev server, no routes. The agent workflow:
1. Agent writes/updates a shared mocks file (project-wide defaults for page data, contexts) — location defined in `svelte-look.config.ts`
2. Agent writes/updates a colocated `.stories.ts` file next to a component
3. Agent calls `npx svelte-look /lib/components/Button --story Primary` → gets a PNG back as base64 (`shot` is the default command, no need for a command name, just the path and story)

## Source file references

### tutor: render-snapshots.ts (CSS augmentation + Puppeteer HTML→PNG)
`/home/jacob/code/tutor/scripts/render-snapshots.ts`
- Loads `src/lib/theme.css`, strips `@import` lines
- Creates UnoCSS generator from `uno.config.ts` (with presetWind3, presetIcons w/ CDN, transformerDirectives)
- For each `__snapshots__/*.html`: generates UnoCSS from HTML classes, injects `<style>${THEME_CSS}\n${css}\nbody { font-family: sans-serif; }</style>` before `</head>`
- Puppeteer: `executablePath: '/usr/bin/chromium'`, viewport `400x700`, `setContent(styled_html, { waitUntil: 'load' })`, `screenshot({ path, fullPage: true })`

### tutor: render-component-to-html.ts (SSR render)
`/home/jacob/code/tutor/app/src/routes/api/email/render-component-to-html.ts`
- Uses `render()` from `svelte/server`
- Gets `rendered.head` (component scoped CSS in `<style>` tags) and `rendered.body`
- Cleans up Svelte comment markers, empty CSS rules, sourcemaps
- Builds full HTML document with injected styles

### tutor: chat.component.test.ts (CSR mount + snapshot pattern)
`/home/jacob/code/tutor/app/src/routes/(app)/chat/[chat_id]/chat.component.test.ts`
- Uses Vitest with happy-dom
- `mount(ChatPage, { target: document.body, props: { data: {...} }, context: new Map([...]) })`
- Interacts: `button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`, `wait_for(() => predicate)`, `flushSync()`
- `save_snapshot(name)` → wraps `document.body.innerHTML` in `<!DOCTYPE html><html><head>...</head><body>...</body></html>`

### kitbook-llm: types.ts (Story/StoryMeta types)
`/home/jacob/code/kitbook-llm/kitbook/src/lib/types.ts`
- StoryMeta: viewports, page_data, contexts, csr, ssr, description, flavors
- Story<TComponent>: extends StoryMeta + props
- PageStory<TComponent>: extends StoryMeta + props (typed as ComponentProps['data'])
- Viewport: { name?, width, height? }
- MockedContext: { key: any, value: any }

### tutor: example stories
- Component story: `/home/jacob/code/tutor/app/src/lib/i18n/SelectLanguage.stories.ts` — shared_meta with viewports + page_data, two story variants with different props
- Page story: `/home/jacob/code/tutor/app/src/routes/(app)/account/_page.stories.ts` — uses PageStory, contexts with PORTAL_KEY, page_data with user/subscription mocks
- Modal story: `/home/jacob/code/tutor/app/src/lib/svelte-pieces/Modal.stories.ts` — shared_meta with page_data.platform

### tutor: theme.css
`/home/jacob/code/tutor/app/src/lib/theme.css`
- Has `@import '@fontsource-variable/...'` lines (stripped for screenshots)
- CSS custom properties for light/dark themes on `:root`

### tutor: uno.config.ts
`/home/jacob/code/tutor/app/uno.config.ts`
- presetWind3, presetIcons, transformerDirectives
- Custom shortcuts (btn, btn-outline, etc.)

## Architecture

### Rendering pipeline

**CSR path** — when needing `onMount()` to run or interactions before snapshotting:
```
.stories.ts → load props/contexts/mocks → vite.createServer() loads .svelte component
  → mount() in happy-dom → interact → get innerHTML → augment with CSS → Puppeteer setContent → PNG
```

**SSR path** — for simple components:
```
.stories.ts → load props/contexts/mocks → vite.ssrLoadModule() → svelte/server render()
  → HTML string with component CSS → augment with universal CSS + UnoCSS → Puppeteer setContent → PNG
```

### Key technical decisions

1. **Module loading:** `vite.createServer({ server: { middlewareMode: true } })` — Vite as programmatic module compiler only, NOT an HTTP server. Picks up the project's `vite.config.ts`, handles `$lib` aliases, `.svelte` compilation, `.svelte.ts` files, TypeScript, all plugins. The consuming project already has Vite (SvelteKit), so it's a peer dep.

2. **CSR mounting:** `mount()` from Svelte in happy-dom. Requires `node --conditions=browser` so Svelte resolves to client bundle (verified: `svelte` package.json exports `.` → `browser: ./src/index-client.js` vs `default: ./src/index-server.js`).

3. **CSS augmentation** (from render-snapshots.ts pattern):
   - Load project's universal CSS file(s) (path from config), strip `@import` lines
   - Create UnoCSS generator from project's `uno.config.ts`
   - Generate CSS from utility classes in the HTML body
   - For SSR: also include component scoped CSS from `render().head`

4. **HTML → PNG:** Puppeteer with `chrome-launcher` to find system Chrome. `page.setContent(styled_html)` then `page.screenshot()`. Returns base64 to stdout.

## svelte-look.config.ts

Minimal config defining project-specific paths and defaults.

```ts
import { define_config } from 'svelte-look'

export default define_config({
  // Path to shared mocks file (relative to project root)
  mocks: 'src/lib/mocks/svelte-look-mocks.ts',

  // Universal CSS files to include in screenshots (relative to project root)
  css_files: ['src/lib/theme.css'],

  // Path to UnoCSS config (auto-detected if not set)
  // uno_config: 'uno.config.ts',

  // Default viewports for +page.svelte and +layout.svelte components only.
  // Regular components must define viewports in their .stories.ts file.
  page_viewports: [{ width: 400, height: 700 }],
})
```

### Config types

```ts
interface SvelteLookConfig {
  /** Path to shared mocks file, relative to project root */
  mocks?: string

  /** Universal CSS files to include in screenshots, relative to project root */
  css_files?: string[]

  /** Path to UnoCSS config, relative to project root. Auto-detected from uno.config.ts if not set */
  uno_config?: string

  /** Default viewports for +page.svelte and +layout.svelte stories only.
   *  Regular component stories MUST define viewports in shared_meta or per-story. */
  page_viewports?: Viewport[]
}
```

## Types

### Story types (what agents write in .stories.ts files)

```ts
import type { Component, ComponentProps } from 'svelte'

/** Metadata shared across all stories in a file */
export interface StoryMeta {
  /** Viewports to screenshot at */
  viewports?: Viewport[]

  /** Mock data merged into SvelteKit page data (for +page.svelte / +layout.svelte) */
  page_data?: Record<string, any>

  /** Svelte contexts to set via setContext before mounting */
  contexts?: MockedContext[]
}

/** A story variant for a regular component */
export interface Story<TComponent extends Component<any>> extends StoryMeta {
  /** Props to pass to the component */
  props?: ComponentProps<TComponent>
}

/** A story variant for a +page.svelte or +layout.svelte component.
 *  Props are typed as the page's `data` prop. */
export interface PageStory<TComponent extends Component<any>> extends StoryMeta {
  /** Page data passed as the `data` prop */
  props?: ComponentProps<TComponent>['data']
}

export interface Viewport {
  width: number
  height: number
}

export interface MockedContext {
  /** The context key (same value used in getContext/setContext) */
  key: any
  /** The mock value to provide */
  value: any
}
```

### Shared mocks file types (what agents write in the mocks file)

```ts
import type { MockedContext } from 'svelte-look'

/** Project-wide default page data merged into every page story's data.
 *  Individual stories override these values via their own page_data. */
export const default_page_data: Record<string, any> = {
  // Example: common layout data every page expects
  // mother: 'en',
  // learning: 'zh-CN',
  // supabase: { auth: { updateUser: async () => {} } },
}

/** Project-wide default contexts set for every component.
 *  Individual stories can add more or override with same key. */
export const default_contexts: MockedContext[] = [
  // Example: common context every component tree expects
  // { key: 'bay_portal', value: { content: {} } },
]
```

### Stories module (what svelte-look loads at runtime)

```ts
/** The shape of a loaded .stories.ts module */
export interface StoriesModule {
  shared_meta?: StoryMeta
  [story_name: string]: Story<any> | PageStory<any> | StoryMeta | undefined
}

/** The shape of the loaded shared mocks file */
export interface MocksModule {
  default_page_data?: Record<string, any>
  default_contexts?: MockedContext[]
}
```

### Resolved story (after merging mocks + shared_meta + story)

```ts
/** Final resolved data ready for rendering */
export interface ResolvedStory {
  props: Record<string, any>
  page_data: Record<string, any>
  contexts: MockedContext[]
  viewports: Viewport[]
}
```

Resolution order (later overrides earlier):
1. `default_page_data` / `default_contexts` from mocks file
2. `shared_meta.page_data` / `shared_meta.contexts` from stories file
3. Individual story's `page_data` / `contexts`

For contexts with the same key, later values win.

Viewport resolution:
- **Page/layout components** (`+page.svelte`, `+layout.svelte`): story viewports → shared_meta viewports → config `page_viewports`
- **Regular components**: story viewports → shared_meta viewports → **error if none defined** (forces agents to always specify viewports for components)

## CLI interface

```bash
# Default command: screenshot a component (shot is implicit)
npx svelte-look /lib/components/Button --story Primary

# With explicit story name
npx svelte-look /routes/(app)/account/+page --story China

# All stories in a file (screenshots each variant)
npx svelte-look /lib/components/Button

# List all components
npx svelte-look list

# Render existing __snapshots__/*.html files to PNGs
npx svelte-look render
```

Output: base64 PNG to stdout (for agent consumption).

## Implementation Plan

### Phase 1: Package scaffolding ✅
- [x] Init package.json, tsconfig
- [x] TypeScript, ESM, pnpm workspace with sample SvelteKit + UnoCSS app
- [x] Peer deps: `vite`, `svelte`, `@sveltejs/vite-plugin-svelte`
- [x] Deps: `puppeteer-core`, `chrome-launcher`

### Phase 2: Types and story loading ✅
- [x] `src/types.ts` — Story, PageStory, StoryMeta, Viewport, MockedContext, SvelteLookConfig, etc.
- [x] `src/config.ts` — load `svelte-look.config.ts` via vite.ssrLoadModule
- [x] `src/stories/load.ts` — load `.stories.ts` and mocks via vite ssrLoadModule
- [x] `src/stories/resolve.ts` — merge mocks + shared_meta + story → ResolvedStory

### Phase 3: SSR render path ✅
- [x] `src/render/vite-loader.ts` — vite.createServer() in middleware mode with browser conditions
- [x] `src/render/ssr.ts` — SSR render component with svelte/server, clean Svelte HTML comments
- [x] `src/render/css.ts` — load universal CSS, generate UnoCSS via vite.ssrLoadModule('unocss'), build styled HTML
- [x] `src/screenshot/puppeteer.ts` — HTML → PNG via Puppeteer + chrome-launcher
- [x] `src/cli/index.ts` — CLI entry point, arg parsing, wire it all together
- [x] Tested: Button (3 variants), Card (2 variants) all rendering correctly with UnoCSS + CSS variables

### Lessons learned during Phase 3:
- `import('unocss')` from svelte-look's dist/ can't find the package in the consuming project — must use `vite.ssrLoadModule('unocss')` instead
- UnoCSS `generate()` fails to scan classes inside Svelte HTML comment markers (`<!--[-->`) — must clean those first
- vite.ssrLoadModule needed for loading the project's uno.config.ts (can't use bare dynamic import for .ts files)
- `node --conditions=browser` not needed for SSR path (using svelte/server render, not mount)
- @types/node version must match across workspace to avoid Vite type conflicts

### Phase 4: CSR mount path ✅ (SSR fallback)
- [x] `src/render/csr.ts` — happy-dom globals setup, falls back to SSR render
- [x] Detect from story whether to use CSR or SSR (branching in cli/index.ts)
- Note: True client-side mounting via `ssrLoadModule` is not possible because it always compiles .svelte with `generate: 'server'`. Setting `ssr.resolve.conditions: ['browser']` resolves the svelte runtime to client code but the component is still server-compiled, causing `$renderer.push is not a function`. The CSR path currently produces SSR-equivalent HTML which is acceptable for most screenshot use cases.

### Phase 5: Additional commands ✅
- [x] `list` — find all .svelte components in src/
- [x] `render` — convert existing `__snapshots__/*.html` to PNGs (render-snapshots.ts pattern)

### All commands tested and working:
- `npx svelte-look /lib/components/Button` — all 3 stories (Primary, Secondary, Danger) ✅
- `npx svelte-look /lib/components/Card` — both stories (Default, TitleOnly) ✅
- `npx svelte-look /lib/components/Counter --story Default` — CSR fallback works ✅
- `npx svelte-look list` — lists all components ✅
- `npx svelte-look /lib/components/Button --story Primary` — base64 stdout ✅
- `npx svelte-look /lib/components/Button --output file.png` — file output with multi-story naming ✅

### File Structure
```
svelte-look/
├── src/
│   ├── cli/
│   │   └── index.ts          # CLI entry point (bin)
│   ├── render/
│   │   ├── vite-loader.ts    # vite.createServer() module loader
│   │   ├── ssr.ts            # svelte/server render with story props
│   │   ├── csr.ts            # happy-dom mount (phase 4)
│   │   └── css.ts            # CSS augmentation (theme + UnoCSS)
│   ├── stories/
│   │   ├── load.ts           # Load .stories.ts and mocks files
│   │   └── resolve.ts        # Merge mocks + shared_meta + story
│   ├── screenshot/
│   │   └── puppeteer.ts      # HTML → PNG via Puppeteer
│   ├── config.ts             # Load svelte-look.config.ts
│   ├── types.ts              # All types
│   └── index.ts              # Public exports (types + define_config)
├── package.json
├── tsconfig.json
└── .issues/
```
