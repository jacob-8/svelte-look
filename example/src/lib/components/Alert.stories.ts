import type { Story, StoryMeta } from 'svelte-look'
import type Component from './Alert.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 350, height: 60 }],
}

export const Info: Story<typeof Component> = {
  props: { message: 'Your session will expire in 5 minutes.', type: 'info' },
}

export const ErrorAlert: Story<typeof Component> = {
  props: { message: 'Failed to save changes. Please try again.', type: 'error' },
}

export const Success: Story<typeof Component> = {
  props: { message: 'Changes saved successfully!', type: 'success' },
}

export const Warning: Story<typeof Component> = {
  props: { message: 'This action cannot be undone.', type: 'warning', dismissible: true },
}
