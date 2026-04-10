import type { Story, StoryMeta } from 'svelte-look'
import type Component from './TextInput.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 280, height: 100 }],
  csr: true,
}

export const Empty: Story<typeof Component> = {
  props: { label: 'Email', placeholder: 'you@example.com' },
}

export const WithTyping: Story<typeof Component> = {
  props: { label: 'Username', placeholder: 'Enter username' },
  interactions: async (page) => {
    await page.click('input')
    await page.type('input', 'jacob_dev')
  },
}
