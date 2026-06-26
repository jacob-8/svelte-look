# rendering

How svelte-look turns a story into pixels, and the ways the two paths (SSR vs CSR) can diverge.

## Pages

- [ssr-vs-csr-invalid-html.md](./ssr-vs-csr-invalid-html.md) — invalid HTML (nested anchors/buttons) renders fine under CSR but breaks under SSR, because SSR round-trips through an HTML string + `setContent` reparse.
- [when-csr-is-required.md](./when-csr-is-required.md) — which stories genuinely need `csr: true` (onMount/browser-API/live-fetch/interactions) vs. not (scoped CSS is SSR-handled now), and the render-and-eyeball discipline for safely dropping the flag.
