import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { constants, runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  fileURLToPath(new URL('../../.github/workflows/openrouter-ci-broker.yml', import.meta.url)),
  'utf8',
).replace(/\r\n/g, '\n');
const script = workflow
  .split('          script: |\n')[1]!
  .split('\n')
  .map((line) => line.slice(12))
  .join('\n');

// Helper authorization is tested separately. Execute the actual workflow body
// with deterministic helpers to test its queue, sweep, and mutation wiring.
const helper = `
export function pullRequestSkipReason(pr, repository, head) {
  return pr.state !== 'open' || pr.head.sha !== head ? 'stale PR' : null;
}
export function isDependabotPullRequest() { return false; }
export async function collectProvenanceReviewRuns(github, input) {
  return { provenanceReviewRuns: [{ id: input.pullNumber, status: 'completed', conclusion: 'success' }] };
}
export function newestWorkflowRun(runs) { return runs[0]; }
export function workflowRunUrl(owner, repo, id) { return 'https://github.com/' + owner + '/' + repo + '/actions/runs/' + id; }
export function findTrustedCleanReview(reviews) { return reviews[0]; }
export async function authorizeReviewProfile(github, input) { return github.profileCheck(input); }
export function azureRunSkipReason() { return null; }
export function hasActiveOrRealAzureWork(runs) { return runs.some(run => run.status !== 'completed' || run.run_attempt > 1); }
export function hasOnlySkippedExpensiveAzureJobs() { return true; }
`;

type DispatchOptions = {
  sourceId?: string;
  ref?: string;
  states?: string[];
  path?: string;
  workflowId?: number;
  registeredState?: string;
};

function fixture({ denied = 0, broken = 0, completedCi = false, missingCi = false } = {}) {
  const reruns: number[] = [];
  const labels = new Set<number>();
  const profileChecks: number[] = [];
  const reviewReads: number[] = [];
  const failures: string[] = [];
  const warnings: string[] = [];
  let sweeps = 0;
  const listPulls = async () => {};
  const listReviews = async () => {};
  const listRuns = async () => {};
  const listJobs = async () => {};
  const github = {
    profileCheck: (input: { pullNumber: number }) => {
      profileChecks.push(input.pullNumber);
      return { authorized: input.pullNumber !== denied, reason: 'profile denied' };
    },
    rest: {
      repos: {
        getContent: (input: { path: string; ref: string }) => {
          expect(input).toMatchObject({ path: '.github/scripts/ci-acceleration.mjs', ref: 'main' });
          return { data: { type: 'file', content: Buffer.from(helper).toString('base64') } };
        },
      },
      pulls: {
        list: listPulls,
        listReviews,
        get: ({ pull_number }: { pull_number: number }) => {
          if (pull_number === broken) throw Object.assign(new Error('API unavailable'), { status: 503 });
          return {
            data: {
              number: pull_number,
              state: 'open',
              head: { sha: String(pull_number).repeat(40) },
              labels: labels.has(pull_number) ? [{ name: 'run-ci' }] : [],
            },
          };
        },
      },
      actions: {
        getWorkflow: ({ workflow_id }: { workflow_id: string }) => ({
          data: { id: 123, path: `.github/workflows/${workflow_id}`, state: 'active' },
        }),
        listWorkflowRuns: listRuns,
        listJobsForWorkflowRun: listJobs,
        reRunWorkflow: ({ run_id }: { run_id: number }) => {
          reruns.push(run_id);
        },
      },
      issues: {
        addLabels: ({ issue_number }: { issue_number: number }) => {
          labels.add(issue_number);
        },
      },
    },
    paginate: (endpoint: unknown, input: { head_sha?: string; pull_number?: number }) => {
      if (endpoint === listPulls) {
        sweeps += 1;
        return [{ number: 1 }, { number: 2 }];
      }
      if (endpoint === listReviews) {
        reviewReads.push(input.pull_number!);
        return [{ body: 'clean fixture' }];
      }
      if (endpoint === listJobs) return [];
      if (endpoint === listRuns) {
        if (missingCi) return [];
        const id = Number(input.head_sha![0]);
        return [
          {
            id,
            head_sha: input.head_sha,
            status: reruns.includes(id) ? 'queued' : 'completed',
            run_attempt: completedCi ? 2 : 1,
          },
        ];
      }
      throw new Error('unexpected pagination');
    },
  };
  const run = async (name = 'OpenRouter profile completion', workflowId = 123, path = '.github/workflows/openrouter-profile-completion.yml', dispatch?: DispatchOptions) => {
    let now = 0;
    let sourceReads = 0;
    const actions = {
      ...github.rest.actions,
      getWorkflow: (input: { workflow_id: string }) => ({
        data: { ...github.rest.actions.getWorkflow(input).data, state: dispatch?.registeredState ?? 'active' },
      }),
      getWorkflowRun: (input: { owner: string; repo: string; run_id: number; request: { timeout: number } }) => {
        expect(input).toMatchObject({ owner: 'RetireGolden', repo: 'fixture', run_id: Number(dispatch?.sourceId ?? '42') });
        expect(input.request.timeout).toBeGreaterThan(0);
        expect(input.request.timeout).toBeLessThanOrEqual(10000);
        expect(reruns).toEqual([]);
        expect([...labels]).toEqual([]);
        expect(profileChecks).toEqual([]);
        const states = dispatch?.states ?? ['completed'];
        return { data: {
          id: Number(dispatch?.sourceId ?? '42'), workflow_id: dispatch?.workflowId ?? 123,
          path: dispatch?.path ?? '.github/workflows/openrouter-profile-completion.yml',
          status: states[Math.min(sourceReads++, states.length - 1)],
        } };
      },
    };

    await runInNewContext(
      `(async () => {${script}\n})()`,
      {
        github: { ...github, rest: { ...github.rest, actions } },
        Date: { now: () => now },
        setTimeout: (resolve: () => void, delay: number) => { now += delay; resolve(); },
        context: {
          repo: { owner: 'RetireGolden', repo: 'fixture' },
          eventName: dispatch ? 'workflow_dispatch' : 'workflow_run',
          ref: dispatch?.ref ?? 'refs/heads/main',
          runId: 43,
          payload: {
            repository: { default_branch: 'main' },
            inputs: dispatch ? { source_run_id: dispatch.sourceId ?? '42' } : undefined,
            workflow_run: dispatch ? undefined : { name, path, workflow_id: workflowId, head_sha: 'f'.repeat(40) },
          },
        },
        core: {
          info: () => {},
          warning: (message: string) => warnings.push(message),
          setFailed: (message: string) => failures.push(message),
        },
      },
      { importModuleDynamically: constants.USE_MAIN_CONTEXT_DEFAULT_LOADER },
    );
  };
  const runDispatch = (options: DispatchOptions = {}) => run(undefined, undefined, undefined, options);
  return { run, runDispatch, reruns, labels, profileChecks, reviewReads, failures, warnings, sweeps: () => sweeps };
}

describe('broker queue and open-PR sweep', () => {
  it('uses one non-cancelling lock and sweeps both PRs for a main-SHA event', async () => {
    expect(workflow).toMatch(
      /concurrency:\n {2}group: openrouter-ci-broker\n {2}cancel-in-progress: false/,
    );
    const state = fixture();
    await state.run();
    expect(state.reruns).toEqual([1, 2]);
    expect(state.profileChecks).toEqual([1, 2]);
  });

  it('does not rerun active CI when a later coalesced event wakes the same queue', async () => {
    const state = fixture();
    await state.run('OpenRouter code review');
    await state.run('Azure Static Web Apps CI/CD');
    expect(state.reruns).toEqual([1, 2]);
    expect(state.profileChecks).toEqual([1, 2]);
    expect(state.reviewReads).toEqual([1, 2]);
  });

  it.each([{ completedCi: true }, { missingCi: true }])(
    'skips review proofs when Azure has no eligible rerun: %j',
    async (options) => {
      const state = fixture(options);
      await state.run();
      expect(state.profileChecks).toEqual([]);
      expect(state.reviewReads).toEqual([]);
      expect(state.reruns).toEqual([]);
      expect([...state.labels]).toEqual([]);
    },
  );

  it('checks each profile before mutating labels or rerunning', async () => {
    const state = fixture({ denied: 1 });
    await state.run();
    expect(state.profileChecks).toEqual([1, 2]);
    expect([...state.labels]).toEqual([2]);
    expect(state.reruns).toEqual([2]);
  });

  it('accepts a dynamic run-name on the trusted workflow path', async () => {
    const state = fixture();
    await state.run('OpenRouter PR #678: auto', 123, '.github/workflows/openrouter-code-review.yml');
    expect(state.reruns).toEqual([1, 2]);
  });

  it('ignores a colliding display name from another workflow identity', async () => {
    const state = fixture();
    await state.run('OpenRouter code review', 999);
    expect(state.sweeps()).toBe(0);
    expect(state.profileChecks).toEqual([]);
    expect(state.reruns).toEqual([]);
  });

  it('does not let one failed PR lookup starve another ready PR', async () => {
    const state = fixture({ broken: 1 });
    await state.run();
    expect(state.reruns).toEqual([2]);
    expect(state.failures).toEqual(['CI authorization failed for 1 PR(s)']);
    expect(state.warnings).toEqual(['CI authorization could not complete for PR #1 (HTTP 503)']);
  });
});


describe('explicit completion dispatch', () => {
  it('exposes the required dispatch input and default-branch job gate in the workflow', () => {
    expect(workflow).toMatch(/on:\n {2}workflow_dispatch:\n {4}inputs:\n {6}source_run_id:\n {8}description: [^\n]+\n {8}required: true\n {8}type: string\n/);
    expect(workflow).toContain("  authorize-and-rerun:\n    if: github.ref == format('refs/heads/{0}', github.event.repository.default_branch)");
  });

  it('waits for the notifying run to finish before rechecking proofs and changing CI', async () => {
    const state = fixture();
    await state.runDispatch({ sourceId: '84', states: ['in_progress', 'completed'] });
    expect(state.profileChecks).toEqual([1, 2]);
    expect(state.reruns).toEqual([1, 2]);
  });

  it('does not turn a source run ID into CI authorization', async () => {
    const state = fixture({ denied: 1 });
    await state.runDispatch();
    expect(state.profileChecks).toEqual([1, 2]);
    expect([...state.labels]).toEqual([2]);
    expect(state.reruns).toEqual([2]);
  });

  it.each<DispatchOptions & { error: string }>([
    { sourceId: '0', error: 'A different positive source_run_id is required' },
    { sourceId: '43', error: 'A different positive source_run_id is required' },
    { sourceId: '1e2', error: 'A different positive source_run_id is required' },
    { sourceId: '9007199254740993', error: 'A different positive source_run_id is required' },
    { ref: 'refs/heads/feature', error: 'Dispatch CI broker from the default branch' },
    { path: '.github/workflows/release.yml', error: 'Explicit broker wake must identify profile completion' },
    { workflowId: 999, error: 'Explicit broker wake has untrusted workflow identity' },
    { registeredState: 'disabled_manually', error: 'Explicit broker wake has untrusted workflow identity' },
    { states: ['mystery'], error: 'Invalid completion source status' },
    { states: ['in_progress'], error: 'Completion source is still active; rerun the broker after it finishes' },
  ])('rejects invalid or unfinished sources before CI mutations: %j', async (options) => {
    const state = fixture();
    await expect(state.runDispatch(options)).rejects.toThrow(options.error);
    expect(state.profileChecks).toEqual([]);
    expect([...state.labels]).toEqual([]);
    expect(state.reruns).toEqual([]);
  });
});
