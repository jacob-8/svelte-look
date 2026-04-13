# Dark mode support

## ✅ COMPLETE

Implemented and verified — light/dark variants render as separate images with correct backgrounds.

### Changes:
- `src/types.ts` — `dark_mode?: boolean` on `SvelteLookConfig`, `dark?: false` on `StoryMeta`
- `src/render/css.ts` — `dark` param on `build_styled_html`, `class="dark"` on html, body defaults to `var(--background, #ffffff)`
- `src/screenshot/puppeteer.ts` — `dark` param on `html_to_png`, `prefers-color-scheme` emulation
- `src/render/csr.ts` — `dark` param, media emulation + classList
- `src/cli/index.ts` — dark variant loop, `_dark` suffix on filenames
- `sample/svelte-look.config.ts` — enabled `dark_mode: true`
- `sample/src/lib/theme.css` — added `.dark` CSS variables

### Also fixed:
- Body background was transparent in Puppeteer (pre-existing) — now defaults to `var(--background, #ffffff)`
