/**
 * State income tax pack — all 50 states + DC ("big levers", V5 PR B).
 *
 * Transcribed from the cited per-state research docs in
 * DOCS/domain/state-tax-research/ (see each <CODE>.md for sources and the
 * simplifications each state's mapping makes). Values are latest-published
 * (≈2025) individual-income-tax figures; like the federal pack, nominal
 * brackets are carried forward for future years (bracket creep modeled).
 *
 * State taxable income in the engine starts from gross ordinary income (plus
 * gains, plus the federally taxable SS amount where the state taxes SS), minus
 * the retirement exclusion and the standard deduction below. For states that
 * tax *federal taxable income* and have no separate deduction (e.g. CO), the
 * standard deduction is set to the federal-equivalent so the gross→taxable
 * conversion matches; noted inline.
 */

import type { StateRetirementExclusion, StateTaxPack, StateTaxParams } from '../types.js'

type RawStateTaxParams = Omit<StateTaxParams, 'retirementPrivate' | 'retirementPublic'> & {
  retirement: StateRetirementExclusion
}
type RawStateTaxPack = Omit<StateTaxPack, 'states'> & { states: Record<string, RawStateTaxParams> }

const PUBLIC_PENSION_OVERRIDES: Record<string, StateRetirementExclusion> = {
  AL: { kind: 'full' },
  AR: { kind: 'full' },
  HI: { kind: 'full' },
  IN: { kind: 'full' },
  KS: { kind: 'full' },
  LA: { kind: 'full' },
  MA: { kind: 'full' },
  NE: { kind: 'full' },
  NY: { kind: 'full' },
  OH: { kind: 'full' },
  SC: { kind: 'full' },
}

function splitRetirementBuckets(raw: RawStateTaxPack): StateTaxPack {
  const states: Record<string, StateTaxParams> = {}
  for (const [code, { retirement, ...params }] of Object.entries(raw.states)) {
    states[code] = {
      ...params,
      retirementPrivate: retirement,
      retirementPublic: PUBLIC_PENSION_OVERRIDES[code] ?? retirement,
      // Without a separate public-pension law, the copied rule is one cap on
      // all retirement income — the engine must not grant it per bucket.
      retirementRuleShared: PUBLIC_PENSION_OVERRIDES[code] === undefined,
    }
  }
  return { year: raw.year, states }
}

const rawStateYear2026 = {
  year: 2026,
  states: {
    AL: {
      code: 'AL', name: 'Alabama', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 3000, marriedFilingJointly: 8500 },
      brackets: {
        single: [{ lowerBound: 0, ratePct: 2 }, { lowerBound: 500, ratePct: 4 }, { lowerBound: 3000, ratePct: 5 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 2 }, { lowerBound: 1000, ratePct: 4 }, { lowerBound: 6000, ratePct: 5 }],
      },
      retirement: { kind: 'capped', capPerPerson: 6000, minAge: 65 },
    },
    AK: {
      code: 'AK', name: 'Alaska', hasIncomeTax: false, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
      brackets: { single: [], marriedFilingJointly: [] }, retirement: { kind: 'none' },
    },
    AZ: {
      code: 'AZ', name: 'Arizona', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 15000, marriedFilingJointly: 30000 },
      brackets: { single: [{ lowerBound: 0, ratePct: 2.5 }], marriedFilingJointly: [{ lowerBound: 0, ratePct: 2.5 }] },
      retirement: { kind: 'none' },
    },
    AR: {
      code: 'AR', name: 'Arkansas', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 2410, marriedFilingJointly: 4820 },
      brackets: {
        single: [{ lowerBound: 0, ratePct: 2 }, { lowerBound: 4500, ratePct: 3.9 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 2 }, { lowerBound: 4500, ratePct: 3.9 }],
      },
      retirement: { kind: 'capped', capPerPerson: 6000 },
    },
    CA: {
      code: 'CA', name: 'California', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      capitalGainsNotes: 'Long-term capital gains are taxed at ordinary California rates; no preferential state rate modeled.',
      capitalGainsSources: [
        'DOCS/domain/state-tax-research/CA.md',
        'https://www.ftb.ca.gov/forms/2025/2025-540-tax-rate-schedules.pdf',
      ],
      standardDeduction: { single: 5540, marriedFilingJointly: 11080 },
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 1 }, { lowerBound: 11079, ratePct: 2 }, { lowerBound: 26264, ratePct: 4 },
          { lowerBound: 41452, ratePct: 6 }, { lowerBound: 57542, ratePct: 8 }, { lowerBound: 72724, ratePct: 9.3 },
          { lowerBound: 371479, ratePct: 10.3 }, { lowerBound: 445771, ratePct: 11.3 }, { lowerBound: 742953, ratePct: 12.3 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 1 }, { lowerBound: 22158, ratePct: 2 }, { lowerBound: 52528, ratePct: 4 },
          { lowerBound: 82904, ratePct: 6 }, { lowerBound: 115084, ratePct: 8 }, { lowerBound: 145448, ratePct: 9.3 },
          { lowerBound: 742958, ratePct: 10.3 }, { lowerBound: 891542, ratePct: 11.3 }, { lowerBound: 1485906, ratePct: 12.3 },
        ],
      },
      retirement: { kind: 'none' },
    },
    CO: {
      // Flat 4.4% on federal taxable income; no separate state deduction, so the
      // standard deduction is the federal-equivalent to convert gross→taxable.
      code: 'CO', name: 'Colorado', hasIncomeTax: true, taxesSocialSecurity: true, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 15750, marriedFilingJointly: 31500 },
      brackets: { single: [{ lowerBound: 0, ratePct: 4.4 }], marriedFilingJointly: [{ lowerBound: 0, ratePct: 4.4 }] },
      retirement: { kind: 'capped', capPerPerson: 24000, minAge: 65 },
    },
    CT: {
      code: 'CT', name: 'Connecticut', hasIncomeTax: true, taxesSocialSecurity: true, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 2 }, { lowerBound: 10000, ratePct: 4.5 }, { lowerBound: 50000, ratePct: 5.5 },
          { lowerBound: 100000, ratePct: 6 }, { lowerBound: 200000, ratePct: 6.5 }, { lowerBound: 250000, ratePct: 6.9 },
          { lowerBound: 500000, ratePct: 6.99 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 2 }, { lowerBound: 20000, ratePct: 4.5 }, { lowerBound: 100000, ratePct: 5.5 },
          { lowerBound: 200000, ratePct: 6 }, { lowerBound: 400000, ratePct: 6.5 }, { lowerBound: 500000, ratePct: 6.9 },
          { lowerBound: 1000000, ratePct: 6.99 },
        ],
      },
      retirement: { kind: 'full' }, // pension/IRA reach full exemption by 2026
    },
    DE: {
      code: 'DE', name: 'Delaware', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 5700, marriedFilingJointly: 11400 },
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 0 }, { lowerBound: 2000, ratePct: 2.2 }, { lowerBound: 5000, ratePct: 3.9 },
          { lowerBound: 10000, ratePct: 4.8 }, { lowerBound: 20000, ratePct: 5.2 }, { lowerBound: 25000, ratePct: 5.5 },
          { lowerBound: 60000, ratePct: 6.6 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 0 }, { lowerBound: 2000, ratePct: 2.2 }, { lowerBound: 5000, ratePct: 3.9 },
          { lowerBound: 10000, ratePct: 4.8 }, { lowerBound: 20000, ratePct: 5.2 }, { lowerBound: 25000, ratePct: 5.5 },
          { lowerBound: 60000, ratePct: 6.6 },
        ],
      },
      retirement: { kind: 'capped', capPerPerson: 12500, minAge: 60 },
    },
    DC: {
      code: 'DC', name: 'District of Columbia', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 15000, marriedFilingJointly: 30000 },
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 4 }, { lowerBound: 10000, ratePct: 6 }, { lowerBound: 40000, ratePct: 6.5 },
          { lowerBound: 60000, ratePct: 8.5 }, { lowerBound: 250000, ratePct: 9.25 }, { lowerBound: 500000, ratePct: 9.75 },
          { lowerBound: 1000000, ratePct: 10.75 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 4 }, { lowerBound: 10000, ratePct: 6 }, { lowerBound: 40000, ratePct: 6.5 },
          { lowerBound: 60000, ratePct: 8.5 }, { lowerBound: 250000, ratePct: 9.25 }, { lowerBound: 500000, ratePct: 9.75 },
          { lowerBound: 1000000, ratePct: 10.75 },
        ],
      },
      retirement: { kind: 'none' },
    },
    FL: {
      code: 'FL', name: 'Florida', hasIncomeTax: false, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
      brackets: { single: [], marriedFilingJointly: [] }, retirement: { kind: 'none' },
    },
    GA: {
      code: 'GA', name: 'Georgia', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 12000, marriedFilingJointly: 24000 },
      brackets: { single: [{ lowerBound: 0, ratePct: 5.39 }], marriedFilingJointly: [{ lowerBound: 0, ratePct: 5.39 }] },
      retirement: { kind: 'capped', capPerPerson: 65000, minAge: 65 },
    },
    HI: {
      code: 'HI', name: 'Hawaii', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 4400, marriedFilingJointly: 8800 },
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 1.4 }, { lowerBound: 9600, ratePct: 3.2 }, { lowerBound: 14400, ratePct: 5.5 },
          { lowerBound: 19200, ratePct: 6.4 }, { lowerBound: 24000, ratePct: 6.8 }, { lowerBound: 36000, ratePct: 7.2 },
          { lowerBound: 48000, ratePct: 7.6 }, { lowerBound: 125000, ratePct: 7.9 }, { lowerBound: 175000, ratePct: 8.25 },
          { lowerBound: 225000, ratePct: 9 }, { lowerBound: 275000, ratePct: 10 }, { lowerBound: 325000, ratePct: 11 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 1.4 }, { lowerBound: 19200, ratePct: 3.2 }, { lowerBound: 28800, ratePct: 5.5 },
          { lowerBound: 38400, ratePct: 6.4 }, { lowerBound: 48000, ratePct: 6.8 }, { lowerBound: 72000, ratePct: 7.2 },
          { lowerBound: 96000, ratePct: 7.6 }, { lowerBound: 250000, ratePct: 7.9 }, { lowerBound: 350000, ratePct: 8.25 },
          { lowerBound: 450000, ratePct: 9 }, { lowerBound: 550000, ratePct: 10 }, { lowerBound: 650000, ratePct: 11 },
        ],
      },
      retirement: { kind: 'none' },
    },
    ID: {
      code: 'ID', name: 'Idaho', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 15000, marriedFilingJointly: 30000 },
      brackets: {
        single: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 4811, ratePct: 5.3 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 9622, ratePct: 5.3 }],
      },
      retirement: { kind: 'none' },
    },
    IL: {
      code: 'IL', name: 'Illinois', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
      brackets: { single: [{ lowerBound: 0, ratePct: 4.95 }], marriedFilingJointly: [{ lowerBound: 0, ratePct: 4.95 }] },
      retirement: { kind: 'full' },
    },
    IN: {
      code: 'IN', name: 'Indiana', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
      brackets: { single: [{ lowerBound: 0, ratePct: 3 }], marriedFilingJointly: [{ lowerBound: 0, ratePct: 3 }] },
      retirement: { kind: 'none' },
    },
    IA: {
      code: 'IA', name: 'Iowa', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 15000, marriedFilingJointly: 30000 },
      brackets: { single: [{ lowerBound: 0, ratePct: 3.8 }], marriedFilingJointly: [{ lowerBound: 0, ratePct: 3.8 }] },
      retirement: { kind: 'full', minAge: 55 },
    },
    KS: {
      code: 'KS', name: 'Kansas', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 3605, marriedFilingJointly: 8240 },
      brackets: {
        single: [{ lowerBound: 0, ratePct: 5.2 }, { lowerBound: 23000, ratePct: 5.58 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 5.2 }, { lowerBound: 46000, ratePct: 5.58 }],
      },
      retirement: { kind: 'none' },
    },
    KY: {
      code: 'KY', name: 'Kentucky', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 3360, marriedFilingJointly: 6720 },
      brackets: { single: [{ lowerBound: 0, ratePct: 3.5 }], marriedFilingJointly: [{ lowerBound: 0, ratePct: 3.5 }] },
      retirement: { kind: 'capped', capPerPerson: 31110 },
    },
    LA: {
      code: 'LA', name: 'Louisiana', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 12500, marriedFilingJointly: 25000 },
      brackets: { single: [{ lowerBound: 0, ratePct: 3 }], marriedFilingJointly: [{ lowerBound: 0, ratePct: 3 }] },
      retirement: { kind: 'capped', capPerPerson: 12000, minAge: 65 },
    },
    ME: {
      code: 'ME', name: 'Maine', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 15000, marriedFilingJointly: 30000 },
      brackets: {
        single: [{ lowerBound: 0, ratePct: 5.8 }, { lowerBound: 26800, ratePct: 6.75 }, { lowerBound: 63450, ratePct: 7.15 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 5.8 }, { lowerBound: 53600, ratePct: 6.75 }, { lowerBound: 126900, ratePct: 7.15 }],
      },
      retirement: { kind: 'capped', capPerPerson: 48216 },
    },
    MD: {
      code: 'MD', name: 'Maryland', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 3350, marriedFilingJointly: 6700 },
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 2 }, { lowerBound: 1000, ratePct: 3 }, { lowerBound: 2000, ratePct: 4 },
          { lowerBound: 3000, ratePct: 4.75 }, { lowerBound: 100000, ratePct: 5 }, { lowerBound: 125000, ratePct: 5.25 },
          { lowerBound: 150000, ratePct: 5.5 }, { lowerBound: 250000, ratePct: 5.75 }, { lowerBound: 500000, ratePct: 6.25 },
          { lowerBound: 1000000, ratePct: 6.5 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 2 }, { lowerBound: 1000, ratePct: 3 }, { lowerBound: 2000, ratePct: 4 },
          { lowerBound: 3000, ratePct: 4.75 }, { lowerBound: 150000, ratePct: 5 }, { lowerBound: 175000, ratePct: 5.25 },
          { lowerBound: 225000, ratePct: 5.5 }, { lowerBound: 300000, ratePct: 5.75 }, { lowerBound: 600000, ratePct: 6.25 },
          { lowerBound: 1200000, ratePct: 6.5 },
        ],
      },
      retirement: { kind: 'capped', capPerPerson: 41200, minAge: 65 },
    },
    MA: {
      code: 'MA', name: 'Massachusetts', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
      brackets: { single: [{ lowerBound: 0, ratePct: 5 }], marriedFilingJointly: [{ lowerBound: 0, ratePct: 5 }] },
      retirement: { kind: 'none' },
    },
    MI: {
      code: 'MI', name: 'Michigan', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
      brackets: { single: [{ lowerBound: 0, ratePct: 4.25 }], marriedFilingJointly: [{ lowerBound: 0, ratePct: 4.25 }] },
      retirement: { kind: 'capped', capPerPerson: 49423 },
    },
    MN: {
      code: 'MN', name: 'Minnesota', hasIncomeTax: true, taxesSocialSecurity: true, capitalGainsAsOrdinary: true,
      capitalGainsNotes: 'Long-term capital gains are taxed as ordinary income; high-income NIIT-like surtax omitted.',
      capitalGainsSources: ['DOCS/domain/state-tax-research/MN.md', 'https://www.revenue.state.mn.us/'],
      standardDeduction: { single: 14575, marriedFilingJointly: 29150 },
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 5.35 }, { lowerBound: 31690, ratePct: 6.8 }, { lowerBound: 104090, ratePct: 7.85 },
          { lowerBound: 193240, ratePct: 9.85 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 5.35 }, { lowerBound: 46330, ratePct: 6.8 }, { lowerBound: 184040, ratePct: 7.85 },
          { lowerBound: 321450, ratePct: 9.85 },
        ],
      },
      retirement: { kind: 'none' },
    },
    MS: {
      code: 'MS', name: 'Mississippi', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 2300, marriedFilingJointly: 4600 },
      brackets: {
        single: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 10000, ratePct: 4.4 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 10000, ratePct: 4.4 }],
      },
      retirement: { kind: 'full' },
    },
    MO: {
      code: 'MO', name: 'Missouri', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 15750, marriedFilingJointly: 31500 },
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 0 }, { lowerBound: 1313, ratePct: 2 }, { lowerBound: 2626, ratePct: 2.5 },
          { lowerBound: 3939, ratePct: 3 }, { lowerBound: 5252, ratePct: 3.5 }, { lowerBound: 6565, ratePct: 4 },
          { lowerBound: 7878, ratePct: 4.5 }, { lowerBound: 9191, ratePct: 4.7 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 0 }, { lowerBound: 1313, ratePct: 2 }, { lowerBound: 2626, ratePct: 2.5 },
          { lowerBound: 3939, ratePct: 3 }, { lowerBound: 5252, ratePct: 3.5 }, { lowerBound: 6565, ratePct: 4 },
          { lowerBound: 7878, ratePct: 4.5 }, { lowerBound: 9191, ratePct: 4.7 },
        ],
      },
      retirement: { kind: 'capped', capPerPerson: 6000 },
    },
    MT: {
      code: 'MT', name: 'Montana', hasIncomeTax: true, taxesSocialSecurity: true, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 15750, marriedFilingJointly: 31500 },
      brackets: {
        single: [{ lowerBound: 0, ratePct: 4.7 }, { lowerBound: 20500, ratePct: 5.9 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 4.7 }, { lowerBound: 41000, ratePct: 5.9 }],
      },
      retirement: { kind: 'none' },
    },
    NE: {
      code: 'NE', name: 'Nebraska', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 8600, marriedFilingJointly: 17200 },
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 2.46 }, { lowerBound: 4030, ratePct: 3.51 }, { lowerBound: 24120, ratePct: 5.01 },
          { lowerBound: 38870, ratePct: 5.2 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 2.46 }, { lowerBound: 8040, ratePct: 3.51 }, { lowerBound: 48250, ratePct: 5.01 },
          { lowerBound: 77730, ratePct: 5.2 },
        ],
      },
      retirement: { kind: 'none' },
    },
    NV: {
      code: 'NV', name: 'Nevada', hasIncomeTax: false, taxesSocialSecurity: false, capitalGainsAsOrdinary: false,
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
      brackets: { single: [], marriedFilingJointly: [] }, retirement: { kind: 'none' },
    },
    NH: {
      // Wages/retirement never taxed; interest & dividends tax repealed from 2025.
      code: 'NH', name: 'New Hampshire', hasIncomeTax: false, taxesSocialSecurity: false, capitalGainsAsOrdinary: false,
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
      brackets: { single: [], marriedFilingJointly: [] }, retirement: { kind: 'none' },
    },
    NJ: {
      code: 'NJ', name: 'New Jersey', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      capitalGainsNotes: 'Capital gains are included in New Jersey gross income and taxed at ordinary NJ rates.',
      capitalGainsSources: ['DOCS/domain/state-tax-research/NJ.md', 'https://www.nj.gov/treasury/taxation/'],
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 1.4 }, { lowerBound: 20000, ratePct: 1.75 }, { lowerBound: 35000, ratePct: 3.5 },
          { lowerBound: 40000, ratePct: 5.525 }, { lowerBound: 75000, ratePct: 6.37 }, { lowerBound: 500000, ratePct: 8.97 },
          { lowerBound: 1000000, ratePct: 10.75 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 1.4 }, { lowerBound: 20000, ratePct: 1.75 }, { lowerBound: 50000, ratePct: 2.45 },
          { lowerBound: 70000, ratePct: 3.5 }, { lowerBound: 80000, ratePct: 5.525 }, { lowerBound: 150000, ratePct: 6.37 },
          { lowerBound: 500000, ratePct: 8.97 }, { lowerBound: 1000000, ratePct: 10.75 },
        ],
      },
      retirement: { kind: 'capped', capPerPerson: 50000, minAge: 62 },
    },
    NM: {
      code: 'NM', name: 'New Mexico', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 15750, marriedFilingJointly: 31500 },
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 1.5 }, { lowerBound: 5500, ratePct: 3.2 }, { lowerBound: 16500, ratePct: 4.3 },
          { lowerBound: 33500, ratePct: 4.7 }, { lowerBound: 66500, ratePct: 4.9 }, { lowerBound: 210000, ratePct: 5.9 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 1.5 }, { lowerBound: 8000, ratePct: 3.2 }, { lowerBound: 25000, ratePct: 4.3 },
          { lowerBound: 50000, ratePct: 4.7 }, { lowerBound: 100000, ratePct: 4.9 }, { lowerBound: 315000, ratePct: 5.9 },
        ],
      },
      retirement: { kind: 'none' },
    },
    NY: {
      code: 'NY', name: 'New York', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 8000, marriedFilingJointly: 16050 },
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 4 }, { lowerBound: 8500, ratePct: 4.5 }, { lowerBound: 11700, ratePct: 5.25 },
          { lowerBound: 13900, ratePct: 5.5 }, { lowerBound: 80650, ratePct: 6 }, { lowerBound: 215400, ratePct: 6.85 },
          { lowerBound: 1077550, ratePct: 9.65 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 4 }, { lowerBound: 17150, ratePct: 4.5 }, { lowerBound: 23600, ratePct: 5.25 },
          { lowerBound: 27900, ratePct: 5.5 }, { lowerBound: 161550, ratePct: 6 }, { lowerBound: 323200, ratePct: 6.85 },
          { lowerBound: 2155350, ratePct: 9.65 },
        ],
      },
      retirement: { kind: 'capped', capPerPerson: 20000, minAge: 59 },
    },
    NC: {
      code: 'NC', name: 'North Carolina', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 12750, marriedFilingJointly: 25500 },
      brackets: { single: [{ lowerBound: 0, ratePct: 4.25 }], marriedFilingJointly: [{ lowerBound: 0, ratePct: 4.25 }] },
      retirement: { kind: 'none' },
    },
    ND: {
      // Brackets defined on federal taxable income; std deduction ≈ federal base.
      code: 'ND', name: 'North Dakota', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 15000, marriedFilingJointly: 30000 },
      brackets: {
        single: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 48475, ratePct: 1.95 }, { lowerBound: 244825, ratePct: 2.5 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 80975, ratePct: 1.95 }, { lowerBound: 298075, ratePct: 2.5 }],
      },
      retirement: { kind: 'none' },
    },
    OH: {
      code: 'OH', name: 'Ohio', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
      brackets: {
        single: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 26050, ratePct: 2.75 }, { lowerBound: 100000, ratePct: 3.5 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 26050, ratePct: 2.75 }, { lowerBound: 100000, ratePct: 3.5 }],
      },
      retirement: { kind: 'none' },
    },
    OK: {
      code: 'OK', name: 'Oklahoma', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 6350, marriedFilingJointly: 12700 },
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 0.25 }, { lowerBound: 1000, ratePct: 0.75 }, { lowerBound: 2500, ratePct: 1.75 },
          { lowerBound: 3750, ratePct: 2.75 }, { lowerBound: 4900, ratePct: 3.75 }, { lowerBound: 7200, ratePct: 4.75 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 0.25 }, { lowerBound: 2000, ratePct: 0.75 }, { lowerBound: 5000, ratePct: 1.75 },
          { lowerBound: 7500, ratePct: 2.75 }, { lowerBound: 9800, ratePct: 3.75 }, { lowerBound: 14400, ratePct: 4.75 },
        ],
      },
      retirement: { kind: 'capped', capPerPerson: 10000 },
    },
    OR: {
      code: 'OR', name: 'Oregon', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 2835, marriedFilingJointly: 5670 },
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 4.75 }, { lowerBound: 4050, ratePct: 6.75 }, { lowerBound: 10200, ratePct: 8.75 },
          { lowerBound: 125000, ratePct: 9.9 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 4.75 }, { lowerBound: 8100, ratePct: 6.75 }, { lowerBound: 20400, ratePct: 8.75 },
          { lowerBound: 250000, ratePct: 9.9 },
        ],
      },
      retirement: { kind: 'none' },
    },
    PA: {
      code: 'PA', name: 'Pennsylvania', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      capitalLossCarryforwardConformity: 'currentYearOnly',
      capitalGainsNotes: 'Net gains are taxable at the flat PA rate; federal prior-year capital-loss carryforwards are not modeled as PA offsets.',
      capitalGainsSources: ['DOCS/domain/state-tax-research/PA.md', 'https://www.revenue.pa.gov/'],
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
      brackets: { single: [{ lowerBound: 0, ratePct: 3.07 }], marriedFilingJointly: [{ lowerBound: 0, ratePct: 3.07 }] },
      retirement: { kind: 'full', minAge: 60 },
    },
    RI: {
      code: 'RI', name: 'Rhode Island', hasIncomeTax: true, taxesSocialSecurity: true, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 10900, marriedFilingJointly: 21800 },
      brackets: {
        single: [{ lowerBound: 0, ratePct: 3.75 }, { lowerBound: 79900, ratePct: 4.75 }, { lowerBound: 181650, ratePct: 5.99 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 3.75 }, { lowerBound: 79900, ratePct: 4.75 }, { lowerBound: 181650, ratePct: 5.99 }],
      },
      retirement: { kind: 'capped', capPerPerson: 20000, minAge: 67 },
    },
    SC: {
      code: 'SC', name: 'South Carolina', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 15000, marriedFilingJointly: 30000 },
      brackets: {
        single: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 3560, ratePct: 3 }, { lowerBound: 17830, ratePct: 6 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 3560, ratePct: 3 }, { lowerBound: 17830, ratePct: 6 }],
      },
      retirement: { kind: 'capped', capPerPerson: 10000, minAge: 65 },
    },
    SD: {
      code: 'SD', name: 'South Dakota', hasIncomeTax: false, taxesSocialSecurity: false, capitalGainsAsOrdinary: false,
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
      brackets: { single: [], marriedFilingJointly: [] }, retirement: { kind: 'none' },
    },
    TN: {
      code: 'TN', name: 'Tennessee', hasIncomeTax: false, taxesSocialSecurity: false, capitalGainsAsOrdinary: false,
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
      brackets: { single: [], marriedFilingJointly: [] }, retirement: { kind: 'none' },
    },
    TX: {
      code: 'TX', name: 'Texas', hasIncomeTax: false, taxesSocialSecurity: false, capitalGainsAsOrdinary: false,
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
      brackets: { single: [], marriedFilingJointly: [] }, retirement: { kind: 'none' },
    },
    UT: {
      code: 'UT', name: 'Utah', hasIncomeTax: true, taxesSocialSecurity: true, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
      brackets: { single: [{ lowerBound: 0, ratePct: 4.5 }], marriedFilingJointly: [{ lowerBound: 0, ratePct: 4.5 }] },
      retirement: { kind: 'none' },
    },
    VT: {
      code: 'VT', name: 'Vermont', hasIncomeTax: true, taxesSocialSecurity: true, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 7400, marriedFilingJointly: 14850 },
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 3.35 }, { lowerBound: 47900, ratePct: 6.6 }, { lowerBound: 116000, ratePct: 7.6 },
          { lowerBound: 242000, ratePct: 8.75 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 3.35 }, { lowerBound: 79950, ratePct: 6.6 }, { lowerBound: 193300, ratePct: 7.6 },
          { lowerBound: 294600, ratePct: 8.75 },
        ],
      },
      retirement: { kind: 'none' },
    },
    VA: {
      code: 'VA', name: 'Virginia', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 8750, marriedFilingJointly: 17500 },
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 2 }, { lowerBound: 3000, ratePct: 3 }, { lowerBound: 5000, ratePct: 5 },
          { lowerBound: 17000, ratePct: 5.75 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 2 }, { lowerBound: 3000, ratePct: 3 }, { lowerBound: 5000, ratePct: 5 },
          { lowerBound: 17000, ratePct: 5.75 },
        ],
      },
      retirement: { kind: 'capped', capPerPerson: 12000, minAge: 65 },
    },
    WA: {
      // No broad income tax; a 7% tax on large long-term gains is out of scope.
      code: 'WA', name: 'Washington', hasIncomeTax: false, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
      brackets: { single: [], marriedFilingJointly: [] }, retirement: { kind: 'none' },
    },
    WV: {
      // Social Security fully exempt from 2026 (phase-out complete).
      code: 'WV', name: 'West Virginia', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 2.22 }, { lowerBound: 10000, ratePct: 2.96 }, { lowerBound: 25000, ratePct: 3.33 },
          { lowerBound: 40000, ratePct: 4.44 }, { lowerBound: 60000, ratePct: 4.82 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 2.22 }, { lowerBound: 10000, ratePct: 2.96 }, { lowerBound: 25000, ratePct: 3.33 },
          { lowerBound: 40000, ratePct: 4.44 }, { lowerBound: 60000, ratePct: 4.82 },
        ],
      },
      retirement: { kind: 'capped', capPerPerson: 8000, minAge: 65 },
    },
    WI: {
      code: 'WI', name: 'Wisconsin', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 13560, marriedFilingJointly: 25110 },
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 3.5 }, { lowerBound: 14680, ratePct: 4.4 }, { lowerBound: 50480, ratePct: 5.3 },
          { lowerBound: 323290, ratePct: 7.65 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 3.5 }, { lowerBound: 19580, ratePct: 4.4 }, { lowerBound: 67300, ratePct: 5.3 },
          { lowerBound: 431060, ratePct: 7.65 },
        ],
      },
      retirement: { kind: 'capped', capPerPerson: 24000, minAge: 67 },
    },
    WY: {
      code: 'WY', name: 'Wyoming', hasIncomeTax: false, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
      brackets: { single: [], marriedFilingJointly: [] }, retirement: { kind: 'none' },
    },
  },
} satisfies RawStateTaxPack

export const stateYear2026: StateTaxPack = splitRetirementBuckets(rawStateYear2026)
