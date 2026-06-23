# stdout is a machine protocol — apps must not be allowed to pollute it

## The contract

In the screenshot command, `svelte-look` writes **only** base64-encoded PNG(s) to stdout (one
per line when there are multiple outputs). The `list` command writes **only** component paths,
one per line. Everything else — usage, errors, "Screenshot saved to …", forwarded browser
console — goes to **stderr** (`console.error`).

Consumers rely on this. The Horse MCP wrapper (`horse/server/svelte-look-mcp-server.mjs` and the
in-process `svelte-look-tool.ts`) runs the CLI with `execSync`, then does
`stdout.trim().split('\n')` and turns each line into an MCP `image` content block.

## The bug this caused (2026-06)

The CLI renders an **arbitrary consumer app through Vite SSR in its own process**. Anything that
app (or a dependency) prints via `console.log` during module load or render lands on the CLI's
stdout, interleaved with the base64. A house app logged `[snapshot-cron] …` / `[log-retention] …`
on import; those two lines got prepended to the PNG base64. The MCP server then emitted them as
`image` blocks with non-base64 `data`, and the MCP client's schema validation rejected the
**entire** tool result (`Invalid Base64 string` on `content[0]`/`content[1]`) — so every
screenshot in the call was lost, not just the stray lines.

## The fix — svelte-look claims stdout

`src/cli/index.ts` rebinds `process.stdout.write` to forward to stderr, and keeps a private
`write_protocol` handle (captured before the rebind) for its own base64 / list output. So no
matter what the rendered app prints, only svelte-look's protocol bytes reach stdout. This is the
right layer to fix it: stdout ownership is svelte-look's responsibility, not every consumer app's.

## Defense-in-depth in the MCP server

The Horse wrapper additionally classifies each stdout line: only chunks starting with the PNG
base64 magic `iVBOR` (= the `\x89PNG` signature) become `image` blocks; anything else becomes a
`text` block, and it only hard-errors when zero images came through. So a future polluting app
degrades gracefully instead of nuking the whole result. (This change needs a Horse restart to
take effect, since the MCP server is a long-lived subprocess.)
