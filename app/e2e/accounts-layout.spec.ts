import { expect, type Locator, type Page, test } from '@playwright/test'

async function openExampleAccounts(page: Page, title: string) {
  await page.goto('/examples')
  await expect(page.getByRole('heading', { name: 'Example library' })).toBeVisible()

  // First visits show 3 featured starters; the rest live behind "Browse all".
  // The preference persists per-context, so only expand when still collapsed.
  const card = page.locator('.example-card').filter({ hasText: title })
  if (!(await card.isVisible())) {
    await page.getByRole('button', { name: /Browse all \d+ examples/ }).click()
  }
  await card.getByRole('button', { name: 'Open' }).click()
  await expect(page).toHaveURL(/\/plan\/[^/]+\/results$/)

  await page.getByRole('link', { name: 'Accounts' }).click()
  // exact: true — the workspace also renders an sr-only h1 ("Accounts — <plan>")
  // that would otherwise substring-match and trip strict mode.
  await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible()
}

async function visibleBox(locator: Locator) {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  return box!
}

async function expectPanelSpansAccount(row: Locator, panel: Locator) {
  const rowBox = await visibleBox(row)
  const panelBox = await visibleBox(panel)

  expect(panelBox.width).toBeGreaterThan(rowBox.width * 0.72)
  expect(panelBox.x).toBeLessThan(rowBox.x + 40)
  expect(panelBox.x + panelBox.width).toBeGreaterThan(rowBox.x + rowBox.width - 40)
}

async function expectFieldBefore(row: Locator, firstLabel: string, secondLabel: string) {
  const first = await visibleBox(row.locator('.field, .field-with-action').filter({ hasText: firstLabel }).first())
  const second = await visibleBox(row.locator('.field, .field-with-action').filter({ hasText: secondLabel }).first())

  if (Math.abs(first.y - second.y) <= 4) {
    expect(first.x).toBeLessThan(second.x)
  } else {
    expect(first.y).toBeLessThan(second.y)
  }
}

function accountRow(page: Page, name: string) {
  return page.getByTestId('account-row').filter({ hasText: name })
}

test.describe('Accounts form layout', () => {
  test('keeps employer-match controls aligned on the 401(k) account', async ({ page }) => {
    await openExampleAccounts(page, 'Aggressive saver to early retirement')

    const pretax401k = accountRow(page, 'Pre-tax 401(k)')
    const matchPanel = pretax401k.getByTestId('employer-match-panel')
    await expectPanelSpansAccount(pretax401k, matchPanel)

    const matchField = matchPanel.locator('.field').filter({ hasText: 'Match percent' })
    const capField = matchPanel.locator('.field').filter({ hasText: 'Up to % of wages' })
    const matchBox = await visibleBox(matchField)
    const capBox = await visibleBox(capField)

    expect(Math.abs(matchBox.y - capBox.y)).toBeLessThanOrEqual(4)
  })

  test('keeps contribution schedules full-width for brokerage and IRA accounts', async ({ page }) => {
    await openExampleAccounts(page, 'Aggressive saver to early retirement')

    const taxable = accountRow(page, 'Taxable Brokerage')
    await expectFieldBefore(taxable, 'Expected return', 'Schedule contributions over time')
    await expectPanelSpansAccount(taxable, taxable.getByTestId('contribution-schedule-panel'))

    await openExampleAccounts(page, 'Coast FIRE')

    const traditionalIra = accountRow(page, 'Traditional IRA')
    await expectFieldBefore(traditionalIra, 'Expected return', 'Schedule contributions over time')
    await expectPanelSpansAccount(traditionalIra, traditionalIra.getByTestId('contribution-schedule-panel'))
  })
})
