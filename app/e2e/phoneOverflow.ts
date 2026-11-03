import { expect, type Page, test } from '@playwright/test'
import { openExamplePlan } from './helpers'

/**
 * No page scrolls sideways at 375 (#766, #767, #778). jsdom has no layout, so
 * only a real browser can check this: the Example couple plan the Design QA
 * walks used, in both themes, on every screen those walks found overflowing
 * plus the pages whose back links #767 restyled. Wide tables may scroll
 * inside their own region; the document never does.
 */

async function pageWidth(page: Page) {
  return (await page.evaluate(
    '({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth })',
  )) as { clientWidth: number; scrollWidth: number }
}

async function expectNoSidewaysScroll(page: Page, screen: string) {
  const { clientWidth, scrollWidth } = await pageWidth(page)
  expect(scrollWidth, `${screen}: document scrollWidth`).toBeLessThanOrEqual(clientWidth)
}

export function registerPhoneOverflowTests() {
  test.describe('375px pages never scroll sideways', () => {
    test.use({ hasTouch: true })
    for (const theme of ['light', 'dark'] as const) {
      test(`Example couple screens fit 375px in ${theme}`, async ({ page }) => {
        test.setTimeout(120_000)
        await page.setViewportSize({ width: 375, height: 800 })
        await openExamplePlan(page, 'Example couple')
        await page.getByRole('button', { name: theme === 'light' ? 'Light' : 'Dark', exact: true }).click()
        const plan = page.url().replace(/\/results$/, '')

        // Household map with the text-list disclosure open (#778): the table
        // scrolls inside its region, which really is wider than its box.
        await page.goto(`${plan}/household-map`)
        const details = page.locator('details.map-details')
        await details.locator('summary').click()
        const region = details.getByRole('region', { name: 'Text list of this map' })
        await expect(region).toBeVisible()
        const inner = await region.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }))
        expect(inner.scroll).toBeGreaterThan(inner.client)
        await expectNoSidewaysScroll(page, 'Household map (text list open)')

        // Printable report (#766): the actions and headline cards wrap, and
        // the strategy row reads in words.
        await page.goto(`${plan}/report`)
        await expect(page.getByRole('heading', { name: 'Headline results' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('link', { name: '← Back to plan' })).toBeVisible()
        await expect(page.getByRole('row', { name: /Roth conversions/ })).toContainText('Fill to top of 22% bracket')
        await expectNoSidewaysScroll(page, 'Report')
        const cards = page.locator('.report-kpis').first().locator('.report-kpi')
        const viewport = page.viewportSize()!.width
        for (const card of await cards.all()) {
          const box = (await card.boundingBox())!
          expect(box.x + box.width).toBeLessThanOrEqual(viewport)
        }

        // Strategy (#777) and the pages with back links (#767).
        await page.goto(`${plan}/strategy`)
        await expect(page.getByRole('heading', { name: 'Itemized deductions' })).toBeVisible()
        await expectNoSidewaysScroll(page, 'Strategy')
        await page.goto('/compare')
        await expect(page.getByRole('link', { name: '← Your plans' })).toBeVisible()
        await expectNoSidewaysScroll(page, 'Compare')
        await page.goto('/examples')
        await expect(page.getByRole('link', { name: '← Your plans' })).toBeVisible()
        await expectNoSidewaysScroll(page, 'Examples')
        await page.goto('/learn/glossary')
        await expect(page.getByRole('heading', { name: 'Glossary' })).toBeVisible()
        await expectNoSidewaysScroll(page, 'Glossary')
      })
    }
  })

  test('the active rail pill keeps its gold under the pointer (#767)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await openExamplePlan(page, 'Example couple')
    const active = page.locator('.workspace-rail .rail-link--active')
    await expect(active).toHaveCount(1)
    const paint = () =>
      active.evaluate((el) => {
        const style = el.ownerDocument.defaultView!.getComputedStyle(el)
        return [style.color, style.backgroundColor]
      })
    await page.mouse.move(0, 0)
    const resting = await paint()
    await active.hover()
    expect(await paint()).toEqual(resting)
  })
}
