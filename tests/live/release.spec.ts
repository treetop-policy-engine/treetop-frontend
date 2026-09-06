import { expect, test } from '@playwright/test'
import { REST_VERSION } from '../../scripts/lib/treetop-contract.mjs'

test('evaluates a schema-guided request against the coordinated candidate', async ({ page }) => {
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
  await expect(page.getByText(REST_VERSION, { exact: true }).first()).toBeVisible()
})
