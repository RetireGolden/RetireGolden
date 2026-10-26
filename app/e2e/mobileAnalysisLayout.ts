import { expect, type Locator, type Page, type TestInfo, test } from '@playwright/test'
import { openExamplePlan } from './helpers'

async function box(locator: Locator) {
  await expect(locator).toBeVisible()
  const bounds = await locator.boundingBox()
  expect(bounds).not.toBeNull()
  return bounds!
}

async function noPageOverflow(page: Page) {
  const dimensions = await page.evaluate('({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth })') as { width: number; scrollWidth: number }
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width)
}

async function printsCompleteDetails(page: Page, details: Locator, testInfo: TestInfo, name: string) {
  const original = await details.evaluateAll((elements) => elements.map((e) => e.hasAttribute('open')))
  const whilePrinting = page.evaluate(`new Promise(resolve => window.addEventListener('beforeprint', () => resolve(
    [...document.querySelectorAll('.provenance-details, .survivor-lever-details')].map(d => d.open)
  ), { once: true }))`) as Promise<boolean[]>
  await page.pdf({ path: testInfo.outputPath(`${name}.pdf`) })
  expect(await whilePrinting).toEqual(original.map(() => true))
  expect(await details.evaluateAll((elements) => elements.map((e) => e.hasAttribute('open')))).toEqual(original)
}

// Letter portrait at 96 dpi. With every disclosure open, each survivor table
// must fit its wrap and the page, since paper cannot scroll the wrap.
async function survivorFitsOnPaper(page: Page) {
  const viewport = page.viewportSize()
  await page.setViewportSize({ width: 816, height: 1056 })
  await page.emulateMedia({ media: 'print' })
  const fits = await page.evaluate(`(() => {
    const details = [...document.querySelectorAll('.survivor-lever-details')]
    const original = details.map(d => d.open)
    details.forEach(d => { d.open = true })
    const result = [...document.querySelectorAll('.survivor-table-wrap')].map(wrap => ({
      overflow: wrap.scrollWidth - wrap.clientWidth,
      right: Math.ceil(wrap.querySelector('.survivor-table').getBoundingClientRect().right),
      page: document.documentElement.clientWidth,
    }))
    details.forEach((d, i) => { d.open = original[i] })
    return result
  })()`) as { overflow: number; right: number; page: number }[]
  await page.emulateMedia({ media: null })
  if (viewport) await page.setViewportSize(viewport)
  expect(fits).toHaveLength(2)
  for (const fit of fits) {
    expect(fit.overflow).toBeLessThanOrEqual(1)
    expect(fit.right).toBeLessThanOrEqual(fit.page)
  }
}

export function registerMobileAnalysisLayoutTests() {
  for (const width of [375, 1280]) {
    test.describe(`${width}px analysis layout`, () => {
      test.use({ hasTouch: width === 375 })
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
          if (width === 375) expect((await box(details.locator('summary'))).height).toBeGreaterThanOrEqual(44)
          if (width === 375 && theme === 'dark') await printsCompleteDetails(page, details, testInfo, 'assumptions-print')
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
            if (width === 375) expect((await box(firstDetails.locator('summary'))).height).toBeGreaterThanOrEqual(44)
            await firstDetails.locator('summary').click()
            await expect(firstDetails.locator('[data-lever-window]')).toBeVisible()
            await expect(firstDetails.locator('[data-lever-notes]')).toContainText('Sam has no Roth account')
            await firstDetails.locator('summary').click()
          }
          await noPageOverflow(page)
          await tables.first().locator('tbody td').first().scrollIntoViewIfNeeded()
          if (width === 375 && theme === 'dark') await printsCompleteDetails(page, tables.locator('details'), testInfo, 'survivor-print')
          if (width === 375 && theme === 'dark') await survivorFitsOnPaper(page)
          await page.screenshot({ path: testInfo.outputPath(`survivor-${width}-${theme}.png`) })

          // Pause timers before mounting Scenarios so its 200ms risk callback
          // cannot start before the checkbox is turned off, even on a slow runner.
          await page.clock.install({ time: new Date('2026-06-15T12:00:00Z') })
          await page.clock.pauseAt(new Date('2026-06-15T12:00:01Z'))
          await page.getByRole('link', { name: 'Scenarios', exact: true }).click()
          await page.getByRole('checkbox', { name: 'Shared-market risk (200 paths)' }).uncheck()
          await page.clock.resume()
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
    })
  }
}
