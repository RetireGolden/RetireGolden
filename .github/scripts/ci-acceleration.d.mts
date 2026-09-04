export interface RepositoryRef {
  readonly full_name: string
}

export interface ReviewUser {
  readonly login?: string
  readonly id?: number
  readonly type?: string
}

export interface PullRequest {
  readonly state?: string
  readonly base?: { readonly ref?: string }
  readonly user?: ReviewUser
  readonly head?: {
    readonly sha?: string
    readonly repo?: RepositoryRef | null
  }
}

export interface PullRequestReview {
  readonly id?: number
  readonly user?: ReviewUser
  readonly state?: string
  readonly commit_id?: string
  readonly body?: string
  readonly submitted_at?: string
}

export interface ReferencedWorkflow {
  readonly path?: string
  readonly sha?: string
}

export interface WorkflowRun {
  readonly id?: number
  readonly workflow_id?: number
  readonly name?: string
  readonly event?: string
  readonly head_sha?: string
  readonly status?: string
  readonly conclusion?: string | null
  readonly created_at?: string
  readonly run_number?: number
  readonly run_attempt?: number
  readonly path?: string
  readonly referenced_workflows?: readonly ReferencedWorkflow[] | null
  readonly head_repository?: RepositoryRef | null
}

export interface WorkflowContentFile {
  readonly type: string
  readonly sha?: string
}

export interface WorkflowContentResponse {
  readonly data?: WorkflowContentFile | readonly WorkflowContentFile[]
}

export interface AzureJob {
  readonly name?: string
  readonly conclusion?: string | null
}

export interface AzureWorkflowRun {
  readonly id?: number
  readonly status?: string
  readonly run_attempt?: number
}

export interface TrustedReviewContext {
  readonly repository: RepositoryRef
  readonly pullNumber: number
  readonly headSha: string
  readonly workflowRunUrls: readonly string[]
}

export const REVIEW_LEDGER_MARKER_PREFIX: string
export const REVIEW_LEDGER_HEADING: string
export const TRUSTED_REVIEW_AUTHOR: string
export const TRUSTED_REVIEW_AUTHOR_ID: number
export const TRUSTED_REVIEW_AUTHOR_TYPE: string
export const DEPENDABOT_LOGIN: string
export const TRUSTED_REVIEW_WORKFLOW_ID: number
export const TRUSTED_REUSABLE_REVIEW_WORKFLOW: string
export const TRUSTED_REUSABLE_REVIEW_WORKFLOW_SHA: string
export const EXPENSIVE_AZURE_JOB_NAMES: ReadonlySet<string>

export function workflowRunUrl(owner: string, repo: string, runId: number): string
export function newestWorkflowRun(runs: readonly WorkflowRun[]): WorkflowRun | undefined
export function findTrustedCleanReview(
  reviews: readonly PullRequestReview[],
  context: TrustedReviewContext,
): PullRequestReview | undefined
export function reviewRunSkipReason(workflowRun: WorkflowRun, repository: RepositoryRef): string | undefined
export function workflowBlobMatchesDefaultBranch(
  headFile: WorkflowContentResponse | undefined,
  defaultBranchFile: WorkflowContentResponse | undefined,
): boolean
export function azureRunSkipReason(workflowRun: WorkflowRun): string | undefined
export function pullRequestSkipReason(
  pullRequest: PullRequest,
  repository: RepositoryRef,
  expectedHeadSha: string,
): string | undefined
export function isDependabotPullRequest(pullRequest: PullRequest): boolean
export function isExpensiveAzureJob(job: AzureJob): boolean
export function hasOnlySkippedExpensiveAzureJobs(jobs: readonly AzureJob[]): boolean
export function hasActiveOrRealAzureWork(
  runs: readonly AzureWorkflowRun[],
  jobLists: ReadonlyMap<number, readonly AzureJob[]>,
): boolean
