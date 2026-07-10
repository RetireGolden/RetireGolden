/**
 * Tax year 2026 parameter pack (post-OBBBA current law).
 *
 * Sources (verified June 2026) — see DOCS/domain/domain-rules-reference.md:
 * - Brackets/deductions/AMT: IRS inflation adjustments; Tax Foundation 2026 tables
 * - Capital gains/NIIT: IRS; Kiplinger 2026 LTCG thresholds
 * - Limits: IRS IR news release (401(k) $24,500; IRA $7,500)
 * - RMD: IRS Pub 590-B Uniform Lifetime Table (2022+); QCD $111,000 (2026)
 * - Medicare: CMS 2026 ($202.90 standard Part B); IRMAA tiers per statute
 * - Social Security: SSA 2026 COLA fact sheet
 * - FPL: HHS 2025 guidelines (apply to 2026 ACA coverage year)
 */

import type { ParameterPack } from '../types'

export const year2026: ParameterPack = {
  year: 2026,

  federalTax: {
    brackets: {
      single: [
        { lowerBound: 0, ratePct: 10 },
        { lowerBound: 12_400, ratePct: 12 },
        { lowerBound: 50_400, ratePct: 22 },
        { lowerBound: 105_700, ratePct: 24 },
        { lowerBound: 201_775, ratePct: 32 },
        { lowerBound: 256_225, ratePct: 35 },
        { lowerBound: 640_600, ratePct: 37 },
      ],
      marriedFilingJointly: [
        { lowerBound: 0, ratePct: 10 },
        { lowerBound: 24_800, ratePct: 12 },
        { lowerBound: 100_800, ratePct: 22 },
        { lowerBound: 211_400, ratePct: 24 },
        { lowerBound: 403_550, ratePct: 32 },
        { lowerBound: 512_450, ratePct: 35 },
        { lowerBound: 768_700, ratePct: 37 },
      ],
    },
    standardDeduction: { single: 16_100, marriedFilingJointly: 32_200 },
    age65Addition: { single: 2_050, marriedFilingJointly: 1_650 },
    // OBBBA SALT cap: $40,000 for 2025, +1%/yr → $40,400 for 2026.
    saltCap: 40_400,
    // Net capital loss deductible against ordinary income (IRC §1211(b)); fixed
    // at $3,000 since 1978, never indexed.
    capitalLossOrdinaryOffsetLimit: 3_000,
    // IRC §121 home-sale gain exclusion; statutory since 1997, never indexed.
    section121Exclusion: { single: 250_000, marriedFilingJointly: 500_000 },
    seniorDeduction: {
      amountPerPerson: 6_000,
      magiPhaseOutStart: { single: 75_000, marriedFilingJointly: 150_000 },
      phaseOutRatePct: 6,
      lastApplicableYear: 2028,
    },
    amt: {
      exemption: { single: 90_100, marriedFilingJointly: 140_200 },
      exemptionPhaseOutStart: { single: 500_000, marriedFilingJointly: 1_000_000 },
      exemptionPhaseOutRatePct: 50,
      rate28StartsAbove: 244_500,
      rate26Pct: 26,
      rate28Pct: 28,
    },
  },

  capitalGains: {
    rate15StartsAbove: { single: 49_450, marriedFilingJointly: 98_900 },
    rate20StartsAbove: { single: 545_500, marriedFilingJointly: 613_700 },
  },

  niit: {
    ratePct: 3.8,
    magiThreshold: { single: 200_000, marriedFilingJointly: 250_000 },
  },

  ssBenefitTaxation: {
    tier50Start: { single: 25_000, marriedFilingJointly: 32_000 },
    tier85Start: { single: 34_000, marriedFilingJointly: 44_000 },
  },

  contributionLimits: {
    employee401k: 24_500,
    catchUp50: 8_000,
    superCatchUp60to63: 11_250,
    rothCatchUpWageThreshold: 150_000,
    ira: 7_500,
    iraCatchUp50: 1_100,
    hsaSelfOnly: 4_400,
    hsaFamily: 8_750,
    hsaCatchUp55: 1_000,
    section415cLimit: 72_000,
  },

  rmd: {
    uniformLifetimeTable: {
      72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0,
      79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0,
      86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8,
      93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8,
      100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9, 105: 4.6, 106: 4.3,
      107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4, 112: 3.3, 113: 3.1,
      114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0,
    },
    qcdAnnualLimit: 111_000,
  },

  annuities: {
    // SECURE 2.0 QLAC dollar cap: $200,000 (2024), indexed to $210,000 (2025).
    // The 2026 figure is not yet published; the last-confirmed 2025 cap stands
    // in (projected forward by inflation past the pack year like other indexed
    // limits). Source: IRS Notice / SECURE 2.0 Act §202.
    qlacPremiumCap: 210_000,
    // IRS Pub 939 Table V — Ordinary Life Annuities, One Life — expected-return
    // multiples (remaining life expectancy in years) by age at the annuity
    // starting date. Drives the non-qualified exclusion ratio (Pub 939 General
    // Rule). Source: IRS Publication 939, Table V.
    expectedReturnMultiples: {
      50: 33.1, 51: 32.2, 52: 31.3, 53: 30.4, 54: 29.5, 55: 28.6, 56: 27.7,
      57: 26.8, 58: 25.9, 59: 25.0, 60: 24.2, 61: 23.3, 62: 22.5, 63: 21.6,
      64: 20.8, 65: 20.0, 66: 19.2, 67: 18.4, 68: 17.6, 69: 16.8, 70: 16.0,
      71: 15.3, 72: 14.6, 73: 13.9, 74: 13.2, 75: 12.5, 76: 11.9, 77: 11.2,
      78: 10.6, 79: 10.0, 80: 9.5, 81: 8.9, 82: 8.4, 83: 7.9, 84: 7.4,
      85: 6.9, 86: 6.5, 87: 6.1, 88: 5.7, 89: 5.3, 90: 5.0, 91: 4.7, 92: 4.4,
      93: 4.1, 94: 3.9, 95: 3.7,
    },
  },

  hecm: {
    // HUD HECM principal-limit factors at a 5.875% expected rate, as published
    // for 2026 (percent of home value available as the initial principal
    // limit, by age of the youngest borrower). Planning default only — the UI
    // asks for the lender-quoted line size first. Primary authority: HUD's
    // HECM PLF tables (https://www.hud.gov/hud-partners/single-family-home-equity-conversion-mortgages,
    // published as spreadsheets by age × expected rate); values here are the
    // 2026 chart summarized at https://reverse.mortgage/age-requirements
    // (net of nothing — upfront costs are modeled separately via
    // upfrontCostPct). On refresh, prefer reading the HUD tables directly.
    principalLimitFactorPctByAge: {
      62: 35.1, 65: 37.2, 70: 40.9, 75: 43.8, 80: 48.2, 85: 54.4, 90: 61.4,
    },
    plfExpectedRatePct: 5.875,
    // Note rate near the 2026 expected rate + 0.5% annual MIP — the "~7–8%
    // growth at 2026 rates" planning figure (Pfau's buffer-asset articles).
    defaultGrowthRatePct: 7.5,
  },

  medicare: {
    partBStandardMonthly: 202.9,
    irmaaTiers: [
      // CMS 2026 Part D IRMAA surcharges by income tier.
      {
        magiOver: { single: 109_000, marriedFilingJointly: 218_000 },
        applicablePct: 35,
        partDSurchargeMonthly: 14.5,
      },
      {
        magiOver: { single: 137_000, marriedFilingJointly: 274_000 },
        applicablePct: 50,
        partDSurchargeMonthly: 37.5,
      },
      {
        magiOver: { single: 171_000, marriedFilingJointly: 342_000 },
        applicablePct: 65,
        partDSurchargeMonthly: 60.4,
      },
      {
        magiOver: { single: 205_000, marriedFilingJointly: 410_000 },
        applicablePct: 80,
        partDSurchargeMonthly: 83.3,
      },
      {
        magiOver: { single: 500_000, marriedFilingJointly: 750_000 },
        applicablePct: 85,
        partDSurchargeMonthly: 91.0,
      },
    ],
  },

  socialSecurity: {
    colaPct: 2.8,
    taxableWageBase: 184_500,
    earningsTestBelowFraAnnual: 24_480,
    earningsTestFraYearAnnual: 65_160,
    // SSDI Substantial Gainful Activity (non-blind), 2026. Source: SSA SGA.
    sgaMonthlyNonBlind: 1_620,
    // Employee-side OASDI payroll tax rate (statutory since 1990). Source: SSA.
    oasdiEmployeeRatePct: 6.2,
  },

  federalPovertyLine: {
    firstPerson: 15_650,
    perAdditionalPerson: 5_500,
  },

  aca: {
    // Indexed schedule for 2026 (enhanced credits expired 12/31/2025; cliff
    // restored). Verified against Rev. Proc. 2025-25 §3.01 (Applicable
    // Percentage Table for 2026): 2.10% below 133% FPL, then 3.14→4.19 (133–150),
    // 4.19→6.60 (150–200), 6.60→8.44 (200–250), 8.44→9.96 (250–300), 9.96 flat
    // through 400%.
    applicablePctBreakpoints: [
      // Flat 2.1% through 133% FPL, stepping to the 133–150 band (the step is
      // encoded as a 1-point ramp because the engine interpolates linearly).
      { fplPct: 0, applicablePct: 2.1 },
      { fplPct: 133, applicablePct: 2.1 },
      { fplPct: 134, applicablePct: 3.14 },
      { fplPct: 150, applicablePct: 4.19 },
      { fplPct: 200, applicablePct: 6.6 },
      { fplPct: 250, applicablePct: 8.44 },
      { fplPct: 300, applicablePct: 9.96 },
      { fplPct: 400, applicablePct: 9.96 },
    ],
    maxFplPctForCredit: 400,
  },
}
