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

function fixture({ denied = 0, broken = 0, completedCi = false, missingCi = false } = {}) {
  const reruns: number[] = [];
  const labels = new Set<number>();
  const profileChecks: number[] = [];
  const reviewReads: number[] = [];
  const failures: string[] = [];
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
          if (pull_number === broken) throw new Error('API unavailable');
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
      if (endpoint === listPulls) return [{ number: 1 }, { number: 2 }];
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
  const run = async (name = 'OpenRouter profile completion') => {
    await runInNewContext(
      `(async () => {${script}\n})()`,
      {
        github,
        context: {
          repo: { owner: 'RetireGolden', repo: 'fixture' },
          payload: {
            repository: { default_branch: 'main' },
            workflow_run: { name, head_sha: 'f'.repeat(40) },
          },
        },
        core: {
          info: () => {},
          warning: () => {},
          setFailed: (message: string) => failures.push(message),
        },
      },
      { importModuleDynamically: constants.USE_MAIN_CONTEXT_DEFAULT_LOADER },
    );
  };
  return { run, reruns, labels, profileChecks, reviewReads, failures };
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
    await state.run('CI');
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

  it('does not let one failed PR lookup starve another ready PR', async () => {
    const state = fixture({ broken: 1 });
    await state.run();
    expect(state.reruns).toEqual([2]);
    expect(state.failures).toEqual(['CI authorization failed for 1 PR(s)']);
  });
});
