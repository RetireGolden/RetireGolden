/**
 * Pure data-only predicates used by the trusted default-branch CI broker.
 * Review bodies are parsed as data only; the ledger payload is never executed.
 */
export const REVIEW_LEDGER_MARKER_PREFIX = '<!-- openrouter-review-ledger:v1:'
export const REVIEW_LEDGER_HEADING = '## OpenRouter pull-request review'
export const TRUSTED_REVIEW_AUTHOR = 'github-actions[bot]'
export const TRUSTED_REVIEW_AUTHOR_ID = 41898282
export const TRUSTED_REVIEW_AUTHOR_TYPE = 'Bot'
export const DEPENDABOT_LOGIN = 'dependabot[bot]'
export const TRUSTED_REVIEW_WORKFLOW_ID = 341686683
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
  // Buffer accepts malformed base64, so require canonical standard base64
  // before decoding the opaque marker payload as JSON.
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
  const validPayload =
    payload?.lv === 1 &&
    payload.repo === repository.full_name &&
    payload.pr === pullNumber &&
    payload.sha === headSha &&
    typeof payload.gen === 'string' && /^[a-f0-9]{12}$/.test(payload.gen) &&
    Number.isSafeInteger(payload.round) && payload.round > 0 &&
    Array.isArray(payload.findings) &&
    ((verdict === 'clean' && payload.findings.length === 0) ||
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

export function findTrustedCleanReview(reviews, context) {
  const exactHeadBotReviews = reviews.flatMap((review, index) => {
    const exactHeadBotReview = review.user?.login === TRUSTED_REVIEW_AUTHOR &&
      review.user?.id === TRUSTED_REVIEW_AUTHOR_ID &&
      review.user?.type === TRUSTED_REVIEW_AUTHOR_TYPE &&
      typeof review.commit_id === 'string' &&
      review.commit_id === context.headSha
    return exactHeadBotReview ? [{ review, index }] : []
  })
  const latest = exactHeadBotReviews.reduce((newest, candidate) => {
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
  const ledger = latest?.review.state === 'COMMENTED' &&
    trustedLedger(typeof latest.review.body === 'string' ? latest.review.body : '', context)
  return ledger?.verdict === 'clean' ? latest.review : undefined
}

export function reviewRunSkipReason(workflowRun, repository) {
  if (workflowRun.workflow_id !== TRUSTED_REVIEW_WORKFLOW_ID) {
    return 'workflow run id is not the trusted OpenRouter workflow'
  }
  if (workflowRun.name !== 'OpenRouter code review') return 'workflow run name is not OpenRouter code review'
  if (workflowRun.event !== 'pull_request') return 'review run event is not pull_request'
  if (workflowRun.path !== '.github/workflows/openrouter-code-review.yml') {
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
