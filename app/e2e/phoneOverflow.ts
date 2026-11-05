import { expect, type Page, test } from '@playwright/test'
import { openExamplePlan } from './helpers'

/**
 * The screens the Design QA walks found scrolling sideways at 375 do not
 * any more (#766, #767, #778). jsdom has no layout, so only a real browser
 * can check this: the Example couple plan those walks used, in both themes,
 * on the screens they found overflowing plus the pages whose back links #767
 * restyled. Wide tables may scroll inside their own region; on these screens
 * the document never does. This is a list of screens, not every route: a new
 * page or a new wide table elsewhere needs its own entry here.
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
        // The plan's own root, /plan/<id>, from wherever the opener landed.
        const planRoot = /^\/plan\/[^/]+/.exec(new URL(page.url()).pathname)
        expect(planRoot, `plan URL after opening the example: ${page.url()}`).not.toBeNull()
        const plan = planRoot![0]

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
        // Every headline card sits inside the viewport, and no card's label,
        // value or caption paints past its own box (a no-wrap value inside a
        // card that fits is still overlap).
        const cards = page.locator('.report-kpis .report-kpi')
        const viewport = page.viewportSize()!.width
        expect(await cards.count()).toBeGreaterThan(0)
        for (const card of await cards.all()) {
          const box = await card.boundingBox()
          expect(box, 'a headline card is laid out at 375').not.toBeNull()
          expect(box!.x + box!.width).toBeLessThanOrEqual(viewport)
          const parts = await card.locator('.kpi-label, .kpi-value, .kpi-sub').evaluateAll((els) =>
            els.map((el) => ({ text: el.textContent ?? '', scroll: el.scrollWidth, client: el.clientWidth })),
          )
          for (const part of parts) {
            expect(part.scroll, `"${part.text}" fits its card`).toBeLessThanOrEqual(part.client)
          }
        }
        // The Example couple's values are short; the longest worded value
        // the report prints, Money lasts' "short from <year>" for a plan short
        // in its first year (moneyLastsValue), must wrap inside a phone card
        // too. Put it in every card and measure again.
        await cards.locator('.kpi-value').evaluateAll((els) => {
          for (const el of els) el.textContent = 'short from 2026'
        })
        const values = await cards.locator('.kpi-value').evaluateAll((els) =>
          els.map((el) => ({ scroll: el.scrollWidth, client: el.clientWidth })),
        )
        for (const value of values) {
          expect(value.scroll, '"short from 2026" wraps inside its card').toBeLessThanOrEqual(value.client)
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
