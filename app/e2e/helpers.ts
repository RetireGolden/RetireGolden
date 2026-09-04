import { expect, type Page } from '@playwright/test'

/**
 * Opens an example plan from the curated library and lands on its Results
 * page. Shared by every spec that needs a populated plan without building
 * one by hand (Optimize, Report, Smoke, Accounts layout).
 */
export async function openExamplePlan(page: Page, title: string): Promise<void> {
  await page.goto('/examples')
  await expect(page.getByRole('heading', { name: 'Example library' })).toBeVisible()

  // First visits show 3 featured starters; the rest live behind "Show all".
  // The preference persists per-context, so only expand when still collapsed.
  const card = page.locator('.example-card').filter({ hasText: title })
  if (!(await card.isVisible())) {
    await page.getByRole('button', { name: /Show all \d+ examples/ }).click()
  }
  await card.getByRole('button', { name: 'Open' }).click()
  await expect(page).toHaveURL(/\/plan\/[^/]+\/results$/)
}
