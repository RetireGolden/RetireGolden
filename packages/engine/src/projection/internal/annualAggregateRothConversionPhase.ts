import type { Account, Person, Plan } from '../../model/plan.js'
import type { ParameterPack } from '../../params/types.js'
import type { IraProRataYear } from '../../strategies/iraBasis.js'
import type { SimulatorAnnualRetirementRuntimeOccurrence } from '../annualRetirementRuntimeJournal.js'
import type {
  PersonYearState,
  ProjectedFilingStatus,
  SimulatorRetirementRuntimeApplication,
  TaxCalculator,
} from '../types.js'

import { stateForYear, stateResidencySegmentsForYear } from '../../model/plan.js'

import {
  isAggregatedIra,
  isConvertibleToRoth,
  isSpendableInYear,
  type RothConversionSourceContext,
} from '../../strategies/accountEligibility.js'
import { applyCapitalLossCarryforward } from '../../tax/federalTax.js'
import { stateParamsFor } from '../../params/state/index.js'
import { ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS } from '../moneyTolerance.js'
import { type RothBasisState } from '../../strategies/rothBasis.js'
import {
  annualAggregateRothConversionPlan,
  withAnnualAggregateRothConversionReservations,
} from './annualAggregateRothConversionPlan.js'
import {
  annualAggregateRothConversionTargetPlan,
  type AnnualAggregateRothConversionTargetPlanResult,
} from './annualAggregateRothConversionTargetPlan.js'
import type { OwnedNonRothIraAnnualSettlementEffect } from '../../internal/ownedNonRothIraAnnualAttemptSettlement.js'
import { ledgerCentsToPlanDollars } from '../../actions/index.js'
import type { PhysicalBalanceState } from './annualLogicalBalanceLedger.js'
import type { FilingStatus } from '../../params/types.js'
import type { AnnualForcedDistributionQcdRetirementActionsResult }
  from './annualForcedDistributionQcdAndRetirementActions.js'
import { annualRothBasisPoolKey } from './annualRothBasisPoolKey.js'

type SimulatorRetirementRuntimeApplicationWithoutOrdinal =
  SimulatorRetirementRuntimeApplication extends infer Application
  ? Application extends SimulatorRetirementRuntimeApplication
  ? Omit<Application, 'mutationOrdinal'>
  : never
  : never

type AcaContractYear = NonNullable<
  NonNullable<Plan['expenses']['healthcare']['acaYears']>[number]
>

const EPSILON = ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS

export interface AnnualAggregateRothConversionPhaseFacts {
  readonly year: number
  readonly pack: Readonly<ParameterPack>
  readonly plan: Readonly<Plan>
  readonly primary: Readonly<Person>
  readonly personById: ReadonlyMap<string, Readonly<Person>>
  readonly peopleStates: readonly Readonly<PersonYearState>[]
  readonly anyAlive: boolean
  readonly aliveCount: number
  readonly inflFactor: number
  readonly limitGrowth: number
  readonly taxFilingStatusForYear: FilingStatus
  readonly filingStatusForYear: ProjectedFilingStatus
  readonly safetyNetFloorToday: number
  readonly taxCalculator: TaxCalculator
  readonly ordinaryIncome: number
  readonly preTaxContributions: number
  readonly oneTimeGains: number
  readonly rebalanceRealizedGains: number
  readonly privateRetirementOrdinary: number
  readonly publicPensionOrdinary: number
  readonly propertySaleProceedsTotal: number
  readonly contributions: number
  readonly expensesTotal: number
  readonly incomes: Readonly<{
    readonly total: number
    readonly taxableInterest: number
    readonly ordinaryDividends: number
    readonly qualifiedDividends: number
    readonly socialSecurity: number
    readonly taxExemptInterest: number
  }>
  readonly taxableYieldReinvested: number
  readonly ladderTaxableInterest: number
  readonly capitalLossPool: number
  readonly acaActive: boolean
  readonly acaContract: AcaContractYear | undefined
  readonly acaInitialSupportCodes: readonly string[]
  readonly planHasTaxExemptYieldAttestation: boolean
  readonly assumedEffects: readonly Readonly<OwnedNonRothIraAnnualSettlementEffect>[]
  readonly inflFactorFrom: (packYear: number, projectionYear: number) => number
}

export interface AnnualAggregateRothConversionPhaseLedger {
  readonly balances: PhysicalBalanceState[]
  readonly annualIdKeyedBalances: PhysicalBalanceState[]
  readonly iraProRata: Map<string, IraProRataYear>
  readonly rothBasis: Map<string, RothBasisState>
  readonly warnings: Set<string>
}

export interface AnnualAggregateRothConversionPhaseCallbacks {
  readonly stateOf: (personId: string) => Readonly<PersonYearState>
  readonly splitWithAssumedCharacter: (
    state: IraProRataYear,
    amount: number,
    input: Readonly<{
      ownerPersonId: string
      calculationScope:
      | 'form8606Line7Distributions'
      | 'form8606Line8NetConversions'
      occurrenceKind:
      | 'ownedIraRmd'
      | 'annuityContractDistribution'
      | 'automaticSeppDistribution'
      | 'legacyNeedBasedWithdrawal'
      | 'legacyQcd'
      | 'legacyRothConversion'
      | 'namedRothConversion'
      producerOccurrenceKey: string
      sourceAccountId: string
      mutationOrdinal: number
    }>,
  ) => {
    readonly nontaxable: number
    readonly taxable: number
    readonly next: IraProRataYear
  }
  readonly noteForm8606Taxable: (
    ownerPersonId: string,
    taxable: number,
    channel: 'distributions' | 'conversions' | 'annuityPayments',
  ) => void
  readonly recordAnnualRetirementRuntimeOccurrence: (
    occurrence: Readonly<SimulatorAnnualRetirementRuntimeOccurrence>,
  ) => void
  readonly recordAnnualRetirementRuntimeApplication: (
    application: SimulatorRetirementRuntimeApplicationWithoutOrdinal,
  ) => SimulatorRetirementRuntimeApplication
  readonly runtimeOccurrenceKey: (
    kind: SimulatorAnnualRetirementRuntimeOccurrence['kind'],
    ...binding: readonly unknown[]
  ) => string
}

export interface AnnualAggregateRothConversionPhaseCapture {
  aggregateConversionDraws: {
    ownerPersonId: string
    sourceAccountId: string
    destinationAccountId: string
    amount: number
    nontaxable: number
  }[]
}

export interface AnnualAggregateRothConversionPhaseInput {
  readonly facts: AnnualAggregateRothConversionPhaseFacts
  readonly prior: AnnualForcedDistributionQcdRetirementActionsResult
  readonly ledger: AnnualAggregateRothConversionPhaseLedger
  readonly callbacks: AnnualAggregateRothConversionPhaseCallbacks
  readonly capture: AnnualAggregateRothConversionPhaseCapture | null
}

export interface AnnualAggregateRothConversionPhaseResult {
  readonly incomeBeforeConversion: number
  readonly itemizedDeductions:
  | { stateAndLocalTaxes: number; mortgageInterest: number; charitable: number }
  | undefined
  readonly residenceState: string
  readonly stateResidency: ReturnType<typeof stateResidencySegmentsForYear>
  readonly agesAlive: number[]
  readonly privateRetirementBase: number
  readonly publicPensionBase: number
  readonly generatedTaxExemptInterest: number
  readonly planDerivedTaxExemptInterest: boolean
  readonly yearTaxExemptInterest: number
  readonly acaForeignExclusionAddback: number
  readonly preWithdrawalCapitalResult: number
  readonly netCapitalForPreWithdrawalSizing: number
  readonly peopleAged65Plus: number
  readonly rothConversion: number
  readonly conversionNontaxable: number
  readonly totalRothConversion: number
  readonly totalRothConversionTaxable: number
  readonly aggregateRothConversionTarget: AnnualAggregateRothConversionTargetPlanResult
  readonly aggregateRothConversionAllocationBalances:
  Readonly<Record<string, number>> | undefined
  readonly aggregateRothConversionAllocationDesired: number | undefined
  readonly yearConvertibleToRoth: (
    account: Account,
  ) => account is Extract<Account, { type: 'traditional' }>
  readonly ownedIraConversionTaxableFraction: (ownerPersonId: string) => number
}

export function annualAggregateRothConversionPhase(
  input: AnnualAggregateRothConversionPhaseInput,
): AnnualAggregateRothConversionPhaseResult {
  const { facts, prior, ledger, callbacks, capture } = input
  const {
    year,
    pack,
    plan,
    primary,
    personById,
    peopleStates,
    anyAlive,
    aliveCount,
    inflFactor,
    limitGrowth,
    taxFilingStatusForYear,
    filingStatusForYear,
    safetyNetFloorToday,
    taxCalculator,
    ordinaryIncome,
    preTaxContributions,
    oneTimeGains,
    rebalanceRealizedGains,
    privateRetirementOrdinary,
    publicPensionOrdinary,
    propertySaleProceedsTotal,
    contributions,
    expensesTotal,
    incomes,
    taxableYieldReinvested,
    ladderTaxableInterest,
    capitalLossPool,
    acaActive,
    acaContract,
    acaInitialSupportCodes,
    planHasTaxExemptYieldAttestation,
    assumedEffects,
    inflFactorFrom,
  } = facts
  const {
    rmdTotal,
    rmdNontaxable,
    seppTotal,
    seppNontaxable,
    inheritedTotal,
    inheritedOrdinaryIncome,
    qcdIncomeOffset,
    qcdNonQualifiedOrdinaryIncome,
    qcdFromRmd,
    namedQcdRmdSatisfied,
    namedQcdIncomeOffset,
    annuityPaymentNontaxable,
    retirementActionOrdinaryIncome,
    retirementActionProceeds,
    retirementActionCapitalGainOrLoss,
    namedRothConversionExecuted,
    namedRothConversionNontaxable,
    currentYearConversionActions,
    iraRmdUnsatisfiedByOwner,
  } = prior
  const {
    balances,
    annualIdKeyedBalances,
    iraProRata,
    rothBasis,
    warnings,
  } = ledger
  const {
    stateOf,
    splitWithAssumedCharacter,
    noteForm8606Taxable,
    recordAnnualRetirementRuntimeOccurrence,
    recordAnnualRetirementRuntimeApplication,
    runtimeOccurrenceKey,
  } = callbacks
  const publishCashFlow = capture !== null
  const aggregateConversionDraws = capture?.aggregateConversionDraws ?? null
  const rmdBalances = annualIdKeyedBalances
  let conversionNontaxable = 0
  const rothPoolKey = (
    account: Extract<Account, { type: 'roth' }>,
  ): string =>
    annualRothBasisPoolKey(account, primary.id)
  // --- Roth conversions (after RMDs — RMDs must be satisfied first) -------
  const peopleAged65Plus = peopleStates.filter((s) => s.alive && s.ageAttained >= 65).length
  // Forced IRA distributions count only their taxable (post-pro-rata) part as
  // ordinary income. The QCD subtraction is qcdIncomeOffset, not the whole
  // gift: 408(d)(8)(D) treats a distribution as a QCD only to the extent it
  // would otherwise be includible, so the offset carries only the routed
  // dollars that qualified — the beyond-RMD part never entered income at all,
  // and an excess over the owner's aggregate includible amount is not a QCD
  // and arrives on `qcdNonQualifiedOrdinaryIncome` instead.
  const incomeBeforeConversion =
    ordinaryIncome -
    preTaxContributions +
    rmdTotal -
    rmdNontaxable -
    // The annuity payment entered `ordinaryIncome` at its full face amount in
    // the income block, which had no year fraction to price it with. This is
    // the basis share 408(d)(2)(B) gives it, coming back out.
    annuityPaymentNontaxable -
    qcdIncomeOffset -
    namedQcdIncomeOffset +
    qcdNonQualifiedOrdinaryIncome +
    seppTotal -
    seppNontaxable +
    inheritedOrdinaryIncome +
    retirementActionOrdinaryIncome

  // Itemized deductions (today's $ → nominal). The user's SALT estimate grows
  // with general inflation, like spending; federal tax takes the greater of
  // this and the standard deduction. Built here so the conversion/bracket
  // sizers below target the same deduction the tax engine will use.
  const itm = plan.strategies.itemizedDeductions
  const itemizedDeductions = itm
    ? {
      stateAndLocalTaxes: itm.stateAndLocalTaxes * inflFactor,
      mortgageInterest: itm.mortgageInterest * inflFactor,
      charitable: itm.charitable * inflFactor,
    }
    : undefined

  // State-tax inputs (resolved once per year, before conversions so the
  // safety-net trim below can price a conversion's full tax bill).
  // Retirement-income base = pension/annuity + taxable RMD/SEPP/inherited −
  // QCD; traditional spending withdrawals are added per iteration below.
  // Roth conversions are excluded (not exclusion-eligible).
  const residenceState = stateForYear(plan.household, year)
  const stateResidency = stateResidencySegmentsForYear(plan.household, year)
  const agesAlive = peopleStates.filter((s) => s.alive).map((s) => s.ageAttained)
  const privateRetirementBase = Math.max(
    0,
    privateRetirementOrdinary + rmdTotal - rmdNontaxable -
    annuityPaymentNontaxable - qcdIncomeOffset -
    namedQcdIncomeOffset + qcdNonQualifiedOrdinaryIncome +
    seppTotal - seppNontaxable + inheritedOrdinaryIncome,
  )
  const publicPensionBase = Math.max(0, publicPensionOrdinary)
  if (plan.assumptions.stateEffectiveTaxPct <= 0) {
    for (const segment of stateResidency) {
      if (stateParamsFor(segment.state, year)) continue
      warnings.add(
        `State "${segment.state}" isn't modeled for per-state tax yet, so state income tax was treated as $0. ` +
        'If it taxes income, set a flat effective rate under Assumptions to approximate it.',
      )
    }
  }
  const generatedTaxExemptInterest = incomes.taxExemptInterest
  const planDerivedTaxExemptInterest =
    planHasTaxExemptYieldAttestation && generatedTaxExemptInterest > 0
  // Characterization takes the max of the attested household total and the
  // plan-generated subset — never the sum (generated dollars sit inside the
  // attested total when the attestation is current), and never the attested
  // figure alone (a stale attestation must not hide income the plan produces).
  // Cash and balances always follow generated only.
  const yearTaxExemptInterest =
    acaActive && acaContract?.taxExemptInterest.state === 'known'
      ? Math.max(
        Math.max(0, acaContract.taxExemptInterest.amount ?? 0),
        generatedTaxExemptInterest,
      )
      : generatedTaxExemptInterest
  const acaForeignExclusionAddback =
    acaActive && acaContract?.foreignExclusionAddback.state === 'known'
      ? Math.max(0, acaContract.foreignExclusionAddback.amount ?? 0)
      : 0
  // Canonical signed current-year capital before any residual legacy
  // withdrawal sale. Exact-cent action character crosses into Plan dollars
  // once above; proceeds remain liquidity and are not income a second time.
  const preWithdrawalCapitalResult =
    oneTimeGains +
    rebalanceRealizedGains +
    retirementActionCapitalGainOrLoss
  const netCapitalForPreWithdrawalSizing =
    applyCapitalLossCarryforward(
      capitalLossPool,
      incomeBeforeConversion,
      preWithdrawalCapitalResult,
      pack.federalTax.capitalLossOrdinaryOffsetLimit,
    ).netCapitalGain

  const assumedLine8ByOwner = new Map<string, {
    gross: number
    taxable: number
  }>()
  for (const effect of assumedEffects) {
    if (effect.taxYear !== year ||
      effect.calculationScope !== 'form8606Line8NetConversions') continue
    const current = assumedLine8ByOwner.get(effect.ownerPersonId) ?? {
      gross: 0,
      taxable: 0,
    }
    current.gross += ledgerCentsToPlanDollars(effect.grossAmount)
    current.taxable += ledgerCentsToPlanDollars(
      effect.ordinaryIncomeAmount,
    )
    assumedLine8ByOwner.set(effect.ownerPersonId, current)
  }
  const conversionSourceContextForOwner = (
    ownerPersonId: string,
  ): RothConversionSourceContext => {
    const person = personById.get(ownerPersonId)
    return {
      ownerAgeAttained: person !== undefined ? stateOf(ownerPersonId).ageAttained : 0,
      ownerRetirementAge: person?.retirementAge ?? null,
    }
  }
  const yearConvertibleToRoth = (
    account: Account,
  ): account is Extract<Account, { type: 'traditional' }> =>
    isConvertibleToRoth(
      account,
      conversionSourceContextForOwner(account.ownerPersonId ?? primary.id),
    )
  const ownedIraConversionTaxableFraction = (ownerPersonId: string) => {
    const assumed = assumedLine8ByOwner.get(ownerPersonId)
    if (assumed !== undefined && assumed.gross > 0) {
      return Math.min(1, Math.max(0, assumed.taxable / assumed.gross))
    }
    return Math.min(
      1,
      Math.max(
        0,
        1 - (iraProRata.get(ownerPersonId)?.nontaxableFraction ?? 0),
      ),
    )
  }

  let rothConversion = 0
  /**
   * The snapshot the allocation policy weighted this year's owners by,
   * published on the year so the optimizer's promotion path can name the
   * same sources and the same cents the ledger moved instead of re-deriving
   * them. Set at the call below and nowhere else, which is what makes its
   * absence mean "the policy was never asked" -- see the field's own
   * contract on `YearResult`.
   */
  let aggregateRothConversionAllocationBalances:
    Readonly<Record<string, number>> | undefined
  /**
   * The household amount that policy was asked for, before it trimmed an
   * owner who has nowhere to convert to. Set at the same call as the
   * snapshot above and nowhere else, so the two are present together or
   * absent together. A promotion that re-allocated the EXECUTED total would
   * trim the absent owner a second time; this is the figure that reproduces
   * what the ledger did.
   */
  let aggregateRothConversionAllocationDesired: number | undefined
  const aggregateRothConversionTarget =
    annualAggregateRothConversionTargetPlan(Object.freeze({
      strategy: plan.strategies.rothConversion,
      namedConversionActionCount: currentYearConversionActions.length,
      anyAlive,
      year,
      readSources: () => rmdBalances.map((state) => {
        const convertible = yearConvertibleToRoth(state.account)
        return Object.freeze({
          balancePlanDollars: state.balance,
          convertible,
          taxableFraction: convertible && isAggregatedIra(state.account)
            ? ownedIraConversionTaxableFraction(
              state.account.ownerPersonId ?? primary.id,
            )
            : 1,
        })
      }),
      sizing: Object.freeze({
        pack,
        filingStatus: taxFilingStatusForYear,
        ordinaryIncomeBase: incomeBeforeConversion,
        capitalGains: netCapitalForPreWithdrawalSizing,
        qualifiedDividends: incomes.qualifiedDividends,
        ssBenefits: incomes.socialSecurity,
        peopleAged65Plus,
        householdSize: aliveCount,
        taxExemptInterest: yearTaxExemptInterest,
        inflationScale: inflFactorFrom(pack.year, year),
        itemizedDeductions,
        aca: Object.freeze({
          active: acaActive,
          contract: acaContract,
          initialSupportCodeCount: acaInitialSupportCodes.length,
          generatedTaxExemptInterest,
          planDerivedTaxExemptInterest,
          fallbackTaxFamilySize: aliveCount,
        }),
      }),
      safetyNet: Object.freeze({
        floorTodayPlanDollars: safetyNetFloorToday,
        inflationFactor: inflFactor,
        readSpendableLiquidBalances: () => balances.flatMap((state) =>
          state.account.type === 'cash' ||
            state.account.type === 'taxable' ||
            state.account.type === 'equityComp'
            ? [isSpendableInYear(state.account, year) ? state.balance : 0]
            : []),
        preConversionInflows:
          incomes.total -
          taxableYieldReinvested +
          rmdTotal -
          qcdFromRmd -
          namedQcdRmdSatisfied +
          seppTotal +
          inheritedTotal +
          propertySaleProceedsTotal +
          retirementActionProceeds,
        totalExpenses: expensesTotal,
        contributions,
        computeTaxForTaxableConversion: (extraOrdinary: number) => {
          const netted = applyCapitalLossCarryforward(
            capitalLossPool,
            Math.max(0, incomeBeforeConversion + extraOrdinary),
            preWithdrawalCapitalResult,
            pack.federalTax.capitalLossOrdinaryOffsetLimit,
          )
          return taxCalculator.compute({
            year,
            filingStatus: filingStatusForYear,
            ordinaryIncome: netted.ordinaryAfter,
            capitalGains: netted.netCapitalGain,
            realizedCapitalGainsBeforeCarryforward:
              preWithdrawalCapitalResult,
            taxableInterestIncome:
              incomes.taxableInterest + ladderTaxableInterest,
            taxExemptInterest: yearTaxExemptInterest,
            foreignExclusionAddback: acaForeignExclusionAddback,
            usGovernmentInterest: ladderTaxableInterest,
            ordinaryDividends: incomes.ordinaryDividends,
            qualifiedDividends: incomes.qualifiedDividends,
            ssBenefits: incomes.socialSecurity,
            peopleAged65Plus,
            inflationScale: limitGrowth,
            state: residenceState,
            stateResidency,
            privateRetirementIncome: privateRetirementBase,
            publicPensionIncome: publicPensionBase,
            agesAlive,
            itemizedDeductions,
          })
        },
      }),
    }))
  for (const warning of aggregateRothConversionTarget.warnings) {
    warnings.add(warning)
  }
  const desired = aggregateRothConversionTarget.desiredPlanDollars
  if (desired > 0.01) {
    // A conversion is a rollover inside one individual's own accounts:
    // IRC 408(d)(3)(A)(i) admits it only where the amount is paid out of
    // the account maintained for an individual and paid into an account
    // for the benefit of that same individual, and 408A(d)(3)(B) imposes
    // the same identity requirement on conversions directly. Who converts
    // how much, out of which account and into which, is decided by one
    // shared policy module -- the same one the optimizer's promotion
    // chooser reads, so a promoted schedule cannot allocate by a different
    // rule than the ledger executes. The snapshot it weights owners by is
    // the planner's private shadow of the aggregate ID-keyed balances,
    // after reserving any
    // deferred first-year RMD (Treas. Reg. 1.408A-4 A-6(b) requires that
    // amount to precede the conversion) and before anything below reduces
    // live `state.balance`.
    //
    // That snapshot is published on the year, at the instant the policy
    // reads it and over exactly the accounts the policy reads. A promotion
    // that weighted owners by any other figures -- the Plan's opening
    // balances, a neighbouring year's, a reconstruction from the closing
    // ones -- would name sources and cents this projection never moved, on
    // a schedule a person is invited to act on. Publishing here is the
    // only way the two can be the same numbers rather than two numbers
    // that agree today.
    //
    // Each selected ID retains its first Plan insertion position; that is
    // how this snapshot is built, but plain-object enumeration does not
    // promise that order for integer-like keys. Promotion reconstructs the
    // same selected-facts-per-ID view before joining. Consumers must not
    // join the raw Plan array, which can still contain physical aliases.
    aggregateRothConversionAllocationDesired = desired
    const plannedAllocation = annualAggregateRothConversionPlan({
      balances: annualIdKeyedBalances,
      iraRmdUnsatisfiedByOwner,
      desiredPlanDollars: desired,
      primaryPersonId: primary.id,
      fundingTolerancePlanDollars: EPSILON,
      sourceContextForOwner: conversionSourceContextForOwner,
    })
    aggregateRothConversionAllocationBalances =
      plannedAllocation.allocationBalances
    // Preserve the legacy temporary reservation's exact binary64
    // subtract/add round trip. The pure planner used private shadows, so
    // the caller alone mutates the live states, and restores them before
    // any conversion draw or publication below.
    const allocation = withAnnualAggregateRothConversionReservations(
      plannedAllocation.reservations,
      () => plannedAllocation.allocation,
    )
    if (allocation.status === 'refused') {
      warnings.add(allocation.reason === 'householdHoldsNoRothAccount'
        ? 'Roth conversions were requested but the plan has no Roth account; conversions skipped.'
        : 'Roth conversions were requested but every Roth account in the plan sits inside an employer plan, ' +
        'and a Roth conversion here can land only in a Roth IRA; conversions skipped.')
    } else {
      // An owner the policy trimmed converts nothing, and the two reasons
      // it can trim for read differently to the person: no Roth at all,
      // against a Roth that sits where this conversion cannot go.
      for (const trim of allocation.trims) {
        const ownerName = personById.get(trim.ownerPersonId)?.name ?? trim.ownerPersonId
        warnings.add(trim.reason === 'ownerHoldsOnlyEmployerDesignatedRoth'
          ? `${ownerName}’s only Roth account is inside an employer plan, and this Roth ` +
          `conversion can land only in ${ownerName}’s own Roth IRA, so ${ownerName}’s share ` +
          'was skipped. ' +
          `Opening a Roth IRA for ${ownerName} would let that share convert.`
          : `${ownerName} has no Roth account, so ${ownerName}’s share of the Roth conversion was skipped — ` +
          'a conversion has to land in the same person’s own Roth. ' +
          `Opening a Roth IRA for ${ownerName} would let that share convert.`)
      }
      interface OwnerConversionCredit {
        readonly producerOccurrenceKeys: string[]
        readonly sourceOwnerPersonIds: Array<string | null>
        convertedPlanDollars: number
        /** This owner's own share of `conversionNontaxable`. */
        nontaxablePlanDollars: number
      }
      const creditByOwner = new Map<string, OwnerConversionCredit>()
      let ownedIraConversionCaptured = false
      // The policy decided every one of these movements, in Plan account
      // order -- a single pass, not grouped by owner, because that is the
      // order the ledger has always visited its balances in and the order
      // the runtime journal records them in.
      for (const draw of allocation.draws) {
        const state = draw.sourceState
        const sourceAccount = draw.sourceAccount
        const destinationAccount = draw.destination.destinationAccount
        const ownerId = draw.ownerPersonId
        const take = draw.amountPlanDollars
        const sourceBalanceBefore = state.balance
        state.balance -= take
        const kind = 'legacyRothConversion' as const
        const producerOccurrenceKey = runtimeOccurrenceKey(
          kind,
          sourceAccount.id,
          destinationAccount.id,
        )
        const credit = creditByOwner.get(ownerId) ?? {
          producerOccurrenceKeys: [],
          sourceOwnerPersonIds: [],
          convertedPlanDollars: 0,
          nontaxablePlanDollars: 0,
        }
        credit.producerOccurrenceKeys.push(producerOccurrenceKey)
        credit.sourceOwnerPersonIds.push(sourceAccount.ownerPersonId)
        credit.convertedPlanDollars += take
        creditByOwner.set(ownerId, credit)
        recordAnnualRetirementRuntimeOccurrence({
          producerOccurrenceKey,
          kind,
          grossAmountPlanDollars: take,
          ownerPersonId: sourceAccount.ownerPersonId,
          sourceAccountId: sourceAccount.id,
          executionDate: null,
          executionSequence: null,
          movementAuthorityId: null,
        })
        let ownedIraApplication:
          SimulatorRetirementRuntimeApplication | null = null
        if (isAggregatedIra(sourceAccount)) {
          ownedIraConversionCaptured = true
          ownedIraApplication = recordAnnualRetirementRuntimeApplication({
            applicationKind: 'debit',
            producerOccurrenceKey,
            simulatorPhase: 'legacyRothConversion',
            ownerPersonId: sourceAccount.ownerPersonId,
            sourceAccountId: sourceAccount.id,
            sourceBalanceBeforePlanDollars: sourceBalanceBefore,
            appliedAmountPlanDollars: take,
            sourceBalanceAfterPlanDollars: state.balance,
          })
        }
        // Pro-rata return of basis on converted IRA dollars (step 5): the
        // basis portion moves to Roth without creating ordinary income.
        let drawNontaxable = 0
        if (sourceAccount.kind === 'ira' &&
          ownedIraApplication?.applicationKind === 'debit') {
          const proRata = iraProRata.get(ownerId)
          if (proRata) {
            const split = splitWithAssumedCharacter(proRata, take, {
              ownerPersonId: ownerId,
              calculationScope: 'form8606Line8NetConversions',
              occurrenceKind: 'legacyRothConversion',
              producerOccurrenceKey,
              sourceAccountId: sourceAccount.id,
              mutationOrdinal: ownedIraApplication.mutationOrdinal,
            })
            iraProRata.set(ownerId, split.next)
            // The household scalar still drives the year's ordinary
            // income; the per-owner figure drives that owner's own
            // recapture layer below, which one scalar cannot do once the
            // destinations are per owner.
            conversionNontaxable += split.nontaxable
            credit.nontaxablePlanDollars += split.nontaxable
            drawNontaxable = split.nontaxable
          } else {
            noteForm8606Taxable(ownerId, take, 'conversions')
          }
        }
        if (publishCashFlow) {
          aggregateConversionDraws!.push({
            sourceAccountId: sourceAccount.id,
            destinationAccountId: destinationAccount.id,
            ownerPersonId: ownerId,
            amount: take,
            nontaxable: drawNontaxable,
          })
        }
      }
      rothConversion = [...creditByOwner.values()]
        .reduce((total, credit) => total + credit.convertedPlanDollars, 0)
      // Destination credits follow every debit, in Plan account order of
      // the destinations. Only an owner's own first Plan Roth IRA is
      // credited, so a second Roth IRA belonging to the same owner is
      // skipped here rather than credited twice.
      for (const destination of allocation.destinations) {
        const destinationState = destination.destinationState
        const destinationAccount = destination.destinationAccount
        const credit = creditByOwner.get(destination.ownerPersonId)
        if (credit === undefined || credit.convertedPlanDollars <= 0) continue
        const destinationBalanceBefore = destinationState.balance
        destinationState.balance += credit.convertedPlanDollars
        if (ownedIraConversionCaptured) {
          recordAnnualRetirementRuntimeApplication({
            applicationKind: 'aggregateRothDestinationCredit',
            simulatorPhase:
              'legacyRothConversionAggregateDestinationCredit',
            producerOccurrenceKey: null,
            ownerPersonId: null,
            sourceAccountId: null,
            sourceBalanceBeforePlanDollars: null,
            sourceBalanceAfterPlanDollars: null,
            producerOccurrenceKeys: credit.producerOccurrenceKeys,
            sourceOwnerPersonIds: credit.sourceOwnerPersonIds,
            destinationRothAccountId: destinationAccount.id,
            destinationOwnerPersonId: destinationAccount.ownerPersonId,
            destinationBalanceBeforePlanDollars: destinationBalanceBefore,
            destinationCreditedAmountPlanDollars:
              credit.convertedPlanDollars,
            destinationBalanceAfterPlanDollars: destinationState.balance,
          })
        }
        // Converted principal starts its own 5-year recapture clock (the
        // rule that gates an early-retirement conversion ladder). The full
        // amount returns tax-free before earnings, but only the taxable
        // portion is subject to the 10% recapture penalty — nondeductible
        // basis rolled in was never included in income (IRS Pub 590-B).
        // The layer is pushed per owner because the clock runs on the
        // person whose Roth holds it.
        if (credit.convertedPlanDollars > 0.01) {
          const rb = rothBasis.get(rothPoolKey(destinationAccount))
          if (rb) {
            rb.conversionLayers.push({
              year,
              amount: credit.convertedPlanDollars,
              taxableAmount: Math.max(
                0,
                credit.convertedPlanDollars - credit.nontaxablePlanDollars,
              ),
            })
          }
        }
      }
      // One cent, unchanged and still the right tolerance. Both sides are
      // now cent-quantized rather than raw floats -- each slice crosses the
      // exact-cent ledger and the takes are drawn from it -- so the only
      // sub-cent gaps left are float noise and a source balance that ran
      // out within a cent of its slice, neither of which is worth telling
      // anyone about. Above it, the enclosing `desired > 0.01` guarantees
      // the no-balance case clears the threshold and speaks.
      if (rothConversion < allocation.convertibleTargetPlanDollars - 0.01) {
        const gatedEmployerOwners = new Set<string>()
        for (const state of rmdBalances) {
          const account = state.account
          if (
            account.type !== 'traditional'
            || account.inherited !== undefined
            || account.kind !== 'employer'
            || state.balance <= 0
          ) continue
          const ownerId = account.ownerPersonId ?? primary.id
          if (yearConvertibleToRoth(account)) continue
          gatedEmployerOwners.add(personById.get(ownerId)?.name ?? ownerId)
        }
        if (gatedEmployerOwners.size > 0) {
          // Name the unused locked employer balance whenever it caused
          // the shortfall, including when an IRA filled only part of the
          // request. Silence on that unused balance reads as assent.
          for (const ownerName of gatedEmployerOwners) {
            warnings.add(
              `${ownerName}’s employer-plan balance is not distributable this year ` +
              `(no separation from service and under 59½), so that Roth conversion was skipped.`,
            )
          }
        } else {
          warnings.add('A requested Roth conversion exceeded the available traditional balance and was reduced.')
        }
      }
    }
  }

  // The year converts by at most one authority: the target coordinator
  // suppresses the aggregate strategy whenever a named request exists, so it
  // never sizes a second conversion on top of a committed one. These sum both
  // paths anyway because the published figure has to be the year's conversions
  // and not whichever route happened to run.
  const totalRothConversion = rothConversion + namedRothConversionExecuted
  // Each authority nets its own basis return. The two are kept apart rather
  // than pooled because they are apportioned against different Form 8606
  // line-8 entry sets and reconciled against different evidence, even though
  // only one of them can have run this year.
  const totalRothConversionTaxable =
    (rothConversion - conversionNontaxable) +
    (namedRothConversionExecuted - namedRothConversionNontaxable)
  return {
    incomeBeforeConversion,
    itemizedDeductions,
    residenceState,
    stateResidency,
    agesAlive,
    privateRetirementBase,
    publicPensionBase,
    generatedTaxExemptInterest,
    planDerivedTaxExemptInterest,
    yearTaxExemptInterest,
    acaForeignExclusionAddback,
    preWithdrawalCapitalResult,
    netCapitalForPreWithdrawalSizing,
    peopleAged65Plus,
    rothConversion,
    conversionNontaxable,
    totalRothConversion,
    totalRothConversionTaxable,
    aggregateRothConversionTarget,
    aggregateRothConversionAllocationBalances,
    aggregateRothConversionAllocationDesired,
    yearConvertibleToRoth,
    ownedIraConversionTaxableFraction,
  }
}
