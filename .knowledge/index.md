# svelte-look knowledge

Compounding reference for svelte-look internals and gotchas.

## Categories

- [cli/](./cli/index.md) — the CLI's stdout protocol (base64 PNGs / paths) and how it's kept clean for machine consumers
- [vite/](./vite/index.md) — Vite integration details, SvelteKit plugin interactions, temp-root isolation strategy
- [rendering/](./rendering/index.md) — SSR vs CSR rendering paths and where they diverge (e.g. invalid HTML)
- [testing/](./testing/index.md) — How to verify svelte-look doesn't trigger consumer dev server reloads

## See also

- `AGENTS.md` (repo root) — always-on context for agents working in this repo
- `SKILL.md` (repo root) — task-specific playbook for common svelte-look work
- `.issues/` — in-progress plans (if any)
