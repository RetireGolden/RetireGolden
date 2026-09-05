/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import brokerWorkflow from '../../.github/workflows/openrouter-ci-broker.yml?raw'
import swaWorkflow from '../../.github/workflows/azure-static-web-apps-retiregolden.yml?raw'
import reviewCaller from '../../.github/workflows/openrouter-code-review.yml?raw'
import {
  authorizeExactHeadPullRequest,
  collectProvenanceReviewRuns,
  findTrustedCleanReview,
  hasActiveOrRealAzureWork,
  hasOnlySkippedExpensiveAzureJobs,
  isCiRequested,
  isDependabotPullRequest,
  isExpensiveAzureJob,
  ledgerWorkflowRunUrlsFromReview,
  newestWorkflowRun,
  parseWorkflowRunIdFromUrl,
  pullRequestSkipReason,
  reviewDispatchRunSkipReason,
  reviewRunSkipReason,
  terminalSameRepositoryWorkflowRunUrl,
  TRUSTED_REUSABLE_REVIEW_WORKFLOW,
  TRUSTED_REUSABLE_REVIEW_WORKFLOW_SHA,
  workflowBlobMatchesDefaultBranch,
} from '../../.github/scripts/ci-acceleration.mjs'
import type {
  GetContentRequest,
  GetWorkflowRunRequest,
  PaginatedRequest,
  PaginatedRequestParameters,
} from '../../.github/scripts/ci-acceleration.mjs'

const helperPath = new URL('../../.github/scripts/ci-acceleration.mjs', import.meta.url)
const helperContent = readFileSync(helperPath, 'utf8')
const expectedHelperBlobSha = createHash('sha1')
  .update(`blob ${Buffer.byteLength(helperContent, 'utf8')}\0${helperContent}`, 'utf8')
  .digest('hex')

const sha = 'a'.repeat(40)
const workflowUrl = 'https://github.com/RetireGolden/RetireGolden/actions/runs/123'
const dispatchWorkflowUrl = 'https://github.com/RetireGolden/RetireGolden/actions/runs/456'
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
const disputedFinding = {
  id: 'r1-1',
  sev: 'risk',
  file: 'packages/engine/src/example.ts',
  line: 42,
  title: 'Historical finding retained after dispute',
  ev: 'Producer keeps disputed history; fixed removes the entry.',
  st: 'disputed',
  m: ['openai/gpt-5.6-luna'],
}
const disputedNullLocationFinding = {
  id: 'r2-1',
  sev: 'nit',
  file: null,
  line: null,
  title: 'General concern without file anchor',
  ev: 'Producer allows null file and line on ledger findings.',
  st: 'disputed',
  m: ['openai/gpt-5.6-luna'],
}
const cleanDisputedPayload = {
  ...payload,
  round: 2,
  findings: [disputedFinding],
}
const encodePayload = (value: object) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64')
const encodedPayload = encodePayload(payload)
const encodedCleanDisputedPayload = encodePayload(cleanDisputedPayload)
const encodedIssuesPayload = encodePayload({ ...payload, findings: [{ rule: 'injected-test-finding' }] })

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
const cleanDisputedReviewBody = cleanReviewBody
  .replace(encodedPayload, encodedCleanDisputedPayload)
  .replace('**Mode:** `initial`', '**Mode:** `verify`')

const reviewContext = { repository, pullNumber, headSha: sha, workflowRunUrl: workflowUrl }

function review(overrides: Record<string, unknown> = {}) {
  return {
    user: { login: 'github-actions[bot]', id: 41898282, type: 'Bot' },
    state: 'COMMENTED',
    commit_id: sha,
    body: cleanReviewBody,
    ...overrides,
  }
}

function trustedRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 123,
    name: 'OpenRouter code review',
    event: 'pull_request',
    status: 'completed',
    conclusion: 'success',
    workflow_id: 341686683,
    head_sha: sha,
    path: '.github/workflows/openrouter-code-review.yml',
    head_repository: repository,
    referenced_workflows: [{
      path: 'RetireGolden/.github/.github/workflows/openrouter-code-review.yml@133c4a1a7e48c1e416784f69988d7d42d1866c44',
      sha: '133c4a1a7e48c1e416784f69988d7d42d1866c44',
    }],
    created_at: '2026-09-04T12:00:00Z',
    run_number: 1,
    run_attempt: 1,
    ...overrides,
  }
}

function mockGithub(overrides: Record<string, unknown> = {}) {
  const defaultCaller = { data: { type: 'file', sha: 'default-blob' } }
  const headCaller = { data: { type: 'file', sha: 'default-blob' } }
  const pr = {
    state: 'open',
    number: pullNumber,
    base: { ref: 'main' },
    user: { login: 'FlyOverCoderKY' },
    head: { sha, repo: repository },
    labels: [{ name: 'run-ci' }],
  }
  const defaultRest = {
    pulls: {
      get: async () => ({ data: pr }),
      listReviews: async function listReviews() {},
    },
    repos: {
      listPullRequestsAssociatedWithCommit: async function listPullRequestsAssociatedWithCommit() {},
      getContent: async (_args: GetContentRequest) => {
        if (_args.path === '.github/workflows/openrouter-code-review.yml') {
          return _args.ref === 'main' ? defaultCaller : headCaller
        }
        throw new Error(`unexpected getContent path ${_args.path}`)
      },
    },
    actions: {
      listWorkflowRuns: async function listWorkflowRuns() {},
      getWorkflowRun: async ({ run_id }: { run_id: number }) => ({
        data: trustedRun({ id: run_id, event: 'workflow_dispatch', head_sha: 'b'.repeat(40) }),
      }),
    },
    git: {
      getBlob: async () => ({ data: { content: Buffer.from(helperContent).toString('base64') } }),
    },
  }
  const { rest: overrideRestValue, ...topLevelOverrides } = overrides
  const overrideRest = (overrideRestValue ?? {}) as {
    pulls?: Record<string, unknown>
    repos?: Record<string, unknown>
    actions?: Record<string, unknown>
    git?: Record<string, unknown>
  }
  return {
    paginate: async (request: PaginatedRequest, params: PaginatedRequestParameters) => {
      if (request.name.includes('listPullRequestsAssociatedWithCommit')) return [pr]
      if (request.name.includes('listReviews')) return [review()]
      if (request.name.includes('listWorkflowRuns')) {
        expect(params.head_sha).toBe(sha)
        return [trustedRun()]
      }
      throw new Error(`unexpected paginate ${request.name}`)
    },
    rest: {
      ...defaultRest,
      ...overrideRest,
      pulls: { ...defaultRest.pulls, ...overrideRest.pulls },
      repos: { ...defaultRest.repos, ...overrideRest.repos },
      actions: { ...defaultRest.actions, ...overrideRest.actions },
      git: { ...defaultRest.git, ...overrideRest.git },
    },
    ...topLevelOverrides,
  }
}

describe('OpenRouter CI authorization contract', () => {
  it('keeps the caller and trusted reusable revision synchronized', () => {
    expect(TRUSTED_REUSABLE_REVIEW_WORKFLOW_SHA).toMatch(/^[a-f0-9]{40}$/)
    expect(TRUSTED_REUSABLE_REVIEW_WORKFLOW).toBe(
      `RetireGolden/.github/.github/workflows/openrouter-code-review.yml@${TRUSTED_REUSABLE_REVIEW_WORKFLOW_SHA}`,
    )
    expect(reviewCaller).toContain(`uses: ${TRUSTED_REUSABLE_REVIEW_WORKFLOW}`)
  })

  it('rejects a stale referenced reusable SHA even when its path matches', () => {
    const stale = trustedRun({
      referenced_workflows: [{ path: TRUSTED_REUSABLE_REVIEW_WORKFLOW, sha: '0'.repeat(40) }],
    })
    expect(reviewRunSkipReason(stale, repository)).toMatch(/trusted reusable OpenRouter workflow/)
  })

  it('pins the Azure bootstrap helper blob to the final helper content', () => {
    expect(swaWorkflow).toContain(`const helperPin = '${expectedHelperBlobSha}'`)
    expect(helperContent).not.toContain('gitBlobSha')
    expect(helperContent).not.toContain('node:crypto')
  })

  it('loads the helper through the same base64 data URL used by Actions', async () => {
    const encoded = Buffer.from(helperContent, 'utf8').toString('base64')
    const loaded = await import(`data:text/javascript;base64,${encoded}`)
    expect(loaded.findTrustedCleanReview).toBeTypeOf('function')
    expect(loaded.authorizeExactHeadPullRequest).toBeTypeOf('function')
  })

  it('accepts the production long review body with a decoded clean ledger', () => {
    expect(findTrustedCleanReview([review()], reviewContext)).toMatchObject({
      commit_id: sha,
    })
  })

  it('accepts exact-head clean round2 with retained disputed ledger history', () => {
    expect(findTrustedCleanReview([review({ body: cleanDisputedReviewBody })], reviewContext)).toMatchObject({
      commit_id: sha,
      body: cleanDisputedReviewBody,
    })
  })

  it('accepts exact-head clean reviews with producer-shaped disputed findings at null file and line', () => {
    const nullLocationBody = cleanReviewBody
      .replace(encodedPayload, encodePayload({ ...cleanDisputedPayload, findings: [disputedNullLocationFinding] }))
      .replace('**Mode:** `initial`', '**Mode:** `verify`')
    expect(findTrustedCleanReview([review({ body: nullLocationBody })], reviewContext)).toMatchObject({
      commit_id: sha,
    })
  })

  it.each([
    ['normalized dotted path', './packages//engine/./src/example.ts'],
    ['trailing slash path', 'path/'],
    ['Unicode decimal digit id', 'r۱-۲'],
    ['160-codepoint emoji title and 600-codepoint emoji evidence', {
      id: 'r1-3',
      title: '😀'.repeat(160),
      ev: '🙂'.repeat(600),
    }],
    ['500-codepoint file path', { file: '📁'.repeat(500) }],
    ['100-codepoint model id', { m: ['🤖'.repeat(100)] }],
    ['FEFF-only title', { title: '\uFEFF' }],
  ])('accepts producer compatibility case: %s', (_label, pathOrOverrides) => {
    const overrides = typeof pathOrOverrides === 'string'
      ? (pathOrOverrides.startsWith('r') ? { id: pathOrOverrides } : { file: pathOrOverrides })
      : pathOrOverrides
    const finding = { ...disputedFinding, ...overrides }
    const body = cleanReviewBody
      .replace(encodedPayload, encodePayload({ ...cleanDisputedPayload, findings: [finding] }))
      .replace('**Mode:** `initial`', '**Mode:** `verify`')
    expect(findTrustedCleanReview([review({ body })], reviewContext)).toMatchObject({ commit_id: sha })
  })

  it.each([
    ['301-codepoint emoji title', { title: '😀'.repeat(301) }],
    ['617-codepoint emoji evidence', { ev: '🙂'.repeat(617) }],
    ['501-codepoint file path', { file: '📁'.repeat(501) }],
    ['101-codepoint model id', { m: ['🤖'.repeat(101)] }],
  ])('rejects producer compatibility bound violation: %s', (_label, overrides) => {
    expect(findTrustedCleanReview([review({
      body: cleanReviewBody.replace(
        encodedPayload,
        encodePayload({ ...payload, findings: [{ ...disputedFinding, ...overrides }] }),
      ),
    })], reviewContext)).toBeUndefined()
  })

  it.each([
    ['issues verdict', review({ body: cleanReviewBody.replace('`clean`', '`issues`') })],
    ['stale visible Commit line', review({ body: cleanReviewBody.replace(`**Commit:** \`${sha}\``, `**Commit:** \`${'b'.repeat(40)}\``) })],
    ['missing marker', review({ body: cleanReviewBody.replace('<!-- openrouter-review-ledger:v1:', '<!-- other-ledger:') })],
    ['forged marker', review({ body: cleanReviewBody.replace('<!-- openrouter-review-ledger:v1:', '<!--openrouter-review-ledger:v1:') })],
    ['wrong heading', review({ body: cleanReviewBody.replace('## OpenRouter pull-request review', '## A different heading') })],
    ['reordered visible fields', review({ body: cleanReviewBody.replace('**Verdict:** `clean`\n**Scope:**', '**Scope:**\n**Verdict:** `clean`') })],
    ['payload with missing-state finding', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [{}] })) })],
    ['payload with missing finding id', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [{ ...disputedFinding, id: undefined }] })) })],
    ['payload with missing finding severity', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [{ ...disputedFinding, sev: undefined }] })) })],
    ['payload with missing finding title', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [{ ...disputedFinding, title: undefined }] })) })],
    ['payload with missing finding evidence', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [{ ...disputedFinding, ev: undefined }] })) })],
    ['payload with missing finding models', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [{ ...disputedFinding, m: undefined }] })) })],
    ['payload with invalid finding id', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [{ ...disputedFinding, id: 'finding-1' }] })) })],
    ['payload with invalid finding severity', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [{ ...disputedFinding, sev: 'critical' }] })) })],
    ['payload with non-string finding severity', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [{ ...disputedFinding, sev: 2 }] })) })],
    ['payload with empty finding title', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [{ ...disputedFinding, title: '   ' }] })) })],
    ['payload with oversized finding title', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [{ ...disputedFinding, title: 'x'.repeat(301) }] })) })],
    ['payload with oversized finding evidence', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [{ ...disputedFinding, ev: 'x'.repeat(617) }] })) })],
    ['payload with too many finding models', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [{ ...disputedFinding, m: Array.from({ length: 9 }, (_, index) => `model-${index}`) }] })) })],
    ['payload with invalid finding file path', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [{ ...disputedFinding, file: '../secret.ts' }] })) })],
    ['payload with finding id trailing newline', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [{ ...disputedFinding, id: 'r1-1\n' }] })) })],
    ['payload with malformed finding id', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [{ ...disputedFinding, id: 'r1-' }] })) })],
    ['payload with Python-only whitespace title', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [{ ...disputedFinding, title: '\u0085' }] })) })],
    ['payload with non-positive finding line', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [{ ...disputedFinding, line: 0 }] })) })],
    ['payload with boolean finding line', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [{ ...disputedFinding, line: true }] })) })],
    ['payload with open finding', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [{ ...disputedFinding, st: 'open' }] })) })],
    ['payload with mixed open and disputed findings', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [disputedFinding, { ...disputedFinding, id: 'r1-2', st: 'open' }] })) })],
    ['payload with fixed finding state', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [{ ...disputedFinding, st: 'fixed' }] })) })],
    ['payload with unknown finding state', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [{ ...disputedFinding, st: 'resolved' }] })) })],
    ['payload with null finding', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [null] })) })],
    ['payload with array finding', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: [[disputedFinding]] })) })],
    ['payload with primitive finding', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, findings: ['disputed'] })) })],
    ['payload for a different repository', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, repo: 'other/repo' })) })],
    ['payload for a different PR', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, pr: 621 })) })],
    ['payload for a different SHA', review({ body: cleanReviewBody.replace(encodedPayload, encodePayload({ ...payload, sha: 'b'.repeat(40) })) })],
    ['malformed payload JSON', review({ body: cleanReviewBody.replace(encodedPayload, Buffer.from('not JSON', 'utf8').toString('base64')) })],
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

  it('ignores a later unrelated bot review that does not reference the authoritative run URL', () => {
    expect(findTrustedCleanReview([
      review({ id: 10, submitted_at: '2026-09-04T12:00:00Z' }),
      review({
        id: 11,
        submitted_at: '2026-09-04T12:01:00Z',
        body: 'Emergency Grok review with no ledger envelope.',
      }),
    ], reviewContext)).toMatchObject({ id: 10 })
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
    ], { ...reviewContext, workflowRunUrl: newerWorkflowUrl })).toBeUndefined()
  })

  it('rejects a latest same-URL malformed bot review instead of falling back to an older clean ledger', () => {
    expect(findTrustedCleanReview([
      review({ id: 10, submitted_at: '2026-09-04T12:00:00Z' }),
      review({ id: 11, submitted_at: '2026-09-04T12:01:00Z', body: `malformed\n[Workflow run](${workflowUrl})` }),
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

  it('requires trusted OpenRouter caller runs and an unchanged default-branch blob', () => {
    const run = trustedRun()
    expect(reviewRunSkipReason(run, repository)).toBeUndefined()
    expect(reviewRunSkipReason({ ...run, workflow_id: 1 }, repository)).toMatch(/id/)
    expect(reviewRunSkipReason({ ...run, event: 'workflow_dispatch' }, repository)).toMatch(/pull_request/)
    expect(reviewDispatchRunSkipReason({ ...run, event: 'workflow_dispatch' }, repository)).toBeUndefined()
    expect(reviewDispatchRunSkipReason(run, repository)).toMatch(/workflow_dispatch/)
    const defaultFile = { data: { type: 'file', sha: 'default-blob' } }
    expect(workflowBlobMatchesDefaultBranch({ data: { type: 'file', sha: 'default-blob' } }, defaultFile)).toBe(true)
    expect(workflowBlobMatchesDefaultBranch({ data: { type: 'file', sha: 'head-blob' } }, defaultFile)).toBe(false)
  })

  it('extracts dispatch run IDs only from exact-head canonical ledgers', () => {
    const dispatchBody = cleanReviewBody.replace(workflowUrl, dispatchWorkflowUrl)
    expect(ledgerWorkflowRunUrlsFromReview(review({ body: dispatchBody }), {
      repository,
      pullNumber,
      headSha: sha,
    })).toEqual([dispatchWorkflowUrl])
    expect(parseWorkflowRunIdFromUrl(dispatchWorkflowUrl)).toBe(456)
    expect(ledgerWorkflowRunUrlsFromReview(review({ body: 'not a ledger' }), {
      repository,
      pullNumber,
      headSha: sha,
    })).toEqual([])
  })

  it('discovers a terminal same-repository dispatch URL before ledger validation', () => {
    const malformedDispatchBody = `malformed ledger\n[Workflow run](${dispatchWorkflowUrl})`
    expect(terminalSameRepositoryWorkflowRunUrl(review({ body: malformedDispatchBody }), repository))
      .toBe(dispatchWorkflowUrl)
    expect(ledgerWorkflowRunUrlsFromReview(review({ body: malformedDispatchBody }), {
      repository,
      pullNumber,
      headSha: sha,
    })).toEqual([])
  })

  it('classifies requested CI and fail-closed authorization outcomes', () => {
    expect(isCiRequested({ runAttempt: 1, hasRunCiLabel: false })).toBe(false)
    expect(isCiRequested({ runAttempt: 2, hasRunCiLabel: false })).toBe(true)
    expect(isCiRequested({ runAttempt: 1, hasRunCiLabel: true })).toBe(true)
  })

  it('authorizes through the shared helper with bounded head_sha queries and dispatch recovery', async () => {
    const github = mockGithub()
    const result = await authorizeExactHeadPullRequest(github, { setFailed: () => undefined }, {
      owner: 'RetireGolden',
      repo: 'RetireGolden',
      repository,
      defaultBranch: 'main',
      eventPr: {
        number: pullNumber,
        head: { sha },
        labels: [{ name: 'run-ci' }],
      },
      runAttempt: 1,
    })
    expect(result).toMatchObject({ authorized: true, failJob: false })
  })

  it('authorizes exact-head clean reviews that retain disputed ledger history', async () => {
    const github = mockGithub({
      paginate: async (request: PaginatedRequest, params: PaginatedRequestParameters) => {
        if (request.name.includes('listReviews')) return [review({ body: cleanDisputedReviewBody })]
        return mockGithub().paginate(request, params)
      },
    })
    const result = await authorizeExactHeadPullRequest(github, { setFailed: () => undefined }, {
      owner: 'RetireGolden',
      repo: 'RetireGolden',
      repository,
      defaultBranch: 'main',
      eventPr: {
        number: pullNumber,
        head: { sha },
        labels: [{ name: 'run-ci' }],
      },
      runAttempt: 1,
    })
    expect(result).toMatchObject({
      authorized: true,
      failJob: false,
      reason: `exact-head trusted clean review for ${sha}`,
    })
  })

  it('fails the requested path when authorization cannot be proven', async () => {
    const github = mockGithub({
      paginate: async (request: PaginatedRequest, params: PaginatedRequestParameters) => {
        if (request.name.includes('listWorkflowRuns')) {
          expect(params.head_sha).toBe(sha)
          return []
        }
        return mockGithub().paginate(request, params)
      },
      rest: {
        actions: {
          getWorkflowRun: async () => {
            throw new Error('linked workflow run not found')
          },
        },
      },
    })
    const result = await authorizeExactHeadPullRequest(github, { setFailed: () => undefined }, {
      owner: 'RetireGolden',
      repo: 'RetireGolden',
      repository,
      defaultBranch: 'main',
      eventPr: {
        number: pullNumber,
        head: { sha },
        labels: [{ name: 'run-ci' }],
      },
      runAttempt: 2,
    })
    expect(result).toMatchObject({ authorized: false, failJob: true })
  })

  it('lets a newer failed exact-head review run block an older clean run', async () => {
    const base = mockGithub()
    const github = mockGithub({
      paginate: async (request: PaginatedRequest, params: PaginatedRequestParameters) => {
        if (request.name.includes('listWorkflowRuns')) {
          return [
            trustedRun({ id: 123, created_at: '2026-09-04T12:00:00Z' }),
            trustedRun({ id: 124, created_at: '2026-09-04T12:01:00Z', status: 'completed', conclusion: 'failure' }),
          ]
        }
        return base.paginate(request, params)
      },
    })
    const result = await authorizeExactHeadPullRequest(github, { setFailed: () => undefined }, {
      owner: 'RetireGolden', repo: 'RetireGolden', repository, defaultBranch: 'main',
      eventPr: { number: pullNumber, head: { sha }, labels: [{ name: 'run-ci' }] },
      runAttempt: 2,
    })
    expect(result).toMatchObject({ authorized: false, failJob: true })
  })

  it('lets a newer provenance-valid dispatch URL with a malformed ledger block an older clean dispatch', async () => {
    const olderDispatchBody = cleanReviewBody.replace(workflowUrl, dispatchWorkflowUrl)
    const newerDispatchUrl = 'https://github.com/RetireGolden/RetireGolden/actions/runs/457'
    const malformedNewerDispatchBody = `malformed ledger\n[Workflow run](${newerDispatchUrl})`
    const base = mockGithub()
    const github = mockGithub({
      paginate: async (request: PaginatedRequest, params: PaginatedRequestParameters) => {
        if (request.name.includes('listWorkflowRuns')) return []
        if (request.name.includes('listReviews')) {
          return [
            review({ id: 10, submitted_at: '2026-09-04T12:00:00Z', body: olderDispatchBody }),
            review({ id: 11, submitted_at: '2026-09-04T12:01:00Z', body: malformedNewerDispatchBody }),
          ]
        }
        return base.paginate(request, params)
      },
      rest: {
        actions: {
          getWorkflowRun: async ({ run_id }: GetWorkflowRunRequest) => ({
            data: trustedRun({
              id: run_id,
              event: 'workflow_dispatch',
              head_sha: 'b'.repeat(40),
              created_at: run_id === 456 ? '2026-09-04T12:00:00Z' : '2026-09-04T12:01:00Z',
            }),
          }),
        },
      },
    })
    const result = await authorizeExactHeadPullRequest(github, { setFailed: () => undefined }, {
      owner: 'RetireGolden', repo: 'RetireGolden', repository, defaultBranch: 'main',
      eventPr: { number: pullNumber, head: { sha }, labels: [{ name: 'run-ci' }] },
      runAttempt: 2,
    })
    expect(result).toMatchObject({ authorized: false, failJob: true })
    expect(result.reason).toMatch(/clean authoritative ledger/)
  })

  it('fails closed when a newer linked dispatch run cannot be inspected', async () => {
    const olderDispatchBody = cleanReviewBody.replace(workflowUrl, dispatchWorkflowUrl)
    const newerDispatchUrl = 'https://github.com/RetireGolden/RetireGolden/actions/runs/457'
    const base = mockGithub()
    const github = mockGithub({
      paginate: async (request: PaginatedRequest, params: PaginatedRequestParameters) => {
        if (request.name.includes('listWorkflowRuns')) return []
        if (request.name.includes('listReviews')) {
          return [
            review({ id: 10, submitted_at: '2026-09-04T12:00:00Z', body: olderDispatchBody }),
            review({
              id: 11,
              submitted_at: '2026-09-04T12:01:00Z',
              body: `malformed ledger\n[Workflow run](${newerDispatchUrl})`,
            }),
          ]
        }
        return base.paginate(request, params)
      },
      rest: {
        actions: {
          getWorkflowRun: async ({ run_id }: GetWorkflowRunRequest) => {
            if (run_id === 457) throw Object.assign(new Error('service unavailable'), { status: 503 })
            return {
              data: trustedRun({ id: run_id, event: 'workflow_dispatch', head_sha: 'b'.repeat(40) }),
            }
          },
        },
      },
    })
    const result = await authorizeExactHeadPullRequest(github, { setFailed: () => undefined }, {
      owner: 'RetireGolden', repo: 'RetireGolden', repository, defaultBranch: 'main',
      eventPr: { number: pullNumber, head: { sha }, labels: [{ name: 'run-ci' }] },
      runAttempt: 2,
    })
    expect(result).toMatchObject({ authorized: false, failJob: true })
    expect(result.reason).toMatch(/cannot inspect a linked OpenRouter workflow run/)
  })

  it('fails closed when a newer exact-head caller cannot be inspected', async () => {
    const base = mockGithub()
    let headCallerReads = 0
    const github = mockGithub({
      paginate: async (request: PaginatedRequest, params: PaginatedRequestParameters) => {
        if (request.name.includes('listWorkflowRuns')) {
          return [
            trustedRun({ id: 123, created_at: '2026-09-04T12:00:00Z' }),
            trustedRun({ id: 124, created_at: '2026-09-04T12:01:00Z' }),
          ]
        }
        return base.paginate(request, params)
      },
      rest: {
        repos: {
          getContent: async (request: GetContentRequest) => {
            if (request.ref === 'main') return { data: { type: 'file', sha: 'default-blob' } }
            headCallerReads += 1
            if (headCallerReads === 2) {
              throw Object.assign(new Error('service unavailable'), { status: 503 })
            }
            return { data: { type: 'file', sha: 'default-blob' } }
          },
        },
      },
    })
    const result = await authorizeExactHeadPullRequest(github, { setFailed: () => undefined }, {
      owner: 'RetireGolden', repo: 'RetireGolden', repository, defaultBranch: 'main',
      eventPr: { number: pullNumber, head: { sha }, labels: [{ name: 'run-ci' }] },
      runAttempt: 2,
    })
    expect(result).toMatchObject({ authorized: false, failJob: true })
    expect(result.reason).toMatch(/cannot inspect the exact-head OpenRouter caller/)
  })

  it('keeps the first unlabeled placeholder path successful without failing authorize', async () => {
    const github = mockGithub({
      rest: {
        pulls: {
          get: async () => ({
            data: {
              state: 'open',
              number: pullNumber,
              base: { ref: 'main' },
              head: { sha, repo: repository },
              labels: [],
            },
          }),
        },
      },
    })
    const result = await authorizeExactHeadPullRequest(github, { setFailed: () => undefined }, {
      owner: 'RetireGolden',
      repo: 'RetireGolden',
      repository,
      defaultBranch: 'main',
      eventPr: {
        number: pullNumber,
        head: { sha },
        labels: [],
      },
      runAttempt: 1,
    })
    expect(result).toMatchObject({ authorized: false, failJob: false })
  })

  it('collects dispatch runs directly from ledger links without head_sha list filtering', async () => {
    const dispatchBody = cleanReviewBody.replace(workflowUrl, dispatchWorkflowUrl)
    const listCalls: PaginatedRequestParameters[] = []
    const github = mockGithub({
      paginate: async (request: PaginatedRequest, params: PaginatedRequestParameters) => {
        if (request.name.includes('listWorkflowRuns')) {
          listCalls.push(params)
          return []
        }
        return mockGithub().paginate(request, params)
      },
      rest: {
        actions: {
          listWorkflowRuns: async function listWorkflowRuns() {},
          getWorkflowRun: async ({ run_id }: { run_id: number }) => ({
            data: trustedRun({ id: run_id, event: 'workflow_dispatch', head_sha: 'b'.repeat(40) }),
          }),
        },
      },
    })
    const { provenanceReviewRuns } = await collectProvenanceReviewRuns(github, {
      owner: 'RetireGolden',
      repo: 'RetireGolden',
      repository,
      defaultBranch: 'main',
      expectedHeadSha: sha,
      pullNumber,
      reviews: [review({ body: dispatchBody })],
      allowDispatch: true,
    })
    expect(listCalls).toEqual([expect.objectContaining({ head_sha: sha })])
    expect(provenanceReviewRuns).toHaveLength(1)
    expect(provenanceReviewRuns[0]?.event).toBe('workflow_dispatch')
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
    expect(brokerWorkflow).toContain('helper.collectProvenanceReviewRuns')
    expect(brokerWorkflow).toContain('allowDispatch: false')
    expect(brokerWorkflow).toContain('head_sha: trigger.head_sha')
    expect(brokerWorkflow).not.toContain('actions/checkout@')
    expect(brokerWorkflow).not.toContain('listWorkflowRunAssociatedPullRequests')

    const authorize = swaWorkflow.slice(swaWorkflow.indexOf('  authorize:'), swaWorkflow.indexOf('\n  lint:'))
    expect(authorize).toContain('actions: read')
    expect(authorize).toContain('contents: read')
    expect(authorize).toContain('pull-requests: read')
    expect(authorize).toContain('helper.authorizeExactHeadPullRequest')
    expect(authorize).toContain('github.rest.git.getBlob')
    expect(authorize).toContain("core.setFailed(result.reason)")
    expect(authorize).toContain('context.runAttempt > 1')
    expect(authorize).toContain("eventPr?.labels?.some((label) => label.name === 'run-ci')")
    expect(authorize).toContain("if (error?.status !== 404) throw error")
    expect(authorize).toContain("throw new Error('trusted CI helper response is not a file')")
    expect(authorize).toContain("throw new Error('trusted CI helper is missing authorization export')")
    expect(authorize).toContain('return importHelper(blob.data?.content)')
    expect(authorize).not.toContain('trustedReviewWorkflowId')
    expect(authorize).not.toContain('actions/checkout@')
    expect(authorize).not.toContain('listWorkflowRunAssociatedPullRequests')
    expect(brokerWorkflow).toContain('helper.isDependabotPullRequest(pr)')
  })

  it('keeps push-to-main authorization, independent PR close, and required display names', () => {
    const authorize = swaWorkflow.slice(swaWorkflow.indexOf('  authorize:'), swaWorkflow.indexOf('\n  lint:'))
    expect(authorize).toMatch(/if:\s+>-\s+github\.event_name == 'push' \|\|\s+\(github\.event_name == 'pull_request' && github\.event\.action != 'closed'\)/)
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

  it('starts Azure CI only for PR lifecycle events and cancels every stale PR run', () => {
    expect(swaWorkflow).toContain('types: [opened, synchronize, reopened, closed]')
    expect(swaWorkflow).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}")
  })

  it('starts build with the independent gates and keeps test as the fail-closed required context', () => {
    expect(swaWorkflow).toContain('test_engine:')
    expect(swaWorkflow).toContain('test_planner_ui:')
    expect(swaWorkflow).toContain('test_web:')
    expect(swaWorkflow).toMatch(/test:\s+name: test\s+if: always\(\) && !cancelled\(\)/)
    expect(swaWorkflow).toMatch(/build:\s+if: needs\.authorize\.outputs\.authorized == 'true'\s+needs: \[authorize\]/)
    expect(swaWorkflow).toMatch(/deploy:[\s\S]*needs: \[authorize, lint, test, e2e, build\]/)
    expect(swaWorkflow).toContain("needs.authorize.outputs.authorized != 'true' || needs.deploy.result == 'success'")
    expect(swaWorkflow).toContain('actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1')
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
