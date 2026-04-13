---
title: Vite plugin dev UI at /__look/
---

## Goal

Add a Vite plugin that users add to their `vite.config.ts` that serves a dev UI at `/__look/`. Similar to how `__unocss`, `__nuxt_devtools`, etc. work - it's a Vite plugin that adds middleware to the dev server.

## Architecture

### Export a Vite plugin from `svelte-look`

Users add it to their `vite.config.ts`:
```ts
import { svelte_look } from 'svelte-look/vite'

export default defineConfig({
  plugins: [svelte_look(), sveltekit(), ...],
})
```

### Plugin middleware routes

The plugin uses `configureServer` to add middleware to the Vite dev server:

- `/__look/` — main HTML UI showing component list with stories
- `/__look/api/components` — JSON API returning all components + their story names, flavors, viewports, etc.
- `/__svelte-look__/mount?component=...&story=...` — renders a component (reuse existing mount page logic from `vite-loader.ts`)

### The UI

A simple server-rendered HTML page (no framework for the UI itself). The flow:

1. `/__look/` — shows all components that have `.stories.ts` files, grouped by directory
2. Each component is expandable or links to iterations
3. Clicking an iteration loads it in an iframe (or navigates to `/__look/view?...` which wraps the mount URL in a frame)

The UI can use the existing `/__svelte-look__/mount` handler to render stories. Currently that handler is inside `start_mount_server` which creates a separate HTTP server. For the plugin, we move/share that mount handler logic so it works on the user's Vite dev server directly.

## File Plan

### New files

- `src/plugin/index.ts` — Vite plugin: `configureServer` hook adds middleware for `/__look/` UI and `/__svelte-look__/mount`
- `src/plugin/api.ts` — Functions to scan for stories files, load them via `vite.ssrLoadModule`, return component/story metadata as JSON
- `src/plugin/ui.ts` — HTML template generation for the dev UI

### Modifications

- `src/index.ts` — Keep as is (types + define_config)
- `package.json` — Add `"./vite"` export pointing to `dist/plugin/index.js`

### Reuse from existing code

- `list.ts` logic for finding `.stories.ts` files (adapt to only find ones with stories)
- `load_stories_module` and `load_mocks_module` from `stories/load.ts`
- `resolve_story` from `stories/resolve.ts` for getting viewports/flavors
- `load_config` from `config.ts`
- Mount HTML template from `vite-loader.ts` (the `mount_handler` function)
- `app_state_shim_plugin` from `vite-loader.ts` (plugin needs this too since it runs in the user's Vite)

Actually - the plugin IS running inside the user's Vite server, so `vite.ssrLoadModule` is available directly. The `app_state_shim_plugin` would need to be added alongside the main plugin, or the main plugin can return an array.

Wait, actually the user's vite config probably already has `@sveltejs/vite-plugin-svelte` which handles `.svelte` compilation. But it won't have the `app_state_shim_plugin`. So the `svelte_look()` plugin should include both the dev UI middleware AND the `$app/state` shim.

## Implementation Plan

### Step 1: Create `src/plugin/index.ts`

The main Vite plugin:
- `name: 'svelte-look'`
- `configureServer(server)` — add middleware
- Returns array with `app_state_shim_plugin()` included

### Step 2: Create `src/plugin/api.ts`

- `get_components_with_stories({ vite, cwd, config })` — finds all `.stories.ts` files, loads them, returns structured data:
  ```ts
  interface ComponentInfo {
    component_path: string  // e.g. /lib/components/Button
    stories: string[]       // e.g. ['Primary', 'Secondary', 'Danger']
    has_flavors: boolean
    flavor_names: string[]
    has_csr: boolean
  }
  ```

### Step 3: Create `src/plugin/ui.ts`

HTML templates:
- `render_index_page(components)` — the main listing page
- Clicking a story navigates to `/__look/view/<component_path>/<story_name>` or loads in iframe

### Step 4: Mount handler

Move/refactor mount handler from `vite-loader.ts` so it can be used by both:
1. The CLI (which creates its own HTTP server)
2. The plugin (which hooks into the user's Vite dev server)

Both need the same mount HTML generation logic. Extract `generate_mount_html()` function.

### Step 5: Package exports

Add to `package.json`:
```json
{
  "exports": {
    ".": "./dist/index.js",
    "./vite": "./dist/plugin/index.js"
  }
}
```

## UI Design

Simple, clean HTML. Dark sidebar with component tree, main area shows the rendered component in an iframe.

Layout:
```
┌─────────────────┬──────────────────────────────────┐
│ 🔍 Filter       │                                  │
│                  │                                  │
│ ▸ lib/components │   [iframe: rendered component]   │
│   Button         │                                  │
│     Primary      │                                  │
│     Secondary    │                                  │
│     Danger       │                                  │
│   Card           │                                  │
│     Default      │                                  │
│   ...            │                                  │
│                  │                                  │
│ ▸ routes         │                                  │
│   +page          │                                  │
│     Default      │                                  │
└─────────────────┴──────────────────────────────────┘
```

## Questions
- None, ready to build

## Progress
- ✅ Extract mount HTML generation from vite-loader.ts into shared function
- ✅ Create src/plugin/api.ts  
- ✅ Create src/plugin/ui.ts
- ✅ Create src/plugin/index.ts
- ✅ Update package.json exports
- ✅ Build and test with example app
- ✅ Verified: sidebar, filter, story selection, iframe rendering, dark toggle, flavor select, page routes all working
