/**
 * ProjectionLab data-export mapper (onboarding-import-and-migration step 3).
 *
 * ProjectionLab lets users export their data as JSON. This maps that file's
 * documented, user-visible substance — current-finances accounts, income
 * sources, expenses, and the retirement milestone — onto a draft RetireGolden
 * plan through the normal validated plan route. The export is version-sniffed
 * by shape (`currentFinances.accounts`); anything else is refused with a
 * helpful message rather than guessed at, and every mapped, assumed, or
 * unmappable item lands on the review checklist. No scraping, no network —
 * the user's own exported file, parsed in the browser.
 */

import type { Account, Plan } from '../engine/model/plan'
import { createEmptyPlan, parsePlan } from '../engine/model/plan'
import { MAX_REASONABLE_DOLLARS, parseMoney } from './csv'
import type { ImportReviewItem } from './reviewChecklist'

export const MAX_IMPORT_JSON_CHARS = 10_000_000

export type ProjectionLabImportResult =
  | { ok: true; plan: Plan; review: ImportReviewItem[] }
  | { ok: false; message: string }

const UNRECOGNIZED_MESSAGE =
  'This file does not match a ProjectionLab data export we recognize (expected a "currentFinances" section with accounts). ' +
  'ProjectionLab may have changed its format — you can still bring balances over with the broker CSV or spreadsheet import.'

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function asArray(v: unknown): unknown[] | null {
  return Array.isArray(v) ? v : null
}

/**
 * A finite, sane, non-negative dollar amount — anything else is null. Numeric
 * strings ("350000", "$4,500") are accepted through the strict money parser,
 * since JSON exports sometimes stringify amounts; junk still fails.
 */
function asDollars(v: unknown): number | null {
  if (typeof v === 'string') {
    const parsed = parseMoney(v)
    return parsed !== null && parsed >= 0 ? parsed : null
  }
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  if (v < 0 || v > MAX_REASONABLE_DOLLARS) return null
  return v
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

function firstString(rec: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const s = asString(rec[k])
    if (s !== null) return s
  }
  return null
}

function firstDollars(rec: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const n = asDollars(rec[k])
    if (n !== null) return n
  }
  return null
}

type MappedType = 'cash' | 'taxable' | 'traditional' | 'roth' | 'hsa' | 'property' | 'debt'

/**
 * Keyword-match a ProjectionLab account type/name onto a RetireGolden account
 * class. Loan/debt keywords are checked first so "401k loan" or "IRA loan" is
 * a liability, never a retirement asset.
 */
export function mapProjectionLabAccountType(type: string, name: string): MappedType | null {
  const t = `${type} ${name}`.toLowerCase()
  if (/mortgage|debt|\bloan\b|liabilit|heloc/.test(t)) return 'debt'
  if (/\broth\b/.test(t)) return 'roth'
  if (/\bhsa\b|health savings/.test(t)) return 'hsa'
  if (/401|403|457\b|\bira\b|pretax|pre-tax|traditional|\btsp\b|rollover|sep\b|simple\b/.test(t)) return 'traditional'
  if (/real.?estate|property|\bhome\b|house/.test(t)) return 'property'
  if (/taxable|brokerage|investment/.test(t)) return 'taxable'
  if (/cash|checking|savings|money market|emergency/.test(t)) return 'cash'
  return null
}

export function mapProjectionLabExport(
  json: string,
  newId: () => string = () => crypto.randomUUID(),
): ProjectionLabImportResult {
  if (json.length > MAX_IMPORT_JSON_CHARS) {
    return { ok: false, message: 'File is too large to be a ProjectionLab export.' }
  }
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, message: 'This file is not valid JSON.' }
  }
  const root = asRecord(raw)
  if (!root) return { ok: false, message: UNRECOGNIZED_MESSAGE }

  const currentFinances = asRecord(root['currentFinances'])
  const rawAccounts = currentFinances ? asArray(currentFinances['accounts']) : null
  if (!currentFinances || !rawAccounts) return { ok: false, message: UNRECOGNIZED_MESSAGE }

  const review: ImportReviewItem[] = []
  const plan = createEmptyPlan({ newId, name: 'Imported from ProjectionLab' })
  const person = plan.household.people[0]!

  // --- Household ------------------------------------------------------------
  const user = asRecord(root['user']) ?? asRecord(root['profile'])
  const birthYearRaw = user?.['birthYear']
  const birthYear =
    typeof birthYearRaw === 'number' && Number.isInteger(birthYearRaw) && birthYearRaw > 1900 && birthYearRaw < 2100
      ? birthYearRaw
      : null
  if (birthYear !== null) {
    person.dob = `${birthYear}-07-01`
    review.push({
      status: 'defaulted',
      source: `Birth year ${birthYear}`,
      detail: 'Date of birth set to July 1 of your ProjectionLab birth year — set the exact date on the Household screen.',
    })
  } else {
    review.push({
      status: 'unmapped',
      source: 'Date of birth',
      detail: 'The export carried no readable birth year — set your date of birth on the Household screen.',
    })
  }
  review.push({
    status: 'defaulted',
    source: 'Filing status & state',
    detail: `Filing status defaulted to single and state to ${plan.household.state} — ProjectionLab exports do not carry them. Set both on the Household screen.`,
  })

  // Retirement milestone age, when present on the first plan.
  const firstPlan = asArray(root['plans'])?.map(asRecord).find((p) => p !== null) ?? null
  const milestones = firstPlan ? (asArray(firstPlan['milestones']) ?? []) : []
  for (const m of milestones) {
    const rec = asRecord(m)
    if (!rec) continue
    const name = (firstString(rec, 'name', 'label') ?? '').toLowerCase()
    const age = rec['age']
    if (name.includes('retire') && typeof age === 'number' && age >= 30 && age <= 80) {
      person.retirementAge = age
      review.push({ status: 'mapped', source: `Milestone "${firstString(rec, 'name', 'label')!}"`, detail: `Retirement age set to ${age}.` })
      break
    }
  }

  // --- Accounts ---------------------------------------------------------------
  for (const entry of rawAccounts) {
    const rec = asRecord(entry)
    if (!rec) continue
    const name = firstString(rec, 'name', 'label') ?? 'Imported account'
    const typeStr = firstString(rec, 'type', 'accountType', 'category') ?? ''
    const balance = firstDollars(rec, 'balance', 'value', 'currentBalance', 'amount')
    if (balance === null) {
      review.push({ status: 'skipped', source: name, detail: 'Account had no readable balance.' })
      continue
    }
    const mapped = mapProjectionLabAccountType(typeStr, name)
    if (mapped === null) {
      review.push({
        status: 'unmapped',
        source: `${name} (${typeStr || 'unknown type'}, $${balance.toLocaleString('en-US', { maximumFractionDigits: 0 })})`,
        detail: 'Account type has no RetireGolden equivalent mapping — add it by hand on the Accounts screen.',
      })
      continue
    }

    const base = { id: newId(), name, annualReturnPct: null }
    let account: Account
    switch (mapped) {
      case 'taxable': {
        const costBasis = firstDollars(rec, 'costBasis', 'basis')
        account = {
          ...base,
          type: 'taxable',
          ownerPersonId: null,
          balance,
          costBasis: costBasis ?? balance,
          annualContribution: 0,
        }
        if (costBasis === null) {
          review.push({
            status: 'defaulted',
            source: name,
            detail: 'No cost basis in the export — basis was set equal to the balance (no unrealized gain). Correct it on the Accounts screen.',
          })
        }
        break
      }
      case 'traditional':
        account = {
          ...base,
          type: 'traditional',
          ownerPersonId: person.id,
          kind: /401|403|457|tsp/i.test(`${typeStr} ${name}`) ? 'employer' : 'ira',
          balance,
          annualContribution: 0,
        }
        break
      case 'roth':
        account = {
          ...base,
          type: 'roth',
          ownerPersonId: person.id,
          kind: /401|403|457|tsp/i.test(`${typeStr} ${name}`) ? 'employer' : 'ira',
          balance,
          annualContribution: 0,
        }
        break
      case 'hsa':
        account = { ...base, type: 'hsa', ownerPersonId: person.id, balance, annualContribution: 0 }
        break
      case 'cash':
        account = { ...base, type: 'cash', ownerPersonId: null, balance, annualContribution: 0 }
        break
      case 'property':
        account = { ...base, type: 'property', ownerPersonId: null, value: balance, plannedSaleYear: null, expectedNetProceeds: null }
        break
      case 'debt': {
        const interestRaw = rec['interestRate']
        const payment = firstDollars(rec, 'payment', 'monthlyPayment')
        // Nothing imports silently: an unreadable rate falls back to 5% with a
        // review item, and a fraction-looking rate (0.035) is scaled with one.
        let interestPct = 5
        let interestNote: string | null = 'No readable interest rate in the export — 5% was assumed. Set the real rate on the Accounts screen.'
        if (typeof interestRaw === 'number' && Number.isFinite(interestRaw) && interestRaw >= 0 && interestRaw < 100) {
          if (interestRaw > 0 && interestRaw < 1) {
            interestPct = Math.round(interestRaw * 100 * 10000) / 10000
            interestNote = `The export's interest rate of ${interestRaw} looked like a fraction — imported as ${interestPct}%. Check it on the Accounts screen.`
          } else {
            interestPct = interestRaw
            interestNote = null
          }
        }
        account = {
          ...base,
          type: 'debt',
          ownerPersonId: null,
          balance,
          interestPct,
          monthlyPayment: payment ?? 0,
        }
        if (interestNote !== null) {
          review.push({ status: 'defaulted', source: name, detail: interestNote })
        }
        if (payment === null) {
          review.push({
            status: 'defaulted',
            source: name,
            detail: 'No monthly payment in the export — set the real payment on the Accounts screen.',
          })
        }
        break
      }
    }
    plan.accounts.push(account)
    review.push({
      status: 'mapped',
      source: `${name} (${typeStr || 'type from name'})`,
      detail: `Imported as a ${mapped} account with a $${balance.toLocaleString('en-US', { maximumFractionDigits: 0 })} balance.`,
    })
  }

  // --- Income sources ---------------------------------------------------------
  const rawIncomes = asArray(currentFinances['incomeSources']) ?? asArray(currentFinances['incomes']) ?? []
  for (const entry of rawIncomes) {
    const rec = asRecord(entry)
    if (!rec) continue
    const name = firstString(rec, 'name', 'label') ?? 'Income'
    const annual = firstDollars(rec, 'annualAmount', 'annual', 'amount')
    if (annual === null) {
      review.push({ status: 'skipped', source: name, detail: 'Income source had no readable annual amount.' })
      continue
    }
    const typeStr = (firstString(rec, 'type', 'category') ?? '').toLowerCase()
    const looksLikeWages = /employment|salary|wage|job|work/.test(`${typeStr} ${name.toLowerCase()}`)
    if (looksLikeWages) {
      plan.incomes.push({ type: 'wages', id: newId(), personId: person.id, annualGross: annual, endAge: null, realGrowthPct: 0 })
      review.push({ status: 'mapped', source: name, detail: `Imported as wages of $${annual.toLocaleString('en-US')} /yr until retirement.` })
    } else if (/social security|\bss\b|ssa/.test(`${typeStr} ${name.toLowerCase()}`)) {
      review.push({
        status: 'unmapped',
        source: name,
        detail: 'Social Security needs a claim age and benefit basis — set it up on the Social Security screen (you can import your SSA statement there).',
      })
    } else {
      plan.incomes.push({
        type: 'recurring',
        id: newId(),
        label: name,
        annualAmount: annual,
        startYear: null,
        endYear: null,
        inflationAdjusted: true,
        taxTreatment: 'ordinary',
      })
      review.push({
        status: 'defaulted',
        source: name,
        detail: `Imported as recurring ordinary income of $${annual.toLocaleString('en-US')} /yr with no end year — set dates and tax treatment on the Income screen.`,
      })
    }
  }

  // --- Expenses ----------------------------------------------------------------
  const rawExpenses = asArray(currentFinances['expenses']) ?? []
  let expenseTotal = 0
  const expenseNames: string[] = []
  for (const entry of rawExpenses) {
    const rec = asRecord(entry)
    if (!rec) continue
    const annual = firstDollars(rec, 'annualAmount', 'annual', 'amount')
    if (annual === null) continue
    expenseTotal += annual
    const name = firstString(rec, 'name', 'label')
    if (name) expenseNames.push(name)
  }
  if (expenseTotal > 0) {
    plan.expenses.baseAnnual = expenseTotal
    review.push({
      status: 'defaulted',
      source: expenseNames.length > 0 ? expenseNames.join(', ') : 'Expenses',
      detail: `Baseline annual spending set to the $${expenseTotal.toLocaleString('en-US')} sum of your ProjectionLab expenses — RetireGolden models one baseline plus phases/goals, so re-shape it on the Spending screen (healthcare is modeled separately).`,
    })
  } else {
    review.push({ status: 'unmapped', source: 'Spending', detail: 'No readable expenses in the export — set baseline spending on the Spending screen.' })
  }

  review.push({
    status: 'unmapped',
    source: 'Strategies, assumptions & scenarios',
    detail: 'Withdrawal strategy, Roth conversions, market assumptions, and scenarios do not transfer between tools — review the Strategy and Assumptions screens.',
  })

  const parsed = parsePlan(plan)
  if (!parsed.ok) {
    return { ok: false, message: `The mapped plan failed validation: ${parsed.issues.join('; ')}` }
  }
  return { ok: true, plan: parsed.plan, review }
}
