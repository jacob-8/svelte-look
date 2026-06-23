# cli

The `svelte-look` CLI and the contract its output makes with machine consumers (scripts, the Horse MCP server).

## Pages

- [stdout-is-a-protocol.md](./stdout-is-a-protocol.md) — stdout carries ONLY base64 PNG(s) / component paths; all incidental output (including the rendered app's `console.log`) is funneled to stderr so it can't corrupt the stream.
