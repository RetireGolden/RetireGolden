import { execFile as nodeExecFile } from 'node:child_process'

// This helper is imported from trusted main through a data URL, never a PR checkout.
export const TARGET = Object.freeze({
  owner: 'RetireGolden',
  repo: 'RetireGolden',
  subscription: '5e4f5c69-c335-4522-8c94-18eba2057640',
  resourceGroup: 'RetireGolden_group',
  app: 'RetireGoldenApp',
})
const REPOSITORY = `${TARGET.owner}/${TARGET.repo}`
const RESOURCE = `/subscriptions/${TARGET.subscription}/resourceGroups/${TARGET.resourceGroup}/providers/Microsoft.Web/staticSites/${TARGET.app}`
const MAX_ENVIRONMENTS = 200
const API_VERSION = '2024-11-01'
const BUILDS_PATH = `${RESOURCE}/builds`
const BUILDS_URL = `https://management.azure.com${BUILDS_PATH}?api-version=${API_VERSION}`

function checkedPageUrl(value) {
  let url
  try { url = new URL(value) } catch { throw new Error('Invalid Azure builds pagination URL') }
  if (url.origin !== 'https://management.azure.com' || url.username || url.password || url.hash ||
      url.pathname.toLowerCase() !== BUILDS_PATH.toLowerCase() ||
      url.searchParams.getAll('api-version').length !== 1 || url.searchParams.get('api-version') !== API_VERSION) {
    throw new Error('Azure builds pagination escaped the fixed app resource')
  }
  return url.href
}

export function previewEnvironmentName(prNumber) {
  if (!Number.isSafeInteger(prNumber) || prNumber <= 0) {
    throw new Error('PR number must be a positive safe integer')
  }
  return `pr${prNumber}`
}

function environmentNumber(name) {
  if (typeof name !== 'string' || !/^pr[1-9][0-9]*$/.test(name)) return undefined
  const number = Number(name.slice(2))
  return Number.isSafeInteger(number) && previewEnvironmentName(number) === name ? number : undefined
}

function boundedInteger(value, maximum, label) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${label} must be between 1 and ${maximum}`)
  }
}

export function createAzureCliAdapter({ execFile = nodeExecFile } = {}) {
  const run = (args) => new Promise((resolve, reject) => {
    execFile('az', args, {
      shell: false,
      timeout: 120_000,
      maxBuffer: 2 * 1024 * 1024,
      encoding: 'utf8',
      windowsHide: true,
    }, (error, stdout) => {
      if (error) {
        // Do not echo CLI stderr, which may contain account or credential details.
        reject(new Error(`Azure CLI ${args[2]} failed (${error.code ?? 'execution error'})`))
      } else resolve(stdout)
    })
  })
  const scope = ['--subscription', TARGET.subscription, '--only-show-errors']
  return {
    async listEnvironments() {
      const environments = []
      const seen = new Set()
      let pageUrl = BUILDS_URL
      for (let page = 0; page < 20; page++) {
        pageUrl = checkedPageUrl(pageUrl)
        if (seen.has(pageUrl)) throw new Error('Azure builds pagination repeated a page')
        seen.add(pageUrl)
        const output = await run(['rest', '--method', 'get', '--url', pageUrl, ...scope, '--output', 'json'])
        let response
        try { response = JSON.parse(output) } catch { throw new Error('Azure environment list is not JSON') }
        if (!response || !Array.isArray(response.value)) throw new Error('Azure builds response lacks a value array')
        for (const item of checkedRecords(response.value)) {
          if (!item.properties || typeof item.properties !== 'object' || Array.isArray(item.properties)) {
            throw new Error('Azure build properties are unavailable')
          }
          environments.push({ ...item.properties, name: item.name, id: item.id })
        }
        checkedList(environments)
        if (response.nextLink === undefined || response.nextLink === null || response.nextLink === '') return environments
        if (typeof response.nextLink !== 'string') throw new Error('Invalid Azure builds pagination URL')
        pageUrl = response.nextLink
      }
      throw new Error('Azure builds pagination exceeded its page bound')
    },
    async deleteEnvironment(name) {
      if (environmentNumber(name) === undefined) throw new Error('Refusing a noncanonical preview name')
      const url = `https://management.azure.com${BUILDS_PATH}/${name}?api-version=${API_VERSION}`
      // Direct ARM deletion avoids SDK app reads and unrelated LRO permissions.
      // The caller verifies completion using only subsequent scoped builds reads.
      await run(['rest', '--method', 'delete', '--url', url, ...scope, '--output', 'none'])
    },
  }
}

function checkedRecords(environments) {
  if (!Array.isArray(environments) || environments.length > MAX_ENVIRONMENTS ||
      environments.some((environment) => !environment || typeof environment !== 'object' || Array.isArray(environment))) {
    throw new Error('Azure environment list has an invalid or unbounded shape')
  }
  return environments
}

function checkedList(environments) {
  checkedRecords(environments)
  const identities = new Set()
  for (const environment of environments) {
    // Validate every entry, including production and non-PR names. Otherwise an
    // unidentified entry could conceal the requested preview and fake absence.
    const { name, buildId, id } = environment
    if (typeof name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/.test(name) ||
        buildId !== name || typeof id !== 'string' ||
        id.toLowerCase() !== `${BUILDS_PATH}/${name}`.toLowerCase()) {
      throw new Error('Azure environment inventory has an invalid or mismatched identity')
    }
    const identity = id.toLowerCase()
    if (identities.has(identity)) throw new Error('Azure returned duplicate preview identities')
    identities.add(identity)
  }
  return environments
}

function resourceReason(environment, name) {
  if (environment.name !== name || environment.buildId !== name ||
      typeof environment.id !== 'string' ||
      environment.id.toLowerCase() !== `${RESOURCE}/builds/${name}`.toLowerCase()) {
    return 'environment identity does not match the fixed Azure resource'
  }
  for (const field of ['databaseConnections', 'linkedBackends', 'userProvidedFunctionApps']) {
    const value = environment[field]
    // Missing metadata is not evidence of an isolated static preview.
    if (value !== null && (!Array.isArray(value) || value.length !== 0)) {
      return `${field} is nonempty or unavailable; manual handling required`
    }
  }
  return undefined
}

async function livePullRequest(github, prNumber) {
  try {
    const { data } = await github.rest.pulls.get({ owner: TARGET.owner, repo: TARGET.repo, pull_number: prNumber })
    return data
  } catch (error) {
    if (error?.status === 404) return undefined
    throw error
  }
}

function pullRequestReason(pr, prNumber) {
  if (!pr) return 'pull request is unknown'
  if (pr.number !== prNumber || !['open', 'closed'].includes(pr.state)) return 'pull request response is invalid'
  if (pr.head?.repo?.full_name !== REPOSITORY || pr.base?.repo?.full_name !== REPOSITORY) {
    return 'pull request is from a fork or another repository'
  }
  return undefined
}

function defaultBranchArgument(defaultBranch) {
  if (typeof defaultBranch !== 'string' || !defaultBranch || defaultBranch.length > 255 || /[\x00-\x20]/.test(defaultBranch)) {
    throw new Error('A trusted default branch is required')
  }
}

const result = (status, reason, prNumber, environmentName) => ({ status, reason, prNumber, environmentName })

export async function planPreviewReconciliation({ azure, github, defaultBranch, limit = 100 }) {
  defaultBranchArgument(defaultBranch)
  boundedInteger(limit, MAX_ENVIRONMENTS, 'limit')
  const environments = checkedList(await azure.listEnvironments())
  const results = []
  const candidates = []
  const seen = new Set()
  const previews = []
  for (const environment of environments) {
    const prNumber = environmentNumber(environment.name)
    if (prNumber === undefined) {
      results.push(result('skipped', 'not a canonical PR preview', undefined, environment.name))
      continue
    }
    if (seen.has(prNumber)) throw new Error('Azure returned duplicate preview identities')
    seen.add(prNumber)
    previews.push({ prNumber, environment })
  }
  previews.sort((a, b) => a.prNumber - b.prNumber)
  for (const { prNumber, environment } of previews) {
    const name = previewEnvironmentName(prNumber)
    const identityReason = resourceReason(environment, name)
    if (identityReason) {
      results.push(result('blocked', identityReason, prNumber, name))
      continue
    }
    const pr = await livePullRequest(github, prNumber)
    const reason = pullRequestReason(pr, prNumber)
    if (reason || pr.state !== 'closed') {
      results.push(result('skipped', reason ?? 'pull request is open', prNumber, name))
    } else if (candidates.length >= limit) {
      results.push(result('deferred', 'candidate limit reached', prNumber, name))
    } else candidates.push({ prNumber, environmentName: name })
  }
  return { candidates, results }
}

function findEnvironment(environments, name) {
  const matches = checkedList(environments).filter((environment) =>
    environment.name === name || environment.buildId === name ||
    (typeof environment.id === 'string' && environment.id.toLowerCase() === `${RESOURCE}/builds/${name}`.toLowerCase()))
  if (matches.length > 1) throw new Error('Azure returned ambiguous preview identities')
  return matches[0]
}

/**
 * Caller must hold the per-PR lock across upload and owned-upload cleanup.
 * Closed/sweep callers must share that same lock. No helper can make a GitHub
 * state read and Azure deletion atomic; the final GitHub read minimizes that gap.
 */
export async function cleanupPreview({
  azure, github, defaultBranch, prNumber, dryRun = false, mode = 'closed',
  expectedHeadSha, eligibilityPredicate, pollAttempts = 12, pollIntervalMs = 5000,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const name = previewEnvironmentName(prNumber)
  defaultBranchArgument(defaultBranch)
  if (!['closed', 'owned-upload'].includes(mode)) throw new Error('Unknown preview cleanup mode')
  if (typeof dryRun !== 'boolean') throw new Error('dryRun must be boolean')
  boundedInteger(pollAttempts, 30, 'pollAttempts')
  boundedInteger(pollIntervalMs, 10_000, 'pollIntervalMs')
  if (mode === 'owned-upload' && (typeof expectedHeadSha !== 'string' || !/^[a-f0-9]{40}$/.test(expectedHeadSha) || typeof eligibilityPredicate !== 'function')) {
    throw new Error('Owned upload cleanup requires an exact head SHA and trusted eligibility predicate')
  }
  const environment = findEnvironment(await azure.listEnvironments(), name)
  if (!environment) return result('absent', 'preview is already absent', prNumber, name)
  const identityReason = resourceReason(environment, name)
  if (identityReason) return result('blocked', identityReason, prNumber, name)
  // This is the final awaited operation before deletion (or the dry-run report).
  const pr = await livePullRequest(github, prNumber)
  const reason = pullRequestReason(pr, prNumber)
  if (reason) return result('skipped', reason, prNumber, name)
  let deletionReason = 'pull request is closed'
  if (mode === 'closed') {
    if (pr.state !== 'closed') return result('skipped', 'pull request is open', prNumber, name)
  } else {
    const skipReason = eligibilityPredicate(pr, {
      repository: { full_name: REPOSITORY }, defaultBranch, expectedHeadSha,
    })
    if (skipReason === undefined) return result('skipped', 'owned upload is still eligible', prNumber, name)
    if (typeof skipReason !== 'string' || !skipReason) throw new Error('Trusted eligibility predicate returned an invalid reason')
    deletionReason = skipReason
  }
  if (dryRun) return result('dry-run', deletionReason, prNumber, name)
  await azure.deleteEnvironment(name)
  for (let attempt = 0; attempt < pollAttempts; attempt++) {
    let environments
    try {
      environments = await azure.listEnvironments()
    } catch (error) {
      // ARM can briefly fail a builds list after deletion. An error never proves
      // absence; retry only within this verification budget, preserving the last
      // failure if no successful list is obtained before the budget runs out.
      if (attempt + 1 === pollAttempts) throw error
      await sleep(pollIntervalMs)
      continue
    }
    const remaining = findEnvironment(environments, name)
    if (!remaining) return result('deleted', 'preview absence confirmed', prNumber, name)
    const changedIdentity = resourceReason(remaining, name)
    if (changedIdentity) throw new Error(`Preview changed during deletion verification: ${changedIdentity}`)
    if (attempt + 1 < pollAttempts) await sleep(pollIntervalMs)
  }
  throw new Error(`Preview ${name} is still present after bounded deletion polling`)
}
