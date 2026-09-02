/**
 * Validation issues as people read them (#452, #459, #489–#495, #500, #502,
 * #503, #511, #512, #517, #523, #526, #530, #531).
 *
 * The engine reports a failed parse as `path: message` strings, where the
 * path is the schema path (`strategies.qcdAnnual`, `incomes.0.endAge`) and
 * the message is Zod's ("Too small: expected number to be >=0"). Those are
 * exact and stable, and they are what a developer wants. A person wants the
 * section, the field's label, and what to do about it, and wants the note
 * beside the field or at least in the right card. This module turns the
 * strings into that; it never decides what is valid (the engine does).
 */

export interface ParsedIssue {
  /** Raw schema path, dot-joined, as the engine reported it (`(root)` for a top-level issue). */
  path: string
  /** Raw message as the engine reported it. */
  message: string
  /** Where the field lives, for scoping card-level lists. */
  section: IssueSection
  /** "Income 1: End age" — the section item and the field, for people. */
  label: string
  /** "Must be at least 60" — the message, for people. */
  advice: string
}

export type IssueSection =
  | 'household'
  | 'assumptions'
  | 'strategy'
  | 'spending'
  | 'accounts'
  | 'income'
  | 'insurance'
  | 'income-floor'
  | 'unknown'

/** Split an engine issue string at its first `: ` (the path never contains one). */
export function parseIssue(issue: string): ParsedIssue {
  const at = issue.indexOf(': ')
  const path = at < 0 ? '(root)' : issue.slice(0, at)
  const message = at < 0 ? issue : issue.slice(at + 2)
  return { path, message, section: sectionOfPath(path), label: labelOfPath(path), advice: adviceOf(message) }
}

export function parseIssues(issues: readonly string[]): ParsedIssue[] {
  return issues.map(parseIssue)
}

const SECTION_BY_ROOT: Record<string, IssueSection> = {
  household: 'household',
  assumptions: 'assumptions',
  strategies: 'strategy',
  expenses: 'spending',
  accounts: 'accounts',
  incomes: 'income',
  insurance: 'insurance',
  careEvents: 'insurance',
  incomeFloor: 'income-floor',
}

export function sectionOfPath(path: string): IssueSection {
  const root = path.split('.')[0] ?? ''
  return SECTION_BY_ROOT[root] ?? 'unknown'
}

/** Containers that hold a numbered list of items, and what one item is called. */
const ITEM_NAMES: Record<string, string> = {
  people: 'Person',
  accounts: 'Account',
  incomes: 'Income',
  insurance: 'Insurance policy',
  careEvents: 'Care event',
  ladders: 'TIPS ladder',
  phases: 'Phase',
  goals: 'Goal',
  oneTimeGoals: 'Goal',
  conversions: 'Conversion',
  stateMoves: 'Move',
  scenarios: 'Scenario',
  earnings: 'Earnings year',
  cashValueSchedule: 'Schedule year',
}

/** Leaves whose camelCase does not read well split, or that carry an acronym or unit. */
const LEAF_LABELS: Record<string, string> = {
  qcdAnnual: 'QCD annual amount',
  taxableSafetyNetFloor: 'Taxable safety-net floor',
  stateAndLocalTaxes: 'State and local taxes',
  localIncomeTaxPct: 'Local income tax %',
  // The schema key is `stateEffectiveTaxPct`; the Assumptions label calls it an override.
  stateEffectiveTaxPct: 'State effective tax % (override)',
  stateEffectiveTaxPctOverride: 'State effective tax % (override)',
  inflationPct: 'Inflation %',
  healthcareExtraInflationPct: 'Healthcare extra inflation %',
  healthcareInflationPct: 'Healthcare extra inflation %',
  defaultReturnPct: 'Default return %',
  safeWithdrawalRatePct: 'Safe withdrawal rate %',
  heirTaxRatePct: 'Heir tax rate %',
  recentAnnualMagi: 'Recent annual MAGI',
  returnPct: 'Expected return %',
  volatilityPct: 'Volatility %',
  interestYieldPct: 'Interest yield %',
  qualifiedRatioPct: 'Qualified share %',
  qualifiedRatio: 'Qualified dividends (share, 0–1)',
  interestPct: 'Interest rate %',
  targetValue: 'Target',
  annualPremium: 'Annual premium',
  deathBenefit: 'Death benefit',
  cashValue: 'Cash value',
  annualCost: 'Annual cost',
  annualAmount: 'Annual amount',
  annualRealAmount: 'Annual real income',
  requiredAnnual: 'Required floor',
  fromYear: 'From year',
  cutPct: 'Cut %',
  annualPct: 'COLA rate %',
  bracketPct: 'Target bracket %',
  pre65MonthlyPremiumPerPerson: 'Pre-65 premium / person / month',
  medicareExtrasMonthlyPerPerson: 'Medicare extras / person / month',
  cashValueSchedule: 'Cash value schedule',
  cashValueGrowthPct: 'Cash value growth %',
  premiumEndAge: 'Premium end age',
  planningAge: 'Planning age',
  retirementAge: 'Retirement age',
  annualGross: 'Annual gross',
  realRaisePct: 'Real raise rate %',
  endAge: 'End age',
  startAge: 'Start age',
  startYear: 'Start year',
  endYear: 'End year',
  fromAge: 'From age',
  toAge: 'To age',
  durationYears: 'Duration (years)',
  multiplier: 'Multiplier',
  baseAnnual: 'Baseline annual spending',
  payoffYear: 'Payoff year',
  plannedSaleYear: 'Planned sale year',
  interestRatePct: 'Interest rate %',
  dividendYieldPct: 'Dividend yield %',
  qualifiedDividendPct: 'Qualified dividend %',
  piaMonthly: 'PIA (monthly)',
  claimAge: 'Claim age',
  years: 'Years',
  months: 'Months',
  dob: 'Date of birth',
  ssHaircut: 'Social Security haircut',
  magiTarget: 'MAGI target',
  balance: 'Balance',
  amount: 'Amount',
  year: 'Year',
}

/** Roots and mid-path objects that name a card rather than a list. */
const GROUP_LABELS: Record<string, string> = {
  household: 'Household',
  assumptions: 'Assumptions',
  strategies: 'Strategy',
  expenses: 'Spending',
  incomeFloor: 'Income floor',
  itemizedDeductions: 'Itemized deductions',
  longevity: 'Longevity',
  rothConversion: 'Roth conversion',
  withdrawal: 'Withdrawal strategy',
  withdrawalOrder: 'Withdrawal strategy',
  charitable: 'Charitable giving',
  survivor: 'Survivor',
  assetClassParams: 'Asset classes',
  ssHaircut: 'Social Security haircut',
  ssCola: 'Social Security COLA',
  heirTaxByClass: 'Heir tax by class',
  healthcare: 'Healthcare',
}

/** Leaves that only read well with their parent object named ("Claim age (years)", not "Years"). */
const NESTED_LEAF_LABELS: Record<string, string> = {
  'claimAge.years': 'Claim age (years)',
  'claimAge.months': 'Claim age (+ months)',
  'deceasedClaimAge.years': 'When they claimed (age)',
  'deceasedClaimAge.months': 'When they claimed (+ months)',
  'purchase.year': 'Purchase year',
}

function words(camel: string): string {
  const spaced = camel.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * `incomes.0.endAge` → "Income 1: End age"; `household.people.1.longevity.planningAge`
 * → "Person 2: Planning age"; `strategies.itemizedDeductions.stateAndLocalTaxes`
 * → "Itemized deductions: State and local taxes". The last numbered item wins as
 * the prefix; a bare root ("Assumptions") is the prefix when there is none.
 */
export function labelOfPath(path: string): string {
  if (path === '(root)' || path === '') return 'Plan'
  const segments = path.split('.')
  // A numbered item ("Person 2") is the card the field sits on and wins; with
  // no item, the last named group ("Itemized deductions") is the card.
  let item: string | null = null
  let group: string | null = null
  const leaf = segments[segments.length - 1] ?? ''
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!
    const next = segments[i + 1]!
    if (/^\d+$/.test(next) && ITEM_NAMES[seg]) {
      item = `${ITEM_NAMES[seg]} ${Number(next) + 1}`
      i++
      continue
    }
    if (GROUP_LABELS[seg]) group = GROUP_LABELS[seg]
  }
  const prefix = item ?? group
  if (/^\d+$/.test(leaf)) {
    // A whole numbered item is wrong ("insurance.0"): name the item itself.
    const container = segments[segments.length - 2] ?? ''
    return `${ITEM_NAMES[container] ?? words(container)} ${Number(leaf) + 1}`
  }
  const parent = segments[segments.length - 2] ?? ''
  const field = NESTED_LEAF_LABELS[`${parent}.${leaf}`] ?? LEAF_LABELS[leaf] ?? words(leaf)
  return prefix && prefix !== field ? `${prefix}: ${field}` : field
}

/**
 * The engine's cross-field messages that name schema keys rather than fields
 * (packages/engine/src/model/plan.ts superRefine). Matched exactly, so a
 * reworded engine message falls through to the pass-through below rather than
 * being mistranslated.
 */
const CUSTOM_ADVICE: Record<string, string> = {
  "cashValueSchedule is required when cashValueMode is 'schedule'": 'Add at least one schedule row, or grow cash value by a flat rate',
  "premiumEndAge is required when premiumMode is 'untilAge'": 'Enter the age premiums end',
}

/**
 * Zod's wording, translated. Custom engine messages (anything not in Zod's
 * "Too small" / "Too big" / "Invalid input" family) pass through unchanged,
 * since those were written for people already; the few that name schema keys
 * are translated exactly.
 */
export function adviceOf(message: string): string {
  const custom = CUSTOM_ADVICE[message]
  if (custom) return custom
  let m: RegExpMatchArray | null
  if ((m = message.match(/^Too small: expected .* to be >=(-?[\d.]+)/))) return `Must be at least ${m[1]}`
  if ((m = message.match(/^Too small: expected .* to be >(-?[\d.]+)/))) return `Must be more than ${m[1]}`
  if ((m = message.match(/^Too big: expected .* to be <=(-?[\d.]+)/))) return `Must be at most ${m[1]}`
  if ((m = message.match(/^Too big: expected .* to be <(-?[\d.]+)/))) return `Must be less than ${m[1]}`
  if (/^Too small: expected (array|string) /.test(message)) return 'Add at least one entry'
  if (/^Invalid input: expected number/.test(message)) return 'Enter a number'
  if (/^Invalid input: expected string/.test(message)) return 'Enter a value'
  if (/^Invalid input: expected boolean/.test(message)) return 'Choose on or off'
  if (/^Invalid option/.test(message)) return 'Choose one of the listed options'
  if (/^Invalid input$/.test(message)) return 'Enter a valid value'
  if (/^Invalid date/.test(message)) return 'Enter a valid date'
  return message
}

/** The issues that belong to one section's card, plus any the router cannot place. */
export function issuesForSection(issues: readonly ParsedIssue[], section: IssueSection): ParsedIssue[] {
  return issues.filter((i) => i.section === section || i.section === 'unknown')
}
