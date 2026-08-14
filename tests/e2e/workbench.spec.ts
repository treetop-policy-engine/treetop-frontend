import { expect, test, type Page } from '@playwright/test'
import { metricsSource, policySource, statusResponse, versionResponse } from '../../src/test/fixtures'

async function mockTreetop(page: Page, schemaBacked = true, prefix = 'treetop-api', delay = 0) {
  const activeStatus = schemaBacked ? statusResponse : {
    ...statusResponse,
    policy_configuration: {
      ...statusResponse.policy_configuration,
      schema: { ...statusResponse.policy_configuration.schema, content: '', entries: 0, size: 0 },
    },
    request_context: { supported: true, schema_backed: false, fallback_reason: 'no_schema' },
  }
  await page.route(`**/${prefix}/**`, async (route) => {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
    const request = route.request()
    const path = new URL(request.url()).pathname.replace(`/${prefix}`, '')
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

    if (path === '/api/v1/status') return json(activeStatus)
    if (path === '/api/v1/version') return json(versionResponse)
    if (path === '/api/v1/schema') return json({ schema: activeStatus.policy_configuration.schema })
    if (path === '/api/v1/policies') return json({ policies: statusResponse.policy_configuration.policies })
    if (path.startsWith('/api/v1/policies/')) {
      if (new URL(request.url()).searchParams.get('format') === 'raw') {
        return route.fulfill({ status: 200, contentType: 'text/plain', body: policySource })
      }
      return json({
        user: 'App::User::"alice"',
        policies: [{ annotations: { id: 'App.read_documents' }, effect: 'permit' }],
        matches: [{ cedar_id: 'policy0', reasons: ['PrincipalIn'] }],
      })
    }
    if (path === '/api/v1/authorize') {
      const payload = request.postDataJSON() as { requests: Array<{ id?: string; principal: { User?: { id: string } } }> }
      const results = payload.requests.map((item, index) => {
        const allowed = item.principal.User?.id !== 'bob'
        return {
          index,
          id: item.id,
          status: 'success',
          result: {
            decision: allowed ? 'Allow' : 'Deny',
            version: versionResponse.policies,
            policy: allowed ? [{ cedar_id: 'policy0', annotation_id: 'App.read_documents', literal: policySource, json: {} }] : [],
          },
        }
      })
      return json({ results, version: versionResponse.policies, successful: results.length, failed: 0 })
    }
    if (path === '/livez' || path === '/readyz') return route.fulfill({ status: 200, contentType: 'text/plain', body: 'ok\n' })
    if (path === '/metrics') return route.fulfill({ status: 200, contentType: 'text/plain', body: metricsSource })
    return json({ error: `No mock for ${path}`, code: 'not_found' }, 404)
  })
}

test.beforeEach(async ({ page }) => {
  await mockTreetop(page)
  await page.goto('/')
})

test('builds a schema-guided request and explains the decision', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Ask the policy engine' })).toBeVisible()
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
  await expect(page.getByText('1', { exact: true }).first()).toBeVisible()
})

test('expands matrix IDs into a single authorization batch', async ({ page }) => {
  await page.getByRole('button', { name: 'Matrix' }).click()
  await page.getByLabel(/ID use \| for alternatives/).first().fill('alice | bob')
  await page.getByLabel(/ID use \| for alternatives/).nth(1).fill('one | two')
  await page.getByLabel('title').fill('Document')
  await page.getByLabel('revision').fill('1')
  await page.getByLabel('environment').fill('prod')
  await expect(page.getByText('4 checks')).toBeVisible()
  await page.getByRole('button', { name: 'Evaluate', exact: true }).click()
  await expect(page.getByText('4', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('alice:read:one')).toBeVisible()
  await expect(page.getByText('bob:read:two')).toBeVisible()
})

test('offers a policy-inferred guided form when no schema is loaded', async ({ page }) => {
  await page.unroute('**/treetop-api/**')
  await mockTreetop(page, false)
  await page.reload()

  await expect(page.getByText('Policy-inferred inputs')).toBeVisible()
  await expect(page.getByText('No schema loaded—choices are inferred from policy scopes.')).toBeVisible()
  await expect(page.getByLabel('Action')).toHaveValue('App::Action::read')
  await expect(page.getByLabel('Type').first()).toHaveValue('App::User')
  await expect(page.getByLabel('Type').nth(1)).toHaveValue('App::Document')
  await expect(page.getByLabel('Groups')).toHaveAttribute('placeholder', 'readers')
  await page.getByRole('button', { name: 'readers', exact: true }).click()
  await expect(page.getByLabel('Groups')).toHaveValue('readers')

  await page.getByLabel('ID').first().fill('alice')
  await page.getByLabel('ID').nth(1).fill('roadmap')
  const authorizeRequest = page.waitForRequest((request) => new URL(request.url()).pathname.endsWith('/api/v1/authorize'))
  await page.getByRole('button', { name: 'Evaluate', exact: true }).click()
  const payload = (await authorizeRequest).postDataJSON()
  expect(payload.requests[0]).toMatchObject({
    principal: { User: { id: 'alice', namespace: ['App'], groups: [{ id: 'readers', namespace: ['App'] }] } },
    action: { id: 'read', namespace: ['App'] },
    resource: { kind: 'App::Document', id: 'roadmap' },
  })
})

test('renders an on-demand metrics dashboard and raw exposition', async ({ page }) => {
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' })
  const labels = await navigation.getByRole('button').allTextContents()
  expect(labels.findIndex((label) => label.includes('Metrics'))).toBe(labels.findIndex((label) => label.includes('System')) + 1)

  await navigation.getByRole('button', { name: /Metrics/ }).click()
  await expect(page.getByRole('heading', { name: 'Metrics snapshot' })).toBeVisible()
  await expect(page.getByText('HTTP request volume')).toBeVisible()
  await expect(page.getByText('GET /api/v1/policies').first()).toBeVisible()
  await expect(page.getByText('POST /api/v1/authorize').first()).toBeVisible()
  await expect(page.getByText('Action::read').first()).toBeVisible()
  await expect(page.getByText('75% allowed')).toBeVisible()
  const authSummary = page.getByText('Mean auth check').locator('..').locator('..')
  await expect(authSummary.getByText('1.00 ms', { exact: true })).toBeVisible()
  await expect(authSummary.getByText('2.50 ms per batch · 2.5 checks/batch')).toBeVisible()
  await expect(page.getByText('Authorization latency by batch size')).toBeVisible()

  await page.getByRole('button', { name: 'Open histogram for 2–4 checks' }).click()
  let dialog = page.getByRole('dialog', { name: '2–4 checks' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('batch_size_class', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Close histogram' }).click()

  await page.getByRole('button', { name: 'Open histogram for POST /api/v1/authorize' }).click()
  dialog = page.getByRole('dialog', { name: 'POST /api/v1/authorize' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('≤ 500 µs')).toBeVisible()
  await expect(dialog.getByText('500 µs–5.00 ms')).toBeVisible()
  await expect(dialog.getByText('Bucket bars show non-cumulative observations')).toBeVisible()
  await dialog.getByRole('button', { name: 'Close histogram' }).click()

  await page.getByRole('button', { name: 'Open histogram for Action::read' }).click()
  dialog = page.getByRole('dialog', { name: 'Action::read' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('action', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Action::read').first()).toBeVisible()
  await dialog.getByRole('button', { name: 'Close histogram' }).click()

  await page.getByRole('button', { name: 'Raw', exact: true }).click()
  await expect(page.getByLabel('Raw Prometheus metrics')).toContainText('http_request_duration_seconds_bucket')
})

test('supports policy lookup and schema exploration', async ({ page }) => {
  await page.getByRole('button', { name: /Policies/ }).click()
  await expect(page.getByText('@id("App.read_documents")')).toBeVisible()
  await page.getByLabel('Search policy source').fill('context.environment')
  await expect(page.getByText('1 matching policy')).toBeVisible()
  await expect(page.getByLabel('Cedar policy source')).toContainText('@id("App.read_documents")')
  await expect(page.getByLabel('Cedar policy source')).toContainText('principal in App::Group::"readers"')
  await page.getByRole('button', { name: 'By principal' }).click()
  await expect(page.getByLabel('Principal type')).toHaveValue('App::User')
  await expect(page.getByLabel('Groups')).toHaveAttribute('placeholder', 'readers')
  await page.getByLabel('User ID').fill('alice')
  await page.getByLabel('Groups').fill('App::Group::readers')
  const lookupRequest = page.waitForRequest((request) => new URL(request.url()).pathname.includes('/api/v1/policies/alice'))
  await page.getByRole('button', { name: 'Find policies' }).click()
  const lookupUrl = new URL((await lookupRequest).url())
  expect(lookupUrl.searchParams.getAll('namespaces[]')).toEqual(['App'])
  expect(lookupUrl.searchParams.getAll('groups[]')).toEqual(['readers'])
  await expect(page.getByText('PrincipalIn')).toBeVisible()
  await expect(page.getByText('Static scope matches; conditions are not evaluated.')).toBeVisible()
  await expect(page.getByText('@id("App.read_documents")')).not.toBeVisible()
  await page.getByRole('button', { name: 'Expand all' }).click()
  await expect(page.getByText('@id("App.read_documents")')).toBeVisible()
  await expect(page.getByText('App.read_documents', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'JSON' }).click()
  await expect(page.getByText(/"effect": "permit"/)).toBeVisible()

  await page.getByRole('button', { name: /Schema/ }).click()
  await page.getByRole('button', { name: /read/i, exact: false }).last().click()
  await expect(page.getByText('App::Document')).toBeVisible()
  await page.getByRole('button', { name: 'Entities' }).click()
  await page.getByRole('button', { name: /Document/ }).click()
  await expect(page.getByText('Set<String>')).toBeVisible()
})

test('saves, switches, and remembers server connections', async ({ page }) => {
  await mockTreetop(page, true, 'treetop-production', 400)
  await page.getByRole('button', { name: /Policies/ }).click()
  await expect(page.getByText('@id("App.read_documents")')).toBeVisible()
  await page.getByRole('button', { name: 'Switch server' }).click()

  const dialog = page.getByRole('dialog', { name: 'Treetop servers' })
  await dialog.getByRole('button', { name: 'New' }).click()
  await dialog.getByLabel('Name').fill('Production')
  await dialog.getByLabel('Server URL').fill('/treetop-production')
  await dialog.getByRole('button', { name: 'Save server' }).click()
  await expect(dialog.getByRole('option', { name: /Production/ })).toHaveAttribute('aria-selected', 'true')

  const switched = page.waitForRequest((request) => (
    new URL(request.url()).pathname === '/treetop-production/api/v1/status'
  ))
  await dialog.getByRole('button', { name: 'Connect', exact: true }).click()
  await switched
  await expect(page.getByText('@id("App.read_documents")')).not.toBeVisible()
  await expect(page.getByText('Production · Connected')).toBeVisible()
  await expect(page.getByText('/treetop-production', { exact: true })).toBeVisible()
  await expect(page.getByText('@id("App.read_documents")')).toBeVisible()

  await page.reload()
  await expect(page.getByText('Production · Connected')).toBeVisible()
  await page.getByRole('button', { name: 'Switch server' }).click()
  await expect(page.getByRole('dialog', { name: 'Treetop servers' }).getByText('Production', { exact: true })).toBeVisible()
})

test('keeps access tokens in memory and clears them on reload', async ({ page }) => {
  const accessToken = 'browser-memory-token'
  await page.getByRole('button', { name: 'Switch server' }).click()
  const dialog = page.getByRole('dialog', { name: 'Treetop servers' })
  await dialog.getByLabel('Access token').fill(accessToken)
  const authorized = page.waitForRequest((request) => (
    new URL(request.url()).pathname === '/treetop-api/api/v1/status'
      && request.headers().authorization === `Bearer ${accessToken}`
  ))
  await dialog.getByRole('button', { name: 'Set token' }).click()
  await authorized
  await expect(dialog.getByText('Token configured.')).toBeVisible()
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(accessToken)

  const afterReload = page.waitForRequest((request) => (
    new URL(request.url()).pathname === '/treetop-api/api/v1/status'
  ))
  await page.reload()
  expect((await afterReload).headers().authorization).toBeUndefined()
  await page.getByRole('button', { name: 'Switch server' }).click()
  await expect(page.getByRole('dialog', { name: 'Treetop servers' }).getByText('Token configured.')).not.toBeVisible()
})

test('clears a browser credential when its server URL changes', async ({ page }) => {
  await mockTreetop(page, true, 'treetop-production')
  await mockTreetop(page, true, 'treetop-production-v2')
  await page.getByRole('button', { name: 'Switch server' }).click()
  const dialog = page.getByRole('dialog', { name: 'Treetop servers' })
  await dialog.getByRole('button', { name: 'New' }).click()
  await dialog.getByLabel('Name').fill('Production')
  await dialog.getByLabel('Server URL').fill('/treetop-production')
  await dialog.getByLabel('Access token').fill('url-bound-browser-token')
  await dialog.getByRole('button', { name: 'Save server' }).click()
  const connected = page.waitForRequest((request) => (
    new URL(request.url()).pathname === '/treetop-production/api/v1/status'
  ))
  await dialog.getByRole('button', { name: 'Connect', exact: true }).click()
  expect((await connected).headers().authorization).toBe('Bearer url-bound-browser-token')

  await page.getByRole('button', { name: 'Switch server' }).click()
  const reopened = page.getByRole('dialog', { name: 'Treetop servers' })
  await reopened.getByLabel('Server URL').fill('/treetop-production-v2')
  const changed = page.waitForRequest((request) => (
    new URL(request.url()).pathname === '/treetop-production-v2/api/v1/status'
  ))
  await reopened.getByRole('button', { name: 'Save changes' }).click()
  expect((await changed).headers().authorization).toBeUndefined()
  await expect(reopened.getByText('Token configured.')).not.toBeVisible()
})

test('directs unauthorized users to the credential control without retaining a rejected token', async ({ page }) => {
  await page.getByRole('button', { name: 'Switch server' }).click()
  const dialog = page.getByRole('dialog', { name: 'Treetop servers' })
  await dialog.getByLabel('Access token').fill('rejected-browser-token')
  await page.unroute('**/treetop-api/**')
  await page.route('**/treetop-api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/treetop-api', '')
    if (path.startsWith('/api/v1/') || path === '/metrics') {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid rejected-browser-token', code: 'unauthorized' }),
      })
    } else {
      await route.fulfill({ status: 200, contentType: 'text/plain', body: 'ok\n' })
    }
  })
  await dialog.getByRole('button', { name: 'Set token' }).click()
  await dialog.getByRole('button', { name: 'Cancel' }).click()

  await expect(page.getByRole('button', { name: 'Configure credential' })).toBeVisible()
  await expect(page.getByText('invalid rejected-browser-token')).not.toBeVisible()
  await page.getByRole('button', { name: 'Configure credential' }).click()
  await expect(page.getByRole('dialog', { name: 'Treetop servers' }).getByText('Token configured.')).not.toBeVisible()
})
