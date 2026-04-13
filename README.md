# svelte-look

Screenshot Svelte components from the command line. Allows your agent to easily get visual feedback when working on Svelte components. Runs Vite on its so requires no manual dev server management.

Example cli command:

```bash
npx svelte-look /lib/components/Button --story Primary
```

In short, your agent writes a `.stories.ts` file next to your component, runs the CLI, and gets a PNG returned (base64 to stdout or saved to a file).

## Vite Plugin — Dev UI

Browse all your component stories interactively in the browser at `/__look/` during development.

```ts
// vite.config.ts
import { svelte_look } from 'svelte-look/vite'

export default defineConfig({
  plugins: [
    svelte_look(),
    sveltekit(),
  ],
})
```

Then run `pnpm dev` and open `http://localhost:5173/__look/` (adjust port to match your dev server). You'll see a sidebar with all components that have `.stories.ts` files. Click any story to preview it live. Includes filter, dark mode toggle, and flavor switching.

## Agent prompt to install and setup

Add this to your agent's system prompt or project instructions:

> Install svelte-look if not yet installed: `pnpm add -D github:jacob-8/svelte-look`. Copy `node_modules/svelte-look/SKILL.md` into your project's skills directory (e.g. `.claude/skills/svelte-look/SKILL.md` or `.pi/skills/svelte-look/SKILL.md`) and update any paths in the skill file to match your project's structure. Create a `svelte-look.config.ts` in the project root if it doesn't exist (see the skill file for config options). Read the skill file for instructions on writing `.stories.ts` files and using the `npx svelte-look` CLI to screenshot components. Add `svelte_look()` from `svelte-look/vite` to your `vite.config.ts` plugins array (before `sveltekit()`) to enable the dev UI at `/__look/`.
