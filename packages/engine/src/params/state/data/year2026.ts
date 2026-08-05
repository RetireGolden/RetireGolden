/**
 * State income tax pack — all 50 states + DC ("big levers", V5 PR B).
 *
 * Transcribed from the cited per-state research docs in
 * DOCS/domain/state-tax-research/ (see each <CODE>.md for sources and the
 * simplifications each state's mapping makes). Values are the published 2026
 * figures where a state has legislated 2026 changes (swept against the Tax
 * Foundation 2026 tables + state DOR pages, 2026-07-16), otherwise
 * latest-published (≈2025) figures carried forward; like the federal pack,
 * nominal brackets are carried forward for future years (bracket creep
 * modeled). States on legislated rate ramps (GA, IN, MS, MT, NE, NC, OK) are
 * commented inline — never hold those forward at refresh time. North Dakota
 * and Arkansas join them for a different reason and with the same instruction:
 * both states index by statute and publish the result. N.D.C.C.
 * 57-38-30.3(1)(g) makes the tax commissioner publish a cost-of-living-adjusted
 * schedule that applies in lieu of the statutory one every year, so the ND
 * thresholds are a published figure that moves annually rather than a statutory
 * one that holds; A.C.A. 26-51-201(d)(1) says the same of Arkansas's brackets
 * and 26-51-430(c) of its standard deduction, so BOTH of those AR figures are
 * published rather than statutory and DFA prints next year's in the AR1000ES
 * each autumn.
 *
 * States whose standard deduction conforms to (or proxies) the FEDERAL
 * standard deduction — CO, DC, IA, ID, MO, MT, ND, NM — carry the federal
 * pack's figure for the same year ($16,100/$32,200 for 2026) and are tagged
 * `standardDeductionConformity: 'federal'`. That tag is load-bearing, not
 * documentation: IRC 63(c)(7)(B)(ii) raises the federal amount every year
 * after 2025 and the engine projects it forward, so a copy left frozen at the
 * pack year would disagree with the original inside one projected year. ME and
 * SC decoupled from the federal deduction for 2026 (ME §5124-C 1-B; SC H.4216)
 * and carry their own published amounts, so they are deliberately untagged.
 * Arizona left that list on 2026-08-05: A.R.S. §43-1041(A) sets Arizona's own
 * dollar amounts and (H) borrows only the federal indexation METHOD, so the
 * identity between the two was administrative practice rather than a rule of
 * Arizona law, and the tag was additionally attaching an IRC 63(c)(3) age-65
 * addition Arizona does not grant. Only the deduction is tagged — state
 * BRACKETS stay nominal for every state (see ../index.ts).
 *
 * State taxable income in the engine starts from gross ordinary income (plus
 * gains, plus the federally taxable SS amount where the state taxes SS), minus
 * the retirement exclusion and the standard deduction below. For states that
 * tax *federal taxable income* and have no separate deduction (CO and ND), the
 * standard deduction is set to the federal-equivalent so the gross→taxable
 * conversion matches; noted inline. Those two are the strongest case for the
 * tag, not an exception to it: the field there IS the federal deduction under
 * another name, so freezing it would leave federal taxable income computed two
 * different ways in the same year.
 */

import type { StateRetirementExclusion, StateTaxPack, StateTaxParams } from '../types.js'

type RawStateTaxParams = Omit<StateTaxParams, 'retirementPrivate' | 'retirementPublic'> & {
  retirement: StateRetirementExclusion
}
type RawStateTaxPack = Omit<StateTaxPack, 'states'> & { states: Record<string, RawStateTaxParams> }

const PUBLIC_PENSION_OVERRIDES: Record<string, StateRetirementExclusion> = {
  AL: { kind: 'full' },
  // Arizona subtracts uniformed-services retired and retainer pay in full
  // (A.R.S. 43-1022(26)(c), from tax year 2021) and grants federal, Arizona
  // state and Arizona local government pensions $2,500 per taxpayer
  // (43-1022(2)). The bucket is one flag, so `full` is exact for the military
  // case and too generous for the civil-service one — registered as
  // `ars-43-1022-2-government-pension-exclusion`. Being in this map is also
  // what keeps `retirementRuleShared` false, which is correct for Arizona:
  // 43-1022's subtractions are independent paragraphs, and no paragraph
  // reaches a private pension or an IRA at all.
  AZ: { kind: 'full' },
  // Arkansas is deliberately NOT here. Only uniformed-services retirement is
  // fully exempt (A.C.A. 26-51-307(e)); an APERS, ATRS, county, municipal,
  // police or fire pension sits inside 26-51-307(a)(1)'s "public or private
  // employment-related retirement systems, plans, or programs" and gets the
  // same $6,000 as a private pension. Absence from this map gives Arkansas
  // that $6,000 in both buckets and sets `retirementRuleShared`, which is what
  // 26-51-307(b)(1)(B)'s single per-taxpayer ceiling requires. The residual
  // over-charge on a military pension is registered as
  // `aca-26-51-307-e-uniformed-services-full-exemption`.
  HI: { kind: 'full' },
  IN: { kind: 'full' },
  KS: { kind: 'full' },
  LA: { kind: 'full' },
  MA: { kind: 'full' },
  // North Dakota subtracts retired military personnel benefits in full
  // (N.D.C.C. 57-38-30.3(2)(r)) and retired peace-officer benefits in full at
  // twenty years' service or a medical retirement ((2)(t)). It subtracts no
  // other public pension: a federal civil-service annuity or a state PERS
  // pension is taxed like any other retirement income there. The bucket is one
  // flag, so `full` is exact for the two categories the statute names and too
  // generous for the rest — registered as
  // `ndcc-57-38-30-3-2-closed-subtraction-list`.
  ND: { kind: 'full' },
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
      // `capitalGainsAsOrdinary: false` here, as for every no-income-tax state
      // except Washington. The field is inert once `hasIncomeTax` is false —
      // `computeStateTaxableIncome` returns zero before reading it — but it is
      // not invisible: `capitalGainsTaxablePct` defaults from it, and the
      // relocation drill-down shows that percentage to a user. `true` would
      // have printed "100% of your capital gain is in Alaska's base" beside a
      // state that has no base, which is worse than meaningless.
      //
      // Alaska, Florida and Wyoming carried `true` and Nevada, New Hampshire,
      // South Dakota, Tennessee and Texas carried `false`, with nothing marking
      // the difference as deliberate. It was not. Washington keeps `true`
      // deliberately and is left alone: it is the one state here that really
      // does tax long-term gains, and its 7% excise is out of scope rather than
      // absent — see its own note. Changing it on the strength of a tidying
      // pass, without research, is what this comment exists to prevent.
      code: 'AK', name: 'Alaska', hasIncomeTax: false, taxesSocialSecurity: false, capitalGainsAsOrdinary: false,
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
      brackets: { single: [], marriedFilingJointly: [] }, retirement: { kind: 'none' },
    },
    AZ: {
      // The deduction below is ARIZONA's own published figure and carries no
      // conformity tag. A.R.S. 43-1041(A) prescribes Arizona amounts and (H)
      // borrows only the federal INFLATION METHOD, so nothing in Title 43
      // adopts the federal dollar amount — and the tag's other consequence,
      // the IRC 63(c)(3) age-65 addition, is relief Arizona does not grant at
      // all. Its age-65 provision is 43-1023(E)'s flat, unindexed $2,100 per
      // person, taken above the deduction line. 15,750 / 31,500 are the 2025
      // amounts, the latest Arizona has published; the department publishes no
      // 2026 figures yet, so this is the only Arizona-sourced number available
      // for the pack year. Registered as
      // `ars-43-1041-standard-deduction-published-amount` and
      // `ars-43-1023-e-age-65-exemption`.
      code: 'AZ', name: 'Arizona', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      capitalGainsTaxablePct: 75,
      capitalGainsNotes: 'A.R.S. 43-1022(22)(c) subtracts twenty-five percent of net long-term capital gain from an asset acquired after December 31, 2011, so seventy-five percent of that gain reaches the flat 2.5% rate. The acquisition-date condition is not modeled: gain on a pre-2012 asset, and gain whose acquisition date cannot be verified, is taxed by Arizona in full.',
      capitalGainsSources: [
        'DOCS/domain/state-tax-research/AZ.md',
        'https://www.azleg.gov/ars/43/01022.htm',
        'https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140Booklet.pdf',
      ],
      standardDeduction: { single: 15750, marriedFilingJointly: 31500 },
      brackets: { single: [{ lowerBound: 0, ratePct: 2.5 }], marriedFilingJointly: [{ lowerBound: 0, ratePct: 2.5 }] },
      retirement: { kind: 'none' },
    },
    AR: {
      // The thresholds below are DFA's PUBLISHED 2026 schedule (2026 Form
      // AR1000ES Tax Rate Schedule), not the amounts printed in the Code.
      // A.C.A. 26-51-201(d)(1) makes the Secretary prescribe indexed tables
      // annually that apply "in lieu of" the statutory ones, and 26-51-430(c)
      // does the same for the standard deduction, so Arkansas belongs with the
      // legislated-ramp states above: never hold either forward at refresh
      // time. The 0 / 4,500 pair this entry used to carry was the un-indexed
      // 26-51-201(a)(3)(B) schedule, which by its own terms reaches only
      // filers above roughly $94,700 of net income.
      code: 'AR', name: 'Arkansas', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      capitalGainsTaxablePct: 50,
      capitalGainsNotes: 'A.C.A. 26-51-815(b)(2)(C) exempts fifty percent of net capital gain, so half of it reaches ordinary Arkansas rates (Form AR1000D line 8). Not modeled: (b)(3) exempts net capital gain above $10,000,000 in full, and Arkansas taxes net SHORT-term gain without the fifty percent exclusion (Form AR1000D lines 11 and 12).',
      capitalGainsSources: [
        'DOCS/domain/state-tax-research/AR.md',
        'https://arkleg.state.ar.us/Acts/FTPDocument?path=%2FACTS%2F2015R%2FPublic%2F&file=1173.pdf&ddBienniumSession=2015%2F2015R',
        'https://www.dfa.arkansas.gov/wp-content/uploads/2025_AR1000D_CapitalGains.pdf',
      ],
      standardDeduction: { single: 2470, marriedFilingJointly: 4940 },
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 0 }, { lowerBound: 5600, ratePct: 2 }, { lowerBound: 11200, ratePct: 3 },
          { lowerBound: 16000, ratePct: 3.4 }, { lowerBound: 26400, ratePct: 3.9 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 0 }, { lowerBound: 5600, ratePct: 2 }, { lowerBound: 11200, ratePct: 3 },
          { lowerBound: 16000, ratePct: 3.4 }, { lowerBound: 26400, ratePct: 3.9 },
        ],
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
      standardDeduction: { single: 16100, marriedFilingJointly: 32200 }, standardDeductionConformity: 'federal',
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
      standardDeduction: { single: 16100, marriedFilingJointly: 32200 }, standardDeductionConformity: 'federal',
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
      // `false` per the AK note above. Fla. Const. art. VII § 5(a) reaches "the
      // income of natural persons" generally, which a gains tax would be.
      code: 'FL', name: 'Florida', hasIncomeTax: false, taxesSocialSecurity: false, capitalGainsAsOrdinary: false,
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
      brackets: { single: [], marriedFilingJointly: [] }, retirement: { kind: 'none' },
    },
    GA: {
      // 2026 vintage per GA DOR "Important Tax Updates" (accessed 2026-07-15):
      // flat 4.99% and $15,000/$30,000 standard deductions. (2025 was cut
      // retroactively from 5.39% to 5.19%; 2026 continues the ramp to 4.99%.)
      code: 'GA', name: 'Georgia', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 15000, marriedFilingJointly: 30000 },
      brackets: { single: [{ lowerBound: 0, ratePct: 4.99 }], marriedFilingJointly: [{ lowerBound: 0, ratePct: 4.99 }] },
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
      standardDeduction: { single: 16100, marriedFilingJointly: 32200 }, standardDeductionConformity: 'federal',
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
      // Legislated ramp: 3.0% (2025) -> 2.95% (2026) -> 2.9% (2027). Re-verify annually.
      code: 'IN', name: 'Indiana', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
      brackets: { single: [{ lowerBound: 0, ratePct: 2.95 }], marriedFilingJointly: [{ lowerBound: 0, ratePct: 2.95 }] },
      retirement: { kind: 'none' },
    },
    IA: {
      code: 'IA', name: 'Iowa', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 16100, marriedFilingJointly: 32200 }, standardDeductionConformity: 'federal',
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
      // 2026 per MRS revised schedule (2026-05-20): ME decoupled from the
      // federal standard deduction (36 M.R.S. §5124-C 1-B) — own $15,700/
      // $31,400 amounts — and added a 2% surcharge on taxable income over
      // $1M single / $1.5M MFJ, encoded as an equivalent 9.15% top bracket.
      code: 'ME', name: 'Maine', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 15700, marriedFilingJointly: 31400 },
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 5.8 }, { lowerBound: 27400, ratePct: 6.75 }, { lowerBound: 64850, ratePct: 7.15 },
          { lowerBound: 1000000, ratePct: 9.15 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 5.8 }, { lowerBound: 54850, ratePct: 6.75 }, { lowerBound: 129750, ratePct: 7.15 },
          { lowerBound: 1500000, ratePct: 9.15 },
        ],
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
      // Legislated ramp: 4.4% (2025) -> 4.0% (2026), with further cuts scheduled. Re-verify annually.
      code: 'MS', name: 'Mississippi', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 2300, marriedFilingJointly: 4600 },
      brackets: {
        single: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 10000, ratePct: 4 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 10000, ratePct: 4 }],
      },
      retirement: { kind: 'full' },
    },
    MO: {
      // HB 594 (signed 2025-07-10): individuals deduct 100% of federally
      // reported capital gains from TY2025 on — MO no longer taxes gains.
      code: 'MO', name: 'Missouri', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: false,
      capitalGainsNotes: 'HB 594 (2025) fully exempts individual capital gains (short- and long-term) from Missouri income tax from tax year 2025 onward.',
      capitalGainsSources: [
        'DOCS/domain/state-tax-research/MO.md',
        'https://dor.mo.gov/news/newsitem/uuid/15044650-59dd-48f4-975a-01988d485255',
      ],
      standardDeduction: { single: 16100, marriedFilingJointly: 32200 }, standardDeductionConformity: 'federal',
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 0 }, { lowerBound: 1348, ratePct: 2 }, { lowerBound: 2696, ratePct: 2.5 },
          { lowerBound: 4044, ratePct: 3 }, { lowerBound: 5392, ratePct: 3.5 }, { lowerBound: 6740, ratePct: 4 },
          { lowerBound: 8088, ratePct: 4.5 }, { lowerBound: 9436, ratePct: 4.7 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 0 }, { lowerBound: 1348, ratePct: 2 }, { lowerBound: 2696, ratePct: 2.5 },
          { lowerBound: 4044, ratePct: 3 }, { lowerBound: 5392, ratePct: 3.5 }, { lowerBound: 6740, ratePct: 4 },
          { lowerBound: 8088, ratePct: 4.5 }, { lowerBound: 9436, ratePct: 4.7 },
        ],
      },
      retirement: { kind: 'capped', capPerPerson: 6000 },
    },
    MT: {
      // HB 337 (2025): 2026 = 4.7%/5.65% at 47,500/95,000; 2027 steps again to
      // 4.7%/5.4% at 65,000/130,000 (MT DOR, accessed 2026-07-16). Re-verify annually.
      code: 'MT', name: 'Montana', hasIncomeTax: true, taxesSocialSecurity: true, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 16100, marriedFilingJointly: 32200 }, standardDeductionConformity: 'federal',
      brackets: {
        single: [{ lowerBound: 0, ratePct: 4.7 }, { lowerBound: 47500, ratePct: 5.65 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 4.7 }, { lowerBound: 95000, ratePct: 5.65 }],
      },
      retirement: { kind: 'none' },
    },
    NE: {
      // LB 754 ramp: top 5.2% (2025) -> 4.55% (2026, brackets consolidated to
      // three) -> 3.99% (2027). Re-verify annually.
      code: 'NE', name: 'Nebraska', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 8850, marriedFilingJointly: 17700 },
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 2.46 }, { lowerBound: 4130, ratePct: 3.51 }, { lowerBound: 24760, ratePct: 4.55 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 2.46 }, { lowerBound: 8250, ratePct: 3.51 }, { lowerBound: 49530, ratePct: 4.55 },
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
      standardDeduction: { single: 16100, marriedFilingJointly: 32200 }, standardDeductionConformity: 'federal',
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
      // 2025 budget middle-class cuts effective 2026: the five brackets through
      // 6% each drop 10bp (4->3.9, 4.5->4.4, 5.25->5.15, 5.5->5.4, 6->5.9).
      // The 10.3%/10.9% brackets at $5M/$25M remain omitted (out of the
      // planner's audience range; see NY.md).
      code: 'NY', name: 'New York', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 8000, marriedFilingJointly: 16050 },
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 3.9 }, { lowerBound: 8500, ratePct: 4.4 }, { lowerBound: 11700, ratePct: 5.15 },
          { lowerBound: 13900, ratePct: 5.4 }, { lowerBound: 80650, ratePct: 5.9 }, { lowerBound: 215400, ratePct: 6.85 },
          { lowerBound: 1077550, ratePct: 9.65 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 3.9 }, { lowerBound: 17150, ratePct: 4.4 }, { lowerBound: 23600, ratePct: 5.15 },
          { lowerBound: 27900, ratePct: 5.4 }, { lowerBound: 161550, ratePct: 5.9 }, { lowerBound: 323200, ratePct: 6.85 },
          { lowerBound: 2155350, ratePct: 9.65 },
        ],
      },
      retirement: { kind: 'capped', capPerPerson: 20000, minAge: 59 },
    },
    NC: {
      // Statutory ramp: 4.25% (2025) -> 3.99% (2026), with revenue-triggered
      // cuts possible after. Re-verify annually.
      code: 'NC', name: 'North Carolina', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 12750, marriedFilingJointly: 25500 },
      brackets: { single: [{ lowerBound: 0, ratePct: 3.99 }], marriedFilingJointly: [{ lowerBound: 0, ratePct: 3.99 }] },
      retirement: { kind: 'none' },
    },
    ND: {
      // Brackets defined on federal taxable income; std deduction ≈ federal base.
      //
      // The thresholds below are the commissioner's PUBLISHED 2026 schedules
      // (2026 Forms ND-1 and ND-EZ Tax Rate Schedules, Form ND-1ES), not the
      // 2023 amounts printed in the Century Code. N.D.C.C. 57-38-30.3(1)(g)
      // requires a cost-of-living-adjusted schedule to be published "in lieu
      // of" the statutory one every year, so North Dakota belongs with the
      // legislated-ramp states above: never hold these forward at refresh time,
      // re-read the schedule the department publishes for the new pack year.
      code: 'ND', name: 'North Dakota', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      capitalGainsTaxablePct: 60,
      capitalGainsNotes: 'N.D.C.C. 57-38-30.3(2)(d)(1) reduces North Dakota taxable income by forty percent of net long-term capital gain over net short-term capital loss, so sixty percent of the gain reaches a rate. The parallel forty-percent exclusion for qualified dividends in (2)(d)(2) has no field in this pack and is not modeled.',
      capitalGainsSources: [
        'DOCS/domain/state-tax-research/ND.md',
        'https://ndlegis.gov/cencode/t57c38.pdf',
        'https://www.tax.nd.gov/sites/www/files/documents/forms/individual/2025-iit/2025-individual-income-tax-booklet.pdf',
      ],
      standardDeduction: { single: 16100, marriedFilingJointly: 32200 }, standardDeductionConformity: 'federal',
      brackets: {
        single: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 49575, ratePct: 1.95 }, { lowerBound: 250400, ratePct: 2.5 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 82800, ratePct: 1.95 }, { lowerBound: 304850, ratePct: 2.5 }],
      },
      retirement: { kind: 'none' },
    },
    OH: {
      // 2025 budget flattening complete: from 2026 a single 2.75% rate applies
      // above the $26,050 zero bracket (the 3.5% bracket is eliminated).
      code: 'OH', name: 'Ohio', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
      brackets: {
        single: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 26050, ratePct: 2.75 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 26050, ratePct: 2.75 }],
      },
      retirement: { kind: 'none' },
    },
    OK: {
      // HB 2764 (2025): six brackets collapsed to three from 2026 — 0% replaces
      // the old sub-2.75% bands, then 2.5/3.5/4.5 (top down from 4.75%), with a
      // stated path to further cuts. Re-verify annually.
      code: 'OK', name: 'Oklahoma', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 6350, marriedFilingJointly: 12700 },
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 0 }, { lowerBound: 3750, ratePct: 2.5 }, { lowerBound: 4900, ratePct: 3.5 },
          { lowerBound: 7200, ratePct: 4.5 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 0 }, { lowerBound: 7500, ratePct: 2.5 }, { lowerBound: 9800, ratePct: 3.5 },
          { lowerBound: 14400, ratePct: 4.5 },
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
      // H.4216 (signed 2026-03-30) rewrote TY2026: SCIAD deduction of
      // $15,000/$30,000 replaces the federal deduction (its AGI phase-out is
      // not modeled), and "5.21% minus $966 at/above $30,000" is exactly the
      // graduated pair below (1.99% x 30,000 gap = 966). Revenue-triggered
      // further cuts are legislated — re-verify annually via SCDOR news.
      code: 'SC', name: 'South Carolina', hasIncomeTax: true, taxesSocialSecurity: false, capitalGainsAsOrdinary: true,
      standardDeduction: { single: 15000, marriedFilingJointly: 30000 },
      brackets: {
        single: [{ lowerBound: 0, ratePct: 1.99 }, { lowerBound: 30000, ratePct: 5.21 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 1.99 }, { lowerBound: 30000, ratePct: 5.21 }],
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
      // `false` per the AK note above. Wyoming's whole income tax chapter is
      // one preemption section; there is nothing for a gain to be ordinary to.
      code: 'WY', name: 'Wyoming', hasIncomeTax: false, taxesSocialSecurity: false, capitalGainsAsOrdinary: false,
      standardDeduction: { single: 0, marriedFilingJointly: 0 },
      brackets: { single: [], marriedFilingJointly: [] }, retirement: { kind: 'none' },
    },
  },
} satisfies RawStateTaxPack

export const stateYear2026: StateTaxPack = splitRetirementBuckets(rawStateYear2026)
