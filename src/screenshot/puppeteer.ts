import type { Viewport } from '../types.js'
import type { Browser } from 'puppeteer-core'

let cached_browser: Browser | null = null

export async function get_browser(): Promise<Browser> {
  if (cached_browser)
    return cached_browser

  const puppeteer = (await import('puppeteer-core')).default
  const { getChromePath } = await import('chrome-launcher')

  cached_browser = await puppeteer.launch({
    executablePath: getChromePath(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  return cached_browser
}

export async function html_to_png({ html, viewport }: {
  html: string
  viewport: Viewport
}): Promise<Buffer> {
  const browser = await get_browser()
  const page = await browser.newPage()

  await page.setViewport({ width: viewport.width, height: viewport.height })
  await page.setContent(html, { waitUntil: 'load' })

  const buffer = Buffer.from(await page.screenshot({ type: 'png', fullPage: true }))
  await page.close()
  return buffer
}

export async function close_browser(): Promise<void> {
  if (cached_browser) {
    await cached_browser.close()
    cached_browser = null
  }
}
