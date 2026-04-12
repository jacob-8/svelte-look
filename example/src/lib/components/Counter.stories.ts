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
    await buttons[1].click()
  },
}
