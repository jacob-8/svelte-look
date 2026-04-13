import type { ResolvedStory, SvelteLookConfig, Viewport } from '../types.js'
import type { ViteDevServer } from 'vite'
import { get_browser } from '../screenshot/puppeteer.js'
import { start_mount_server } from './vite-loader.js'

export async function csr_render_component({ vite, component_path, resolved_story, story_name, cwd, config, is_page, viewport, dark, full_page }: {
  vite: ViteDevServer
  component_path: string
  resolved_story: ResolvedStory
  story_name: string
  cwd: string
  config: SvelteLookConfig
  is_page: boolean
  viewport: Viewport
  dark?: boolean
  full_page?: boolean
}): Promise<Buffer> {
  const base_url = await start_mount_server({ vite, cwd, config })

  const params = new URLSearchParams({
    component: component_path,
    story: story_name,
    is_page: String(is_page),
  })
  if (config.mocks)
    params.set('mocks', config.mocks)
  if (resolved_story.flavor_name)
    params.set('flavor', resolved_story.flavor_name)

  const url = `${base_url}/__svelte-look__/mount?${params}`

  const browser = await get_browser()
  const page = await browser.newPage()

  page.on('pageerror', err => console.error(`[browser error] ${err}`))
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warn')
      console.error(`[browser ${msg.type()}] ${msg.text()}`)
  })

  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' },
  ])

  await page.setViewport({ width: viewport.width, height: viewport.height })
  await page.goto(url, { waitUntil: 'networkidle0' })

  if (dark)
    await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.waitForFunction('window.__svelte_look_mounted__', { timeout: 10000 })

  // Wait for UnoCSS HMR to apply styles after component mount
  await page.waitForFunction(() => {
    const sheets = Array.from(document.querySelectorAll('style[data-vite-dev-id*="uno"]'))
    return sheets.some(s => s.textContent && s.textContent.length > 100)
  }, { timeout: 5000 }).catch(() => {
    // UnoCSS may not be configured - continue without it
  })

  if (resolved_story.interactions)
    await resolved_story.interactions(page)

  const buffer = Buffer.from(await page.screenshot({ type: 'png', fullPage: full_page ?? false }))
  await page.close()
  return buffer
}
