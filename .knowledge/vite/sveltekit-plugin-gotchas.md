# SvelteKit Vite plugin gotchas

## `root` override via captured `process.cwd()`

`@sveltejs/kit/src/exports/vite/index.js` does this at module top-level:

```js
const cwd = process.cwd();
// ...later, in config() hook:
const new_config = { root: cwd, /* ... */ }
```

That `cwd` is captured **once when the module is first imported**, and the plugin's `config()` hook force-sets Vite's `root` to it. Any `root` value we pass to `createServer({ root: ... })` gets silently overridden.

Vite emits the warning: `The following Vite config options will be overridden by SvelteKit: - root`. Easy to miss, always important.

### How we work around it

In `create_vite_loader`:
```ts
process.chdir(temp_root)       // before import
const { createServer } = await import('vite')
// createServer transitively imports user's vite.config → kit plugin → sees temp_root as cwd → root = temp_root ✓
```

Order matters: **chdir must happen before the first `import('vite')` in the process**. Once the kit module has been imported anywhere in the process, its captured `cwd` is baked in.

## `kit.outDir` is joined with `root`

Default `kit.outDir` is `.svelte-kit`. It's stored relative and joined with the current root. So once our root is temp_root (via chdir), kit writes to `<temp_root>/.svelte-kit/` instead of the real project's. Exactly what we want.

## Generated files ignored by kit's own watcher

```js
watch: { ignored: [`${posixify(kit.outDir)}/!(generated)`] }
```

Kit tells Vite to ignore everything under `kit.outDir` EXCEPT the `generated/` subdir. This is why edits to route files trigger regen + HMR — kit watches its own `generated/` for changes. When our secondary Vite instance wrote to the primary's `generated/`, the primary's kit plugin saw those writes as "someone edited a generated file" and triggered reload.

## `$app/state` client vs SSR paths

Kit exposes `$app/state` (the new `$app/stores` replacement in SvelteKit 2) via two paths:
- SSR: reads from Svelte context key `__request__`
- CSR: reads from a client module

svelte-look's CSR renderer intercepts `$app/state/client.js` with a Vite plugin (`app_state_shim_plugin` in `vite-loader.ts`) that swaps in a Proxy reading from `window.__svelte_look_page__`. The SSR renderer sets the `__request__` context directly in `ssr.ts`.

Only the **client** module is intercepted — importing the full SvelteKit client runtime hangs due to deep dep chains (`state.svelte.js → utils.js → $app/paths → full kit client`). Intercepting just `client.js` gives us page state access without pulling in the full runtime.
