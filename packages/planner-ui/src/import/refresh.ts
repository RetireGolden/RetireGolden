/**
 * The **broker-refresh engine** (advisor-intake-and-migration-workbench, WS4):
 * the returning-user "update my balances from a fresh broker download" path,
 * factored out of the panel so it can be reasoned about — and tested — without
 * a browser. It matches each account in a parsed broker file to a plan account,
 * previews the exact before→after writes, and applies balance/cost-basis
 * refreshes without ever disturbing the strategy fields a returning user has
 * carefully set (allocation, yields, contribution schedule, beneficiary, …).
 *
 * **Stability promise:** published as the `@retiregolden/planner-ui/import-refresh`
 * subpath. Like the sibling `./import-provenance` contract it is a supported
 * API — the exported names and signatures only change with a semver-major
 * release — and deliberately browser-free (no DOM, no `crypto.subtle`), so the
 * Pro/Advisor repo or a Node process can classify and apply a refresh headless.
 *
 * **`RefreshMatchKind` is deliberately NOT `ImportConfidence`.** The provenance
 * contract's `ImportConfidence` grades how faithfully a *source value* survived
 * the trip into the plan (`'exact'` = read verbatim, `'derived'` = summed, …).
 * `RefreshMatchKind` grades something unrelated: how sure we are *which plan
 * account a file row refers to* — pure match certainty, nothing about the
 * fidelity of the dollar amount. A row can be an `'exact'` match to the wrong-
 * fidelity aggregate, or an `'ambiguous'` match to a verbatim single position.
 * Collapsing the two scales onto one enum would let a UI equate "we're sure
 * this is your Roth" with "we copied this number exactly" — different claims.
 * The review checklist below still carries `ImportConfidence` for the values
 * that land; the two scales ride together, never merged.
 *
 * **`protectedTargets` is caller-supplied, enforced as one effective set that
 * unions across three stages.** A path in this set (an account `accounts[i]` or
 * one of its fields `accounts[i].balance`) is off-limits to the refresh: it is
 * classified but defaults OFF and is skipped on apply, never partially written.
 * The set may be supplied at ANY of three stages — `classifyRefresh`,
 * `buildRefreshDelta`, or `applyRefresh` — and each stage carries it forward so
 * enforcement never loses it:
 *  - `classifyRefresh` takes a faithful snapshot of the set it was given onto
 *    `RefreshClassification.protectedPaths` (an empty array when none).
 *  - `buildRefreshDelta` computes ONE effective set = the union of that snapshot,
 *    any `protectedTargets` passed to it, and the `targetPath` of every candidate
 *    already classified `isProtected` (the last now redundant, but harmless), and
 *    records that union as `RefreshDelta.protectedPaths`.
 *  - `applyRefresh`'s effective set is the union of `delta.protectedPaths` and
 *    any `protectedTargets` passed to it; `computeWrites` skips any write whose
 *    chosen account falls in that set.
 *
 * Net guarantee: protection reaches enforcement if the set was supplied to ANY
 * stage. Because classify's snapshot rides on the classification and build's
 * union rides on the delta, a target is protected even when it was *manually
 * reassigned* onto a protected account — as long as classify or build saw the
 * set, apply may be handed nothing and the write is still skipped. The Pro repo
 * feeds the set the WS2 intake decisions in a later dispatch; the public planner
 * panel passes none. This module never invents a protected set of its own — the
 * seam is the argument.
 */

import type { Account, Plan } from '@retiregolden/engine/model/plan'
import { applyBrokerBalance, isBalanceUpdatable, type BrokerAccountBalance } from './brokerCsv'
import { normalizeUnicodeText } from './labelNormalize'
import { isProtectedPath } from './refreshCore'
import type { ImportReviewItem } from './reviewChecklist'
import type { SourceLocator } from './provenance'

/**
 * How sure we are which plan account a broker-file row refers to (see the
 * module header for why this is not `ImportConfidence`):
 *  - `'exact'`     — a single plan account whose whole name appears in the label.
 *  - `'likely'`    — a single plan account sharing a *distinctive* (non-category)
 *                    word with it; safe to default ON.
 *  - `'ambiguous'` — more than one plausible plan account, OR a single account
 *                    matched only on a shared account-type word ("IRA"): the
 *                    match is genuinely uncertain, so it defaults OFF.
 *                    `alternativeAccountIds` lists any runners-up.
 *  - `'unmatched'` — no updatable plan account plausibly matches.
 */
export type RefreshMatchKind = 'exact' | 'remembered' | 'likely' | 'ambiguous' | 'unmatched'

/** One broker-file account matched (or not) to a plan account. */
export interface RefreshCandidate {
  /** The parsed broker aggregate this candidate is about. */
  source: BrokerAccountBalance
  /** Best-guess plan account id, or null when nothing plausibly matched. */
  targetAccountId: string | null
  /** Plan path of the best guess (`accounts[i]` convention), or null. */
  targetPath: string | null
  match: RefreshMatchKind
  /**
   * The other plausible plan accounts when `match` is `'ambiguous'` — the
   * false-positive audit trail, so "Roth IRA" and "Rollover IRA" can be shown
   * to have both matched rather than one silently winning.
   */
  alternativeAccountIds: string[]
  /** The matched plan path (or a field of it) is in `protectedTargets`. Defaults OFF. */
  isProtected: boolean
}

/** One field the refresh would write, with its before/after and clamp flag. */
export interface RefreshFieldDelta {
  /** `accounts[i].balance` or `accounts[i].costBasis`. */
  path: string
  field: 'balance' | 'costBasis'
  before: number
  after: number
  /** The file value was negative and was clamped to $0 by `applyBrokerBalance`. */
  clamped: boolean
}

/**
 * Multiple selected file rows resolving to one plan account. Never auto-merged:
 * a single such collision blocks the ENTIRE apply — `applyRefresh` writes nothing
 * and returns 0, not just the colliding accounts — so a headless caller matches
 * the panel, which disables its apply button while any duplicate exists.
 */
export interface RefreshDuplicateGroup {
  accountId: string
  /** Indexes into the candidates array whose selection points at this account. */
  sourceIndexes: number[]
}

/**
 * The output of `classifyRefresh`: the per-row match verdicts plus a faithful
 * snapshot of the protected-path set the classification was given (an empty array
 * when none). Carrying the snapshot on the classification is what lets protection
 * reach enforcement even when the caller supplies the set ONLY to `classifyRefresh`
 * — `buildRefreshDelta` folds `protectedPaths` into its effective set.
 */
export interface RefreshClassification {
  candidates: RefreshCandidate[]
  /** Snapshot of the protected paths `classifyRefresh` saw; `[]` when none. */
  protectedPaths: readonly string[]
}

/** The full preview of a refresh: what would change, what is stale, what collides. */
export interface RefreshDelta {
  candidates: RefreshCandidate[]
  /** The exact field writes an apply would perform, for the selected rows. */
  changes: RefreshFieldDelta[]
  /** Updatable plan accounts no file row matched — their balances are going stale. */
  staleAccountIds: string[]
  /**
   * Selected collisions (never auto-merged). A non-empty list makes apply a FULL
   * no-op: `applyRefresh` writes nothing and returns 0, matching the panel's
   * block-everything behaviour so a headless caller reaches the same verdict.
   */
  duplicateGroups: RefreshDuplicateGroup[]
  /** Honesty checklist, compatible with `reviewToProvenance`. */
  review: ImportReviewItem[]
  /** Informational source-date flags, indexed to the parsed broker account row. */
  /** Optional on the published contract: pre-WS5 delta constructors keep compiling. */
  dateFlags?: RefreshSourceDateFlag[]
  /**
   * Exact-cent file/plan totals for checking this refresh before it is applied.
   *
   * `buildRefreshDelta` always supplies this, but it remains optional at the
   * published boundary so callers written before reconciliation was added can
   * continue to construct a delta.
   */
  reconciliation?: RefreshReconciliation
  /**
   * The effective protected set this delta was built with — the union of the
   * classification's `protectedPaths`, any `protectedTargets` passed to
   * `buildRefreshDelta`, and every `isProtected` candidate's `targetPath`.
   * `applyRefresh` unions this with its own `protectedTargets`, so protection
   * supplied at classify or build time survives an apply handed nothing.
   */
  protectedPaths: readonly string[]
}

export interface ClassifyRefreshOptions {
  /** Plan paths (`accounts[i]` or `accounts[i].balance`) the refresh must not write. */
  protectedTargets?: ReadonlySet<string>
  /** Manual assignments remembered by normalized broker label for this plan. */
  rememberedMappings?: ReadonlyMap<string, string>
  /** Broker id scoping the remembered-mapping keys (see refreshMappingKey). */
  broker?: string
}

export type RefreshSourceDateFlag =
  | { sourceIndex: number; kind: 'staleDate'; ageDays: number }
  | { sourceIndex: number; kind: 'unknownDate'; ageDays: null }

export interface RefreshReconciliation {
  /** Sum of every parsed account total in the file. */
  fileTotal: number
  /** Sum of parsed totals whose rows will actually be applied. */
  matchedTotal: number
  /** File total not represented by an applied row (including unassigned/blocked rows). */
  unmatchedRemainder: number
  /** Sum of all balance-updatable plan accounts before the previewed writes. */
  planTotalBefore: number
  /** Same plan-side aggregate after the previewed writes. */
  planTotalAfter: number
}

export interface RefreshSnapshotAccountValues {
  balance: number
  costBasis: number | null
}

export interface RefreshSnapshotChange {
  accountId: string
  accountName: string
  before: RefreshSnapshotAccountValues
  after: RefreshSnapshotAccountValues
}

/** A local operational undo point; this never becomes part of the plan file. */
export interface RefreshSnapshot {
  id: string
  planId: string
  appliedAtIso: string
  sourceLabel: string
  sourceSha256: string
  changes: RefreshSnapshotChange[]
}

/** Caller-supplied operational metadata keeps snapshot construction deterministic. */
export interface RefreshSnapshotMeta {
  id: string
  appliedAtIso: string
  sourceLabel: string
  sourceSha256: string
}

export interface RevertRefreshSnapshotResult {
  plan: Plan
  /** Snapshot account ids absent (or no longer balance-updatable) in this plan. */
  skippedAccountIds: string[]
}

const EMPTY_PROTECTED: ReadonlySet<string> = new Set()

/**
 * The shared tail of both normalizers: the Unicode-aware collapse in
 * `labelNormalize.ts` (letters and digits survive, everything else folds to
 * a space, runs squeeze to one and trim). Digits survive — they are name
 * content ("401k", "529") — and so do non-ASCII letters ("Épargne" stays
 * "épargne", not the ASCII-only filter's "pargne"). Callers lowercase (and,
 * for labels, strip account-number masks) before handing text in;
 * `normalizeUnicodeText` also lowercases, so that is redundant but harmless.
 */
const collapseText = (s: string): string => normalizeUnicodeText(s)

/**
 * Lowercase a broker file label and strip the broker's own account-number mask
 * (`...789`, `(Z12345678)`) plus punctuation, leaving the human words a
 * plan-account name can match against. Digits OUTSIDE a mask are kept — they
 * are name content ("401k", "529"), not account numbers. A purely numeric
 * label (a Vanguard raw account number) is all-mask and normalizes to the
 * empty string, matching nothing — the user assigns it by hand, exactly as
 * the panel's original heuristic did.
 */
export function normalizeBrokerAccountLabel(raw: string): string {
  const unmasked = raw
    .toLowerCase()
    .replace(/\.\.\.\s*\w+/g, ' ') // Schwab/Fidelity trailing "...789" mask
    // Parenthesized ACCOUNT NUMBERS only ("(Z12345678)", "(...4321)") — a
    // digit-heavy group is a mask; a descriptive one ("(Joint)") is name
    // content whose parens the punctuation pass strips while keeping the word.
    .replace(/\(([^)]*)\)/g, (whole, inner: string) =>
      (inner.match(/\d/g) ?? []).length >= 4 ? ' ' : whole,
    )
    .replace(/\b[a-z]?\d{4,}\b/g, ' ') // bare long account numbers (Vanguard rows)
  const collapsed = collapseText(unmasked) // punctuation only — short digit runs are name content
  // A label that is ONLY an account number (Vanguard) collapses to nothing,
  // which would make remembered-mapping keys empty and the feature inert for
  // that broker; fall back to the collapsed raw label as the stable key.
  return collapsed !== '' ? collapsed : collapseText(raw.toLowerCase())
}

/**
 * Stable key for remembered manual mappings. Unlike match normalization this
 * KEEPS masked account digits ("...789") and prefixes the broker, so two
 * accounts sharing a descriptive label — or two brokers reusing one — cannot
 * collide onto the same remembered assignment.
 */
export function refreshMappingKey(broker: string, rawLabel: string): string {
  return `${broker}:${collapseText(rawLabel.toLowerCase())}`
}

/** Lowercase a PLAN account name: punctuation goes, digits stay ("401k", "529"). */
function normalizeName(raw: string): string {
  return collapseText(raw.toLowerCase())
}

/**
 * Account-type *category* words: shared across subtypes, so a match on one of
 * these alone ("IRA" between a Roth IRA and a Rollover IRA, "brokerage" between
 * an individual and a joint account) proves only the family, never which
 * specific account. A lone hit on nothing but these is deliberately NOT promoted
 * to `'likely'` (which defaults ON) — it grades as a `'weak'` tier and lands as
 * `'ambiguous'` (default OFF). Without this a returning user whose plan holds a
 * Rollover IRA, importing a file that lists a Roth IRA, would be silently shown
 * "overwrite your Rollover IRA with the Roth number" pre-selected on.
 */
const GENERIC_WORDS: ReadonlySet<string> = new Set([
  'ira',
  'account',
  'retirement',
  'investment',
  'brokerage',
  'savings',
  'trust',
])

/**
 * The formalization of the panel's original `guessTarget`: a plan account is a
 * `'strong'` match when its whole normalized name is a substring of the file
 * label, a `'fuzzy'` match when a *distinctive* word (length > 2, not an
 * account-type category word) of its name is, and a `'weak'` match when only a
 * shared category word ("IRA") is. Distinctive words match on whole-word
 * boundaries (not substrings), so "Tax" no longer matches "Taxable"; the weak
 * tier only ever *demotes* a former lone-`'ira'` `'likely'` to default-off
 * `'ambiguous'`.
 */
type MatchTier = 'strong' | 'remembered' | 'fuzzy' | 'weak'

/** Match tiers, strongest first — the order candidates are ranked in. */
const TIER_ORDER: readonly MatchTier[] = ['strong', 'remembered', 'fuzzy', 'weak']

/** How a lone plausible match of each tier grades: whole-name → exact, distinctive word → likely, category word → ambiguous. */
const TIER_TO_KIND: Record<MatchTier, RefreshMatchKind> = {
  strong: 'exact',
  remembered: 'remembered',
  fuzzy: 'likely',
  weak: 'ambiguous',
}

function containsWholeWords(sourceNorm: string, phraseNorm: string): boolean {
  return ` ${sourceNorm} `.includes(` ${phraseNorm} `)
}

function matchStrength(sourceNorm: string, nameNorm: string): MatchTier | null {
  if (nameNorm === '' || sourceNorm === '') return null
  // Label-equals-name (after mask stripping) is the surest match there is,
  // generic or not — "Brokerage ...789" against an account named "Brokerage"
  // IS that account.
  if (sourceNorm === nameNorm) return 'strong'
  // A mere substring hit takes the word-tier guards: a name that is itself a
  // lone generic/short token ("IRA", "Savings", or a single stray letter)
  // inside a label carrying EXTRA words ("Roth IRA …") proves only the account
  // family — the row describes something more specific than the name, so it
  // must not be promoted past 'weak' (default OFF).
  if (containsWholeWords(sourceNorm, nameNorm)) {
    const distinctive = nameNorm.length > 2 && !GENERIC_WORDS.has(nameNorm)
    return distinctive ? 'strong' : 'weak'
  }
  const sourceWords = new Set(sourceNorm.split(' '))
  const hits = nameNorm.split(' ').filter((w) => w.length > 2 && sourceWords.has(w))
  if (hits.length === 0) return null
  return hits.some((w) => !GENERIC_WORDS.has(w)) ? 'fuzzy' : 'weak'
}

interface UpdatableRef {
  id: string
  /** Full-array index into `plan.accounts` (the `accounts[i]` path convention). */
  index: number
  nameNorm: string
}

function classifyOne(
  source: BrokerAccountBalance,
  updatable: UpdatableRef[],
  protectedTargets: ReadonlySet<string>,
  rememberedMappings: ReadonlyMap<string, string>,
  broker?: string,
): RefreshCandidate {
  const sourceNorm = normalizeBrokerAccountLabel(source.accountLabel)
  // Grade every updatable account once, then rank strong→fuzzy→weak (keeping the
  // plan's account order within a tier). The first entry is the primary guess;
  // the rest are the plausible runners-up.
  const byAccountId = new Map(
    updatable
      .map((ref) => ({ ref, tier: matchStrength(sourceNorm, ref.nameNorm) }))
      .filter((g): g is { ref: UpdatableRef; tier: MatchTier } => g.tier !== null)
      .map((g) => [g.ref.id, g] as const),
  )
  // Identity-preserving key first (broker-scoped, masks kept); the bare
  // normalized label remains the compatibility lookup for callers without a
  // broker context.
  const rememberedAccountId =
    (broker !== undefined ? rememberedMappings.get(refreshMappingKey(broker, source.accountLabel)) : undefined) ??
    rememberedMappings.get(sourceNorm)
  const remembered = rememberedAccountId ? updatable.find((ref) => ref.id === rememberedAccountId) : undefined
  if (remembered) {
    const existing = byAccountId.get(remembered.id)
    if (!existing || TIER_ORDER.indexOf('remembered') < TIER_ORDER.indexOf(existing.tier)) {
      byAccountId.set(remembered.id, { ref: remembered, tier: 'remembered' })
    }
  }
  const graded = [...byAccountId.values()]
  const plausible = TIER_ORDER.flatMap((tier) => graded.filter((g) => g.tier === tier))

  if (plausible.length === 0) {
    return { source, targetAccountId: null, targetPath: null, match: 'unmatched', alternativeAccountIds: [], isProtected: false }
  }

  // One plausible match grades by its tier: a whole-name hit is 'exact', a
  // distinctive word 'likely', and a lone *category-word-only* hit ("IRA" onto
  // the plan's only IRA) is 'ambiguous' — genuinely uncertain, so default OFF,
  // even with no competitor in this plan. More than one plausible account is
  // 'ambiguous' outright: a shared category word is enough to make a second one
  // plausible, so refuse to guess between them. Either way the primary is the
  // top-ranked account, still filled so the user can confirm with one click; the
  // runners-up are the false-positive audit trail.
  const primary = plausible[0]!.ref
  const primaryTier = plausible[0]!.tier
  // A remembered manual assignment is intentionally decisive over lower
  // word-only guesses: the user already chose this destination on a prior
  // applied refresh. A whole-name hit still ranks above it and keeps the
  // existing ambiguity guard if the file appears to name more than one account.
  const match: RefreshMatchKind =
    primaryTier === 'remembered' ? 'remembered' : plausible.length > 1 ? 'ambiguous' : TIER_TO_KIND[primaryTier]
  const alternatives = match === 'remembered' ? [] : plausible.slice(1).map((g) => g.ref.id)

  const targetPath = `accounts[${primary.index}]`
  return {
    source,
    targetAccountId: primary.id,
    targetPath,
    match,
    alternativeAccountIds: alternatives,
    isProtected: isProtectedPath(targetPath, protectedTargets),
  }
}

/**
 * Match every parsed broker account to a plan account, over the balance-
 * updatable accounts only (property, debt, pension, annuity are never a refresh
 * target). `exact`/`likely` are safe to default ON; `ambiguous`/`unmatched` and
 * any `isProtected` candidate must default OFF — a caller drives that policy.
 *
 * Returns a `RefreshClassification`: the candidates plus a faithful snapshot of
 * the protected-path set (`protectedPaths`, `[]` when none). The snapshot travels
 * into `buildRefreshDelta` so protection supplied here alone still reaches apply,
 * even for a target the user later reassigns by hand.
 */
export function classifyRefresh(
  plan: Plan,
  accounts: BrokerAccountBalance[],
  opts: ClassifyRefreshOptions = {},
): RefreshClassification {
  const protectedTargets = opts.protectedTargets ?? EMPTY_PROTECTED
  const rememberedMappings = opts.rememberedMappings ?? new Map<string, string>()
  const updatable: UpdatableRef[] = plan.accounts
    .map((account, index) => ({ account, index }))
    .filter(({ account }) => isBalanceUpdatable(account))
    .map(({ account, index }) => ({ id: account.id, index, nameNorm: normalizeName(account.name) }))
  const candidates = accounts.map((source) => classifyOne(source, updatable, protectedTargets, rememberedMappings, opts.broker))
  return { candidates, protectedPaths: [...protectedTargets] }
}

interface RefreshWrite {
  accountIndex: number
  source: BrokerAccountBalance
}

/**
 * The EFFECTIVE protected set `buildRefreshDelta` enforces: the union of the
 * classification's `protectedPaths` snapshot, any `protectedTargets` passed to
 * build, and the `targetPath` of every candidate already classified `isProtected`
 * (redundant once the classification snapshot is folded in, but harmless). The
 * result is snapshotted onto `RefreshDelta.protectedPaths`, so apply can honour a
 * classify- or build-time protection whose set the caller omitted at apply.
 */
function buildEffectiveProtected(
  classification: RefreshClassification,
  protectedTargets: ReadonlySet<string>,
): Set<string> {
  const effective = new Set<string>(classification.protectedPaths)
  for (const p of protectedTargets) effective.add(p)
  for (const c of classification.candidates) {
    if (c.isProtected && c.targetPath) effective.add(c.targetPath)
  }
  return effective
}

/** The plan-account ids blocked by a duplicate collision — one derivation for preview and apply. */
function blockedAccountIds(groups: readonly RefreshDuplicateGroup[]): Set<string> {
  return new Set(groups.map((g) => g.accountId))
}

/**
 * Selected rows that resolve to a real, updatable account, minus duplicate
 * collisions and protected targets. Protection is enforced HERE and only here,
 * as one `isProtectedPath` check of the actually-chosen account against the
 * pre-computed `effective` set (`effectiveProtected`) — no separate belt on the
 * candidate's classify-time target, because that target is already folded into
 * `effective`.
 */
function computeWrites(
  accounts: Account[],
  candidates: RefreshCandidate[],
  selection: ReadonlyMap<number, string>,
  effective: ReadonlySet<string>,
  blockedIds: ReadonlySet<string>,
): RefreshWrite[] {
  const writes: RefreshWrite[] = []
  candidates.forEach((candidate, i) => {
    const chosenId = selection.get(i)
    if (!chosenId) return
    if (blockedIds.has(chosenId)) return // duplicate collision — never auto-merge
    const accountIndex = accounts.findIndex((a) => a.id === chosenId)
    if (accountIndex === -1) return
    if (!isBalanceUpdatable(accounts[accountIndex]!)) return
    if (isProtectedPath(`accounts[${accountIndex}]`, effective)) return
    writes.push({ accountIndex, source: candidate.source })
  })
  return writes
}

/**
 * The single write primitive, shared by the preview clone and the real apply so
 * the two structurally cannot diverge. It writes ONLY `balance` (and, where
 * `applyBrokerBalance` produced one, `costBasis`) in place — the account object,
 * and therefore every strategy field on it, is otherwise untouched. The values
 * are `applyBrokerBalance`'s, not this module's: clamping and the taxable-only
 * basis rule live there and are never re-implemented here.
 */
function applyWrites(accounts: Account[], writes: RefreshWrite[]): number {
  for (const { accountIndex, source } of writes) {
    const account = accounts[accountIndex]!
    const next = applyBrokerBalance(account, source)
    // `applyBrokerBalance` returns a fresh {...account, balance, costBasis?};
    // copy back only the two fields it is allowed to name, in place.
    if ('balance' in account && 'balance' in next) account.balance = next.balance
    if ('costBasis' in next && 'costBasis' in account && next.costBasis !== account.costBasis) {
      account.costBasis = next.costBasis
    }
  }
  return writes.length
}

function computeDuplicateGroups(
  accounts: Account[],
  candidates: RefreshCandidate[],
  selection: ReadonlyMap<number, string>,
): RefreshDuplicateGroup[] {
  const byAccount = new Map<string, number[]>()
  candidates.forEach((_candidate, i) => {
    const chosenId = selection.get(i)
    if (!chosenId) return
    if (!accounts.some((a) => a.id === chosenId)) return
    const arr = byAccount.get(chosenId) ?? []
    arr.push(i)
    byAccount.set(chosenId, arr)
  })
  const groups: RefreshDuplicateGroup[] = []
  for (const [accountId, sourceIndexes] of byAccount) {
    if (sourceIndexes.length > 1) groups.push({ accountId, sourceIndexes })
  }
  return groups
}

// Reconciliation strings are exact to the cent; whole-dollar rounding would
// print a real one-cent remainder as $0.
function moneyCents(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/** The refresh has no per-row source location — the file parser's own review carries that. */
function aggregateLocator(note: string): SourceLocator {
  return { kind: 'none', note }
}

function cents(value: number): number {
  return Math.round(value * 100)
}

function fromCents(value: number): number {
  return value / 100
}

function sumCents(values: Iterable<number>): number {
  let total = 0
  for (const value of values) total += cents(value)
  return fromCents(total)
}

function isoCalendarDay(iso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1) return null
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day > daysInMonth) return null
  return Date.UTC(year, month - 1, day)
}

function sourceDateFlags(candidates: readonly RefreshCandidate[], now: Date): RefreshSourceDateFlag[] {
  // The broker's as-of value is a naive calendar date and the user's "today"
  // is their local day; comparing against the UTC day would flag a file one
  // day early for any timezone behind UTC.
  const nowDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const flags: RefreshSourceDateFlag[] = []
  candidates.forEach((candidate, sourceIndex) => {
    const sourceDay = candidate.source.asOfIso == null ? null : isoCalendarDay(candidate.source.asOfIso)
    if (sourceDay === null) {
      flags.push({ sourceIndex, kind: 'unknownDate', ageDays: null })
      return
    }
    const ageDays = Math.floor((nowDay - sourceDay) / 86_400_000)
    if (ageDays > 7) flags.push({ sourceIndex, kind: 'staleDate', ageDays })
  })
  return flags
}

function reconciliationFor(
  beforeAccounts: readonly Account[],
  afterAccounts: readonly Account[],
  candidates: readonly RefreshCandidate[],
  writes: readonly RefreshWrite[],
): RefreshReconciliation {
  const fileTotal = sumCents(candidates.map((candidate) => candidate.source.totalValue))
  const matchedTotal = sumCents(writes.map((write) => write.source.totalValue))
  return {
    fileTotal,
    matchedTotal,
    // Subtract as integer cents so this invariant survives binary floating-point.
    unmatchedRemainder: fromCents(cents(fileTotal) - cents(matchedTotal)),
    planTotalBefore: sumCents(beforeAccounts.filter(isBalanceUpdatable).map((account) => account.balance)),
    planTotalAfter: sumCents(afterAccounts.filter(isBalanceUpdatable).map((account) => account.balance)),
  }
}

function reconciliationReview(
  candidates: readonly RefreshCandidate[],
  reconciliation: RefreshReconciliation,
): ImportReviewItem {
  const from = candidates.map((candidate) => aggregateLocator(`parsed account total for ${candidate.source.accountLabel}`))
  return {
    status: 'mapped',
    source: 'Refresh reconciliation',
    detail:
      `File total ${moneyCents(reconciliation.fileTotal)}; matched total ${moneyCents(reconciliation.matchedTotal)}; ` +
      `unmatched remainder ${moneyCents(reconciliation.unmatchedRemainder)}; plan balances ${moneyCents(reconciliation.planTotalBefore)} to ${moneyCents(reconciliation.planTotalAfter)}.`,
    locator:
      from.length > 0
        ? { kind: 'derived', from, note: 'summed parsed account totals and previewed plan balances' }
        : aggregateLocator('no parsed broker account totals'),
    confidence: 'derived',
  }
}

function dateFlagReview(candidate: RefreshCandidate, flag: RefreshSourceDateFlag): ImportReviewItem {
  return {
    // The balance can still land. `defaulted` is the checklist's existing
    // informational "Assumed, review" status; `skipped` would incorrectly put
    // this warning in the unresolved/import-did-not-land bucket.
    status: 'defaulted',
    source: candidate.source.accountLabel,
    detail:
      flag.kind === 'staleDate'
        ? `This balance is dated ${candidate.source.asOfIso} — ${flag.ageDays} days ago; review it before applying. The flag does not block refresh.`
        : 'The broker file did not carry a readable as-of date; review this balance before applying it. The flag does not block refresh.',
    locator: aggregateLocator(flag.kind === 'staleDate' ? `broker as-of date ${candidate.source.asOfIso}` : 'broker as-of date unavailable'),
    confidence: 'assumed',
  }
}

/**
 * Preview a refresh without touching the plan: the exact field writes the
 * `selection` would apply (computed by running `applyBrokerBalance` on a CLONE,
 * so the preview cannot diverge from apply), the accounts going stale, the
 * selected collisions that block apply, and an honesty checklist. `selection`
 * maps a candidate index to the chosen plan-account id; an absent or empty
 * entry means "don't update".
 */
export function buildRefreshDelta(
  plan: Plan,
  classification: RefreshClassification,
  selection: ReadonlyMap<number, string>,
  protectedTargets: ReadonlySet<string> = EMPTY_PROTECTED,
  now: () => Date = () => new Date(),
): RefreshDelta {
  const { candidates } = classification
  const duplicateGroups = computeDuplicateGroups(plan.accounts, candidates, selection)
  const blockedIds =
    // A collision blocks the ENTIRE apply (applyRefresh is a full no-op), so
    // the preview must not claim any write will land — block every selected
    // account, not just the colliding ones, and the changes list goes empty.
    duplicateGroups.length > 0 ? new Set(selection.values()) : blockedAccountIds(duplicateGroups)
  const effective = buildEffectiveProtected(classification, protectedTargets)

  // A shallow copy per account is sufficient: applyWrites only assigns the
  // top-level `balance`/`costBasis` primitives, and the refresh never reaches
  // into an account's nested strategy objects (allocation, schedule, …), so
  // those stay shared with — and byte-identical to — the live plan.
  const clone = plan.accounts.map((a) => ({ ...a }))
  const writes = computeWrites(clone, candidates, selection, effective, blockedIds)

  // Capture before-values from the untouched clone, then apply on it.
  const before = new Map<number, { balance: number; costBasis?: number }>()
  for (const { accountIndex } of writes) {
    const a = clone[accountIndex]!
    before.set(accountIndex, { balance: 'balance' in a ? a.balance : 0, costBasis: 'costBasis' in a ? a.costBasis : undefined })
  }
  applyWrites(clone, writes)

  const changes: RefreshFieldDelta[] = []
  const review: ImportReviewItem[] = []
  const dateFlags = sourceDateFlags(candidates, now())
  for (const { accountIndex, source } of writes) {
    const b = before.get(accountIndex)!
    const after = clone[accountIndex]!
    const path = `accounts[${accountIndex}]`
    const afterBalance = 'balance' in after ? after.balance : 0
    changes.push({
      path: `${path}.balance`,
      field: 'balance',
      before: b.balance,
      after: afterBalance,
      clamped: source.totalValue < 0,
    })
    // Whether basis moves is `applyBrokerBalance`'s decision — the taxable/
    // equityComp + non-null rule lives there alone. Here we simply read the
    // basis it wrote onto the clone and diff it against the before-value: a
    // moved basis is a change, and a basis the file re-supplied unchanged is
    // still recorded (its `costBasis !== null` says the file carried one). A
    // Vanguard (null-basis) refresh leaves the clone's basis equal to before,
    // so it emits nothing; an account type with no basis field has none to diff.
    const afterBasis = 'costBasis' in after ? after.costBasis : undefined
    const basisAfter =
      b.costBasis !== undefined && afterBasis !== undefined && (afterBasis !== b.costBasis || source.costBasis !== null)
        ? afterBasis
        : null
    if (basisAfter !== null) {
      changes.push({
        path: `${path}.costBasis`,
        field: 'costBasis',
        before: b.costBasis!,
        after: basisAfter,
        clamped: source.costBasis !== null && source.costBasis < 0,
      })
    }
    review.push({
      status: 'mapped',
      source: source.accountLabel,
      detail:
        basisAfter !== null
          ? `Refreshed the balance to ${money(afterBalance)} and cost basis to ${money(basisAfter)} from the broker file.`
          : `Refreshed the balance to ${money(afterBalance)} from the broker file.`,
      // No per-row locator survives the aggregate — the file import's own review
      // holds the row detail. A multi-position total is summed and grades
      // 'derived'; a lone position is read verbatim and grades 'exact', so its
      // note must not claim a summation that never happened. (brokerCsv words the
      // multi-position case "summed position market values"; stay consistent.)
      locator: aggregateLocator(
        source.positionCount > 1
          ? 'balance summed from the broker positions file'
          : 'balance read from the single broker position',
      ),
      // A clamped value (negative total/basis floored to $0) was transformed,
      // not copied — it grades 'derived' even for a lone position.
      confidence:
        source.positionCount > 1 || source.totalValue < 0 || (source.costBasis !== null && source.costBasis < 0)
          ? 'derived'
          : 'exact',
      target: path,
    })
    if (source.costBasis !== null && after.type !== 'taxable' && after.type !== 'equityComp') {
      review.push({
        status: 'unmapped',
        source: source.accountLabel,
        detail: `The file's ${money(source.costBasis)} cost basis was not written to ${after.name}; basis refresh applies only to taxable and equity-comp accounts.`,
        locator: aggregateLocator('cost basis is not modeled for this plan account type'),
        confidence: 'unmapped',
      })
    }
  }

  // Selected rows that were skipped, so the report says why nothing landed.
  candidates.forEach((candidate, i) => {
    const chosenId = selection.get(i)
    if (!chosenId) return
    const accountIndex = plan.accounts.findIndex((a) => a.id === chosenId)
    if (accountIndex === -1) return
    if (isProtectedPath(`accounts[${accountIndex}]`, effective)) {
      review.push({
        status: 'skipped',
        source: candidate.source.accountLabel,
        detail: 'This plan account is protected, so the refresh left its balance unchanged.',
        locator: aggregateLocator('target account is protected from refresh'),
        confidence: 'unmapped',
      })
    } else if (blockedIds.has(chosenId)) {
      review.push({
        status: 'skipped',
        source: candidate.source.accountLabel,
        detail:
          'More than one file account is assigned to this plan account, so neither was applied. Assign each plan account at most once.',
        locator: aggregateLocator('duplicate target, refresh blocked'),
        confidence: 'unmapped',
      })
    }
  })

  // Stale = an updatable plan account this refresh will not touch: no file row
  // matched it by classification (best guess or an alternative) AND — crucially —
  // no selected row is being written to it. Reconciling against the actual
  // `writes` is what keeps "stale accounts are listed but never modified" true
  // even when a user hand-points a row at an account nothing matched: such an
  // account is being modified, so it is no longer reported as going stale.
  const matched = new Set<string>()
  for (const c of candidates) {
    if (c.targetAccountId) matched.add(c.targetAccountId)
    for (const alt of c.alternativeAccountIds) matched.add(alt)
  }
  const written = new Set(writes.map((w) => clone[w.accountIndex]!.id))
  const staleAccountIds = plan.accounts
    .filter(isBalanceUpdatable)
    .filter((a) => !matched.has(a.id) && !written.has(a.id))
    .map((a) => a.id)

  const reconciliation = reconciliationFor(plan.accounts, clone, candidates, writes)
  review.push(reconciliationReview(candidates, reconciliation))
  for (const flag of dateFlags) review.push(dateFlagReview(candidates[flag.sourceIndex]!, flag))

  return {
    candidates,
    changes,
    staleAccountIds,
    duplicateGroups,
    review,
    dateFlags,
    reconciliation,
    protectedPaths: [...effective],
  }
}

function accountIndexForRefreshPath(path: string): number | null {
  const match = /^accounts\[(\d+)\]\.(balance|costBasis)$/.exec(path)
  if (!match) return null
  const index = Number(match[1])
  return Number.isSafeInteger(index) ? index : null
}

function snapshotCostBasis(account: Account): number | null {
  return account.type === 'taxable' || account.type === 'equityComp' ? account.costBasis : null
}

/**
 * Build the durable, local-only undo record for a previewed refresh. The
 * caller supplies id/time/source metadata, so this is pure and can be used by
 * non-browser hosts as well as the panel.
 */
export function captureRefreshSnapshot(
  plan: Plan,
  deltas: RefreshDelta | readonly RefreshFieldDelta[],
  meta: RefreshSnapshotMeta,
): RefreshSnapshot {
  // 'in' narrowing: Array.isArray does not narrow the readonly-array union.
  const changes: readonly RefreshFieldDelta[] = 'changes' in deltas ? deltas.changes : deltas
  const byAccountIndex = new Map<number, { balance?: RefreshFieldDelta; costBasis?: RefreshFieldDelta }>()
  for (const delta of changes) {
    const index = accountIndexForRefreshPath(delta.path)
    if (index === null) continue
    if (delta.field === 'balance') {
      const entry = byAccountIndex.get(index)
      byAccountIndex.set(index, { ...entry, balance: delta })
    } else if (delta.field === 'costBasis') {
      const entry = byAccountIndex.get(index)
      byAccountIndex.set(index, { ...entry, costBasis: delta })
    }
  }

  const snapshotChanges: RefreshSnapshotChange[] = []
  for (const [index, deltasForAccount] of byAccountIndex) {
    const account = plan.accounts[index]
    if (!account || !isBalanceUpdatable(account) || !deltasForAccount.balance) continue
    const existingBasis = snapshotCostBasis(account)
    snapshotChanges.push({
      accountId: account.id,
      accountName: account.name,
      before: {
        balance: deltasForAccount.balance.before,
        costBasis: deltasForAccount.costBasis?.before ?? existingBasis,
      },
      after: {
        balance: deltasForAccount.balance.after,
        costBasis: deltasForAccount.costBasis?.after ?? existingBasis,
      },
    })
  }
  return { planId: plan.id, ...meta, changes: snapshotChanges }
}

/**
 * Restore the pre-refresh balance/basis values from a durable snapshot without
 * mutating the supplied plan. Accounts deleted since the snapshot are reported
 * and otherwise ignored, so an old snapshot is always safe to inspect/apply.
 */
export function revertToSnapshot(plan: Plan, snapshot: RefreshSnapshot): RevertRefreshSnapshotResult {
  // A snapshot binds the plan it was captured from; applying one plan's
  // balances to another would be silent corruption, so every change is
  // reported skipped instead.
  if (snapshot.planId !== plan.id) {
    return { plan: structuredClone(plan), skippedAccountIds: snapshot.changes.map((change) => change.accountId) }
  }
  const reverted = structuredClone(plan)
  const skipped = new Set<string>()
  for (const change of snapshot.changes) {
    const account = reverted.accounts.find((candidate) => candidate.id === change.accountId)
    if (!account || !isBalanceUpdatable(account)) {
      skipped.add(change.accountId)
      continue
    }
    account.balance = change.before.balance
    if ((account.type === 'taxable' || account.type === 'equityComp') && change.before.costBasis !== null) {
      account.costBasis = change.before.costBasis
    }
  }
  return { plan: reverted, skippedAccountIds: [...skipped] }
}

/**
 * Apply a refresh to `draft` in place (for the `update((d) => …)` seam) and
 * return the number of accounts written. THE WS4 STRUCTURAL ACCEPTANCE: this
 * only ever writes `balance`/`costBasis` of selected, non-protected, non-
 * duplicate accounts, and it does so through the same `applyBrokerBalance`
 * primitive the preview used — it never assigns a whole account shape and never
 * touches any other collection. Protected targets are skipped entirely, not
 * partially applied. A non-empty `delta.duplicateGroups` blocks EVERYTHING: apply
 * writes nothing and returns 0, matching the panel, which disables its apply
 * button while any collision exists.
 *
 * The effective protected set is the union of `delta.protectedPaths` (which
 * already folds in the classification snapshot and build-time set) and any
 * `protectedTargets` passed here — so a protection supplied at classify or build
 * time is honoured even if apply is handed nothing.
 *
 * Contract: `delta` and `selection` must have been built together (the panel
 * recomputes the delta from the live selection each render). Duplicate
 * blocking reads `delta.duplicateGroups`, so a delta built from a different
 * selection would block against stale collisions.
 *
 * Paths supplied ONLY here (not at classify/build) are still honored — but the
 * previously built preview could not know about them, so apply may then skip
 * writes the preview showed. The divergence is one-directional by design:
 * apply can only ever write LESS than the preview, never more. Callers who
 * want the preview to match exactly must pass the same set at build time.
 */
export function applyRefresh(
  draft: Plan,
  delta: RefreshDelta,
  selection: ReadonlyMap<number, string>,
  protectedTargets: ReadonlySet<string> = EMPTY_PROTECTED,
): number {
  // A single selected collision blocks the entire apply — no partial writes.
  if (delta.duplicateGroups.length > 0) return 0
  const blockedIds = blockedAccountIds(delta.duplicateGroups)
  const effective = new Set<string>(delta.protectedPaths)
  for (const p of protectedTargets) effective.add(p)
  const writes = computeWrites(draft.accounts, delta.candidates, selection, effective, blockedIds)
  return applyWrites(draft.accounts, writes)
}
