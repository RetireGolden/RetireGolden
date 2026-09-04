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
  readonly number?: number
  readonly base?: { readonly ref?: string }
  readonly user?: ReviewUser
  readonly head?: {
    readonly sha?: string
    readonly repo?: RepositoryRef | null
  }
  readonly labels?: readonly { readonly name?: string }[]
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
  readonly content?: string
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
  readonly workflowRunUrl?: string
  readonly workflowRunUrls?: readonly string[]
}

export interface CiRequestedInput {
  readonly runAttempt: number
  readonly hasRunCiLabel: boolean
}

export interface AuthorizationResult {
  readonly authorized: boolean
  readonly failJob: boolean
  readonly reason: string
}

export interface GetContentRequest {
  readonly owner: string
  readonly repo: string
  readonly path: string
  readonly ref: string
}

export interface ListPullRequestsAssociatedWithCommitRequest {
  readonly owner: string
  readonly repo: string
  readonly commit_sha: string
  readonly per_page: number
}

export interface GetPullRequestRequest {
  readonly owner: string
  readonly repo: string
  readonly pull_number: number
}

export interface ListPullRequestReviewsRequest extends GetPullRequestRequest {
  readonly per_page: number
}

export interface ListWorkflowRunsRequest {
  readonly owner: string
  readonly repo: string
  readonly workflow_id: string
  readonly head_sha: string
  readonly per_page: number
}

export interface GetWorkflowRunRequest {
  readonly owner: string
  readonly repo: string
  readonly run_id: number
}

export type NamedRequest<TRequest> = ((request: TRequest) => Promise<unknown>) & {
  readonly name: string
}

export interface PaginatedRequestParameters {
  readonly owner: string
  readonly repo: string
  readonly per_page: number
  readonly commit_sha?: string
  readonly pull_number?: number
  readonly workflow_id?: string
  readonly head_sha?: string
}

export type PaginatedRequest =
  | NamedRequest<ListPullRequestsAssociatedWithCommitRequest>
  | NamedRequest<ListPullRequestReviewsRequest>
  | NamedRequest<ListWorkflowRunsRequest>

export interface GitHubLike {
  readonly rest: {
    readonly repos: {
      getContent: (request: GetContentRequest) => Promise<WorkflowContentResponse>
      listPullRequestsAssociatedWithCommit: NamedRequest<ListPullRequestsAssociatedWithCommitRequest>
    }
    readonly pulls: {
      get: (request: GetPullRequestRequest) => Promise<{ readonly data: PullRequest }>
      listReviews: NamedRequest<ListPullRequestReviewsRequest>
    }
    readonly actions: {
      listWorkflowRuns: NamedRequest<ListWorkflowRunsRequest>
      getWorkflowRun: (request: GetWorkflowRunRequest) => Promise<{ readonly data: WorkflowRun }>
    }
  }
  paginate: (request: PaginatedRequest, parameters: PaginatedRequestParameters) => Promise<unknown[]>
}

export interface CoreLike {
  setFailed: (message: string) => void
}

export const CI_ACCELERATION_HELPER_PATH: string
export const REVIEW_LEDGER_MARKER_PREFIX: string
export const REVIEW_LEDGER_HEADING: string
export const TRUSTED_REVIEW_AUTHOR: string
export const TRUSTED_REVIEW_AUTHOR_ID: number
export const TRUSTED_REVIEW_AUTHOR_TYPE: string
export const DEPENDABOT_LOGIN: string
export const TRUSTED_REVIEW_WORKFLOW_ID: number
export const TRUSTED_OPENROUTER_CALLER_PATH: string
export const TRUSTED_REUSABLE_REVIEW_WORKFLOW: string
export const TRUSTED_REUSABLE_REVIEW_WORKFLOW_SHA: string
export const EXPENSIVE_AZURE_JOB_NAMES: ReadonlySet<string>

export function workflowRunUrl(owner: string, repo: string, runId: number): string
export function parseWorkflowRunIdFromUrl(url: string): number | undefined
export function terminalSameRepositoryWorkflowRunUrl(
  review: PullRequestReview,
  repository: RepositoryRef,
): string | undefined
export function newestWorkflowRun(runs: readonly WorkflowRun[]): WorkflowRun | undefined
export function exactHeadBotReview(review: PullRequestReview, headSha: string): boolean
export function reviewReferencesAuthoritativeRun(review: PullRequestReview, workflowRunUrl: string): boolean
export function findTrustedCleanReview(
  reviews: readonly PullRequestReview[],
  context: TrustedReviewContext,
): PullRequestReview | undefined
export function reviewRunSkipReason(workflowRun: WorkflowRun, repository: RepositoryRef): string | undefined
export function reviewDispatchRunSkipReason(workflowRun: WorkflowRun, repository: RepositoryRef): string | undefined
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
export function isCiRequested(input: CiRequestedInput): boolean
export function ledgerWorkflowRunUrlsFromReview(
  review: PullRequestReview,
  context: { readonly repository: RepositoryRef; readonly pullNumber: number; readonly headSha: string },
): readonly string[]
export function collectProvenanceReviewRuns(
  github: GitHubLike,
  input: {
    readonly owner: string
    readonly repo: string
    readonly repository: RepositoryRef
    readonly defaultBranch: string
    readonly expectedHeadSha: string
    readonly pullNumber: number
    readonly reviews: readonly PullRequestReview[]
    readonly allowDispatch?: boolean
  },
): Promise<{
  readonly provenanceReviewRuns: WorkflowRun[]
  readonly defaultCaller: WorkflowContentResponse | undefined
  readonly error: string | undefined
}>
export function authorizeExactHeadPullRequest(
  github: GitHubLike,
  core: CoreLike,
  input: {
    readonly owner: string
    readonly repo: string
    readonly repository: RepositoryRef
    readonly defaultBranch: string
    readonly eventPr: PullRequest
    readonly runAttempt: number
  },
): Promise<AuthorizationResult>
export function isExpensiveAzureJob(job: AzureJob): boolean
export function hasOnlySkippedExpensiveAzureJobs(jobs: readonly AzureJob[]): boolean
export function hasActiveOrRealAzureWork(
  runs: readonly AzureWorkflowRun[],
  jobLists: ReadonlyMap<number, readonly AzureJob[]>,
): boolean
