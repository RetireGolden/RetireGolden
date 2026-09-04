import { describe, expect, it } from 'vitest'
import brokerWorkflow from '../../.github/workflows/openrouter-ci-broker.yml?raw'
import swaWorkflow from '../../.github/workflows/azure-static-web-apps-retiregolden.yml?raw'
import {
  findTrustedCleanReview,
  hasActiveOrRealAzureWork,
  hasOnlySkippedExpensiveAzureJobs,
  isDependabotPullRequest,
  isExpensiveAzureJob,
  newestWorkflowRun,
  pullRequestSkipReason,
  reviewRunSkipReason,
  workflowBlobMatchesDefaultBranch,
} from '../../.github/scripts/ci-acceleration.mjs'

const sha = 'a'.repeat(40)
const workflowUrl = 'https://github.com/RetireGolden/RetireGolden/actions/runs/123'
const repository = { full_name: 'RetireGolden/RetireGolden' }
const pullNumber = 620
const payload = {
  lv: 1,
  repo: repository.full_name,
  pr: pullNumber,
  sha,
  gen: '9b1e3d99671f',
  round: 1,
  findings: [],
}
const encodePayload = (value: object) => btoa(JSON.stringify(value))
const encodedPayload = encodePayload(payload)
const encodedIssuesPayload = encodePayload({ ...payload, findings: [{ rule: 'injected-test-finding' }] })

// Structural copy of the long production review body. The ledger marker is
// line two; the lane report between the visible fields and workflow link varies.
const cleanReviewBody = [
  '## OpenRouter pull-request review',
  `<!-- openrouter-review-ledger:v1:${encodedPayload} -->`,
  '',
  '**Verdict:** `clean`',
  '**Scope:** `full-pr` (full-pr)',
  '**Mode:** `initial`',
  `**Commit:** \`${sha}\``,
  '**Judge:** `openai/gpt-5.6-luna`',
  '**Cost:** $0.2562 (lanes $0.2560 + judge $0.0001)',
  '',
  '### Lanes',
  '',
  '- `x-ai/grok-4.6`: ok (0 finding(s))',
  '- `z-ai/glm-5.3-flash`: ok (0 finding(s))',
  '',
  'No structured findings from the successful lane(s).',
  '',
  `[Workflow run](${workflowUrl})`,
].join('\n')

const reviewContext = { repository, pullNumber, headSha: sha, workflowRunUrls: [workflowUrl] }

function review(overrides: Record<string, unknown> = {}) {
  return {
    user: { login: 'github-actions[bot]', id: 41898282, type: 'Bot' },
    state: 'COMMENTED',
    commit_id: sha,
    body: cleanReviewBody,
    ...overrides,
  }
}

describe('OpenRouter CI authorization contract', () => {
  it('accepts the production long review body with a decoded clean ledger', () => {
    expect(findTrustedCleanReview([review()], reviewContext)).toMatchObject({
      commit_id: sha,
    })
  })

  it.each([
    ['issues verdict', review({ body: cleanReviewBody.replace('`clean`', '`issues`') })],
    ['stale visible Commit line', review({ body: cleanReviewBody.replace(`**Commit:** \`${sha}\``, `**Commit:** \`${'b'.repeat(40)}\``) })],
    ['missing marker', review({ body: cleanReviewBody.replace('<!-- openrouter-review-ledger:v1:', '<!-- other-ledger:') })],
    ['forged marker', review({ body: cleanReviewBody.replace('<!-- openrouter-review-ledger:v1:', '<!--openrouter-review-ledger:v1:') })],
    ['wrong heading', review({ body: cleanReviewBody.replace('## OpenRouter pull-request review', '## A different heading') })],
    ['reordered visible fields', review({ body: cleanReviewBody.replace('**Verdict:** `clean`\n**Scope:**', '**Scope:**\n**Verdict:** `clean`') })],
    ['payload with findings', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [{}] })) })],
    ['payload for a different repository', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, repo: 'other/repo' })) })],
    ['payload for a different PR', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, pr: 621 })) })],
    ['payload for a different SHA', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, sha: 'b'.repeat(40) })) })],
    ['malformed payload JSON', review({ body: cleanReviewBody.replace(encodedPayload, btoa('not JSON')) })],
    ['malformed payload base64', review({ body: cleanReviewBody.replace(encodedPayload, 'AAAA=') })],
    ['noncanonical payload base64', review({ body: cleanReviewBody.replace(encodedPayload, `${encodedPayload}=`) })],
    ['wrong workflow run URL and id', review({ body: cleanReviewBody.replace('/123)', '/456)') })],
    ['wrong author', review({ user: { login: 'octocat' } })],
    ['wrong bot id', review({ user: { login: 'github-actions[bot]', id: 1, type: 'Bot' } })],
    ['wrong bot type', review({ user: { login: 'github-actions[bot]', id: 41898282, type: 'User' } })],
    ['missing review.commit_id', review({ commit_id: undefined })],
  ])('rejects %s', (_case, candidate) => {
    expect(findTrustedCleanReview([candidate], reviewContext)).toBeUndefined()
  })

  it('rejects an issues review with later injected clean and commit lines', () => {
    const adversarialBody = cleanReviewBody.replace(encodedPayload, encodedIssuesPayload).replace('**Verdict:** `clean`', [
      '**Verdict:** `issues`',
      `**Commit:** \`${sha}\``,
      '**Verdict:** `clean`',
      `**Commit:** \`${sha}\``,
    ].join('\n'))
    expect(findTrustedCleanReview([review({ body: adversarialBody })], reviewContext)).toBeUndefined()
  })

  it('lets a later authoritative issues ledger override an older clean ledger on one workflow URL', () => {
    const issuesBody = cleanReviewBody
      .replace(encodedPayload, encodedIssuesPayload)
      .replace('**Verdict:** `clean`', '**Verdict:** `issues`')
    expect(findTrustedCleanReview([
      review({ id: 10, submitted_at: '2026-09-04T12:00:00Z' }),
      review({ id: 11, submitted_at: '2026-09-04T12:01:00Z', body: issuesBody }),
    ], reviewContext)).toBeUndefined()
  })

  it('uses review id to select the latest ledger when attempts share a workflow URL and submitted time', () => {
    const issuesBody = cleanReviewBody
      .replace(encodedPayload, encodedIssuesPayload)
      .replace('**Verdict:** `clean`', '**Verdict:** `issues`')
    expect(findTrustedCleanReview([
      review({ id: 11, submitted_at: '2026-09-04T12:00:00Z', body: issuesBody }),
      review({ id: 10, submitted_at: '2026-09-04T12:00:00Z' }),
    ], reviewContext)).toBeUndefined()
  })

  it('rejects a delayed older-run clean review after a newer-run issues review', () => {
    const newerWorkflowUrl = workflowUrl.replace('/123', '/124')
    const newerIssuesBody = cleanReviewBody
      .replace(workflowUrl, newerWorkflowUrl)
      .replace(encodedPayload, encodedIssuesPayload)
      .replace('**Verdict:** `clean`', '**Verdict:** `issues`')
    expect(findTrustedCleanReview([
      review({ id: 10, submitted_at: '2026-09-04T12:00:00Z', body: newerIssuesBody }),
      review({ id: 11, submitted_at: '2026-09-04T12:01:00Z' }),
    ], { ...reviewContext, workflowRunUrls: [newerWorkflowUrl] })).toBeUndefined()
  })

  it('rejects a latest same-URL malformed bot review instead of falling back to an older clean ledger', () => {
    expect(findTrustedCleanReview([
      review({ id: 10, submitted_at: '2026-09-04T12:00:00Z' }),
      review({ id: 11, submitted_at: '2026-09-04T12:01:00Z', body: 'malformed' }),
    ], reviewContext)).toBeUndefined()
  })

  it('selects a newer in-progress provenance-valid run ahead of an older clean run', () => {
    const olderClean = { id: 10, created_at: '2026-09-04T12:00:00Z', run_number: 8, run_attempt: 1,
      status: 'completed', conclusion: 'success' }
    const newerInProgress = { ...olderClean, id: 11, created_at: '2026-09-04T12:01:00Z', run_number: 9,
      status: 'in_progress', conclusion: null }
    expect(newestWorkflowRun([olderClean, newerInProgress])).toBe(newerInProgress)
  })

  it('selects a newer failed provenance-valid run ahead of an older clean run', () => {
    const olderClean = { id: 10, created_at: '2026-09-04T12:00:00Z', run_number: 8, run_attempt: 1,
      status: 'completed', conclusion: 'success' }
    const newerFailed = { ...olderClean, id: 12, created_at: '2026-09-04T12:02:00Z', run_number: 10,
      status: 'completed', conclusion: 'failure' }
    expect(newestWorkflowRun([olderClean, newerFailed])).toBe(newerFailed)
  })

  it('fails closed for forks, stale heads, closed PRs, and the wrong base', () => {
    const pr = {
      state: 'open',
      base: { ref: 'main' },
      user: { login: 'FlyOverCoderKY' },
      head: { sha, repo: { full_name: repository.full_name } },
    }
    expect(pullRequestSkipReason(pr, repository, sha)).toBeUndefined()
    expect(pullRequestSkipReason({ ...pr, head: { ...pr.head, sha: 'b'.repeat(40) } }, repository, sha)).toMatch(
      /head SHA/,
    )
    expect(pullRequestSkipReason({ ...pr, state: 'closed' }, repository, sha)).toMatch(/not open/)
    expect(pullRequestSkipReason({ ...pr, base: { ref: 'release' } }, repository, sha)).toMatch(/target main/)
    expect(
      pullRequestSkipReason({ ...pr, head: { ...pr.head, repo: { full_name: 'fork/repo' } } }, repository, sha),
    ).toMatch(/fork/)
    const dependabotPr = { ...pr, user: { login: 'dependabot[bot]' } }
    expect(pullRequestSkipReason(dependabotPr, repository, sha)).toBeUndefined()
    expect(isDependabotPullRequest(dependabotPr)).toBe(true)
  })

  it('requires a trusted OpenRouter caller run and an unchanged default-branch blob', () => {
    const run = {
      name: 'OpenRouter code review', event: 'pull_request', status: 'completed', conclusion: 'success',
      workflow_id: 341686683,
      path: '.github/workflows/openrouter-code-review.yml', head_repository: repository,
      referenced_workflows: [{
        path: 'RetireGolden/.github/.github/workflows/openrouter-code-review.yml@f6aa157430509b5f6945b4fc2c9fafeeac4a7294',
        sha: 'f6aa157430509b5f6945b4fc2c9fafeeac4a7294',
      }],
    }
    expect(reviewRunSkipReason(run, repository)).toBeUndefined()
    expect(reviewRunSkipReason({ ...run, workflow_id: 1 }, repository)).toMatch(/id/)
    expect(reviewRunSkipReason({ ...run, referenced_workflows: [{
      path: 'other/workflow@f6aa157430509b5f6945b4fc2c9fafeeac4a7294', sha: 'f6aa157430509b5f6945b4fc2c9fafeeac4a7294',
    }] }, repository)).toMatch(/reusable/)
    expect(reviewRunSkipReason({ ...run, referenced_workflows: [{
      path: 'RetireGolden/.github/.github/workflows/openrouter-code-review.yml@f6aa157430509b5f6945b4fc2c9fafeeac4a7294', sha: 'deadbeef',
    }] }, repository)).toMatch(/reusable/)
    expect(reviewRunSkipReason({ ...run, head_repository: { full_name: 'fork/repo' } }, repository)).toMatch(/repository/)
    const defaultFile = { data: { type: 'file', sha: 'default-blob' } }
    expect(workflowBlobMatchesDefaultBranch({ data: { type: 'file', sha: 'default-blob' } }, defaultFile)).toBe(true)
    expect(workflowBlobMatchesDefaultBranch({ data: { type: 'file', sha: 'head-blob' } }, defaultFile)).toBe(false)
  })

  it('classifies only exact expensive Azure display names as real work', () => {
    for (const name of ['lint', 'test engine', 'test planner-ui', 'test web', 'test', 'e2e', 'build', 'deploy']) {
      expect(isExpensiveAzureJob({ name })).toBe(true)
    }
    for (const name of ['authorize', 'ZAP DAST', 'ZAP DAST / ZAP Baseline', 'close_pull_request']) {
      expect(isExpensiveAzureJob({ name })).toBe(false)
    }
  })

  it('treats a successful placeholder-only Azure run as eligible, but not a successful lint run', () => {
    const placeholderOnly = [
      { name: 'authorize', conclusion: 'success' },
      { name: 'lint', conclusion: 'skipped' },
      { name: 'test engine', conclusion: 'skipped' },
      { name: 'test planner-ui', conclusion: 'skipped' },
      { name: 'test web', conclusion: 'skipped' },
      { name: 'test', conclusion: 'skipped' },
      { name: 'e2e', conclusion: 'skipped' },
      { name: 'build', conclusion: 'skipped' },
      { name: 'deploy', conclusion: 'skipped' },
      { name: 'ZAP DAST', conclusion: 'success' },
      { name: 'ZAP DAST / ZAP Baseline', conclusion: 'success' },
    ]
    expect(hasOnlySkippedExpensiveAzureJobs(placeholderOnly)).toBe(true)
    expect(hasOnlySkippedExpensiveAzureJobs([...placeholderOnly, { name: 'lint', conclusion: 'success' }])).toBe(false)
  })

  it('does not rerun while Azure CI is active, retried, or has performed real work', () => {
    const run = { id: 7, status: 'completed' }
    expect(hasActiveOrRealAzureWork([run], new Map([[7, [{ name: 'lint', conclusion: 'success' }]]]))).toBe(true)
    for (const status of ['queued', 'in_progress', 'waiting', 'requested', 'pending']) {
      expect(hasActiveOrRealAzureWork([{ ...run, status }], new Map())).toBe(true)
    }
    expect(hasActiveOrRealAzureWork([{ ...run, run_attempt: 2 }], new Map([[7, [{ name: 'lint', conclusion: 'skipped' }]]]))).toBe(true)
    expect(hasActiveOrRealAzureWork([run], new Map([[7, [{ name: 'authorize', conclusion: 'success' }]]]))).toBe(false)
  })

  it('keeps both authorization paths API-only, pinning github-script and supported APIs', () => {
    expect(brokerWorkflow).toContain('workflows: [OpenRouter code review, Azure Static Web Apps CI/CD]')
    expect(brokerWorkflow).toContain('actions/github-script@ed597411d8f924073f98dfc5c65a23a2325f34cd # v8')
    expect(brokerWorkflow).toContain('actions: write')
    expect(brokerWorkflow).toContain('issues: write')
    expect(brokerWorkflow).toContain('pull-requests: write')
    expect(brokerWorkflow).toContain('group: openrouter-ci-broker-${{ github.event.workflow_run.head_sha }}')
    expect(brokerWorkflow).toContain('github.rest.repos.listPullRequestsAssociatedWithCommit')
    expect(brokerWorkflow).toContain('helper.workflowBlobMatchesDefaultBranch(headCaller, defaultCaller)')
    expect(brokerWorkflow).not.toContain('actions/checkout@')
    expect(brokerWorkflow).not.toContain('listWorkflowRunAssociatedPullRequests')

    const authorize = swaWorkflow.slice(swaWorkflow.indexOf('  authorize:'), swaWorkflow.indexOf('\n  lint:'))
    expect(authorize).toContain('actions: read')
    expect(authorize).toContain('contents: read')
    expect(authorize).toContain('pull-requests: read')
    expect(authorize).toContain('github.rest.repos.listPullRequestsAssociatedWithCommit')
    expect(authorize).toContain("github.run_attempt > 1 || github.event.action != 'labeled' || github.event.label.name == 'run-ci'")
    expect(authorize).not.toContain("candidate.user?.login !== 'dependabot[bot]'")
    expect(authorize).toContain('run.workflow_id === trustedReviewWorkflowId')
    expect(authorize).toContain('workflow?.path === trustedReusableReviewWorkflow')
    expect(authorize).toContain('workflow?.sha === trustedReusableReviewWorkflowSha')
    expect(authorize).toContain('headCaller.data.sha === defaultCaller.data.sha')
    expect(authorize).not.toContain('actions/checkout@')
    expect(authorize).not.toContain('listWorkflowRunAssociatedPullRequests')
    expect(brokerWorkflow).toContain('helper.isDependabotPullRequest(pr)')
  })

  it('keeps push-to-main authorization, independent PR close, and required display names', () => {
    const authorize = swaWorkflow.slice(swaWorkflow.indexOf('  authorize:'), swaWorkflow.indexOf('\n  lint:'))
    expect(authorize).toMatch(/if:\s+>-\s+github\.event_name == 'push' \|\|\s+\(github\.event_name == 'pull_request' && github\.event\.action != 'closed' &&\s+\(github\.run_attempt > 1 \|\| github\.event\.action != 'labeled' \|\| github\.event\.label\.name == 'run-ci'\)\)/)
    expect(swaWorkflow).toContain("core.info('authorized: push to main')")
    expect(swaWorkflow).toMatch(/close_pull_request:[\s\S]*if: github\.event_name == 'pull_request' && github\.event\.action == 'closed'[\s\S]*runs-on:/)
    const closeJob = swaWorkflow.slice(swaWorkflow.indexOf('  close_pull_request:'))
    expect(closeJob).not.toContain('needs:')
    expect(swaWorkflow).toContain('name: test engine')
    expect(swaWorkflow).toContain('name: test planner-ui')
    expect(swaWorkflow).toContain('name: test web')
    expect(swaWorkflow).toContain('name: test')
    expect(swaWorkflow).toContain('name: ZAP DAST')
  })

  it('starts build with the independent gates and keeps test as the fail-closed required context', () => {
    expect(swaWorkflow).toContain('test_engine:')
    expect(swaWorkflow).toContain('test_planner_ui:')
    expect(swaWorkflow).toContain('test_web:')
    expect(swaWorkflow).toMatch(/test:\s+name: test\s+if: always\(\)/)
    expect(swaWorkflow).toMatch(/build:\s+if: needs\.authorize\.outputs\.authorized == 'true'\s+needs: \[authorize\]/)
    expect(swaWorkflow).toMatch(/deploy:[\s\S]*needs: \[authorize, lint, test, e2e, build\]/)
    expect(swaWorkflow).toContain("needs.authorize.outputs.authorized != 'true' || needs.deploy.result == 'success'")
  })

  it('finds a safe rerun before it adds the label, then rechecks the head before rerunning', () => {
    const eligible = brokerWorkflow.indexOf('const eligible = currentHeadRuns')
    const label = brokerWorkflow.indexOf('github.rest.issues.addLabels')
    const postLabelRead = brokerWorkflow.indexOf('const { data: postLabelPr }')
    const rerun = brokerWorkflow.indexOf('github.rest.actions.reRunWorkflow')
    expect(eligible).toBeGreaterThan(-1)
    expect(label).toBeGreaterThan(eligible)
    expect(postLabelRead).toBeGreaterThan(label)
    expect(rerun).toBeGreaterThan(postLabelRead)
    expect(brokerWorkflow).toContain("run.status === 'completed' && run.run_attempt === 1")
  })
})
