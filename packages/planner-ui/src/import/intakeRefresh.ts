/**
 * Existing-plan intake refresh (advisor-intake-and-migration-workbench, WS4).
 *
 * This browser-free contract compares a current plan with a freshly mapped
 * intake plan and its review/provenance checklist. It deliberately supports a
 * very small fact-only allowlist:
 *
 * - wages `annualGross`, matched through a uniquely sourced date of birth;
 * - recurring-income `annualAmount`, matched by a unique normalized label;
 * - one-time-income `amount`, matched by a unique normalized label and year;
 * - `assumptions.recentAnnualMagi`.
 *
 * It never adds or deletes records and never copies whole objects. In
 * particular, Social Security, accounts, household/filing fields, historical
 * MAGI without a separately designed tax-year contract, and every strategy,
 * timing, growth, inflation, and tax-treatment field are out of scope.
 *
 * Protection has the same three-stage guarantee as broker refresh: paths seen
 * by classify are carried into build, paths seen by build are carried into the
 * delta, and apply unions both with paths supplied at apply time.
 */

import type { IncomeStream, Plan } from '@retiregolden/engine/model/plan'
import { isProtectedPath } from './refreshCore'
import type { ImportReviewItem } from './reviewChecklist'

export type IntakeRefreshField = 'annualGross' | 'annualAmount' | 'amount' | 'recentAnnualMagi'
export type IntakeRefreshMatchKind = 'exact' | 'ambiguous' | 'unmatched'
export type IntakeRefreshExclusionReason =
  | 'outside_allowlist'
  | 'missing_provenance'
  | 'ambiguous_provenance'
  | 'unreviewed_assumption'
  | 'person_not_proven'
  | 'ambiguous_source'
  | 'ambiguous_target'
  | 'no_target'

export interface IntakeRefreshSource {
  /** Allowlisted field path in the incoming plan. */
  path: string
  field: IntakeRefreshField
  value: number
  /** The review item that supports this value, when one exists uniquely. */
  provenance: ImportReviewItem | null
}

export interface IntakeRefreshCandidate {
  source: IntakeRefreshSource
  /** Allowlisted leaf in the current plan; never a generated incoming id. */
  targetPath: string | null
  match: IntakeRefreshMatchKind
  /** Other semantically compatible targets when uniqueness fails. */
  alternativeTargetPaths: string[]
  reason: IntakeRefreshExclusionReason | null
  isProtected: boolean
}

/** An incoming mapped item intentionally kept outside the refresh allowlist. */
export interface IntakeRefreshExcludedItem {
  sourcePath: string | null
  reason: 'outside_allowlist'
  review: ImportReviewItem
}

export interface IntakeRefreshClassification {
  candidates: IntakeRefreshCandidate[]
  excluded: IntakeRefreshExcludedItem[]
  /**
   * Current allowlisted income leaves addressed by this intake's semantic
   * domain but not uniquely matched. Informational only: never deletions.
   */
  staleTargetPaths: string[]
  protectedPaths: readonly string[]
}

export interface ClassifyIntakeRefreshOptions {
  protectedTargets?: ReadonlySet<string>
}

export interface IntakeRefreshFieldDelta {
  path: string
  field: IntakeRefreshField
  before: number
  after: number
  sourcePath: string
}

export interface IntakeRefreshDuplicateGroup {
  targetPath: string
  /** Indexes into `candidates` selected for the same target. */
  sourceIndexes: number[]
}

export interface IntakeRefreshDelta {
  candidates: IntakeRefreshCandidate[]
  changes: IntakeRefreshFieldDelta[]
  staleTargetPaths: string[]
  duplicateGroups: IntakeRefreshDuplicateGroup[]
  excluded: IntakeRefreshExcludedItem[]
  review: ImportReviewItem[]
  protectedPaths: readonly string[]
}

const EMPTY_PROTECTED: ReadonlySet<string> = new Set()

type Wages = Extract<IncomeStream, { type: 'wages' }>
type Recurring = Extract<IncomeStream, { type: 'recurring' }>
type OneTime = Extract<IncomeStream, { type: 'oneTime' }>
type IncomeAmountField = Exclude<IntakeRefreshField, 'recentAnnualMagi'>

const INCOME_RECORD_PATH = /^incomes\[(0|[1-9]\d*)\]$/
const INCOME_LEAF_PATH = /^incomes\[(0|[1-9]\d*)\]\.(annualGross|annualAmount|amount)$/

function safeIndex(raw: string): number | null {
  const index = Number(raw)
  return Number.isSafeInteger(index) ? index : null
}

function parseIncomeLeafPath(
  path: string,
): { index: number; field: IncomeAmountField } | null {
  const match = INCOME_LEAF_PATH.exec(path)
  if (!match) return null
  const index = safeIndex(match[1]!)
  if (index === null) return null
  return { index, field: match[2] as IncomeAmountField }
}

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function landed(item: ImportReviewItem): boolean {
  return item.status === 'mapped' || item.status === 'defaulted'
}

function explicitlyReviewed(item: ImportReviewItem): boolean {
  return item.decision?.state === 'accepted' || item.decision?.state === 'overridden'
}

/**
 * Auto-refresh requires source-faithful provenance. A reviewer may explicitly
 * accept/override an assumption; a pending/defaulted assumption may be shown
 * but never auto-matched (the joint-1040 wage case).
 */
function provenanceCanAutoMatch(item: ImportReviewItem): boolean {
  if (!landed(item) || item.decision?.state === 'rejected') return false
  if (explicitlyReviewed(item)) return true
  return item.status === 'mapped' && item.confidence !== 'assumed' && item.confidence !== 'estimated'
}

function reviewForPath(
  review: readonly ImportReviewItem[],
  recordPath: string,
  leafPath: string,
): { item: ImportReviewItem | null; reason: IntakeRefreshExclusionReason | null } {
  const matches = review.filter((item) => landed(item) && (item.target === recordPath || item.target === leafPath))
  if (matches.length === 0) return { item: null, reason: 'missing_provenance' }
  if (matches.length > 1) return { item: null, reason: 'ambiguous_provenance' }
  const item = matches[0]!
  return {
    item,
    reason: provenanceCanAutoMatch(item) ? null : 'unreviewed_assumption',
  }
}

function personDobProvenance(
  incoming: Plan,
  personId: string,
  review: readonly ImportReviewItem[],
): { dob: string; incomingPersonIndex: number } | null {
  const incomingPersonIndex = incoming.household.people.findIndex((person) => person.id === personId)
  if (incomingPersonIndex < 0) return null
  const person = incoming.household.people[incomingPersonIndex]!
  const target = `household.people[${incomingPersonIndex}].dob`
  const matches = review.filter((item) => landed(item) && item.target === target)
  if (matches.length !== 1 || !provenanceCanAutoMatch(matches[0]!)) return null
  // A DOB must identify one incoming person too. Two people sharing the same
  // DOB are real, but the intake has not proven which wage belongs to which.
  if (incoming.household.people.filter((candidate) => candidate.dob === person.dob).length !== 1) return null
  return { dob: person.dob, incomingPersonIndex }
}

function matchingCurrentPersonIndex(current: Plan, dob: string): number | null {
  const matches = current.household.people
    .map((person, index) => ({ person, index }))
    .filter(({ person }) => person.dob === dob)
  return matches.length === 1 ? matches[0]!.index : null
}

function sourceOf(
  path: string,
  field: IntakeRefreshField,
  value: number,
  provenance: ImportReviewItem | null,
): IntakeRefreshSource {
  return { path, field, value, provenance }
}

function candidate(
  source: IntakeRefreshSource,
  targetPaths: string[],
  reason: IntakeRefreshExclusionReason | null,
  protectedTargets: ReadonlySet<string>,
): IntakeRefreshCandidate {
  const unique = targetPaths.length === 1 && reason === null
  const match: IntakeRefreshMatchKind =
    reason === 'missing_provenance' ||
    reason === 'unreviewed_assumption' ||
    reason === 'person_not_proven' ||
    reason === 'no_target'
      ? 'unmatched'
      : reason !== null || targetPaths.length > 1
        ? 'ambiguous'
        : unique
          ? 'exact'
          : 'unmatched'
  const targetPath = unique ? targetPaths[0]! : null
  return {
    source,
    targetPath,
    match,
    alternativeTargetPaths: unique ? [] : targetPaths,
    reason,
    isProtected: targetPath !== null && isProtectedPath(targetPath, protectedTargets),
  }
}

function wageCandidates(
  current: Plan,
  incoming: Plan,
  review: readonly ImportReviewItem[],
  protectedTargets: ReadonlySet<string>,
): { candidates: IntakeRefreshCandidate[]; addressed: Set<string> } {
  const candidates: IntakeRefreshCandidate[] = []
  const addressed = new Set<string>()
  const incomingWages = incoming.incomes.filter((income): income is Wages => income.type === 'wages')
  const currentWages = current.incomes.filter((income): income is Wages => income.type === 'wages')

  incomingWages.forEach((income) => {
    const sourceIndex = incoming.incomes.indexOf(income)
    const recordPath = `incomes[${sourceIndex}]`
    const leafPath = `${recordPath}.annualGross`
    // The record-level mapping authenticates both the amount and the semantic
    // identity fields used below. A leaf-only amount mapping cannot prove whose
    // wage this is.
    const provenance = reviewForPath(review, recordPath, recordPath)
    const source = sourceOf(leafPath, 'annualGross', income.annualGross, provenance.item)
    if (provenance.reason !== null) {
      candidates.push(candidate(source, [], provenance.reason, protectedTargets))
      return
    }

    const personProof = personDobProvenance(incoming, income.personId, review)
    if (personProof === null) {
      candidates.push(candidate(source, [], 'person_not_proven', protectedTargets))
      return
    }
    const currentPersonIndex = matchingCurrentPersonIndex(current, personProof.dob)
    if (currentPersonIndex === null) {
      candidates.push(candidate(source, [], 'no_target', protectedTargets))
      return
    }
    const currentPersonId = current.household.people[currentPersonIndex]!.id
    const sourceCount = incomingWages.filter((other) => other.personId === income.personId).length
    const targetPaths = currentWages
      .filter((other) => other.personId === currentPersonId)
      .map((other) => `incomes[${current.incomes.indexOf(other)}].annualGross`)
    for (const path of targetPaths) addressed.add(path)
    const reason =
      sourceCount !== 1 ? 'ambiguous_source' : targetPaths.length > 1 ? 'ambiguous_target' : targetPaths.length === 0 ? 'no_target' : null
    candidates.push(candidate(source, targetPaths, reason, protectedTargets))
  })
  return { candidates, addressed }
}

function recurringCandidates(
  current: Plan,
  incoming: Plan,
  review: readonly ImportReviewItem[],
  protectedTargets: ReadonlySet<string>,
): { candidates: IntakeRefreshCandidate[]; addressed: Set<string> } {
  const candidates: IntakeRefreshCandidate[] = []
  const addressed = new Set<string>()
  const sources = incoming.incomes.filter((income): income is Recurring => income.type === 'recurring')
  const targets = current.incomes.filter((income): income is Recurring => income.type === 'recurring')
  sources.forEach((income) => {
    const sourceIndex = incoming.incomes.indexOf(income)
    const recordPath = `incomes[${sourceIndex}]`
    const leafPath = `${recordPath}.annualAmount`
    // Label is the match key, so require provenance for the whole record. An
    // amount-only mapping cannot authenticate a label supplied beside it.
    const provenance = reviewForPath(review, recordPath, recordPath)
    const source = sourceOf(leafPath, 'annualAmount', income.annualAmount, provenance.item)
    if (provenance.reason !== null) {
      candidates.push(candidate(source, [], provenance.reason, protectedTargets))
      return
    }
    const key = normalizeLabel(income.label)
    const sourceCount = sources.filter((other) => normalizeLabel(other.label) === key).length
    const targetPaths = targets
      .filter((other) => normalizeLabel(other.label) === key)
      .map((other) => `incomes[${current.incomes.indexOf(other)}].annualAmount`)
    for (const path of targetPaths) addressed.add(path)
    const reason =
      key === '' || targetPaths.length === 0
        ? 'no_target'
        : sourceCount !== 1
          ? 'ambiguous_source'
          : targetPaths.length !== 1
            ? 'ambiguous_target'
            : null
    candidates.push(candidate(source, targetPaths, reason, protectedTargets))
  })
  return { candidates, addressed }
}

function oneTimeCandidates(
  current: Plan,
  incoming: Plan,
  review: readonly ImportReviewItem[],
  protectedTargets: ReadonlySet<string>,
): { candidates: IntakeRefreshCandidate[]; addressed: Set<string> } {
  const candidates: IntakeRefreshCandidate[] = []
  const addressed = new Set<string>()
  const sources = incoming.incomes.filter((income): income is OneTime => income.type === 'oneTime')
  const targets = current.incomes.filter((income): income is OneTime => income.type === 'oneTime')
  sources.forEach((income) => {
    const sourceIndex = incoming.incomes.indexOf(income)
    const recordPath = `incomes[${sourceIndex}]`
    const leafPath = `${recordPath}.amount`
    // Label + year are the match key, so both must be covered by record-level
    // provenance rather than trusting an amount-only leaf mapping.
    const provenance = reviewForPath(review, recordPath, recordPath)
    const source = sourceOf(leafPath, 'amount', income.amount, provenance.item)
    if (provenance.reason !== null) {
      candidates.push(candidate(source, [], provenance.reason, protectedTargets))
      return
    }
    const key = `${normalizeLabel(income.label)}\u0000${income.year}`
    const sourceCount = sources.filter((other) => `${normalizeLabel(other.label)}\u0000${other.year}` === key).length
    const targetPaths = targets
      .filter((other) => `${normalizeLabel(other.label)}\u0000${other.year}` === key)
      .map((other) => `incomes[${current.incomes.indexOf(other)}].amount`)
    for (const path of targetPaths) addressed.add(path)
    const reason =
      normalizeLabel(income.label) === '' || targetPaths.length === 0
        ? 'no_target'
        : sourceCount !== 1
          ? 'ambiguous_source'
          : targetPaths.length !== 1
            ? 'ambiguous_target'
            : null
    candidates.push(candidate(source, targetPaths, reason, protectedTargets))
  })
  return { candidates, addressed }
}

function magiCandidate(
  incoming: Plan,
  review: readonly ImportReviewItem[],
  protectedTargets: ReadonlySet<string>,
): IntakeRefreshCandidate {
  const path = 'assumptions.recentAnnualMagi'
  const provenance = reviewForPath(review, path, path)
  const source = sourceOf(path, 'recentAnnualMagi', incoming.assumptions.recentAnnualMagi, provenance.item)
  return candidate(source, provenance.reason === null ? [path] : [], provenance.reason, protectedTargets)
}

function allowlistedReviewTarget(incoming: Plan, target: string | undefined): boolean {
  if (target === 'assumptions.recentAnnualMagi') return true
  const recordMatch = INCOME_RECORD_PATH.exec(target ?? '')
  const leafMatch = INCOME_LEAF_PATH.exec(target ?? '')
  const rawIndex = recordMatch?.[1] ?? leafMatch?.[1]
  if (rawIndex === undefined) return false
  const index = safeIndex(rawIndex)
  if (index === null) return false
  const income = incoming.incomes[index]
  const field = leafMatch?.[2]
  if (field === undefined) return income?.type === 'wages' || income?.type === 'recurring' || income?.type === 'oneTime'
  if (field === 'annualGross') return income?.type === 'wages'
  if (field === 'annualAmount') return income?.type === 'recurring'
  return income?.type === 'oneTime'
}

/**
 * Classify the allowlisted facts in `incoming`, using `review` as the
 * provenance gate. Incoming generated ids are never compared with current ids.
 */
export function classifyIntakeRefresh(
  current: Plan,
  incoming: Plan,
  review: readonly ImportReviewItem[],
  opts: ClassifyIntakeRefreshOptions = {},
): IntakeRefreshClassification {
  const protectedTargets = opts.protectedTargets ?? EMPTY_PROTECTED
  const wages = wageCandidates(current, incoming, review, protectedTargets)
  const recurring = recurringCandidates(current, incoming, review, protectedTargets)
  const oneTime = oneTimeCandidates(current, incoming, review, protectedTargets)
  const magi = magiCandidate(incoming, review, protectedTargets)
  const candidates = [...wages.candidates, ...recurring.candidates, ...oneTime.candidates, magi]
  const addressed = new Set([...wages.addressed, ...recurring.addressed, ...oneTime.addressed])
  const matched = new Set(
    candidates.filter((item) => item.match === 'exact' && item.targetPath !== null).map((item) => item.targetPath!),
  )
  const staleTargetPaths = [...addressed].filter((path) => !matched.has(path))
  const excluded = review
    .filter((item) => landed(item) && !allowlistedReviewTarget(incoming, item.target))
    .map((item) => ({ sourcePath: item.target ?? null, reason: 'outside_allowlist' as const, review: item }))
  return { candidates, excluded, staleTargetPaths, protectedPaths: [...protectedTargets] }
}

/** Default-on selection: unique exact matches only, excluding protected paths. */
export function defaultIntakeRefreshSelection(
  classification: IntakeRefreshClassification,
): ReadonlyMap<number, string> {
  const selection = new Map<number, string>()
  classification.candidates.forEach((item, index) => {
    if (item.match === 'exact' && item.targetPath !== null && !item.isProtected) {
      selection.set(index, item.targetPath)
    }
  })
  return selection
}

function compatibleTarget(current: Plan, source: IntakeRefreshSource, path: string): boolean {
  if (source.field === 'recentAnnualMagi') return path === 'assumptions.recentAnnualMagi'
  const parsed = parseIncomeLeafPath(path)
  if (!parsed || parsed.field !== source.field) return false
  const income = current.incomes[parsed.index]
  if (source.field === 'annualGross') return income?.type === 'wages'
  if (source.field === 'annualAmount') return income?.type === 'recurring'
  return income?.type === 'oneTime'
}

function readTarget(current: Plan, path: string, field: IntakeRefreshField): number | null {
  if (field === 'recentAnnualMagi') {
    return path === 'assumptions.recentAnnualMagi' ? current.assumptions.recentAnnualMagi : null
  }
  const parsed = parseIncomeLeafPath(path)
  if (!parsed || parsed.field !== field) return null
  const income = current.incomes[parsed.index]
  if (field === 'annualGross' && income?.type === 'wages') return income.annualGross
  if (field === 'annualAmount' && income?.type === 'recurring') return income.annualAmount
  if (field === 'amount' && income?.type === 'oneTime') return income.amount
  return null
}

function effectiveProtected(
  classification: IntakeRefreshClassification,
  protectedTargets: ReadonlySet<string>,
): Set<string> {
  const effective = new Set(classification.protectedPaths)
  for (const path of protectedTargets) effective.add(path)
  for (const item of classification.candidates) {
    if (item.isProtected && item.targetPath !== null) effective.add(item.targetPath)
  }
  return effective
}

function duplicateGroups(
  current: Plan,
  candidates: readonly IntakeRefreshCandidate[],
  selection: ReadonlyMap<number, string>,
): IntakeRefreshDuplicateGroup[] {
  const byTarget = new Map<string, number[]>()
  candidates.forEach((item, index) => {
    const path = selection.get(index)
    if (!path || !candidateIsSelectable(item) || !compatibleTarget(current, item.source, path)) return
    const indexes = byTarget.get(path) ?? []
    indexes.push(index)
    byTarget.set(path, indexes)
  })
  return [...byTarget]
    .filter(([, indexes]) => indexes.length > 1)
    .map(([targetPath, sourceIndexes]) => ({ targetPath, sourceIndexes }))
}

/**
 * Manual matching may resolve identity uncertainty, but it may not manufacture
 * source evidence or reverse a rejected/unreviewed source verdict.
 */
function candidateIsSelectable(candidate: IntakeRefreshCandidate): boolean {
  return (
    candidate.source.provenance !== null &&
    candidate.reason !== 'missing_provenance' &&
    candidate.reason !== 'ambiguous_provenance' &&
    candidate.reason !== 'unreviewed_assumption' &&
    candidate.reason !== 'person_not_proven'
  )
}

function money(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`
}

/**
 * Build an exact before/after preview. Selection maps candidate index to an
 * allowlisted current-plan leaf. A duplicate target blocks the whole delta.
 */
export function buildIntakeRefreshDelta(
  current: Plan,
  classification: IntakeRefreshClassification,
  selection: ReadonlyMap<number, string>,
  protectedTargets: ReadonlySet<string> = EMPTY_PROTECTED,
): IntakeRefreshDelta {
  const effective = effectiveProtected(classification, protectedTargets)
  const duplicates = duplicateGroups(current, classification.candidates, selection)
  const changes: IntakeRefreshFieldDelta[] = []
  const review: ImportReviewItem[] = []

  if (duplicates.length === 0) {
    classification.candidates.forEach((item, index) => {
      const path = selection.get(index)
      if (!path || !candidateIsSelectable(item) || !compatibleTarget(current, item.source, path)) return
      if (isProtectedPath(path, effective)) {
        review.push({
          status: 'skipped',
          source: item.source.provenance?.source ?? item.source.path,
          detail: 'This fact is protected, so intake refresh left it unchanged.',
          locator: item.source.provenance?.locator ?? { kind: 'none', note: item.source.path },
          confidence: 'unmapped',
        })
        return
      }
      const before = readTarget(current, path, item.source.field)
      if (before === null) return
      if (
        !Number.isFinite(before) ||
        before < 0 ||
        !Number.isFinite(item.source.value) ||
        item.source.value < 0
      ) {
        review.push({
          status: 'skipped',
          source: item.source.provenance!.source,
          detail: 'This fact is not a finite, non-negative amount, so intake refresh left it unchanged.',
          locator: item.source.provenance!.locator ?? { kind: 'none', note: item.source.path },
          confidence: 'unmapped',
        })
        return
      }
      changes.push({
        path,
        field: item.source.field,
        before,
        after: item.source.value,
        sourcePath: item.source.path,
      })
      review.push({
        status: 'mapped',
        source: item.source.provenance?.source ?? item.source.path,
        detail: `Refreshed ${path} from ${money(before)} to ${money(item.source.value)}.`,
        locator: item.source.provenance?.locator ?? { kind: 'none', note: item.source.path },
        confidence: item.source.provenance?.confidence ?? 'exact',
        target: path,
      })
    })
  } else {
    const collidingIndexes = new Set(duplicates.flatMap((group) => group.sourceIndexes))
    classification.candidates.forEach((item, index) => {
      const path = selection.get(index)
      if (!path || !candidateIsSelectable(item) || !compatibleTarget(current, item.source, path)) return
      review.push({
        status: 'skipped',
        source: item.source.provenance!.source,
        detail: collidingIndexes.has(index)
          ? 'More than one incoming fact targets the same plan field, so the entire refresh is blocked.'
          : 'Another selected field has a duplicate target, so the entire refresh is blocked.',
        locator: item.source.provenance!.locator ?? { kind: 'none', note: item.source.path },
        confidence: 'unmapped',
      })
    })
  }

  return {
    candidates: classification.candidates,
    changes,
    // A manual assignment can resolve a classify-time ambiguity. Reconcile
    // stale reporting against the writes this exact preview will perform, just
    // as broker refresh does, so one path is never both "updated" and "stale".
    staleTargetPaths: classification.staleTargetPaths.filter(
      (path) => !changes.some((change) => change.path === path),
    ),
    duplicateGroups: duplicates,
    excluded: classification.excluded,
    review,
    protectedPaths: [...effective],
  }
}

function writeTarget(draft: Plan, change: IntakeRefreshFieldDelta): boolean {
  if (change.field === 'recentAnnualMagi') {
    if (change.path !== 'assumptions.recentAnnualMagi') return false
    draft.assumptions.recentAnnualMagi = change.after
    return true
  }
  const parsed = parseIncomeLeafPath(change.path)
  if (!parsed || parsed.field !== change.field) return false
  const income = draft.incomes[parsed.index]
  if (change.field === 'annualGross' && income?.type === 'wages') income.annualGross = change.after
  else if (change.field === 'annualAmount' && income?.type === 'recurring') income.annualAmount = change.after
  else if (change.field === 'amount' && income?.type === 'oneTime') income.amount = change.after
  else return false
  return true
}

/**
 * Apply a previously built delta to `draft` in place. Only the four allowlisted
 * primitive leaves can be assigned. Any duplicate makes this a full no-op.
 */
export function applyIntakeRefresh(
  draft: Plan,
  delta: IntakeRefreshDelta,
  protectedTargets: ReadonlySet<string> = EMPTY_PROTECTED,
): number {
  if (delta.duplicateGroups.length > 0) return 0
  if (new Set(delta.changes.map((change) => change.path)).size !== delta.changes.length) return 0
  const effective = new Set(delta.protectedPaths)
  for (const path of protectedTargets) effective.add(path)

  // Fail the whole delta before the first assignment when it is malformed or
  // stale. This keeps a forged/non-finite amount out of the plan and preserves
  // preview/apply agreement when the target changed after preview.
  if (
    delta.changes.some(
      (change) =>
        !Number.isFinite(change.before) ||
        change.before < 0 ||
        !Number.isFinite(change.after) ||
        change.after < 0 ||
        readTarget(draft, change.path, change.field) !== change.before,
    )
  ) {
    return 0
  }

  let applied = 0
  for (const change of delta.changes) {
    if (isProtectedPath(change.path, effective)) continue
    if (writeTarget(draft, change)) applied++
  }
  return applied
}
