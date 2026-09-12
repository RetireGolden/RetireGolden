import { describe, expect, it } from 'vitest'
import type { Account } from '../../model/plan.js'
import { packForYear } from '../../params/index.js'
import { hecmLineOpeningsWithHudValidation, priceHecmHudMipAssessmentYear } from './hecmHudValidatedOpeningAdapter.js'

type Line = NonNullable<Extract<Account, { type: 'property' }>['hecm']>
const provenance = { source: 'Servicer complete ledger stipulated for worksheet', asOf: '2026-12-31' }
function line(): Line {
  // HUD 4000.1 Update18 pp593/1456: rate/12, remitted MIP enters
  // subsequent outstanding balance. Full-precision hand recurrence gives
  // 100000*(1+.005/12)^12 = 100501.147426.
  return {
    openYear: 2026, growthRatePct: 0, drawPolicy: 'lastResort',
    closingDate: '2026-01-01', firstMipPeriodConvention: 'fullCalendarMonths',
    mipAssessmentLedgerEvidence: { completeThroughDate: '2026-12-31', noUnrepresentedTransactionsAfterLastAssessment: true, provenance },
    outstandingBalanceAtMipAssessmentByMonth: Array.from({ length: 12 }, (_, index) => ({
      assessmentDate: `2026-${String(index + 1).padStart(2, '0')}-28`,
      outstandingBalanceBeforeMip: 100000 * (1 + .005 / 12) ** index,
      provenance,
    })),
  }
}
describe('HUD dated assessment ledger integration', () => {
  it('carries remitted MIP into the final ledger balance rather than twelve flat charges', () => {
    const result = priceHecmHudMipAssessmentYear({ line: line(), year: 2026, annualMipRate: .005 })
    expect(result.status).toBe('complete')
    if (result.status !== 'complete') return
    expect(result.totalMipAccrued).toBeCloseTo(501.147426, 5)
    expect(result.endingLoanBalance).toBeCloseTo(100501.147426, 5)
  })
  it('refuses a partial monthly list and a missing year-end evidence contract', () => {
    const partial = line()
    partial.outstandingBalanceAtMipAssessmentByMonth = partial.outstandingBalanceAtMipAssessmentByMonth!.slice(0, 1)
    expect(priceHecmHudMipAssessmentYear({ line: partial, year: 2026, annualMipRate: .005 }).status).toBe('timingEvidenceIncomplete')
    const absent = line()
    delete absent.mipAssessmentLedgerEvidence
    expect(priceHecmHudMipAssessmentYear({ line: absent, year: 2026, annualMipRate: .005 }).status).toBe('timingEvidenceIncomplete')
  })
  it('refuses midmonth closing without inventing a full first-month assessment', () => {
    const midmonth = line()
    midmonth.closingDate = '2026-06-15'
    expect(priceHecmHudMipAssessmentYear({ line: midmonth, year: 2026, annualMipRate: .005 }).status).toBe('timingEvidenceIncomplete')
  })
  it('preserves a closing advance in the servicer balance rather than adding only MIP to costs', () => {
    const financed = line()
    // H4: $24,982.50 IMIP + $5,000 costs + $100,000 borrower draw.
    financed.outstandingBalanceAtMipAssessmentByMonth = financed.outstandingBalanceAtMipAssessmentByMonth!.map((row, index) => ({ ...row, outstandingBalanceBeforeMip: 129982.50 * (1 + .005 / 12) ** index }))
    const result = priceHecmHudMipAssessmentYear({ line: financed, year: 2026, annualMipRate: .005 })
    expect(result.status).toBe('complete')
    if (result.status !== 'complete') return
    expect(result.endingLoanBalance).toBeCloseTo(129982.50 * (1 + .005 / 12) ** 12, 7)
  })
})


describe('HUD closing advance cash ownership', () => {
  function property(treatment?: Line['closingDayBorrowerAdvanceTreatment']): Extract<Account, { type: 'property' }> {
    return {
      id: 'home', name: 'Home', type: 'property', ownerPersonId: 'owner', annualReturnPct: null,
      value: 2000000, plannedSaleYear: null, expectedNetProceeds: null,
      hecm: {
        openYear: 2026, growthRatePct: 0, drawPolicy: 'lastResort',
        calculationMode: 'hudValidated', hudTransactionKind: 'ordinaryOrigination',
        caseAssignmentDate: '2026-01-01', closingDate: '2026-01-01',
        appraisedValue: 2000000, verifiedPrincipalLimitFactorPct: 50,
        principalLimitFactorProvenance: { ...provenance, kind: 'quoted' }, otherClosingCosts: 5000,
        closingDayBorrowerAdvance: 100000,
        ...(treatment === undefined ? {} : { closingDayBorrowerAdvanceTreatment: treatment }),
      },
    }
  }
  function opening(account: Extract<Account, { type: 'property' }>) {
    return hecmLineOpeningsWithHudValidation({
      accounts: [account], year: 2026, startYear: 2026,
      propertyValues: new Map([['home', 2000000]]), openHecmLines: new Map(),
      people: [], dobYear: (person) => Number(person.dob.slice(0, 4)), pack: packForYear(2026).pack,
    })
  }
  it('distinguishes new cash receipt from an advance already represented in starting cash', () => {
    // HUD H4 sourced worksheet: MCA1249125*.02 +5000+100000 =129982.50.
    const modeled = opening(property('disburseAtModeledClosing'))
    expect(modeled.rows[0]?.state.loanBalance).toBe(129982.50)
    expect(modeled.rows[0]?.borrowerAdvanceCashReceipt).toBe(100000)
    const observed = opening(property('alreadyIncludedInStartingCash'))
    expect(observed.rows[0]?.state.loanBalance).toBe(129982.50)
    expect(observed.rows[0]?.borrowerAdvanceCashReceipt).toBeUndefined()
  })
  it('preserves an explicit quote versus HUD table verification without inferring it from source prose', () => {
    const quoted = opening(property('alreadyIncludedInStartingCash'))
    expect(quoted.rows[0]?.state).toMatchObject({ principalLimitFactorProvenance: 'quoted' })
    const verified = property('alreadyIncludedInStartingCash')
    verified.hecm!.principalLimitFactorProvenance = { ...provenance, kind: 'hudTableVerified' }
    expect(opening(verified).rows[0]?.state).toMatchObject({ principalLimitFactorProvenance: 'hudTableVerified' })
    const unverified = property('alreadyIncludedInStartingCash')
    unverified.hecm!.principalLimitFactorProvenance = { ...provenance, kind: 'unverified' }
    expect(opening(unverified).rows).toHaveLength(0)
    const unspecified = property('alreadyIncludedInStartingCash')
    unspecified.hecm!.principalLimitFactorProvenance = { source: 'generic note mentioning a HUD table', asOf: '2026-01-01' }
    expect(opening(unspecified).rows).toHaveLength(0)
  })
  it('refuses a positive closing advance whose cash ownership is unknown', () => {
    const result = opening(property())
    expect(result.rows).toHaveLength(0)
    expect(result.warnings.some((warning) => warning.includes('closing advance'))).toBe(true)
  })
})
