/**
 * What the FI target on Results and in the report prices, in plain words. The
 * engine publishes the year, the source and whose retirement it is
 * (`ProjectionSummary.fiBasis`); this only selects and phrases them (no plan
 * math here).
 */

import type { Plan } from '@retiregolden/engine/model/plan'
import type { FiSpendingSource, ProjectionSummary } from '@retiregolden/engine/projection/compare'
import {
  householdRetirementClause,
  notRetiringPhrase,
  type RetirementYearRule,
} from '@retiregolden/engine/projection/householdRetirement'

/** A person who never retires in the plan, as the sentences name them. */
export interface FiNotRetiringFact {
  personName: string | null
  rule: RetirementYearRule
  year: number
  lastYearAlive: number
}

/** The facts the FI-target sentences are written from; the report model carries them as they are. */
export interface FiTargetBasisFacts {
  /** The calendar year priced; null for an empty projection or when nobody retires in the plan. */
  spendingYear: number | null
  spendingSource: FiSpendingSource
  /** The plan's safe withdrawal rate, percent per year. */
  withdrawalRatePct: number
  /** The person whose retirement is the household's later one (FI age is theirs); null when nobody retires in the plan. */
  personName: string | null
  /** That person's retirement year (projection/householdRetirement.ts). */
  retirementYear: number | null
  /** Which rule gave it: a retirement age, the first year without wages, or the start year. */
  retirementRule: RetirementYearRule | null
  /** That person's last year alive at the planning age. */
  personLastYearAlive: number | null
  /** How many people the plan has: the sentences name the person only for a couple. */
  householdSize: number
  /**
   * Whether any Roth conversion went through in the projection
   * (`lifetimeRothConversions > 0`). A named request the ledger refused makes
   * the plan read as converting for the FI source, but nothing converted, so
   * the sentence must not say it does (the independent review's N2).
   */
  conversionExecuted: boolean
  /**
   * The people who never retire in the plan (they work through it, reach
   * their retirement age only after their planning age, or died before it
   * starts), in the engine's canonical order: the sentence names them and
   * says whose retirement is priced instead, or that none is (the independent
   * review's N3).
   */
  notRetiring: FiNotRetiringFact[]
}

export function fiTargetBasisFacts(summary: ProjectionSummary, plan: Plan): FiTargetBasisFacts {
  const nameOf = (personId: string | null) => plan.household.people.find((p) => p.id === personId)?.name ?? null
  return {
    spendingYear: summary.fiBasis.spendingYear,
    spendingSource: summary.fiBasis.spendingSource,
    withdrawalRatePct: plan.assumptions.safeWithdrawalRatePct ?? 4,
    personName: nameOf(summary.fiBasis.personId),
    retirementYear: summary.fiBasis.retirementYear,
    retirementRule: summary.fiBasis.retirementRule,
    personLastYearAlive: summary.fiBasis.personLastYearAlive,
    householdSize: plan.household.people.length,
    conversionExecuted: summary.lifetimeRothConversions > 0,
    notRetiring: summary.fiBasis.notRetiring.map((person) => ({
      personName: nameOf(person.personId),
      rule: person.rule,
      year: person.year,
      lastYearAlive: person.lastYearAlive,
    })),
  }
}

/** "Sam works through the plan", joined with "and" for two people; "you ..." for one (the engine's one wording). */
const whoWorksThrough = (facts: FiTargetBasisFacts, nobody = false): string =>
  notRetiringPhrase(facts.notRetiring.map((person) => ({ ...person, name: person.personName })), facts.householdSize > 1, nobody)

/**
 * Why this year: whose retirement decided it and by which rule (a retirement
 * age, the first year without wages, or the start year), in the engine's one
 * wording (projection/householdRetirement.ts#householdRetirementClause), and
 * who works through the plan when someone does.
 */
function whyThisYear(facts: FiTargetBasisFacts, spendingYear: number): string {
  if (facts.retirementYear === null || facts.retirementRule === null) return ''
  const couple = facts.householdSize > 1 && facts.personName !== null
  const clause = householdRetirementClause(
    { year: facts.retirementYear, rule: facts.retirementRule },
    couple ? facts.personName : null,
    spendingYear,
    facts.notRetiring.length === 0,
  )
  if (!couple || facts.notRetiring.length === 0) return ` (${clause})`
  return ` (${clause}; ${whoWorksThrough(facts)}, so FI is priced on ${facts.personName}'s retirement)`
}

/**
 * The year Coast-FIRE grows into the FI target by: the household's later
 * retirement, or the start year once everyone has retired (then Coast-FIRE is
 * the FI target itself). Null for an empty projection, or when nobody retires
 * in the plan and no FI target is priced.
 */
export function coastFireHorizonYear(facts: FiTargetBasisFacts): number | null {
  if (facts.spendingYear === null) return null
  return Math.max(facts.spendingYear, facts.retirementYear ?? facts.spendingYear)
}

export function fiTargetBasisSentence(facts: FiTargetBasisFacts): string {
  const rate = `${facts.withdrawalRatePct}%`
  const { spendingYear, spendingSource } = facts
  if (spendingSource === 'noRetirementInPlan') {
    return `No FI target is priced: ${whoWorksThrough(facts, true)} and there is no retirement year to price.`
  }
  if (spendingYear === null || spendingSource === 'baseAnnual') {
    return `The FI target is your base annual spending divided by your ${rate} withdrawal rate.`
  }
  const head = `The FI target is ${spendingYear}'s spending, tax and penalties${whyThisYear(facts, spendingYear)}, in today's dollars, divided by your ${rate} withdrawal rate.`
  if (spendingSource !== 'conversionFreeProjection' && spendingSource !== 'conversionTaxIncluded') return head
  // A plan that asks to convert but whose every request the ledger refused
  // converted nothing: say so, whichever source the figure was read from.
  if (!facts.conversionExecuted) {
    return `${head} Your plan asks to convert to Roth, but no conversion goes through, so there is no conversion tax in ${spendingYear} to leave out.`
  }
  return spendingSource === 'conversionFreeProjection'
    ? `${head} Your plan converts to Roth, and a conversion's tax, with what it costs in later years such as a higher Medicare premium, is paid once, so ${spendingYear} is priced as if you had not converted.`
    : `${head} It includes what your Roth conversions cost in ${spendingYear}.`
}

/** "2031, when Taylor is 68" for a couple, "2031 (age 68)" for one person. */
export function fiReachedPhrase(fiYear: number, fiAge: number | null, facts: FiTargetBasisFacts): string {
  if (facts.householdSize > 1 && facts.personName !== null) return `${fiYear}, when ${facts.personName} is ${fiAge}`
  return `${fiYear} (age ${fiAge})`
}
