import type { Story, StoryMeta } from 'svelte-look'
import type Component from './Toggle.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 200, height: 40 }],
  csr: true,
}

export const Off: Story<typeof Component> = {
  props: { label: 'Notifications' },
}

export const On: Story<typeof Component> = {
  props: { label: 'Dark mode', initial: true },
}

export const Toggled: Story<typeof Component> = {
  props: { label: 'Airplane mode' },
  interactions: async (page) => {
    await page.click('button[role="switch"]')
  },
}
