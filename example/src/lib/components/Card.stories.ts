import type { Story, StoryMeta } from 'svelte-look'
import type Component from './Card.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 320, height: 120 }],
}

export const Default: Story<typeof Component> = {
  props: {
    title: 'Getting Started',
    description: 'Learn how to use svelte-look to screenshot your components.',
  },
}

export const TitleOnly: Story<typeof Component> = {
  viewports: [{ width: 320, height: 80 }],
  props: {
    title: 'Announcement',
  },
}
