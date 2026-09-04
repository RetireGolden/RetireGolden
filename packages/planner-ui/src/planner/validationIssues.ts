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

import type { Plan } from '@retiregolden/engine/model/plan'

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
export function parseIssue(issue: string, plan?: Plan): ParsedIssue {
  const at = issue.indexOf(': ')
  const rawPath = at < 0 ? '(root)' : issue.slice(0, at)
  const path = rawPath === '$' ? '(root)' : rawPath
  const message = at < 0 ? issue : issue.slice(at + 2)
  return { path, message, section: sectionOfPath(path), label: labelOfPath(path, plan), advice: adviceOf(message, path) }
}

/** With the plan, items that a person knows by name are named ("Social Security (Alex)") rather than numbered. */
export function parseIssues(issues: readonly string[], plan?: Plan): ParsedIssue[] {
  return issues.map((issue) => parseIssue(issue, plan))
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

/**
 * Household-level tax attributes that the Strategy page edits: the capital
 * loss carryforward is stored under `household` (it belongs to the return,
 * not to a person) but its field is the Strategy page's card, so its issue
 * belongs in Strategy's list and the chip's jump goes there (#553).
 */
const STRATEGY_HOUSEHOLD_LEAVES = new Set(['capitalLossCarryforward'])

/** Whole paths whose label is the card's own caption rather than "Root: Leaf". */
const PATH_LABELS: Record<string, string> = {
  'household.capitalLossCarryforward': 'Capital loss carryforward',
}

export function sectionOfPath(path: string): IssueSection {
  const segments = path.split('.')
  const root = segments[0] ?? ''
  if (root === 'incomes' && segments[2] !== undefined && SOCIAL_SECURITY_LEAVES.has(segments[2])) return 'social-security'
  if (root === 'household' && segments.length === 2 && STRATEGY_HOUSEHOLD_LEAVES.has(segments[1]!)) return 'strategy'
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
  targets: 'Glidepath target',
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
  charityPct: 'Charity share',
  taxablePct: 'Taxable share',
  survivorPct: 'Survivor benefit',
  colaPct: 'COLA',
  certainYears: 'Guaranteed years',
  monthlyAmount: 'Monthly amount',
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
  survivorSpendingPct: 'Survivor spending',
  // Amortized spending (ABW); the card labels these without their unit.
  fixedRealReturnPct: 'Expected real return',
  startingCape: 'Starting CAPE',
  equitySharePct: 'Stock share',
  bondRealYieldPct: 'Real bond/TIPS yield',
  tiltPct: 'Spending tilt',
  fromAge: 'From age',
  toAge: 'To age',
  multiplier: 'Multiplier',
  earliestYear: 'Earliest year',
  latestYear: 'Latest year',
  pre65MonthlyPremiumPerPerson: 'Pre-65 premium / person / month',
  medicareExtrasMonthlyPerPerson: 'Medicare extras / person / month',
  // Insurance and care
  annualPremium: 'Annual premium',
  benefitPeriodYears: 'Benefit period (years)',
  eliminationPeriodDays: 'Elimination period (days)',
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
  oneTimeGoals: { amount: "Amount (today's $)", minFundingPct: 'Minimum funding' },
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
  spendingPolicy: 'Spending policy',
  abw: 'Amortized spending (ABW)',
}

/** Leaves that only read well with their parent object named ("Claim age (years)", not "Years"). */
const NESTED_LEAF_LABELS: Record<string, string> = {
  'claimAge.years': 'Claim age (years)',
  'claimAge.months': 'Claim age (+ months)',
  'deceasedClaimAge.years': 'When they claimed (age)',
  'deceasedClaimAge.months': 'When they claimed (+ months)',
  'purchase.year': 'Purchase year',
  'sepp.startAge': 'SEPP start age',
  'hecm.openYear': 'Line opens in',
  'allocation.startYear': 'Glidepath from year',
  'allocation.endYear': 'Glidepath to year',
  'payoutForm.survivorPct': 'Survivor share',
  'payoutForm.certainYears': 'Guaranteed years',
  'heirTaxByClass.traditional': 'Traditional heir tax',
  'heirTaxByClass.hsa': 'HSA heir tax',
  'earningsProjection.assumedAnnualEarnings': 'Assumed annual earnings',
  'earningsProjection.throughAge': 'Work through age',
  'disability.onsetAge': 'Disability onset age',
  // Inherited-IRA facts. The trail alone would read "Inherited › Beneficiary ›
  // Beneficiary birth year"; these are what the account card calls them.
  'inherited.ownerDeathYear': "Original owner's death year",
  'beneficiary.beneficiaryBirthYear': 'Beneficiary birth year',
  'beneficiary.treatAsOwnElectionYear': 'Treat-as-own election year',
  'beneficiary.ownerBirthYear': 'Original owner birth year',
  'beneficiary.ownerBirthMonth': 'Original owner birth month',
  'beneficiary.ownerBirthDay': 'Original owner birth day',
  'beneficiary.roth5YearStartYear': 'Roth 5-year start year',
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
export function labelOfPath(path: string, plan?: Plan): string {
  if (path === '(root)' || path === '$' || path === '') return 'Plan'
  return PATH_LABELS[path] ?? labelOfSegments(path.split('.'), plan)
}

/**
 * A Social Security stream sits in `plan.incomes` beside wages and rentals,
 * but its card is on the Social Security page under the person's name, so
 * "Income 3" would send someone hunting the wrong page for the wrong row.
 * With the plan in hand the item is named for the person instead.
 */
function namedItem(container: string, index: number, plan: Plan | undefined): string | null {
  if (!plan || container !== 'incomes') return null
  const stream = plan.incomes[index]
  if (stream?.type !== 'socialSecurity') return null
  const person = plan.household.people.find((p) => p.id === stream.personId)
  return person ? `Social Security (${person.name})` : 'Social Security'
}

/**
 * Leaves whose card label depends on what the item *is*, not only on which
 * list it sits in. A debt card labels its balance "Balance owed"
 * (AccountEditorSharedFields.tsx), so a card-level issue on
 * `accounts.N.balance` has to say that too — "Account 1: Balance" named a
 * field that card does not have (#502). Read from the plan the way
 * `namedItem` reads a Social Security stream; with no plan in hand the
 * generic label from LEAF_LABELS still stands.
 */
function typedLeafLabel(container: string, index: number, leaf: string, plan: Plan | undefined): string | null {
  if (!plan || container !== 'accounts' || leaf !== 'balance') return null
  return plan.accounts[index]?.type === 'debt' ? 'Balance owed' : null
}

/**
 * The same, from path segments that are already split, so a segment holding a
 * dot or slash (a JSON-pointer key decoded from `~1`) stays one segment.
 */
export function labelOfSegments(segments: readonly string[], plan?: Plan): string {
  if (segments.length === 0) return 'Plan'
  // A numbered item ("Person 2") is the card the field sits on and wins; with
  // no item, the last named group ("Itemized deductions") is the card. Any
  // object segments between the card and the leaf are kept ("Social Security
  // haircut › Cut") unless the nested leaf has a label of its own ("Claim
  // age (years)"), so a nested field is never mistaken for a top-level one.
  let item: string | null = null
  let container: string | null = null
  let containerIndex: number | null = null
  let group: string | null = null
  const trail: string[] = []
  const leaf = segments[segments.length - 1] ?? ''
  for (let i = 0; i < segments.length - 1; i++) {
    // `i` stops one short of the end, so both reads are in range.
    const seg = segments[i]!
    const next = segments[i + 1]!
    if (isIndex(next)) {
      item = namedItem(seg, Number(next), plan) ?? `${ITEM_NAMES[seg] ?? singular(seg)} ${Number(next) + 1}`
      container = seg
      containerIndex = Number(next)
      trail.length = 0
      i++
      continue
    }
    if (/^\d+$/.test(next)) {
      // A year-like key (a map keyed by year) is shown as itself.
      item = `${words(seg)} ${next}`
      container = seg
      containerIndex = null
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
  const typed =
    container !== null && containerIndex !== null && isIndex(parent)
      ? typedLeafLabel(container, containerIndex, leaf, plan)
      : null
  const own =
    typed ??
    (container !== null && isIndex(parent) ? CONTAINER_LEAF_LABELS[container]?.[leaf] : undefined) ??
    NESTED_LEAF_LABELS[`${parent}.${leaf}`]
  const field = own ?? [...trail, LEAF_LABELS[leaf] ?? words(leaf)].join(' › ')
  return prefix && prefix !== field ? `${prefix}: ${field}` : field
}

/**
 * The engine's cross-field messages that name schema keys rather than fields
 * (packages/engine/src/model/planCrossFieldChecks.ts, run from plan.ts's
 * superRefine). Matched exactly, so a reworded engine message falls through
 * to the key-by-key translation below rather than being mistranslated.
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
 * Leaves the engine stores in one unit and the card shows in another: the
 * brokerage qualified-dividend share is a 0–1 ratio in the plan and a percent
 * on the card. The engine's bound is kept exactly and only re-expressed in the
 * unit the person is typing in, so "at most 1" reads "at most 100" beside a
 * field showing 150 %; nothing here adds or moves a limit.
 */
const DISPLAY_SCALE: Record<string, number> = { qualifiedRatio: 100 }

/**
 * How many display units one stored unit is worth at this path: 100 for the
 * brokerage qualified-dividend share, 1 everywhere else. The field's range
 * (schemaBounds.ts) and its advice both read this, so a bound and a message
 * never disagree about the unit.
 */
export function displayScaleFor(path: string | undefined): number {
  const leaf = path?.split('.').pop() ?? ''
  return DISPLAY_SCALE[leaf] ?? 1
}

function boundInDisplayUnit(raw: string, path: string | undefined): string {
  const scale = displayScaleFor(path)
  if (scale === 1) return raw
  const n = Number(raw)
  return Number.isFinite(n) ? String(n * scale) : raw
}

/**
 * Zod's wording, translated. The engine's own messages (anything not in
 * Zod's "Too small" / "Too big" / "Invalid input" family) keep their sense,
 * with any schema key they name shown as the field's label; the two that a
 * person cannot act on as worded are translated exactly.
 */
export function adviceOf(message: string, path?: string): string {
  const custom = CUSTOM_ADVICE[message]
  if (custom) return custom
  const bound = (raw: string) => boundInDisplayUnit(raw, path)
  let m: RegExpMatchArray | null
  if ((m = message.match(/^Too small: expected .* to be >=(-?[\d.]+)/))) return `Must be at least ${bound(m[1]!)}`
  if ((m = message.match(/^Too small: expected .* to be >(-?[\d.]+)/))) return `Must be more than ${bound(m[1]!)}`
  if ((m = message.match(/^Too big: expected .* to be <=(-?[\d.]+)/))) return `Must be at most ${bound(m[1]!)}`
  if ((m = message.match(/^Too big: expected .* to be <(-?[\d.]+)/))) return `Must be less than ${bound(m[1]!)}`
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
    // The router's answer wins wherever it can place the path: a Social
    // Security stream lives in `incomes` and the capital-loss carryforward in
    // `household`, and each is edited on another page. The key map is only
    // for a plan key the router does not know (the retirement-action facts).
    const routed = sectionOfPath(parseIssue(issue).path)
    const key = issuePathSegments(issue)[0]
    const segment = routed !== 'unknown' ? routed : key === undefined ? undefined : SECTION_BY_PLAN_KEY[key]
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
