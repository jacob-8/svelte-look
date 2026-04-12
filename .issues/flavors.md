---
title: Add flavors support for named page_data presets
---

## ✅ COMPLETE

Implemented and verified with screenshots.

### Changes:
- `src/types.ts` — `Flavor` type, `flavors` on `MocksModule`, `flavors?: false` opt-out on `StoryMeta`
- `src/stories/resolve.ts` — `flavor` param in merge chain
- `src/cli/index.ts` — `--flavor <name>`, `--all-flavors` flags, `get_flavors_to_render()`
- `src/index.ts` — exports `Flavor` type
- `sample/src/lib/mocks/svelte-look-mocks.ts` — example english/spanish flavors
