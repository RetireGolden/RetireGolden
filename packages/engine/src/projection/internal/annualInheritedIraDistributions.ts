/**
 * Plan one year's inherited-account required distributions without mutating
 * simulator state. Classification remains simulation-scoped; this boundary
 * consumes that cache, derives the year's evidence and §4974 obligations, and
 * returns ordered balance writes for the caller to journal and apply.
 */
import type { Account } from '../../model/plan.js'
import type { ParameterPack } from '../../params/types.js'
import {
  rmdApplicablePlanKey,
  rmdShortfallObligationId,
  type RmdApplicablePlan,
} from '../../rmd/rmdShortfallExcise.js'
import { rmdApplicablePlanForAccount } from '../../rmd/rmdApplicablePlanForAccount.js'
import {
  inheritedForcedAmount,
  inheritedRequirementForYear,
  type InheritedRegimeClassification,
  type InheritedRegimeResult,
} from '../../strategies/inheritedIra.js'
import { isTreatAsOwnEffective } from '../../strategies/accountEligibility.js'
import { planDollarsMoveNoLedgerCent } from '../../actions/index.js'
import type { InheritedAccountYearEvidence } from '../types.js'

export interface AnnualInheritedIraClassCacheEntry {
  readonly accountId: string
  readonly accountType: 'traditional' | 'roth'
  readonly ownerPersonId: string
  readonly path: 'legacy' | 'classified'
  readonly refusalReason?: string
  /** Primary classifier result (regime or refusal). */
  readonly primary: InheritedRegimeResult
  /** Synthetic S0 for the S2 pre-election window; primary otherwise. */
  readonly schedule?: InheritedRegimeClassification
  readonly isS2: boolean
  readonly treatAsOwnElectionYear?: number
  readonly preHorizonYearOfDeathRmdUnresolved?: boolean
}

export interface AnnualInheritedIraBalanceState {
  readonly account: Readonly<Account>
  readonly balance: number
}

export interface AnnualInheritedIraDistributionOperation {
  readonly balanceIndex: number
  readonly accountId: string
  readonly ownerPersonId: string | null
  readonly sourceBalanceBefore: number
  readonly sourceBalanceAfter: number
  readonly executed: number
}

export interface AnnualInheritedIraRow {
  readonly balanceIndex: number
  readonly accountId: string
  readonly distribution: AnnualInheritedIraDistributionOperation | null
  /**
   * The caller freezes this helper snapshot. Later voluntary amounts are
   * published by replacing the evidence row, never by mutating this object.
   */
  readonly evidence: InheritedAccountYearEvidence
}

type RmdShortfallObligation = Readonly<{
  obligationId: string
  distributionCalendarYear: number
  taxYear: number
  taxImposedOn: string
  applicablePlan: RmdApplicablePlan
  requirementKind:
    | 'inheritedAnnualLifeExpectancy'
    | 'inheritedYearOfDeath'
    | 'inheritedFinalSweep'
    | 'inheritedLegacy'
    | 'mixedInheritedRequirements'
  requiredAmount: number
  distributedByDeadline: number
}>

export interface AnnualInheritedIraDistributionsInput {
  readonly year: number
  readonly startYear: number
  readonly pack: ParameterPack
  readonly primaryPersonId: string
  /** One aggregate live row per compatible logical account ID, in first-ID order. */
  readonly balances: readonly AnnualInheritedIraBalanceState[]
  /** Aggregate prior-Dec-31 balance by logical account ID. */
  readonly startOfYearBalance: ReadonlyMap<string, number>
  readonly classCache: ReadonlyMap<string, AnnualInheritedIraClassCacheEntry>
  readonly beneficiaryState: (personId: string) => Readonly<{
    alive: boolean
    ageAttained: number
  }>
}

export interface AnnualInheritedIraDistributionsResult {
  readonly totals: Readonly<{
    inherited: number
    ordinaryIncome: number
    rothForced: number
  }>
  readonly rows: readonly AnnualInheritedIraRow[]
  readonly rmdShortfallObligations: readonly RmdShortfallObligation[]
}

export function annualInheritedIraDistributions(
  input: AnnualInheritedIraDistributionsInput,
): AnnualInheritedIraDistributionsResult {
  const logicalIds = new Set<string>()
  for (const state of input.balances) {
    if (logicalIds.has(state.account.id)) {
      throw new Error(
        `annual inherited-IRA input repeated logical account id "${state.account.id}"`,
      )
    }
    logicalIds.add(state.account.id)
    if (!Number.isFinite(state.balance) || state.balance < 0) {
      throw new Error(
        `annual inherited-IRA balance for account id "${state.account.id}" must be finite and nonnegative`,
      )
    }
    const opening = input.startOfYearBalance.get(state.account.id)
    if (opening !== undefined && (!Number.isFinite(opening) || opening < 0)) {
      throw new Error(
        `annual inherited-IRA opening balance for account id "${state.account.id}" must be finite and nonnegative`,
      )
    }
  }

  let inherited = 0
  let ordinaryIncome = 0
  let rothForced = 0
  const rows: AnnualInheritedIraRow[] = []

  const addRow = (
    balanceIndex: number,
    state: Readonly<AnnualInheritedIraBalanceState>,
    evidence: InheritedAccountYearEvidence,
    executed: number,
  ): void => {
    let distribution: AnnualInheritedIraDistributionOperation | null = null
    if (executed > 0) {
      const sourceBalanceAfter = state.balance - executed
      distribution = {
        balanceIndex,
        accountId: state.account.id,
        ownerPersonId: state.account.ownerPersonId,
        sourceBalanceBefore: state.balance,
        sourceBalanceAfter,
        executed,
      }
      if (state.account.type === 'roth') rothForced += executed
      else ordinaryIncome += executed
      inherited += executed
    }
    rows.push({
      balanceIndex,
      accountId: state.account.id,
      distribution,
      evidence,
    })
  }

  for (const [balanceIndex, state] of input.balances.entries()) {
    if (
      state.account.type !== 'traditional' &&
      state.account.type !== 'roth'
    ) continue
    if (state.account.inherited === undefined) continue
    const cache = input.classCache.get(state.account.id)
    if (cache === undefined) continue
    const beneficiaryPersonId =
      state.account.ownerPersonId ?? input.primaryPersonId
    const beneficiaryState = input.beneficiaryState(beneficiaryPersonId)

    if (!beneficiaryState.alive) {
      const primaryClass =
        cache.primary.kind === 'regime' ? cache.primary : undefined
      addRow(balanceIndex, state, {
        accountId: state.account.id,
        ownerPersonId: cache.ownerPersonId,
        regime: primaryClass?.regime ??
          (cache.primary.kind === 'refusal'
            ? cache.primary.refusal
            : 'unsupported'),
        matrixRow: primaryClass?.row ??
          (cache.primary.kind === 'refusal' ? cache.primary.row : 'X2'),
        ...(primaryClass !== undefined
          ? { classification: primaryClass.classification }
          : {}),
        refusalReason:
          'beneficiary death starts the successor 10-year clock (IRC §401(a)(9)(H)(iii); Treas. Reg. §1.401(a)(9)-5(e)(3); matrix X2); successor schedules are out of scope',
        requirementKind: 'none',
        requiredAmount: 0,
        executedRequiredAmount: 0,
        voluntaryAmount: 0,
        disclosures: ['successor-clock-out-of-scope'],
        citations: primaryClass?.citations ??
          (cache.primary.kind === 'refusal'
            ? cache.primary.citations
            : [
                'IRC §401(a)(9)(H)(iii)',
                'Treas. Reg. §1.401(a)(9)-5(e)(3)',
              ]),
      }, 0)
      continue
    }

    if (isTreatAsOwnEffective(state.account, input.year)) {
      // A death-year election becomes effective the following year, so its
      // unsatisfied year-of-death RMD stays on the schedule path below.
      const primaryClass =
        cache.primary.kind === 'regime' ? cache.primary : undefined
      const preHorizonLimitation =
        input.year === input.startYear &&
          cache.preHorizonYearOfDeathRmdUnresolved === true
          ? 'pre-horizon-year-of-death-rmd-unresolved' as const
          : undefined
      addRow(balanceIndex, state, {
        accountId: state.account.id,
        ownerPersonId: cache.ownerPersonId,
        regime: primaryClass?.regime ??
          (cache.primary.kind === 'refusal'
            ? cache.primary.refusal
            : 'spouse-treat-as-own-transition'),
        matrixRow: primaryClass?.row ??
          (cache.primary.kind === 'refusal' ? cache.primary.row : 'S2'),
        ...(primaryClass !== undefined
          ? { classification: primaryClass.classification }
          : {}),
        requirementKind: 'none',
        requiredAmount: 0,
        executedRequiredAmount: 0,
        voluntaryAmount: 0,
        ...(preHorizonLimitation !== undefined
          ? { limitation: preHorizonLimitation }
          : {}),
        disclosures: primaryClass?.disclosures ?? [],
        citations: primaryClass?.citations ??
          (cache.primary.kind === 'refusal' ? cache.primary.citations : []),
      }, 0)
      continue
    }

    const priorYearEndBalance =
      input.startOfYearBalance.get(state.account.id) ?? 0
    let take: number
    let requirementKind: InheritedAccountYearEvidence['requirementKind']
    let requiredAmount: number
    let divisor: number | undefined
    let divisorArm: string | undefined
    let noticeWaived: boolean | undefined
    let limitation: string | undefined
    let regime: string
    let matrixRow: string
    let classification: 'settled' | 'unsettled' | undefined
    let disclosures: string[]
    let citations: string[]
    let finalDeadlineYear: number | undefined
    const refusalReason = cache.refusalReason

    if (cache.path === 'legacy' || cache.schedule === undefined) {
      take = inheritedForcedAmount({
        pack: input.pack,
        year: input.year,
        ownerDeathYear: state.account.inherited.ownerDeathYear,
        decedentHadStartedRmds:
          state.account.inherited.decedentHadStartedRmds,
        balance: state.balance,
        startBalance: priorYearEndBalance,
        beneficiaryAge: beneficiaryState.ageAttained,
      })
      requiredAmount = take
      requirementKind = 'legacy'
      if (cache.primary.kind === 'refusal') {
        regime = cache.primary.refusal
        matrixRow = cache.primary.row
        citations = cache.primary.citations
        disclosures = []
      } else {
        regime = 'needs-review'
        matrixRow = 'X5'
        citations = cache.primary.citations
        disclosures = []
      }
    } else {
      const scheduleClass = cache.schedule
      const inheritedForReq =
        cache.isS2 && state.account.inherited.beneficiary
          ? {
              ...state.account.inherited,
              beneficiary: {
                ...state.account.inherited.beneficiary,
                election: 'none' as const,
              },
            }
          : state.account.inherited
      const req = inheritedRequirementForYear({
        pack: input.pack,
        classification: scheduleClass,
        inherited: inheritedForReq,
        year: input.year,
        priorYearEndBalance,
      })
      requirementKind = req.kind
      requiredAmount = req.requiredAmount
      divisor = req.divisor
      divisorArm = req.divisorArm
      noticeWaived = req.noticeWaived
      limitation = req.limitation
      if (req.kind === 'final-sweep') {
        take = req.noticeWaived === true ? 0 : state.balance
      } else if (req.kind === 'none' || req.noticeWaived === true) {
        take = 0
      } else {
        take = Math.min(req.requiredAmount, state.balance)
      }
      regime = scheduleClass.regime
      matrixRow = scheduleClass.row
      classification = scheduleClass.classification
      disclosures = [...scheduleClass.disclosures]
      citations = [...req.citations]
      finalDeadlineYear = scheduleClass.finalDeadlineYear
    }

    const beneficiaryForIdentity = state.account.inherited.beneficiary
    if (
      cache.isS2 &&
      cache.primary.kind === 'regime' &&
      beneficiaryForIdentity?.election === 'treat-as-own' &&
      beneficiaryForIdentity.treatAsOwnElectionYear ===
        state.account.inherited.ownerDeathYear &&
      input.year === state.account.inherited.ownerDeathYear
    ) {
      regime = cache.primary.regime
      matrixRow = cache.primary.row
      classification = cache.primary.classification
      disclosures = [...cache.primary.disclosures]
    }

    if (
      input.year === input.startYear &&
      cache.preHorizonYearOfDeathRmdUnresolved === true
    ) {
      limitation = 'pre-horizon-year-of-death-rmd-unresolved'
    }

    const executed =
      take > 0 && !planDollarsMoveNoLedgerCent(take) ? take : 0
    addRow(balanceIndex, state, {
      accountId: state.account.id,
      ownerPersonId: cache.ownerPersonId,
      regime,
      matrixRow,
      ...(classification !== undefined ? { classification } : {}),
      ...(refusalReason !== undefined ? { refusalReason } : {}),
      requirementKind,
      requiredAmount,
      executedRequiredAmount: executed,
      voluntaryAmount: 0,
      ...(divisor !== undefined ? { divisor } : {}),
      ...(divisorArm !== undefined ? { divisorArm } : {}),
      ...(noticeWaived !== undefined ? { noticeWaived } : {}),
      ...(limitation !== undefined ? { limitation } : {}),
      ...(finalDeadlineYear !== undefined ? { finalDeadlineYear } : {}),
      disclosures,
      citations,
    }, executed)
  }

  const requiredByApplicablePlan = new Map<string, number>()
  const distributedByApplicablePlan = new Map<string, number>()
  const requirementKindsByApplicablePlan = new Map<
    string,
    Set<RmdShortfallObligation['requirementKind']>
  >()
  const applicablePlanByKey = new Map<string, RmdApplicablePlan>()
  for (const { evidence, balanceIndex } of rows) {
    if (evidence.requiredAmount <= 0 || evidence.noticeWaived === true) continue
    const account = input.balances[balanceIndex]?.account
    if (
      account === undefined ||
      (account.type !== 'traditional' && account.type !== 'roth') ||
      account.inherited === undefined
    ) continue
    const applicablePlan = rmdApplicablePlanForAccount(
      account,
      input.primaryPersonId,
    )
    const applicablePlanKey = rmdApplicablePlanKey(applicablePlan)
    applicablePlanByKey.set(applicablePlanKey, applicablePlan)
    requiredByApplicablePlan.set(
      applicablePlanKey,
      (requiredByApplicablePlan.get(applicablePlanKey) ?? 0) +
        evidence.requiredAmount,
    )
    distributedByApplicablePlan.set(
      applicablePlanKey,
      (distributedByApplicablePlan.get(applicablePlanKey) ?? 0) +
        evidence.executedRequiredAmount,
    )
    const requirementKind = evidence.requirementKind === 'annual-rmd'
      ? 'inheritedAnnualLifeExpectancy' as const
      : evidence.requirementKind === 'year-of-death-rmd'
        ? 'inheritedYearOfDeath' as const
        : evidence.requirementKind === 'final-sweep'
          ? 'inheritedFinalSweep' as const
          : 'inheritedLegacy' as const
    const kinds = requirementKindsByApplicablePlan.get(applicablePlanKey) ??
      new Set<RmdShortfallObligation['requirementKind']>()
    kinds.add(requirementKind)
    requirementKindsByApplicablePlan.set(applicablePlanKey, kinds)
  }

  const rmdShortfallObligations: RmdShortfallObligation[] = []
  for (const [applicablePlanKey, requiredAmount] of requiredByApplicablePlan) {
    const applicablePlan = applicablePlanByKey.get(applicablePlanKey)!
    const requirementKinds =
      requirementKindsByApplicablePlan.get(applicablePlanKey)!
    const actuallyDistributed =
      distributedByApplicablePlan.get(applicablePlanKey) ?? 0
    rmdShortfallObligations.push({
      obligationId: rmdShortfallObligationId(applicablePlan, input.year),
      distributionCalendarYear: input.year,
      taxYear: input.year,
      taxImposedOn: `${input.year}-12-31`,
      applicablePlan,
      requirementKind: requirementKinds.size === 1
        ? [...requirementKinds][0]!
        : 'mixedInheritedRequirements',
      requiredAmount,
      distributedByDeadline: actuallyDistributed,
    })
  }

  return {
    totals: { inherited, ordinaryIncome, rothForced },
    rows,
    rmdShortfallObligations,
  }
}
