import { expect, test } from '@playwright/test'

test('evaluates a schema-guided request against the released server', async ({ page }) => {
  const expectedVersion = (process.env.TREETOP_REST_VERSION ?? 'v0.0.12').replace(/^v/, '')
  await page.goto('/')
  await expect(page.getByText('Schema-backed', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Action')).toHaveValue('App::Action::read')

  await page.getByLabel('ID').first().fill('alice')
  await page.getByLabel('Groups').fill('readers')
  await page.getByLabel('ID').nth(1).fill('roadmap')
  await page.getByLabel('title').fill('Roadmap')
  await page.getByLabel('revision').fill('7')
  await page.getByLabel('environment').fill('prod')
  await page.getByRole('button', { name: 'Evaluate', exact: true }).click()

  await expect(page.getByText('Allow', { exact: true })).toBeVisible()
  await expect(page.getByText('App.read_documents', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: /System/ }).click()
  const escapedVersion = expectedVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  await expect(page.getByText(new RegExp(`^v${escapedVersion}(?:\\+|$)`))).toBeVisible()
  if (expectedVersion === '0.0.10') await expect(page.getByText('4.12.0', { exact: true })).toBeVisible()
})
