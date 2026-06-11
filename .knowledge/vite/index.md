# Vite knowledge

- [temp-root-isolation.md](./temp-root-isolation.md) — Why we run Vite in a temp dir (symlinked top-level dirs + copied top-level files) to avoid triggering the consumer's running dev server
- [sveltekit-plugin-gotchas.md](./sveltekit-plugin-gotchas.md) — SvelteKit's Vite plugin captures `process.cwd()` at import time and force-sets Vite's `root`, overriding our config
