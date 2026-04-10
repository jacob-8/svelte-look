import type { Story, StoryMeta } from 'svelte-look'
import type Component from './Badge.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 120, height: 40 }],
}

export const Success: Story<typeof Component> = {
  props: { text: 'Active', color: 'success' },
}

export const Error: Story<typeof Component> = {
  props: { text: 'Failed', color: 'error' },
}

export const Warning: Story<typeof Component> = {
  props: { text: 'Pending', color: 'warning' },
}

export const Info: Story<typeof Component> = {
  props: { text: 'New', color: 'info' },
}

export const Default: Story<typeof Component> = {
  props: { text: 'Draft', color: 'default' },
}
