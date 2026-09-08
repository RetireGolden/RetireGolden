/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import brokerWorkflow from '../../.github/workflows/openrouter-ci-broker.yml?raw'
import swaWorkflow from '../../.github/workflows/azure-static-web-apps-retiregolden.yml?raw'
import recoveryWorkflow from '../../.github/workflows/openrouter-review-recovery.yml?raw'
import reviewCaller from '../../.github/workflows/openrouter-code-review.yml?raw'
import profileCompletionCaller from '../../.github/workflows/openrouter-profile-completion.yml?raw'
import ciRunbook from '../../DOCS/operations/ci-cd-and-deploy.md?raw'
import readme from '../../README.md?raw'
import openrouterProducerFixture from './fixtures/openrouter-producer.json'
import {
  authorizeExactHeadPullRequest,
  authorizeReviewProfile,
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
  TRUSTED_PROFILE_CONSUMER_OWNER,
  TRUSTED_PROFILE_CONSUMER_PATH,
  TRUSTED_PROFILE_CONSUMER_REPO,
  TRUSTED_RECOVERY_WORKFLOW_PATH,
  TRUSTED_RECOVERY_WORKFLOW_BLOB_SHA,
  TRUSTED_REUSABLE_REVIEW_WORKFLOW,
  TRUSTED_REUSABLE_REVIEW_WORKFLOW_SHA,
  workflowBlobMatchesDefaultBranch,
} from '../../.github/scripts/ci-acceleration.mjs'
import type {
  GetContentRequest,
  GetWorkflowRequest,
  GetWorkflowRunRequest,
  PaginatedRequest,
  PaginatedRequestParameters,
} from '../../.github/scripts/ci-acceleration.mjs'

const helperPath = new URL('../../.github/scripts/ci-acceleration.mjs', import.meta.url)
// The pin addresses Git's LF blob, independent of Windows checkout line endings.
const helperContent = readFileSync(helperPath, 'utf8').replace(/\r\n/g, '\n')
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
const producerReviewContext = {
  repository: { full_name: 'RetireGolden/RetireGolden' },
  pullNumber: 267,
  headSha: 'a'.repeat(40),
  workflowRunUrl: 'https://github.com/RetireGolden/RetireGolden/actions/runs/123',
}

const profileConsumerFixture = [
  'export async function authorizeProfileReceipt(_github, input) {',
  '  if (input.orgWorkflowSha !== "273dd054ab1c34950a3c2eeab2f00254db405e68") throw new Error("missing or wrong org pin");',
  '  if (typeof input?.review?.body === "string" && input.review.body.includes("PROFILE_DENY")) {',
  '    return { authorized: false, reason: "fixture profile denied" }',
  '  }',
  '  return { authorized: true, reason: "fixture profile authorized" }',
  '}',
].join('\n')

function profileConsumerContent(content = profileConsumerFixture) {
  return {
    type: 'file',
    content: Buffer.from(content, 'utf8').toString('base64'),
  }
}

function isTrustedProfileConsumerRequest(request: GetContentRequest) {
  return (
    request.owner === TRUSTED_PROFILE_CONSUMER_OWNER &&
    request.repo === TRUSTED_PROFILE_CONSUMER_REPO &&
    request.path === TRUSTED_PROFILE_CONSUMER_PATH &&
    request.ref === TRUSTED_REUSABLE_REVIEW_WORKFLOW_SHA
  )
}

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
    name: 'OpenRouter PR #643: auto',
    event: 'pull_request',
    status: 'completed',
    conclusion: 'success',
    workflow_id: 341686683,
    head_sha: sha,
    path: '.github/workflows/openrouter-code-review.yml',
    head_repository: repository,
    referenced_workflows: [{
      path: TRUSTED_REUSABLE_REVIEW_WORKFLOW,
      sha: TRUSTED_REUSABLE_REVIEW_WORKFLOW_SHA,
    }],
    created_at: '2026-09-04T12:00:00Z',
    updated_at: '2026-09-04T12:10:00Z',
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
        if (isTrustedProfileConsumerRequest(_args)) {
          return { data: profileConsumerContent() }
        }
        if (_args.path === '.github/workflows/openrouter-code-review.yml') {
          return _args.ref === 'main' ? defaultCaller : headCaller
        }
        if (_args.path === TRUSTED_RECOVERY_WORKFLOW_PATH) {
          return { data: { type: 'file', sha: TRUSTED_RECOVERY_WORKFLOW_BLOB_SHA } }
        }
        throw new Error(`unexpected getContent path ${_args.path}`)
      },
    },
    actions: {
      getWorkflow: async (args: GetWorkflowRequest) => {
        expect(args.workflow_id).toBe('openrouter-review-recovery.yml')
        return { data: { id: 999, path: TRUSTED_RECOVERY_WORKFLOW_PATH, state: 'active' } }
      },
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

function recoveryGithub(runOverrides: Record<string, unknown> = {}, bodyOverride?: string) {
  const base = mockGithub()
  return mockGithub({
    paginate: async (request: PaginatedRequest, params: PaginatedRequestParameters) => {
      if (request.name.includes('listWorkflowRuns')) return [trustedRun()]
      if (request.name.includes('listReviews')) return [
        review({ id: 1, submitted_at: '2026-09-04T12:00:00Z' }),
        review({ id: 2, submitted_at: '2026-09-04T13:00:00Z',
          body: bodyOverride ?? cleanReviewBody.replace(workflowUrl, dispatchWorkflowUrl) }),
      ]
      return base.paginate(request, params)
    },
    rest: {
      repos: {
        getContent: async (args: GetContentRequest) => {
          if (args.path === TRUSTED_RECOVERY_WORKFLOW_PATH) {
            return { data: { type: 'file', sha: TRUSTED_RECOVERY_WORKFLOW_BLOB_SHA } }
          }
          return base.rest.repos.getContent(args)
        },
      },
      actions: {
        getWorkflowRun: async () => ({ data: trustedRun({
          id: 456, workflow_id: 999, name: 'OpenRouter review recovery',
          path: TRUSTED_RECOVERY_WORKFLOW_PATH, event: 'workflow_dispatch',
          head_branch: 'main', head_sha: 'c'.repeat(40), referenced_workflows: [],
          created_at: '2026-09-04T13:00:00Z', ...runOverrides,
        }) }),
      },
    },
  })
}

const recoveryContext = {
  owner: 'RetireGolden', repo: 'RetireGolden', repository, defaultBranch: 'main',
  expectedHeadSha: sha, pullNumber,
  reviews: [review({ body: cleanReviewBody.replace(workflowUrl, dispatchWorkflowUrl) })],
  allowDispatch: true,
}

const recoveryForwardPr = {
  number: 643,
  state: 'open',
  draft: false,
  base: { ref: 'main' },
  head: { sha, repo: { full_name: repository.full_name } },
}

function recoveryForwarderScript() {
  const block = recoveryWorkflow.match(/ {10}script: \|\r?\n((?: {12}[^\n]*\n)+)/)?.[1]
  expect(block).toBeDefined()
  return (block ?? '').replace(/^ {12}/gm, '')
}

describe('trusted default-branch review verification recovery', () => {
  it('pins the complete recovery workflow Git blob', () => {
    const content = recoveryWorkflow.replace(/\r\n/g, '\n')
    const blob = createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0${content}`).digest('hex')
    expect(TRUSTED_RECOVERY_WORKFLOW_BLOB_SHA).toBe(blob)
    expect(recoveryWorkflow).not.toContain('openrouter-pr-review-action')
    expect(recoveryWorkflow).not.toContain('actions/checkout@')
    expect(recoveryWorkflow).not.toContain('secrets.')
    expect(recoveryWorkflow).toContain('actions/github-script@')
    expect(recoveryWorkflow).toContain('createWorkflowDispatch')
    expect(recoveryWorkflow).toContain("workflow_id: 'openrouter-code-review.yml'")
    expect(recoveryWorkflow).toContain('ref: repository.default_branch')
    expect(recoveryWorkflow).toContain("review_level: 'auto'")
    expect(recoveryWorkflow).not.toContain('reset_review:')
    expect(recoveryWorkflow).toContain("if: github.ref == format('refs/heads/{0}', github.event.repository.default_branch)")
    expect(recoveryWorkflow).toContain("if: github.ref != format('refs/heads/{0}', github.event.repository.default_branch)")
    expect(recoveryWorkflow).toContain('Dispatch recovery from the default branch.')
    const triggers = recoveryWorkflow.split('on:')[1]?.split('\npermissions:')[0]
    expect(triggers?.match(/^ {2}\w+:/gm)).toEqual(['  workflow_dispatch:'])
  })

  it.each([
    ['valid PR', { runs: [], allowed: true }],
    ['manual name without display title', { runs: [{ status: 'queued', name: 'OpenRouter PR #643: auto', event: 'workflow_dispatch' }], allowed: false }],
    ['unattributable legacy manual run', { runs: [{ status: 'in_progress', name: 'OpenRouter code review', event: 'workflow_dispatch' }], allowed: false }],
    ['other PR manual run', { runs: [{ status: 'queued', name: 'OpenRouter PR #642: auto', event: 'workflow_dispatch' }], allowed: true }],
    ['active legacy recovery', { legacyRuns: [{ id: 122, status: 'in_progress' }], allowed: false }],
    ['current forwarder only', { legacyRuns: [{ id: 123, status: 'in_progress' }], allowed: true }],
    ['invalid number', { prNumber: '643x', runs: [], allowed: false }],
    ['closed PR', { pr: { ...recoveryForwardPr, state: 'closed' }, allowed: false }],
    ['draft PR', { pr: { ...recoveryForwardPr, draft: true }, allowed: false }],
    ['other base', { pr: { ...recoveryForwardPr, base: { ref: 'develop' } }, allowed: false }],
    [
      'fork',
      {
        pr: {
          ...recoveryForwardPr,
          head: { sha, repo: { full_name: 'other/repo' } },
        },
        allowed: false,
      },
    ],
    ...['queued', 'in_progress', 'waiting', 'pending', 'requested'].flatMap<[string, { runs: Record<string, unknown>[]; allowed: boolean }]>((status) => [
      [`active ${status} review same head`, { runs: [{ status, head_sha: sha }], allowed: false }],
      [`active ${status} manual review`, {
        runs: [{ status, display_title: 'OpenRouter PR #643: manual review' }], allowed: false,
      }],
    ]),
    ['active search cap', {
      runs: Array.from({ length: 1000 }, () => ({ status: 'queued', head_sha: 'b'.repeat(40) })),
      allowed: false,
    }],
    [
      'unrelated active run',
      {
        runs: [
          {
            status: 'in_progress',
            head_sha: 'b'.repeat(40),
            display_title: 'Something else',
          },
        ],
        allowed: true,
      },
    ],
  ])(
    'runs the actual workflow forwarder for %s',
    async (_name, options) => {
      const { prNumber, pr, runs = [], legacyRuns = [], allowed } = options as {
        prNumber?: string
        pr?: Record<string, unknown>
        runs?: Record<string, unknown>[]
        legacyRuns?: Record<string, unknown>[]
        allowed: boolean
      }
      const dispatches: Record<string, unknown>[] = []
      const activeQueries: string[] = []
      const script = recoveryForwarderScript()
      const execution = runInNewContext(`(async () => {${script}\n})()`, {
        process: { env: { PR_NUMBER: prNumber ?? '643' } },
        context: { runId: 123, repo: { owner: 'RetireGolden', repo: 'RetireGolden' }, payload: {
        repository: { full_name: repository.full_name, default_branch: 'main' },
      } },
        core: { info: () => undefined },
        github: {
          rest: {
            pulls: {
              get: async () => ({ data: pr ?? recoveryForwardPr }),
            },
            actions: {
              createWorkflowDispatch: async (args: Record<string, unknown>) => {
                dispatches.push(args)
              },
              listWorkflowRuns: () => undefined,
            },
          },
          paginate: async (_endpoint: unknown, parameters: { status: string; workflow_id: string }) => {
            expect(['queued', 'in_progress', 'waiting', 'pending', 'requested']).toContain(parameters.status)
            activeQueries.push(parameters.status)
            const source = parameters.workflow_id === 'openrouter-review-recovery.yml' ? legacyRuns : runs
            return source.filter((run) => run.status === parameters.status)
          },
        },
      }) as Promise<void>
      if (allowed) {
        await execution
        expect(activeQueries).toEqual(Array.from({ length: 2 }, () => ['queued', 'in_progress', 'waiting', 'pending', 'requested']).flat())
        expect(dispatches).toEqual([
          {
            owner: 'RetireGolden',
            repo: 'RetireGolden',
            workflow_id: 'openrouter-code-review.yml',
            ref: 'main',
            inputs: { pr_number: '643', review_level: 'auto' },
          },
        ])
      } else {
        await expect(execution).rejects.toThrow()
        expect(dispatches).toEqual([])
      }
    },
  )

  it('authorizes recovery as the sole trusted run when the PR caller differs from main', async () => {
    const github = recoveryGithub()
    const original = github.rest.repos.getContent
    github.rest.repos.getContent = async (args: GetContentRequest) => {
      if (args.path === '.github/workflows/openrouter-code-review.yml' && args.ref === sha) {
        return { data: { type: 'file', sha: 'changed-pr-caller' } }
      }
      return original(args)
    }
    const result = await collectProvenanceReviewRuns(github, recoveryContext)
    expect(result.provenanceReviewRuns.map((run) => run.id)).toEqual([456])
    const broker = await collectProvenanceReviewRuns(github, { ...recoveryContext, allowDispatch: false })
    expect(broker.provenanceReviewRuns).toEqual([])
    expect(await authorizeExactHeadPullRequest(github, { setFailed: () => undefined }, {
      owner: 'RetireGolden', repo: 'RetireGolden', repository, defaultBranch: 'main',
      eventPr: { number: pullNumber, head: { sha }, labels: [{ name: 'run-ci' }] }, runAttempt: 2,
    })).toMatchObject({ authorized: true })
  })

  it.each([
    ['queued review', { status: 'queued', conclusion: null }],
    ['running review', { status: 'in_progress', conclusion: null }],
    ['review completed after recovery started', { updated_at: '2026-09-04T13:10:00Z' }],
    ['missing completion evidence', { updated_at: undefined }],
  ])('refuses recovery overlapping a %s', async (_name, overrides) => {
    const github = recoveryGithub()
    const original = github.paginate
    github.paginate = async (request: PaginatedRequest, params: PaginatedRequestParameters) =>
      request.name.includes('listWorkflowRuns') ? [trustedRun(overrides)] : original(request, params)
    const result = await collectProvenanceReviewRuns(github, recoveryContext)
    expect(result.provenanceReviewRuns).toEqual([])
    expect(result.error).toMatch(/before the exact-head OpenRouter review completed/)
  })

  it('admits the registered, pinned main dispatch only in manual recovery', async () => {
    const result = await collectProvenanceReviewRuns(recoveryGithub(), recoveryContext)
    expect(result.provenanceReviewRuns.map((run) => run.id)).toEqual([123, 456])
    const broker = await collectProvenanceReviewRuns(recoveryGithub(), { ...recoveryContext, allowDispatch: false })
    expect(broker.provenanceReviewRuns.map((run) => run.id)).toEqual([123])
  })

  it.each([
    ['branch dispatch', { head_branch: 'codex/other' }],
    ['other event', { event: 'pull_request' }],
    ['other repository', { head_repository: { full_name: 'other/repo' } }],
    ['other workflow ID', { workflow_id: 998 }],
    ['other workflow name', { name: 'Untrusted recovery' }],
    ['other workflow path', { path: '.github/workflows/other.yml' }],
    ['non-commit ref', { head_sha: 'main' }],
  ])('rejects recovery provenance with %s', async (_name, overrides) => {
    const result = await collectProvenanceReviewRuns(recoveryGithub(overrides), recoveryContext)
    expect(result.provenanceReviewRuns.map((run) => run.id)).toEqual([123])
  })

  it.each(['main', 'c'.repeat(40)])('rejects a changed recovery blob at %s', async (ref) => {
    const github = recoveryGithub()
    const original = github.rest.repos.getContent
    github.rest.repos.getContent = async (args: GetContentRequest) => {
      if (args.path === TRUSTED_RECOVERY_WORKFLOW_PATH && args.ref === ref) {
        return { data: { type: 'file', sha: 'd'.repeat(40) } }
      }
      return original(args)
    }
    const result = await collectProvenanceReviewRuns(github, recoveryContext)
    expect(result.provenanceReviewRuns.map((run) => run.id)).toEqual([123])
  })

  it('rejects an unpinned workflow even when run and default blobs agree', async () => {
    const github = recoveryGithub()
    const original = github.rest.repos.getContent
    github.rest.repos.getContent = async (args: GetContentRequest) => args.path === TRUSTED_RECOVERY_WORKFLOW_PATH
      ? { data: { type: 'file', sha: 'd'.repeat(40) } } : original(args)
    const result = await collectProvenanceReviewRuns(github, recoveryContext)
    expect(result.provenanceReviewRuns.map((run) => run.id)).toEqual([123])
  })

  it('fails closed when recovery metadata cannot be inspected', async () => {
    const github = recoveryGithub()
    github.rest.actions.getWorkflow = async () => { throw Object.assign(new Error('unavailable'), { status: 503 }) }
    const result = await collectProvenanceReviewRuns(github, recoveryContext)
    expect(result.provenanceReviewRuns).toEqual([])
    expect(result.error).toBe('cannot inspect the linked OpenRouter recovery workflow')
  })

  it.each([
    ['disabled workflow', { id: 999, path: TRUSTED_RECOVERY_WORKFLOW_PATH, state: 'disabled_manually' }],
    ['wrong registered path', { id: 999, path: '.github/workflows/other.yml', state: 'active' }],
  ])('rejects registration metadata for %s', async (_name, data) => {
    const github = recoveryGithub()
    github.rest.actions.getWorkflow = async () => ({ data })
    const result = await collectProvenanceReviewRuns(github, recoveryContext)
    expect(result.provenanceReviewRuns.map((run) => run.id)).toEqual([123])
  })

  it('rejects a non-file response even with the pinned blob SHA', async () => {
    const github = recoveryGithub()
    const original = github.rest.repos.getContent
    github.rest.repos.getContent = async (args: GetContentRequest) => args.path === TRUSTED_RECOVERY_WORKFLOW_PATH
      ? { data: { type: 'symlink', sha: TRUSTED_RECOVERY_WORKFLOW_BLOB_SHA } } : original(args)
    const result = await collectProvenanceReviewRuns(github, recoveryContext)
    expect(result.provenanceReviewRuns.map((run) => run.id)).toEqual([123])
  })

  it.each([
    ['failed run', { conclusion: 'failure' }, undefined],
    ['pending run', { status: 'in_progress', conclusion: null }, undefined],
    ['issues review', {}, cleanReviewBody.replace(workflowUrl, dispatchWorkflowUrl).replace('`clean`', '`issues`')],
    ['malformed review', {}, `malformed\n[Workflow run](${dispatchWorkflowUrl})`],
  ])('does not fall back to an older clean run after a newer recovery with %s', async (_name, run, body) => {
    const result = await authorizeExactHeadPullRequest(recoveryGithub(run, body), { setFailed: () => undefined }, {
      owner: 'RetireGolden', repo: 'RetireGolden', repository, defaultBranch: 'main',
      eventPr: { number: pullNumber, head: { sha }, labels: [{ name: 'run-ci' }] }, runAttempt: 2,
    })
    expect(result).toMatchObject({ authorized: false, failJob: true })
  })

  it('authorizes the exact-head clean ledger from the pinned recovery', async () => {
    const result = await authorizeExactHeadPullRequest(recoveryGithub(), { setFailed: () => undefined }, {
      owner: 'RetireGolden', repo: 'RetireGolden', repository, defaultBranch: 'main',
      eventPr: { number: pullNumber, head: { sha }, labels: [{ name: 'run-ci' }] }, runAttempt: 2,
    })
    expect(result).toMatchObject({ authorized: true, failJob: false })
  })
})

describe('OpenRouter CI authorization contract', () => {
  it('declares an optional boolean reset with a false default', () => {
    expect(reviewCaller).toMatch(/ {6}reset_review:\r?\n {8}description: [^\r\n]+\r?\n {8}required: false\r?\n {8}type: boolean\r?\n {8}default: false/)
  })

  it.each([
    [{}, false],
    [{ reset_review: false }, false],
    [{ reset_review: true }, true],
  ])('forwards reset input %j as %s', (inputs, expected) => {
    const expression = /^ {6}reset_review: \$\{\{ (.+) \}\}$/m.exec(reviewCaller)?.[1]
    // This boolean-only Actions expression also has JavaScript semantics.
    expect(expression).toBe('inputs.reset_review || false')
    expect(runInNewContext(expression!, { inputs })).toBe(expected)
  })

  it('keeps the caller and trusted reusable revision synchronized', () => {
    expect(TRUSTED_REUSABLE_REVIEW_WORKFLOW_SHA).toMatch(/^[a-f0-9]{40}$/)
    expect(TRUSTED_REUSABLE_REVIEW_WORKFLOW).toBe(
      `RetireGolden/.github/.github/workflows/openrouter-code-review.yml@${TRUSTED_REUSABLE_REVIEW_WORKFLOW_SHA}`,
    )
    expect(reviewCaller).toContain(`uses: ${TRUSTED_REUSABLE_REVIEW_WORKFLOW}`)
    for (const source of [reviewCaller, ciRunbook, readme]) {
      const policyLinks = [...source.matchAll(/https:\/\/github\.com\/RetireGolden\/\.github\/(?:blob|tree)\/([a-f0-9]{40})\//g)]
      expect(policyLinks.length).toBeGreaterThan(0)
      for (const link of policyLinks) expect(link[1]).toBe(TRUSTED_REUSABLE_REVIEW_WORKFLOW_SHA)
    }
  })

  it('rejects a stale referenced reusable SHA even when its path matches', () => {
    const stale = trustedRun({
      referenced_workflows: [{ path: TRUSTED_REUSABLE_REVIEW_WORKFLOW, sha: '0'.repeat(40) }],
    })
    expect(reviewRunSkipReason(stale, repository)).toMatch(/trusted reusable OpenRouter workflow/)
  })

  it('keeps documented producer revisions synchronized with the caller action reference', () => {
    expect(reviewCaller).toContain('review_policy: base')
    expect(reviewCaller).toContain('review_profiles_enabled: true')
    expect(reviewCaller).toContain("review_level: ${{ inputs.review_level || 'auto' }}")
    expect(profileCompletionCaller).toContain('name: OpenRouter profile completion')
    expect(profileCompletionCaller).toMatch(/^ {2}complete:\r?\n {4}if: /m)
    expect(profileCompletionCaller).toContain("if: github.ref == format('refs/heads/{0}', github.event.repository.default_branch)")
    expect(profileCompletionCaller).toContain(`openrouter-profile-completion.yml@${TRUSTED_REUSABLE_REVIEW_WORKFLOW_SHA}`)
    expect(profileCompletionCaller).toContain("source_run_id: ${{ inputs.source_run_id || (github.event.workflow_run.id && format('{0}', github.event.workflow_run.id)) || '' }}")
    expect(reviewCaller).toMatch(/^permissions:\r?\n(?:[ \t]+#[^\r\n]*\r?\n)* {2}actions: write\r?\n/m)
    expect(profileCompletionCaller).toMatch(/ {2}workflow_dispatch:\r?\n {4}inputs:\r?\n {6}source_run_id:\r?\n {8}description: [^\r\n]+\r?\n {8}required: false\r?\n {8}type: string/)
    expect(profileCompletionCaller).toContain('actions: write')
    expect(profileCompletionCaller).toContain('statuses: write')
    expect(profileCompletionCaller).not.toContain('steps:')
    expect(profileCompletionCaller).not.toContain('actions/checkout@')
    const currentCaller = reviewCaller.split('\n').find((line) => line.trimStart().startsWith(`uses: ${TRUSTED_REUSABLE_REVIEW_WORKFLOW} `))
    expect(currentCaller).toBeDefined()
    const callerReferences = [...(currentCaller ?? '').matchAll(/action#\d+@([a-f0-9]{40})/g)]
    expect(callerReferences).toHaveLength(1)
    const producerSha = callerReferences[0]?.[1]
    expect(producerSha).toMatch(/^[a-f0-9]{40}$/)
    expect(openrouterProducerFixture.producerSha).toBe(producerSha)
    for (const source of [helperContent, ciRunbook, readme]) {
      const references = [...source.matchAll(/openrouter-pr-review-action(?:@|\/(?:blob|tree)\/)([a-f0-9]{40})/g)]
      expect(references.length).toBeGreaterThan(0)
      for (const reference of references) expect(reference[1]).toBe(producerSha)
    }
  })

  it.each(openrouterProducerFixture.cases.map((fixtureCase) => [fixtureCase.name, fixtureCase]))(
    'honors pinned producer fixture case %s through findTrustedCleanReview',
    (_name, fixtureCase) => {
      const result = findTrustedCleanReview([review({ body: fixtureCase.body })], producerReviewContext)
      expect(Boolean(result)).toBe(fixtureCase.accepted)
    },
  )

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
    // Confirmed against schema.py valid_review_path at the documented producer revision.
    ['normalized dotted path', './packages//engine/./src/example.ts'],
    ['current directory path normalized to dot', './/.'],
    ['Python-strip whitespace around a relative path', '\u0085 folder/file.ts \u00a0'],
    ['BOM is preserved by Python strip', '\uFEFF'],
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
    ['Python whitespace-only file path', { file: '\u0085\u00a0' }],
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
    for (const name of ['OpenRouter code review', 'OpenRouter PR #643: deep']) {
      expect(reviewRunSkipReason({ ...run, name }, repository)).toBeUndefined()
      expect(reviewDispatchRunSkipReason({ ...run, name, event: 'workflow_dispatch' }, repository)).toBeUndefined()
    }
    expect(reviewRunSkipReason({ ...run, path: '.github/workflows/other.yml' }, repository)).toMatch(/path/)
    expect(reviewRunSkipReason({ ...run, referenced_workflows: [] }, repository)).toMatch(/reusable/)
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
    const profileConsumerReads: GetContentRequest[] = []
    const github = mockGithub({
      rest: {
        repos: {
          getContent: async (request: GetContentRequest) => {
            if (isTrustedProfileConsumerRequest(request)) {
              profileConsumerReads.push(request)
              return { data: profileConsumerContent() }
            }
            if (request.path === '.github/workflows/openrouter-code-review.yml') {
              return { data: { type: 'file', sha: 'default-blob' } }
            }
            if (request.path === TRUSTED_RECOVERY_WORKFLOW_PATH) {
              return { data: { type: 'file', sha: TRUSTED_RECOVERY_WORKFLOW_BLOB_SHA } }
            }
            throw new Error(`unexpected getContent path ${request.path}`)
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
      runAttempt: 1,
    })
    expect(result).toMatchObject({ authorized: true, failJob: false })
    expect(profileConsumerReads).toEqual([
      {
        owner: TRUSTED_PROFILE_CONSUMER_OWNER,
        repo: TRUSTED_PROFILE_CONSUMER_REPO,
        path: TRUSTED_PROFILE_CONSUMER_PATH,
        ref: TRUSTED_REUSABLE_REVIEW_WORKFLOW_SHA,
      },
    ])
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
    expect(brokerWorkflow).toContain(
      'workflows: [OpenRouter code review, OpenRouter profile completion, Azure Static Web Apps CI/CD]',
    )
    expect(brokerWorkflow).toContain('actions/github-script@ed597411d8f924073f98dfc5c65a23a2325f34cd # v8')
    expect(brokerWorkflow).toContain('actions: write')
    expect(brokerWorkflow).toContain('issues: write')
    expect(brokerWorkflow).toContain('pull-requests: write')
    expect(brokerWorkflow).toContain('group: openrouter-ci-broker')
    expect(brokerWorkflow).toContain('github.rest.pulls.list')
    expect(brokerWorkflow).toContain('helper.collectProvenanceReviewRuns')
    expect(brokerWorkflow).toContain('helper.authorizeReviewProfile')
    expect(brokerWorkflow).toContain('for (const candidate of pendingPrs)')
    expect(brokerWorkflow).not.toContain('github.event.workflow_run.head_sha')
    expect(brokerWorkflow).toContain('allowDispatch: true')
    expect(brokerWorkflow).toContain('head_sha: expectedHeadSha')
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

  const authorize = (
    github: ReturnType<typeof mockGithub>,
    runAttempt: number,
    labels = [{ name: 'run-ci' }],
  ) =>
    authorizeExactHeadPullRequest(
      github,
      { setFailed: () => undefined },
      {
        owner: 'RetireGolden',
        repo: 'RetireGolden',
        repository,
        defaultBranch: 'main',
        eventPr: { number: pullNumber, head: { sha }, labels },
        runAttempt,
      },
    )

  it('loads the trusted profile consumer through the org workflow pin', async () => {
    const github = mockGithub()
    const originalRead = github.rest.repos.getContent
    const reads: GetContentRequest[] = []
    github.rest.repos.getContent = (request: GetContentRequest) => {
      reads.push(request)
      return originalRead(request)
    }
    const result = await authorizeReviewProfile(github, {
      owner: 'RetireGolden', repo: 'RetireGolden', repository,
      defaultBranch: 'main', headSha: sha, pullNumber,
      review: review(), reviewRun: trustedRun(),
    })
    expect(result.authorized).toBe(true)
    expect(reads).toEqual([{
      owner: TRUSTED_PROFILE_CONSUMER_OWNER,
      repo: TRUSTED_PROFILE_CONSUMER_REPO,
      path: TRUSTED_PROFILE_CONSUMER_PATH,
      ref: TRUSTED_REUSABLE_REVIEW_WORKFLOW_SHA,
    }])
  })

  it('fails closed when the trusted profile consumer cannot be loaded', async () => {
    const github = mockGithub({
      rest: {
        repos: {
          getContent: async (request: GetContentRequest) => {
            if (isTrustedProfileConsumerRequest(request)) {
              throw Object.assign(new Error('not found'), { status: 404 })
            }
            if (request.path === '.github/workflows/openrouter-code-review.yml') {
              return { data: { type: 'file', sha: 'default-blob' } }
            }
            if (request.path === TRUSTED_RECOVERY_WORKFLOW_PATH) {
              return { data: { type: 'file', sha: TRUSTED_RECOVERY_WORKFLOW_BLOB_SHA } }
            }
            throw new Error(`unexpected getContent path ${request.path}`)
          },
        },
      },
    })
    const result = await authorize(github, 2)
    expect(result).toMatchObject({ authorized: false, failJob: true })
    expect(result.reason).toMatch(/cannot load trusted profile consumer/)
  })

  it('fails closed when the trusted profile consumer is missing required exports', async () => {
    const github = mockGithub({
      rest: {
        repos: {
          getContent: async (request: GetContentRequest) => {
            if (isTrustedProfileConsumerRequest(request)) {
              return {
                data: profileConsumerContent('export const only = true;'),
              }
            }
            if (request.path === '.github/workflows/openrouter-code-review.yml') {
              return { data: { type: 'file', sha: 'default-blob' } }
            }
            if (request.path === TRUSTED_RECOVERY_WORKFLOW_PATH) {
              return { data: { type: 'file', sha: TRUSTED_RECOVERY_WORKFLOW_BLOB_SHA } }
            }
            throw new Error(`unexpected getContent path ${request.path}`)
          },
        },
      },
    })
    const result = await authorize(github, 2)
    expect(result).toMatchObject({ authorized: false, failJob: true })
    expect(result.reason).toMatch(/missing required exports/)
  })

  it('fails closed when the trusted profile consumer response is not a file', async () => {
    const github = mockGithub({
      rest: {
        repos: {
          getContent: async (request: GetContentRequest) => {
            if (isTrustedProfileConsumerRequest(request)) {
              return { data: { type: 'symlink', sha: 'abc' } }
            }
            if (request.path === '.github/workflows/openrouter-code-review.yml') {
              return { data: { type: 'file', sha: 'default-blob' } }
            }
            if (request.path === TRUSTED_RECOVERY_WORKFLOW_PATH) {
              return { data: { type: 'file', sha: TRUSTED_RECOVERY_WORKFLOW_BLOB_SHA } }
            }
            throw new Error(`unexpected getContent path ${request.path}`)
          },
        },
      },
    })
    const result = await authorize(github, 2)
    expect(result).toMatchObject({ authorized: false, failJob: true })
    expect(result.reason).toMatch(/not a file/)
  })

  it('stops CI when the trusted profile consumer denies authorization', async () => {
    const github = mockGithub({
      paginate: async (request: PaginatedRequest, params: PaginatedRequestParameters) => {
        if (request.name.includes('listReviews')) {
          return [
            review({
              body: cleanReviewBody.replace('[Workflow run]', 'PROFILE_DENY\n\n[Workflow run]'),
            }),
          ]
        }
        return mockGithub().paginate(request, params)
      },
    })
    const result = await authorize(github, 2)
    expect(result).toMatchObject({ authorized: false, failJob: true })
    expect(result.reason).toMatch(/fixture profile denied/)
  })

  it('still rejects a stale clean ledger before the profile consumer can authorize', async () => {
    const github = mockGithub({
      paginate: async (request: PaginatedRequest, params: PaginatedRequestParameters) => {
        if (request.name.includes('listReviews')) return []
        return mockGithub().paginate(request, params)
      },
    })
    const result = await authorize(github, 2)
    expect(result).toMatchObject({ authorized: false, failJob: true })
    expect(result.reason).toMatch(/clean authoritative ledger/)
  })

  it('exposes authorizeReviewProfile as a standalone wrapper', async () => {
    const result = await authorizeReviewProfile(mockGithub(), {
      owner: 'RetireGolden',
      repo: 'RetireGolden',
      repository,
      defaultBranch: 'main',
      headSha: sha,
      pullNumber,
      review: review(),
      reviewRun: trustedRun(),
    })
    expect(result).toMatchObject({
      authorized: true,
      reason: 'fixture profile authorized',
    })
  })
})
