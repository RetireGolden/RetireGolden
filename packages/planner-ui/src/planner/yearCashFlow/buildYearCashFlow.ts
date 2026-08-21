/**
 * Year cash-flow Sankey selector — a pure, deterministic reading of one
 * `YearResult.cashFlow` report against the current Plan.
 *
 * The engine contract (`DOCS/features/year-cash-flow.md`) is an identity-bearing
 * ledger, not a chart: no labels, colors, or coordinates. This selector is the
 * presentation layer that joins those identities to current Plan names and
 * shapes two Sankey views plus an accessible table. It never recomputes tax,
 * funding, or shortfall. Node totals are exact sums of published engine
 * amounts. Display conversion (today-dollars, rounding) is the component
 * layer's job via a transform applied to these raw nominal Plan dollars.
 *
 * A year with no `cashFlow` or with `reconciliation.status === 'notReconciled'`
 * returns a refusal model. The UI must render that as a non-chart failure
 * state — never a best-effort graph, never an "Other" plug.
 *
 * @see DOCS/features/year-cash-flow.md
 * @see DESIGN.md (candid ledger — nothing decorates)
 */

import type { Account, IncomeStream, Plan } from '@retiregolden/engine/model/plan'
import type {
  YearCashFlow,
  YearCashFlowEntityReference,
  YearCashFlowLineage,
  YearCashFlowPenaltyClass,
  YearCashFlowReconciliation,
  YearCashFlowReconciliationDiagnostic,
  YearCashFlowReconciliationReasonCode,
  YearCashFlowSourceKind,
  YearCashFlowSourceLine,
  YearCashFlowStandaloneTaxCharacter,
  YearCashFlowTaxCharacter,
  YearCashFlowTransferEndpoint,
  YearCashFlowTransferKind,
  YearCashFlowTransferLine,
  YearCashFlowUseKind,
  YearCashFlowUseLine,
  YearResult,
} from '@retiregolden/engine/projection/types'

import {
  applyYearCashFlowGrouping,
  type YearCashFlowGroupingOptions,
} from './grouping'

// ---------------------------------------------------------------------------
// Public constants
// ---------------------------------------------------------------------------

/** The single household-cash hub. Funded uses leave here; unfunded never enters. */
export const HOUSEHOLD_CASH_NODE_ID = 'householdCash'

/** Distinct origin of the unfunded side branch. Not a cash source. */
export const UNFUNDED_ORIGIN_NODE_ID = 'unfunded'

// ---------------------------------------------------------------------------
// Visual + table model
// ---------------------------------------------------------------------------

export type YearCashFlowSankeyViewId = 'cashFlow' | 'transfers'

export type YearCashFlowSankeySide =
  | 'source'
  | 'hub'
  | 'fundedUse'
  | 'unfundedOrigin'
  | 'unfundedUse'
  | 'transfer'

export type YearCashFlowSankeyNodeRole =
  | 'spendableSource'
  | 'portfolioFunding'
  | 'loanProceeds'
  | 'householdCash'
  | 'fundedUse'
  | 'unfundedOrigin'
  | 'unfundedUse'
  | 'transferEndpoint'

/** Computed-outcome flags the chart layer maps to verdict color + text, not decoration. */
export type YearCashFlowSankeyFlag = 'unfunded' | 'unresolved'

export interface YearCashFlowSankeyNode {
  readonly id: string
  readonly view: YearCashFlowSankeyViewId
  readonly side: YearCashFlowSankeySide
  readonly role: YearCashFlowSankeyNodeRole
  readonly kind: string
  readonly kindLabel: string
  readonly personKey: string
  readonly personLabel: string
  readonly label: string
  /** Nominal Plan dollars: a published engine amount, or the exact sum of such amounts. */
  readonly amountPlanDollars: number
  readonly underlyingLineIds: readonly string[]
  readonly unresolved: boolean
  readonly collapsed: boolean
  readonly flag: YearCashFlowSankeyFlag | null
}

export interface YearCashFlowSankeyLink {
  readonly id: string
  readonly view: YearCashFlowSankeyViewId
  readonly source: string
  readonly target: string
  readonly amountPlanDollars: number
  readonly underlyingLineIds: readonly string[]
  readonly flag: YearCashFlowSankeyFlag | null
}

export interface YearCashFlowSankeyView {
  readonly nodes: readonly YearCashFlowSankeyNode[]
  readonly links: readonly YearCashFlowSankeyLink[]
}

/**
 * Table / CSV view of one underlying engine line. `postSolve` and
 * `taxCharacter` rows never appear on either Sankey: post-solve deposits did
 * not fund the year, and tax-character metadata is not a money line.
 */
export type YearCashFlowTableView = 'cashFlow' | 'transfers' | 'postSolve' | 'taxCharacter'

export interface YearCashFlowTableRow {
  readonly id: string
  readonly view: YearCashFlowTableView
  readonly kind: string
  readonly label: string
  readonly entityLabels: readonly string[]
  readonly sourceRef: string
  readonly targetRef: string
  readonly amountPlanDollars: number | null
  readonly requestedPlanDollars: number | null
  readonly fundedPlanDollars: number | null
  readonly unfundedPlanDollars: number | null
  readonly debitPlanDollars: number | null
  readonly creditPlanDollars: number | null
  readonly penaltyClass: YearCashFlowPenaltyClass | null
  readonly taxCharacter: readonly Readonly<YearCashFlowTaxCharacter>[]
  readonly lineageNotes: readonly Readonly<YearCashFlowLineage>[]
  readonly unresolved: boolean
}

export type YearCashFlowUnavailableReason = 'notCaptured' | 'notReconciled'

export interface YearCashFlowSankeyUnavailable {
  readonly kind: 'unavailable'
  readonly year: number
  readonly unavailableReason: YearCashFlowUnavailableReason
  readonly reasonCodes: readonly YearCashFlowReconciliationReasonCode[]
  readonly diagnostics: readonly Readonly<YearCashFlowReconciliationDiagnostic>[]
}

export interface YearCashFlowSankeyReady {
  readonly kind: 'ready'
  readonly year: number
  readonly showAll: boolean
  readonly views: {
    readonly cashFlow: YearCashFlowSankeyView
    readonly transfers: YearCashFlowSankeyView
  }
  readonly table: readonly YearCashFlowTableRow[]
  readonly reconciliation: Readonly<YearCashFlowReconciliation>
}

export type YearCashFlowSankeyModel = YearCashFlowSankeyUnavailable | YearCashFlowSankeyReady

export type BuildYearCashFlowSankeyOptions = YearCashFlowGroupingOptions

// ---------------------------------------------------------------------------
// Kind inventories (contract publication order)
// ---------------------------------------------------------------------------

const SOURCE_KIND_ORDER: readonly YearCashFlowSourceKind[] = [
  'wages',
  'socialSecurity',
  'pension',
  'annuityPayment',
  'tipsLadderCash',
  'recurringIncome',
  'oneTimeIncome',
  'taxableAccountYield',
  'taxExemptInterest',
  'propertySaleProceeds',
  'requiredMinimumDistribution',
  'seppDistribution',
  'inheritedAccountDistribution',
  'retirementActionWithdrawal',
  'needBasedPortfolioWithdrawal',
  'hecmCoordinatedDraw',
  'hecmBackstopDraw',
  'legacyPropertySaleDeposit',
  'lifeInsuranceDeathBenefit',
]

const USE_KIND_ORDER: readonly YearCashFlowUseKind[] = [
  'requiredLifestyle',
  'targetLifestyle',
  'idealLifestyle',
  'excessLifestyle',
  'oneTimeGoal',
  'debtService',
  'propertyCosts',
  'healthcare',
  'insurancePremium',
  'longTermCare',
  'settledTax',
  'earlyWithdrawalPenalty',
  'contribution',
  'surplusInvestment',
]

const TRANSFER_KIND_ORDER: readonly YearCashFlowTransferKind[] = [
  'namedRothConversion',
  'aggregateRothConversion',
  'qualifiedCharitableDistribution',
  'employeeContribution',
  'employerMatch',
  'annuityPurchase',
  'tipsLadderPurchase',
  'pensionRollover',
  'reinvestedYield',
  'surplusInvestment',
]

const SOURCE_KIND_LABEL: Record<YearCashFlowSourceKind, string> = {
  wages: 'Wages',
  socialSecurity: 'Social Security',
  pension: 'Pension',
  annuityPayment: 'Annuity',
  tipsLadderCash: 'TIPS ladder cash',
  recurringIncome: 'Recurring income',
  oneTimeIncome: 'One-time income',
  taxableAccountYield: 'Taxable yield',
  taxExemptInterest: 'Tax-exempt interest',
  propertySaleProceeds: 'Property sale proceeds',
  requiredMinimumDistribution: 'Required minimum distribution',
  seppDistribution: 'SEPP distribution',
  inheritedAccountDistribution: 'Inherited-account distribution',
  retirementActionWithdrawal: 'Retirement-action withdrawal',
  needBasedPortfolioWithdrawal: 'Need-based withdrawal',
  hecmCoordinatedDraw: 'HECM coordinated draw',
  hecmBackstopDraw: 'HECM backstop draw',
  legacyPropertySaleDeposit: 'Legacy property-sale deposit',
  lifeInsuranceDeathBenefit: 'Life insurance death benefit',
}

const USE_KIND_LABEL: Record<YearCashFlowUseKind, string> = {
  requiredLifestyle: 'Required lifestyle',
  targetLifestyle: 'Target lifestyle',
  idealLifestyle: 'Ideal lifestyle',
  excessLifestyle: 'Excess lifestyle',
  oneTimeGoal: 'One-time goal',
  debtService: 'Debt service',
  propertyCosts: 'Property costs',
  healthcare: 'Healthcare',
  insurancePremium: 'Insurance premium',
  longTermCare: 'Long-term care',
  settledTax: 'Settled tax',
  earlyWithdrawalPenalty: 'Early-withdrawal penalty',
  contribution: 'Contribution',
  surplusInvestment: 'Surplus investment',
}

const TRANSFER_KIND_LABEL: Record<YearCashFlowTransferKind, string> = {
  namedRothConversion: 'Named Roth conversion',
  aggregateRothConversion: 'Aggregate Roth conversion',
  // Physical IRA-to-charity channel; qualification is tax-character metadata.
  qualifiedCharitableDistribution: 'IRA-to-charity distribution',
  employeeContribution: 'Employee contribution',
  employerMatch: 'Employer match',
  annuityPurchase: 'Annuity purchase',
  tipsLadderPurchase: 'TIPS ladder purchase',
  pensionRollover: 'Pension rollover',
  reinvestedYield: 'Reinvested yield',
  surplusInvestment: 'Surplus investment',
}

const SOURCE_ROLE_ORDER = ['spendableSource', 'portfolioFunding', 'loanProceeds'] as const
const SIDE_ORDER: readonly YearCashFlowSankeySide[] = [
  'source',
  'hub',
  'fundedUse',
  'unfundedOrigin',
  'unfundedUse',
  'transfer',
]
const TABLE_VIEW_ORDER: readonly YearCashFlowTableView[] = [
  'cashFlow',
  'transfers',
  'postSolve',
  'taxCharacter',
]

function indexOfKind(order: readonly string[], kind: string): number {
  const i = order.indexOf(kind)
  return i === -1 ? order.length : i
}

function compareId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

// ---------------------------------------------------------------------------
// Plan index + labels
// ---------------------------------------------------------------------------

interface PlanIndex {
  readonly people: Map<string, string>
  readonly accounts: Map<string, Account>
  readonly incomes: Map<string, IncomeStream>
  readonly goals: Map<string, string>
  readonly policies: Map<string, { name: string; personId: string }>
  readonly ladders: Map<string, string>
  readonly careEvents: Map<string, string>
  readonly actions: Map<string, { kind: string; personId?: string }>
}

function unknownLabel(id: string): string {
  return `Unknown source (ID ${id})`
}

function accountKindTag(account: Account): string {
  if (account.type === 'traditional') return account.kind === 'employer' ? '401(k)' : 'IRA'
  if (account.type === 'roth') return account.kind === 'employer' ? 'Roth 401(k)' : 'Roth IRA'
  switch (account.type) {
    case 'cash':
      return 'Cash'
    case 'taxable':
      return 'Brokerage'
    case 'equityComp':
      return 'Equity comp'
    case 'hsa':
      return 'HSA'
    case 'property':
      return 'Property'
    case 'debt':
      return 'Debt'
    case 'pension':
      return 'Pension'
    case 'annuity':
      return 'Annuity'
  }
}

function buildPlanIndex(plan: Plan): PlanIndex {
  const people = new Map<string, string>()
  for (const person of plan.household.people) people.set(person.id, person.name)
  const accounts = new Map<string, Account>()
  for (const account of plan.accounts) accounts.set(account.id, account)
  const incomes = new Map<string, IncomeStream>()
  for (const stream of plan.incomes) incomes.set(stream.id, stream)
  const goals = new Map<string, string>()
  for (const goal of plan.expenses.oneTimeGoals) goals.set(goal.id, goal.label)
  const policies = new Map<string, { name: string; personId: string }>()
  for (const policy of plan.insurance) {
    const personId = policy.kind === 'ltc' ? policy.owner : policy.insured
    policies.set(policy.id, { name: policy.name, personId })
  }
  const ladders = new Map<string, string>()
  for (const ladder of plan.incomeFloor?.ladders ?? []) ladders.set(ladder.id, ladder.name)
  const careEvents = new Map<string, string>()
  for (const event of plan.careEvents) careEvents.set(event.id, event.personId)
  const actions = new Map<string, { kind: string; personId?: string }>()
  for (const action of plan.strategies.retirementActions) {
    actions.set(String(action.actionId), {
      kind: action.kind,
      personId: 'personId' in action ? String(action.personId) : undefined,
    })
  }
  return { people, accounts, incomes, goals, policies, ladders, careEvents, actions }
}

function personName(index: PlanIndex, personId: string): string | null {
  return index.people.get(personId) ?? null
}

function withPerson(person: string | null, rest: string): string {
  return person ? `${person} - ${rest}` : rest
}

function accountLabel(index: PlanIndex, account: Account): { label: string; unresolved: boolean } {
  const tag = accountKindTag(account)
  const rest = `${account.name} (${tag})`
  if (account.ownerPersonId === null) return { label: rest, unresolved: false }
  const owner = personName(index, account.ownerPersonId)
  if (owner === null) return { label: `${unknownLabel(account.ownerPersonId)} - ${rest}`, unresolved: true }
  return { label: `${owner} - ${rest}`, unresolved: false }
}

function incomeLabel(index: PlanIndex, stream: IncomeStream): { label: string; unresolved: boolean } {
  if (stream.type === 'wages' || stream.type === 'socialSecurity') {
    const owner = personName(index, stream.personId)
    const kind = stream.type === 'wages' ? 'Wages' : 'Social Security'
    if (owner === null) return { label: unknownLabel(stream.personId), unresolved: true }
    return { label: `${owner} - ${kind}`, unresolved: false }
  }
  return { label: stream.label, unresolved: false }
}

interface ResolvedEntity {
  readonly label: string
  readonly unresolved: boolean
  readonly personKey: string
  readonly personLabel: string
}

function householdPerson(index: PlanIndex, personId: string | null | undefined): Pick<ResolvedEntity, 'personKey' | 'personLabel'> {
  if (!personId) return { personKey: 'household', personLabel: 'Household' }
  const name = personName(index, personId)
  if (name === null) return { personKey: `unresolved:${personId}`, personLabel: unknownLabel(personId) }
  return { personKey: personId, personLabel: name }
}

function personFromAccount(index: PlanIndex, account: Account | undefined): Pick<ResolvedEntity, 'personKey' | 'personLabel'> {
  if (!account) return { personKey: 'household', personLabel: 'Household' }
  return householdPerson(index, account.ownerPersonId)
}

function resolveEntity(index: PlanIndex, ref: YearCashFlowEntityReference): ResolvedEntity {
  switch (ref.entityKind) {
    case 'person': {
      const person = householdPerson(index, ref.personId)
      const unresolved = person.personKey.startsWith('unresolved:')
      return {
        label: unresolved ? unknownLabel(ref.personId) : person.personLabel,
        unresolved,
        ...person,
      }
    }
    case 'account': {
      const account = index.accounts.get(ref.accountId)
      if (!account) {
        return { label: unknownLabel(ref.accountId), unresolved: true, personKey: `unresolved:${ref.accountId}`, personLabel: unknownLabel(ref.accountId) }
      }
      const labeled = accountLabel(index, account)
      return { ...labeled, ...personFromAccount(index, account) }
    }
    case 'propertyAccount': {
      const account = index.accounts.get(ref.propertyAccountId)
      if (!account) {
        return { label: unknownLabel(ref.propertyAccountId), unresolved: true, personKey: `unresolved:${ref.propertyAccountId}`, personLabel: unknownLabel(ref.propertyAccountId) }
      }
      const labeled = accountLabel(index, account)
      return { ...labeled, ...personFromAccount(index, account) }
    }
    case 'annuityContract': {
      const account = index.accounts.get(ref.annuityAccountId)
      if (!account) {
        return { label: unknownLabel(ref.annuityAccountId), unresolved: true, personKey: `unresolved:${ref.annuityAccountId}`, personLabel: unknownLabel(ref.annuityAccountId) }
      }
      const labeled = accountLabel(index, account)
      return { ...labeled, ...personFromAccount(index, account) }
    }
    case 'incomeStream': {
      const stream = index.incomes.get(ref.incomeStreamId)
      if (!stream) {
        return { label: unknownLabel(ref.incomeStreamId), unresolved: true, personKey: `unresolved:${ref.incomeStreamId}`, personLabel: unknownLabel(ref.incomeStreamId) }
      }
      const labeled = incomeLabel(index, stream)
      const personId = stream.type === 'wages' || stream.type === 'socialSecurity' ? stream.personId : null
      return { ...labeled, ...householdPerson(index, personId) }
    }
    case 'goal': {
      const label = index.goals.get(ref.goalId)
      if (label === undefined) {
        return { label: unknownLabel(ref.goalId), unresolved: true, personKey: 'household', personLabel: 'Household' }
      }
      return { label, unresolved: false, personKey: 'household', personLabel: 'Household' }
    }
    case 'insurancePolicy': {
      const policy = index.policies.get(ref.policyId)
      if (!policy) {
        return { label: unknownLabel(ref.policyId), unresolved: true, personKey: `unresolved:${ref.policyId}`, personLabel: unknownLabel(ref.policyId) }
      }
      const person = householdPerson(index, policy.personId)
      return { label: withPerson(person.personLabel, policy.name), unresolved: person.personKey.startsWith('unresolved:'), ...person }
    }
    case 'tipsLadder': {
      const name = index.ladders.get(ref.ladderId)
      if (name === undefined) {
        return { label: unknownLabel(ref.ladderId), unresolved: true, personKey: 'household', personLabel: 'Household' }
      }
      return { label: name, unresolved: false, personKey: 'household', personLabel: 'Household' }
    }
    case 'careEvent': {
      const personId = index.careEvents.get(ref.careEventId)
      if (personId === undefined) {
        return { label: unknownLabel(ref.careEventId), unresolved: true, personKey: `unresolved:${ref.careEventId}`, personLabel: unknownLabel(ref.careEventId) }
      }
      const person = householdPerson(index, personId)
      return { label: withPerson(person.personLabel, 'Long-term care'), unresolved: person.personKey.startsWith('unresolved:'), ...person }
    }
    case 'retirementAction': {
      const action = index.actions.get(ref.actionId)
      if (!action) {
        return { label: unknownLabel(ref.actionId), unresolved: true, personKey: `unresolved:${ref.actionId}`, personLabel: unknownLabel(ref.actionId) }
      }
      const person = householdPerson(index, action.personId)
      const kindLabel =
        action.kind === 'ordinaryWithdrawal' ? 'Ordinary withdrawal'
        : action.kind === 'rothConversion' ? 'Roth conversion'
        : action.kind === 'qcd' ? 'IRA-to-charity distribution'
        : action.kind
      return { label: withPerson(person.personLabel, kindLabel), unresolved: person.personKey.startsWith('unresolved:'), ...person }
    }
    case 'requiredDistributionPool': {
      const person = householdPerson(index, ref.personId)
      const unresolved = person.personKey.startsWith('unresolved:')
      return {
        label: unresolved ? unknownLabel(ref.personId) : `${person.personLabel} - owned IRA RMD`,
        unresolved,
        ...person,
      }
    }
  }
}

function identityKey(ref: YearCashFlowEntityReference): string {
  switch (ref.entityKind) {
    case 'person':
    case 'requiredDistributionPool':
      return `${ref.entityKind}:${ref.personId}`
    case 'account':
      return `account:${ref.accountId}`
    case 'propertyAccount':
      return `property:${ref.propertyAccountId}`
    case 'annuityContract':
      return `annuity:${ref.annuityAccountId}`
    case 'incomeStream':
      return `incomeStream:${ref.incomeStreamId}`
    case 'goal':
      return `goal:${ref.goalId}`
    case 'insurancePolicy':
      return `policy:${ref.policyId}`
    case 'tipsLadder':
      return `ladder:${ref.ladderId}`
    case 'careEvent':
      return `careEvent:${ref.careEventId}`
    case 'retirementAction':
      return ref.allocationId ? `action:${ref.actionId}:${ref.allocationId}` : `action:${ref.actionId}`
  }
}

function endpointNodeId(endpoint: YearCashFlowTransferEndpoint): string {
  switch (endpoint.entityKind) {
    case 'householdCash':
      return HOUSEHOLD_CASH_NODE_ID
    case 'charity':
      return endpoint.designationId ? `charity:${endpoint.designationId}` : 'charity'
    case 'employer':
      return 'employer'
    case 'unassignedCash':
      return 'unassignedCash'
    case 'accountYield':
      return `accountYield:${endpoint.accountId}`
    case 'pensionPlan':
      return `pensionPlan:${endpoint.pensionAccountId}`
    default:
      return identityKey(endpoint)
  }
}

function resolveEndpoint(index: PlanIndex, endpoint: YearCashFlowTransferEndpoint): ResolvedEntity {
  switch (endpoint.entityKind) {
    case 'householdCash':
      return { label: 'Household cash', unresolved: false, personKey: 'household', personLabel: 'Household' }
    case 'charity':
      return {
        label: endpoint.designationId ? `Charity (${endpoint.designationId})` : 'Charity',
        unresolved: false,
        personKey: 'household',
        personLabel: 'Household',
      }
    case 'employer':
      return { label: 'Employer', unresolved: false, personKey: 'household', personLabel: 'Household' }
    case 'unassignedCash':
      return { label: 'Unassigned cash', unresolved: false, personKey: 'household', personLabel: 'Household' }
    case 'accountYield': {
      const account = index.accounts.get(endpoint.accountId)
      if (!account) {
        return { label: unknownLabel(endpoint.accountId), unresolved: true, personKey: `unresolved:${endpoint.accountId}`, personLabel: unknownLabel(endpoint.accountId) }
      }
      const labeled = accountLabel(index, account)
      return { label: `${labeled.label} yield`, unresolved: labeled.unresolved, ...personFromAccount(index, account) }
    }
    case 'pensionPlan': {
      const account = index.accounts.get(endpoint.pensionAccountId)
      if (!account) {
        return { label: unknownLabel(endpoint.pensionAccountId), unresolved: true, personKey: `unresolved:${endpoint.pensionAccountId}`, personLabel: unknownLabel(endpoint.pensionAccountId) }
      }
      const labeled = accountLabel(index, account)
      return { ...labeled, ...personFromAccount(index, account) }
    }
    default:
      return resolveEntity(index, endpoint)
  }
}

interface LineResolution {
  readonly label: string
  readonly entityLabels: readonly string[]
  readonly unresolved: boolean
  readonly personKey: string
  readonly personLabel: string
  readonly sourceRef: string
}

function rawUnknownId(ref: YearCashFlowEntityReference): string {
  switch (ref.entityKind) {
    case 'person':
    case 'requiredDistributionPool':
      return ref.personId
    case 'account':
      return ref.accountId
    case 'propertyAccount':
      return ref.propertyAccountId
    case 'annuityContract':
      return ref.annuityAccountId
    case 'incomeStream':
      return ref.incomeStreamId
    case 'goal':
      return ref.goalId
    case 'insurancePolicy':
      return ref.policyId
    case 'tipsLadder':
      return ref.ladderId
    case 'careEvent':
      return ref.careEventId
    case 'retirementAction':
      return ref.actionId
  }
}

function resolveLineLabel(
  index: PlanIndex,
  identities: readonly YearCashFlowEntityReference[],
  fallbackLabel: string,
): LineResolution {
  if (identities.length === 0) {
    return {
      label: fallbackLabel,
      entityLabels: [],
      unresolved: false,
      personKey: 'household',
      personLabel: 'Household',
      sourceRef: 'household',
    }
  }
  const resolved = identities.map((ref) => resolveEntity(index, ref))
  const unresolved = resolved.some((item) => item.unresolved)
  const primary = resolved.find((item) => !item.unresolved) ?? resolved[0]!
  const person = resolved.find((item) => item.personKey !== 'household') ?? primary
  const firstUnresolved = identities.find((_, i) => resolved[i]!.unresolved)
  const allUnresolved = resolved.every((item) => item.unresolved)
  const label = allUnresolved && firstUnresolved
    ? unknownLabel(rawUnknownId(firstUnresolved))
    : primary.label
  return {
    label,
    entityLabels: resolved.map((item) => item.label),
    unresolved,
    personKey: person.personKey,
    personLabel: person.personLabel,
    sourceRef: identities.map(identityKey).join(';'),
  }
}

// ---------------------------------------------------------------------------
// Table rows
// ---------------------------------------------------------------------------

function sourceTableRow(
  index: PlanIndex,
  line: YearCashFlowSourceLine,
): YearCashFlowTableRow {
  const kindLabel = SOURCE_KIND_LABEL[line.kind]
  const resolved = resolveLineLabel(index, line.identities, kindLabel)
  const postSolve = line.role === 'postSolveDeposit'
  const targetRef = postSolve ? endpointNodeId(line.postSolveDestination) : HOUSEHOLD_CASH_NODE_ID
  return {
    id: line.id,
    view: postSolve ? 'postSolve' : 'cashFlow',
    kind: line.kind,
    label: resolved.label,
    entityLabels: resolved.entityLabels,
    sourceRef: line.id,
    targetRef,
    amountPlanDollars: line.amountPlanDollars,
    requestedPlanDollars: null,
    fundedPlanDollars: null,
    unfundedPlanDollars: null,
    debitPlanDollars: null,
    creditPlanDollars: null,
    penaltyClass: null,
    taxCharacter: line.taxCharacter ?? [],
    lineageNotes: [],
    unresolved: resolved.unresolved,
  }
}

function fundedUseTableRow(index: PlanIndex, line: YearCashFlowUseLine): YearCashFlowTableRow {
  const kindLabel = USE_KIND_LABEL[line.kind]
  const resolved = resolveLineLabel(index, line.identities, kindLabel)
  return {
    id: line.id,
    view: 'cashFlow',
    kind: line.kind,
    label: resolved.label,
    entityLabels: resolved.entityLabels,
    sourceRef: HOUSEHOLD_CASH_NODE_ID,
    targetRef: line.id,
    amountPlanDollars: line.fundedPlanDollars,
    requestedPlanDollars: line.requestedPlanDollars,
    fundedPlanDollars: line.fundedPlanDollars,
    unfundedPlanDollars: line.unfundedPlanDollars,
    debitPlanDollars: null,
    creditPlanDollars: null,
    penaltyClass: line.penaltyClass ?? null,
    taxCharacter: [],
    lineageNotes: [],
    unresolved: resolved.unresolved,
  }
}

function transferTableRow(index: PlanIndex, line: YearCashFlowTransferLine): YearCashFlowTableRow {
  const kindLabel = TRANSFER_KIND_LABEL[line.kind]
  const resolved = resolveLineLabel(index, line.identities, kindLabel)
  const source = resolveEndpoint(index, line.source)
  const dest = resolveEndpoint(index, line.destination)
  const unresolved = resolved.unresolved || source.unresolved || dest.unresolved
  return {
    id: line.id,
    view: 'transfers',
    kind: line.kind,
    label: resolved.label === kindLabel ? `${source.label} → ${dest.label}` : resolved.label,
    entityLabels: resolved.entityLabels.length > 0 ? resolved.entityLabels : [source.label, dest.label],
    sourceRef: endpointNodeId(line.source),
    targetRef: endpointNodeId(line.destination),
    amountPlanDollars: line.debitPlanDollars,
    requestedPlanDollars: null,
    fundedPlanDollars: null,
    unfundedPlanDollars: null,
    debitPlanDollars: line.debitPlanDollars,
    creditPlanDollars: line.creditPlanDollars,
    penaltyClass: null,
    taxCharacter: line.taxCharacter ?? [],
    lineageNotes: line.lineage ?? [],
    unresolved,
  }
}

function metadataTableRow(
  index: PlanIndex,
  line: YearCashFlowStandaloneTaxCharacter,
): YearCashFlowTableRow {
  const resolved = resolveLineLabel(index, line.identities, line.taxCharacter.kind)
  return {
    id: line.id,
    view: 'taxCharacter',
    kind: line.taxCharacter.kind,
    label: resolved.label,
    entityLabels: resolved.entityLabels,
    sourceRef: resolved.sourceRef,
    targetRef: line.relatedLineId ?? '',
    amountPlanDollars: null,
    requestedPlanDollars: null,
    fundedPlanDollars: null,
    unfundedPlanDollars: null,
    debitPlanDollars: null,
    creditPlanDollars: null,
    penaltyClass: null,
    taxCharacter: [line.taxCharacter],
    lineageNotes: [],
    unresolved: resolved.unresolved,
  }
}

function tableGroup(row: YearCashFlowTableRow): number {
  if (row.view === 'cashFlow') return row.requestedPlanDollars !== null ? 1 : 0
  return TABLE_VIEW_ORDER.indexOf(row.view) + 1
}

function kindOrderFor(row: YearCashFlowTableRow): readonly string[] {
  if (row.view === 'transfers') return TRANSFER_KIND_ORDER
  if (row.view === 'taxCharacter') return []
  if (row.requestedPlanDollars !== null) return USE_KIND_ORDER
  return SOURCE_KIND_ORDER
}

function compareTableRows(a: YearCashFlowTableRow, b: YearCashFlowTableRow): number {
  const group = tableGroup(a) - tableGroup(b)
  if (group !== 0) return group
  const kind = indexOfKind(kindOrderFor(a), a.kind) - indexOfKind(kindOrderFor(b), b.kind)
  if (kind !== 0) return kind
  return compareId(a.id, b.id)
}

function buildTable(index: PlanIndex, cashFlow: YearCashFlow): YearCashFlowTableRow[] {
  const rows: YearCashFlowTableRow[] = []
  for (const line of cashFlow.sourceLines) rows.push(sourceTableRow(index, line))
  for (const line of cashFlow.useLines) rows.push(fundedUseTableRow(index, line))
  for (const line of cashFlow.transferLines) rows.push(transferTableRow(index, line))
  for (const line of cashFlow.taxCharacterMetadata) rows.push(metadataTableRow(index, line))
  rows.sort(compareTableRows)
  return rows
}

// ---------------------------------------------------------------------------
// Cash-flow Sankey
// ---------------------------------------------------------------------------

function sourceRole(line: YearCashFlowSourceLine): YearCashFlowSankeyNodeRole | null {
  if (line.role === 'spendableSource') return 'spendableSource'
  if (line.role === 'portfolioFunding') return 'portfolioFunding'
  if (line.role === 'loanProceeds') return 'loanProceeds'
  return null
}

function makeNode(partial: Omit<YearCashFlowSankeyNode, 'collapsed' | 'flag'> & {
  collapsed?: boolean
  flag?: YearCashFlowSankeyFlag | null
}): YearCashFlowSankeyNode {
  const unresolved = partial.unresolved
  const flag: YearCashFlowSankeyFlag | null =
    partial.flag !== undefined ? partial.flag
    : unresolved ? 'unresolved'
    : partial.role === 'unfundedUse' || partial.role === 'unfundedOrigin' ? 'unfunded'
    : null
  return { ...partial, collapsed: partial.collapsed ?? false, flag }
}

function makeLink(
  view: YearCashFlowSankeyViewId,
  source: string,
  target: string,
  amountPlanDollars: number,
  lineId: string,
  flag: YearCashFlowSankeyFlag | null = null,
): YearCashFlowSankeyLink {
  return {
    id: `${source}->${target}:${lineId}`,
    view,
    source,
    target,
    amountPlanDollars,
    underlyingLineIds: [lineId],
    flag,
  }
}

function compareNodes(a: YearCashFlowSankeyNode, b: YearCashFlowSankeyNode): number {
  const side = SIDE_ORDER.indexOf(a.side) - SIDE_ORDER.indexOf(b.side)
  if (side !== 0) return side
  if (a.side === 'source') {
    const role = SOURCE_ROLE_ORDER.indexOf(a.role as (typeof SOURCE_ROLE_ORDER)[number])
      - SOURCE_ROLE_ORDER.indexOf(b.role as (typeof SOURCE_ROLE_ORDER)[number])
    if (role !== 0) return role
    const kind = indexOfKind(SOURCE_KIND_ORDER, a.kind) - indexOfKind(SOURCE_KIND_ORDER, b.kind)
    if (kind !== 0) return kind
  } else if (a.side === 'fundedUse' || a.side === 'unfundedUse') {
    const kind = indexOfKind(USE_KIND_ORDER, a.kind) - indexOfKind(USE_KIND_ORDER, b.kind)
    if (kind !== 0) return kind
  }
  return compareId(a.id, b.id)
}

function compareLinks(a: YearCashFlowSankeyLink, b: YearCashFlowSankeyLink): number {
  const source = compareId(a.source, b.source)
  if (source !== 0) return source
  const target = compareId(a.target, b.target)
  if (target !== 0) return target
  return compareId(a.id, b.id)
}

function buildCashFlowView(index: PlanIndex, cashFlow: YearCashFlow): YearCashFlowSankeyView {
  const nodes: YearCashFlowSankeyNode[] = []
  const links: YearCashFlowSankeyLink[] = []
  let sourceTotal = 0
  let unfundedTotal = 0

  for (const line of cashFlow.sourceLines) {
    const role = sourceRole(line)
    if (role === null) continue
    const kindLabel = SOURCE_KIND_LABEL[line.kind]
    const resolved = resolveLineLabel(index, line.identities, kindLabel)
    sourceTotal += line.amountPlanDollars
    nodes.push(makeNode({
      id: line.id,
      view: 'cashFlow',
      side: 'source',
      role,
      kind: line.kind,
      kindLabel,
      personKey: resolved.personKey,
      personLabel: resolved.personLabel,
      label: resolved.label,
      amountPlanDollars: line.amountPlanDollars,
      underlyingLineIds: [line.id],
      unresolved: resolved.unresolved,
    }))
    if (line.amountPlanDollars > 0) {
      links.push(makeLink('cashFlow', line.id, HOUSEHOLD_CASH_NODE_ID, line.amountPlanDollars, line.id))
    }
  }

  nodes.push(makeNode({
    id: HOUSEHOLD_CASH_NODE_ID,
    view: 'cashFlow',
    side: 'hub',
    role: 'householdCash',
    kind: 'householdCash',
    kindLabel: 'Household cash',
    personKey: 'household',
    personLabel: 'Household',
    label: 'Household cash',
    amountPlanDollars: sourceTotal,
    underlyingLineIds: [],
    unresolved: false,
  }))

  for (const line of cashFlow.useLines) {
    const kindLabel = USE_KIND_LABEL[line.kind]
    const resolved = resolveLineLabel(index, line.identities, kindLabel)
    if (line.fundedPlanDollars > 0) {
      nodes.push(makeNode({
        id: line.id,
        view: 'cashFlow',
        side: 'fundedUse',
        role: 'fundedUse',
        kind: line.kind,
        kindLabel,
        personKey: resolved.personKey,
        personLabel: resolved.personLabel,
        label: resolved.label,
        amountPlanDollars: line.fundedPlanDollars,
        underlyingLineIds: [line.id],
        unresolved: resolved.unresolved,
      }))
      links.push(makeLink('cashFlow', HOUSEHOLD_CASH_NODE_ID, line.id, line.fundedPlanDollars, line.id))
    }
    if (line.unfundedPlanDollars > 0) {
      unfundedTotal += line.unfundedPlanDollars
      const unfundedId = `unfunded:${line.id}`
      nodes.push(makeNode({
        id: unfundedId,
        view: 'cashFlow',
        side: 'unfundedUse',
        role: 'unfundedUse',
        kind: line.kind,
        kindLabel,
        personKey: resolved.personKey,
        personLabel: resolved.personLabel,
        label: resolved.label,
        amountPlanDollars: line.unfundedPlanDollars,
        underlyingLineIds: [line.id],
        unresolved: resolved.unresolved,
        flag: resolved.unresolved ? 'unresolved' : 'unfunded',
      }))
      links.push(makeLink('cashFlow', UNFUNDED_ORIGIN_NODE_ID, unfundedId, line.unfundedPlanDollars, line.id, 'unfunded'))
    }
  }

  if (unfundedTotal > 0) {
    nodes.push(makeNode({
      id: UNFUNDED_ORIGIN_NODE_ID,
      view: 'cashFlow',
      side: 'unfundedOrigin',
      role: 'unfundedOrigin',
      kind: 'unfunded',
      kindLabel: 'Unfunded',
      personKey: 'household',
      personLabel: 'Household',
      label: 'Unfunded',
      amountPlanDollars: unfundedTotal,
      underlyingLineIds: [],
      unresolved: false,
      flag: 'unfunded',
    }))
  }

  nodes.sort(compareNodes)
  links.sort(compareLinks)
  return { nodes, links }
}

function buildTransfersView(index: PlanIndex, cashFlow: YearCashFlow): YearCashFlowSankeyView {
  const nodeById = new Map<string, YearCashFlowSankeyNode>()
  const links: YearCashFlowSankeyLink[] = []

  const takeEndpoint = (endpoint: YearCashFlowTransferEndpoint, amount: number, lineId: string) => {
    const id = endpointNodeId(endpoint)
    const resolved = resolveEndpoint(index, endpoint)
    const existing = nodeById.get(id)
    if (existing) {
      nodeById.set(id, {
        ...existing,
        amountPlanDollars: existing.amountPlanDollars + amount,
        underlyingLineIds: [...existing.underlyingLineIds, lineId],
        unresolved: existing.unresolved || resolved.unresolved,
        flag: existing.unresolved || resolved.unresolved ? 'unresolved' : existing.flag,
      })
      return id
    }
    nodeById.set(id, makeNode({
      id,
      view: 'transfers',
      side: 'transfer',
      role: 'transferEndpoint',
      kind: endpoint.entityKind,
      kindLabel: resolved.label,
      personKey: resolved.personKey,
      personLabel: resolved.personLabel,
      label: resolved.label,
      amountPlanDollars: amount,
      underlyingLineIds: [lineId],
      unresolved: resolved.unresolved,
    }))
    return id
  }

  for (const line of cashFlow.transferLines) {
    const amount = line.debitPlanDollars
    const source = takeEndpoint(line.source, amount, line.id)
    const target = takeEndpoint(line.destination, amount, line.id)
    if (amount > 0) {
      const unresolved = (nodeById.get(source)?.unresolved ?? false) || (nodeById.get(target)?.unresolved ?? false)
      links.push(makeLink(
        'transfers',
        source,
        target,
        amount,
        line.id,
        unresolved ? 'unresolved' : null,
      ))
    }
  }

  const nodes = [...nodeById.values()].sort(compareNodes)
  links.sort(compareLinks)
  return { nodes, links }
}

function sortView(view: YearCashFlowSankeyView): YearCashFlowSankeyView {
  return {
    nodes: [...view.nodes].sort(compareNodes),
    links: [...view.links].sort(compareLinks),
  }
}

function unavailable(
  year: number,
  unavailableReason: YearCashFlowUnavailableReason,
  reasonCodes: readonly YearCashFlowReconciliationReasonCode[],
  diagnostics: readonly Readonly<YearCashFlowReconciliationDiagnostic>[],
): YearCashFlowSankeyUnavailable {
  return { kind: 'unavailable', year, unavailableReason, reasonCodes, diagnostics }
}

/**
 * Build the two-view Sankey model and the accessible table for one projection
 * year. Amounts are the engine's nominal Plan dollars; pass a display
 * transform later, in the component layer, rather than converting here.
 */
export function buildYearCashFlowSankey(
  plan: Plan,
  yearResult: Pick<YearResult, 'year' | 'cashFlow'>,
  options: BuildYearCashFlowSankeyOptions = {},
): YearCashFlowSankeyModel {
  const cashFlow = yearResult.cashFlow
  if (cashFlow === undefined) {
    return unavailable(yearResult.year, 'notCaptured', [], [])
  }
  if (cashFlow.reconciliation.status === 'notReconciled') {
    return unavailable(
      yearResult.year,
      'notReconciled',
      cashFlow.reconciliation.reasonCodes,
      cashFlow.reconciliation.diagnostics,
    )
  }

  const index = buildPlanIndex(plan)
  const showAll = options.showAll === true
  const table = buildTable(index, cashFlow)
  const cashFlowView = applyYearCashFlowGrouping(buildCashFlowView(index, cashFlow), options)
  const transfersView = buildTransfersView(index, cashFlow)

  return {
    kind: 'ready',
    year: yearResult.year,
    showAll,
    views: {
      cashFlow: sortView(cashFlowView),
      transfers: sortView(transfersView),
    },
    table,
    reconciliation: cashFlow.reconciliation,
  }
}
