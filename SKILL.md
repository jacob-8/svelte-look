# svelte-look — Component Screenshot CLI

Screenshot Svelte components from the command line. Write a `.stories.ts` file, run the CLI, get a PNG.

## CLI Commands

### Screenshot a component
```bash
npx svelte-look /lib/components/Button                    # all stories
npx svelte-look /lib/components/Button --story Primary     # specific story
npx svelte-look /lib/components/Button --output button.png # save to file
npx svelte-look "/routes/(app)/+page" --story Default      # page component (quote parens)
```

Output: base64 PNG to stdout (or file with `--output`). When screenshotting all stories with `--output`, files are named `button_Primary.png`, `button_Secondary.png`, etc.

### List components
```bash
npx svelte-look list
```

### Render HTML snapshots to PNG
```bash
npx svelte-look render
```
Finds `__snapshots__/*.html` files, augments with CSS, renders to PNG.

## Writing Stories

Create a `.stories.ts` file next to the component:

### Regular component story
```ts
import type { Story, StoryMeta } from 'svelte-look'
import type Component from './Button.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 200, height: 60 }],  // required for regular components
}

export const Primary: Story<typeof Component> = {
  props: {
    label: 'Save',
    variant: 'primary',
  },
}

export const Secondary: Story<typeof Component> = {
  props: {
    label: 'Cancel',
    variant: 'secondary',
  },
}
```

### Page/layout story
For `+page.svelte` or `+layout.svelte`, name the stories file `_page.stories.ts` or `_layout.stories.ts`:

```ts
import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'

export const shared_meta: StoryMeta = {}  // uses page_viewports from config

export const Default: PageStory<typeof Component> = {
  props: {  // typed as ComponentProps['data']
    user: { name: 'Alice' },
    items: [{ id: 1, title: 'Hello' }],
  },
}
```

### CSR story with interactions
Use `csr: true` for components that need `$state` reactivity, `onMount`, or browser APIs. Add `interactions` to click/type before the screenshot:

```ts
import type { Story, StoryMeta } from 'svelte-look'
import type Component from './Counter.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 250, height: 70 }],
  csr: true,
}

export const Default: Story<typeof Component> = {
  props: {},
}

export const Incremented: Story<typeof Component> = {
  props: {},
  interactions: async (page) => {
    const buttons = await page.$$('button')
    await buttons[1].click()
    await buttons[1].click()
  },
}
```

The `interactions` function receives a [Puppeteer Page](https://pptr.dev/api/puppeteer.page) object. Common methods:
- `page.click('button.submit')` — click an element
- `page.type('input[name=email]', 'test@example.com')` — type into an input
- `page.$$('button')` — select all matching elements
- `page.waitForSelector('.loaded')` — wait for an element to appear
- `page.select('select', 'option-value')` — select a dropdown option

### Story types reference

```ts
interface StoryMeta {
  viewports?: Viewport[]            // required for regular components, optional for pages
  page_data?: Record<string, any>   // merged into SvelteKit page data
  contexts?: MockedContext[]        // Svelte contexts via setContext
  csr?: boolean                     // true = mount in real browser, false = SSR (default)
  interactions?: (page: any) => Promise<void>  // Puppeteer interactions before screenshot
}

interface Viewport {
  width: number    // required
  height: number   // required
}

interface MockedContext {
  key: any      // same key used in getContext/setContext
  value: any    // mock value
}
```

## Project Config

Create `svelte-look.config.ts` in the project root:

```ts
import { define_config } from 'svelte-look'

export default define_config({
  // Universal CSS files included in SSR screenshots (relative to project root)
  css_files: ['src/lib/theme.css'],

  // Path to shared mocks file (optional)
  mocks: 'src/lib/mocks/svelte-look-mocks.ts',

  // Default viewports for +page.svelte and +layout.svelte only
  // Regular components must define viewports in their .stories.ts
  page_viewports: [{ width: 400, height: 700 }],
})
```

### Shared mocks file

Project-wide defaults for page data and contexts:

```ts
import type { MockedContext } from 'svelte-look'

export const default_page_data: Record<string, any> = {
  mother: 'en',
  learning: 'zh-CN',
}

export const default_contexts: MockedContext[] = [
  { key: 'portal', value: { content: {} } },
]
```

Resolution order (later overrides earlier):
1. Mocks file defaults
2. `shared_meta` in stories file
3. Individual story

## SSR vs CSR — when to use which

| Use SSR (default) | Use CSR (`csr: true`) |
|---|---|
| Static content | Components using `$state` |
| Props-only rendering | Components with `onMount` |
| Fastest screenshots | Need to test interactions (clicks, typing) |
| Most components | Components using browser APIs |
