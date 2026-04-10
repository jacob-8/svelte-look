import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'

export const shared_meta: StoryMeta = {}

export const Default: PageStory<typeof Component> = {
  props: {
    version: 'v1.0',
    cards: [
      { title: 'Welcome', description: 'This is a sample SvelteKit app for testing svelte-look.' },
      { title: 'Features', description: 'Screenshot components with SSR or CSR rendering.' },
    ],
  },
}

export const Empty: PageStory<typeof Component> = {
  props: {
    version: 'beta',
    cards: [],
  },
}
