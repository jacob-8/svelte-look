# Remove `csr: true` that was only needed for scoped-CSS in SSR

## Background
svelte-look's SSR path now loads native Svelte scoped `<style>` CSS automatically
(`load_native_svelte_css`, verified in the unocss-removal work). Previously, any
component with a scoped `<style>` block had to use `csr: true` in its story to get
styled screenshots. That workaround is no longer needed.

## Goal
For tutor, living-dictionaries, house:
1. ✅ Confirm each `site/` is linked to the current local svelte-look and using it.
   - All three: `"svelte-look": "link:../../svelte-look"` → symlink resolves to `~/code/svelte-look`. dist rebuilt this session. living-dictionaries + house symlinks valid; tutor valid.
2. Remove `csr: true` ONLY from stories that had it solely for the CSS issue.
   - KEEP `csr: true` where genuinely needed: `interactions` present, `onMount`/browser
     APIs, `$state` mutated post-mount, or browser-only content.
3. Screenshot affected components (light) to verify they still render styled in SSR.

## Scope notes
- ONLY edit files under `src/`. Ignore tutor's `.build-web-world/` and `.build-web-china/`
  (generated build artifacts — they mirror src and will regenerate).
- living-dictionaries: NO `csr: true` story files found → nothing to do there beyond link confirm.

## Triage rule
A story's `csr: true` is **CSS-only (remove it)** if the file has NO `interactions`
key AND the component doesn't rely on mount-time/browser behavior. If `interactions`
is present, or the component needs the browser, **keep** `csr: true`.

## Candidate files (csr: true, src only)

### tutor/site/src
- [ ] svelte-pieces/Modal.stories.ts
- [ ] svelte-pieces/ProgressBar.stories.ts
- [ ] layout/Auth.stories.ts
- [ ] mocks/ChatScreenshot.stories.ts
- [ ] mocks/ClipboardScreenshot.stories.ts
- [ ] mocks/TranscriptionScreenshot.stories.ts
- [ ] mocks/BookScreenshot.stories.ts
- [ ] stt/TranscribeSettingsModal.stories.ts
- [ ] aligner/components/VariantPicker.stories.ts
- [ ] routes/admin/messages/[thread_id]/_page.stories.ts
- [ ] routes/admin/messages/_page.stories.ts
- [ ] routes/admin/users/[user_id]/_page.stories.ts
- [ ] routes/admin/users/_page.stories.ts
- [ ] routes/landing-china/_page.stories.ts
- [ ] routes/_layout.stories.ts
- [ ] routes/_page.stories.ts
- [ ] routes/account/_page.stories.ts
- [ ] routes/aligner/_page.stories.ts
- [ ] routes/chat/[chat_id]/MessageUser.stories.ts
- [ ] routes/chat/[chat_id]/SearchToggles.stories.ts
- [ ] routes/chat/[chat_id]/Sources.stories.ts
- [ ] routes/data/_page.stories.ts
- [ ] routes/notes/[note_id]/_page.stories.ts
- [ ] routes/notes/_page.stories.ts
- [ ] routes/texts/AddFromMetadataModal.stories.ts
- [ ] routes/texts/_page.stories.ts
- [ ] routes/words/_page.stories.ts

### house/site/src
- [ ] (40 files — see grep list; triage same rule)

## Progress / decisions

### Method
Static-scan each candidate component for browser signals (onMount/window/document/
portal/observers/$effect), then render via SSR to verify. Bulk-removed the
`csr: true,` shared_meta line via `sed` on an explicit file list, then re-added csr
to interaction-only stories. Verified with screenshots (`--flavor world`, light+dark).

### tutor — DONE editing
- ✅ ProgressBar — removed (pure). Verified SSR identical to CSR baseline.
- ✅ Modal — removed. Portal content renders inline + styled in SSR. Verified.
- ✅ _layout (routes) — removed. Header/shell render styled in SSR. Verified.
- ✅ Auth, ChatScreenshot, ClipboardScreenshot, TranscriptionScreenshot, BookScreenshot — removed (pure). (montage render in progress)
- ✅ TranscribeSettingsModal — removed shared_meta csr; **re-added `csr: true` to `WithVad`** (has interactions).
- ✅ admin/messages/[thread_id], admin/messages, admin/users/[user_id], admin/users, landing-china, _page(home), account, chat/MessageUser, chat/SearchToggles, chat/Sources, notes/[note_id], notes, texts/AddFromMetadataModal, texts, words — removed ($effect/pure). (montage render in progress)
- ⛔ **data/_page — REVERTED to `csr: true`**: SSR crashes (`Cannot read properties of undefined (reading 'migrations')`) — needs browser/more mock data, NOT css-only.
- ⛔ **aligner/_page — LEFT unchanged** (`csr: true`): WebGPU/worker page; Default + WorkerEcho both need the browser, not css-only.
- (VariantPicker: shared_meta had no csr; only `Opened` has csr+interactions — untouched.)

### tutor — ✅ COMPLETE & VERIFIED
- Batch SSR render: only Auth crashed (localStorage) → reverted. All 19 others render styled in SSR.
- ⛔ **Auth — REVERTED to `csr: true`** (SSR crash `localStorage is not defined` from an import; not css-only).
- Verified via screenshots: Sources/SearchToggles/MessageUser/TranscribeSettingsModal/account page all styled in SSR.
- git diff confirms edits isolated to `.stories.ts` (Modal had pre-existing uncommitted work — untouched by me except csr line).
- Net: removed css-only csr from 18 stories; kept csr on data, aligner, Auth, TranscribeSettingsModal/WithVad, VariantPicker/Opened.

### house — ✅ COMPLETE & VERIFIED
Batch SSR render: zero crashes. Visual review caught client-mount regressions → reverted 4.
- ⛔ **REVERTED to `csr: true`** (not css-only — need browser):
  - **RichTextEditor** — editor body empty in SSR (mounts via dynamic import + onMount). (file already documented this.)
  - **doc/[id]/edit/_page** — embeds RichTextEditor for section bodies (empty in SSR).
  - **img/[id]/edit/_page** — embeds RichTextEditor for description (empty in SSR).
  - **SearchPage** — results from client-side Orama index built in onMount (SSR shows "0 results").
  Added explanatory comments to each on revert.
- ✅ Removed css-only csr from the rest; verified styled in SSR (home, Chapter, Text, account×, doc view,
  vid/edit [plain textareas], intro, dr-house, Modal/Slideover/SubscribeModal/PlaceIntoDocumentModal
  portals render inline, ColorSchemeToggle, ImageThumb [window-guarded], previews, admin pages, etc.).
- Kept per-story csr: UserMenu/Open, PreviewImage/WithGcsUrl, PreviewVideo/FullData.
- Kept entirely: admin/schema (svelte-flow graph).
- git diff confirms edits isolated to `.stories.ts` (Modal had pre-existing uncommitted work — only csr line touched).

### house — (was IN PROGRESS)
Flavors: default/signed_in/signed_in_admin (render with `--flavor default`).
- KEPT entirely (real browser needs):
  - **admin/schema/_page** — svelte-flow graph; Default + Cards + FocusedView all need browser (csr=3).
- Manual (removed blanket shared csr, kept per-story csr):
  - **UserMenu** — removed shared; kept csr on `Open` (interactions). Admin/NonAdmin → SSR.
  - **PreviewImage** — removed shared; kept csr on `WithGcsUrl` (remote image). NoSource/DescriptionFallback → SSR.
  - **PreviewVideo** — removed shared; kept csr on `FullData` (remote thumbnail). NoThumbnail → SSR.
- Bulk-removed shared csr from 36 files (sed). Rendering all to verify; will revert any that crash
  (like tutor data/Auth) or render blank (onMount/editor-gated content).
- WATCH for likely reverts: RichTextEditor (client editor), Slideover, SubscribeModal,
  SearchPage, ColorSchemeToggle, account (portal/window) — verify each renders styled.

### living-dictionaries — ✅ COMPLETE
No `csr: true` story files (only `Welcome.stories.ts`). Link confirmed + smoke-rendered
`/lib/Welcome` with the current build → renders styled (SSR). Nothing to change.

## FINAL STATUS — all three done; awaiting maintainer review (do not commit)
- tutor: removed css-only csr from 18 stories; kept csr on data, aligner, Auth, TranscribeSettingsModal/WithVad, VariantPicker/Opened.
- house: removed css-only csr from ~32; reverted 4 (RichTextEditor, doc/edit, img/edit, SearchPage); kept admin/schema, UserMenu/Open, PreviewImage/WithGcsUrl, PreviewVideo/FullData.
- living-dictionaries: none to change.
- All edits isolated to `.stories.ts`. Verification screenshots in /tmp/csr-check/{tutor,house,ld}/.

### Reusable lesson
Static "PURE" scan of a component is NOT sufficient — Auth (tutor) crashed on `localStorage`
from an imported module, and editor/search components render blank (not crash) when content is
client-mounted. Always do an SSR render + visual check before trusting a csr removal. Crashes are
caught by exit codes; blanks must be caught visually.
