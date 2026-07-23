/**
 * 1040-seeded onboarding, guided v1 (onboarding-import-and-migration step 5).
 *
 * "Start from your tax return": the user types ~12 line values off last
 * year's Form 1040 and this maps them into a coherent draft plan — income
 * streams, filing/bracket context, an estimated taxable account, and the
 * IRMAA-lookback MAGI. Guided entry only: no PDF parsing, no OCR (explicitly
 * deferred), nothing leaves the device. Every prefilled value carries a
 * "from your 1040" review item and is ordinary editable plan data afterward.
 */

import type { Plan } from '@retiregolden/engine/model/plan'
import { createEmptyPlan, parsePlan } from '@retiregolden/engine/model/plan'
import { MAX_REASONABLE_DOLLARS } from './csv'
import { form1040Locator as form1040 } from './provenance'
import type { ImportReviewItem } from './reviewChecklist'

export interface TenFortyInputs {
  filingStatus: 'single' | 'marriedFilingJointly'
  /** Two-letter state of residence. */
  state: string
  /** ISO date of birth; needed to anchor ages (not on the 1040 itself). */
  primaryDob: string
  /** Required when filing jointly. */
  spouseDob?: string
  /** Line 1a — wages, salaries, tips. */
  wages: number
  /** Line 2a — tax-exempt interest (feeds MAGI). */
  taxExemptInterest: number
  /** Line 2b — taxable interest. */
  taxableInterest: number
  /** Line 3a — qualified dividends. */
  qualifiedDividends: number
  /** Line 3b — ordinary dividends (includes 3a). */
  ordinaryDividends: number
  /** Line 4b — taxable IRA distributions. */
  iraDistributions: number
  /** Line 5b — taxable pensions and annuities. */
  pensionsAndAnnuities: number
  /** Line 6a — total Social Security benefits (before the taxable portion). */
  socialSecurityBenefits: number
  /** Line 7 — capital gain or (loss); negative allowed. */
  capitalGain: number
  /** Line 11 — adjusted gross income. */
  agi: number
}

export type TenFortyResult = { ok: true; plan: Plan; review: ImportReviewItem[] } | { ok: false; message: string }

/** Combined interest+dividend yield used to size the estimated taxable account. */
export const ASSUMED_TAXABLE_YIELD_PCT = 2.5

/** True for a real calendar date in YYYY-MM-DD (rejects 2026-13-40, 2026-02-30, …). */
function isValidIsoDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const date = new Date(y, mo - 1, d)
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d
}

function badDollar(v: number): boolean {
  return !Number.isFinite(v) || Math.abs(v) > MAX_REASONABLE_DOLLARS
}

function ageAt(dobIso: string, now: Date): number {
  const dob = new Date(`${dobIso}T00:00:00`)
  let age = now.getFullYear() - dob.getFullYear()
  const beforeBirthday =
    now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())
  if (beforeBirthday) age--
  return age
}

export function seedPlanFromTenForty(
  inputs: TenFortyInputs,
  newId: () => string = () => crypto.randomUUID(),
  now: () => Date = () => new Date(),
): TenFortyResult {
  if (!isValidIsoDate(inputs.primaryDob)) {
    return { ok: false, message: 'Enter your date of birth as a real calendar date (YYYY-MM-DD).' }
  }
  if (inputs.filingStatus === 'marriedFilingJointly' && (!inputs.spouseDob || !isValidIsoDate(inputs.spouseDob))) {
    return { ok: false, message: "Married filing jointly needs your spouse's date of birth too (YYYY-MM-DD)." }
  }
  if (!/^[A-Za-z]{2}$/.test(inputs.state)) return { ok: false, message: 'Enter your state as its two-letter code.' }
  const dollarFields: Array<[keyof TenFortyInputs, number]> = [
    ['wages', inputs.wages],
    ['taxExemptInterest', inputs.taxExemptInterest],
    ['taxableInterest', inputs.taxableInterest],
    ['qualifiedDividends', inputs.qualifiedDividends],
    ['ordinaryDividends', inputs.ordinaryDividends],
    ['iraDistributions', inputs.iraDistributions],
    ['pensionsAndAnnuities', inputs.pensionsAndAnnuities],
    ['socialSecurityBenefits', inputs.socialSecurityBenefits],
    ['capitalGain', inputs.capitalGain],
    ['agi', inputs.agi],
  ]
  for (const [field, value] of dollarFields) {
    if (badDollar(value)) return { ok: false, message: `The ${field} value is not a usable dollar amount.` }
    if (field !== 'capitalGain' && value < 0) {
      return { ok: false, message: `The ${field} value cannot be negative (only capital gain can be a loss).` }
    }
  }

  const review: ImportReviewItem[] = []
  const plan = createEmptyPlan({ newId, now, name: 'Seeded from your 1040' })
  const today = now()

  // --- Household / filing context -----------------------------------------
  plan.household.filingStatus = inputs.filingStatus
  plan.household.state = inputs.state.toUpperCase()
  const primary = plan.household.people[0]!
  primary.dob = inputs.primaryDob
  if (inputs.filingStatus === 'marriedFilingJointly') {
    plan.household.people.push({
      id: newId(),
      name: 'Spouse',
      dob: inputs.spouseDob!,
      sex: 'average',
      retirementAge: 65,
      longevity: { planningAge: 95, source: 'manual' },
    })
  }
  review.push({
    status: 'mapped',
    source: 'Filing status & state (1040 header)',
    detail: `Filing ${inputs.filingStatus === 'single' ? 'single' : 'jointly'}, resident of ${plan.household.state}.`,
    locator: form1040('header'),
    confidence: 'exact',
  })
  const jointReturn = inputs.filingStatus === 'marriedFilingJointly'
  review.push({
    status: 'mapped',
    source: jointReturn ? 'Dates of birth (guided entry, not on the 1040)' : 'Date of birth (guided entry, not on the 1040)',
    detail: jointReturn
      ? "Your and your spouse's dates of birth as you typed them — a 1040 does not carry them, and they anchor every age in the plan. Correct either on the Household screen."
      : 'Your date of birth as you typed it — a 1040 does not carry it, and it anchors every age in the plan. Correct it on the Household screen.',
    locator: {
      kind: 'none',
      note: jointReturn
        ? 'both dates of birth are typed in the guided entry form, not read from the 1040'
        : 'the date of birth is typed in the guided entry form, not read from the 1040',
    },
    confidence: 'exact',
    // Two people's DOBs on a joint return land on two fields — no single target.
    ...(jointReturn ? {} : { target: 'household.people[0].dob' }),
  })

  // --- Line 1a: wages -------------------------------------------------------
  if (inputs.wages > 0) {
    plan.incomes.push({ type: 'wages', id: newId(), personId: primary.id, annualGross: inputs.wages, endAge: null, realGrowthPct: 0 })
    review.push({
      status: inputs.filingStatus === 'marriedFilingJointly' ? 'defaulted' : 'mapped',
      source: 'From your 1040 — line 1a (wages)',
      detail:
        `$${inputs.wages.toLocaleString('en-US')} /yr of wages until retirement` +
        (inputs.filingStatus === 'marriedFilingJointly'
          ? ', all placed on you — split it between spouses on the Income screen so retirement dates apply per person.'
          : '.'),
      locator: form1040('1a'),
      confidence: 'exact',
      target: `incomes[${plan.incomes.length - 1}]`,
    })
  }

  // --- Lines 2b/3a/3b: estimated taxable account ----------------------------
  const investmentIncome = inputs.taxableInterest + inputs.ordinaryDividends
  if (investmentIncome > 0) {
    // Clamp: sub-dollar investment income must not round the denominator to 0.
    const estimatedBalance = Math.max(1, Math.round(investmentIncome / (ASSUMED_TAXABLE_YIELD_PCT / 100)))
    const qualifiedRatio = inputs.ordinaryDividends > 0 ? Math.min(1, inputs.qualifiedDividends / inputs.ordinaryDividends) : 0
    plan.accounts.push({
      id: newId(),
      type: 'taxable',
      name: 'Brokerage (estimated from your 1040)',
      ownerPersonId: null,
      annualReturnPct: null,
      balance: estimatedBalance,
      costBasis: estimatedBalance,
      interestYieldPct: Math.round((inputs.taxableInterest / estimatedBalance) * 10000) / 100,
      dividendYieldPct: Math.round((inputs.ordinaryDividends / estimatedBalance) * 10000) / 100,
      qualifiedRatio: Math.round(qualifiedRatio * 100) / 100,
      reinvestDividends: true,
      annualContribution: 0,
    })
    review.push({
      status: 'defaulted',
      source: 'From your 1040 — lines 2b/3a/3b (interest & dividends)',
      detail:
        `Your $${investmentIncome.toLocaleString('en-US')} of interest + dividends implies roughly a ` +
        `$${estimatedBalance.toLocaleString('en-US')} taxable balance at a ${ASSUMED_TAXABLE_YIELD_PCT}% yield — an estimate to replace ` +
        'with the real balance and cost basis on the Accounts screen. The qualified-dividend share was kept.',
      locator: { kind: 'derived', from: [form1040('2b'), form1040('3a'), form1040('3b')], note: `balance implied by a ${ASSUMED_TAXABLE_YIELD_PCT}% yield` },
      confidence: 'estimated',
      target: `accounts[${plan.accounts.length - 1}]`,
    })
  }

  // --- Line 4b: IRA distributions -------------------------------------------
  if (inputs.iraDistributions > 0) {
    review.push({
      status: 'unmapped',
      source: 'From your 1040 — line 4b (IRA distributions)',
      detail:
        `You took $${inputs.iraDistributions.toLocaleString('en-US')} from IRAs — RetireGolden models withdrawals from account balances, ` +
        'so add your traditional IRA/401(k) accounts with their balances on the Accounts screen (a broker CSV can fill them).',
      locator: form1040('4b'),
      confidence: 'unmapped',
    })
  }

  // --- Line 5b: pensions ------------------------------------------------------
  if (inputs.pensionsAndAnnuities > 0) {
    const startAge = Math.min(80, Math.max(40, ageAt(inputs.primaryDob, today)))
    plan.accounts.push({
      id: newId(),
      type: 'pension',
      name: 'Pension (from your 1040)',
      ownerPersonId: primary.id,
      annualReturnPct: null,
      source: 'private',
      startAge,
      monthlyAmount: Math.round(inputs.pensionsAndAnnuities / 12),
      colaPct: 0,
      survivorPct: 50,
    })
    review.push({
      status: 'defaulted',
      source: 'From your 1040 — line 5b (pensions & annuities)',
      detail:
        `A pension paying $${Math.round(inputs.pensionsAndAnnuities / 12).toLocaleString('en-US')} /mo starting now, with no COLA and a 50% ` +
        'survivor benefit — check the COLA, survivor percentage, and public/private split on the Accounts screen.',
      locator: form1040('5b'),
      confidence: 'assumed',
      target: `accounts[${plan.accounts.length - 1}]`,
    })
  }

  // --- Line 6a: Social Security ------------------------------------------------
  if (inputs.socialSecurityBenefits > 0) {
    const monthly = Math.round(inputs.socialSecurityBenefits / 12)
    plan.incomes.push({
      type: 'socialSecurity',
      id: newId(),
      personId: primary.id,
      piaMonthly: monthly,
      earnings: null,
      claimAge: { years: 67, months: 0 },
    })
    review.push({
      status: 'defaulted',
      source: 'From your 1040 — line 6a (Social Security benefits)',
      detail:
        `$${monthly.toLocaleString('en-US')} /mo entered as the benefit basis, assuming a claim at 67 — if you claimed earlier or later, ` +
        'set the real claim age (or import your SSA statement) on the Social Security screen.' +
        (inputs.filingStatus === 'marriedFilingJointly'
          ? ' Line 6a is the joint total, but it was all placed on you — if both spouses receive benefits, split it into one ' +
            'stream per person on the Social Security screen (survivor-year benefits and benefit end dates depend on whose record is whose).'
          : ''),
      locator: form1040('6a'),
      confidence: 'assumed',
      target: `incomes[${plan.incomes.length - 1}]`,
    })
  } else {
    review.push({
      status: 'unmapped',
      source: 'Social Security',
      detail: 'No benefits on the return — set up future Social Security on its screen (your SSA statement XML imports there).',
      locator: { kind: 'none', note: 'no Social Security benefits were entered from the return' },
      confidence: 'unmapped',
    })
  }

  // --- Line 7: capital gains -----------------------------------------------------
  if (inputs.capitalGain !== 0) {
    review.push({
      status: 'unmapped',
      source: 'From your 1040 — line 7 (capital gain/loss)',
      detail:
        inputs.capitalGain > 0
          ? 'Last year\'s realized gains are not projected forward — RetireGolden realizes gains from actual modeled sales and yields instead.'
          : `A $${Math.abs(inputs.capitalGain).toLocaleString('en-US')} loss may leave a carryforward — enter any remaining capital-loss carryforward on the Household screen.`,
      locator: form1040('7'),
      confidence: 'unmapped',
    })
  }

  // --- Line 11 (+2a): MAGI for the IRMAA lookback ---------------------------------
  const magi = inputs.agi + inputs.taxExemptInterest
  plan.assumptions.recentAnnualMagi = magi
  review.push({
    status: 'mapped',
    source: 'From your 1040 — lines 11 + 2a (AGI + tax-exempt interest)',
    detail: `Recent MAGI of $${magi.toLocaleString('en-US')} recorded — Medicare IRMAA looks back two years, so early projection years use it.`,
    locator: { kind: 'derived', from: [form1040('11'), form1040('2a')], note: 'AGI plus tax-exempt interest' },
    confidence: 'derived',
    target: 'assumptions.recentAnnualMagi',
  })

  // --- What a 1040 cannot tell us ---------------------------------------------------
  review.push({
    status: 'unmapped',
    source: 'Spending, balances & retirement dates',
    detail:
      'A tax return shows income, not spending or savings — set baseline spending on the Spending screen, account balances on the Accounts screen, and retirement ages on the Household screen.',
    locator: { kind: 'none', note: 'a tax return shows income, not spending, balances, or retirement dates' },
    confidence: 'unmapped',
  })

  const parsed = parsePlan(plan)
  if (!parsed.ok) {
    return { ok: false, message: `The seeded plan failed validation: ${parsed.issues.join('; ')}` }
  }
  return { ok: true, plan: parsed.plan, review }
}
