import type { Story, StoryMeta } from 'svelte-look'
import type Component from './NativeScopedCard.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 400, height: 220 }],
}

export const Default: Story<typeof Component> = {
  props: {
    title: 'Native Scoped CSS',
    body: 'This component uses only a Svelte <style> block — no utility classes. SSR mode must load the externally-extracted scoped CSS.',
    footer: 'Footer text',
  },
}
