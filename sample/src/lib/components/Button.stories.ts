import type { Story, StoryMeta } from 'svelte-look'
import type Component from './Button.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 200, height: 60 }],
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

export const Danger: Story<typeof Component> = {
  props: {
    label: 'Delete',
    variant: 'danger',
  },
}
