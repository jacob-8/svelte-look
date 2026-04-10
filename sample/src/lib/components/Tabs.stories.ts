import type { Story, StoryMeta } from 'svelte-look'
import type Component from './Tabs.svelte'

const sample_tabs = [
  { label: 'Profile', content: 'Your profile information and settings.' },
  { label: 'Security', content: 'Manage your password and 2FA.' },
  { label: 'Billing', content: 'View invoices and manage your plan.' },
]

export const shared_meta: StoryMeta = {
  viewports: [{ width: 350, height: 120 }],
  csr: true,
}

export const FirstTab: Story<typeof Component> = {
  props: { tabs: sample_tabs },
}

export const ClickedSecondTab: Story<typeof Component> = {
  props: { tabs: sample_tabs },
  interactions: async (page) => {
    const tab_buttons = await page.$$('button')
    await tab_buttons[1].click()
  },
}

export const ClickedThirdTab: Story<typeof Component> = {
  props: { tabs: sample_tabs },
  interactions: async (page) => {
    const tab_buttons = await page.$$('button')
    await tab_buttons[2].click()
  },
}
