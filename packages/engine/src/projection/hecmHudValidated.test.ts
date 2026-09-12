import { describeRule } from '../rules/describeRule.js'
import { describe, expect, it } from 'vitest'

import { computeHecmHudValidatedOpening, hecmAnnualMipOnOutstandingBalance, priceHecmMonthlyMipFromOutstandingBalances, type HecmCaseYearLimits } from './hecmHudValidated.js'

const limits2026: HecmCaseYearLimits = { maximumClaimAmount: 1_249_125, initialMipRate: 0.02, annualMipRate: 0.005 }
const byYear = new Map<number, HecmCaseYearLimits>([[2026, limits2026]])
const opening = { calculationMode: 'hudValidated' as const, transactionKind: 'ordinaryOrigination' as const, caseAssignmentYear: 2026, closingDate: '2026-06-15', appraisedValue: 2_000_000, principalLimitFactor: { value: 0.5, provenance: 'quoted' as const }, limitsByCaseYear: byYear }

describeRule('hud-hecm-mca-mip-limits', { readings: { hud2026: 1249125, uncappedAppraisal: 2000000 }, accepted: 'hud2026' }, ({ accepted }) => {
  it('caps MCA at the 2026 ceiling and distinguishes case assignment from closing', () => {
    const result = computeHecmHudValidatedOpening(opening)
    expect(result).toMatchObject({ status: 'hudValidated', maximumClaimAmount: accepted, initialPrincipalLimit: 624_562.5, initialMip: 24_982.5, openingLoanBalance: 24_982.5, caseParameterYear: 2026, closingDate: '2026-06-15' })
  })

  it('includes every verified closing-day financed amount in opening debt (H4)', () => {
    // Independent opening worksheet: 1,249,125 × 2% = 24,982.50;
    // + 5,000 financed costs + 100,000 closing-day advance = 129,982.50.
    const result = computeHecmHudValidatedOpening({ ...opening, otherClosingCosts: 5_000, closingDayBorrowerAdvance: 100_000 })
    expect(result).toMatchObject({ status: 'hudValidated', initialPrincipalLimit: 624_562.5, initialMip: 24_982.5, closingDayBorrowerAdvance: 100_000, openingLoanBalance: 129_982.5 })
  })

  it('refuses to turn a case year into a missing closing date or invalid closing evidence', () => {
    expect(computeHecmHudValidatedOpening({ ...opening, closingDate: 'unknown' })).toMatchObject({ status: 'missingAuthority', reason: 'unknownClosingDate' })
    expect(computeHecmHudValidatedOpening({ ...opening, closingDate: '2026-02-30' })).toMatchObject({ status: 'missingAuthority', reason: 'invalidClosingDate' })
  })

  it('uses appraisal below the ceiling and retains typed invalid/unsupported controls', () => {
    expect(computeHecmHudValidatedOpening({ ...opening, appraisedValue: 1_000_000, principalLimitFactor: { value: 0.5, provenance: 'hudTableVerified' } })).toMatchObject({ status: 'hudValidated', maximumClaimAmount: 1_000_000, initialPrincipalLimit: 500_000, initialMip: 20_000 })
    expect(computeHecmHudValidatedOpening({ ...opening, closingDayBorrowerAdvance: -1 })).toMatchObject({ status: 'missingAuthority', reason: 'invalidClosingDayBorrowerAdvance' })
    for (const transactionKind of ['purchase', 'refinance', 'unknown'] as const) {
      expect(computeHecmHudValidatedOpening({ ...opening, transactionKind })).toMatchObject({ status: 'missingAuthority', reason: 'unsupportedTransactionKind' })
    }
  })

  it('keeps simple annual pre-timing arithmetic distinct from invalid input', () => {
    expect(hecmAnnualMipOnOutstandingBalance(100_000, 0.005)).toEqual({ status: 'ok', amount: 500 })
    expect(hecmAnnualMipOnOutstandingBalance(0, 0.005)).toEqual({ status: 'ok', amount: 0 })
    expect(hecmAnnualMipOnOutstandingBalance(Number.NaN, 0.005)).toEqual({ status: 'invalidInput', amount: null })
  })
})

describe('priceHecmMonthlyMipFromOutstandingBalances', () => {
  it('prices the independently capitalized Handbook remittance sequence (H1)', () => {
    // Update 18: one-twelfth of 0.50% of the outstanding balance is remitted
    // monthly and added to the balance. Independent closed form, r=.005/12:
    // 100,000 × ((1+r)^12 − 1) = 501.147426…; month 2 is 41.684027… .
    const r = 0.005 / 12
    const balances = Array.from({ length: 12 }, (_, month) => 100_000 * ((1 + r) ** month))
    const result = priceHecmMonthlyMipFromOutstandingBalances({ closingDate: '2026-01-01', annualMipRate: 0.005, assessments: balances.map((outstandingBalanceBeforeMip, month) => ({ assessmentDate: `2026-${String(month + 1).padStart(2, '0')}-28`, outstandingBalanceBeforeMip })) })
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.monthlyMip[0]).toBeCloseTo(41.6666666667, 8)
    expect(result.monthlyMip[1]).toBeCloseTo(41.6840277778, 8)
    expect(result.totalMipAccrued).toBeCloseTo(501.147426, 5)
    expect(result.postedBalances[11]).toBeCloseTo(100_501.147426, 5)
  })

  it('requires dated, ordered assessments after a known closing date (H2/H3)', () => {
    expect(priceHecmMonthlyMipFromOutstandingBalances({ closingDate: 'unknown', annualMipRate: 0.005, assessments: [] })).toMatchObject({ status: 'timingEvidenceIncomplete', reason: 'unknownClosingDate' })
    expect(priceHecmMonthlyMipFromOutstandingBalances({ closingDate: '2026-06-15', annualMipRate: 0.005, assessments: [{ assessmentDate: '2026-01-28', outstandingBalanceBeforeMip: 100_000 }] })).toMatchObject({ status: 'timingEvidenceIncomplete', reason: 'assessmentBeforeClosing' })
    expect(priceHecmMonthlyMipFromOutstandingBalances({ closingDate: '2026-06-15', annualMipRate: 0.005, assessments: [{ assessmentDate: '2026-06-28', outstandingBalanceBeforeMip: 100_000 }, { assessmentDate: '2026-06-28', outstandingBalanceBeforeMip: 110_000 }] })).toMatchObject({ status: 'timingEvidenceIncomplete', reason: 'unorderedAssessments' })
  })

  it('keeps invalid numeric input distinct from a legitimate zero balance', () => {
    expect(priceHecmMonthlyMipFromOutstandingBalances({ closingDate: '2026-01-01', annualMipRate: 0.005, assessments: [{ assessmentDate: '2026-01-31', outstandingBalanceBeforeMip: 0 }] })).toMatchObject({ status: 'ok', totalMipAccrued: 0 })
    expect(priceHecmMonthlyMipFromOutstandingBalances({ closingDate: '2026-01-01', annualMipRate: 0.005, assessments: [{ assessmentDate: '2026-01-31', outstandingBalanceBeforeMip: Number.NaN }] })).toMatchObject({ status: 'invalidInput' })
  })
})
