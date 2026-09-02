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

import { SECTION_TITLES } from './sectionTitles'

export interface ParsedIssue {
  /** Raw schema path, dot-joined, as the engine reported it (`(root)` for a top-level issue). */
  path: string
  /** Raw message as the engine reported it. */
  message: string
  /** Where the field lives, for scoping card-level lists. */
  section: IssueSection
  /** "Income 1: Stop age" — the section item and the field, as the card labels it. */
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
  | 'social-security'
  | 'insurance'
  | 'income-floor'
  | 'unknown'

/**
 * Split an engine issue string at its first `: ` (the path never contains
 * one). `(root)` and `$` both mean the plan as a whole.
 */
export function parseIssue(issue: string): ParsedIssue {
  const at = issue.indexOf(': ')
  const rawPath = at < 0 ? '(root)' : issue.slice(0, at)
  const path = rawPath === '$' ? '(root)' : rawPath
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

/**
 * Income-stream leaves that are edited on the Social Security page, not the
 * Income page: the keys of `socialSecurityIncomeSchema` that the Income page
 * only summarises (packages/engine/src/model/plan.ts).
 */
const SOCIAL_SECURITY_LEAVES = new Set([
  'claimAge',
  'piaMonthly',
  'earnings',
  'earningsProjection',
  'coveredQuarters',
  'formerSpouses',
  'disability',
])

export function sectionOfPath(path: string): IssueSection {
  const segments = path.split('.')
  const root = segments[0] ?? ''
  if (root === 'incomes' && segments[2] !== undefined && SOCIAL_SECURITY_LEAVES.has(segments[2])) return 'social-security'
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
  cashValueSchedule: 'Schedule row',
  formerSpouses: 'Former spouse',
  retirementActions: 'Retirement action',
  contributionSchedule: 'Contribution phase',
  stages: 'Glidepath stage',
}

/**
 * Leaves as the cards label them, so a person can find the field the issue
 * names. Units ride in the card's affix ("%", "$"), not in the label, so they
 * are not repeated here either.
 */
const LEAF_LABELS: Record<string, string> = {
  // Strategy
  qcdAnnual: "QCD per year (today's $)",
  taxableSafetyNetFloor: 'Taxable safety-net floor',
  survivorReserveTarget: "Survivor reserve target (today's $)",
  stateAndLocalTaxes: 'State & local taxes (SALT)',
  mortgageInterest: 'Mortgage interest',
  charitable: 'Charitable gifts',
  bracketPct: 'Target bracket',
  targetValue: 'Target',
  // Assumptions
  localIncomeTaxPct: 'Local income tax',
  stateEffectiveTaxPct: 'State effective tax (override)',
  inflationPct: 'Inflation',
  healthcareExtraInflationPct: 'Healthcare extra inflation',
  defaultReturnPct: 'Default return',
  safeWithdrawalRatePct: 'Safe withdrawal rate (SWR)',
  heirTaxRatePct: 'Heir tax rate',
  recentAnnualMagi: 'Recent annual MAGI',
  returnPct: 'Expected return',
  volatilityPct: 'Volatility',
  interestYieldPct: 'Interest yield',
  dividendYieldPct: 'Dividend yield',
  qualifiedRatioPct: 'Qualified share',
  ssHaircut: 'Social Security haircut',
  fromYear: 'From year',
  cutPct: 'Cut',
  annualPct: 'COLA rate',
  // Household
  filingStatus: 'Filing status',
  state: 'State (starting residence)',
  name: 'Name',
  dob: 'Date of birth',
  sex: 'Sex',
  retirementAge: 'Retirement age',
  planningAge: 'Planning age',
  // Accounts
  balance: 'Balance',
  value: 'Value',
  costBasis: 'Cost basis',
  qualifiedRatio: 'Qualified dividends',
  interestPct: 'Interest rate',
  monthlyPayment: 'Monthly payment',
  payoffYear: 'Lump-sum payoff year',
  plannedSaleYear: 'Planned sale year',
  // Income
  annualGross: 'Annual gross',
  realGrowthPct: 'Real raise rate',
  endAge: 'Stop age',
  label: 'Label',
  annualAmount: 'Annual amount',
  startYear: 'Start year',
  endYear: 'End year',
  year: 'Year',
  amount: 'Amount',
  piaMonthly: 'PIA (monthly benefit at FRA)',
  claimAge: 'Claim age',
  coveredQuarters: 'Covered-work credits',
  years: 'Years',
  months: 'Months',
  // Spending
  baseAnnual: 'Baseline annual spending',
  requiredAnnual: "Required floor (today's $)",
  fromAge: 'From age',
  toAge: 'To age',
  multiplier: 'Multiplier',
  earliestYear: 'Earliest year',
  latestYear: 'Latest year',
  pre65MonthlyPremiumPerPerson: 'Pre-65 premium / person / month',
  medicareExtrasMonthlyPerPerson: 'Medicare extras / person / month',
  // Insurance and care
  annualPremium: 'Annual premium',
  premiumEndAge: 'Premiums end at age',
  deathBenefit: 'Death benefit',
  cashValue: 'Cash value (today)',
  cashValueGrowthPct: 'Cash value growth',
  cashValueSchedule: 'Cash-value schedule',
  startAge: 'Start age',
  durationYears: 'Duration (years)',
  annualCost: "Annual cost (today's $)",
  // Income floor
  annualRealAmount: "Annual real income (today's $)",
}

/** Leaves whose card label depends on the list the item sits in. */
const CONTAINER_LEAF_LABELS: Record<string, Record<string, string>> = {
  ladders: { startYear: 'First payout year', endYear: 'Last payout year' },
  careEvents: { startAge: 'Starts at age' },
  stateMoves: { fromYear: 'Move year', state: 'New state' },
  oneTimeGoals: { amount: "Amount (today's $)" },
  formerSpouses: {
    piaMonthly: 'Their PIA (monthly at FRA)',
    dob: 'Their date of birth',
    marriageYears: 'Years married',
    remarriedAtAge: 'Age you remarried',
  },
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
  'heirTaxByClass.traditional': 'Traditional heir tax',
  'heirTaxByClass.hsa': 'HSA heir tax',
  'earningsProjection.assumedAnnualEarnings': 'Assumed annual earnings',
  'earningsProjection.throughAge': 'Work through age',
  'disability.onsetAge': 'Disability onset age',
}

/** Acronyms a fallback label keeps in capitals. */
const ACRONYMS = new Set(['us', 'hsa', 'ira', 'rmd', 'rmds', 'qcd', 'magi', 'agi', 'pia', 'fra', 'ss', 'aca', 'irmaa', 'ltc', 'tips', 'salt', 'cola', 'niit', 'ptc', 'sepp', 'amt', 'edb', 'qlac', 'hecm'])

function words(camel: string): string {
  const tokens = camel
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((t) => (ACRONYMS.has(t) ? t.toUpperCase() : t))
  const spaced = tokens.join(' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** "formerSpouses" → "Former spouse", for a list the tables do not name. */
function singular(container: string): string {
  return words(container.endsWith('s') ? container.slice(0, -1) : container)
}

/**
 * A numeric segment is a list index unless it reads as a year (a four-digit
 * key such as `historicalAnnualMagiByYear.2024`); indexes are shown 1-based.
 */
function isIndex(segment: string): boolean {
  return /^\d+$/.test(segment) && !(segment.length === 4 && Number(segment) >= 1900)
}

/**
 * `incomes.0.endAge` → "Income 1: Stop age"; `household.people.1.longevity.planningAge`
 * → "Person 2: Planning age"; `strategies.itemizedDeductions.stateAndLocalTaxes`
 * → "Itemized deductions: State & local taxes (SALT)". The last numbered item
 * wins as the prefix; a bare root ("Assumptions") is the prefix when there is none.
 */
export function labelOfPath(path: string): string {
  if (path === '(root)' || path === '$' || path === '') return 'Plan'
  return labelOfSegments(path.split('.'))
}

/**
 * The same, from path segments that are already split, so a segment holding a
 * dot or slash (a JSON-pointer key decoded from `~1`) stays one segment.
 */
export function labelOfSegments(segments: readonly string[]): string {
  if (segments.length === 0) return 'Plan'
  // A numbered item ("Person 2") is the card the field sits on and wins; with
  // no item, the last named group ("Itemized deductions") is the card. Any
  // object segments between the card and the leaf are kept ("Social Security
  // haircut › Cut") unless the nested leaf has a label of its own ("Claim
  // age (years)"), so a nested field is never mistaken for a top-level one.
  let item: string | null = null
  let container: string | null = null
  let group: string | null = null
  const trail: string[] = []
  const leaf = segments[segments.length - 1] ?? ''
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!
    const next = segments[i + 1]!
    if (isIndex(next)) {
      item = `${ITEM_NAMES[seg] ?? singular(seg)} ${Number(next) + 1}`
      container = seg
      trail.length = 0
      i++
      continue
    }
    if (/^\d+$/.test(next)) {
      // A year-like key (a map keyed by year) is shown as itself.
      item = `${words(seg)} ${next}`
      container = seg
      trail.length = 0
      i++
      continue
    }
    if (GROUP_LABELS[seg]) {
      group = GROUP_LABELS[seg]
      trail.length = 0
      continue
    }
    if (i > 0 || !SECTION_BY_ROOT[seg]) trail.push(LEAF_LABELS[seg] ?? words(seg))
  }
  const prefix = item ?? group
  if (/^\d+$/.test(leaf)) {
    // A whole numbered item is wrong ("insurance.0"): name the item itself.
    const list = segments[segments.length - 2] ?? ''
    return isIndex(leaf) ? `${ITEM_NAMES[list] ?? singular(list)} ${Number(leaf) + 1}` : `${words(list)} ${leaf}`
  }
  const parent = segments[segments.length - 2] ?? ''
  const own =
    (container !== null && isIndex(parent) ? CONTAINER_LEAF_LABELS[container]?.[leaf] : undefined) ??
    NESTED_LEAF_LABELS[`${parent}.${leaf}`]
  const field = own ?? [...trail, LEAF_LABELS[leaf] ?? words(leaf)].join(' › ')
  return prefix && prefix !== field ? `${prefix}: ${field}` : field
}

/**
 * The engine's cross-field messages that name schema keys rather than fields
 * (packages/engine/src/model/plan.ts superRefine). Matched exactly, so a
 * reworded engine message falls through to the key-by-key translation below
 * rather than being mistranslated.
 */
const CUSTOM_ADVICE: Record<string, string> = {
  "cashValueSchedule is required when cashValueMode is 'schedule'": 'Add at least one schedule row, or grow cash value by a flat rate',
  "premiumEndAge is required when premiumMode is 'untilAge'": 'Enter the age premiums end',
}

/**
 * Schema keys the engine's remaining custom messages name, as the cards label
 * them. Keys not listed here fall back to the field tables, then to their
 * words ("treatAsOwnElectionYear" → "Treat as own election year").
 */
const KEY_LABELS: Record<string, string> = {
  beneficiaryClass: 'Beneficiary class',
  edbCategory: 'Eligible designated beneficiary category',
  beneficiaryBirthYear: 'Beneficiary birth year',
  soleBeneficiary: 'Sole beneficiary',
  ownerBirthYear: 'Original owner birth year',
  ownerBirthMonth: 'Original owner birth month',
  ownerBirthDay: 'Original owner birth day',
  ownerDeathYear: 'Original owner death year',
  decedentHadStartedRmds: 'Original owner had started RMDs',
  premiumMode: 'Premium',
  cashValueMode: 'Cash value grows by',
  employerPlanType: 'Employer plan type',
  marriedFilingJointly: 'Married filing jointly',
}

/**
 * A custom engine message with its schema keys replaced by the field labels a
 * person sees: `earliestYear cannot be after latestYear` → “Earliest year”
 * cannot be after “Latest year”. Only camelCase identifiers are touched;
 * quoted option values, citations, and ordinary words pass through.
 */
export function humanizeSchemaKeys(message: string): string {
  return message.replace(/\b[a-z]+(?:[A-Z][A-Za-z0-9]*)+\b/g, (key) => `“${KEY_LABELS[key] ?? LEAF_LABELS[key] ?? words(key)}”`)
}

/**
 * Zod's wording, translated. The engine's own messages (anything not in
 * Zod's "Too small" / "Too big" / "Invalid input" family) keep their sense,
 * with any schema key they name shown as the field's label; the two that a
 * person cannot act on as worded are translated exactly.
 */
export function adviceOf(message: string): string {
  const custom = CUSTOM_ADVICE[message]
  if (custom) return custom
  let m: RegExpMatchArray | null
  if ((m = message.match(/^Too small: expected .* to be >=(-?[\d.]+)/))) return `Must be at least ${m[1]}`
  if ((m = message.match(/^Too small: expected .* to be >(-?[\d.]+)/))) return `Must be more than ${m[1]}`
  if ((m = message.match(/^Too big: expected .* to be <=(-?[\d.]+)/))) return `Must be at most ${m[1]}`
  if ((m = message.match(/^Too big: expected .* to be <(-?[\d.]+)/))) return `Must be less than ${m[1]}`
  if (/^Too small: expected array /.test(message)) return 'Add at least one entry'
  if (/^Too small: expected string /.test(message)) return 'Enter a value'
  if (/^Invalid input: expected number/.test(message)) return 'Enter a number'
  if (/^Invalid input: expected string/.test(message)) return 'Enter a value'
  if (/^Invalid input: expected boolean/.test(message)) return 'Choose on or off'
  if (/^Invalid option/.test(message)) return 'Choose one of the listed options'
  if (/^Invalid input$/.test(message)) return 'Enter a valid value'
  if (/^Invalid date/.test(message)) return 'Enter a valid date'
  if (/^Invalid string: must match pattern/.test(message)) return 'Enter a valid value'
  return humanizeSchemaKeys(message)
}

/** The issues that belong to one section's card, plus any the router cannot place. */
export function issuesForSection(issues: readonly ParsedIssue[], section: IssueSection): ParsedIssue[] {
  return issues.filter((i) => i.section === section || i.section === 'unknown')
}

// ---------------------------------------------------------------------------
// Path predicates and section links (#512, #517, PR #547)
//
// A derived panel asks whether the entries it prices are the ones failing, and
// which planner pages those entries live on, rather than matching the issue
// strings itself. These read the same paths the labels above do, so there is
// one parser for both.
// ---------------------------------------------------------------------------

/** An issue's path as segments: `incomeFloor.ladders.10.endYear` → four of them, a plan-level issue → none. */
export function issuePathSegments(issue: string): string[] {
  const { path } = parseIssue(issue)
  return path === '(root)' ? [] : path.split('.')
}

const toSegments = (path: string | readonly string[]): string[] =>
  typeof path === 'string' ? path.split('.').filter((s) => s.length > 0) : [...path]

/**
 * Whether an issue sits at `path` or anywhere under it, compared segment by
 * segment: `incomeFloor.ladders.1` covers `incomeFloor.ladders.1.endYear`
 * and not `incomeFloor.ladders.10.endYear`.
 */
export function hasIssueUnder(issues: readonly string[], ...paths: readonly (string | readonly string[])[]): boolean {
  return issues.some((issue) => {
    const path = issuePathSegments(issue)
    return paths.some((p) => {
      const want = toSegments(p)
      return want.length <= path.length && want.every((segment, i) => path[i] === segment)
    })
  })
}

/** Whether an issue is reported on exactly `path` (not on a child of it). */
export function hasIssueAt(issues: readonly string[], path: string | readonly string[]): boolean {
  const want = toSegments(path)
  return issues.some((issue) => {
    const got = issuePathSegments(issue)
    return got.length === want.length && want.every((segment, i) => got[i] === segment)
  })
}

/**
 * The planner section (route segment under /plan/:id/) that edits each
 * top-level plan key, in rail order. A key with no editing section maps to
 * nothing and the caller falls back to generic wording. This is a wider map
 * than `SECTION_BY_ROOT` above, which names only the cards that carry a
 * scoped issue list; a key here need only have a page to link to.
 */
const SECTION_BY_PLAN_KEY: Record<string, string> = {
  household: 'household',
  accounts: 'accounts',
  insurance: 'insurance',
  careEvents: 'insurance',
  incomes: 'income',
  incomeFloor: 'income-floor',
  expenses: 'spending',
  strategies: 'strategy',
  retirementActionEligibilityFacts: 'strategy',
  retirementActionAnnualTaxFacts: 'strategy',
  assumptions: 'assumptions',
  scenarios: 'scenarios',
}

const RAIL_ORDER = Object.keys(SECTION_TITLES)

export interface IssueSectionLink {
  /** Route segment, e.g. 'income-floor'; link to it as `../${segment}` from any plan page. */
  segment: string
  title: string
}

/** The sections the issues' entries live on, each once, in rail order; empty when none is known. */
export function sectionsWithIssues(issues: readonly string[]): IssueSectionLink[] {
  const segments = new Set<string>()
  for (const issue of issues) {
    // A Social Security stream lives in `incomes` but is edited on its own
    // page, so the router's answer wins wherever it can place the path.
    const routed = sectionOfPath(parseIssue(issue).path)
    const key = issuePathSegments(issue)[0]
    const segment = routed === 'social-security' ? 'social-security' : key === undefined ? undefined : SECTION_BY_PLAN_KEY[key]
    if (segment !== undefined) segments.add(segment)
  }
  return RAIL_ORDER.filter((s) => segments.has(s)).map((segment) => ({ segment, title: SECTION_TITLES[segment]! }))
}

/**
 * The issues minus any whose path continues `listPath` with an index at or
 * past `length`: a guard for a list that a row-level panel indexes into, so
 * an index the current list does not have can never be attributed to a row.
 */
export function withoutIssuesBeyond(issues: readonly string[], listPath: string | readonly string[], length: number): string[] {
  const list = toSegments(listPath)
  return issues.filter((issue) => {
    const path = issuePathSegments(issue)
    if (path.length <= list.length || !list.every((segment, i) => path[i] === segment)) return true
    const index = Number(path[list.length])
    return !Number.isInteger(index) || index < length
  })
}
