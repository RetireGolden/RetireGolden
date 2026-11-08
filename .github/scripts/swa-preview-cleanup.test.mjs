import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { cleanupPreview, createAzureCliAdapter, planPreviewReconciliation, previewEnvironmentName, TARGET } from './swa-preview-cleanup.mjs'

const repository = `${TARGET.owner}/${TARGET.repo}`
const resource = `/subscriptions/${TARGET.subscription}/resourceGroups/${TARGET.resourceGroup}/providers/Microsoft.Web/staticSites/${TARGET.app}`
const sha = 'a'.repeat(40)
const environment = (n, extra = {}) => ({
  name: `pr${n}`, buildId: `pr${n}`, id: `${resource}/builds/pr${n}`,
  databaseConnections: [], linkedBackends: [], userProvidedFunctionApps: null, ...extra,
})
const pullRequest = (n, extra = {}) => ({
  number: n, state: 'closed',
  head: { sha, repo: { full_name: repository } },
  base: { ref: 'main', repo: { full_name: repository } },
  labels: [{ name: 'run-ci' }], ...extra,
})
function harness({ lists = [[environment(853)], []], prs = [pullRequest(853)] } = {}) {
  const calls = []
  let listIndex = 0
  let prIndex = 0
  return {
    calls,
    azure: {
      async listEnvironments() {
        calls.push('list')
        const value = lists[Math.min(listIndex++, lists.length - 1)]
        if (value instanceof Error) throw value
        return value
      },
      async deleteEnvironment(name) { calls.push(['delete', name]) },
    },
    github: { rest: { pulls: { async get(args) {
      calls.push(['pr', args])
      const value = prs[Math.min(prIndex++, prs.length - 1)]
      if (value instanceof Error) throw value
      return { data: value }
    } } } },
    async sleep(ms) { calls.push(['sleep', ms]) },
    defaultBranch: 'main', prNumber: 853, pollIntervalMs: 1, pollAttempts: 3,
  }
}

test('canonical names exclude production, aliases, unsafe and malformed PR numbers', () => {
  assert.equal(previewEnvironmentName(853), 'pr853')
  for (const number of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '853', 'default', 'production']) {
    assert.throws(() => previewEnvironmentName(number), /positive safe integer/)
  }
})

test('exact isolated preview deletion verifies absence, polling boundedly', async () => {
  const h = harness({ lists: [[environment(853)], [environment(853)], []] })
  assert.deepEqual(await cleanupPreview(h), {
    status: 'deleted', reason: 'preview absence confirmed', prNumber: 853, environmentName: 'pr853',
  })
  assert.deepEqual(h.calls, ['list', ['pr', {
    owner: 'RetireGolden', repo: 'RetireGolden', pull_number: 853,
  }], ['delete', 'pr853'], 'list', ['sleep', 1], 'list'])
})

test('already absent is idempotent and never performs a delete', async () => {
  const h = harness({ lists: [[]] })
  assert.equal((await cleanupPreview(h)).status, 'absent')
  assert.deepEqual(h.calls, ['list'])
})

test('planner candidate reopened before execution is protected by final live read', async () => {
  const h = harness({ lists: [[environment(853)]], prs: [pullRequest(853), pullRequest(853, { state: 'open' })] })
  assert.deepEqual((await planPreviewReconciliation(h)).candidates, [{ prNumber: 853, environmentName: 'pr853' }])
  assert.equal((await cleanupPreview(h)).reason, 'pull request is open')
  assert.equal(h.calls.filter(Array.isArray).some((call) => call[0] === 'delete'), false)
})

test('normal cleanup protects every open preview even when run-ci is absent or head changed', async () => {
  const h = harness({ prs: [pullRequest(853, { state: 'open', labels: [], head: { sha: 'b'.repeat(40), repo: { full_name: repository } } })] })
  assert.equal((await cleanupPreview(h)).status, 'skipped')
  assert.equal(h.calls.some((call) => Array.isArray(call) && call[0] === 'delete'), false)
})

test('wrong subscription/app/build identifiers and unknown backend metadata block deletion', async (t) => {
  for (const extra of [
    { id: `${resource.replace(TARGET.subscription, 'wrong')}/builds/pr853` },
    { id: `${resource.replace(TARGET.app, 'AnotherApp')}/builds/pr853` },
    { buildId: 'default' }, { name: 'default' },
    { databaseConnections: [{ name: 'db' }] }, { linkedBackends: [{ id: 'backend' }] },
    { userProvidedFunctionApps: [{ id: 'function' }] }, { databaseConnections: undefined },
  ]) await t.test(JSON.stringify(extra), async () => {
    const h = harness({ lists: [[environment(853, extra)]] })
    assert.equal((await cleanupPreview(h)).status, 'blocked')
    assert.deepEqual(h.calls, ['list'])
  })
})

test('unknown, fork, wrong base repository and mismatched PR responses are skipped', async (t) => {
  for (const pr of [
    Object.assign(new Error('Not Found'), { status: 404 }),
    pullRequest(853, { head: { sha, repo: { full_name: 'fork/RetireGolden' } } }),
    pullRequest(853, { base: { ref: 'main', repo: { full_name: 'other/repo' } } }),
    pullRequest(854),
  ]) await t.test(pr.message ?? JSON.stringify(pr), async () => {
    const h = harness({ prs: [pr] })
    assert.equal((await cleanupPreview(h)).status, 'skipped')
    assert.equal(h.calls.some((call) => Array.isArray(call) && call[0] === 'delete'), false)
  })
})

test('closed retargeted PRs remain eligible for normal cleanup and reconciliation', async () => {
  const pr = pullRequest(853, { base: { ref: 'release', repo: { full_name: repository } } })
  const h = harness({ prs: [pr] })
  assert.deepEqual((await planPreviewReconciliation(h)).candidates, [{ prNumber: 853, environmentName: 'pr853' }])
  const cleanup = harness({ prs: [pr] })
  assert.equal((await cleanupPreview(cleanup)).status, 'deleted')
})

test('Azure list and GitHub authorization errors fail rather than becoming absence', async () => {
  await assert.rejects(cleanupPreview(harness({ lists: [new Error('Azure auth denied')] })), /Azure auth denied/)
  await assert.rejects(cleanupPreview(harness({ prs: [Object.assign(new Error('GitHub auth denied'), { status: 403 })] })), /GitHub auth denied/)
  await assert.rejects(planPreviewReconciliation(harness({ lists: [new Error('list failed')] })), /list failed/)
})

test('delete failure and polling list failure propagate without false success', async () => {
  const h = harness()
  h.azure.deleteEnvironment = async () => { throw new Error('delete denied') }
  await assert.rejects(cleanupPreview(h), /delete denied/)
  assert.equal(h.calls.filter((call) => call === 'list').length, 1)
  assert.equal(h.calls.some((call) => Array.isArray(call) && call[0] === 'sleep'), false)
  const polling = harness({ lists: [[environment(853)], new Error('poll auth failed')] })
  await assert.rejects(cleanupPreview(polling), /poll auth failed/)
  assert.equal(polling.calls.filter((call) => call === 'list').length, 4)
  assert.equal(polling.calls.filter((call) => Array.isArray(call) && call[0] === 'sleep').length, 2)
})

test('transient post-delete list error requires a later validated absent list', async () => {
  const h = harness({ lists: [[environment(853)], new Error('Cannot find Environment with name pr853'), []] })
  assert.equal((await cleanupPreview(h)).status, 'deleted')
  assert.equal(h.calls.filter((call) => call === 'list').length, 3)
  assert.equal(h.calls.filter((call) => Array.isArray(call) && call[0] === 'delete').length, 1)
  assert.deepEqual(h.calls.at(-2), ['sleep', 1])
})

test('post-delete list errors exhaust the same budget and retain the final error', async () => {
  const finalError = Object.assign(new Error('last authorization failure'), { status: 403 })
  const h = harness({ lists: [[environment(853)], new Error('transient'), new Error('still failing'), finalError] })
  await assert.rejects(cleanupPreview(h), (error) => error === finalError)
  assert.equal(h.calls.filter((call) => call === 'list').length, 4)
  assert.equal(h.calls.filter((call) => Array.isArray(call) && call[0] === 'sleep').length, 2)
})

test('still-present preview fails after the configured bounded polling budget', async () => {
  const h = harness({ lists: [[environment(853)]] })
  await assert.rejects(cleanupPreview(h), /still present after bounded/)
  assert.equal(h.calls.filter((call) => call === 'list').length, 4)
  assert.equal(h.calls.filter((call) => Array.isArray(call) && call[0] === 'sleep').length, 2)
})

test('ambiguous identity and changed backend metadata cannot establish safe deletion', async () => {
  await assert.rejects(cleanupPreview(harness({ lists: [[environment(853), environment(853)]] })), /ambiguous/)
  const changed = harness({
    lists: [[environment(853)], [environment(853, { linkedBackends: [{ id: 'new backend' }] })]],
  })
  await assert.rejects(cleanupPreview(changed), /changed during deletion verification/)
  assert.equal(changed.calls.filter((call) => call === 'list').length, 2)
  assert.equal(changed.calls.some((call) => Array.isArray(call) && call[0] === 'sleep'), false)
})

test('dry run reads eligibility but never deletes or claims verified absence', async () => {
  const h = harness()
  assert.equal((await cleanupPreview({ ...h, dryRun: true })).status, 'dry-run')
  assert.equal(h.calls.length, 2)
})

const eligibilityPredicate = (pr, { expectedHeadSha, defaultBranch }) => {
  if (pr.state !== 'open') return 'pull request is not open'
  if (pr.head.sha !== expectedHeadSha) return 'pull request head changed'
  if (pr.base.ref !== defaultBranch) return 'pull request no longer targets the default branch'
  if (!pr.labels.some((label) => label.name === 'run-ci')) return 'run-ci label is absent'
  return undefined
}

test('owned-upload cleanup deletes superseded, closed or deauthorized upload only', async (t) => {
  for (const extra of [{ state: 'closed' }, { head: { sha: 'b'.repeat(40), repo: { full_name: repository } } }, { labels: [] }, { base: { ref: 'release', repo: { full_name: repository } } }]) {
    await t.test(JSON.stringify(extra), async () => {
      const h = harness({ prs: [pullRequest(853, { state: 'open', ...extra })] })
      assert.equal((await cleanupPreview({ ...h, mode: 'owned-upload', expectedHeadSha: sha, eligibilityPredicate })).status, 'deleted')
    })
  }
})

test('owned-upload mode protects still-eligible current head', async () => {
  const h = harness({ prs: [pullRequest(853, { state: 'open' })] })
  assert.equal((await cleanupPreview({ ...h, mode: 'owned-upload', expectedHeadSha: sha, eligibilityPredicate })).reason, 'owned upload is still eligible')
  assert.equal(h.calls.length, 2)
})

test('owned-upload predicate errors or invalid reasons fail closed', async () => {
  for (const predicate of [() => false, () => '', () => { throw new Error('predicate failed') }]) {
    const h = harness()
    await assert.rejects(cleanupPreview({ ...h, mode: 'owned-upload', expectedHeadSha: sha, eligibilityPredicate: predicate }), /predicate|invalid reason/)
    assert.equal(h.calls.some((call) => Array.isArray(call) && call[0] === 'delete'), false)
  }
})

test('owned-upload requires full SHA and an injected trusted predicate', async () => {
  for (const extra of [{ expectedHeadSha: 'aaaa', eligibilityPredicate }, { expectedHeadSha: sha }, { expectedHeadSha: sha, eligibilityPredicate: false }]) {
    const h = harness()
    await assert.rejects(cleanupPreview({ ...h, mode: 'owned-upload', ...extra }), /exact head SHA and trusted/)
    assert.deepEqual(h.calls, [])
  }
})

test('planner protects production/unknown names and sorts numeric PR candidates with bounds', async () => {
  const h = harness({
    lists: [[{ name: 'default' }, { name: 'production' }, { name: 'pr01' }, { name: 'pr9007199254740992' }, environment(20), environment(3), environment(10)]],
  })
  h.github.rest.pulls.get = async ({ pull_number }) => ({ data: pullRequest(pull_number) })
  const plan = await planPreviewReconciliation({ ...h, limit: 2 })
  assert.deepEqual(plan.candidates, [{ prNumber: 3, environmentName: 'pr3' }, { prNumber: 10, environmentName: 'pr10' }])
  assert.equal(plan.results.filter((r) => r.status === 'skipped').length, 4)
  assert.equal(plan.results.find((r) => r.prNumber === 20).status, 'deferred')
  await assert.rejects(planPreviewReconciliation({ ...h, limit: 0 }), /limit/)
  await assert.rejects(planPreviewReconciliation(harness({ lists: [Array.from({ length: 201 }, (_, n) => environment(n + 1))] })), /unbounded/)
})

test('planner rejects duplicate identities and skips active, fork and unknown PRs', async () => {
  await assert.rejects(planPreviewReconciliation(harness({ lists: [[environment(853), environment(853)]] })), /duplicate/)
  for (const pr of [pullRequest(853, { state: 'open' }), pullRequest(853, { head: { repo: null } }), Object.assign(new Error('unknown'), { status: 404 })]) {
    assert.deepEqual((await planPreviewReconciliation(harness({ prs: [pr] }))).candidates, [])
  }
})

test('CLI adapter fixes the target, uses argument arrays and explicit environment', async () => {
  const calls = []
  const azure = createAzureCliAdapter({ execFile(command, args, options, callback) {
    calls.push({ command, args, options })
    const { id, name, ...properties } = environment(853)
    callback(null, args.includes('get') ? JSON.stringify({ value: [{ id, name, properties }] }) : '')
  } })
  assert.equal((await azure.listEnvironments())[0].name, 'pr853')
  await azure.deleteEnvironment('pr853')
  assert.deepEqual(calls[1].args, ['rest', '--method', 'delete', '--url',
    `https://management.azure.com${resource}/builds/pr853?api-version=2024-11-01`,
    '--subscription', TARGET.subscription, '--only-show-errors', '--output', 'none'])
  for (const call of calls) {
    assert.equal(call.command, 'az')
    assert.equal(call.options.shell, false)
    assert.equal(call.options.timeout, 120_000)
    assert.equal(call.options.maxBuffer, 2 * 1024 * 1024)
  }
  for (const name of ['default', 'production', 'pr01', 'pr853;echo unsafe', '../pr853']) {
    await assert.rejects(azure.deleteEnvironment(name), /noncanonical/)
  }
  assert.equal(calls.length, 2)
})

test('CLI adapter fails closed on errors, malformed JSON and unexpected list shape', async () => {
  const denied = createAzureCliAdapter({ execFile(command, args, options, callback) { callback(Object.assign(new Error('secret stderr'), { code: 1 })) } })
  await assert.rejects(denied.listEnvironments(), /^Error: Azure CLI get failed \(1\)$/)
  await assert.rejects(denied.deleteEnvironment('pr853'), /Azure CLI delete failed/)
  for (const stdout of ['bad json', '{}', 'null', '[null]', '{"value":[null]}', '{"value":[{}]}']) {
    const azure = createAzureCliAdapter({ execFile(command, args, options, callback) { callback(null, stdout) } })
    await assert.rejects(azure.listEnvironments(), /not JSON|invalid or unbounded|value array|properties/)
  }
})

test('REST pagination normalizes properties and stays under the fixed builds path', async () => {
  const calls = []
  const nextLink = `https://management.azure.com${resource}/builds?api-version=2024-11-01&$skiptoken=next`
  const azure = createAzureCliAdapter({ execFile(command, args, options, callback) {
    calls.push(args)
    const { id, name, ...properties } = environment(calls.length)
    callback(null, JSON.stringify({ value: [{ id, name, properties }], ...(calls.length === 1 ? { nextLink } : {}) }))
  } })
  assert.deepEqual(await azure.listEnvironments(), [environment(1), environment(2)])
  assert.equal(calls[1][4], nextLink)
})

test('REST pagination rejects off-app URLs, loops and excessive pages', async () => {
  for (const nextLink of [
    'https://attacker.invalid/builds?api-version=2024-11-01',
    `https://management.azure.com${resource}/other?api-version=2024-11-01`,
    `https://management.azure.com${resource}/builds?api-version=2023-01-01`,
    `https://management.azure.com${resource}/builds?api-version=2024-11-01#fragment`,
    `https://management.azure.com${resource}/builds?api-version=2024-11-01`,
  ]) {
    let count = 0
    const azure = createAzureCliAdapter({ execFile(command, args, options, callback) {
      count++
      callback(null, JSON.stringify({ value: [], nextLink }))
    } })
    await assert.rejects(azure.listEnvironments(), /pagination/)
    assert.equal(count, 1)
  }
  let pages = 0
  const azure = createAzureCliAdapter({ execFile(command, args, options, callback) {
    pages++
    callback(null, JSON.stringify({ value: [], nextLink: `https://management.azure.com${resource}/builds?api-version=2024-11-01&skip=${pages}` }))
  } })
  await assert.rejects(azure.listEnvironments(), /page bound/)
  assert.equal(pages, 20)
})

test('module imports from a data URL with built-in dependencies only', async () => {
  const source = await readFile(new URL('./swa-preview-cleanup.mjs', import.meta.url), 'utf8')
  const imported = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
  assert.equal(imported.previewEnvironmentName(853), 'pr853')
})
