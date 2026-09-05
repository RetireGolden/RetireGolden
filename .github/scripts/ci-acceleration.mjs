/**
 * Shared CI predicates and API authorization helpers.
 * Review bodies are parsed as data only; the ledger payload is never executed.
 */

export const CI_ACCELERATION_HELPER_PATH = '.github/scripts/ci-acceleration.mjs'
export const REVIEW_LEDGER_MARKER_PREFIX = '<!-- openrouter-review-ledger:v1:'
export const REVIEW_LEDGER_HEADING = '## OpenRouter pull-request review'
export const TRUSTED_REVIEW_AUTHOR = 'github-actions[bot]'
export const TRUSTED_REVIEW_AUTHOR_ID = 41898282
export const TRUSTED_REVIEW_AUTHOR_TYPE = 'Bot'
export const DEPENDABOT_LOGIN = 'dependabot[bot]'
export const TRUSTED_REVIEW_WORKFLOW_ID = 341686683
export const TRUSTED_OPENROUTER_CALLER_PATH = '.github/workflows/openrouter-code-review.yml'
export const TRUSTED_REUSABLE_REVIEW_WORKFLOW =
  'RetireGolden/.github/.github/workflows/openrouter-code-review.yml@f6aa157430509b5f6945b4fc2c9fafeeac4a7294'
export const TRUSTED_REUSABLE_REVIEW_WORKFLOW_SHA = 'f6aa157430509b5f6945b4fc2c9fafeeac4a7294'
export const EXPENSIVE_AZURE_JOB_NAMES = new Set([
  'lint',
  'test engine',
  'test planner-ui',
  'test web',
  'test',
  'e2e',
  'build',
  'deploy',
])

function decodeLedgerPayload(encoded) {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    return undefined
  }
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8')
    if (Buffer.from(decoded, 'utf8').toString('base64') !== encoded) return undefined
    const payload = JSON.parse(decoded)
    return payload !== null && typeof payload === 'object' && !Array.isArray(payload) ? payload : undefined
  } catch {
    return undefined
  }
}

function trustedLedger(body, { repository, pullNumber, headSha, workflowRunUrls }) {
  const lines = body.split(/\r?\n/)
  if (lines.at(-1) === '') lines.pop()
  const marker = /^<!-- openrouter-review-ledger:v1:([A-Za-z0-9+/=]+) -->$/.exec(lines[1] ?? '')
  const payload = marker && decodeLedgerPayload(marker[1])

  const verdict = /^\*\*Verdict:\*\* `(clean|issues)`$/.exec(lines[3] ?? '')?.[1]
  // Upstream review-loop keeps disputed history in the ledger; `fixed` removes
  // the entry, and clean means zero open findings (all-disputed is valid).
  const cleanFindings =
    Array.isArray(payload?.findings) &&
    payload.findings.every(
      (finding) =>
        finding !== null &&
        typeof finding === 'object' &&
        !Array.isArray(finding) &&
        finding.st === 'disputed',
    )
  const validPayload =
    payload?.lv === 1 &&
    payload.repo === repository.full_name &&
    payload.pr === pullNumber &&
    payload.sha === headSha &&
    typeof payload.gen === 'string' && /^[a-f0-9]{12}$/.test(payload.gen) &&
    Number.isSafeInteger(payload.round) && payload.round > 0 &&
    Array.isArray(payload.findings) &&
    ((verdict === 'clean' && cleanFindings) ||
      (verdict === 'issues' && payload.findings.length > 0))

  return (
    lines[0] === REVIEW_LEDGER_HEADING &&
    lines[2] === '' &&
    verdict !== undefined &&
    lines[4]?.startsWith('**Scope:** `') &&
    lines[5]?.startsWith('**Mode:** `') &&
    lines[6] === `**Commit:** \`${headSha}\`` &&
    workflowRunUrls.some((url) => lines.at(-1) === `[Workflow run](${url})`) &&
    validPayload
  ) ? { verdict, workflowUrl: lines.at(-1) } : undefined
}

export function workflowRunUrl(owner, repo, runId) {
  return `https://github.com/${owner}/${repo}/actions/runs/${runId}`
}

export function parseWorkflowRunIdFromUrl(url) {
  const match = /^https:\/\/github\.com\/[^/]+\/[^/]+\/actions\/runs\/(\d+)$/.exec(url)
  return match ? Number(match[1]) : undefined
}

export function newestWorkflowRun(runs) {
  return [...runs].sort((left, right) => {
    for (const [leftValue, rightValue] of [
      [Date.parse(left.created_at ?? '') || -Infinity, Date.parse(right.created_at ?? '') || -Infinity],
      [Number.isSafeInteger(left.run_number) ? left.run_number : -Infinity, Number.isSafeInteger(right.run_number) ? right.run_number : -Infinity],
      [Number.isSafeInteger(left.run_attempt) ? left.run_attempt : -Infinity, Number.isSafeInteger(right.run_attempt) ? right.run_attempt : -Infinity],
      [Number.isSafeInteger(left.id) ? left.id : -Infinity, Number.isSafeInteger(right.id) ? right.id : -Infinity],
    ]) {
      if (leftValue !== rightValue) return rightValue > leftValue ? 1 : -1
    }
    return 0
  })[0]
}

export function exactHeadBotReview(review, headSha) {
  return review.user?.login === TRUSTED_REVIEW_AUTHOR &&
    review.user?.id === TRUSTED_REVIEW_AUTHOR_ID &&
    review.user?.type === TRUSTED_REVIEW_AUTHOR_TYPE &&
    typeof review.commit_id === 'string' &&
    review.commit_id === headSha
}

export function reviewReferencesAuthoritativeRun(review, workflowRunUrl) {
  const body = typeof review.body === 'string' ? review.body : ''
  return body.includes(`[Workflow run](${workflowRunUrl})`)
}

export function findTrustedCleanReview(reviews, context) {
  const workflowRunUrls = context.workflowRunUrl
    ? [context.workflowRunUrl]
    : (context.workflowRunUrls ?? [])
  if (workflowRunUrls.length === 0 || workflowRunUrls.some((url) => typeof url !== 'string')) return undefined

  const latest = reviews.reduce((newest, review, index) => {
    if (!exactHeadBotReview(review, context.headSha) ||
      !workflowRunUrls.some((url) => reviewReferencesAuthoritativeRun(review, url))) return newest
    const candidate = { review, index }
    if (!newest) return candidate
    const newestTime = Date.parse(newest.review.submitted_at ?? '') || -Infinity
    const candidateTime = Date.parse(candidate.review.submitted_at ?? '') || -Infinity
    if (candidateTime !== newestTime) return candidateTime > newestTime ? candidate : newest
    const newestId = newest.review.id ?? -Infinity
    const candidateId = candidate.review.id ?? -Infinity
    return candidateId > newestId || (candidateId === newestId && candidate.index > newest.index)
      ? candidate
      : newest
  }, undefined)
  if (!latest) return undefined

  const ledger = latest.review.state === 'COMMENTED' &&
    trustedLedger(typeof latest.review.body === 'string' ? latest.review.body : '', {
      ...context,
      workflowRunUrls,
    })
  return ledger?.verdict === 'clean' ? latest.review : undefined
}

function trustedOpenRouterRunProvenance(workflowRun, repository) {
  if (workflowRun.workflow_id !== TRUSTED_REVIEW_WORKFLOW_ID) {
    return 'workflow run id is not the trusted OpenRouter workflow'
  }
  if (workflowRun.name !== 'OpenRouter code review') return 'workflow run name is not OpenRouter code review'
  if (workflowRun.path !== TRUSTED_OPENROUTER_CALLER_PATH) {
    return 'workflow run path is not the trusted OpenRouter caller'
  }
  if (!Array.isArray(workflowRun.referenced_workflows) || !workflowRun.referenced_workflows.some(
    (workflow) => workflow?.path === TRUSTED_REUSABLE_REVIEW_WORKFLOW &&
      workflow?.sha === TRUSTED_REUSABLE_REVIEW_WORKFLOW_SHA,
  )) {
    return 'workflow run does not reference the trusted reusable OpenRouter workflow'
  }
  if (workflowRun.head_repository?.full_name !== repository.full_name) {
    return 'review run head repository is not the trusted repository'
  }
  return undefined
}

export function reviewRunSkipReason(workflowRun, repository) {
  const provenanceReason = trustedOpenRouterRunProvenance(workflowRun, repository)
  if (provenanceReason) return provenanceReason
  if (workflowRun.event !== 'pull_request') return 'review run event is not pull_request'
  return undefined
}

export function reviewDispatchRunSkipReason(workflowRun, repository) {
  const provenanceReason = trustedOpenRouterRunProvenance(workflowRun, repository)
  if (provenanceReason) return provenanceReason
  if (workflowRun.event !== 'workflow_dispatch') return 'review run event is not workflow_dispatch'
  return undefined
}

export function workflowBlobMatchesDefaultBranch(headFile, defaultBranchFile) {
  const head = headFile?.data
  const defaultBranch = defaultBranchFile?.data
  return (
    !Array.isArray(head) && head?.type === 'file' && typeof head.sha === 'string' &&
    !Array.isArray(defaultBranch) && defaultBranch?.type === 'file' && typeof defaultBranch.sha === 'string' &&
    head.sha === defaultBranch.sha
  )
}

export function azureRunSkipReason(workflowRun) {
  if (workflowRun.name !== 'Azure Static Web Apps CI/CD') return 'workflow run name is not Azure Static Web Apps CI/CD'
  if (workflowRun.event !== 'pull_request') return 'Azure run event is not pull_request'
  if (workflowRun.path !== '.github/workflows/azure-static-web-apps-retiregolden.yml') {
    return 'Azure run path is not the trusted CI workflow'
  }
  return undefined
}

export function pullRequestSkipReason(pullRequest, repository, expectedHeadSha) {
  if (pullRequest.state !== 'open') return 'associated pull request is not open'
  if (pullRequest.base?.ref !== 'main') return 'associated pull request does not target main'
  if (pullRequest.head?.repo?.full_name !== repository.full_name) return 'associated pull request is from a fork'
  if (pullRequest.head?.sha !== expectedHeadSha) return 'live pull-request head SHA no longer matches the review run'
  return undefined
}

export function isDependabotPullRequest(pullRequest) {
  return pullRequest.user?.login === DEPENDABOT_LOGIN
}

export function isCiRequested({ runAttempt, hasRunCiLabel }) {
  if (runAttempt > 1) return true
  if (hasRunCiLabel) return true
  return false
}

export function terminalSameRepositoryWorkflowRunUrl(review, repository) {
  const body = typeof review.body === 'string' ? review.body : ''
  const lines = body.split(/\r?\n/)
  if (lines.at(-1) === '') lines.pop()
  const urlLine = lines.at(-1)
  const urlMatch = /^\[Workflow run\]\((https:\/\/github\.com\/[^/]+\/[^/]+\/actions\/runs\/\d+)\)$/.exec(urlLine ?? '')
  if (!urlMatch) return undefined
  if (!urlMatch[1].startsWith(`https://github.com/${repository.full_name}/actions/runs/`)) return undefined
  return urlMatch[1]
}

export function ledgerWorkflowRunUrlsFromReview(review, { repository, pullNumber, headSha }) {
  const workflowRunUrl = terminalSameRepositoryWorkflowRunUrl(review, repository)
  if (!workflowRunUrl) return []
  const body = typeof review.body === 'string' ? review.body : ''
  return trustedLedger(body, {
    repository,
    pullNumber,
    headSha,
    workflowRunUrls: [workflowRunUrl],
  }) ? [workflowRunUrl] : []
}

async function readDefaultBranchCaller(github, owner, repo, defaultBranch) {
  return github.rest.repos.getContent({
    owner,
    repo,
    path: TRUSTED_OPENROUTER_CALLER_PATH,
    ref: defaultBranch,
  })
}

async function proveCallerBlobMatchesDefault(github, owner, repo, run, defaultCaller) {
  try {
    const headCaller = await github.rest.repos.getContent({
      owner,
      repo,
      path: TRUSTED_OPENROUTER_CALLER_PATH,
      ref: run.head_sha,
    })
    return workflowBlobMatchesDefaultBranch(headCaller, defaultCaller)
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.status === 404) return false
    throw error
  }
}

export async function collectProvenanceReviewRuns(github, {
  owner,
  repo,
  repository,
  defaultBranch,
  expectedHeadSha,
  pullNumber,
  reviews,
  allowDispatch = false,
}) {
  let defaultCaller
  try {
    defaultCaller = await readDefaultBranchCaller(github, owner, repo, defaultBranch)
  } catch {
    return { provenanceReviewRuns: [], defaultCaller: undefined, error: 'cannot read trusted default-branch OpenRouter caller' }
  }

  const provenanceReviewRuns = []
  const seenRunIds = new Set()

  const pullRequestRuns = await github.paginate(github.rest.actions.listWorkflowRuns, {
    owner,
    repo,
    workflow_id: 'openrouter-code-review.yml',
    head_sha: expectedHeadSha,
    per_page: 100,
  })
  for (const run of pullRequestRuns) {
    if (!Number.isSafeInteger(run.id) || run.head_sha !== expectedHeadSha) continue
    if (reviewRunSkipReason(run, repository)) continue
    try {
      if (!(await proveCallerBlobMatchesDefault(github, owner, repo, run, defaultCaller))) continue
    } catch {
      return {
        provenanceReviewRuns: [],
        defaultCaller,
        error: 'cannot inspect the exact-head OpenRouter caller',
      }
    }
    provenanceReviewRuns.push(run)
    seenRunIds.add(run.id)
  }

  if (allowDispatch) {
    const dispatchRunIds = new Set()
    for (const review of reviews) {
      if (!exactHeadBotReview(review, expectedHeadSha)) continue
      const workflowRunUrl = terminalSameRepositoryWorkflowRunUrl(review, repository)
      const runId = workflowRunUrl && parseWorkflowRunIdFromUrl(workflowRunUrl)
      if (Number.isSafeInteger(runId)) dispatchRunIds.add(runId)
    }
    for (const runId of dispatchRunIds) {
      if (seenRunIds.has(runId)) continue
      let run
      try {
        ;({ data: run } = await github.rest.actions.getWorkflowRun({ owner, repo, run_id: runId }))
      } catch (error) {
        if (error !== null && typeof error === 'object' && error.status === 404) continue
        return {
          provenanceReviewRuns: [],
          defaultCaller,
          error: 'cannot inspect a linked OpenRouter workflow run',
        }
      }
      if (!Number.isSafeInteger(run.id) || run.id !== runId) continue
      if (reviewDispatchRunSkipReason(run, repository)) continue
      try {
        if (!(await proveCallerBlobMatchesDefault(github, owner, repo, run, defaultCaller))) continue
      } catch {
        return {
          provenanceReviewRuns: [],
          defaultCaller,
          error: 'cannot inspect the linked OpenRouter caller',
        }
      }
      provenanceReviewRuns.push(run)
      seenRunIds.add(run.id)
    }
  }

  return { provenanceReviewRuns, defaultCaller, error: undefined }
}

export async function authorizeExactHeadPullRequest(github, core, {
  owner,
  repo,
  repository,
  defaultBranch,
  eventPr,
  runAttempt,
}) {
  const eventHasRunCi = (eventPr.labels ?? []).some((entry) => entry.name === 'run-ci')
  const eventRequested = isCiRequested({ runAttempt, hasRunCiLabel: eventHasRunCi })
  const expectedHeadSha = eventPr.head?.sha
  const pullNumber = eventPr.number

  if (typeof expectedHeadSha !== 'string' || !Number.isSafeInteger(pullNumber)) {
    return { authorized: false, failJob: eventRequested, reason: 'pull-request event is missing a number or head SHA' }
  }

  const associated = await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit, {
    owner, repo, commit_sha: expectedHeadSha, per_page: 100,
  })
  const liveAssociatedPrs = []
  for (const association of associated) {
    const { data: candidate } = await github.rest.pulls.get({
      owner, repo, pull_number: association.number,
    })
    if (!pullRequestSkipReason(candidate, repository, expectedHeadSha)) {
      liveAssociatedPrs.push(candidate)
    }
  }
  if (liveAssociatedPrs.length !== 1 || liveAssociatedPrs[0].number !== pullNumber) {
    return {
      authorized: false,
      failJob: isCiRequested({
        runAttempt,
        hasRunCiLabel: eventHasRunCi,
      }),
      reason: `expected exactly one live same-repository PR at ${expectedHeadSha}`,
    }
  }

  const pr = liveAssociatedPrs[0]
  const hasRunCiLabel = (pr.labels ?? []).some((entry) => entry.name === 'run-ci')
  const ciRequested = isCiRequested({ runAttempt, hasRunCiLabel })

  if (!hasRunCiLabel) {
    return { authorized: false, failJob: ciRequested, reason: 'live PR does not have run-ci' }
  }

  const reviews = await github.paginate(github.rest.pulls.listReviews, {
    owner, repo, pull_number: pr.number, per_page: 100,
  })

  const { provenanceReviewRuns, error } = await collectProvenanceReviewRuns(github, {
    owner,
    repo,
    repository,
    defaultBranch,
    expectedHeadSha,
    pullNumber: pr.number,
    reviews,
    allowDispatch: true,
  })
  if (error) {
    return { authorized: false, failJob: ciRequested, reason: error }
  }

  const authoritativeReviewRun = newestWorkflowRun(provenanceReviewRuns)
  if (!authoritativeReviewRun || authoritativeReviewRun.status !== 'completed' ||
    authoritativeReviewRun.conclusion !== 'success') {
    return {
      authorized: false,
      failJob: ciRequested,
      reason: 'newest provenance-valid exact-head OpenRouter run is not successful',
    }
  }

  const authoritativeRunUrl = workflowRunUrl(owner, repo, authoritativeReviewRun.id)
  if (!findTrustedCleanReview(reviews, {
    repository,
    pullNumber: pr.number,
    headSha: expectedHeadSha,
    workflowRunUrl: authoritativeRunUrl,
  })) {
    return {
      authorized: false,
      failJob: ciRequested,
      reason: 'latest exact current-head OpenRouter bot review is not a clean authoritative ledger',
    }
  }

  const { data: finalPr } = await github.rest.pulls.get({ owner, repo, pull_number: pr.number })
  if (pullRequestSkipReason(finalPr, repository, expectedHeadSha) ||
    !(finalPr.labels ?? []).some((entry) => entry.name === 'run-ci')) {
    return {
      authorized: false,
      failJob: ciRequested,
      reason: 'PR head/state/repository/label changed during authorization',
    }
  }

  return { authorized: true, failJob: false, reason: `exact-head trusted clean review for ${expectedHeadSha}` }
}

export function isExpensiveAzureJob(job) {
  return EXPENSIVE_AZURE_JOB_NAMES.has(job.name)
}

export function hasOnlySkippedExpensiveAzureJobs(jobs) {
  const expensiveJobs = jobs.filter(isExpensiveAzureJob)
  return expensiveJobs.length > 0 && expensiveJobs.every((job) => job.conclusion === 'skipped')
}

export function hasActiveOrRealAzureWork(runs, jobLists) {
  return runs.some((run) => {
    if (run.status !== 'completed' || run.run_attempt > 1) return true
    return (jobLists.get(run.id) ?? []).some(
      (job) => isExpensiveAzureJob(job) && job.conclusion !== 'skipped',
    )
  })
}
