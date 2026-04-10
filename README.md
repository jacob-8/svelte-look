# svelte-look

Screenshot Svelte components from the command line. No dev server needed.

```bash
npx svelte-look /lib/components/Button --story Primary
```

Write a `.stories.ts` file next to your component, run the CLI, get a PNG (base64 to stdout or saved to a file).

## Agent prompt

Add this to your agent's system prompt or project instructions:

> Install svelte-look if not yet installed: `pnpm add -D github:jacob-8/svelte-look`. Copy `node_modules/svelte-look/SKILL.md` into your project's skills directory (e.g. `.claude/skills/svelte-look/SKILL.md` or `.pi/skills/svelte-look/SKILL.md`) and update any paths in the skill file to match your project's structure. Create a `svelte-look.config.ts` in the project root if it doesn't exist (see the skill file for config options). Read the skill file for instructions on writing `.stories.ts` files and using the `npx svelte-look` CLI to screenshot components.
