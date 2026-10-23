import { expect, type Locator, type Page, test } from '@playwright/test'
import { openExamplePlan } from './helpers'

async function box(locator: Locator) {
  await expect(locator).toBeVisible()
  const bounds = await locator.boundingBox()
  expect(bounds).not.toBeNull()
  return bounds!
}

async function noPageOverflow(page: Page) {
  const dimensions = await page.evaluate('({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth })') as { width: number; scrollWidth: number }
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width)
}

for (const width of [375, 1280]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`analysis cards fit at ${width}px in ${theme}`, async ({ page }, testInfo) => {
      test.setTimeout(90_000)
      await page.setViewportSize({ width, height: 800 })
      await openExamplePlan(page, 'Example couple')
      await page.getByRole('button', { name: theme === 'light' ? 'Light' : 'Dark', exact: true }).click()
      await page.getByRole('link', { name: 'View assumptions card' }).click()
      const stateRow = page.locator('.provenance-table tr').filter({ has: page.locator('.provenance-details') })
      const card = stateRow.locator('xpath=ancestor::div[contains(@class,"card")][1]')
      const cardBox = await box(card)
      const tableBox = await box(card.locator('table'))
      expect(tableBox.x + tableBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width)
      await noPageOverflow(page)
      const details = stateRow.locator('details')
      await expect(details).not.toHaveAttribute('open')
      await details.locator('summary').click()
      await expect(details.getByRole('link', { name: 'Maine Form 1040ES-ME' })).toBeVisible()
      await noPageOverflow(page)
      expect(await stateRow.innerText()).not.toMatch(/`|https?:\/\//u)
      await details.locator('summary').click()
      await stateRow.scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`assumptions-${width}-${theme}.png`) })

      await page.getByRole('link', { name: 'Survivor transition', exact: true }).click()
      const tables = page.locator('.survivor-table')
      await expect(tables).toHaveCount(2, { timeout: 30_000 })
      for (const table of await tables.all()) {
        const rows = table.locator('tbody tr')
        expect(await rows.count()).toBeGreaterThan(1)
        for (const row of await rows.all()) expect((await box(row)).height).toBeLessThan(220)
        expect((await box(rows.first().locator('td').first())).width).toBeLessThan(110)
        const firstDetails = table.locator('details').first()
        await firstDetails.locator('summary').click()
        await expect(firstDetails.locator('[data-lever-window]')).toBeVisible()
        await expect(firstDetails.locator('[data-lever-notes]')).toContainText('Sam has no Roth account')
        await firstDetails.locator('summary').click()
      }
      await noPageOverflow(page)
      await tables.first().locator('tbody td').first().scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`survivor-${width}-${theme}.png`) })

      await page.getByRole('link', { name: 'Scenarios', exact: true }).click()
      // This checks layout, so avoid waiting for the optional 200-path risk sweep.
      await page.getByRole('checkbox', { name: 'Shared-market risk (200 paths)' }).uncheck()
      const head = page.locator('.spending-capacity-head')
      await expect(head).toBeVisible({ timeout: 60_000 })
      const description = await box(head.locator('div').first())
      const button = await box(head.getByRole('button', { name: 'Calculate capacity' }))
      if (width === 375) {
        expect(button.y).toBeGreaterThanOrEqual(description.y + description.height)
        expect(description.width).toBeGreaterThan(220)
        expect(description.width).toBeCloseTo((await box(head)).width, 0)
      } else {
        expect(button.x).toBeGreaterThanOrEqual(description.x + description.width)
      }
      await noPageOverflow(page)
      await head.scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`capacity-${width}-${theme}.png`) })
    })
  }
}
