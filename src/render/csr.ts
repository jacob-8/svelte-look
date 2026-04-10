import type { ResolvedStory, SvelteLookConfig, Viewport } from '../types.js'
import type { ViteDevServer } from 'vite'
import { get_browser } from '../screenshot/puppeteer.js'
import { start_mount_server } from './vite-loader.js'

export async function csr_render_component({ vite, component_path, resolved_story, story_name, cwd, config, is_page, viewport }: {
  vite: ViteDevServer
  component_path: string
  resolved_story: ResolvedStory
  story_name: string
  cwd: string
  config: SvelteLookConfig
  is_page: boolean
  viewport: Viewport
}): Promise<Buffer> {
  const base_url = await start_mount_server({ vite, cwd, config })

  const params = new URLSearchParams({
    component: component_path,
    story: story_name,
    is_page: String(is_page),
  })
  if (config.mocks)
    params.set('mocks', config.mocks)

  const url = `${base_url}/__svelte-look__/mount?${params}`

  const browser = await get_browser()
  const page = await browser.newPage()

  page.on('pageerror', err => console.error(`[browser error] ${err}`))

  await page.setViewport({ width: viewport.width, height: viewport.height })
  await page.goto(url, { waitUntil: 'networkidle0' })
  await page.waitForFunction('window.__svelte_look_mounted__', { timeout: 10000 })

  if (resolved_story.interactions)
    await resolved_story.interactions(page)

  const buffer = Buffer.from(await page.screenshot({ type: 'png', fullPage: true }))
  await page.close()
  return buffer
}
