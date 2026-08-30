/**
 * State records for the Midwest: IL, IN, IA, KS, MI, MN, MO, NE, ND, OH, SD, WI.
 *
 * One slice of the tax rule registry. `../taxRuleRegistry.ts` composes every
 * slice into `TAX_RULE_REGISTRY`; read it for what a record must carry and why.
 * Records and the commentary attached to them were moved here verbatim, so a
 * block that says "above" or "below" may now point across a module boundary.
 */
import type { TaxRuleRecord } from '../taxRuleRegistry.js'

// `satisfies` without `as const`, matching the composed registry: keys and the
// union-typed fields (classification, kind, volatility) stay literal for
// describeRule's conditional typing, while the prose strings widen to `string`.
export const midwestStateRecords = {
  // ---------------------------------------------------------------------------
  // State rules.
  //
  // The engine has computed a state figure for all fifty states and the District
  // of Columbia since the V5 pack shipped, and until now not one of those figures
  // had a record here. The twelve states below are the first slice: the ones
  // whose pack entry turns on a provision a reader would otherwise have to take
  // on trust — why North Dakota carries the FEDERAL standard deduction while
  // Maine must not, why Pennsylvania alone is `currentYearOnly` on capital
  // losses, why Illinois excludes retirement income with no age test at all, and
  // which three states the pack calls `hasIncomeTax: false` on constitutional
  // rather than legislative grounds.
  //
  // On `effectiveFrom`: where the cited text states its own operative date, that
  // date is used. Where it does not — a state code section carries no inline
  // effective date the way an IRC amendment note does — the field is set to 2026,
  // the year the text was read and the year the pack models. That is a year the
  // rule governs but is generally NOT the first one, and it is deliberately the
  // conservative direction: a rule recorded as starting later than it did
  // understates its reach into years this engine never projects, whereas a
  // guessed early year would be an unsourced claim in a registry whose whole
  // point is that it makes none.
  // ---------------------------------------------------------------------------

  'ndcc-57-38-30-3-federal-taxable-income-base': {
    title: 'North Dakota taxable income is federal taxable income, adjusted',
    statement:
      'North Dakota does not build a base of its own. Its brackets run on federal taxable income as computed under the Internal Revenue Code, adjusted by an enumerated list of state adjustments, so the federal standard deduction has already been subtracted before a North Dakota rate is ever applied. The pack therefore carries the federal figure in `standardDeduction` and tags it `standardDeductionConformity: \'federal\'`; the tag is what converts the engine\'s gross base into the federal-taxable-income base the statute names, and it is why the figure has to move with the federal one that IRC 63(c)(7)(B)(ii) raises each year rather than staying frozen at the pack year.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:ND',
    authority: [{
      kind: 'statute',
      citation: 'N.D.C.C. 57-38-30.3(2)',
      url: 'https://ndlegis.gov/cencode/t57c38.pdf',
      quotedText:
        'For purposes of this section, "North Dakota taxable income" means the federal taxable income of an individual, estate, or trust as computed under the Internal Revenue Code of 1986, as amended, adjusted as follows:',
    }, {
      kind: 'statute',
      citation: 'N.D.C.C. 57-38-30.3(1)',
      url: 'https://ndlegis.gov/cencode/t57c38.pdf',
      quotedText:
        'Provided, that for purposes of this section, any person required to file a state income tax return under this chapter, but who has not computed a federal taxable income figure, shall compute a federal taxable income figure using a pro forma return in order to determine a federal taxable income figure to be used as a starting point in computing state income tax under this section.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/params/state/index.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.ND',
      'packages/engine/src/params/state/index.ts#conformStateStandardDeduction',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ndcc-57-38-30-3-2-d-long-term-gain-exclusion': {
    title: 'North Dakota excludes 40% of net long-term capital gain',
    statement:
      'North Dakota taxable income is reduced by forty percent of the excess of net long-term capital gain over net short-term capital loss, so only sixty percent of a retiree\'s long-term gain reaches a North Dakota rate. The pack now says so: `capitalGainsTaxablePct: 60`, which the calculator reads in preference to the 100 percent that `capitalGainsAsOrdinary: true` would otherwise default to — the sixty percent that does reach the base is still taxed at ordinary North Dakota rates, which is what that flag continues to assert. This record was `approximated` until 2026-08-05, when the field was set; the reclassification is the whole content of the change. The forty-percent exclusion for qualified dividends in the SAME subdivision is still not modelled and is registered separately as `ndcc-57-38-30-3-2-d-2-qualified-dividend-exclusion`, so the gap that survives is pinned rather than folded into a record that no longer describes one.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:ND',
    authority: [{
      kind: 'statute',
      citation: 'N.D.C.C. 57-38-30.3(2)(d)',
      url: 'https://ndlegis.gov/cencode/t57c38.pdf',
      quotedText:
        'Reduced by forty percent of: (1) The excess of the taxpayer\'s net long-term capital gain for the taxable year over the net short-term capital loss for that year, as computed for purposes of the Internal Revenue Code of 1986, as amended. The adjustment provided by this subdivision is allowed only to the extent the net long-term capital gain is allocated to this state.',
    }, {
      // The department's own arithmetic for the subdivision, which is what
      // makes 60 rather than 40 the number the pack carries: the worksheet
      // computes the amount SUBTRACTED, so the share that stays in the base is
      // its complement.
      kind: 'formInstruction',
      citation: '2025 Form ND-1 instructions, Worksheet For Net Long-Term Capital Gain Exclusion (Form ND-1, line 6), line 8',
      url: 'https://www.tax.nd.gov/sites/www/files/documents/forms/individual/2025-iit/2025-individual-income-tax-booklet.pdf',
      quotedText: 'Multiply line 7 by 40% (.40). Enter this amount on Form ND-1, line 6',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#ND.capitalGainsTaxablePct',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'il-ita-203-a-2-F-retirement-income-subtraction': {
    title: 'Illinois subtracts retirement income with no age condition',
    statement:
      'Illinois base income deducts every amount included in federal adjusted gross income under IRC 402(a), 402(c), 403(a), 403(b), 406(a), 407(a) and 408 — qualified plan and IRA distributions — together with governmental retirement plan distributions and retirement payments to retired partners. The subparagraph states no age, no dollar cap, and no retirement-status condition, which is why the pack is `{ kind: \'full\' }` with no `minAge` and why an Illinois plan shows no state tax on a withdrawal taken years before any other state would exempt it.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:IL',
    authority: [{
      kind: 'statute',
      citation: '35 ILCS 5/203(a)(2)(F)',
      url: 'https://www.ilga.gov/Legislation/ilcs/documents/003500050K203.htm',
      quotedText:
        'An amount equal to all amounts included in such total pursuant to the provisions of Sections 402(a), 402(c), 403(a), 403(b), 406(a), 407(a), and 408 of the Internal Revenue Code, or included in such total as distributions under the provisions of any retirement or disability plan for employees of any governmental agency or unit, or retirement payments to retired partners, which payments are excluded in computing net earnings from self employment by Section 1402 of the Internal Revenue Code and regulations adopted pursuant thereto;',
    }, {
      kind: 'statute',
      citation: '35 ILCS 5/203(a)(2)',
      url: 'https://www.ilga.gov/Legislation/ilcs/documents/003500050K203.htm',
      quotedText:
        'and by deducting from the total so obtained the sum of the following amounts:',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#IL',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'mo-rsmo-143-121-capital-gain-deduction': {
    title: 'Missouri subtracts 100% of an individual’s capital gains',
    statement:
      'From tax years beginning on or after January 1, 2025 Missouri subtracts from federal adjusted gross income one hundred percent of all income reported as a capital gain for federal purposes by an individual. Missouri is consequently the only state in the pack that levies an income tax and still carries `capitalGainsAsOrdinary: false`, which defaults the included share of modeled net capital gain to zero.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:MO',
    authority: [{
      kind: 'statute',
      citation: 'Mo. Rev. Stat. 143.121.3(14)(a)',
      url: 'https://revisor.mo.gov/main/OneSection.aspx?section=143.121',
      quotedText:
        'For all tax years beginning on or after January 1, 2025, one hundred percent of all income reported as a capital gain for federal income tax purposes by an individual subject to tax pursuant to section 143.011; and',
    }, {
      kind: 'statute',
      citation: 'Mo. Rev. Stat. 143.121.3',
      url: 'https://revisor.mo.gov/main/OneSection.aspx?section=143.121',
      quotedText:
        'There shall be subtracted from the taxpayer\'s federal adjusted gross income the following amounts to the extent included in federal adjusted gross income:',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2025,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#MO',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'iowa-code-422-7-19-a-retirement-income-exclusion': {
    title: 'Iowa excludes retirement income from age 55',
    statement:
      'Iowa subtracts the TOTAL amount received from a governmental or other pension or retirement plan — defined benefit and defined contribution plans, annuities, IRAs, employer and self-employed plans, and deferred compensation — by a person who is disabled, fifty-five years of age or older, or a qualifying survivor. There is no dollar ceiling, which is why the pack is `{ kind: \'full\', minAge: 55 }` rather than a capped exclusion, and fifty-five rather than an older threshold. The disability and survivor limbs are not modelled: `minAge` is the only condition the pack can express.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:IA',
    authority: [{
      kind: 'statute',
      citation: 'Iowa Code 422.7(19)(a)',
      url: 'https://www.legis.iowa.gov/docs/code/422.7.pdf',
      quotedText:
        'Subtract, to the extent included, the total amount received from a governmental or other pension or retirement plan, including defined benefit or defined contribution plans, annuities, individual retirement accounts, plans maintained or contributed to by an employer, or maintained or contributed to by a self-employed person as an employer, and deferred compensation plans or any earnings attributable to the deferred compensation plans received by a person who is any of the following: (1) Disabled. (2) Fifty-five years of age or older. (3) The surviving spouse of an individual or a survivor having an insurable interest in an individual who would have qualified for the exemption under this subsection for the tax year.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#IA',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  // ---------------------------------------------------------------------------
  // North Dakota, second pass — 2026-08-05.
  //
  // The first slice above registered two North Dakota rules and left the state's
  // pack entry describing a taxpayer North Dakota law does not have: 2025
  // brackets in a 2026 pack, the whole long-term gain in the base, and no
  // retirement subtraction of any kind. A primary-source pass over N.D.C.C.
  // ch. 57-38 and the department's published forms found four more operative
  // provisions and one over-reach the correction itself introduces. All of them
  // are recorded here, in one block, because they were researched together and
  // rest on the same two publishers.
  //
  // Two things about the citations are worth stating once rather than repeating
  // on each record. First, the lettering moved: H.B. 1031 of the 69th Assembly
  // (2025) relettered subsection 2, so the military-retirement subtraction is
  // now (2)(r), Social Security is now (2)(s), and retired law enforcement is
  // now (2)(t). The enrolled bills below amended those provisions under their
  // FORMER letters, which is why an enacting bill and the current Century Code
  // cite different subdivisions for the same rule. The citations name the
  // provision as the source being quoted letters it.
  //
  // Second, ndlegis.gov cannot establish a 2026 bracket threshold and never
  // will. The Century Code prints the 2023 dollar amounts H.B. 1158 enacted;
  // 57-38-30.3(1)(g) then requires the tax commissioner to publish a
  // cost-of-living-adjusted schedule that applies in lieu of them, and the
  // department is the only publisher of that schedule. So the rate-schedule
  // record below is the first in this registry whose operative numbers can only
  // come from a revenue department, which is what makes the ND entry in the
  // conformance suite's state publisher tier load-bearing rather than
  // decorative.
  // ---------------------------------------------------------------------------

  'ndcc-57-38-30-3-1-g-commissioner-indexed-rate-schedule': {
    title: 'North Dakota’s operative brackets are the commissioner’s indexed schedule',
    statement:
      'North Dakota taxes North Dakota taxable income at 0 percent, 1.95 percent and 2.50 percent, but the dollar thresholds those rates turn on are not the ones printed in the Century Code. 57-38-30.3(1)(g) directs the tax commissioner to prescribe cost-of-living-adjusted schedules that apply IN LIEU OF the printed ones, holding each rate fixed, so the operative schedule for any year is whatever the department published for that year. For 2026 that is single 0 / 49,575 / 250,400 and married-filing-jointly 0 / 82,800 / 304,850, which is what the pack carries. A pack that holds a prior year’s schedule forward taxes income at 1.95 percent that North Dakota puts in the zero bracket, which is why the pack file lists North Dakota among the states whose thresholds must be re-read from the publisher at every refresh rather than carried forward. What is quoted from the schedule is the department’s own printed run of taxed bands for each filing status, leader dots and all, rather than a tidied table: a rate schedule is a two-dimensional layout, and a single-string rendering that reads as prose would be a reflow of the layout rather than a quotation of the text.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:ND',
    authority: [{
      kind: 'statute',
      citation: 'N.D.C.C. 57-38-30.3(1)(g)',
      url: 'https://ndlegis.gov/cencode/t57c38.pdf',
      quotedText:
        'The tax commissioner shall prescribe new rate schedules that apply in lieu of the schedules set forth in subdivisions a through e. The new schedules must be determined by increasing the minimum and maximum dollar amounts for each income bracket for which a tax is imposed by the cost-of-living adjustment for the taxable year as determined by the secretary of the United States treasury for purposes of section 1(f) of the United States Internal Revenue Code of 1954, as amended. For this purpose, the rate applicable to each income bracket may not be changed, and the manner of applying the cost-of-living adjustment must be the same as that used for adjusting the income brackets for federal income tax purposes.',
    }, {
      kind: 'legislativeHistory',
      citation: '2023 N.D. H.B. 1158 (enrolled), § 8',
      url: 'https://ndlegis.gov/assembly/68-2023/regular/documents/23-0351-06000.pdf',
      quotedText:
        'SECTION 8. EFFECTIVE DATE. Sections 1 and 4 of this Act are effective for taxable years beginning after December 31, 2022.',
    }, {
      // The two taxed bands of the Single schedule, as one contiguous run of
      // the form's own text. The leader dots are reproduced because they are
      // what the document prints between a threshold and its rate; deleting
      // them to make the quote read as a sentence would be retyping the source.
      // The zero band is not quoted separately — its upper bound is the 49,575
      // that opens this run, so it is stated rather than duplicated.
      kind: 'formInstruction',
      citation: '2026 Forms ND-1 and ND-EZ Tax Rate Schedules (Form ND-1ES), Single',
      url: 'https://www.tax.nd.gov/sites/www/files/documents/forms/individual/2025-iit/28709-form-nd-1es-2026.pdf',
      quotedText:
        '49,575 250,400.......... 0.00 + 1.95% of amount over $ 49,575 250,400.....................3,916.09 + 2.50% of amount over 250,400',
    }, {
      kind: 'formInstruction',
      citation: '2026 Forms ND-1 and ND-EZ Tax Rate Schedules (Form ND-1ES), Married filing jointly and Qualifying surviving spouse',
      url: 'https://www.tax.nd.gov/sites/www/files/documents/forms/individual/2025-iit/28709-form-nd-1es-2026.pdf',
      quotedText:
        '82,800 304,850........... 0.00 + 1.95% of amount over $ 82,800 304,850........................ 4,329.98 + 2.50% of amount over 304,850',
    }],
    // `annuallyIndexed` and not `staticStatute`: the rates are fixed by statute
    // but the thresholds are republished every year by the department, so this
    // record goes stale on the autumn schedule with the federal COLA figures
    // rather than on the annual statutory pass.
    volatility: 'annuallyIndexed',
    effectiveFrom: 2023,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.ND',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetail',
    ],
  },

  'ndcc-57-38-30-3-2-s-social-security-subtraction': {
    title: 'North Dakota subtracts every federally taxable Social Security dollar',
    statement:
      'North Dakota taxable income is reduced by the amount of Social Security benefits included in the taxpayer’s federal adjusted gross income under IRC 86. There is no income test, no age condition and no cap on that subtraction. The qualifier matters because there used to be one: H.B. 1174 of 2019 created the subtraction only for taxpayers with federal adjusted gross income of 50,000 dollars or less, or 100,000 dollars if married filing jointly, and S.B. 2351 of the November 2021 special session struck those thresholds for taxable years beginning after December 31, 2020. A reader working from a pre-2021 summary would build an income phase-out the statute no longer has, which is why the enrolled amendment is quoted here alongside the current text. The pack expresses the current rule as `taxesSocialSecurity: false`, so no Social Security dollar reaches a North Dakota rate at any income level.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:ND',
    authority: [{
      kind: 'statute',
      citation: 'N.D.C.C. 57-38-30.3(2)(s)',
      url: 'https://ndlegis.gov/cencode/t57c38.pdf',
      quotedText:
        'Reduced by the amount of social security benefits included in a taxpayer\'s federal adjusted gross income under section 86 of the Internal Revenue Code.',
    }, {
      // Quoted exactly as the enrolled PDF's text layer renders it. The bill
      // sets the amendment in strike-through and underline, and extraction
      // interleaves the struck and inserted words into 'reducedReduced by anthe
      // amount equal toof'. Reconstructing which words were struck would be a
      // paraphrase of the markup; the run-together rendering is what the
      // document actually contains, and it is legible enough to show that the
      // adjusted-gross-income clause ahead of it was removed rather than moved.
      kind: 'legislativeHistory',
      citation: '2021 N.D. S.B. 2351 (special session, enrolled), § 2, amending former subdivision t',
      url: 'https://ndlegis.gov/assembly/67-2021/special/documents/21-1097-02000.pdf',
      quotedText:
        't. For taxpayers with federal adjusted gross income of fifty thousand dollars or less, or one hundred thousand dollars or less if married filing jointly, reducedReduced by anthe amount equal toof social security benefits included in a taxpayer\'s federal adjusted gross income under section 86 of the Internal Revenue Code.',
    }, {
      kind: 'legislativeHistory',
      citation: '2021 N.D. S.B. 2351 (special session, enrolled), § 3',
      url: 'https://ndlegis.gov/assembly/67-2021/special/documents/21-1097-02000.pdf',
      quotedText:
        'SECTION 3. EFFECTIVE DATE. This Act is effective for taxable years beginning after December 31, 2020.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2021,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.ND',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ndcc-57-38-30-3-2-r-military-retirement-exclusion': {
    title: 'North Dakota excludes retired military personnel benefits in full',
    statement:
      'North Dakota taxable income is reduced by the whole amount a taxpayer receives as retired military personnel benefits, including benefits paid to the surviving spouse of a deceased retired member of the armed forces, a reserve component, or the national guard, to the extent the amount was included in federal taxable income. The exclusion carries no cap, no age condition and no income phase-out, so a North Dakota military retiree pays nothing to the state on the pension itself. The pack expresses it by listing ND in `PUBLIC_PENSION_OVERRIDES` as `{ kind: \'full\' }`, which also stops `retirementRuleShared` from copying the public rule onto private retirement income — private pensions and traditional IRA and 401(k) distributions stay fully taxable, which is the other half of North Dakota law and is registered as `ndcc-57-38-30-3-2-closed-subtraction-list`.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:ND',
    authority: [{
      kind: 'statute',
      citation: 'N.D.C.C. 57-38-30.3(2)(r)',
      url: 'https://ndlegis.gov/cencode/t57c38.pdf',
      quotedText:
        'Reduced by the amount received by a taxpayer as retired military personnel benefits, including retired military personnel benefits paid to the surviving spouse of a deceased retired member of the armed forces of the United States, a reserve component of the armed forces of the United States, or the national guard, but only to the extent the amount was included in federal taxable income.',
    }, {
      kind: 'legislativeHistory',
      citation: '2019 N.D. H.B. 1053 (enrolled), § 2',
      url: 'https://ndlegis.gov/assembly/66-2019/regular/documents/19-0357-02000.pdf',
      quotedText:
        'SECTION 2. EFFECTIVE DATE. This Act is effective for taxable years beginning after December 31, 2018.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2019,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#PUBLIC_PENSION_OVERRIDES',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'ndcc-57-38-30-3-2-t-retired-peace-officer-exclusion': {
    title: 'North Dakota excludes retired law enforcement personnel benefits in full',
    statement:
      'North Dakota taxable income is reduced by the whole amount of retired law enforcement personnel benefits received by a taxpayer who has served a combined total of at least twenty years as a peace officer, or who medically retired from those duties under a medical certificate for a permanent disability, to the extent included in federal taxable income. What qualifies is retirement income attributable to the taxpayer’s employment as a peace officer, from a plan maintained by or through the employer they retired from. It is the second uncapped, un-age-tested public-retirement exclusion North Dakota grants, and it is the other reason the pack sets the public bucket to `{ kind: \'full\' }` rather than modelling the military exclusion alone. The engine holds no years-of-service fact, so the twenty-year condition is not tested — that over-reach is registered as `ndcc-57-38-30-3-2-closed-subtraction-list`, not here.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:ND',
    authority: [{
      kind: 'statute',
      citation: 'N.D.C.C. 57-38-30.3(2)(t)',
      url: 'https://ndlegis.gov/cencode/t57c38.pdf',
      quotedText:
        'Reduced by the amount of retired law enforcement personnel benefits received by a taxpayer who has served a combined total of at least twenty years as a peace officer or has medically retired from the taxpayer\'s duties as a peace officer with a medical certificate due to a permanent mental or physical disability that rendered the taxpayer unable to discharge the taxpayer\'s duties as a peace officer, but only to the extent the amount was included in federal taxable income.',
    }, {
      kind: 'statute',
      citation: 'N.D.C.C. 57-38-30.3(2)(t)(2)',
      url: 'https://ndlegis.gov/cencode/t57c38.pdf',
      quotedText:
        '"Retired law enforcement personnel benefits" means retirement income received by a taxpayer eligible to receive retirement income attributable to the taxpayer\'s employment as a peace officer from a retirement plan maintained by or through the employer from which the taxpayer retired as a peace officer.',
    }, {
      kind: 'legislativeHistory',
      citation: '2023 N.D. S.B. 2147 (enrolled), § 2',
      url: 'https://ndlegis.gov/assembly/68-2023/regular/documents/23-0019-03000.pdf',
      quotedText:
        'SECTION 2. EFFECTIVE DATE. This Act is effective for taxable years beginning after December 31, 2022.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2023,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#PUBLIC_PENSION_OVERRIDES',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'ndcc-57-38-30-3-2-closed-subtraction-list': {
    title: 'North Dakota subtracts no retirement income beyond the two it names',
    statement:
      'The adjustments that turn federal taxable income into North Dakota taxable income are the closed enumeration of 57-38-30.3(2), subdivisions a through t. Two of them reach retirement income — retired military personnel benefits under (2)(r) and retired law enforcement personnel benefits under (2)(t) — and nothing in the list reaches a private pension, an annuity, a traditional IRA or 401(k) distribution, a federal civil-service annuity, or a state or local government pension. Subdivision (a), the nearest thing to a general exclusion, reaches only income exempt from state taxation under a federal statute or a constitutional provision, which a civil-service annuity is not. The engine gets the private half right and the public half wrong: `retirementPrivate` is `{ kind: \'none\' }`, but `retirementPublic` is one flag covering every public pension the input model can carry, so setting it to `{ kind: \'full\' }` for the sake of (2)(r) and (2)(t) also exempts a North Dakota retiree’s CSRS, FERS, PERS or teachers’ pension, which North Dakota taxes in full. The same single flag is why the twenty-year service condition in (2)(t) is not tested. The error runs toward the taxpayer: a North Dakota household whose public pension is civil rather than uniformed is shown a state tax lower than it owes, and the gap is the whole pension at the marginal rate the household would otherwise reach.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale: null,
    jurisdiction: 'state:ND',
    authority: [{
      kind: 'statute',
      citation: 'N.D.C.C. 57-38-30.3(2)',
      url: 'https://ndlegis.gov/cencode/t57c38.pdf',
      quotedText:
        'For purposes of this section, "North Dakota taxable income" means the federal taxable income of an individual, estate, or trust as computed under the Internal Revenue Code of 1986, as amended, adjusted as follows:',
    }, {
      kind: 'statute',
      citation: 'N.D.C.C. 57-38-30.3(2)(a)',
      url: 'https://ndlegis.gov/cencode/t57c38.pdf',
      quotedText:
        'Reduced by interest income from obligations of the United States and income exempt from state income tax under federal statute or United States or North Dakota constitutional provisions.',
    }, {
      // What the department itself enumerates on the return: a line for
      // Railroad Retirement Board benefits, which are exempt under a federal
      // statute and so ride on (2)(a), and a line each for the peace-officer
      // and military exclusions. There is no line for a civil-service annuity,
      // which is the shape of the negative this record rests on.
      kind: 'formInstruction',
      citation: '2025 Form ND-1 instructions, Line 8 — U.S. Railroad Retirement Board benefits',
      url: 'https://www.tax.nd.gov/sites/www/files/documents/forms/individual/2025-iit/2025-individual-income-tax-booklet.pdf',
      quotedText:
        'Enter on this line the portion of any unemployment, sick pay, or retirement benefits received from the U.S. Railroad Retirement Board that are taxable on your federal income tax return.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2023,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/state/types.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#PUBLIC_PENSION_OVERRIDES',
      'packages/engine/src/params/state/types.ts#StateRetirementExclusion',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ndcc-57-38-30-3-2-d-2-qualified-dividend-exclusion': {
    title: 'North Dakota excludes 40% of qualified dividends',
    statement:
      'The same subdivision that excludes forty percent of net long-term capital gain excludes forty percent of qualified dividends as defined by IRC 1(h)(11), provided they were taxed federally at a rate below the ordinary rates; if they were not, the reduction is thirty percent of all dividends included in federal taxable income. The department states the arithmetic directly in the Form ND-1 line 13 instruction. Not modelled: `StateTaxParams` has a single included-share field and it governs capital gains, so `qualifiedDividends` enters the North Dakota base at one hundred percent with no field able to say otherwise. The engine therefore charges a North Dakota retiree living on a dividend portfolio more than the statute does, every year, on every qualified dividend. Adding a field is a pack-shape change rather than a data correction, which is why the gap is registered rather than closed here.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:ND',
    authority: [{
      // The Century Code PDF renders the citation inside this quote with a gap
      // — 'section 1(h) (11)' — under both layout and raw pdftotext extraction.
      // It is reproduced that way rather than closed up to the conventional
      // '1(h)(11)', because tidying a citation is still retyping it.
      kind: 'statute',
      citation: 'N.D.C.C. 57-38-30.3(2)(d)(2)',
      url: 'https://ndlegis.gov/cencode/t57c38.pdf',
      quotedText:
        'Qualified dividends as defined under Internal Revenue Code section 1(h) (11), added by section 302(a) of the Jobs and Growth Tax Relief Reconciliation Act of 2003 [Pub. L. 108-27; 117 Stat. 752; 2 U.S.C. 963 et seq.], but only if taxed at a federal income tax rate that is lower than the regular federal income tax rates applicable to ordinary income. If, for any taxable year, qualified dividends are taxed at the regular federal income tax rates applicable to ordinary income, the reduction allowed under this subdivision is equal to thirty percent of all dividends included in federal taxable income.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Form ND-1 instructions, Line 13 — Qualified dividend exclusion',
      url: 'https://www.tax.nd.gov/sites/www/files/documents/forms/individual/2025-iit/2025-individual-income-tax-booklet.pdf',
      quotedText:
        'If you were a full-year resident of North Dakota during the tax year, multiply the qualified dividends from Form 1040 or 1040-SR, line 3a, by 40 percent and enter the result.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/types.ts',
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#ND.capitalGainsTaxablePct',
      'packages/engine/src/params/state/data/year2026.ts#states.ND',
      'packages/engine/src/params/state/types.ts#StateTaxParams',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'sd-no-individual-income-tax': {
    title: 'South Dakota levies no individual income tax, and could',
    statement:
      'South Dakota imposes no income tax on individuals, so no wage, capital gain, Social Security benefit, pension, or IRA or 401(k) distribution reaches a South Dakota rate — which the pack encodes as `hasIncomeTax: false`. The second half of the title is the part a reader needs. The absence is statutory and nothing more: article XI, section 2 of the South Dakota Constitution expressly EMPOWERS the Legislature to impose taxes upon incomes, and to graduate them, and the Legislature has simply never done it. So unlike Nevada, Texas and Alaska, South Dakota is one ordinary session away from changing, and this record belongs on the annual re-verification list for that reason rather than out of routine.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:SD',
    authority: [{
      // The load-bearing citation, and the reason `stateAgencyPublication`
      // exists. There is no South Dakota Codified Laws chapter to quote — the
      // claim IS that none exists — so the only affirmative text stating the
      // negative is the department's own. It is not corroboration here; it is
      // the authority.
      kind: 'stateAgencyPublication',
      citation: 'S.D. Dept. of Revenue, Individuals — Taxes, "Income Tax"',
      url: 'https://dor.sd.gov/individuals/taxes/',
      quotedText: 'South Dakota is one of seven states that does not impose a state income tax.',
    }, {
      // Reads like a contradiction and is the opposite. It is quoted so this
      // record cannot be mistaken for a constitutional prohibition, which is
      // exactly what a reader who had just read the Nevada and Texas records
      // would otherwise assume of a neighbouring "no income tax" entry.
      kind: 'statute',
      citation: 'S.D. Const. art. XI, § 2',
      url: 'https://sdsos.gov/general-information/about-state-south-dakota/docs/2024%20South%20Dakota%20Constitution.pdf',
      quotedText:
        'The Legislature is empowered to impose taxes upon incomes and occupations, and taxes upon incomes may be graduated and progressive and reasonable exemptions may be provided.',
    }],
    volatility: 'staticStatute',
    // The pack year on purpose. When South Dakota last levied an individual
    // income tax, or whether it ever did, was not established from a primary
    // source, and "never" would be an unsourced claim in a registry whose point
    // is that it makes none. South Dakota Codified Laws are not served to any
    // non-browser client from a .gov host, so the code was never read
    // section-by-section and this record does not claim it was.
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#SD',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  // ---------------------------------------------------------------------------
  // Indiana — 2026-08-05.
  //
  // Indiana needs THREE publishers where every other state here needed one or
  // two, and the third is the one nobody would guess.
  //
  // The statute is on `iga.in.gov`, but not at the address a citation would
  // naturally carry. `iga.in.gov/laws/2026/ic/titles/6/...` is the human-facing
  // route, and it is client-side: there is no server-rendered statutory text on
  // it at all. The machine-readable Indiana Code lives at
  // `iga.in.gov/ic/{year}/Title_{n}/Article_{a}/Chapter_{c}.pdf`, a path that
  // appears nowhere on the site. Worse, the whole host serves a 691-byte React
  // shell to a client without a browser User-Agent — every path, `/api/*`
  // included — so a fetcher that trusts HTTP 200 records an empty document as
  // "the statute". Every Indiana statutory citation below is an `/ic/` PDF.
  //
  // DOR's FORMS are not on `in.gov` either. Its form index page is real, but
  // every link on it points at `forms.in.gov/Download.aspx?id=NNNN`, a
  // separately registrable host.
  //
  // Which leaves `in.gov`, and it is the one admission here that deserves to be
  // uncomfortable: it is a shared executive portal, the shape refused for
  // Pennsylvania. Three things make it different rather than a weakening. DOR's
  // departmental notices and information bulletins are published under
  // `www.in.gov/dor/files/` and nowhere else, so there is no narrower host to
  // prefer and no Indiana regulation carrying the same language. IC 6-3-2-1(e)
  // NAMES Departmental Notice #1 as the vehicle by which the department must
  // publish each even-numbered year's rate, so that document is statutorily
  // designated rather than merely convenient. And the claim it carries — that a
  // county levy attaches to every Indiana resident — has no code section that
  // states it, which is the case `stateAgencyPublication` exists for. The
  // allowlist holds hosts and cannot express the `/dor/files/` narrowing; that
  // it cannot is a real cost and is recorded here rather than glossed.
  // ---------------------------------------------------------------------------

  'ic-6-3-2-1-flat-rate-ramp': {
    title: 'Indiana’s flat individual rate and its legislated ramp',
    statement:
      'Indiana imposes one flat rate on Indiana adjusted gross income, with no brackets and no variation by filing status. The statutory schedule is 3.05% for 2024, 3% for 2025, 2.95% for 2026, and 2.9% for taxable years after 2026 and before 2030. From 2030 through 2043 the rate falls a further five hundredths of a point in each even-numbered year, but only where the budget agency certifies four consecutive years of state general fund revenue growth of at least 3.5% together with a forecast of the same — a condition no projection can evaluate, so 2.9% is the last figure the pack may carry and only through 2029. The pack holds 2.95% for both filing statuses. A refresh that carries a prior year’s rate forward is wrong by construction, which is why Indiana sits on the never-hold-forward list in the pack header.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:IN',
    authority: [{
      kind: 'statute',
      citation: 'IC 6-3-2-1(b)(7)',
      url: 'https://iga.in.gov/ic/2026/Title_6/Article_3/Chapter_2.pdf',
      quotedText:
        'For taxable years beginning after December 31, 2025, and before January 1, 2027, two and ninety-five hundredths percent (2.95%).',
    }, {
      kind: 'statute',
      citation: 'IC 6-3-2-1(b)(8)',
      url: 'https://iga.in.gov/ic/2026/Title_6/Article_3/Chapter_2.pdf',
      quotedText:
        'For taxable years beginning after December 31, 2026, and before January 1, 2030, two and nine-tenths percent (2.9%).',
    }, {
      // Not `formInstruction`: Departmental Notice #1 is neither a form nor an
      // instruction to one. It is a WITHHOLDING notice that states the annual
      // rate as a fact, and IC 6-3-2-1(e) makes it the designated vehicle for
      // doing so — the department's own statement about its own levy, which is
      // exactly what `stateAgencyPublication` names.
      kind: 'stateAgencyPublication',
      citation: 'Indiana DOR, Departmental Notice #1, effective Jan. 1, 2026 (R46 / 01-26)',
      url: 'https://www.in.gov/dor/files/dn01.pdf',
      quotedText: 'For 2026, the state adjusted gross income tax rate for individuals is 2.95%.',
    }, {
      // The section's own source note. It is what establishes that P.L.201-2023
      // set 2.95% and 2.9% and that P.L.80-2025 left both alone — the latter
      // added only the conditional subdivisions and subsection (e), which a
      // diff of the 2024 and 2026 code editions confirms. The enrolled acts
      // themselves are unreachable: every `/acts/` pattern on iga returns the
      // React shell, and the legislature's API carries no public-law-to-bill
      // mapping in either direction.
      kind: 'legislativeHistory',
      citation: 'IC 6-3-2-1, source note',
      url: 'https://iga.in.gov/ic/2026/Title_6/Article_3/Chapter_2.pdf',
      quotedText:
        'As amended by Acts 1979, P.L.68, SEC.1; Acts 1981, P.L.77, SEC.8; P.L.2-1982(ss), SEC.8; P.L.47-1984, SEC.4; P.L.390-1987(ss), SEC.37; P.L.192-2002(ss), SEC.70; P.L.81-2004, SEC.20; P.L.172-2011, SEC.54; P.L.205-2013, SEC.82; P.L.80-2014, SEC.9; P.L.212-2018(ss), SEC.20; P.L.138-2022, SEC.4; P.L.201-2023, SEC.95; P.L.80-2025, SEC.1.',
    }],
    volatility: 'staticStatute',
    // Deliberate. The rate moves on January 1, 2027 by operation of the same
    // statute, so a record left open would go stale in silence rather than
    // name the year it stopped being true.
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#IN',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetail',
    ],
  },

  'ic-6-3-1-3-5-a-8-social-security-railroad-subtraction': {
    title: 'Indiana subtracts the federally taxable Social Security and Railroad Retirement amount',
    statement:
      'Indiana adjusted gross income begins from federal adjusted gross income under IRC 62, which already carries the portion of Social Security and Railroad Retirement benefits that IRC 86 makes taxable; IC 6-3-1-3.5(a)(8) then subtracts that entire included amount, with no threshold, age condition or cap. The mechanism matters for how the figure is stated: Indiana does not adopt the federal exclusion, it removes the federally taxable amount, and Railroad Retirement rides in the same subdivision rather than needing one of its own. The pack expresses this as `taxesSocialSecurity: false`.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:IN',
    authority: [{
      kind: 'statute',
      citation: 'IC 6-3-1-3.5(a)(8)',
      url: 'https://iga.in.gov/ic/2026/Title_6/Article_3/Chapter_1.pdf',
      quotedText:
        'Subtract an amount equal to the amount of federal Social Security and Railroad Retirement benefits included in a taxpayer\'s federal gross income by Section 86 of the Internal Revenue Code.',
    }, {
      kind: 'statute',
      citation: 'IC 6-3-1-3.5(a)',
      url: 'https://iga.in.gov/ic/2026/Title_6/Article_3/Chapter_1.pdf',
      quotedText:
        'In the case of all individuals, "adjusted gross income" (as defined in Section 62 of the Internal Revenue Code), modified as follows:',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#IN',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ic-6-3-2-no-general-retirement-deduction': {
    title: 'Indiana taxes private AND state and local government pensions in full',
    statement:
      'Indiana’s subtractions from adjusted gross income are a closed set — the modifications enumerated in IC 6-3-1-3.5(a), whose (a)(36) reaches out only to what IC 6-3-2 itself allows, operationally the ten named lines of Schedule 2 plus the named three-digit codes on line 11. Nothing in that set reaches a private pension, a commercial annuity, or a distribution from a traditional IRA, 401(k) or 403(b). Nothing in it reaches a pension from the Indiana Public Retirement System, a teachers’ retirement fund, or a municipal police or fire fund either: Indiana has no general public-pension deduction, and its only two public-retirement items are the FEDERAL civil service annuity adjustment and the MILITARY retirement deduction, each registered separately. The pack says so by keeping Indiana out of `PUBLIC_PENSION_OVERRIDES`, which leaves `{ kind: \'none\' }` in both buckets. Indiana carried `{ kind: \'full\' }` there until 2026-08-05, which exempted every public pension in the state outright — a retired Indiana teacher with a $36,000 TRF pension was charged nothing on income Indiana taxes in full.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:IN',
    authority: [{
      // A negative claim's evidence is the closedness of the enumeration, so
      // the statutory half is the clause that bounds it.
      kind: 'statute',
      citation: 'IC 6-3-1-3.5(a)(36)',
      url: 'https://iga.in.gov/ic/2026/Title_6/Article_3/Chapter_1.pdf',
      quotedText: 'Subtract any other amounts the taxpayer is entitled to deduct under IC 6-3-2.',
    }, {
      // And the affirmative half is the department's own list of what is NOT
      // taxable, which names Social Security, railroad retirement and life
      // insurance and stops. The parallel "Taxable income includes ...
      // Pensions (taxable portion) ... Annuities (taxable portion)" list in
      // the same bulletin is a two-column table that reflows into a paraphrase
      // on extraction, so it corroborates this record rather than quoting into
      // it.
      kind: 'stateAgencyPublication',
      citation: 'Indiana DOR, Income Tax Information Bulletin #26 (January 2023)',
      url: 'https://www.in.gov/dor/files/ib26.pdf',
      quotedText:
        'Nontaxable income includes, but is not limited to, income from the following sources: Social Security Railroad retirement benefits Life insurance proceeds',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#IN',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'ic-6-3-2-4-military-retirement-deduction': {
    title: 'Indiana deducts military retirement in full, and the pack deducts none of it',
    statement:
      'For taxable years beginning after 2021, IC 6-3-2-4(a)(2) sets Indiana’s deduction for military retirement or survivor’s benefits at the lesser of the benefits included in adjusted gross income or $6,250 plus one hundred percent of the benefits above $6,250 — which is the whole amount. There is no age condition, no income phase-out, and the deduction reaches the individual’s surviving spouse; it is separate from and additional to the $5,000 for active or reserve service pay under (a)(1). Not modelled. The pack’s public bucket is one flag for every public pension the input model can carry, and in Indiana that bucket is dominated by INPRS/PERF, TRF, municipal police and fire retirees who get NOTHING, so the bucket carries `none` and a military pension is charged Indiana tax on income Indiana removes from the base entirely. The direction is chosen rather than inherited: the same flag set to `full` — which is what Indiana carried until 2026-08-05 — is exact for the military retiree and exempts every teacher, trooper and state employee’s pension in Indiana alongside them, which errs toward the taxpayer and across by far the larger population.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:IN',
    authority: [{
      kind: 'statute',
      citation: 'IC 6-3-2-4(a)(2)',
      url: 'https://iga.in.gov/ic/2026/Title_6/Article_3/Chapter_2.pdf',
      quotedText:
        'The amount of the deduction is the lesser of: (A) the benefits included in the adjusted gross income of the individual or the individual\'s surviving spouse; or (B) six thousand two hundred fifty dollars ($6,250) plus the following: (i) For taxable years beginning in 2019, twenty-five percent (25%) of the amount of the benefits in excess of six thousand two hundred fifty dollars ($6,250). (ii) For taxable years beginning in 2020, fifty percent (50%) of the amount of the benefits in excess of six thousand two hundred fifty dollars ($6,250). (iii) For taxable years beginning in 2021, seventy-five percent (75%) of the amount of the benefits in excess of six thousand two hundred fifty dollars ($6,250). (iv) For taxable years beginning after 2021, one hundred percent (100%) of the amount of the benefits in excess of six thousand two hundred fifty dollars ($6,250).',
    }, {
      kind: 'formInstruction',
      citation: '2025 Form IT-40 instruction booklet, Schedule 2 Other Deductions, code 632',
      url: 'https://forms.in.gov/Download.aspx?id=16915',
      quotedText:
        'For 2022 and later, the deduction is equal to the entire amount of military retirement income and/or survivor\'s benefits.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/state/types.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#PUBLIC_PENSION_OVERRIDES',
      'packages/engine/src/params/state/types.ts#StateRetirementExclusion',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'ic-6-3-2-3-7-civil-service-annuity-age-62': {
    title: 'Indiana’s civil service annuity deduction is age 62, capped, and offset by Social Security',
    statement:
      'An individual at least 62 years old before the end of the taxable year — or the surviving spouse of such an individual, at any age — deducts the first $16,000 of federal civil service annuity income included in adjusted gross income, reduced by the total Social Security and railroad retirement benefits received that year. The threshold is 62, not 65, and a retiree whose Social Security exceeds $16,000 gets nothing at all. Not modelled, and it could not be: `StateRetirementExclusion` has no offset against another income stream, and the bucket the deduction would sit in is the same one flag the military deduction wants pointed the other way. So a federal civil service annuitant aged 62 or over with modest Social Security is charged Indiana tax on up to $16,000 that Indiana deducts. The population is narrower than the military one and the amount is smaller, but the direction is the same and the two must be read together rather than netted.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:IN',
    authority: [{
      kind: 'statute',
      citation: 'IC 6-3-2-3.7(b)',
      url: 'https://iga.in.gov/ic/2026/Title_6/Article_3/Chapter_2.pdf',
      quotedText:
        'The individual is only entitled to the deduction provided by this section if the individual is at least sixty-two (62) years of age before the end of the taxable year. This subsection does not apply to the individual\'s surviving spouse.',
    }, {
      // (a) is split across the two entries below because the subsection spans
      // a PAGE BREAK in the Code PDF, and iga's running "Indiana Code 2026"
      // header lands inside the sentence — so a single quotation of the whole
      // subsection is a passage the document does not contain. The break falls
      // mid-clause, between "beginning after" and "December 31, 2015;", and the
      // two halves meet exactly there rather than at a tidier point. Nothing is
      // dropped and nothing is rejoined; a quote that has been retyped once can
      // be retyped again.
      kind: 'statute',
      citation: 'IC 6-3-2-3.7(a), first page',
      url: 'https://iga.in.gov/ic/2026/Title_6/Article_3/Chapter_2.pdf',
      quotedText:
        'Each taxable year, an individual or the individual\'s surviving spouse is entitled to an adjusted gross income tax deduction equal to the remainder of: (1) the: (A) first eight thousand dollars ($8,000), for taxable years beginning after December 31, 2014, and before January 1, 2016; and (B) first sixteen thousand dollars ($16,000), for taxable years beginning after',
    }, {
      kind: 'statute',
      citation: 'IC 6-3-2-3.7(a), continued',
      url: 'https://iga.in.gov/ic/2026/Title_6/Article_3/Chapter_2.pdf',
      quotedText:
        'December 31, 2015; which is received by the individual or the individual\'s surviving spouse during the taxable year from a federal civil service annuity, and which is included in adjusted gross income under Section 62 of the Internal Revenue Code; minus (2) the total amount of Social Security benefits and railroad retirement benefits received by the individual or the individual\'s surviving spouse during the taxable year.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Indiana DOR, Income Tax Information Bulletin #6 (June 2025)',
      url: 'https://www.in.gov/dor/files/ib06.pdf',
      quotedText:
        'To qualify for the civil service annuity adjustment, the taxpayer must be at least 62 years old at the close of the tax year and have received a civil service annuity included in the taxpayer\'s adjusted gross income while a resident of Indiana.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/state/types.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#IN',
      'packages/engine/src/params/state/types.ts#StateRetirementExclusion',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ic-6-3-6-2-2-county-income-tax-shares-the-state-base': {
    title: 'Indiana’s county income tax is universal, and the pack has no default for it',
    statement:
      'Every Indiana county levies a local income tax, imposed on "adjusted gross income" as IC 6-3-1-3.5 defines it — the same figure the state rate runs on, after both the Schedule 2 deductions and the Schedule 3 exemptions, which Schedule CT-40 reaches by starting from IT-40 line 7. Liability follows the taxpayer’s county of residence on January 1 of the year the taxable year begins, so a mid-year move between counties does not change the rate. Not modelled — and the gap is a missing DEFAULT rather than a missing mechanism. The engine’s shape is already exactly right: `computeStateTaxDetail` applies a flat `localRatePct` to state taxable income, which is the identical base. But that rate reaches the calculator only from the caller, through `assumptions.localIncomeTaxPct` or a relocation candidate, and both default to zero. No entry in `StateTaxParams` can carry a per-state default, and none is invented here: the 2026 county rates run from 0.005 to 0.03 with no published statewide figure to stand for them, and a synthetic average would be a number with no publisher. So an Indiana household priced without an explicit rate is under-charged by the whole county levy — roughly $1,400 a year on $70,000 of Indiana AGI at a mid-range 2% county rate, against $2,065 of state tax. Indiana is the worst case of this in the pack, because the levy is universal and the state rate is low, so the local share is the majority of the story.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale: null,
    jurisdiction: 'state:IN',
    authority: [{
      kind: 'statute',
      citation: 'IC 6-3.6-2-2',
      url: 'https://iga.in.gov/ic/2026/Title_6/Article_3.6/Chapter_2.pdf',
      quotedText: '"Adjusted gross income" has the meaning set forth in IC 6-3-1-3.5.',
    }, {
      // The universality claim, which is what sets the direction. No code
      // section states it — the rates are adopted county by county — so the
      // only text that says every resident owes one is the department's.
      kind: 'stateAgencyPublication',
      citation: 'Indiana DOR, Income Tax Information Bulletin #26 (January 2023)',
      url: 'https://www.in.gov/dor/files/ib26.pdf',
      quotedText:
        'If the taxpayer\'s place of residence or principal place of business or employment on January 1 was an Indiana county, the taxpayer owes local income tax.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Indiana DOR, Departmental Notice #1, effective Jan. 1, 2026 (R46 / 01-26)',
      url: 'https://www.in.gov/dor/files/dn01.pdf',
      quotedText:
        'Both the county of residence and the county of principal business or employment of an individual are determined on Jan. 1 of the calendar year in which the individual\'s taxable year begins.',
    }, {
      // Where the county tax meets the return. CT-40 line 1 is literally
      // "Enter the amount from IT-40, line 7", which is the cleanest proof
      // that the two taxes share a base — but it is 36 characters and the
      // conformance guard requires 40, so the neighbouring line is quoted
      // instead and the identity is carried by IC 6-3.6-2-2 above.
      kind: 'formInstruction',
      citation: '2025 Schedule CT-40 (County Tax Schedule for Full-Year Residents), line 2',
      url: 'https://forms.in.gov/Download.aspx?id=16902',
      quotedText:
        'Enter the county tax rate from the chart on the back of this schedule for the county where you lived on Jan. 1, 2025',
    }],
    // Not indexed — the rates are re-adopted by county fiscal bodies and
    // republished by DOR every January and October. The operational
    // consequence is identical to indexation: the table must be re-pulled
    // annually. If the registry ever gains a `locallySet` volatility, this is
    // the record to move.
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/state/types.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#IN',
      'packages/engine/src/params/state/types.ts#StateTaxParams',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetail',
    ],
  },

  'ic-6-3-1-3-5-exemptions-not-a-standard-deduction': {
    title: 'Indiana has no standard deduction, and the exemptions it has instead are not modelled',
    statement:
      'Indiana grants no standard or itemized deduction against Indiana adjusted gross income, so `standardDeduction: 0` is a true statement about the field it sits in. In its place IC 6-3-1-3.5(a)(3)-(5) subtracts flat per-person amounts: $1,000 per filer and $1,000 for each spouse on a joint return, $1,000 for each additional amount allowable under IRC 63(f) — that is, $1,000 per person aged 65 or over and $1,000 per person who is blind — and a further $500 per person aged 65 or over whose federal adjusted gross income is under $40,000 ($20,000 married filing separately). The amounts are fixed in statute and are not indexed. None of it is modelled, so a married couple both 65 or over is charged Indiana state and county tax on $4,000 Indiana exempts, or $5,000 below the AGI threshold. Borrowing the `standardDeduction` field for it was considered and rejected twice over: the pack models no state personal exemption anywhere — that slot holds a state’s standard deduction, or for Colorado and North Dakota the federal-taxable-income converter — so doing it for Indiana alone would make one state an unmarked exception to a fifty-one-state convention; and the age-65 half is per person while the field is per filing status, so any single figure that priced a 65+ household correctly would over-deduct for one under 65 and turn an over-charge into an under-charge.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:IN',
    authority: [{
      kind: 'statute',
      citation: 'IC 6-3-1-3.5(a)(3)',
      url: 'https://iga.in.gov/ic/2026/Title_6/Article_3/Chapter_1.pdf',
      quotedText:
        'Subtract one thousand dollars ($1,000), or in the case of a joint return filed by a husband and wife, subtract for each spouse one thousand dollars ($1,000).',
    }, {
      kind: 'statute',
      citation: 'IC 6-3-1-3.5(a)(4)(B)',
      url: 'https://iga.in.gov/ic/2026/Title_6/Article_3/Chapter_1.pdf',
      quotedText: 'each additional amount allowable under Section 63(f) of the Internal Revenue Code',
    }, {
      kind: 'statute',
      citation: 'IC 6-3-1-3.5(a)(5)(C)',
      url: 'https://iga.in.gov/ic/2026/Title_6/Article_3/Chapter_1.pdf',
      quotedText:
        'Five hundred dollars ($500) for each additional amount allowable under Section 63(f)(1) of the Internal Revenue Code if the federal adjusted gross income of the taxpayer, or the taxpayer and the taxpayer\'s spouse in the case of a joint return, is less than forty thousand dollars ($40,000). In the case of a married individual filing a separate return, the qualifying income amount in this clause is equal to twenty thousand dollars ($20,000).',
    }, {
      kind: 'formInstruction',
      citation: '2025 Schedule 3 (Exemptions), State Form 53997, line 1',
      url: 'https://forms.in.gov/Download.aspx?id=16936',
      quotedText: 'Enter $2000 if you are married filing jointly; otherwise, enter $1000',
    }, {
      // The department restating the two age-65 items. Quoted from the
      // bulletin's prose rather than from Schedule 3's line 4, which is a
      // checkbox grid and reflows into a paraphrase on extraction.
      //
      // One thing the statute alone does not settle, recorded rather than
      // smoothed over: IRC 63(f)'s additional amounts are on their face
      // increases to the FEDERAL standard deduction, so "allowable" in
      // (a)(4)(B) is doing work Indiana's own text never defines, and whether
      // a federal itemizer keeps the exemption is not answered there. DOR
      // administers it unconditionally — Schedule 3 line 4 asks no itemizer
      // question — and this record follows the department on that basis.
      kind: 'stateAgencyPublication',
      citation: 'Indiana DOR, Income Tax Information Bulletin #26 (January 2023), age 65 exemptions',
      url: 'https://www.in.gov/dor/files/ib26.pdf',
      quotedText:
        'A $500 additional exemption for each individual age 65 or older if their federal adjusted gross income is less than $40,000 ($20,000 if married filing separately)',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/state/types.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#IN',
      'packages/engine/src/params/state/types.ts#StateTaxParams',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ks-stat-79-32-117-social-security-exclusion': {
    title: 'Kansas subtracts all federally taxable Social Security from 2024',
    statement:
      'For taxable years beginning after 2023, Kansas subtracts every Social Security benefit included in federal adjusted gross income, with no AGI threshold. That is exactly the federally taxable Social Security share that the state calculator removes when the pack sets `taxesSocialSecurity: false`.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:KS',
    authority: [{
      kind: 'statute',
      citation: 'K.S.A. 79-32,117(c)(xviii)(B)',
      url: 'https://www.ksrevisor.gov/statutes/chapters/ch79/079_032_0117.html',
      quotedText:
        'For all taxable years beginning after December 31, 2023, amounts received as benefits under the federal social security act that are included in federal adjusted gross income of a taxpayer.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.KS',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ks-stat-79-32-117-public-pension-exclusion': {
    title: 'Kansas exempts listed public retirement plans, not every public pension',
    statement:
      'Kansas subtracts only particular public retirement benefits named in K.S.A. 79-32,117(c) — federal civil-service and armed-forces retirement, city pensions under K.S.A. 13-14,106, board-of-public-utilities pensions, Washburn University retirement benefits, and the Overland Park police and fire plans. Approximated: the pack represents every `publicPensionIncome` dollar as `{ kind: \'full\' }`, but its input carries no pension-system identity with which to distinguish a listed plan from an unlisted municipal or other public pension. An unlisted public pension is consequently removed and the engine understates the taxpayer’s tax exposure; the pin fixture uses that source-rejected unlisted-pension limb.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale: null,
    jurisdiction: 'state:KS',
    authority: [{
      kind: 'statute',
      citation: 'K.S.A. 79-32,117(c)(vii)',
      url: 'https://www.ksrevisor.gov/statutes/chapters/ch79/079_032_0117.html',
      quotedText:
        'Amounts received as annuities under the federal civil service retirement system from the civil service retirement and disability fund and other amounts received as retirement benefits in whatever form which were earned for being employed by the federal government or for service in the armed forces of the United States.',
    }, {
      kind: 'statute',
      citation: 'K.S.A. 79-32,117(c)(ix)',
      url: 'https://www.ksrevisor.gov/statutes/chapters/ch79/079_032_0117.html',
      quotedText:
        'Amounts received by retired employees of a city and by retired employees of any board of such city as retirement allowances pursuant to K.S.A. 13-14,106, and amendments thereto, or pursuant to any charter ordinance exempting a city from the provisions of K.S.A. 13-14,106, and amendments thereto.',
    }, {
      kind: 'statute',
      citation: 'K.S.A. 79-32,117(c)(xii)',
      url: 'https://www.ksrevisor.gov/statutes/chapters/ch79/079_032_0117.html',
      quotedText:
        'For taxable years beginning after December 31, 1989, amounts received by retired employees of a board of public utilities as pension and retirement benefits pursuant to K.S.A. 13-1246, 13-1246a and 13-1249, and amendments thereto.',
    }, {
      kind: 'statute',
      citation: 'K.S.A. 79-32,117(c)(xix)',
      url: 'https://www.ksrevisor.gov/statutes/chapters/ch79/079_032_0117.html',
      quotedText:
        'Amounts received by retired employees of Washburn university as retirement and pension benefits under the university\'s retirement plan.',
    }, {
      kind: 'statute',
      citation: 'K.S.A. 79-32,117(c)(xxiii)',
      url: 'https://www.ksrevisor.gov/statutes/chapters/ch79/079_032_0117.html',
      quotedText:
        'For all taxable years beginning after December 31, 2012, amounts received under either the Overland Park, Kansas police department retirement plan or the Overland Park, Kansas fire department retirement plan, both as established by the city of Overland Park, pursuant to the city\'s home rule authority.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/state/types.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#PUBLIC_PENSION_OVERRIDES',
      'packages/engine/src/params/state/types.ts#StateRetirementExclusion',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'mi-mcl-206-30-f-iii-social-security': {
    title: 'Michigan deducts Social Security benefits included in AGI',
    statement:
      'Michigan taxable income deducts Social Security benefits as defined in IRC section 86, to the extent included in adjusted gross income. That is what `taxesSocialSecurity: false` encodes. The (9)/(10)/(11) limitations that restrict the other (1)(f) retirement deductions do not, for 2026, condition this Social Security deduction: the 2026–2028 sentence of (9)(e) withholds the personal exemption from a person who takes the unrestricted $20,000 deduction, and does not mention (1)(f)(iii).',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:MI',
    authority: [{
      kind: 'statute',
      citation: 'Mich. Comp. Laws 206.30(1)(f)',
      url: 'https://www.legislature.mi.gov/mileg.aspx?objectName=mcl-206-30&page=getObject',
      quotedText:
        'Deduct the following to the extent included in adjusted gross income subject to the limitations and restrictions set forth in subsection (9), (10), or (11), as applicable:',
    }, {
      kind: 'statute',
      citation: 'Mich. Comp. Laws 206.30(1)(f)(iii)',
      url: 'https://www.legislature.mi.gov/mileg.aspx?objectName=mcl-206-30&page=getObject',
      quotedText:
        'Social Security benefits as defined in section 86 of the internal revenue code.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#MI',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'mi-mcl-206-30-retirement-and-ss': {
    title: 'Michigan\'s 2026 retirement deduction is not a flat per-person cap',
    statement:
      'For 2026 a Michigan taxpayer may deduct retirement or pension benefits as provided in MCL 206.30(1)(f), except that public-system amounts under (1)(f)(i) and (ii) combined are capped at the same CPI-adjusted maximum (1)(f)(iv) allows for other retirement or pension benefits paid for life to a senior citizen. That (iv) maximum started at $42,240 single / $84,480 joint in 2007 and is indexed. The pack flattens this into `{ kind: \'capped\', capPerPerson: 49423 }` with no senior-citizen test, no public/private split, and no birth-year election between subsections (9) and (10). Approximated: a senior citizen whose (iv) maximum has indexed past $49,423 is under-excluded, and a non-senior whose (1)(f)(iv) deduction is not available at all is over-excluded. Social Security is a different (1)(f) limb and is registered separately at mi-mcl-206-30-f-iii-social-security.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale: null,
    jurisdiction: 'state:MI',
    authority: [{
      kind: 'statute',
      citation: 'Mich. Comp. Laws 206.30(10)(d)',
      url: 'https://www.legislature.mi.gov/mileg.aspx?objectName=mcl-206-30&page=getObject',
      quotedText:
        'For the 2026 tax year and each tax year after 2026, a taxpayer may deduct retirement or pension benefits as provided under subsection (1)(f), except that the amounts deductible under subsection (1)(f)(i) and (ii) combined are subject to the same maximum amounts allowed under subsection (1)(f)(iv) for a single return and a joint return for that same tax year.',
    }, {
      kind: 'statute',
      citation: 'Mich. Comp. Laws 206.30(1)(f)(iv)',
      url: 'https://www.legislature.mi.gov/mileg.aspx?objectName=mcl-206-30&page=getObject',
      quotedText:
        'Beginning on and after January 1, 2007, retirement or pension benefits not deductible under subparagraph (i) or subdivision (e) from any other retirement or pension system or benefits from a retirement annuity policy in which payments are made for life to a senior citizen, to a maximum of $42,240.00 for a single return and $84,480.00 for a joint return. The maximum amounts allowed under this subparagraph shall be reduced by the amount of the deduction for retirement or pension benefits claimed under subparagraph (i) or subdivision (e) and by the amount of a deduction claimed under subdivision (p). For the 2008 tax year and each tax year after 2008, the maximum amounts allowed under this subparagraph shall be adjusted by the percentage increase in the United States Consumer Price Index for the immediately preceding calendar year.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#MI',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'mn-stat-290-0132-subd-26-social-security-inclusion': {
    title: 'Minnesota subtracts federally taxable Social Security on an income-tested schedule the pack omits',
    statement:
      'Minnesota allows a subtraction equal to the greater of a simplified subtraction of taxable Social Security benefits, reduced 10 percent for each $4,000 of AGI (or fraction thereof) over $78,000 single / $100,000 joint, or an alternate subtraction capped at a much smaller indexed maximum. Approximated: the pack encodes `taxesSocialSecurity: true` and subtracts nothing, so a Minnesota retiree who still has subtraction room is charged tax on federally taxable benefits the statute takes out. The gap closes at high AGI, where the simplified subtraction phases to zero; below that line the engine overstates Minnesota tax. Private retirement remains `{ kind: \'none\' }`, which this record does not re-open: subdivision 34\'s qualified-public-pension subtraction is a different provision and is not modelled.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:MN',
    authority: [{
      kind: 'statute',
      citation: 'Minn. Stat. 290.0132, subd. 26(a)',
      url: 'https://www.revisor.mn.gov/statutes/cite/290.0132',
      quotedText:
        'A taxpayer is allowed a subtraction equal to the greater of the simplified subtraction allowed under paragraph (b) or the alternate subtraction determined under paragraph (e).',
    }, {
      kind: 'statute',
      citation: 'Minn. Stat. 290.0132, subd. 26(b)',
      url: 'https://www.revisor.mn.gov/statutes/cite/290.0132',
      quotedText:
        'A taxpayer\'s simplified subtraction equals the amount of taxable social security benefits, as reduced under paragraphs (c) and (d).',
    }, {
      kind: 'statute',
      citation: 'Minn. Stat. 290.0132, subd. 26(c)',
      url: 'https://www.revisor.mn.gov/statutes/cite/290.0132',
      quotedText:
        'For a taxpayer other than a married taxpayer filing a separate return with adjusted gross income above the phaseout threshold, the simplified subtraction is reduced by ten percent for each $4,000 of adjusted gross income, or fraction thereof, in excess of the phaseout threshold.',
    }, {
      kind: 'statute',
      citation: 'Minn. Stat. 290.0132, subd. 26(c)(1)–(2)',
      url: 'https://www.revisor.mn.gov/statutes/cite/290.0132',
      quotedText:
        '(1) $100,000 for a married taxpayer filing a joint return or surviving spouse; (2) $78,000 for a single or head of household taxpayer; and',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#MN',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ne-stat-77-2716-social-security-subtraction': {
    title: 'Nebraska subtracts 100% of federally included Social Security from 2024',
    statement:
      'From taxable years beginning on or after January 1, 2024 Nebraska reduces federal adjusted gross income by one hundred percent of the Social Security benefits that are received and included in federal adjusted gross income. That is what `taxesSocialSecurity: false` encodes, and it is why a reading that still taxed 85 percent of the benefit is rejected.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:NE',
    authority: [{
      kind: 'statute',
      citation: 'Neb. Rev. Stat. 77-2716(14)(a)',
      url: 'https://www.nebraskalegislature.gov/laws/statutes.php?statute=77-2716',
      quotedText:
        'For taxable years beginning or deemed to begin on or after January 1, 2021, under the Internal Revenue Code of 1986, as amended, federal adjusted gross income shall be reduced by a percentage of the social security benefits that are received and included in federal adjusted gross income. The pertinent percentage shall be:',
    }, {
      kind: 'statute',
      citation: 'Neb. Rev. Stat. 77-2716(14)(a)(iv)',
      url: 'https://www.nebraskalegislature.gov/laws/statutes.php?statute=77-2716',
      quotedText:
        'One hundred percent for taxable years beginning or deemed to begin on or after January 1, 2024, under the Internal Revenue Code of 1986, as amended.',
    }, {
      kind: 'statute',
      citation: 'Neb. Rev. Stat. 77-2716(14)(b)',
      url: 'https://www.nebraskalegislature.gov/laws/statutes.php?statute=77-2716',
      quotedText:
        'For purposes of this subsection, social security benefits means benefits received under the federal Social Security Act.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2024,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.NE',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ne-stat-77-2716-public-pension-exemption': {
    title: 'Nebraska\'s public-pension override is military and CSRS, not every public pension',
    statement:
      'Nebraska subtracts one hundred percent of military retirement benefit income from 2022 and, from 2024, amounts received as annuities under the Civil Service Retirement System earned for federal employment. The pack encodes the public bucket as `{ kind: \'full\' }`, a single flag, so a Nebraska Public Employees Retirement System or school-retirement annuity is excluded in full the same way a military pension is. Approximated: the engine understates tax on every public pension the two subsections do not name. Private retirement stays `{ kind: \'none\' }`, which matches the absence of a general private-pension subtraction in this section.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale: null,
    jurisdiction: 'state:NE',
    authority: [{
      kind: 'statute',
      citation: 'Neb. Rev. Stat. 77-2716(15)(b)',
      url: 'https://www.nebraskalegislature.gov/laws/statutes.php?statute=77-2716',
      quotedText:
        'For taxable years beginning or deemed to begin on or after January 1, 2022, under the Internal Revenue Code of 1986, as amended, an individual may exclude one hundred percent of the military retirement benefit income received by such individual to the extent included in federal adjusted gross income.',
    }, {
      kind: 'statute',
      citation: 'Neb. Rev. Stat. 77-2716(15)(c)',
      url: 'https://www.nebraskalegislature.gov/laws/statutes.php?statute=77-2716',
      quotedText:
        'For purposes of this subsection, military retirement benefit means retirement benefits that are periodic payments attributable to service in the uniformed services of the United States for personal services performed by an individual prior to his or her retirement.',
    }, {
      kind: 'statute',
      citation: 'Neb. Rev. Stat. 77-2716(20)',
      url: 'https://www.nebraskalegislature.gov/laws/statutes.php?statute=77-2716',
      quotedText:
        'For taxable years beginning or deemed to begin on or after January 1, 2024, under the Internal Revenue Code of 1986, as amended, an individual may reduce his or her federal adjusted gross income by the amounts received as annuities under the Civil Service Retirement System which were earned for being employed by the federal government, to the extent such amounts are included in federal adjusted gross income.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2024,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#PUBLIC_PENSION_OVERRIDES',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'oh-rev-code-5747-01-social-security-and-public-pension': {
    title: 'Ohio subtracts Social Security and uniformed-services retirement, but uses a separate retirement-income credit',
    statement:
      'Ohio expressly deducts Title II Social Security benefits and tier 1 railroad retirement from Ohio adjusted gross income. Its separate retirement deduction reaches retired personnel pay for uniformed service (and only the attributable uniformed-service portion of a related federal civil-service annuity), while section 5747.055 supplies a capped retirement-income credit for returns with modified AGI below $100,000. The pack instead gives every public-pension dollar a full exclusion and carries no credit, so it understates tax for non-uniformed public pensions but overstates tax when a taxpayer qualifies for the omitted credit; those are the two approximation directions this record pins.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale: null,
    jurisdiction: 'state:OH',
    // BLOCKED-SOURCE: the planned Ohio DOR credit page was unavailable in the
    // re-fetch; ORC §5747.055 carries the operative credit schedule instead.
    authority: [{
      kind: 'statute',
      citation: 'Ohio Rev. Code §5747.01(A)(5)',
      url: 'https://codes.ohio.gov/ohio-revised-code/section-5747.01',
      quotedText:
        '(5) Deduct the following, to the extent not otherwise deducted or excluded in computing federal or Ohio adjusted gross income: (a) Benefits under Title II of the Social Security Act and tier 1 railroad retirement; (b) Railroad retirement benefits, other than tier 1 railroad retirement benefits, to the extent such amounts are exempt from state taxation under federal law.',
    }, {
      kind: 'statute',
      citation: 'Ohio Rev. Code §5747.01(A)(23)',
      url: 'https://codes.ohio.gov/ohio-revised-code/section-5747.01',
      quotedText:
        '(23) Deduct, to the extent not otherwise deducted or excluded in computing federal or Ohio adjusted gross income for the taxable year, amounts received by the taxpayer as retired personnel pay for service in the uniformed services or reserve components thereof, or the national guard, or received by the surviving spouse or former spouse of such a taxpayer under the survivor benefit plan on account of such a taxpayer\'s death. If the taxpayer receives income on account of retirement paid under the federal civil service retirement system or federal employees retirement system, or under any successor retirement program enacted by the congress of the United States that is established and maintained for retired employees of the United States government, and such retirement income is based, in whole or in part, on credit for the taxpayer\'s uniformed service, the deduction allowed under this division shall include only that portion of such retirement income that is attributable to the taxpayer\'s uniformed service, to the extent that portion of such retirement income is otherwise included in federal adjusted gross income and is not otherwise deducted under this section. Any amount deducted under division (A)(23) of this section is not included in a taxpayer\'s adjusted gross income for the purposes of section 5747.055 of the Revised Code. No amount may be deducted under division (A)(23) of this section on the basis of which a credit was claimed under section 5747.055 of the Revised Code.',
    }, {
      kind: 'statute',
      citation: 'Ohio Rev. Code §5747.055(B)',
      url: 'https://codes.ohio.gov/ohio-revised-code/section-5747.055',
      quotedText:
        '(B) A credit shall be allowed against a taxpayer\'s aggregate tax liability under section 5747.02 of the Revised Code for taxpayers who received retirement income during the taxable year and whose modified adjusted gross income for the taxable year, less applicable exemptions under section 5747.025 of the Revised Code, as shown on an individual or joint annual return is less than one hundred thousand dollars. Only one such credit shall be allowed for each return, and the amount of the credit shall be computed in accordance with the following schedule: AMOUNT OF RETIREMENT INCOME RECEIVED DURING THE TAXABLE YEAR CREDIT FOR THE TAXABLE YEAR $500 or less $ 0 Over $500 but not more than $1,500 $ 25 Over $1,500 but not more than $3,000 $ 50 Over $3,000 but not more than $5,000 $ 80 Over $5,000 but not more than $8,000 $ 130 Over $8,000 $ 200',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#PUBLIC_PENSION_OVERRIDES',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'wi-stat-71-05-retirement-income-subtraction': {
    title: 'Wisconsin’s $24,000 age-67 retirement subtraction is per-recipient and credits-restricted; the pack caps pooled income and skips the election',
    statement:
      'The 2025 Schedule SB instructions let an individual aged 67 or older subtract up to $24,000 of federally taxable qualified-plan or IRA retirement income the individual received, and a joint couple who are both 67 subtract up to $48,000 regardless of which spouse received it, with no federal AGI ceiling; claiming forfeits every Schedule CR credit and the credits on Form 1 lines 13 through 20 and 30 through 35 for the year, and the separate income-restricted Line 17 allows up to $5,000 at age 65 or older only when federal AGI is under $15,000 single / $30,000 joint. Approximated: the pack encodes `{ kind: \'capped\', capPerPerson: 24000, minAge: 67 }` — min(household retirement income, $24,000 × members 67 or older) — with no per-spouse attribution, no credit forfeiture, and no Line 17 limb. A both-67 couple matches the pooled $48,000 rule exactly, but a mixed-age couple has the $24,000 cap run against pooled income, sheltering dollars the under-67 spouse received that the instructions withhold and understating Wisconsin tax, while the unmodeled credit forfeiture and the unmodeled Line 17 subtraction run the other way — the engine models no Wisconsin nonrefundable credits and grants a 65- or 66-year-old nothing — overstating tax for those households. Social Security remains excluded by the pack\'s `taxesSocialSecurity: false`, matching the Schedule SB Line 4 limb. The separate 30% long-term capital-gain exclusion is registered at `wi-schedule-sb-line-5-long-term-capital-gain-exclusion`.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'The sign depends on household facts: which spouse received the retirement dollars decides the attribution limb (understates), while forgone credits and the Line 17 cohort decide the election limbs (overstate).',
    jurisdiction: 'state:WI',
    authority: [{
      kind: 'formInstruction',
      citation: '2025 Wisconsin Schedule SB Instructions, Line 4',
      url: 'https://www.revenue.wi.gov/TaxForms2025/2025-ScheduleSB-Inst.pdf',
      quotedText:
        'Social security benefits are not taxable for Wisconsin. You may subtract any social security benefits that were taxable on your federal Form 1040 or 1040-SR. Fill in on line 4 the amount from line 6b of federal Form 1040 or 1040-SR.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Wisconsin Schedule SB Instructions, Line 16',
      url: 'https://www.revenue.wi.gov/TaxForms2025/2025-ScheduleSB-Inst.pdf',
      quotedText:
        'If you (or your spouse if married and filing a joint return) were at least 67 years old as of December 31, 2025, you may subtract retirement income from a qualified retirement plan or individual retirement account (IRA) that is federally taxable and has not been removed from Wisconsin income on lines 12 through 15 of this schedule. Individuals may subtract up to $24,000 of retirement income received.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Wisconsin Schedule SB Instructions, Line 16 (joint pooled cap)',
      url: 'https://www.revenue.wi.gov/TaxForms2025/2025-ScheduleSB-Inst.pdf',
      quotedText:
        'A married couple who file a joint return and are both as least 67 years old as of December 31, 2025, may subtract up to $48,000 of retirement income, regardless of how much retirement income each spouse received.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Wisconsin Schedule SB Instructions, Line 16 (credit forfeiture)',
      url: 'https://www.revenue.wi.gov/TaxForms2025/2025-ScheduleSB-Inst.pdf',
      quotedText:
        'if you claim this subtraction, you may not claim any tax credit on Schedule CR and on lines 13 through 20 and 30 through 35 of the Form 1.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Wisconsin Schedule SB Instructions, Line 17',
      url: 'https://www.revenue.wi.gov/TaxForms2025/2025-ScheduleSB-Inst.pdf',
      quotedText:
        'You may subtract up to $5,000 of certain retirement income if: … Your federal adjusted gross income (line 3 of Form 1) is less than $15,000 ($30,000 if married filing a joint return).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#WI',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'wi-schedule-sb-line-5-long-term-capital-gain-exclusion': {
    title: 'Wisconsin excludes 30% of qualifying long-term capital gain; the pack taxes the whole gain as ordinary',
    statement:
      'Wisconsin Schedule SB instructions describe a 30% long-term capital-gain exclusion (60% for farm assets). Approximated: the pack\'s `capitalGainsAsOrdinary: true` omits that preference, so qualifying long-term gains enter the Wisconsin base in full and the engine overstates tax on those gains. The Social Security and age-67 retirement limbs are registered separately at `wi-stat-71-05-retirement-income-subtraction`.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:WI',
    authority: [{
      kind: 'formInstruction',
      citation: '2025 Wisconsin Schedule SB Instructions, Line 5',
      url: 'https://www.revenue.wi.gov/TaxForms2025/2025-ScheduleSB-Inst.pdf',
      quotedText:
        'For example, after completing Schedule WD, you may be able to include an amount as a subtraction on line 5 because you qualify for the 30% long-term capital gain exclusion (60% in the case of farm assets).',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Wisconsin Department of Revenue, Individual income tax rates',
      url: 'https://www.revenue.wi.gov/Pages/FAQS/pcs-taxrates.aspx',
      quotedText:
        'Wisconsin individual income tax rates vary from 3.50% to 7.65%, depending upon marital status and income.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#WI',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },
} satisfies Record<string, TaxRuleRecord>
