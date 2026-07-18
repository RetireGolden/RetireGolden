/**
 * HouseholdGraph — a pure, deterministic topology selector over the Plan.
 *
 * Derives the one-page household picture (people, income sources, accounts,
 * property, debts, insurance, estate destinations, and the relationships
 * between them) directly from canonical plan data. The graph is a *reading*
 * of the plan, never a second source of truth:
 *
 *  - Amounts are the plan's own stored figures (balance, value, owed,
 *    annual/monthly amounts) tagged with an `amountKind` — the selector never
 *    computes derived dollars beyond exact sums of stored values.
 *  - Node ids are stable functions of plan entity ids, so layouts and tests
 *    survive unrelated plan edits.
 *  - Relationships the schema cannot express are listed honestly in
 *    `UNSUPPORTED_RELATIONSHIPS` — the graph never infers a legal
 *    relationship (estate destinations stay categorical, exactly as stored).
 *
 * @see DOCS/features/household-map.md (taxonomy audit + feature doc)
 */

import type { Account, IncomeStream, InsurancePolicy, Plan, TipsLadder } from '../model/plan.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HouseholdNodeKind =
  | 'person'
  | 'formerSpouse'
  | 'income'
  | 'guaranteedIncome'
  | 'account'
  | 'property'
  | 'debt'
  | 'insurance'
  | 'ladder'
  | 'estate'

/**
 * What a node's `amount` is. The graph stores plan figures verbatim; the
 * kind tells renderers how to caption them (per-month vs per-year vs a
 * balance) without any unit conversion here.
 */
export type HouseholdAmountKind =
  | 'balance'
  | 'value'
  | 'owed'
  | 'annualIncome'
  | 'oneTimeAmount'
  | 'monthlyBenefit'
  | 'deathBenefit'

/**
 * Semantic id of the planner surface where a node's data is edited. The UI
 * maps these to routes; the engine states only the surface identity.
 */
export type HouseholdEditSurface =
  | 'household'
  | 'socialSecurity'
  | 'accounts'
  | 'insurance'
  | 'income'
  | 'incomeFloor'

/**
 * 'complete' — nothing the schema could carry for this node is missing.
 * 'partial'  — the node works but named optional facts are absent (listed in
 *              `missing`), e.g. no estate destination on an account.
 * 'unknown'  — the node cannot be priced/estimated from what's entered
 *              (e.g. a Social Security stream with neither PIA nor earnings).
 */
export type HouseholdCompletenessState = 'complete' | 'partial' | 'unknown'

export interface HouseholdCompleteness {
  state: HouseholdCompletenessState
  /** Factual statements of absent schema facts. Empty iff state = 'complete'. */
  missing: string[]
}

/** Categorical estate destinations, exactly as the schema stores them. */
export type EstateDestinationId = 'spouse' | 'heir' | 'charity' | 'estate'

export interface HouseholdNode {
  /** Stable id derived from the plan entity id (see doc header). */
  id: string
  kind: HouseholdNodeKind
  /** Discriminant detail: account type, income type, insurance kind, estate destination, … */
  subtype: string
  /** The plan's own label/name for the entity. */
  label: string
  /** The stored plan figure for this node, or null when the plan carries none. */
  amount: number | null
  amountKind: HouseholdAmountKind | null
  /** Household people this node belongs to/covers ([] = household-level or n/a). */
  personIds: string[]
  /** Plan path this node was read from (provenance), e.g. `accounts[3]`. */
  source: string
  /** Planner surface where this item is edited (UI maps to a route). */
  editSurface: HouseholdEditSurface
  completeness: HouseholdCompleteness
  /**
   * Factual attachments the schema records on this entity that are not a
   * separate node (e.g. a property's HECM line of credit). Empty when none.
   */
  notes: string[]
}

export type HouseholdEdgeKind =
  | 'owns'
  | 'receives'
  | 'covers'
  | 'beneficiary'
  | 'survivor'
  | 'funds'
  | 'formerSpouseOf'

export interface HouseholdEdge {
  /** Stable id: `${kind}:${from}->${to}`. */
  id: string
  kind: HouseholdEdgeKind
  from: string
  to: string
  /** Short factual annotation ("50%", "joint", "2031"), when the schema has one. */
  label?: string
  /** True when this edge is one member's share of a jointly held item. */
  joint?: boolean
}

/**
 * Sums of *entered* values (stored balances/values), deliberately distinct
 * from the projection's simulated net worth. Reconciled against the report
 * model's accounts block (see householdGraphReconciliation.test.ts).
 */
export interface HouseholdGraphTotals {
  /** Cash + taxable + equity comp + traditional + Roth + HSA stored balances. */
  investable: number
  /** Stored property values. */
  property: number
  /** investable + property. */
  assets: number
  /** Stored debt balances. */
  liabilities: number
  /** assets − liabilities. */
  netWorth: number
}

export interface UnsupportedRelationship {
  id: string
  label: string
  detail: string
}

export interface HouseholdGraph {
  nodes: HouseholdNode[]
  edges: HouseholdEdge[]
  totals: HouseholdGraphTotals
  /** Relationship categories the plan schema cannot express (never inferred). */
  unsupported: readonly UnsupportedRelationship[]
}

// ---------------------------------------------------------------------------
// Unsupported relationships (mirrors the DOCS/features/household-map.md audit)
// ---------------------------------------------------------------------------

export const UNSUPPORTED_RELATIONSHIPS: readonly UnsupportedRelationship[] = [
  {
    id: 'dependents',
    label: 'Children and dependents',
    detail:
      'Dependents exist only as expense line items and a qualifying-dependent checkbox — not as people the map can show.',
  },
  {
    id: 'trusts-entities',
    label: 'Trusts, LLCs, and other entities',
    detail: 'Every account is owned by a household member or jointly; entity ownership is not modeled.',
  },
  {
    id: 'named-beneficiaries',
    label: 'Named beneficiaries outside the household',
    detail:
      'Estate destinations are categories (surviving spouse / non-spouse heirs / charity); only a life policy can name a person, and only a household member.',
  },
  {
    id: 'contingent-beneficiaries',
    label: 'Contingent beneficiaries and splits',
    detail: 'One destination per account (plus a charity percent); no primary-vs-contingent chains or per-heir splits.',
  },
  {
    id: 'household-size',
    label: 'More than two adults',
    detail: 'The plan models one or two adults.',
  },
  {
    id: 'partner-legal-relationship',
    label: 'Legal relationship between the two adults',
    detail: 'Only the tax filing status is recorded; an unmarried two-person household carries no relationship data.',
  },
  {
    id: 'former-spouses-as-people',
    label: 'Former spouses as people',
    detail:
      'Former spouses exist only as unnamed benefit-unlock records on a Social Security stream — no name, assets, or other links.',
  },
  {
    id: 'other-insurance',
    label: 'Term life, disability, and umbrella insurance',
    detail: 'Only long-term-care and permanent life policies are modeled; health coverage is an expense setting.',
  },
  {
    id: 'debt-collateral',
    label: 'Which property secures a debt',
    detail: 'Debts are standalone — a mortgage is not linked to the home it secures.',
  },
  {
    id: 'income-asset-linkage',
    label: 'Which asset produces an income stream',
    detail: 'Rental income is a recurring stream with no link to the property that produces it.',
  },
  {
    id: 'estate-documents',
    label: 'Wills, trust documents, and powers of attorney',
    detail: 'Estate documents are out of scope; the plan records no document status.',
  },
] as const

// ---------------------------------------------------------------------------
// Node id helpers (stable, derived from plan entity ids)
// ---------------------------------------------------------------------------

export function personNodeId(personId: string): string {
  return `person:${personId}`
}
export function accountNodeId(accountId: string): string {
  return `acct:${accountId}`
}
export function incomeNodeId(streamId: string): string {
  return `inc:${streamId}`
}
export function insuranceNodeId(policyId: string): string {
  return `ins:${policyId}`
}
export function ladderNodeId(ladderId: string): string {
  return `ladder:${ladderId}`
}
export function formerSpouseNodeId(streamId: string, formerSpouseId: string): string {
  return `fs:${streamId}:${formerSpouseId}`
}
export function estateNodeId(destination: EstateDestinationId): string {
  return `estate:${destination}`
}

const ESTATE_LABELS: Record<EstateDestinationId, string> = {
  spouse: 'Surviving spouse (rollover)',
  heir: 'Non-spouse heirs',
  charity: 'Charity',
  estate: 'Estate',
}

const INVESTABLE_TYPES = new Set<Account['type']>(['cash', 'taxable', 'equityComp', 'traditional', 'roth', 'hsa'])

// ---------------------------------------------------------------------------
// Selector
// ---------------------------------------------------------------------------

function edge(kind: HouseholdEdgeKind, from: string, to: string, extra?: { label?: string; joint?: boolean }): HouseholdEdge {
  const e: HouseholdEdge = { id: `${kind}:${from}->${to}`, kind, from, to }
  if (extra?.label !== undefined) e.label = extra.label
  if (extra?.joint !== undefined) e.joint = extra.joint
  return e
}

function complete(): HouseholdCompleteness {
  return { state: 'complete', missing: [] }
}

function partial(...missing: string[]): HouseholdCompleteness {
  return { state: 'partial', missing }
}

/** Node kind for an account-union member. */
function accountKind(a: Account): HouseholdNodeKind {
  if (a.type === 'pension' || a.type === 'annuity') return 'guaranteedIncome'
  if (a.type === 'property') return 'property'
  if (a.type === 'debt') return 'debt'
  return 'account'
}

/** The stored figure the account carries, verbatim (mirrors the report model's accountBalance). */
function accountAmount(a: Account): { amount: number; amountKind: HouseholdAmountKind } {
  if (a.type === 'property') return { amount: a.value, amountKind: 'value' }
  if (a.type === 'debt') return { amount: a.balance, amountKind: 'owed' }
  if (a.type === 'pension' || a.type === 'annuity') return { amount: a.monthlyAmount, amountKind: 'monthlyBenefit' }
  return { amount: a.balance, amountKind: 'balance' }
}

function accountMissingFacts(a: Account, peopleCount: number): string[] {
  const missing: string[] = []
  if (INVESTABLE_TYPES.has(a.type)) {
    const hasDestination = a.estateBeneficiary !== undefined || (a.type === 'hsa' && a.beneficiary !== undefined)
    if (!hasDestination) missing.push('No estate destination set — the legacy default applies')
  }
  if (a.type === 'property' && a.plannedSaleYear !== null && a.costBasis === undefined && a.expectedNetProceeds === null) {
    missing.push('Planned sale has no cost basis or net-proceeds estimate')
  }
  if (a.type === 'pension' || a.type === 'annuity') {
    if (a.ownerPersonId === null) missing.push('No owner recorded — the start age has no reference person')
    if (peopleCount === 2) {
      if (a.type === 'pension' && a.survivorPct === 0) missing.push('No survivor continuation recorded (0%)')
      if (a.type === 'annuity' && (a.payoutForm === undefined || a.payoutForm.kind === 'lifeOnly')) {
        missing.push('Life-only payout — no survivor continuation')
      }
    }
    // A survivor share with no second person is stale data, not a spouse to draw.
    if (peopleCount === 1 && a.type === 'pension' && a.survivorPct > 0) {
      missing.push(`Survivor continuation recorded (${a.survivorPct}%) but the plan has no second person`)
    }
  }
  return missing
}

/**
 * The engine treats an empty earnings array the same as no earnings record
 * (simulate skips such streams), so the graph must too — otherwise a stream
 * with `piaMonthly: null, earnings: []` would read as complete.
 */
function hasEarningsRecord(s: Extract<IncomeStream, { type: 'socialSecurity' }>): boolean {
  return s.earnings !== null && s.earnings.length > 0
}

function incomeCompleteness(s: IncomeStream): HouseholdCompleteness {
  if (s.type === 'socialSecurity' && s.piaMonthly === null && !hasEarningsRecord(s)) {
    return { state: 'unknown', missing: ['No PIA or earnings record — the benefit cannot be estimated'] }
  }
  return complete()
}

function incomeAmount(s: IncomeStream): { amount: number | null; amountKind: HouseholdAmountKind | null } {
  switch (s.type) {
    case 'wages':
      return { amount: s.annualGross, amountKind: 'annualIncome' }
    case 'socialSecurity':
      return s.piaMonthly !== null
        ? { amount: s.piaMonthly, amountKind: 'monthlyBenefit' }
        : { amount: null, amountKind: null }
    case 'recurring':
      return { amount: s.annualAmount, amountKind: 'annualIncome' }
    case 'oneTime':
      return { amount: s.amount, amountKind: 'oneTimeAmount' }
  }
}

function incomeLabel(plan: Plan, s: IncomeStream): string {
  const personName = (id: string) => plan.household.people.find((p) => p.id === id)?.name ?? '—'
  if (s.type === 'wages') return `Wages — ${personName(s.personId)}`
  if (s.type === 'socialSecurity') return `Social Security — ${personName(s.personId)}`
  return s.label
}

function insuranceSubject(p: InsurancePolicy): string {
  return p.kind === 'ltc' ? p.owner : p.insured
}

function ladderLabel(l: TipsLadder): string {
  return l.name
}

export function buildHouseholdGraph(plan: Plan): HouseholdGraph {
  const nodes: HouseholdNode[] = []
  const edges: HouseholdEdge[] = []
  const people = plan.household.people
  const personIds = people.map((p) => p.id)
  /** Destination → provenance of the first plan field that referenced it. */
  const referencedEstates = new Map<EstateDestinationId, { source: string; editSurface: HouseholdEditSurface }>()
  const referenceEstate = (destination: EstateDestinationId, source: string, editSurface: HouseholdEditSurface) => {
    if (!referencedEstates.has(destination)) referencedEstates.set(destination, { source, editSurface })
  }

  // --- people ---------------------------------------------------------------
  people.forEach((person, i) => {
    const missing: string[] = []
    const hasSs = plan.incomes.some((s) => s.type === 'socialSecurity' && s.personId === person.id)
    if (!hasSs) missing.push('No Social Security record entered')
    const wages = plan.incomes.filter((s) => s.type === 'wages' && s.personId === person.id)
    if (person.retirementAge === null && wages.some((w) => w.type === 'wages' && w.endAge === null)) {
      missing.push('Wages have no end age and no retirement age is set')
    }
    nodes.push({
      id: personNodeId(person.id),
      kind: 'person',
      subtype: 'person',
      label: person.name,
      amount: null,
      amountKind: null,
      personIds: [person.id],
      source: `household.people[${i}]`,
      editSurface: 'household',
      completeness: missing.length === 0 ? complete() : partial(...missing),
      notes: [],
    })
  })

  // --- former spouses (benefit-unlock records on a Social Security stream) --
  plan.incomes.forEach((s, i) => {
    if (s.type !== 'socialSecurity' || !s.formerSpouses) return
    s.formerSpouses.forEach((fs, j) => {
      const id = formerSpouseNodeId(s.id, fs.id)
      nodes.push({
        id,
        kind: 'formerSpouse',
        subtype: fs.relationship,
        label: fs.relationship === 'divorced' ? 'Former spouse (living)' : 'Former spouse (deceased)',
        amount: fs.piaMonthly,
        amountKind: 'monthlyBenefit',
        personIds: [s.personId],
        source: `incomes[${i}].formerSpouses[${j}]`,
        editSurface: 'socialSecurity',
        completeness: complete(),
        notes: [],
      })
      edges.push(edge('formerSpouseOf', id, personNodeId(s.personId), { label: `${fs.marriageYears}-yr marriage` }))
    })
  })

  // --- income streams -------------------------------------------------------
  plan.incomes.forEach((s, i) => {
    const id = incomeNodeId(s.id)
    const { amount, amountKind } = incomeAmount(s)
    nodes.push({
      id,
      kind: 'income',
      subtype: s.type,
      label: incomeLabel(plan, s),
      amount,
      amountKind,
      personIds: s.type === 'wages' || s.type === 'socialSecurity' ? [s.personId] : [],
      source: `incomes[${i}]`,
      editSurface: s.type === 'socialSecurity' ? 'socialSecurity' : 'income',
      completeness: incomeCompleteness(s),
      notes: [],
    })
    if (s.type === 'wages' || s.type === 'socialSecurity') {
      edges.push(edge('receives', personNodeId(s.personId), id))
    } else {
      // Household-level stream: one edge per member, flagged joint for couples.
      for (const pid of personIds) {
        edges.push(edge('receives', personNodeId(pid), id, personIds.length > 1 ? { joint: true } : undefined))
      }
    }
  })

  // --- accounts (incl. pensions, annuities, property, debts) ---------------
  const totals: HouseholdGraphTotals = { investable: 0, property: 0, assets: 0, liabilities: 0, netWorth: 0 }
  const spouseCanExist = people.length === 2
  plan.accounts.forEach((a, i) => {
    const id = accountNodeId(a.id)
    const { amount, amountKind } = accountAmount(a)
    const owners = a.ownerPersonId === null ? personIds : [a.ownerPersonId]
    const missing = accountMissingFacts(a, people.length)
    const notes: string[] = []
    if (a.type === 'property' && a.hecm !== undefined) {
      notes.push(`HECM line of credit (opened ${a.hecm.openYear})`)
    }

    // Estate destination (explicit field wins; HSA shorthand as fallback).
    let destination: EstateDestinationId | null =
      a.estateBeneficiary !== undefined
        ? a.estateBeneficiary.destination === 'nonSpouse'
          ? 'heir'
          : a.estateBeneficiary.destination
        : a.type === 'hsa' && a.beneficiary !== undefined
          ? a.beneficiary === 'nonSpouse'
            ? 'heir'
            : 'spouse'
          : null
    // A spouse destination in a one-person plan is stale data, not a spouse to
    // draw: never invent a person the plan doesn't have — flag it instead.
    if (destination === 'spouse' && !spouseCanExist) {
      destination = null
      missing.push('Estate destination is the surviving spouse, but the plan has no second person')
    }
    const soleBeneficiary = a.type === 'traditional' && a.spouseSoleBeneficiary === true
    if (soleBeneficiary && !spouseCanExist) {
      missing.push('Marked spouse-as-sole-beneficiary, but the plan has no second person')
    }

    nodes.push({
      id,
      kind: accountKind(a),
      subtype: a.type,
      label: a.name,
      amount,
      amountKind,
      personIds: owners,
      source: `accounts[${i}]`,
      editSurface: 'accounts',
      completeness: missing.length === 0 ? complete() : partial(...missing),
      notes,
    })
    for (const pid of owners) {
      edges.push(edge('owns', personNodeId(pid), id, a.ownerPersonId === null && personIds.length > 1 ? { joint: true } : undefined))
    }

    // Totals: exact sums of stored figures only.
    if (INVESTABLE_TYPES.has(a.type) && 'balance' in a) totals.investable += a.balance
    if (a.type === 'property') totals.property += a.value
    if (a.type === 'debt') totals.liabilities += a.balance

    if (destination === 'charity') {
      const pct = a.estateBeneficiary?.charityPct ?? 0
      referenceEstate('charity', `accounts[${i}].estateBeneficiary`, 'accounts')
      edges.push(edge('beneficiary', id, estateNodeId('charity'), { label: `${pct}%` }))
      if (pct < 100) {
        referenceEstate('heir', `accounts[${i}].estateBeneficiary`, 'accounts')
        edges.push(edge('beneficiary', id, estateNodeId('heir'), { label: 'remainder' }))
      }
    } else if (destination !== null) {
      referenceEstate(destination, `accounts[${i}].estateBeneficiary`, 'accounts')
      // The sole-beneficiary assertion targets the same spouse destination —
      // emit ONE labeled edge, never two edges with the same id.
      const label = destination === 'spouse' && soleBeneficiary ? { label: 'sole beneficiary' } : undefined
      edges.push(edge('beneficiary', id, estateNodeId(destination), label))
    }
    if (soleBeneficiary && spouseCanExist && destination !== 'spouse') {
      referenceEstate('spouse', `accounts[${i}].spouseSoleBeneficiary`, 'accounts')
      edges.push(edge('beneficiary', id, estateNodeId('spouse'), { label: 'sole beneficiary' }))
    }

    // Survivor continuations (categorical — the schema names no person). A
    // one-person plan's survivor share is flagged in accountMissingFacts, not drawn.
    if (a.type === 'pension' && a.survivorPct > 0 && spouseCanExist) {
      referenceEstate('spouse', `accounts[${i}].survivorPct`, 'accounts')
      edges.push(edge('survivor', id, estateNodeId('spouse'), { label: `${a.survivorPct}%` }))
    }
    if (a.type === 'annuity' && a.payoutForm?.kind === 'jointSurvivor') {
      referenceEstate('spouse', `accounts[${i}].payoutForm`, 'accounts')
      edges.push(edge('survivor', id, estateNodeId('spouse'), { label: `${a.payoutForm.survivorPct}%` }))
    }

    // Funding relationships.
    if (a.type === 'annuity' && a.purchase) {
      edges.push(edge('funds', accountNodeId(a.purchase.fundingAccountId), id, { label: `${a.purchase.year}` }))
    }
    if (a.type === 'pension' && a.lumpSumElection) {
      edges.push(
        edge('funds', id, accountNodeId(a.lumpSumElection.rolloverAccountId), {
          label: a.lumpSumOffer ? `lump sum ${a.lumpSumOffer.electionYear}` : 'lump sum',
        }),
      )
    }
  })
  totals.assets = totals.investable + totals.property
  totals.netWorth = totals.assets - totals.liabilities

  // --- insurance ------------------------------------------------------------
  plan.insurance.forEach((p, i) => {
    const id = insuranceNodeId(p.id)
    const subject = insuranceSubject(p)
    nodes.push({
      id,
      kind: 'insurance',
      subtype: p.kind,
      label: p.name,
      amount: p.kind === 'ltc' ? p.benefitMonthly : p.deathBenefit,
      amountKind: p.kind === 'ltc' ? 'monthlyBenefit' : 'deathBenefit',
      personIds: [subject],
      source: `insurance[${i}]`,
      editSurface: 'insurance',
      completeness: complete(),
      notes: [],
    })
    edges.push(edge('covers', id, personNodeId(subject)))
    if (p.kind === 'permanentLife') {
      if (p.beneficiary === 'estate') {
        referenceEstate('estate', `insurance[${i}].beneficiary`, 'insurance')
        edges.push(edge('beneficiary', id, estateNodeId('estate')))
      } else {
        edges.push(edge('beneficiary', id, personNodeId(p.beneficiary)))
      }
    }
  })

  // --- TIPS ladders ---------------------------------------------------------
  plan.incomeFloor?.ladders.forEach((l, i) => {
    const id = ladderNodeId(l.id)
    nodes.push({
      id,
      kind: 'ladder',
      subtype: l.purpose,
      label: ladderLabel(l),
      amount: l.annualRealAmount,
      amountKind: 'annualIncome',
      personIds: [],
      source: `incomeFloor.ladders[${i}]`,
      editSurface: 'incomeFloor',
      completeness: complete(),
      notes: [],
    })
    if (l.purchase) {
      edges.push(edge('funds', accountNodeId(l.purchase.fundingAccountId), id, { label: `${l.purchase.year}` }))
    }
  })

  // --- estate destination nodes (only the referenced ones, fixed order).
  // Provenance and edit surface come from the first plan field that actually
  // referenced the destination (the 'estate' subtype, for example, is only
  // reachable via a permanent-life beneficiary — never an account field).
  for (const destination of ['spouse', 'heir', 'charity', 'estate'] as const) {
    const referencedBy = referencedEstates.get(destination)
    if (referencedBy === undefined) continue
    nodes.push({
      id: estateNodeId(destination),
      kind: 'estate',
      subtype: destination,
      label: ESTATE_LABELS[destination],
      amount: null,
      amountKind: null,
      personIds: [],
      source: referencedBy.source,
      editSurface: referencedBy.editSurface,
      completeness: complete(),
      notes: [],
    })
  }

  return { nodes, edges, totals, unsupported: UNSUPPORTED_RELATIONSHIPS }
}
