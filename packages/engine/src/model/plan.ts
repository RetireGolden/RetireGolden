/**
 * Plan schema v4 — the household financial domain model.
 *
 * Zod schemas are the source of truth: types are inferred from them, and the
 * same schemas validate IndexedDB reads, JSON imports, and migration output.
 * Forward-looking fields (strategies, scenarios) are schema-complete before
 * their engines exist so early plans survive later phases via migrations.
 *
 * @see DOCS/architecture.md (data model)
 * @see DOCS/features/README.md
 */

import { z } from 'zod'
import { persistedRetirementActionRequestSchema } from '../actions/contract.js'
import { rmdStartAgeForBirthYear } from '../params/index.js'
import { addCalendarMonths, parseCivilIsoDate } from '../actions/civilDate.js'
import { usdCentsSchema } from '../actions/money.js'
import {
  ownedNonRothIraAnnualFilingSourceKey,
  planOwnedNonRothIraAnnualFilingSourceIdentifierClaims,
  retirementActionAnnualTaxFactsSchema,
} from './retirementActionAnnualTaxFacts.js'
export type { RetirementActionAnnualTaxFacts } from './retirementActionAnnualTaxFacts.js'

export const CURRENT_PLAN_SCHEMA_VERSION = 4

/**
 * The latest `startAge` a QUALIFIED annuity purchase that is not a QLAC may
 * carry, for an owner born in `birthYear` who pays the premium in
 * `purchaseYear`.
 *
 * Treas. Reg. 1.401(a)(9)-5(a)(5)(iii) permits a portion of an account to buy a
 * contract while the rest stays behind, but only if the contract itself
 * satisfies 1.401(a)(9)-6 — whose paragraph (a)(3)(i) requires annuity payments
 * to commence on or before the required beginning date. Paragraph (q)(1)(iii)
 * excuses a QLAC from (a)(3) and nothing else is excused, so a contract that
 * DEFERS past that date without being a QLAC is a shape the regulation does not
 * permit. The whole test is derivable from facts a Plan already carries, which
 * is why no new field is added for it.
 *
 * TWO TERMS, and the second is the one that keeps this a rule about deferral
 * rather than about age.
 *
 * The first term is the required beginning date itself. Under
 * 1.401(a)(9)-2(b)(1) it is April 1 of the calendar year FOLLOWING the year the
 * owner attains the applicable age, so the last calendar year in which payments
 * may commence is the year the owner attains that age plus one — hence `+ 1`
 * and not a bare equality. The projection pays a contract twelve monthly
 * amounts in the year the owner attains `startAge` (`simulate.ts`, the
 * guaranteed-income pass), so the engine's own model of commencement is
 * January 1 of that year, which is before the April 1 deadline. Refusing at the
 * applicable age itself would refuse a contract the regulation admits.
 *
 * The second term is the purchase year, and without it this function refuses
 * the ordinary immediate annuity. An owner who annuitizes at 80 passed their
 * required beginning date years ago; every contract they could possibly buy
 * commences after it, so the first term alone would forbid a purchase the
 * regulation plainly allows and that this engine's own Form 8606 fixtures are
 * built on. What (a)(3)(i) is doing there is requiring that the annuity form not
 * be used to postpone distributions, and a contract paying from the year its
 * premium is paid postpones nothing: the account was already distributing under
 * the account rules, and the contract takes over on purchase. Taking the later
 * of the two terms is therefore the strictest bound the annual model can state
 * that still admits an immediate purchase — commence by the required beginning
 * date, or, if that date has gone, by the purchase itself.
 */
export function latestNonQlacQualifiedAnnuityStartAge(
  birthYear: number,
  purchaseYear: number,
): number {
  return Math.max(rmdStartAgeForBirthYear(birthYear) + 1, purchaseYear - birthYear)
}

/**
 * The latest `startAge` a QLAC may carry, for an owner born in month
 * `birthMonth` (1–12).
 *
 * The companion bound to the one above, and the reason that one is not the
 * whole rule. Treas. Reg. 1.401(a)(9)-6(q)(1)(iii) excuses a QLAC from
 * (a)(3)(i)'s "commence by the required beginning date", so the function above
 * stands aside for a QLAC — but the excuse is not a licence to defer forever.
 * Paragraph (q)(1)(ii) puts its own ceiling on the same contract: the contract
 * must PROVIDE a specified annuity starting date "no later than the first day of
 * the month next following the 85th anniversary of the employee's birth". A
 * contract that names a later date is not a QLAC at all, so it holds neither
 * (q)(1)(iii)'s excuse nor 1.401(a)(9)-5(b)(4)'s exclusion from the required-
 * distribution account balance, and the engine's one mechanism — the premium
 * leaves the traditional balance at purchase and an annuity account holds no
 * balance of its own — would hand it both.
 *
 * WHY THE ANSWER IS A BIRTH MONTH AND NOT THE CONSTANT 85. The regulation's
 * deadline is a DATE, and this model's start ages are calendar years. The
 * bridge between them is the same one the required-beginning-date bound above
 * is built on: `simulatePlan` pays a contract twelve monthly amounts in the
 * calendar year the owner attains `startAge` (`startCalendarYear = dobYear +
 * startAge`, the guaranteed-income pass), so the engine's model of commencement
 * is January 1 of that year. Ask of each candidate start age whether that
 * January 1 falls on or before the deadline:
 *
 *  - `startAge` 85 or lower puts commencement at January 1 of the year the
 *    owner attains 85 or earlier. The deadline is at the earliest February 1 of
 *    that same year (a January birthday), so every such contract clears it.
 *  - `startAge` 86 puts commencement at January 1 of the year the owner attains
 *    86. For an owner born in any month but December the deadline fell in the
 *    PREVIOUS calendar year, so the contract is late. For an owner born in
 *    December the 85th anniversary is in December and the first day of the next
 *    month IS that January 1 — the contract commences on the last day the
 *    regulation permits, exactly.
 *  - `startAge` 87 or higher is late for everyone.
 *
 * So the ceiling is 85, and 86 for a December birth. The December case is not a
 * rounding artefact to be tidied away: it is the same arithmetic that gives the
 * bound above its `+ 1`, which exists because THAT deadline (April 1 of the
 * year following attainment) also falls in the calendar year after the one the
 * age names. Refusing 86 for a December-born owner would be a refusal stricter
 * than the authority for it, and would force that household to model a contract
 * commencing a full year before the one they hold.
 */
export function latestQlacAnnuityStartAge(birthMonth: number): number {
  return birthMonth === 12 ? 86 : 85
}

/**
 * The highest `startAge` an annuity account may STORE, which is a different
 * kind of limit from the two above and has to be kept distinct from them.
 *
 * The two ceilings above are regulatory: they say what section 401(a)(9) lets a
 * contract do. This one is the model's own range, enforced by `annuitySchema`
 * below, and it says only how far this program is willing to project. It is not
 * a tax rule and nothing here claims a contract commencing at 96 is unlawful.
 *
 * It is exported because three places have to agree on it and were each
 * carrying their own copy: the schema that enforces it, the accounts editor
 * (whose field `max` and help text must not offer an age the plan cannot hold),
 * and the load repair (which reports what the OTHER purchase shape would allow,
 * and must not name a start age the household could not store even if the
 * regulation permitted it).
 */
export const ANNUITY_MAX_START_AGE = 95

const isoDateRe = /^\d{4}-\d{2}-\d{2}$/

const idSchema = z.string().min(1)
const isoDate = z.string().regex(isoDateRe, 'expected YYYY-MM-DD')
const isoTimestamp = z.string().min(1)
const pct = z.number().gt(-100).lt(1000)
const nonNegative = z.number().nonnegative().finite()
const calendarYear = z.number().int().min(1900).max(2200)

// ---------------------------------------------------------------------------
// Household
// ---------------------------------------------------------------------------

export const personSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  dob: isoDate,
  /** 'average' supported for parity with the longevity model's baseline table. */
  sex: z.enum(['female', 'male', 'average']),
  /** Age at which wages stop and retirement-phase rules begin. */
  retirementAge: z.number().min(30).max(80).nullable(),
  longevity: z.object({
    planningAge: z.number().int().min(60).max(120),
    /** 'percentile' = derived from a survival-percentile pick (see `percentile`). */
    source: z.enum(['model', 'manual', 'percentile']),
    /**
     * Provenance when source = 'percentile': the pick that produced
     * `planningAge` ("the age I/we have a `pct`% chance of reaching", SSA 2022
     * period table via engine/montecarlo/survival.ts). Recorded so the UI can
     * restate and re-offer the pick — the age itself is computed once at pick
     * time and never silently recomputed (the anti-drift rule presets follow).
     */
    percentile: z
      .object({
        /** Survival probability threshold, e.g. 25 = "25% chance of reaching". */
        pct: z.number().min(1).max(50),
        /** Couple plans: true = "either of us still alive" (joint last survivor). */
        joint: z.boolean(),
        /** This person's longevity-questionnaire remaining-years multiplier, when applied as a hazard adjustment. */
        healthMultiplier: z.number().positive().optional(),
        /** Joint picks only: the partner's questionnaire multiplier, when it was also applied. */
        partnerHealthMultiplier: z.number().positive().optional(),
      })
      .optional(),
  }),
})
export type Person = z.infer<typeof personSchema>

/** Relocation to a new state of residence starting in `fromYear`. */
export const stateMoveSchema = z.object({
  fromYear: calendarYear,
  /**
   * Month residence starts in the new state. Existing plans default to July,
   * the planning-grade mid-year assumption used for split-year state tax.
   */
  fromMonth: z.number().int().min(1).max(12).default(7),
  state: z.string().length(2),
})
export type StateMove = z.infer<typeof stateMoveSchema>

export const householdSchema = z.object({
  filingStatus: z.enum(['single', 'marriedFilingJointly']),
  /**
   * Planning-grade opt-in for the IRS qualifying surviving spouse status: when
   * a married household has a qualifying dependent, the survivor can use joint
   * brackets/deduction for the two years after the spouse's death. RetireGolden
   * does not model dependents directly, so this is a user assertion.
   */
  hasQualifyingDependent: z.boolean().default(false),
  /** Two-letter code for the starting state of residence; drives state tax. */
  state: z.string().length(2),
  /**
   * Future relocations (sorted/applied by fromYear). Optional with a default
   * so plans saved before V5 stay valid without a schema migration.
   */
  stateMoves: z.array(stateMoveSchema).default([]),
  /**
   * Net capital loss carried forward from prior tax years (today's $). Offsets
   * future realized gains, then up to the annual limit ($3,000) against ordinary
   * income, until exhausted. Default 0 so pre-existing plans stay valid without a
   * schema migration. @see DOCS/features/taxes.md
   */
  capitalLossCarryforward: nonNegative.default(0),
  people: z.array(personSchema).min(1).max(2),
})
export type Household = z.infer<typeof householdSchema>

/** State of residence in a given year: the latest move at/Before `year`, else the base state. */
export function stateForYear(household: Household, year: number): string {
  let state = household.state
  let bestYear = -Infinity
  for (const move of household.stateMoves) {
    if (move.fromYear <= year && move.fromYear > bestYear) {
      bestYear = move.fromYear
      state = move.state
    }
  }
  return state
}

export interface StateResidencySegment {
  state: string
  months: number
}

/** State residency allocation in a tax year, splitting the move year by month. */
export function stateResidencySegmentsForYear(household: Household, year: number): StateResidencySegment[] {
  const move = household.stateMoves.find((m) => m.fromYear === year && stateForYear(household, year) === m.state)
  const current = stateForYear(household, year)
  if (!move) return [{ state: current, months: 12 }]

  const previous = stateForYear(household, year - 1)
  const fromMonth = Math.min(12, Math.max(1, move.fromMonth))
  const previousMonths = fromMonth - 1
  const currentMonths = 13 - fromMonth
  if (previous === current || previousMonths === 0) return [{ state: current, months: 12 }]

  return [
    { state: previous, months: previousMonths },
    { state: current, months: currentMonths },
  ].filter((segment) => segment.months > 0)
}

// ---------------------------------------------------------------------------
// Asset allocation (opt-in, asset-allocation-and-return-model-v2)
// ---------------------------------------------------------------------------

/** The v1 class set; alternatives arrive later. Order matters (weight vectors + correlation matrix). */
export const ASSET_CLASS_IDS = ['usStocks', 'intlStocks', 'bonds', 'cash'] as const
export type AssetClassId = (typeof ASSET_CLASS_IDS)[number]

/**
 * Percent of the account in each class, summing to 100. Kept as percents (not
 * fractions) to match every other UI-facing rate in the schema.
 */
export const allocationWeightsSchema = z
  .object({
    usStocks: z.number().min(0).max(100).default(0),
    intlStocks: z.number().min(0).max(100).default(0),
    bonds: z.number().min(0).max(100).default(0),
    cash: z.number().min(0).max(100).default(0),
  })
  .refine((w) => Math.abs(w.usStocks + w.intlStocks + w.bonds + w.cash - 100) <= 0.5, {
    message: 'allocation weights must sum to 100%',
  })
export type AllocationWeights = z.infer<typeof allocationWeightsSchema>

/**
 * Rebalancing assumption for an allocated account: 'annual' (default) trades
 * back to the year's target each January — taxable trades realize gains
 * through the normal basis machinery; 'none' lets weights drift with returns
 * (glidepath targets are then ignored after the starting year).
 */
const rebalancingField = { rebalancing: z.enum(['annual', 'none']).default('annual') }

const glidepathStageSchema = z.object({ fromYear: calendarYear, weights: allocationWeightsSchema })
const glidepathTargetSchema = z.object({ year: calendarYear, weights: allocationWeightsSchema })

/**
 * Opt-in per-account allocation policy (account-level; household roll-up is
 * derived). Absent = today's single-return behavior, unchanged. When present,
 * it supersedes the account's `annualReturnPct`: growth is the class blend
 * from Assumptions-level class parameters. Glidepaths compile to per-year
 * target weights: 'linear' interpolates from → to between its years, 'staged'
 * is a step function, 'custom' interpolates between explicit year targets.
 */
export const assetAllocationPolicySchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('static'), ...rebalancingField, weights: allocationWeightsSchema }),
  z.object({
    mode: z.literal('linear'),
    ...rebalancingField,
    from: allocationWeightsSchema,
    to: allocationWeightsSchema,
    startYear: calendarYear,
    endYear: calendarYear,
  }),
  z.object({ mode: z.literal('staged'), ...rebalancingField, stages: z.array(glidepathStageSchema).min(1) }),
  z.object({ mode: z.literal('custom'), ...rebalancingField, targets: z.array(glidepathTargetSchema).min(1) }),
])
export type AssetAllocationPolicy = z.infer<typeof assetAllocationPolicySchema>

/**
 * Per-class overrides of the sourced defaults in
 * `engine/allocation/assetClasses.ts` (absent field = default). Yields feed
 * the taxable-drag machinery for allocated brokerage accounts.
 */
const assetClassOverrideSchema = z.object({
  returnPct: pct.optional(),
  volatilityPct: nonNegative.optional(),
  interestYieldPct: nonNegative.optional(),
  dividendYieldPct: nonNegative.optional(),
  qualifiedRatioPct: z.number().min(0).max(100).optional(),
})
export const assetClassParamOverridesSchema = z.object({
  usStocks: assetClassOverrideSchema.optional(),
  intlStocks: assetClassOverrideSchema.optional(),
  bonds: assetClassOverrideSchema.optional(),
  cash: assetClassOverrideSchema.optional(),
})
export type AssetClassParamOverrides = z.infer<typeof assetClassParamOverridesSchema>

// ---------------------------------------------------------------------------
// Estate beneficiary destinations (guaranteed-income-and-estate-depth)
// ---------------------------------------------------------------------------

/**
 * Where an account passes at the end of the plan, for the after-tax estate
 * metric. Absent = the legacy default: pre-tax (traditional) and non-spouse HSA
 * balances are taxed at the flat heir rate, everything else passes untaxed.
 * When set:
 *  - 'spouse'    — passes to a surviving spouse untaxed (rollover); no heir tax.
 *  - 'nonSpouse' — a non-spouse heir; pre-tax balances (traditional, non-spouse
 *                  HSA) are taxed at the account class's heir rate, while Roth,
 *                  taxable (stepped-up at death), and cash pass untaxed.
 *  - 'charity'   — `charityPct` of the ending balance passes to charity fully
 *                  untaxed (a charitable bequest / IRA-to-charity effect); the
 *                  remainder follows the non-spouse heir rules.
 * The HSA's older `beneficiary` field remains a shorthand for spouse/nonSpouse;
 * when both are present this field wins.
 */
export const estateBeneficiarySchema = z.object({
  destination: z.enum(['spouse', 'nonSpouse', 'charity']),
  /** Charity share (percent) when destination = 'charity'; the rest goes to a non-spouse heir. */
  charityPct: z.number().min(0).max(100).optional(),
})
export type EstateBeneficiary = z.infer<typeof estateBeneficiarySchema>

// ---------------------------------------------------------------------------
// Accounts (discriminated union on `type`)
// ---------------------------------------------------------------------------
export const contributionPhaseSchema = z.object({
  annualAmount: nonNegative,
  fromAge: z.number().int().min(0).max(100).nullable().default(null),
  toAge: z.number().int().min(0).max(100).nullable().default(null),
  escalationPct: pct.default(0),
})
export type ContributionPhase = z.infer<typeof contributionPhaseSchema>

export const employerMatchSchema = z.object({
  matchPct: pct,
  capPctOfPay: pct,
})
export type EmployerMatch = z.infer<typeof employerMatchSchema>

const accountBase = {
  id: idSchema,
  name: z.string().min(1),
  /** null = jointly owned. */
  ownerPersonId: idSchema.nullable(),
  /** When null, assumptions.defaultReturnPct applies. Superseded by an account's opt-in `allocation`. */
  annualReturnPct: pct.nullable(),
  /**
   * Optional estate destination (spouse rollover / non-spouse heir / charity)
   * for the after-tax estate metric. Absent = legacy flat-haircut treatment.
   * @see estateBeneficiarySchema
   */
  estateBeneficiary: estateBeneficiarySchema.optional(),
}

/** Nominal dollars contributed per year while the owner still has wages; capped by IRS limits where applicable. */
const annualContribution = nonNegative
const individuallyOwnedAccountTypes = new Set(['traditional', 'roth', 'hsa'])

export const taxableAccountSchema = z.object({
  ...accountBase,
  type: z.literal('taxable'),
  balance: nonNegative,
  /** Aggregate cost basis (single basis-ratio model in v1; no lots). */
  costBasis: nonNegative,
  /** Annual interest yield as a percent of start-of-year balance. */
  interestYieldPct: nonNegative.optional(),
  /** Annual dividend yield as a percent of start-of-year balance. */
  dividendYieldPct: nonNegative.optional(),
  /** Fraction of dividends taxed as qualified dividends. */
  qualifiedRatio: z.number().min(0).max(1).optional(),
  /**
   * Annual federally tax-exempt (municipal-bond) interest yield as a percent of
   * start-of-year balance. Distinct from `interestYieldPct` and never derived
   * from the allocation blend: enter a bond sleeve's yield in exactly one of the
   * two fields — the same dollars stated in both would double-count. The income
   * it generates is excluded from AGI/ordinary income and enters only the
   * program bases in DOCS/domain/domain-rules-reference.md §20. On an
   * allocated account the class blend still supplies taxable interest (e.g.
   * the bonds class) unless `interestYieldPct` is set explicitly; a muni sleeve
   * modeled via this field should set `interestYieldPct` explicitly (usually 0
   * for the sleeve's share) so the blend does not also price the same bonds as
   * taxable.
   */
  taxExemptInterestYieldPct: nonNegative.optional(),
  /** Reinvest generated yield into the account instead of paying it into cash flow. */
  reinvestDividends: z.boolean().optional(),
  /** Opt-in class allocation; supersedes annualReturnPct and (unless explicitly set) drives the yield fields. */
  allocation: assetAllocationPolicySchema.optional(),
  annualContribution,
  contributionSchedule: z.array(contributionPhaseSchema).optional(),
})

export const equityCompAccountSchema = z.object({
  ...accountBase,
  type: z.literal('equityComp'),
  /** Current value of vested/unvested employer shares. */
  balance: nonNegative,
  /** Aggregate cost basis; once available, sales realize gains pro-rata like taxable brokerage. */
  costBasis: nonNegative,
  annualContribution,
  contributionSchedule: z.array(contributionPhaseSchema).optional(),
  /** final = fully available now; cliff = unavailable for spending until vestDate. */
  vestingMode: z.enum(['final', 'cliff']),
  vestDate: isoDate.nullable(),
})

/**
 * 72(t) SEPP election (roadmap V8). Penalty-free substantially-equal periodic
 * payments from this account starting at `startAge`, for the longer of 5 years
 * or until 59½. Optional — omitted means no SEPP, so no migration is needed.
 */
export const seppElectionSchema = z.object({
  /** Age the series begins (must be under 59½ to be worthwhile). */
  startAge: z.number().int().min(40).max(59),
  /** IRS method: 'rmd' recomputes yearly; 'amortization' fixes a level payment. */
  method: z.enum(['rmd', 'amortization']),
})

/**
 * Explicit beneficiary facts for an inherited IRA (regime matrix §2). Asserted
 * by the plan author; the classifier never infers legal status from age or
 * relationship alone. Absent on a traditional inherited account ⇒ the labeled
 * `legacy-planning-approximation` path (migration never fabricates these facts).
 */
export const inheritedBeneficiarySchema = z
  .object({
    /**
     * Who stands as beneficiary of the account. Non-individual and successor
     * classes are out of scope for the regime engine (matrix X2/X3).
     * @see Treas. Reg. §1.401(a)(9)-4(c)
     */
    beneficiaryClass: z.enum([
      'designated-individual',
      'estate',
      'trust',
      'entity',
      'successor-beneficiary',
    ]),
    /**
     * Eligible designated beneficiary category fixed at the owner's death.
     * Asserted, not inferred — the engine may check arithmetic consistency for
     * minor-child and not-more-than-10-years-younger, but never promotes into
     * disabled/chronically-ill.
     * @see IRC §401(a)(9)(E)(ii); Treas. Reg. §1.401(a)(9)-4(e)
     */
    edbCategory: z
      .enum([
        'none',
        'surviving-spouse',
        'minor-child',
        'disabled',
        'chronically-ill',
        'not-more-than-10-years-younger',
      ])
      .optional(),
    /**
     * Beneficiary's calendar year of birth. Required for designated-individual
     * life-expectancy regimes and consistency checks; non-individual classes
     * and successor beneficiaries may not have a birth year.
     */
    beneficiaryBirthYear: calendarYear.optional(),
    /**
     * Whether this beneficiary is the account's sole beneficiary. Required for
     * designated-individual beneficiaries (and for spouse treat-as-own); estates,
     * trusts, entities, and successors may omit it. Multiple beneficiaries without
     * separate-account facts are unsupported (matrix X4).
     * @see Treas. Reg. §1.401(a)(9)-8(a)
     */
    soleBeneficiary: z.boolean().optional(),
    /**
     * Explicit beneficiary distribution election. Spouse-only values
     * (`remain-beneficiary`, `treat-as-own`) and the EDB `ten-year-election`
     * are constrained by refinements below; never inferred from inactivity.
     * @see Treas. Reg. §1.401(a)(9)-3(c)(5); §1.408-8(c)
     */
    election: z
      .enum(['none', 'remain-beneficiary', 'treat-as-own', 'ten-year-election'])
      .optional(),
    /**
     * Calendar year the surviving spouse's treat-as-own election takes effect.
     * This is a deliberate state-transition contract: before this year the
     * account remains an inherited IRA; from this year it is the spouse's own
     * IRA. The engine never infers this transition from a deemed election.
     * Parse-optional with `election: 'treat-as-own'` so pre-WS4 persisted plans
     * still parse; the classifier refuses S2 with an actionable X5 when the
     * year is missing (fail closed onto the labeled legacy path). When present,
     * must be on or after `ownerDeathYear`.
     * @see Treas. Reg. §1.408-8(c)(1)-(2)
     */
    treatAsOwnElectionYear: calendarYear.optional(),
    /**
     * Surviving spouse has an unlimited withdrawal right — a precondition of
     * the treat-as-own election.
     * @see Treas. Reg. §1.408-8(c)(1)
     */
    spouseUnlimitedWithdrawalRight: z.boolean().optional(),
    /**
     * Decedent's calendar year of birth. Needed for RBD derivation and the
     * greater-of life-expectancy arm when death is on/after the RBD. Year
     * precision alone can leave the before/on-after-RBD answer ambiguous; that
     * is a needs-review classification downstream, not a parse error.
     * @see IRC §401(a)(9)(C); Treas. Reg. §1.401(a)(9)-5(d)(1)(ii)
     */
    ownerBirthYear: calendarYear.optional(),
    /**
     * Decedent's birth month (1–12). Matters only when the RBD boundary turns
     * on month precision (e.g. the July 1, 1949 70½ cutoff). Year-only ambiguity
     * classifies needs-review downstream — not a parse error.
     */
    ownerBirthMonth: z.number().int().min(1).max(12).optional(),
    /**
     * Decedent's birth day (1–31). Day precision matters only at the July 1,
     * 1949 70½ boundary and similar date-exact cutoffs; year/month ambiguity
     * classifies needs-review downstream.
     */
    ownerBirthDay: z.number().int().min(1).max(31).optional(),
    /**
     * Whether the decedent's unsatisfied year-of-death RMD was already taken.
     * Required for correct year-0 scheduling when death is on/after the RBD;
     * unknown/`false` means the schedule must carry it.
     * @see Treas. Reg. §1.408-8(e)(4)(i)
     */
    ownerYearOfDeathRmdSatisfied: z.boolean().optional(),
    /**
     * Calendar year of the owner's first Roth contribution — starts the
     * 5-taxable-year period for inherited-Roth taxability evidence (matrix K3).
     * @see Treas. Reg. §1.408A-6, A-4, A-14(c)
     */
    roth5YearStartYear: calendarYear.optional(),
    /**
     * Provenance for the facts above: who/what asserted them and as-of which
     * ISO calendar date (review workflows).
     */
    provenance: z.object({
      source: z.string().refine((value) => value.trim().length > 0, {
        message: 'provenance.source must be non-blank after trimming; provide the asserting source',
      }),
      asOf: z
        .string()
        .regex(isoDateRe, 'provenance.asOf must be an ISO date (YYYY-MM-DD)')
        .refine(
          (value) => parseCivilIsoDate(value) !== null,
          'provenance.asOf must be a real calendar date (YYYY-MM-DD)',
        ),
    }),
  })
  .superRefine((beneficiary, ctx) => {
    if (
      beneficiary.beneficiaryClass === 'designated-individual' &&
      beneficiary.beneficiaryBirthYear === undefined
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['beneficiaryBirthYear'],
        message:
          "beneficiaryBirthYear is required when beneficiaryClass is 'designated-individual'; provide the beneficiary's birth year for the life-expectancy regime and consistency checks",
      })
    }

    if (
      beneficiary.beneficiaryClass === 'designated-individual' &&
      beneficiary.edbCategory === undefined
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['edbCategory'],
        message:
          "edbCategory is required when beneficiaryClass is 'designated-individual'; set an EDB category (or 'none' for a non-EDB designated beneficiary)",
      })
    }

    // EDB categories exist only for designated individuals (matrix §2 / X5).
    if (
      beneficiary.beneficiaryClass !== 'designated-individual' &&
      beneficiary.edbCategory != null &&
      beneficiary.edbCategory !== 'none'
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['edbCategory'],
        message:
          "edbCategory other than 'none' applies only when beneficiaryClass is 'designated-individual'; set beneficiaryClass to 'designated-individual' or set edbCategory to 'none'",
      })
    }

    if (
      beneficiary.beneficiaryClass === 'designated-individual' &&
      beneficiary.soleBeneficiary === undefined
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['soleBeneficiary'],
        message:
          "soleBeneficiary is required when beneficiaryClass is 'designated-individual'; set it to true or false",
      })
    }

    if (beneficiary.ownerBirthDay !== undefined && beneficiary.ownerBirthMonth === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['ownerBirthMonth'],
        message:
          'ownerBirthMonth is required when ownerBirthDay is provided; supply the birth month or remove the birth day',
      })
    }

    if (
      beneficiary.ownerBirthYear === undefined &&
      beneficiary.ownerBirthMonth !== undefined &&
      beneficiary.ownerBirthDay !== undefined
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['ownerBirthYear'],
        message:
          'ownerBirthYear is required when ownerBirthMonth and ownerBirthDay are both provided; supply the birth year or remove the date components',
      })
    }

    if (
      beneficiary.ownerBirthYear !== undefined &&
      beneficiary.ownerBirthMonth !== undefined &&
      beneficiary.ownerBirthDay !== undefined
    ) {
      const date = new Date(
        Date.UTC(beneficiary.ownerBirthYear, beneficiary.ownerBirthMonth - 1, beneficiary.ownerBirthDay),
      )
      if (
        date.getUTCFullYear() !== beneficiary.ownerBirthYear ||
        date.getUTCMonth() !== beneficiary.ownerBirthMonth - 1 ||
        date.getUTCDate() !== beneficiary.ownerBirthDay
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['ownerBirthDay'],
          message:
            'ownerBirthYear, ownerBirthMonth, and ownerBirthDay must form a real calendar date; correct the owner birth date components',
        })
      }
    }

    const election = beneficiary.election
    if (election !== undefined && election !== 'none') {
      if (election === 'remain-beneficiary' || election === 'treat-as-own') {
        if (beneficiary.edbCategory !== 'surviving-spouse') {
          ctx.addIssue({
            code: 'custom',
            path: ['election'],
            message: `election '${election}' requires edbCategory 'surviving-spouse'; set edbCategory to 'surviving-spouse' or clear/change the election`,
          })
        }
      } else if (election === 'ten-year-election') {
        // Allowed for any EDB category except none (spouse or non-spouse EDB).
        if (beneficiary.edbCategory === 'none') {
          ctx.addIssue({
            code: 'custom',
            path: ['election'],
            message:
              "election 'ten-year-election' requires an EDB category other than 'none'; set edbCategory to an eligible designated beneficiary class or clear the election",
          })
        }
      }
    }

    if (election === 'treat-as-own' && beneficiary.soleBeneficiary !== true) {
      ctx.addIssue({
        code: 'custom',
        path: ['soleBeneficiary'],
        message:
          "election 'treat-as-own' requires soleBeneficiary true (§1.408-8(c)(1)); set soleBeneficiary to true or choose a different election",
      })
    }

    // spouseUnlimitedWithdrawalRight absent/undefined stays parse-legal — the
    // classifier marks needs-review when treat-as-own is asserted without it.
    if (
      election === 'treat-as-own' &&
      beneficiary.spouseUnlimitedWithdrawalRight === false
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['spouseUnlimitedWithdrawalRight'],
        message:
          "election 'treat-as-own' requires spouseUnlimitedWithdrawalRight true (§1.408-8(c)(1)); set spouseUnlimitedWithdrawalRight to true or choose a different election",
      })
    }

    // Year-arithmetic contradiction only: the reg measures birth-date to
    // birth-date (§1.401(a)(9)-4(e)(6)), so a boundary-year tie (exactly 10
    // years by year subtraction) is NOT rejected here.
    if (
      beneficiary.edbCategory === 'not-more-than-10-years-younger' &&
      beneficiary.beneficiaryClass === 'designated-individual' &&
      beneficiary.ownerBirthYear !== undefined &&
      beneficiary.beneficiaryBirthYear !== undefined &&
      beneficiary.beneficiaryBirthYear > beneficiary.ownerBirthYear + 10
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['edbCategory'],
        message:
          "edbCategory 'not-more-than-10-years-younger' is contradicted by birth years (beneficiary more than 10 years younger than the owner by year arithmetic; §1.401(a)(9)-4(e)(6) measures birth-date to birth-date, so only a clear >10-year gap is a parse error) — correct ownerBirthYear, beneficiaryBirthYear, or edbCategory",
      })
    }
  })
export type InheritedBeneficiary = z.infer<typeof inheritedBeneficiarySchema>

/**
 * Inherited (beneficiary) account under the SECURE Act 10-year rule (roadmap
 * V8). Optional — omitted means a normal owned account, so no migration needed.
 *
 * The two legacy fields (`ownerDeathYear`, `decedentHadStartedRmds`) are the
 * pre-WS2 planning approximation. When `beneficiary` is omitted the account
 * remains the labeled `legacy-planning-approximation` (regime matrix X1 /
 * missing-facts handling); migration never fabricates a beneficiary block.
 */
export const inheritedAccountSchema = z
  .object({
    /** Calendar year the original owner died (starts the 10-year clock). */
    ownerDeathYear: calendarYear,
    /**
     * Asserted required-beginning-date-status fact: whether the decedent had
     * started RMDs, as this field has meant since the two-field era. The WS3
     * classifier derives death-vs-RBD from ownerBirthYear/month and death year
     * and marks any contradiction with this assertion needs-review; the
     * parse-level coherence refinements below intentionally read this asserted
     * fact.
     */
    decedentHadStartedRmds: z.boolean(),
    /**
     * Explicit beneficiary facts (regime matrix §2). Optional on traditional
     * inherited accounts: without this block the account remains the labeled
     * `legacy-planning-approximation` and migration never fabricates it. Required
     * on Roth inherited accounts (see Roth refinements on accountSchema).
     */
    beneficiary: inheritedBeneficiarySchema.optional(),
  })
  .superRefine((inherited, ctx) => {
    const beneficiary = inherited.beneficiary
    if (beneficiary === undefined) return

    // treatAsOwnElectionYear is parse-optional with treat-as-own (migration
    // safety for pre-WS4 plans). Missing year classifies X5 needs-review
    // downstream; present year must be on/after ownerDeathYear.
    if (beneficiary.election === 'treat-as-own') {
      if (
        beneficiary.treatAsOwnElectionYear !== undefined &&
        beneficiary.treatAsOwnElectionYear < inherited.ownerDeathYear
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['beneficiary', 'treatAsOwnElectionYear'],
          message:
            'treatAsOwnElectionYear cannot be before ownerDeathYear (a spouse can elect only after inheriting the IRA, Treas. Reg. §1.408-8(c)(1)-(2)); set it to ownerDeathYear or later',
        })
      }
    } else if (beneficiary.treatAsOwnElectionYear !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['beneficiary', 'treatAsOwnElectionYear'],
        message:
          "treatAsOwnElectionYear applies only when election is 'treat-as-own'; remove it or set election to 'treat-as-own'",
      })
    }

    if (
      beneficiary.ownerBirthYear !== undefined &&
      beneficiary.ownerBirthYear > inherited.ownerDeathYear
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['beneficiary', 'ownerBirthYear'],
        message:
          'ownerBirthYear cannot be after ownerDeathYear (the owner cannot be born after their own death); correct ownerBirthYear or ownerDeathYear',
      })
    }

    // A designated beneficiary born after the calendar year of death cannot
    // have been a designated beneficiary as of the date of death
    // (§1.401(a)(9)-4(c)). Successor beneficiaries may be born later under
    // §401(a)(9)(H)(iii), and non-individual classes have no birth year.
    if (
      beneficiary.beneficiaryClass === 'designated-individual' &&
      beneficiary.beneficiaryBirthYear !== undefined &&
      beneficiary.beneficiaryBirthYear > inherited.ownerDeathYear
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['beneficiary', 'beneficiaryBirthYear'],
        message:
          'beneficiaryBirthYear cannot be after ownerDeathYear (a designated beneficiary must be alive on the date of death, §1.401(a)(9)-4(c)) — correct beneficiaryBirthYear or ownerDeathYear',
      })
    }

    // Minor-child EDB ends at the 21st birthday (§1.401(a)(9)-4(e)(3)). At year
    // precision, age exactly 21 attained in the death year is ambiguous (the
    // beneficiary may still have been 20 on the date of death); parse rejects
    // only clear contradictions (age ≥ 22 by year arithmetic) and the
    // classifier marks year-precision ambiguity needs-review.
    if (
      beneficiary.beneficiaryClass === 'designated-individual' &&
      beneficiary.edbCategory === 'minor-child' &&
      beneficiary.beneficiaryBirthYear !== undefined
    ) {
      const ageInDeathYear = inherited.ownerDeathYear - beneficiary.beneficiaryBirthYear
      if (ageInDeathYear >= 22) {
        ctx.addIssue({
          code: 'custom',
          path: ['beneficiary', 'edbCategory'],
          message:
            "edbCategory 'minor-child' is contradicted by beneficiaryBirthYear (age ≥ 22 in the owner death year; majority is the 21st birthday, §1.401(a)(9)-4(e)(3)) — correct beneficiaryBirthYear, ownerDeathYear, or edbCategory",
        })
      }
    }

    if (
      beneficiary.ownerYearOfDeathRmdSatisfied !== undefined &&
      !inherited.decedentHadStartedRmds
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['beneficiary', 'ownerYearOfDeathRmdSatisfied'],
        message:
          'ownerYearOfDeathRmdSatisfied applies only when decedentHadStartedRmds is true (year-of-death RMD facts exist only for on/after-RBD deaths, Treas. Reg. §1.408-8(e)(4)(i)); set decedentHadStartedRmds to true or remove ownerYearOfDeathRmdSatisfied',
      })
    }

    if (
      beneficiary.election === 'ten-year-election' &&
      inherited.decedentHadStartedRmds
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['beneficiary', 'election'],
        message:
          "election 'ten-year-election' applies only when decedentHadStartedRmds is false (the §1.401(a)(9)-3(c)(5)(iii) election exists only in the death-before-RBD regime; regime matrix S3x); set decedentHadStartedRmds to false or clear the election",
      })
    }
  })
export type InheritedAccount = z.infer<typeof inheritedAccountSchema>

export const traditionalAccountSchema = z.object({
  ...accountBase,
  type: z.literal('traditional'),
  /** 'employer' = 401(k)/403(b)-style; 'ira' = IRA. Affects RMD aggregation + rules later. */
  kind: z.enum(['ira', 'employer']),
  balance: nonNegative,
  annualContribution,
  inherited: inheritedAccountSchema.optional(),
  /**
   * Planning-only Form-8606 nondeductible contribution basis (after-tax dollars
   * already in this IRA). It drives projections but is not a complete annual
   * filing record and cannot establish filing-grade action evidence. When any
   * of an owner's traditional IRAs carries basis, every
   * withdrawal and Roth conversion from that owner's IRAs applies the pro-rata
   * rule across the aggregated IRA balances — the taxable portion is reduced by
   * the basis fraction, and basis depletes as it is distributed. IRA kind only
   * (employer plans track after-tax money separately and are not modeled);
   * not allowed on inherited accounts (a beneficiary's 8606 is separate).
   */
  nondeductibleBasis: nonNegative.optional(),
  /**
   * The spouse is the account's sole beneficiary. Required (with a >10-yr age
   * gap) before the larger Joint Life & Last Survivor RMD divisor applies;
   * otherwise the Uniform Lifetime Table is used. Optional — defaults to false.
   */
  spouseSoleBeneficiary: z.boolean().optional(),
  /** Optional 72(t) SEPP election for penalty-free early access (roadmap V8). */
  sepp: seppElectionSchema.optional(),
  employerMatch: employerMatchSchema.optional(),
  contributionSchedule: z.array(contributionPhaseSchema).optional(),
  /** Opt-in class allocation; supersedes annualReturnPct. Rebalancing here is tax-free. */
  allocation: assetAllocationPolicySchema.optional(),
})

export const rothAccountSchema = z.object({
  ...accountBase,
  type: z.literal('roth'),
  kind: z.enum(['ira', 'employer']),
  balance: nonNegative,
  annualContribution,
  /**
   * Contribution basis (today's dollars): the portion of the starting balance
   * that is direct contributions, withdrawable tax- and penalty-free at any age.
   * Drives the Roth ordering + 5-year rules (roadmap V8). Optional — when omitted
   * the engine treats the whole starting balance as seasoned basis, the safe
   * default that keeps pre-existing plans penalty-free. New annual contributions
   * add to basis; in-projection conversions start their own 5-year seasoning clocks.
   */
  contributionBasis: nonNegative.optional(),
  /**
   * Inherited (beneficiary) Roth IRA facts for the regime matrix K1/K2 paths.
   * When present, the block MUST carry full `beneficiary` facts (the legacy
   * two-field approximation never covered Roth) and `decedentHadStartedRmds`
   * must be false (a Roth owner is always treated as dying before the RBD,
   * §1.408A-6 A-14(b)).
   */
  inherited: inheritedAccountSchema.optional(),
  employerMatch: employerMatchSchema.optional(),
  contributionSchedule: z.array(contributionPhaseSchema).optional(),
  /** Opt-in class allocation; supersedes annualReturnPct. Rebalancing here is tax-free. */
  allocation: assetAllocationPolicySchema.optional(),
})

export const hsaAccountSchema = z.object({
  ...accountBase,
  type: z.literal('hsa'),
  balance: nonNegative,
  annualContribution,
  contributionSchedule: z.array(contributionPhaseSchema).optional(),
  /**
   * How withdrawals are taxed (account/HSA/fixed-asset depth plan, steps 2–3):
   * - omitted (legacy): the original v1 simplification — every withdrawal is
   *   tax-free but conservatively penalized 20% before 65, so pre-existing
   *   plans keep byte-identical results.
   * - 'assumeAllQualified': every withdrawal is a qualified medical expense
   *   (tax- and penalty-free at any age) — the explicit simplification for
   *   users who track receipts outside the app.
   * - 'capByMedicalExpenses': withdrawals are qualified only up to the
   *   household's modeled medical costs this year (healthcare premiums + net
   *   care costs), plus the accumulated reimburse-later pool when enabled; the
   *   excess is ordinary income, penalized 20% before 65 (IRS Pub 969).
   */
  withdrawalTreatment: z.enum(['assumeAllQualified', 'capByMedicalExpenses']).optional(),
  /**
   * Accumulate unreimbursed modeled medical expenses (paid out of pocket in
   * earlier years) as a carryover future withdrawals may draw tax-free — the
   * "pay now, reimburse later" HSA strategy. Requires 'capByMedicalExpenses'.
   */
  reimburseLater: z.boolean().optional(),
  /**
   * Who inherits this HSA, for the after-tax estate metric: a spouse inherits
   * it as their own HSA (passes untaxed, like Roth); any other beneficiary
   * receives a fully taxable distribution in the death year, so the estate
   * metric taxes the remaining balance at the heir tax rate. Omitted = legacy
   * untaxed pass-through (same as 'spouse').
   */
  beneficiary: z.enum(['spouse', 'nonSpouse']).optional(),
  /** Opt-in class allocation; supersedes annualReturnPct. Rebalancing here is tax-free. */
  allocation: assetAllocationPolicySchema.optional(),
})

export const cashAccountSchema = z.object({
  ...accountBase,
  type: z.literal('cash'),
  balance: nonNegative,
  annualContribution,
  contributionSchedule: z.array(contributionPhaseSchema).optional(),
})

/**
 * Optional lump-sum election facts on a pension (annuity-pension-and-home-
 * equity decisions, step 3). `lumpSumOffer` records the offer for the decision
 * view (PV comparison, sensitivity table) and the pension-election insight;
 * it changes nothing in the ledger by itself. `lumpSumElection` commutes the
 * pension: in the election year the offer amount rolls over tax-free into the
 * named traditional account (a direct rollover, so no withholding or income),
 * and the pension never pays its annuity. Both are additive and optional, so
 * pre-existing plans are byte-identical.
 */
export const pensionLumpSumOfferSchema = z.object({
  /** Lump sum offered instead of the annuity (nominal dollars at the election year). */
  amount: nonNegative,
  /** Calendar year the election is due / the lump sum would be paid. */
  electionYear: calendarYear,
})
export type PensionLumpSumOffer = z.infer<typeof pensionLumpSumOfferSchema>

export const pensionLumpSumElectionSchema = z.object({
  /** Traditional account (IRA/401k) receiving the tax-free direct rollover. */
  rolloverAccountId: idSchema,
})

export const pensionSchema = z.object({
  ...accountBase,
  type: z.literal('pension'),
  /** Drives state tax treatment in states with public-pension exemptions. */
  source: z.enum(['private', 'public']).optional(),
  /** Owner's age when payments start. */
  startAge: z.number().int().min(40).max(80),
  monthlyAmount: nonNegative,
  /** Annual COLA applied to payments; 0 = fixed nominal. */
  colaPct: pct,
  /** Percent of the benefit continuing to a surviving spouse. */
  survivorPct: z.number().min(0).max(100),
  /** Lump-sum offer on record (decision inputs only; no ledger effect by itself). */
  lumpSumOffer: pensionLumpSumOfferSchema.optional(),
  /** Take the lump sum: rollover in the offer's election year replaces the annuity. */
  lumpSumElection: pensionLumpSumElectionSchema.optional(),
})

/**
 * Optional purchase event that funds an annuity by trading a premium out of a
 * liquid or qualified account (guaranteed-income-and-estate-depth). Absent = the
 * annuity is an already-owned income stream (legacy behavior). When present:
 *  - the premium is withdrawn from `fundingAccountId` in `year` — a transfer,
 *    not spending, so it is never counted against the spending target. Cash and
 *    qualified (traditional) sources move at book value; a taxable/equity-comp
 *    source liquidates the position and realizes its gains pro-rata (folded into
 *    that year's realized capital gains), exactly like any other sale;
 *  - 'nonQualified' (cash/taxable-funded): payouts are taxed by the IRS Pub 939
 *    exclusion ratio — the premium is the investment in the contract — so the
 *    account's `taxablePct` is derived from the ratio and the stored value is a
 *    display fallback only;
 *  - 'qualified' (traditional-funded): payouts are fully ordinary income, and
 *    because the premium leaves the traditional balance, future RMDs shrink
 *    automatically. `qlac` marks a deferred-start qualified contract whose
 *    premium is held to the QLAC statutory cap (a warning fires above it).
 */
export const annuityPurchaseSchema = z.object({
  /** Calendar year the premium is paid and the contract begins. */
  year: calendarYear,
  /** Premium paid (nominal dollars at the purchase year — a quoted figure). */
  premium: nonNegative,
  /** Account the premium is drawn from. */
  fundingAccountId: idSchema,
  /** 'nonQualified' → exclusion-ratio taxation; 'qualified' → fully taxable payouts. */
  taxQualification: z.enum(['nonQualified', 'qualified']),
  /** Deferred-start qualified longevity annuity (QLAC); requires `taxQualification: 'qualified'`. */
  qlac: z.boolean().optional(),
})
export type AnnuityPurchase = z.infer<typeof annuityPurchaseSchema>

/**
 * Payout form of an annuity contract (annuity-pension-and-home-equity
 * decisions, step 1). Absent = 'lifeOnly', the legacy behavior — payments
 * stop at the owner's death — so pre-existing plans are byte-identical.
 *  - 'periodCertain': life annuity with an N-year guarantee measured from the
 *    payment start age. If the owner dies inside the guarantee window, the
 *    remaining certain payments continue to the household (beneficiary); after
 *    the window the annuity is life-contingent as usual.
 *  - 'jointSurvivor': payments continue to the other household member at
 *    `survivorPct` of the full amount after the owner's death, for the
 *    survivor's lifetime. Requires a two-person household.
 * Both forms extend the IRS Pub 939 exclusion-ratio math for a non-qualified
 * purchase (see engine/projection/annuityForms.ts for the method and its
 * documented approximations).
 */
export const annuityPayoutFormSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('lifeOnly') }),
  z.object({
    kind: z.literal('periodCertain'),
    /** Guaranteed payment years measured from the start age (e.g. 10 or 20). */
    certainYears: z.number().int().min(1).max(40),
  }),
  z.object({
    kind: z.literal('jointSurvivor'),
    /** Percent of the payment continuing to the surviving joint annuitant. */
    survivorPct: z.number().min(1).max(100),
  }),
])
export type AnnuityPayoutForm = z.infer<typeof annuityPayoutFormSchema>

export const annuitySchema = z.object({
  ...accountBase,
  type: z.literal('annuity'),
  startAge: z.number().int().min(40).max(ANNUITY_MAX_START_AGE),
  monthlyAmount: nonNegative,
  colaPct: pct,
  /**
   * Percent of each payment that is taxable. For a purchased non-qualified
   * annuity this is derived from the exclusion ratio and the stored value is
   * ignored; for an already-owned annuity (no `purchase`) it is used directly.
   */
  taxablePct: z.number().min(0).max(100),
  /** Optional funding event; see annuityPurchaseSchema. Absent = already-owned income stream. */
  purchase: annuityPurchaseSchema.optional(),
  /** Payout form; absent = life-only (payments end at owner death, legacy behavior). */
  payoutForm: annuityPayoutFormSchema.optional(),
})

/**
 * Opt-in HECM (reverse-mortgage) line of credit on an owned home
 * (annuity-pension-and-home-equity decisions, step 4). Models Pfau's
 * buffer-asset strategy: open the line early, let the unused credit grow, and
 * draw tax-free loan proceeds either after down market years ('coordinated')
 * or only once the portfolio is exhausted ('lastResort'). The loan balance
 * accrues at the same growth rate; payoff at sale or the end of the plan is
 * non-recourse (never more than the home's value). Absent = no HECM — plans
 * without one are unchanged.
 */
export const hecmLineOfCreditSchema = z.object({
  /** Calendar year the line is opened (youngest borrower should be 62+). */
  openYear: calendarYear,
  /**
   * Principal limit as a percent of the home's value at open. Enter the
   * lender-quoted figure; omitted = the parameter pack's published
   * principal-limit-factor approximation by borrower age.
   */
  principalLimitPct: z.number().min(5).max(75).optional(),
  /**
   * Annual growth applied to BOTH the principal limit and the loan balance
   * (note rate + 0.5% MIP; ~7–8% at 2026 rates). The unused line grows at
   * this rate regardless of home value — the core of the buffer strategy.
   */
  growthRatePct: z.number().min(0).max(15),
  /** Upfront costs (origination, closing, initial MIP) financed into the loan at open, % of home value. */
  upfrontCostPct: z.number().min(0).max(10).optional(),
  /**
   * 'coordinated' (Pfau): draw for spending in years following a negative
   * market return, letting the portfolio recover; 'lastResort': draw only
   * when the portfolio cannot cover spending.
   */
  drawPolicy: z.enum(['coordinated', 'lastResort']),
})
export type HecmLineOfCredit = z.infer<typeof hecmLineOfCreditSchema>

export const propertySchema = z.object({
  ...accountBase,
  type: z.literal('property'),
  value: nonNegative,
  plannedSaleYear: calendarYear.nullable(),
  /**
   * Net proceeds entering taxable savings in the sale year (user-estimated,
   * treated as tax-free). Legacy path — ignored when `costBasis` is set, which
   * switches the sale to exact basis/exclusion/recapture tax treatment.
   */
  expectedNetProceeds: nonNegative.nullable(),
  /**
   * Adjusted cost basis (purchase price + improvements, historical dollars —
   * deliberately not inflation-indexed). Setting it turns on exact disposition
   * tax treatment: gain = sale price − selling costs − basis, reduced by the
   * §121 exclusion for a primary residence, with any depreciation recapture
   * taxed as ordinary income and the remainder as capital gain.
   */
  costBasis: nonNegative.optional(),
  /** Selling costs (commissions + closing) as a percent of the sale price. Absent = 0. */
  sellingCostPct: z.number().min(0).max(25).optional(),
  /**
   * Primary residence: the §121 exclusion (per the parameter pack; $250k
   * single / $500k MFJ, statutory and not indexed) shields gain on sale.
   * Ownership/use tests (2 of 5 years) are asserted by the user, not modeled.
   */
  primaryResidence: z.boolean().optional(),
  /**
   * Accumulated depreciation claimed (e.g. rental years, home office):
   * recaptured as ordinary income on sale and never shielded by §121.
   * Requires `costBasis`.
   */
  depreciationRecapture: nonNegative.optional(),
  /**
   * Annual property tax (today's dollars), charged as a recurring expense while
   * the property is owned and continuing after any mortgage is paid off — the
   * carrying costs a PITI payment hides. Optional (treated as 0). @see insuranceAnnual
   */
  propertyTaxAnnual: nonNegative.optional(),
  /** Annual homeowner's/hazard insurance (today's dollars), charged while owned. Optional (treated as 0). */
  insuranceAnnual: nonNegative.optional(),
  /** Opt-in HECM reverse-mortgage line of credit on this home. Requires `primaryResidence`. */
  hecm: hecmLineOfCreditSchema.optional(),
})

export const debtSchema = z.object({
  ...accountBase,
  type: z.literal('debt'),
  balance: nonNegative,
  interestPct: pct,
  /** Principal & interest only — escrowed property tax/insurance belong on the property account. */
  monthlyPayment: nonNegative,
  /**
   * Optional lump-sum payoff: in this calendar year the entire remaining balance
   * is paid (funded by the normal withdrawal waterfall, realizing any gains/tax),
   * letting you A/B "keep the loan" vs. "pay it off early." null/omitted = run to term.
   */
  payoffYear: calendarYear.nullable().optional(),
})

const accountUnionSchema = z.discriminatedUnion('type', [
  taxableAccountSchema,
  equityCompAccountSchema,
  traditionalAccountSchema,
  rothAccountSchema,
  hsaAccountSchema,
  cashAccountSchema,
  pensionSchema,
  annuitySchema,
  propertySchema,
  debtSchema,
])
export const accountSchema = accountUnionSchema.superRefine((account, ctx) => {
  if (
    (account.type === 'traditional' || account.type === 'roth') &&
    account.kind !== 'employer' &&
    account.employerMatch !== undefined
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['employerMatch'],
      message: 'Employer match can only be set on employer retirement accounts.',
    })
  }
  if (account.type === 'roth' && account.inherited !== undefined) {
    if (account.inherited.beneficiary === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inherited', 'beneficiary'],
        message:
          'an inherited Roth account must carry beneficiary facts (the legacy two-field approximation never covered Roth); supply beneficiaryClass, edbCategory, beneficiaryBirthYear, soleBeneficiary, and provenance',
      })
    }
    if (account.inherited.decedentHadStartedRmds === true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inherited', 'decedentHadStartedRmds'],
        message:
          'a Roth inherited account cannot have decedentHadStartedRmds true (a Roth owner is always treated as dying before the RBD, §1.408A-6 A-14(b)); set decedentHadStartedRmds to false',
      })
    }
  }
})
export type Account = z.infer<typeof accountSchema>
export type AccountType = Account['type']

// ---------------------------------------------------------------------------
// Insurance (discriminated union on `kind`) — roadmap V6
// ---------------------------------------------------------------------------

/**
 * Premiums are a shared shape across kinds:
 *   'lifetime' = charge annualPremium every year while the insured is alive
 *   'paidUp'   = charge nothing (fully paid up); annualPremium ignored
 *   'untilAge' = charge annualPremium through premiumEndAge (required)
 * Premiums are level (fixed nominal), not inflation-adjusted: permanent-life
 * base premiums and most LTC premiums are contractually level.
 */
const premiumModeSchema = z.enum(['lifetime', 'paidUp', 'untilAge'])

export const ltcPolicySchema = z.object({
  kind: z.literal('ltc'),
  id: idSchema,
  name: z.string().min(1),
  owner: idSchema,
  annualPremium: nonNegative,
  premiumMode: premiumModeSchema,
  /** Required iff premiumMode = 'untilAge'. Owner's age when premiums stop. */
  premiumEndAge: z.number().int().min(40).max(110).optional(),
  benefitMonthly: nonNegative,
  benefitPeriodYears: z.union([z.number().positive(), z.literal('lifetime')]),
  eliminationPeriodDays: z.number().int().min(0).max(365),
  /** Compound annual growth of the benefit cap (inflation rider). */
  inflationRiderPct: pct.optional(),
})
export type LtcPolicy = z.infer<typeof ltcPolicySchema>

export const permanentLifePolicySchema = z.object({
  kind: z.literal('permanentLife'),
  id: idSchema,
  name: z.string().min(1),
  insured: idSchema,
  beneficiary: z.union([idSchema, z.literal('estate')]),
  annualPremium: nonNegative,
  premiumMode: premiumModeSchema,
  /** Required iff premiumMode = 'untilAge'. Insured's age when premiums stop. */
  premiumEndAge: z.number().int().min(40).max(110).optional(),
  /** Current face amount, paid income-tax-free on the insured's death. */
  deathBenefit: nonNegative,
  cashValue: nonNegative,
  /** flatRate: compound cashValueGrowthPct. schedule: interpolate the illustration table by age. */
  cashValueMode: z.enum(['flatRate', 'schedule']),
  cashValueGrowthPct: pct.optional(),
  cashValueSchedule: z.array(z.object({ age: z.number().int().min(0).max(120), value: nonNegative })).optional(),
  dividendOption: z.enum(['cash', 'reducePremium', 'paidUpAdditions']).optional(),
})
export type PermanentLifePolicy = z.infer<typeof permanentLifePolicySchema>

export const insurancePolicySchema = z.discriminatedUnion('kind', [ltcPolicySchema, permanentLifePolicySchema])
export type InsurancePolicy = z.infer<typeof insurancePolicySchema>

/**
 * A deterministic late-life care episode: a spending spike (today's dollars,
 * additive to baseline spending) that an LTC policy on the same person offsets.
 * The "de-risking baseline" the policy is measured against (V6 §3).
 */
export const careEventSchema = z.object({
  id: idSchema,
  personId: idSchema,
  /** Age of the person when care begins. */
  startAge: z.number().int().min(40).max(110),
  durationYears: z.number().int().min(1).max(25),
  /** Annual care cost in today's dollars (additive to baseline spending). */
  annualCost: nonNegative,
})
export type CareEvent = z.infer<typeof careEventSchema>

// ---------------------------------------------------------------------------
// Income floor: TIPS ladders (social-security-bridge-and-tips-ladder)
// ---------------------------------------------------------------------------

/**
 * A TIPS ladder paying a level real income over a calendar window — the plan
 * artifact behind a Social Security bridge or an essential-spending floor.
 * Rungs are solved by the engine from the embedded real-yield curve
 * (`engine/ladder/ladderMath.ts`); the plan stores only the intent (target
 * income + window + optional purchase), so a curve refresh re-quotes the same
 * ladder. Cash flows run through the ledger with TIPS taxation: coupon income
 * and the annual inflation accretion (phantom OID) are federal ordinary income
 * but exempt from state tax; maturing principal is a tax-free return of
 * already-taxed dollars. Planning-grade simplifications (annual coupons, no
 * lot rounding) are documented in the ladder module.
 */
export const tipsLadderSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  /** What the ladder funds: an SS bridge window or an essential-spending floor. Labeling only. */
  purpose: z.enum(['bridge', 'floor']),
  /** First calendar year the ladder pays principal (rungs mature startYear..endYear). */
  startYear: calendarYear,
  /** Last calendar year the ladder pays (inclusive). */
  endYear: calendarYear,
  /** Level annual real income the ladder delivers in each payout year, today's dollars. */
  annualRealAmount: nonNegative,
  /**
   * Optional purchase event: the ladder's quoted cost is withdrawn from this
   * (cash/taxable/equity-comp) account in `year` — a transfer, not spending,
   * realizing gains pro-rata like any sale. Absent = the ladder is already
   * owned (no purchase flow; coupons start in the projection's first year).
   */
  purchase: z
    .object({
      year: calendarYear,
      fundingAccountId: idSchema,
    })
    .optional(),
})
export type TipsLadder = z.infer<typeof tipsLadderSchema>

/**
 * Safety-first income floor (optional, additive): TIPS ladders whose cash
 * flows live inside the ledger. Absent = no ladders, byte-identical results.
 */
export const incomeFloorSchema = z.object({
  ladders: z.array(tipsLadderSchema),
})
export type IncomeFloor = z.infer<typeof incomeFloorSchema>

// ---------------------------------------------------------------------------
// Income streams
// ---------------------------------------------------------------------------

export const yearEarningSchema = z.object({
  year: calendarYear,
  amount: nonNegative,
})

export const wagesIncomeSchema = z.object({
  type: z.literal('wages'),
  id: idSchema,
  personId: idSchema,
  annualGross: nonNegative,
  /** Stop age; null = person's retirementAge. */
  endAge: z.number().min(30).max(80).nullable(),
  /** Annual real raise rate, applied on top of general inflation. */
  realGrowthPct: pct.default(0),
})

/**
 * A former spouse who can unlock a benefit on someone else's record: a living
 * ex-spouse (divorced-spousal) or a deceased former spouse (survivor). Their PIA
 * is a simple user estimate, not an earnings import (spec §1.3).
 */
export const formerSpouseSchema = z.object({
  id: idSchema,
  /** 'divorced' = living ex (divorced-spousal); 'deceased' = former spouse who died (survivor). */
  relationship: z.enum(['divorced', 'deceased']),
  /** Ex/deceased spouse's date of birth — drives their eligibility age. */
  dob: isoDate,
  /** User-estimated monthly PIA of the ex/deceased spouse, today's dollars. */
  piaMonthly: nonNegative,
  /** Years the marriage lasted: gates divorced-spousal (≥10) and survivor (≥9 months). */
  marriageYears: nonNegative,
  /**
   * Deceased only: the claimant's age when they remarried after this death, if
   * they did. Remarriage before 60 forfeits the survivor benefit; at/after 60
   * preserves it. null = did not remarry after this spouse's death.
   */
  remarriedAtAge: z.number().int().min(0).max(120).nullable(),
  /**
   * Deceased only: the age the deceased ex actually claimed their own benefit
   * (62–70), used for the survivor base (claim-age-adjusted) and the RIB-LIM /
   * widow's-limit cap. Omitted/null = claimed at the deceased's FRA (the safe
   * default: actual benefit = PIA, no early reduction, no delayed credits), so
   * existing plans are unchanged. @see app/src/socialSecurity/survivorBenefit.ts
   */
  deceasedClaimAge: z
    .object({
      years: z.number().int().min(62).max(70),
      months: z.number().int().min(0).max(11),
    })
    .nullable()
    .optional(),
})
export type FormerSpouse = z.infer<typeof formerSpouseSchema>

export const socialSecurityIncomeSchema = z.object({
  type: z.literal('socialSecurity'),
  id: idSchema,
  personId: idSchema,
  /** Quick mode: PIA entered directly. Earnings mode: derived via socialSecurity/ (V2 phase). */
  piaMonthly: nonNegative.nullable(),
  earnings: z.array(yearEarningSchema).nullable(),
  /**
   * Earnings mode only: project covered earnings past the last imported year up
   * to a retirement age, instead of treating those years as zero (which
   * understates PIA for someone still working but retiring early). Omitted = no
   * projection (legacy behavior). `assumedAnnualEarnings` null = reuse the most
   * recent reported year; `throughAge` null = the person's retirementAge.
   */
  earningsProjection: z
    .object({
      assumedAnnualEarnings: nonNegative.nullable(),
      throughAge: z.number().int().min(50).max(75).nullable(),
    })
    .nullable()
    .optional(),
  /**
   * Optional self-reported quarters of coverage (SSA "credits"), 0–40. Used only
   * for the 10-year eligibility warning; null = estimate from earnings history.
   */
  coveredQuarters: z.number().int().min(0).max(40).nullable().optional(),
  /**
   * Former spouses who can unlock a divorced-spousal or survivor benefit on this
   * person's record. Omitted = none (no migration for plans saved before V7).
   */
  formerSpouses: z.array(formerSpouseSchema).optional(),
  /**
   * Social Security disability (SSDI). Optional — omitted/undefined ⇒ SSDI is
   * off and the stream behaves as a normal retirement claim (no behavior change
   * for existing plans). When set, the worker receives their full PIA (no
   * early-retirement reduction) from the onset age, gated by Substantial Gainful
   * Activity (earnings over SGA suspend it pre-FRA), converting to the retirement
   * benefit at FRA at the same dollar amount (no delayed-retirement credits).
   * @see app/src/socialSecurity/disability.ts · DOCS/domain/domain-rules-reference.md §4
   */
  disability: z
    .object({
      /** Age at disability onset (the benefit starts here, not at `claimAge`). */
      onsetAge: z.number().int().min(40).max(75),
    })
    .optional(),
  claimAge: z.object({
    years: z.number().int().min(62).max(70),
    months: z.number().int().min(0).max(11),
  }),
})

export const recurringIncomeSchema = z.object({
  type: z.literal('recurring'),
  id: idSchema,
  /** Rental, part-time work, royalties, … */
  label: z.string().min(1),
  annualAmount: nonNegative,
  startYear: calendarYear.nullable(),
  endYear: calendarYear.nullable(),
  inflationAdjusted: z.boolean(),
  taxTreatment: z.enum(['ordinary', 'none']),
})

export const oneTimeIncomeSchema = z.object({
  type: z.literal('oneTime'),
  id: idSchema,
  label: z.string().min(1),
  year: calendarYear,
  amount: nonNegative,
  taxTreatment: z.enum(['ordinary', 'capitalGain', 'none']),
})

export const incomeStreamSchema = z.discriminatedUnion('type', [
  wagesIncomeSchema,
  socialSecurityIncomeSchema,
  recurringIncomeSchema,
  oneTimeIncomeSchema,
])
export type IncomeStream = z.infer<typeof incomeStreamSchema>

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export const expensePhaseSchema = z.object({
  /** Phase applies from this age of the primary (first) person. */
  fromAge: z.number().int().min(40).max(110),
  /** Multiplier on baseAnnual (go-go / slow-go / no-go). */
  multiplier: z.number().min(0).max(3),
})
export type ExpensePhase = z.infer<typeof expensePhaseSchema>

/**
 * Flexibility of spending, layered from must-fund to opportunistic. Drives the
 * required-floor vs target-lifestyle distinction that guardrails act on. Absent
 * on a goal ⇒ 'target' (the migration default; preserves today's behavior).
 */
export const spendingClassificationSchema = z.enum(['required', 'target', 'ideal', 'excess'])
export type SpendingClassification = z.infer<typeof spendingClassificationSchema>

/**
 * How a one-time goal may move under a guardrail policy. 'fixed' funds in its
 * target year exactly (today's behavior); 'movable' funds in its target year
 * when spending is not being cut, and is delayed up to `latestYear` while the
 * guardrail is cutting; if still unaffordable at `latestYear` under a cut, the
 * unfunded amount is reported as a layer shortfall. 'skippable' is the same but
 * dropped entirely if it is still unaffordable at `latestYear`. Absent ⇒ 'fixed'.
 */
export const goalFlexibilitySchema = z.enum(['fixed', 'movable', 'skippable'])
export type GoalFlexibility = z.infer<typeof goalFlexibilitySchema>

export const oneTimeGoalSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  year: calendarYear,
  /** Today's dollars; inflated to the goal year by the engine. */
  amount: nonNegative,
  /** Spending flexibility layer. Absent ⇒ 'target', so pre-existing goals stay fully funded. */
  classification: spendingClassificationSchema.optional(),
  /** How the goal may move under a guardrail policy. Absent ⇒ 'fixed' (funds in `year`). */
  flexibility: goalFlexibilitySchema.optional(),
  /** Movable/skippable goals only: earliest year the goal may be pulled forward to. Absent ⇒ `year`. */
  earliestYear: calendarYear.optional(),
  /** Movable/skippable goals only: latest year the goal may be delayed to (inclusive). Absent ⇒ `year`. */
  latestYear: calendarYear.optional(),
  /** Lower numbers fund first when guardrails ration flexible spending. Absent ⇒ list order. */
  priority: z.number().int().optional(),
  /** Minimum percent of the goal that must be fundable before a partial funding is allowed. */
  minFundingPct: z.number().min(0).max(100).optional(),
  /** Allow the scheduler to resolve this goal below full funding when the hard flexible-goal budget is tight. */
  allowPartialFunding: z.boolean().optional(),
})
export type OneTimeGoal = z.infer<typeof oneTimeGoalSchema>

const acaCharacterizedAmountSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('known'), amount: nonNegative }),
  z.object({ state: z.literal('notApplicable'), amount: z.null() }),
  z.object({ state: z.literal('unknown'), amount: z.null() }),
])

export const acaYearContractSchema = z
  .object({
    year: calendarYear,
    /** HHS poverty-guideline table used for this tax family. */
    fplRegion: z.enum(['contiguous', 'alaska', 'hawaii']),
    /**
     * Tax-family membership is deliberately independent of Marketplace coverage.
     * The return's primary/spouse income is already in federal AGI; only a
     * required-filer dependent's MAGI is added separately.
     */
    taxFamilyMembers: z.array(
      z.object({
        personId: idSchema,
        relationship: z.enum(['primary', 'spouse', 'dependent']),
        requiredToFile: z.enum(['required', 'notRequired', 'unknown']),
        magi: nonNegative,
      }),
    ).min(1),
    /**
     * Actual enrollment premium and applicable SLCSP benchmark, by calendar
     * month. Zero means no Marketplace coverage in that month.
     */
    coveredMembers: z.array(
      z.object({
        personId: idSchema,
        enrollmentPremiumByMonth: z.array(nonNegative).length(12),
        slcspBenchmarkPremiumByMonth: z.array(nonNegative).length(12),
      }),
    ).min(1),
    taxExemptInterest: acaCharacterizedAmountSchema,
    foreignExclusionAddback: acaCharacterizedAmountSchema,
    /**
     * Filing/eligibility mechanics intentionally outside this planning model must
     * be affirmatively ruled out. `unsupported` fails closed; there are no silent
     * defaults for an ACA-actionable year.
     */
    assertions: z.object({
      coverageEligibility: z.enum(['supported', 'unsupported']),
      form8814: z.enum(['notApplicable', 'unsupported']),
      specialAllocation: z.enum(['notApplicable', 'unsupported']),
      marriedFilingSeparatelyException: z.enum(['notApplicable', 'unsupported']),
      selfEmployedHealthInsuranceDeduction: z.enum(['notApplicable', 'unsupported']),
      otherMaterialFacts: z.enum(['none', 'unsupported']),
    }),
  })
  .superRefine((contract, ctx) => {
    const taxFamilyIds = new Set<string>()
    contract.taxFamilyMembers.forEach((member, index) => {
      if (taxFamilyIds.has(member.personId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['taxFamilyMembers', index, 'personId'],
          message: 'tax-family member ids must be unique',
        })
      }
      taxFamilyIds.add(member.personId)
    })
    const primaryCount = contract.taxFamilyMembers.filter((member) => member.relationship === 'primary').length
    if (primaryCount !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['taxFamilyMembers'],
        message: 'an ACA tax family requires exactly one primary',
      })
    }
    const coveredIds = new Set<string>()
    contract.coveredMembers.forEach((member, index) => {
      if (coveredIds.has(member.personId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['coveredMembers', index, 'personId'],
          message: 'covered member ids must be unique',
        })
      }
      coveredIds.add(member.personId)
      if (!taxFamilyIds.has(member.personId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['coveredMembers', index, 'personId'],
          message: 'a covered member must belong to the ACA tax family',
        })
      }
    })
  })
export type AcaYearContract = z.infer<typeof acaYearContractSchema>

export const healthcareConfigSchema = z.object({
  /** Full (unsubsidized) monthly marketplace premium per pre-65 person, today's dollars. */
  pre65MonthlyPremiumPerPerson: nonNegative,
  /** Model the ACA premium tax credit against MAGI, including the 400% FPL cliff. */
  applyAcaCredit: z.boolean(),
  /**
   * Optional current-year ACA reconciliation contracts. A credit-enabled year
   * with Marketplace premiums but no matching contract funds the gross premium
   * and emits typed non-actionable evidence.
   */
  acaYears: z.array(acaYearContractSchema).optional(),
  /** Part D / Medigap / Advantage base premium per person 65+, today's dollars (Part B + IRMAA added automatically). */
  medicareExtrasMonthlyPerPerson: nonNegative,
  /**
   * Model Form SSA-44 IRMAA redetermination after a qualifying life-changing
   * event (domain rules §7). In the two years after an event — the premium
   * years whose two-year lookback still references pre-event income — IRMAA is
   * priced on the lower of the lookback MAGI and the prior year's MAGI (the
   * planning-grade stand-in for the current-year estimate SSA accepts).
   * Absent = off (today's two-year-lookback-only behavior); the form itself is
   * the user's task.
   */
  ssa44: z
    .object({
      /** Death of spouse: apply in the two years after a couple's first death. */
      survivorYears: z.boolean(),
      /** Work stoppage: also treat each person's retirement year as a qualifying event. */
      retirementYears: z.boolean(),
    })
    .optional(),
})

/**
 * Opt-in spending policy layered over the fixed baseline (planning-depth roadmap
 * §4). 'fixedTarget' (or absent) reproduces today's behavior: the whole spending
 * stack is funded every year. 'withdrawalRateGuardrails' rations the
 * discretionary layer (baseAnnual − requiredAnnual, plus flexible goals) path by
 * path — cutting when the current withdrawal rate runs too far above the
 * starting rate and restoring when it falls back — while always funding the
 * required floor. 'riskBasedGuardrails' uses the same rationing machinery but
 * triggers on the real portfolio balance against solver-derived dollar
 * thresholds: the balance levels at which the plan's Monte Carlo probability of
 * success would leave the user's target band (Kitces / risk-based guardrail
 * methodology). The thresholds are solved on shared Monte Carlo paths
 * (engine/montecarlo/riskBasedGuardrails.ts) and stored here as percentages of
 * the starting portfolio; until they are solved the mode adjusts nothing.
 * @see app/src/engine/spending/guardrails.ts
 */
/**
 * Amortization-based withdrawal (ABW) parameters — the Bogleheads-formalized
 * family that VPW, TPAW, and CAPE-based rules are members of. Each year the
 * ledger recomputes the lifestyle spending target by amortizing the actual
 * start-of-year investable balance over the remaining horizon at an expected
 * real return, with an optional spending tilt (payments planned to grow at
 * `tiltPct` real per year; negative = front-loaded, Blanchett-consistent).
 * Only used when spendingPolicy.mode = 'abw'. @see engine/spending/abw.ts
 */
export const abwPolicySchema = z.object({
  /**
   * Where the expected real return comes from:
   * - 'fixed': `fixedRealReturnPct` as entered (VPW-style global-returns preset).
   * - 'cape': equity real return = 100/CAPE (the CAEY), blended with
   *   `bondRealYieldPct` at `equitySharePct` (ERN/TPAW-style conditioning).
   * - 'tips': the whole portfolio priced at `bondRealYieldPct` (TIPS-curve
   *   floor reading — the most conservative source).
   */
  returnSource: z.enum(['fixed', 'cape', 'tips']),
  /** Expected real return %/yr for 'fixed'. Absent ⇒ 3.8 (VPW global IRRs, 60/40; ABW_DEFAULTS). */
  fixedRealReturnPct: z.number().min(-5).max(12).optional(),
  /** Starting CAPE for 'cape'. Absent ⇒ 25 (matches the CAPE market model default). */
  startingCape: z.number().min(5).max(60).optional(),
  /** Equity share %, blends CAEY with the bond yield under 'cape'. Absent ⇒ 60. */
  equitySharePct: z.number().min(0).max(100).optional(),
  /** Real bond/TIPS yield %/yr for 'cape' blending and 'tips'. Absent ⇒ 2.0. */
  bondRealYieldPct: z.number().min(-2).max(8).optional(),
  /**
   * Amortization horizon: 'planningAge' (the household's plan horizon) or the
   * age the primary has a 25%/10% chance of reaching (couples: either member;
   * survival percentiles from the same SSA table as the horizon picker).
   */
  horizon: z.enum(['planningAge', 'survival25', 'survival10']).optional(),
  /** Planned real spending growth %/yr (negative = spend more early). Absent ⇒ 0. */
  tiltPct: z.number().min(-5).max(5).optional(),
})
export type AbwPolicy = z.infer<typeof abwPolicySchema>

export const spendingPolicySchema = z.object({
  /**
   * 'abw' replaces the fixed baseline with the amortization rule in `abw`:
   * base + phase spending is ignored and the year's lifestyle target is the
   * amortized payment (healthcare, debt, property, and one-time goals stay
   * separately modeled on top). Guardrail fields are unused under 'abw'.
   */
  mode: z.enum(['fixedTarget', 'withdrawalRateGuardrails', 'riskBasedGuardrails', 'abw']),
  /** ABW parameters; only read when mode = 'abw'. Absent ⇒ VPW-style defaults. */
  abw: abwPolicySchema.optional(),
  /** Cut discretionary spending when the current withdrawal rate exceeds this % of the starting rate. Absent ⇒ 120. */
  upperGuardrailPct: z.number().positive().optional(),
  /** Raise discretionary spending when the current withdrawal rate falls below this % of the starting rate. 0 ⇒ never raise. Absent ⇒ 80. */
  lowerGuardrailPct: z.number().min(0).optional(),
  /** Risk-based: cut when the plan's probability of success would fall below this %. Absent ⇒ 70. */
  targetSuccessLowerPct: z.number().min(1).max(99).optional(),
  /** Risk-based: raise when the plan's probability of success would rise above this %. Absent ⇒ 95. */
  targetSuccessUpperPct: z.number().min(1).max(100).optional(),
  /** Risk-based, solver output: real balance as a % of the starting portfolio below which cuts trigger. */
  lowerBalanceThresholdPct: z.number().positive().optional(),
  /** Risk-based, solver output: real balance as a % of the starting portfolio above which raises trigger. */
  upperBalanceThresholdPct: z.number().positive().optional(),
  /** Size of each cut/raise as a percent of the full discretionary layer. Absent ⇒ 10. */
  adjustmentPct: z.number().min(0).max(100).optional(),
  /** Allow raises above the target lifestyle into ideal/excess annual layers and early flexible goals. */
  allowRaisesAboveTarget: z.boolean().optional(),
})
export type SpendingPolicy = z.infer<typeof spendingPolicySchema>

export const expensePlanSchema = z.object({
  /** Baseline annual spending in today's dollars, excluding healthcare and debt payments. */
  baseAnnual: nonNegative,
  /**
   * Required-floor annual lifestyle spending in today's dollars: the must-fund
   * layer a guardrail policy will never cut. The gap baseAnnual − requiredAnnual
   * is the discretionary lifestyle layer. Absent ⇒ equals baseAnnual (no
   * discretionary lifestyle layer), so pre-existing plans keep today's behavior.
   */
  requiredAnnual: nonNegative.optional(),
  /** Annual ideal spending above the target lifestyle, funded only in fixed-target mode or strong guardrail paths. */
  idealAnnual: nonNegative.optional(),
  /** Annual opportunistic spending above ideal, funded last. */
  excessAnnual: nonNegative.optional(),
  phases: z.array(expensePhaseSchema),
  oneTimeGoals: z.array(oneTimeGoalSchema),
  healthcare: healthcareConfigSchema,
  /** Opt-in spending policy; absent ⇒ fixed-target (today's behavior). */
  spendingPolicy: spendingPolicySchema.optional(),
  /**
   * Household spending in survivor years (exactly one member of a multi-person
   * household alive) as a percent of couple spending. Scales base + phase
   * spending only; one-time goals, healthcare, debt, and property costs are
   * unaffected. Absent = 100 (no change), so older saved plans stay valid.
   */
  survivorSpendingPct: z.number().min(0).max(100).optional(),
  /**
   * Bequest target in today's dollars: the after-tax estate the plan should
   * still leave at the end. Feeds the sustainable-spending solver's estate
   * floor and the estate-floor objective policies. Absent or 0 = no target.
   */
  bequestTargetDollars: nonNegative.optional(),
})
export type ExpensePlan = z.infer<typeof expensePlanSchema>

// ---------------------------------------------------------------------------
// Strategies (schema-complete ahead of their engines; see roadmap V3)
// ---------------------------------------------------------------------------

export const rothConversionStrategySchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('none') }),
  z.object({
    mode: z.literal('manual'),
    conversions: z.array(z.object({ year: calendarYear, amount: nonNegative })),
  }),
  /**
   * An explicit per-year conversion schedule produced by the V8 optimizer.
   * Behaves exactly like `manual` in the ledger; the distinct mode preserves
   * provenance so the UI can label it and offer "accept as manual" (which just
   * rewrites it as `manual`). Optional `optimizedAtIso` records when it was run.
   */
  z.object({
    mode: z.literal('optimized'),
    conversions: z.array(z.object({ year: calendarYear, amount: nonNegative })),
    optimizedAtIso: isoTimestamp.optional(),
  }),
  z.object({
    mode: z.literal('fillToTarget'),
    target: z.enum(['topOfBracket', 'irmaaTier', 'acaCliff', 'fixedMagi']),
    /** Bracket rate (e.g. 24) when target=topOfBracket; tier index when irmaaTier; MAGI when fixedMagi. */
    targetValue: z.number().nullable(),
    startYear: calendarYear,
    endYear: calendarYear,
  }),
])

export const withdrawalStrategySchema = z.discriminatedUnion('mode', [
  /** Drain cash → taxable → vested equity comp → traditional → Roth → HSA (SEQUENTIAL_ORDER in simulate.ts). */
  z.object({ mode: z.literal('sequential') }),
  /** Pro-rata across cash/taxable/vested equity comp/traditional/Roth; HSA last. */
  z.object({ mode: z.literal('proportional') }),
  /** Traditional first up to the top of the given bracket, then sequential, then traditional again. */
  z.object({ mode: z.literal('bracketTargeted'), bracketPct: z.number().positive() }),
])

/**
 * Itemized-deduction components in today's dollars (roadmap V8). Optional — when
 * present, federal tax uses the greater of the standard deduction and this total
 * (SALT capped by the pack). SALT is the user's own estimate of deductible
 * state/local/property tax, kept separate from the engine's computed state tax.
 */
export const itemizedDeductionsSchema = z.object({
  stateAndLocalTaxes: nonNegative,
  mortgageInterest: nonNegative,
  charitable: nonNegative,
})
export type ItemizedDeductions = z.infer<typeof itemizedDeductionsSchema>

export const strategiesSchema = z.object({
  withdrawalOrder: withdrawalStrategySchema,
  rothConversion: rothConversionStrategySchema,
  /** Qualified charitable distributions per year (today's dollars), routed from RMDs when age-eligible. */
  qcdAnnual: nonNegative,
  /**
   * Identity-complete retirement action requests. The legacy scalar strategies
   * above remain independently calculable; migration does not fabricate the
   * people, accounts, dates, or purposes needed to turn them into actions.
   */
  retirementActions: z.array(persistedRetirementActionRequestSchema).default([]),
  /** Optional itemized deductions; federal tax uses the greater of these vs. the standard deduction. */
  itemizedDeductions: itemizedDeductionsSchema.optional(),
  /**
   * Taxable safety-net floor (today's dollars, inflation-adjusted): a minimum
   * combined cash + taxable + vested equity-comp reserve that need-based
   * withdrawals preserve while other account types can still fund spending,
   * and that fill-to-target Roth conversions are trimmed to respect (the
   * conversion's tax bill must be payable from liquid dollars above the
   * floor). Breached only as a last resort, with a warning, rather than
   * reporting an artificial shortfall. Absent or 0 = no floor.
   */
  taxableSafetyNetFloor: nonNegative.optional(),
  /**
   * Survivor reserve target (today's dollars, inflation-adjusted): a minimum
   * investable balance the household should retain through survivor years (when
   * exactly one member of a couple is alive). Consumed by the
   * `protect-survivor-liquidity` objective policy as a hard constraint — a
   * candidate whose worst survivor-year investable balance falls below the
   * (inflated) target is disqualified with a readable loss reason. Absent or
   * 0 = no reserve constraint. @see guaranteed-income-and-estate-depth
   */
  survivorReserveTarget: nonNegative.optional(),
})
export type Strategies = z.infer<typeof strategiesSchema>

// ---------------------------------------------------------------------------
// Assumptions
// ---------------------------------------------------------------------------

export const assumptionsSchema = z.object({
  inflationPct: pct,
  /** Healthcare costs grow at inflationPct + this. */
  healthcareExtraInflationPct: pct,
  /** Applied to any account with annualReturnPct = null. */
  defaultReturnPct: pct,
  ssCola: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('matchInflation') }),
    z.object({ mode: z.literal('fixed'), annualPct: pct }),
  ]),
  /** Trust-fund scenario toggle; null = scheduled benefits. @see DOCS/domain/domain-rules-reference.md §4 */
  ssHaircut: z.object({ fromYear: calendarYear, cutPct: z.number().min(0).max(100) }).nullable(),
  /** Effective state income-tax rate until per-state tables ship (roadmap V5). */
  stateEffectiveTaxPct: z.number().min(0).max(20),
  /** Optional flat local income tax, applied to modeled state taxable income. */
  localIncomeTaxPct: z.number().min(0).max(10).default(0),
  /** Recent annual MAGI, used for IRMAA's 2-year lookback in the first projection years. */
  recentAnnualMagi: nonNegative,
  /**
   * Optional tax-year MAGI history for exact IRMAA lookbacks before the
   * projection begins. A year-specific value takes precedence over
   * `recentAnnualMagi`, which remains the backward-compatible fallback.
   */
  historicalAnnualMagiByYear: z
    .record(z.string().regex(/^\d{4}$/), nonNegative)
    .optional(),
  /**
   * Assumed marginal income-tax rate heirs pay on inherited pre-tax (traditional)
   * balances, used by the after-tax estate metric. Roth and stepped-up taxable
   * accounts pass through untaxed. Optional with a default so older saved plans
   * stay valid without a schema migration.
   */
  heirTaxRatePct: z.number().min(0).max(50).default(25),
  /**
   * Optional per-account-class overrides of `heirTaxRatePct`, so the after-tax
   * estate can price pre-tax classes at different heir brackets (e.g. a large
   * inherited traditional balance pushing the heir into a higher bracket than a
   * modest HSA). An omitted class falls back to `heirTaxRatePct`, so absent =
   * today's flat treatment.
   */
  heirTaxByClass: z
    .object({
      traditional: z.number().min(0).max(50).optional(),
      hsa: z.number().min(0).max(50).optional(),
    })
    .optional(),
  /** Assumed safe withdrawal rate percentage, used to derive the FI number. */
  safeWithdrawalRatePct: z.number().gt(0).lt(1000).default(4),
  /**
   * Optional overrides of the sourced asset-class defaults (return, volatility,
   * yields) used by allocated accounts. Absent = the documented defaults in
   * `engine/allocation/assetClasses.ts`; irrelevant to plans with no allocated
   * accounts, so older saved plans stay valid without a migration.
   */
  assetClassParams: assetClassParamOverridesSchema.optional(),
})
export type Assumptions = z.infer<typeof assumptionsSchema>

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

export const scenarioSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  /**
   * Partial deep-override of the plan, applied before simulation (roadmap V4).
   * Stored loosely typed; values are validated when the merged plan is re-parsed.
   */
  patch: z.record(z.string(), z.unknown()),
})
export type Scenario = z.infer<typeof scenarioSchema>

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export const planOriginSchema = z.enum(['user', 'example']).default('user')
export type PlanOrigin = z.infer<typeof planOriginSchema>

const eligibilityEvidenceIdSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, { message: 'evidenceId must not be blank' })
const eligibilityEvidenceProvenanceSchema = z
  .object({
    source: z.enum(['manual', 'import']),
    sourceId: z
      .string()
      .min(1)
      .refine((value) => value.trim().length > 0, { message: 'sourceId must not be blank' })
      .optional(),
  })
  .strict()
const eligibilityEvidenceBaseShape = {
  evidenceId: eligibilityEvidenceIdSchema,
  provenance: eligibilityEvidenceProvenanceSchema,
}

export const retirementActionIraClassificationSchema = z.discriminatedUnion('subtype', [
  z
    .object({
      ...eligibilityEvidenceBaseShape,
      sourceAccountId: idSchema,
      subtype: z.literal('traditional'),
    })
    .strict(),
  z
    .object({
      ...eligibilityEvidenceBaseShape,
      sourceAccountId: idSchema,
      subtype: z.literal('sep'),
    })
    .strict(),
  z
    .object({
      ...eligibilityEvidenceBaseShape,
      sourceAccountId: idSchema,
      subtype: z.literal('simple'),
      simpleParticipationStartDate: isoDate
        .refine((value) => parseCivilIsoDate(value) !== null, {
          message: 'expected a real canonical civil date',
        })
        .optional(),
    })
    .strict(),
])
export type RetirementActionIraClassification = z.infer<
  typeof retirementActionIraClassificationSchema
>

export const retirementActionSepSimpleActivitySchema = z
  .object({
    ...eligibilityEvidenceBaseShape,
    sourceAccountId: idSchema,
    actionTaxYear: calendarYear,
    planYearEndDate: isoDate.refine((value) => parseCivilIsoDate(value) !== null, {
      message: 'expected a real canonical civil date',
    }),
    employerContributionMadeForPlanYear: z.boolean(),
  })
  .strict()
  .superRefine((activity, ctx) => {
    if (Number(activity.planYearEndDate.slice(0, 4)) !== activity.actionTaxYear) {
      ctx.addIssue({
        code: 'custom',
        path: ['planYearEndDate'],
        message: 'planYearEndDate must be in actionTaxYear',
      })
    }
  })
export type RetirementActionSepSimpleActivity = z.infer<
  typeof retirementActionSepSimpleActivitySchema
>

export const retirementActionDeductibleIraContributionSchema = z
  .object({
    ...eligibilityEvidenceBaseShape,
    donorPersonId: idSchema,
    taxYear: calendarYear,
    amountCents: usdCentsSchema.describe(
      'Deductible IRA contribution amount in nonnegative integer US-dollar cents.',
    ),
  })
  .strict()
export type RetirementActionDeductibleIraContribution = z.infer<
  typeof retirementActionDeductibleIraContributionSchema
>

export const retirementActionEligibilityFactsSchema = z
  .object({
    iraClassifications: z.array(retirementActionIraClassificationSchema),
    sepSimpleActivities: z.array(retirementActionSepSimpleActivitySchema),
    deductibleIraContributions: z.array(retirementActionDeductibleIraContributionSchema),
  })
  .strict()
export type RetirementActionEligibilityFacts = z.infer<
  typeof retirementActionEligibilityFactsSchema
>

export const planSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_PLAN_SCHEMA_VERSION),
    id: idSchema,
    name: z.string().min(1),
    /** Distinguishes user-owned plans from library demos filtered out of My Plans. */
    origin: planOriginSchema,
    /** Registry example id when this plan came from (or was converted from) the library. */
    exampleSourceId: z.string().optional(),
    createdAtIso: isoTimestamp,
    updatedAtIso: isoTimestamp,
    household: householdSchema,
    accounts: z.array(accountSchema),
    /** Insurance policies (LTC + permanent life). Default [] so pre-V6 plans stay valid without a migration. */
    insurance: z.array(insurancePolicySchema).default([]),
    /** Deterministic LTC care episodes. Default [] so pre-V6 plans stay valid without a migration. */
    careEvents: z.array(careEventSchema).default([]),
    incomes: z.array(incomeStreamSchema),
    /** Optional TIPS-ladder income floor. Absent = no ladders (no migration needed). */
    incomeFloor: incomeFloorSchema.optional(),
    expenses: expensePlanSchema,
    strategies: strategiesSchema,
    assumptions: assumptionsSchema,
    /** Durable action eligibility evidence; intentionally absent until explicitly authored. */
    retirementActionEligibilityFacts: retirementActionEligibilityFactsSchema.optional(),
    /** Authoritative real-world annual tax sources; never inferred from projection fields. */
    retirementActionAnnualTaxFacts: retirementActionAnnualTaxFactsSchema.optional(),
    scenarios: z.array(scenarioSchema),
  })
  .superRefine((plan, ctx) => {
    const actionIndexesById = new Map<string, number[]>()
    plan.strategies.retirementActions.forEach((action, index) => {
      const indexes = actionIndexesById.get(action.actionId)
      if (indexes === undefined) actionIndexesById.set(action.actionId, [index])
      else indexes.push(index)
    })
    let hasDuplicateActionIds = false
    for (const [actionId, indexes] of actionIndexesById) {
      if (indexes.length < 2) continue
      hasDuplicateActionIds = true
      indexes.forEach((index) => {
        ctx.addIssue({
          code: 'custom',
          path: ['strategies', 'retirementActions', index, 'actionId'],
          message: `duplicate retirement action id "${actionId}"`,
        })
      })
    }

    if (plan.household.filingStatus === 'marriedFilingJointly' && plan.household.people.length !== 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['household', 'filingStatus'],
        message: 'marriedFilingJointly requires exactly two people',
      })
    }
    const personIds = new Set(plan.household.people.map((p) => p.id))
    const actionReferencedPersonIds = new Set<string>()
    const actionReferencedAccountIds = new Set<string>()
    plan.strategies.retirementActions.forEach((action) => {
      if (
        action.kind === 'legacyAggregateWithdrawal' ||
        action.kind === 'legacyAggregateRothConversion' ||
        action.kind === 'legacyAggregateQcd'
      ) {
        return
      }
      if (action.kind === 'qcd') {
        actionReferencedPersonIds.add(action.donorPersonId)
        actionReferencedAccountIds.add(action.allocation.sourceAccountId)
        return
      }
      actionReferencedPersonIds.add(action.personId)
      action.allocations.forEach((allocation) => {
        actionReferencedAccountIds.add(allocation.sourceAccountId)
      })
      if (action.kind === 'rothConversion') {
        actionReferencedAccountIds.add(action.destinationRothAccountId)
      }
    })
    // A lump-sum rollover target and a qualified annuity's funding source get
    // the same ambiguity protection as action-referenced accounts: their
    // ownership validations resolve the id through a map (last duplicate wins)
    // while the simulator resolves balances first-match-wins, so a duplicated
    // id could pass validation against one record and move money in another.
    plan.accounts.forEach((account) => {
      if (account.type === 'pension' && account.lumpSumElection !== undefined && account.lumpSumOffer !== undefined) {
        actionReferencedAccountIds.add(account.lumpSumElection.rolloverAccountId)
      }
      if (account.type === 'annuity' && account.purchase !== undefined) {
        actionReferencedAccountIds.add(account.purchase.fundingAccountId)
      }
    })
    const personIndexesById = new Map<string, number[]>()
    plan.household.people.forEach((person, index) => {
      const indexes = personIndexesById.get(person.id)
      if (indexes === undefined) personIndexesById.set(person.id, [index])
      else indexes.push(index)
    })
    let hasAmbiguousActionPersonIds = false
    for (const [personId, indexes] of personIndexesById) {
      if (indexes.length < 2 || !actionReferencedPersonIds.has(personId)) continue
      hasAmbiguousActionPersonIds = true
      indexes.forEach((index) => {
        ctx.addIssue({
          code: 'custom',
          path: ['household', 'people', index, 'id'],
          message: `duplicate person id "${personId}"`,
        })
      })
    }
    const accountIndexesById = new Map<string, number[]>()
    plan.accounts.forEach((account, index) => {
      const indexes = accountIndexesById.get(account.id)
      if (indexes === undefined) accountIndexesById.set(account.id, [index])
      else indexes.push(index)
    })
    let hasAmbiguousActionAccountIds = false
    for (const [accountId, indexes] of accountIndexesById) {
      if (indexes.length < 2 || !actionReferencedAccountIds.has(accountId)) continue
      hasAmbiguousActionAccountIds = true
      indexes.forEach((index) => {
        ctx.addIssue({
          code: 'custom',
          path: ['accounts', index, 'id'],
          message: `duplicate account id "${accountId}"`,
        })
      })
    }
    const accountTypeById = new Map(plan.accounts.map((a) => [a.id, a.type]))
    const accountById = new Map(plan.accounts.map((account) => [account.id, account]))
    const personById = new Map(plan.household.people.map((p) => [p.id, p]))

    /**
     * The document's own "as of" calendar year, or null when the stamp is not a
     * plain ISO date.
     *
     * A projection always starts in the current calendar year (planner-ui
     * `currentStartYear`), and every save re-stamps `updatedAtIso` from the same
     * clock immediately before this parse runs (`checkPlanForSave`), so at the
     * moment a plan is authored or edited this year IS the projection start.
     * Reading the year from the document rather than the wall clock is what
     * keeps `parsePlan` a pure function of its input: a plan that saved cleanly
     * always reopens cleanly (`loadPlan` parses the STORED stamp), so a
     * year-relative refusal below can never lock the household out of the very
     * plan it is telling them to edit.
     */
    const planAsOfYear = ((): number | null => {
      const stamped = /^(\d{4})-/.exec(plan.updatedAtIso)
      return stamped === null ? null : Number(stamped[1])
    })()

    const annualTaxFacts = plan.retirementActionAnnualTaxFacts
    if (annualTaxFacts !== undefined) {
      const records = annualTaxFacts.ownedNonRothIraAnnualFilingSourceRecords
      const indexesByKey = new Map<string, number[]>()
      const sourceClaimsByIdentifier = new Map<string, Array<{
        path: PropertyKey[]
      }>>()
      records.forEach((record, index) => {
        const key = ownedNonRothIraAnnualFilingSourceKey(record)
        const keyIndexes = indexesByKey.get(key)
        if (keyIndexes === undefined) indexesByKey.set(key, [index])
        else keyIndexes.push(index)

        const root = ['retirementActionAnnualTaxFacts', 'ownedNonRothIraAnnualFilingSourceRecords', index] as const
        planOwnedNonRothIraAnnualFilingSourceIdentifierClaims(record).forEach((claim) => {
          const path = [...root, ...claim.path]
          const matches = sourceClaimsByIdentifier.get(claim.value)
          if (matches === undefined) {
            sourceClaimsByIdentifier.set(claim.value, [{ path }])
          } else matches.push({ path })
        })
        if (record.planId !== plan.id) {
          ctx.addIssue({
            code: 'custom',
            path: [...root, 'planId'],
            message: 'annual filing source record must bind the containing Plan id',
          })
        }
        const ownerIndexes = personIndexesById.get(record.ownerPersonId)
        if (ownerIndexes?.length !== 1) {
          ctx.addIssue({
            code: 'custom',
            path: [...root, 'ownerPersonId'],
            message: 'annual filing source owner must resolve uniquely in the Plan',
          })
        }
        const expectedPool = plan.accounts
          .filter((account) =>
            account.type === 'traditional' &&
            account.kind === 'ira' &&
            account.inherited === undefined &&
            account.ownerPersonId === record.ownerPersonId)
          .map((account) => account.id)
          .sort()
        const reviewedPool = [...record.reviewedSourceAccountIds].sort()
        if (
          expectedPool.length === 0 ||
          expectedPool.length !== reviewedPool.length ||
          expectedPool.some((accountId, poolIndex) => accountId !== reviewedPool[poolIndex])
        ) {
          ctx.addIssue({
            code: 'custom',
            path: [...root, 'reviewedSourceAccountIds'],
            message: 'annual filing source must review the exact current owner-wide IRA pool',
          })
        }
      })
      for (const indexes of indexesByKey.values()) {
        if (indexes.length < 2) continue
        indexes.forEach((index) => ctx.addIssue({
          code: 'custom',
          path: ['retirementActionAnnualTaxFacts', 'ownedNonRothIraAnnualFilingSourceRecords', index],
          message: 'duplicate annual filing source Plan, owner, and tax year',
        }))
      }
      const reservedIdentifiers = retirementActionPlanReservedIdentifiers(plan)
      for (const [identifier, claims] of sourceClaimsByIdentifier) {
        if (claims.length < 2 && !reservedIdentifiers.has(identifier)) continue
        claims.forEach((claim) => ctx.addIssue({
          code: 'custom',
          path: claim.path,
          message: reservedIdentifiers.has(identifier)
            ? `annual filing source identifier "${identifier}" collides with the Plan identity namespace`
            : `duplicate annual filing source identifier "${identifier}"`,
        }))
      }
    }

    const eligibilityFacts = plan.retirementActionEligibilityFacts
    if (eligibilityFacts !== undefined) {
      type EvidenceRecord = {
        evidenceId: string
        path: ['iraClassifications' | 'sepSimpleActivities' | 'deductibleIraContributions', number]
      }
      const evidenceRecords: EvidenceRecord[] = [
        ...eligibilityFacts.iraClassifications.map((record, index) => ({
          evidenceId: record.evidenceId,
          path: ['iraClassifications' as const, index] as EvidenceRecord['path'],
        })),
        ...eligibilityFacts.sepSimpleActivities.map((record, index) => ({
          evidenceId: record.evidenceId,
          path: ['sepSimpleActivities' as const, index] as EvidenceRecord['path'],
        })),
        ...eligibilityFacts.deductibleIraContributions.map((record, index) => ({
          evidenceId: record.evidenceId,
          path: ['deductibleIraContributions' as const, index] as EvidenceRecord['path'],
        })),
      ]
      const evidenceById = new Map<string, EvidenceRecord[]>()
      evidenceRecords.forEach((record) => {
        const matches = evidenceById.get(record.evidenceId)
        if (matches === undefined) evidenceById.set(record.evidenceId, [record])
        else matches.push(record)
      })
      evidenceById.forEach((records, evidenceId) => {
        if (records.length < 2) return
        records.forEach((record) => {
          ctx.addIssue({
            code: 'custom',
            path: ['retirementActionEligibilityFacts', ...record.path, 'evidenceId'],
            message: `duplicate eligibility evidence id "${evidenceId}"`,
          })
        })
      })

      const classificationsBySource = new Map<
        string,
        { record: RetirementActionIraClassification; index: number }[]
      >()
      eligibilityFacts.iraClassifications.forEach((record, index) => {
        const matches = classificationsBySource.get(record.sourceAccountId)
        if (matches === undefined) {
          classificationsBySource.set(record.sourceAccountId, [{ record, index }])
        } else {
          matches.push({ record, index })
        }
      })
      classificationsBySource.forEach((records, sourceAccountId) => {
        if (records.length < 2) return
        records.forEach(({ index }) => {
          ctx.addIssue({
            code: 'custom',
            path: [
              'retirementActionEligibilityFacts',
              'iraClassifications',
              index,
              'sourceAccountId',
            ],
            message: `duplicate IRA classification source "${sourceAccountId}"`,
          })
        })
      })
      eligibilityFacts.iraClassifications.forEach((record, index) => {
        const accountIndexes = accountIndexesById.get(record.sourceAccountId)
        const account =
          accountIndexes?.length === 1 ? plan.accounts[accountIndexes[0]!] : undefined
        if (account === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [
              'retirementActionEligibilityFacts',
              'iraClassifications',
              index,
              'sourceAccountId',
            ],
            message: `IRA classification source "${record.sourceAccountId}" must resolve uniquely`,
          })
        } else if (
          account.type !== 'traditional' ||
          account.kind !== 'ira' ||
          account.ownerPersonId === null ||
          account.inherited !== undefined
        ) {
          ctx.addIssue({
            code: 'custom',
            path: [
              'retirementActionEligibilityFacts',
              'iraClassifications',
              index,
              'sourceAccountId',
            ],
            message: 'IRA classification requires an owned non-inherited traditional IRA',
          })
        }
      })

      const activitiesBySourceYear = new Map<string, number[]>()
      eligibilityFacts.sepSimpleActivities.forEach((record, index) => {
        const key = JSON.stringify([record.sourceAccountId, record.actionTaxYear])
        const indexes = activitiesBySourceYear.get(key)
        if (indexes === undefined) activitiesBySourceYear.set(key, [index])
        else indexes.push(index)
      })
      activitiesBySourceYear.forEach((indexes) => {
        if (indexes.length < 2) return
        indexes.forEach((index) => {
          ctx.addIssue({
            code: 'custom',
            path: [
              'retirementActionEligibilityFacts',
              'sepSimpleActivities',
              index,
              'sourceAccountId',
            ],
            message: 'duplicate SEP/SIMPLE activity source and action tax year',
          })
        })
      })
      eligibilityFacts.sepSimpleActivities.forEach((record, index) => {
        const classifications = classificationsBySource.get(record.sourceAccountId)
        if (
          classifications?.length !== 1 ||
          classifications[0]!.record.subtype === 'traditional'
        ) {
          ctx.addIssue({
            code: 'custom',
            path: [
              'retirementActionEligibilityFacts',
              'sepSimpleActivities',
              index,
              'sourceAccountId',
            ],
            message: 'SEP/SIMPLE activity requires exactly one SEP or SIMPLE classification',
          })
        }
      })

      const contributionsByDonorYear = new Map<string, number[]>()
      eligibilityFacts.deductibleIraContributions.forEach((record, index) => {
        const key = JSON.stringify([record.donorPersonId, record.taxYear])
        const indexes = contributionsByDonorYear.get(key)
        if (indexes === undefined) contributionsByDonorYear.set(key, [index])
        else indexes.push(index)
      })
      contributionsByDonorYear.forEach((indexes) => {
        if (indexes.length < 2) return
        indexes.forEach((index) => {
          ctx.addIssue({
            code: 'custom',
            path: [
              'retirementActionEligibilityFacts',
              'deductibleIraContributions',
              index,
              'donorPersonId',
            ],
            message: 'duplicate deductible IRA contribution donor and tax year',
          })
        })
      })
      eligibilityFacts.deductibleIraContributions.forEach((record, index) => {
        const personIndexes = personIndexesById.get(record.donorPersonId)
        const donor =
          personIndexes?.length === 1
            ? plan.household.people[personIndexes[0]!]
            : undefined
        const thresholdDate = donor === undefined ? null : addCalendarMonths(donor.dob, 846)
        if (donor === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [
              'retirementActionEligibilityFacts',
              'deductibleIraContributions',
              index,
              'donorPersonId',
            ],
            message: `deductible IRA contribution donor "${record.donorPersonId}" must resolve uniquely`,
          })
        } else if (
          thresholdDate === null ||
          record.taxYear < Number(thresholdDate.slice(0, 4))
        ) {
          ctx.addIssue({
            code: 'custom',
            path: [
              'retirementActionEligibilityFacts',
              'deductibleIraContributions',
              index,
              'taxYear',
            ],
            message: 'deductible IRA contribution tax year precedes the donor age-70½ threshold year',
          })
        }
      })
    }

    if (
      !hasDuplicateActionIds &&
      !hasAmbiguousActionPersonIds &&
      !hasAmbiguousActionAccountIds
    ) {
      const validateOwnedAccount = (
        actionIndex: number,
        personId: string,
        accountId: string,
        path: (string | number)[],
      ): void => {
        const account = accountById.get(accountId)
        if (account === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['strategies', 'retirementActions', actionIndex, ...path],
            message: `unknown account id "${accountId}"`,
          })
        } else if (account.ownerPersonId !== null && account.ownerPersonId !== personId) {
          ctx.addIssue({
            code: 'custom',
            path: ['strategies', 'retirementActions', actionIndex, ...path],
            message: `account "${accountId}" is owned by a different person`,
          })
        }
      }

      plan.strategies.retirementActions.forEach((action, actionIndex) => {
        if (
          action.kind === 'legacyAggregateWithdrawal' ||
          action.kind === 'legacyAggregateRothConversion' ||
          action.kind === 'legacyAggregateQcd'
        ) {
          return
        }

        const personId =
          action.kind === 'qcd' ? action.donorPersonId : action.personId
        const personPath = action.kind === 'qcd' ? 'donorPersonId' : 'personId'
        if (!personIds.has(personId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['strategies', 'retirementActions', actionIndex, personPath],
            message: `unknown person id "${personId}"`,
          })
        }

        if (action.kind === 'qcd') {
          validateOwnedAccount(
            actionIndex,
            action.donorPersonId,
            action.allocation.sourceAccountId,
            ['allocation', 'sourceAccountId'],
          )
          return
        }

        action.allocations.forEach((allocation, allocationIndex) => {
          validateOwnedAccount(
            actionIndex,
            action.personId,
            allocation.sourceAccountId,
            ['allocations', allocationIndex, 'sourceAccountId'],
          )
        })

        if (action.kind !== 'rothConversion') return
        validateOwnedAccount(
          actionIndex,
          action.personId,
          action.destinationRothAccountId,
          ['destinationRothAccountId'],
        )
        const destination = accountById.get(action.destinationRothAccountId)
        if (destination !== undefined && destination.type !== 'roth') {
          ctx.addIssue({
            code: 'custom',
            path: [
              'strategies',
              'retirementActions',
              actionIndex,
              'destinationRothAccountId',
            ],
            message: `conversion destination "${action.destinationRothAccountId}" must be a Roth account`,
          })
        }

        if (action.taxFunding.kind !== 'linkedWithdrawal') return
        const withdrawalActionId = action.taxFunding.withdrawalActionId
        const linkedIndexes = actionIndexesById.get(withdrawalActionId)
        const withdrawal =
          linkedIndexes?.length === 1
            ? plan.strategies.retirementActions[linkedIndexes[0]!]
            : undefined
        if (
          withdrawal === undefined ||
          withdrawal.kind !== 'ordinaryWithdrawal' ||
          withdrawal.personId !== action.personId ||
          withdrawal.year !== action.year ||
          withdrawal.purpose.kind !== 'taxPayment' ||
          withdrawal.purpose.referenceId !== action.actionId
        ) {
          ctx.addIssue({
            code: 'custom',
            path: [
              'strategies',
              'retirementActions',
              actionIndex,
              'taxFunding',
              'withdrawalActionId',
            ],
            message:
              'linked withdrawal must resolve to exactly one same-person/year ordinary withdrawal whose taxPayment purpose references this conversion',
          })
        }
      })
    }

    plan.accounts.forEach((a, i) => {
      if (a.type === 'equityComp' && a.vestingMode === 'cliff' && a.vestDate === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['accounts', i, 'vestDate'],
          message: 'cliff-vesting equity compensation requires a vest date',
        })
      }
      if (individuallyOwnedAccountTypes.has(a.type) && a.ownerPersonId === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['accounts', i, 'ownerPersonId'],
          message: `${a.type} accounts must have an individual owner`,
        })
      }
      if (a.ownerPersonId !== null && !personIds.has(a.ownerPersonId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['accounts', i, 'ownerPersonId'],
          message: `unknown person id "${a.ownerPersonId}"`,
        })
      }
      if (a.type === 'traditional' && a.nondeductibleBasis !== undefined) {
        if (a.kind !== 'ira') {
          ctx.addIssue({
            code: 'custom',
            path: ['accounts', i, 'nondeductibleBasis'],
            message: 'nondeductible (Form 8606) basis applies to traditional IRAs only',
          })
        } else if (a.inherited !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['accounts', i, 'nondeductibleBasis'],
            message: 'nondeductible basis is not modeled on inherited IRAs (the beneficiary files a separate Form 8606)',
          })
        }
      }
      if (a.type === 'hsa' && a.reimburseLater === true && a.withdrawalTreatment !== 'capByMedicalExpenses') {
        ctx.addIssue({
          code: 'custom',
          path: ['accounts', i, 'reimburseLater'],
          message: "reimburse-later accumulation requires the 'capByMedicalExpenses' withdrawal treatment",
        })
      }
      if (a.type === 'property' && a.depreciationRecapture !== undefined && a.costBasis === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['accounts', i, 'depreciationRecapture'],
          message: 'depreciation recapture requires a cost basis',
        })
      }
      if ('allocation' in a && a.allocation?.mode === 'linear' && a.allocation.endYear <= a.allocation.startYear) {
        ctx.addIssue({
          code: 'custom',
          path: ['accounts', i, 'allocation', 'endYear'],
          message: 'a linear glidepath must end after it starts',
        })
      }
      if (a.type === 'annuity' && a.purchase) {
        const fundingType = accountTypeById.get(a.purchase.fundingAccountId)
        const fundingAccount = accountById.get(a.purchase.fundingAccountId)
        if (a.purchase.fundingAccountId === a.id || fundingType === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['accounts', i, 'purchase', 'fundingAccountId'],
            message: 'annuity purchase must be funded from another existing account',
          })
        } else if (
          // Same one-line gap the rollover target carried: an inherited account
          // is `type: 'traditional'`, so the bare type test let a beneficiary
          // fund an owned annuity contract out of an inherited IRA. The premium
          // leaves the balance for an `annuity` account that carries no
          // `inherited` marker, so the 10-year clock on those dollars simply
          // disappears from the projection.
          a.purchase.taxQualification === 'qualified' &&
          (fundingAccount === undefined ||
            fundingAccount.type !== 'traditional' ||
            fundingAccount.inherited !== undefined)
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['accounts', i, 'purchase', 'fundingAccountId'],
            message: 'a qualified annuity purchase must be funded from a traditional account you own (inherited IRA dollars stay in the inherited account)',
          })
        } else if (
          a.purchase.taxQualification === 'nonQualified' &&
          fundingType !== 'cash' &&
          fundingType !== 'taxable' &&
          fundingType !== 'equityComp'
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['accounts', i, 'purchase', 'fundingAccountId'],
            message: 'a non-qualified annuity purchase must be funded from cash, taxable, or equity-comp savings',
          })
        }
        if (a.purchase.qlac && a.purchase.taxQualification !== 'qualified') {
          ctx.addIssue({
            code: 'custom',
            path: ['accounts', i, 'purchase', 'qlac'],
            message: 'a QLAC must be a qualified (traditional-funded) purchase',
          })
        }
        // HOW LATE A QUALIFIED CONTRACT MAY START PAYING. Two bounds, one per
        // shape, and every qualified purchase is under exactly one of them.
        //
        // Not a QLAC: Treas. Reg. 1.401(a)(9)-6(a)(3)(i) requires payments to
        // commence by the owner's required beginning date, and (q)(1)(iii)
        // excuses only a QLAC. A QLAC: that excuse is granted, but (q)(1)(ii)
        // makes the contract's own specified annuity starting date no later
        // than the first day of the month after the owner's 85th birthday, and
        // a contract naming a later date is not a QLAC and so holds no excuse
        // either.
        //
        // Both matter here rather than only in the ledger because the engine
        // has a single mechanism for every one of these contracts: an annuity
        // account holds no balance, so the premium leaves the traditional
        // balance at purchase and never returns to any required-distribution
        // base. That is exactly the treatment 1.401(a)(9)-5(b)(4) reserves for
        // a QLAC, and on anything else it computes the requirement on a base
        // short by the whole premium. Teaching the base to re-include a
        // contract value would need a contract value the Plan does not carry;
        // refusing the shapes costs only contracts the regulation does not
        // permit anyway. A non-qualified purchase is not reached by section
        // 401(a)(9) at all, and an already-owned annuity with no `purchase`
        // moves no premium out of any balance, so neither is tested.
        if (a.purchase.taxQualification === 'qualified') {
          // Same owner resolution the guaranteed-income pass takes: an annuity
          // may be stored with no individual owner, and the projection reads it
          // as the first person's.
          const owner = personById.get(a.ownerPersonId ?? '') ?? plan.household.people[0]
          const birthYear = owner === undefined ? null : Number(owner.dob.slice(0, 4))
          const birthMonth = owner === undefined ? null : Number(owner.dob.slice(5, 7))
          if (
            birthYear !== null &&
            Number.isFinite(birthYear) &&
            birthMonth !== null &&
            Number.isFinite(birthMonth)
          ) {
            const nonQlacLatest = latestNonQlacQualifiedAnnuityStartAge(birthYear, a.purchase.year)
            const qlacLatest = latestQlacAnnuityStartAge(birthMonth)
            // THE MESSAGE NAMES THE OTHER BOX ONLY WHEN THE OTHER BOX WOULD
            // WORK. Each refusal has two possible remedies — move the start age,
            // or change which bound applies by ticking or unticking QLAC — and
            // the second one is a dead end whenever the other bound refuses the
            // same age too. Telling a household to tick QLAC on a start age of
            // 90 sends them to a second refusal, so the message is derived from
            // which of the two shapes this plan could actually store.
            if (a.purchase.qlac === true) {
              if (a.startAge > qlacLatest) {
                ctx.addIssue({
                  code: 'custom',
                  path: ['accounts', i, 'startAge'],
                  message:
                    a.startAge <= nonQlacLatest
                      ? `a QLAC must commence by the first of the month after the owner's 85th birthday: it must start paying by age ${qlacLatest} (lower "Start age", or untick "QLAC (qualified longevity annuity)" — a qualified purchase that is not a QLAC may start as late as age ${nonQlacLatest} here)`
                      : `a QLAC must commence by the first of the month after the owner's 85th birthday: it must start paying by age ${qlacLatest} (lower "Start age"; unticking "QLAC (qualified longevity annuity)" would not help, because a qualified purchase that is not a QLAC must start paying by age ${nonQlacLatest})`,
                })
              }
            } else if (a.startAge > nonQlacLatest) {
              ctx.addIssue({
                code: 'custom',
                path: ['accounts', i, 'startAge'],
                message:
                  a.startAge <= qlacLatest
                    ? `a qualified annuity purchase that is not a QLAC cannot defer past the owner's required beginning date: it must start paying by age ${nonQlacLatest} (lower "Start age", or tick "QLAC (qualified longevity annuity)" — a QLAC may start as late as age ${qlacLatest})`
                    : `a qualified annuity purchase that is not a QLAC cannot defer past the owner's required beginning date: it must start paying by age ${nonQlacLatest} (lower "Start age"; ticking "QLAC (qualified longevity annuity)" would not help, because a QLAC must start paying by age ${qlacLatest})`,
              })
            }
          }
        }
      }
      if (a.type === 'annuity' && a.payoutForm?.kind === 'jointSurvivor' && plan.household.people.length < 2) {
        ctx.addIssue({
          code: 'custom',
          path: ['accounts', i, 'payoutForm'],
          message: 'a joint-and-survivor annuity requires a two-person household',
        })
      }
      if (a.type === 'pension' && a.lumpSumElection) {
        if (!a.lumpSumOffer) {
          ctx.addIssue({
            code: 'custom',
            path: ['accounts', i, 'lumpSumElection'],
            message: 'a lump-sum election requires a lump-sum offer (amount and election year)',
          })
        } else if (planAsOfYear === null) {
          // Fail closed, not open: the staleness rule reads the document's own
          // stamp, and a stamp the rule cannot read would otherwise let any
          // election year through — including the past-year shape this rule
          // exists to refuse. Every save writes the stamp with toISOString, so
          // a well-formed document never lands here; a hand-crafted or damaged
          // one is repaired at load (the migration drops the election), and a
          // re-save restores the stamp.
          ctx.addIssue({
            code: 'custom',
            path: ['accounts', i, 'lumpSumElection'],
            message:
              'an elected pension lump sum requires a readable plan timestamp to check its election year (re-save the plan to restore it)',
          })
        } else if (a.lumpSumOffer.electionYear < planAsOfYear) {
          // An election models a rollover the projection still has to perform:
          // in the election year the offer arrives in the receiving account and
          // the pension stops paying. An election year already past has no such
          // year to land in, and the rest of the product already treats it as
          // nothing to model (`decisions/pensionElection.ts` skips it,
          // `insights/detectors/pensionElectionPending.ts` stays quiet,
          // planner-ui's scenario levers refuse to build one). Only the ledger
          // acted on it, and only destructively: it skips the pension for every
          // `year >= electionYear` while crediting the offer in no year at all.
          //
          // Crediting it in the first projection year instead would double-count
          // it. Account balances are what the household holds TODAY (the
          // accounts editor says so: "Balances as of today"), and the engine
          // already reads every other pre-start event that way — an annuity
          // premium and a TIPS-ladder purchase dated before the start are both
          // "assumed already funded" and never replayed. So the honest answer is
          // to refuse the shape and let the household restate the fact.
          ctx.addIssue({
            code: 'custom',
            path: ['accounts', i, 'lumpSumOffer', 'electionYear'],
            message:
              'an elected pension lump sum cannot have an election year in the past (if the rollover already happened, clear the election and add its dollars to the receiving account balance)',
          })
        }
        // Owned traditional only. An inherited account is `type: 'traditional'`
        // too, so a bare type test admitted a target the message itself excludes:
        // an inherited IRA may only ever hold the decedent's dollars, and the
        // beneficiary's own pension money has no way into it. The engine would
        // also drop those owned dollars into the bucket that runs the 10-year
        // rule. `inherited` is the same discriminator the SEPP gate, the
        // conversion source rule, and the IRA-classification rule read.
        const rollover = accountById.get(a.lumpSumElection.rolloverAccountId)
        if (
          rollover === undefined ||
          rollover.type !== 'traditional' ||
          rollover.inherited !== undefined
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['accounts', i, 'lumpSumElection', 'rolloverAccountId'],
            message: 'a pension lump sum must roll over into an existing traditional account you own (not an inherited IRA)',
          })
        }
      }
      if (a.type === 'property' && a.hecm && a.primaryResidence !== true) {
        ctx.addIssue({
          code: 'custom',
          path: ['accounts', i, 'hecm'],
          message: 'a HECM line of credit requires the home to be a primary residence',
        })
      }
      if (a.estateBeneficiary?.destination === 'charity' && a.estateBeneficiary.charityPct === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['accounts', i, 'estateBeneficiary', 'charityPct'],
          message: 'a charity destination requires a charity percent',
        })
      }
    })
    plan.incomes.forEach((s, i) => {
      if ((s.type === 'wages' || s.type === 'socialSecurity') && !personIds.has(s.personId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['incomes', i, 'personId'],
          message: `unknown person id "${s.personId}"`,
        })
      }
    })
    plan.insurance.forEach((p, i) => {
      const subject = p.kind === 'ltc' ? p.owner : p.insured
      const subjectField = p.kind === 'ltc' ? 'owner' : 'insured'
      if (!personIds.has(subject)) {
        ctx.addIssue({ code: 'custom', path: ['insurance', i, subjectField], message: `unknown person id "${subject}"` })
      }
      if (p.premiumMode === 'untilAge' && p.premiumEndAge === undefined) {
        ctx.addIssue({ code: 'custom', path: ['insurance', i, 'premiumEndAge'], message: "premiumEndAge is required when premiumMode is 'untilAge'" })
      }
      if (p.kind === 'permanentLife') {
        if (p.beneficiary !== 'estate' && !personIds.has(p.beneficiary)) {
          ctx.addIssue({ code: 'custom', path: ['insurance', i, 'beneficiary'], message: `unknown person id "${p.beneficiary}"` })
        }
        if (p.cashValueMode === 'schedule' && (!p.cashValueSchedule || p.cashValueSchedule.length === 0)) {
          ctx.addIssue({ code: 'custom', path: ['insurance', i, 'cashValueSchedule'], message: "cashValueSchedule is required when cashValueMode is 'schedule'" })
        }
      }
    })
    plan.careEvents.forEach((c, i) => {
      if (!personIds.has(c.personId)) {
        ctx.addIssue({ code: 'custom', path: ['careEvents', i, 'personId'], message: `unknown person id "${c.personId}"` })
      }
    })
    plan.incomeFloor?.ladders.forEach((ladder, i) => {
      if (ladder.endYear < ladder.startYear) {
        ctx.addIssue({
          code: 'custom',
          path: ['incomeFloor', 'ladders', i, 'endYear'],
          message: 'a ladder must end in or after its first payout year',
        })
      }
      if (ladder.purchase) {
        if (ladder.purchase.year >= ladder.startYear) {
          ctx.addIssue({
            code: 'custom',
            path: ['incomeFloor', 'ladders', i, 'purchase', 'year'],
            message: 'a ladder must be purchased before its first payout year',
          })
        }
        const fundingType = accountTypeById.get(ladder.purchase.fundingAccountId)
        if (fundingType === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['incomeFloor', 'ladders', i, 'purchase', 'fundingAccountId'],
            message: 'a ladder purchase must be funded from an existing account',
          })
        } else if (fundingType !== 'cash' && fundingType !== 'taxable' && fundingType !== 'equityComp') {
          // Taxable-side only in v1: the ladder's tax treatment (state-exempt
          // interest, taxed accretion) models TIPS held in a brokerage. TIPS
          // inside an IRA are just traditional dollars — model those as the
          // account's own balance instead.
          ctx.addIssue({
            code: 'custom',
            path: ['incomeFloor', 'ladders', i, 'purchase', 'fundingAccountId'],
            message: 'a TIPS ladder purchase must be funded from cash, taxable, or equity-comp savings',
          })
        }
      }
    })
    // The required floor cannot exceed the target lifestyle it sits under.
    if (plan.expenses.requiredAnnual !== undefined && plan.expenses.requiredAnnual > plan.expenses.baseAnnual) {
      ctx.addIssue({
        code: 'custom',
        path: ['expenses', 'requiredAnnual'],
        message: 'required annual spending cannot exceed baseline (target) annual spending',
      })
    }
    plan.expenses.oneTimeGoals.forEach((g, i) => {
      if (g.earliestYear !== undefined && g.latestYear !== undefined && g.earliestYear > g.latestYear) {
        ctx.addIssue({
          code: 'custom',
          path: ['expenses', 'oneTimeGoals', i, 'earliestYear'],
          message: 'earliestYear cannot be after latestYear',
        })
      }
      if (g.earliestYear !== undefined && g.earliestYear > g.year) {
        ctx.addIssue({
          code: 'custom',
          path: ['expenses', 'oneTimeGoals', i, 'earliestYear'],
          message: 'earliestYear cannot be after the goal year',
        })
      }
      if (g.latestYear !== undefined && g.latestYear < g.year) {
        ctx.addIssue({
          code: 'custom',
          path: ['expenses', 'oneTimeGoals', i, 'latestYear'],
          message: 'latestYear cannot be before the goal year',
        })
      }
      if (g.allowPartialFunding && g.minFundingPct !== undefined && g.minFundingPct >= 100) {
        ctx.addIssue({
          code: 'custom',
          path: ['expenses', 'oneTimeGoals', i, 'minFundingPct'],
          message: 'partial funding requires a minimum funding percent below 100',
        })
      }
    })
  })
export type Plan = z.infer<typeof planSchema>

/** Stable identifiers already reserved by a Plan, excluding annual source facts. */
export function retirementActionPlanReservedIdentifiers(
  plan: Readonly<Plan>,
): ReadonlySet<string> {
  const identifiers = new Set<string>([plan.id])
  plan.household.people.forEach((person) => identifiers.add(person.id))
  plan.accounts.forEach((account) => identifiers.add(account.id))
  plan.insurance.forEach((policy) => identifiers.add(policy.id))
  plan.careEvents.forEach((careEvent) => identifiers.add(careEvent.id))
  plan.incomeFloor?.ladders.forEach((ladder) => identifiers.add(ladder.id))
  plan.incomes.forEach((income) => {
    identifiers.add(income.id)
    if (income.type === 'socialSecurity') {
      income.formerSpouses?.forEach((formerSpouse) => identifiers.add(formerSpouse.id))
    }
  })
  plan.expenses.oneTimeGoals.forEach((goal) => identifiers.add(goal.id))
  plan.strategies.retirementActions.forEach((action) => {
    identifiers.add(action.actionId)
    if (action.kind === 'qcd') identifiers.add(action.charity.designationId)
    const withAllocations = action as unknown as {
      allocations?: readonly { allocationId: string }[]
      allocation?: { allocationId: string }
    }
    const allocations = withAllocations.allocations ??
      (withAllocations.allocation === undefined ? [] : [withAllocations.allocation])
    allocations.forEach((allocation) => identifiers.add(allocation.allocationId))
  })
  const eligibility = plan.retirementActionEligibilityFacts
  eligibility?.iraClassifications.forEach((record) => identifiers.add(record.evidenceId))
  eligibility?.sepSimpleActivities.forEach((record) => identifiers.add(record.evidenceId))
  eligibility?.deductibleIraContributions.forEach((record) => identifiers.add(record.evidenceId))
  plan.scenarios.forEach((scenario) => identifiers.add(scenario.id))
  return identifiers
}

/** Discard plan-bound authoritative sources when the containing Plan is re-keyed. */
export function discardRetirementActionAnnualTaxFacts(plan: Plan): void {
  delete plan.retirementActionAnnualTaxFacts
}

/**
 * Remove complete owner/year records after an edit changes an owner's reviewed
 * IRA pool. Nested source facts are never selectively rewritten.
 */
export function clearRetirementActionAnnualTaxFactsForOwners(
  plan: Plan,
  ownerPersonIds: Iterable<string>,
): void {
  const facts = plan.retirementActionAnnualTaxFacts
  if (facts === undefined) return
  const affected = new Set(ownerPersonIds)
  if (affected.size === 0) return
  const retained = facts.ownedNonRothIraAnnualFilingSourceRecords.filter(
    (record) => !affected.has(record.ownerPersonId),
  )
  if (retained.length === 0) {
    delete plan.retirementActionAnnualTaxFacts
  } else if (retained.length !== facts.ownedNonRothIraAnnualFilingSourceRecords.length) {
    plan.retirementActionAnnualTaxFacts = {
      ownedNonRothIraAnnualFilingSourceRecords: retained,
    }
  }
}

// ---------------------------------------------------------------------------
// Parsing + factory
// ---------------------------------------------------------------------------

export type ParsePlanResult = { ok: true; plan: Plan } | { ok: false; issues: string[] }

export function parsePlan(input: unknown): ParsePlanResult {
  const r = planSchema.safeParse(input)
  if (r.success) return { ok: true, plan: r.data }
  return {
    ok: false,
    issues: r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
  }
}

export interface CreatePlanOptions {
  newId?: () => string
  now?: () => Date
  name?: string
}

export function createEmptyPlan(opts: CreatePlanOptions = {}): Plan {
  const newId = opts.newId ?? (() => crypto.randomUUID())
  const nowIso = (opts.now ?? (() => new Date()))().toISOString()
  const personId = newId()
  return {
    schemaVersion: CURRENT_PLAN_SCHEMA_VERSION,
    id: newId(),
    name: opts.name ?? 'My plan',
    origin: 'user',
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
    household: {
      filingStatus: 'single',
      hasQualifyingDependent: false,
      state: 'KY',
      stateMoves: [],
      capitalLossCarryforward: 0,
      people: [
        {
          id: personId,
          name: 'Me',
          dob: '1970-01-01',
          sex: 'average',
          retirementAge: 65,
          longevity: { planningAge: 95, source: 'manual' },
        },
      ],
    },
    accounts: [],
    insurance: [],
    careEvents: [],
    incomes: [],
    expenses: {
      baseAnnual: 0,
      phases: [],
      oneTimeGoals: [],
      healthcare: { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 },
    },
    strategies: {
      withdrawalOrder: { mode: 'sequential' },
      rothConversion: { mode: 'none' },
      qcdAnnual: 0,
      retirementActions: [],
    },
    assumptions: {
      inflationPct: 2.5,
      healthcareExtraInflationPct: 3,
      defaultReturnPct: 5.5,
      ssCola: { mode: 'matchInflation' },
      ssHaircut: null,
      stateEffectiveTaxPct: 0,
      localIncomeTaxPct: 0,
      recentAnnualMagi: 0,
      heirTaxRatePct: 25,
      safeWithdrawalRatePct: 4,
    },
    scenarios: [],
  }
}
