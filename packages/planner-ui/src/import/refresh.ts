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
 * **`protectedTargets` is caller-supplied, enforced as one effective set.** A
 * path in this set (an account `accounts[i]` or one of its fields
 * `accounts[i].balance`) is off-limits to the refresh: it is classified but
 * defaults OFF and is skipped on apply, never partially written. Enforcement has
 * a single authority. Each operation computes an EFFECTIVE protected set —
 * `effectiveProtected` unions the caller's paths with the `targetPath` of every
 * candidate already classified `isProtected` — and `computeWrites` skips any
 * write whose chosen account falls in that set. That union is precisely what
 * keeps a classify-time-protected row skipped even when a caller threads the set
 * into `classifyRefresh` but omits it at apply: the row's own `targetPath`
 * carries the protection forward. The Pro repo feeds the set the WS2 intake
 * decisions in a later dispatch; the public planner panel passes none. This
 * module never invents a protected set of its own — the seam is the argument.
 */

import type { Account, Plan } from '@retiregolden/engine/model/plan'
import { applyBrokerBalance, isBalanceUpdatable, type BrokerAccountBalance } from './brokerCsv'
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
export type RefreshMatchKind = 'exact' | 'likely' | 'ambiguous' | 'unmatched'

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

/** Multiple selected file rows resolving to one plan account — a SUGGESTION that blocks apply. */
export interface RefreshDuplicateGroup {
  accountId: string
  /** Indexes into the candidates array whose selection points at this account. */
  sourceIndexes: number[]
}

/** The full preview of a refresh: what would change, what is stale, what collides. */
export interface RefreshDelta {
  candidates: RefreshCandidate[]
  /** The exact field writes an apply would perform, for the selected rows. */
  changes: RefreshFieldDelta[]
  /** Updatable plan accounts no file row matched — their balances are going stale. */
  staleAccountIds: string[]
  /** Selected collisions (never auto-merged); a non-empty list blocks apply. */
  duplicateGroups: RefreshDuplicateGroup[]
  /** Honesty checklist, compatible with `reviewToProvenance`. */
  review: ImportReviewItem[]
}

export interface ClassifyRefreshOptions {
  /** Plan paths (`accounts[i]` or `accounts[i].balance`) the refresh must not write. */
  protectedTargets?: ReadonlySet<string>
}

const EMPTY_PROTECTED: ReadonlySet<string> = new Set()

/**
 * The shared tail of both normalizers: drop everything that is not a lowercase
 * letter, digit, or space, then squeeze runs of whitespace to a single space and
 * trim. Digits survive — they are name content ("401k", "529"). Callers lowercase
 * (and, for labels, strip account-number masks) before handing text in.
 */
const collapseText = (s: string): string => s.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * Lowercase a broker file label and strip the broker's own account-number mask
 * (`...789`, `(Z12345678)`) plus punctuation, leaving the human words a
 * plan-account name can match against. Digits OUTSIDE a mask are kept — they
 * are name content ("401k", "529"), not account numbers. A purely numeric
 * label (a Vanguard raw account number) is all-mask and normalizes to the
 * empty string, matching nothing — the user assigns it by hand, exactly as
 * the panel's original heuristic did.
 */
function normalizeLabel(raw: string): string {
  const unmasked = raw
    .toLowerCase()
    .replace(/\.\.\.\s*\w+/g, ' ') // Schwab/Fidelity trailing "...789" mask
    .replace(/\([^)]*\)/g, ' ') // parenthesized account number "(Z12345678)"
    .replace(/\b[a-z]?\d{4,}\b/g, ' ') // bare long account numbers (Vanguard rows)
  return collapseText(unmasked) // punctuation only — short digit runs are name content
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
 * shared category word ("IRA") is. Preserving `includes` (not word-boundary)
 * keeps this a superset of the old heuristic for the distinctive words, so no
 * confident guess the panel used to make regresses; the weak tier only ever
 * *demotes* a former lone-`'ira'` `'likely'` to default-off `'ambiguous'`.
 */
type MatchTier = 'strong' | 'fuzzy' | 'weak'

/** Match tiers, strongest first — the order candidates are ranked in. */
const TIER_ORDER: readonly MatchTier[] = ['strong', 'fuzzy', 'weak']

/** How a lone plausible match of each tier grades: whole-name → exact, distinctive word → likely, category word → ambiguous. */
const TIER_TO_KIND: Record<MatchTier, RefreshMatchKind> = { strong: 'exact', fuzzy: 'likely', weak: 'ambiguous' }

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
  if (sourceNorm.includes(nameNorm)) {
    const distinctive = nameNorm.length > 2 && !GENERIC_WORDS.has(nameNorm)
    return distinctive ? 'strong' : 'weak'
  }
  const hits = nameNorm.split(' ').filter((w) => w.length > 2 && sourceNorm.includes(w))
  if (hits.length === 0) return null
  return hits.some((w) => !GENERIC_WORDS.has(w)) ? 'fuzzy' : 'weak'
}

function isProtectedPath(targetPath: string, protectedTargets: ReadonlySet<string>): boolean {
  if (protectedTargets.size === 0) return false
  for (const p of protectedTargets) {
    // The account itself, a protected field OF the account, or a protected
    // ancestor of it — any of the three puts this target off-limits.
    if (p === targetPath || p.startsWith(`${targetPath}.`) || targetPath.startsWith(`${p}.`)) return true
  }
  return false
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
): RefreshCandidate {
  const sourceNorm = normalizeLabel(source.accountLabel)
  // Grade every updatable account once, then rank strong→fuzzy→weak (keeping the
  // plan's account order within a tier). The first entry is the primary guess;
  // the rest are the plausible runners-up.
  const graded = updatable
    .map((ref) => ({ ref, tier: matchStrength(sourceNorm, ref.nameNorm) }))
    .filter((g): g is { ref: UpdatableRef; tier: MatchTier } => g.tier !== null)
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
  const match: RefreshMatchKind = plausible.length > 1 ? 'ambiguous' : TIER_TO_KIND[plausible[0]!.tier]
  const alternatives = plausible.slice(1).map((g) => g.ref.id)

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
 */
export function classifyRefresh(
  plan: Plan,
  accounts: BrokerAccountBalance[],
  opts: ClassifyRefreshOptions = {},
): RefreshCandidate[] {
  const protectedTargets = opts.protectedTargets ?? EMPTY_PROTECTED
  const updatable: UpdatableRef[] = plan.accounts
    .map((account, index) => ({ account, index }))
    .filter(({ account }) => isBalanceUpdatable(account))
    .map(({ account, index }) => ({ id: account.id, index, nameNorm: normalizeName(account.name) }))
  return accounts.map((source) => classifyOne(source, updatable, protectedTargets))
}

interface RefreshWrite {
  accountIndex: number
  source: BrokerAccountBalance
}

/**
 * The EFFECTIVE protected set for one operation: the caller's paths unioned with
 * the `targetPath` of every candidate already classified `isProtected`. Computing
 * it once — in both `buildRefreshDelta` and `applyRefresh` — is what lets
 * `computeWrites` enforce protection in a single place while still honouring a
 * classify-time protection whose set the caller omitted at apply.
 */
function effectiveProtected(
  candidates: RefreshCandidate[],
  protectedTargets: ReadonlySet<string>,
): ReadonlySet<string> {
  const effective = new Set(protectedTargets)
  for (const c of candidates) {
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

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/** The refresh has no per-row source location — the file parser's own review carries that. */
function aggregateLocator(note: string): SourceLocator {
  return { kind: 'none', note }
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
  candidates: RefreshCandidate[],
  selection: ReadonlyMap<number, string>,
  protectedTargets: ReadonlySet<string> = EMPTY_PROTECTED,
): RefreshDelta {
  const duplicateGroups = computeDuplicateGroups(plan.accounts, candidates, selection)
  const blockedIds = blockedAccountIds(duplicateGroups)
  const effective = effectiveProtected(candidates, protectedTargets)

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
      // holds the row detail. A summed total is 'derived'; a lone position is verbatim.
      locator: aggregateLocator('balance summed from the broker positions file'),
      confidence: source.positionCount > 1 ? 'derived' : 'exact',
      target: path,
    })
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
          'More than one file account is assigned to this plan account, so neither was applied — assign each plan account at most once.',
        locator: aggregateLocator('duplicate target — refresh blocked'),
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

  return { candidates, changes, staleAccountIds, duplicateGroups, review }
}

/**
 * Apply a refresh to `draft` in place (for the `update((d) => …)` seam) and
 * return the number of accounts written. THE WS4 STRUCTURAL ACCEPTANCE: this
 * only ever writes `balance`/`costBasis` of selected, non-protected, non-
 * duplicate accounts, and it does so through the same `applyBrokerBalance`
 * primitive the preview used — it never assigns a whole account shape and never
 * touches any other collection. Protected and duplicate-collision targets are
 * skipped entirely, not partially applied.
 *
 * Contract: `delta` and `selection` must have been built together (the panel
 * recomputes the delta from the live selection each render). Duplicate
 * blocking reads `delta.duplicateGroups`, so a delta built from a different
 * selection would block against stale collisions.
 */
export function applyRefresh(
  draft: Plan,
  delta: RefreshDelta,
  selection: ReadonlyMap<number, string>,
  protectedTargets: ReadonlySet<string> = EMPTY_PROTECTED,
): number {
  const blockedIds = blockedAccountIds(delta.duplicateGroups)
  const effective = effectiveProtected(delta.candidates, protectedTargets)
  const writes = computeWrites(draft.accounts, delta.candidates, selection, effective, blockedIds)
  return applyWrites(draft.accounts, writes)
}
