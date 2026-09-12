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
      url: 'https://www.ilga.gov/Documents/legislation/ilcs/documents/003500050K203.htm',
      quotedText:
        'An amount equal to all amounts included in such total pursuant to the provisions of Sections 402(a), 402(c), 403(a), 403(b), 406(a), 407(a), and 408 of the Internal Revenue Code, or included in such total as distributions under the provisions of any retirement or disability plan for employees of any governmental agency or unit, or retirement payments to retired partners, which payments are excluded in computing net earnings from self employment by Section 1402 of the Internal Revenue Code and regulations adopted pursuant thereto;',
    }, {
      kind: 'statute',
      citation: '35 ILCS 5/203(a)(2)',
      url: 'https://www.ilga.gov/Documents/legislation/ilcs/documents/003500050K203.htm',
      quotedText:
        'and by deducting from the total so obtained the sum of the following amounts:',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-04',
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

  'il-ita-203-a-2-L-social-security-subtraction': {
    title: 'Illinois deducts Social Security included under IRC section 86',
    statement:
      'Illinois base income deducts an amount equal to all Social Security benefits included in federal adjusted gross income pursuant to IRC section 86. That is what `taxesSocialSecurity: false` encodes: the federally taxable share is subtracted back out and never reaches the Illinois base. The adjacent (L) clause also names railroad retirement benefits included under IRC sections 72(r) and 86; this record claims only the Social Security limb and does not certify that the shared `ssBenefits` input establishes separate Railroad Retirement provenance.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:IL',
    authority: [{
      kind: 'statute',
      citation: '35 ILCS 5/203(a)(2)(L)',
      url: 'https://www.ilga.gov/Documents/legislation/ilcs/documents/003500050K203.htm',
      quotedText:
        'and by deducting from the total so obtained the sum of the following amounts: \u2026 (L) For taxable years ending after December 31, 1983, an amount equal to all social security benefits and railroad retirement benefits included in such total pursuant to Sections 72(r) and 86 of the Internal Revenue Code;',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-09',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.IL',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'mo-dor-2026-rate-schedule-and-standard-deduction': {
    title: 'Missouri publishes TY2026 whole-dollar chart bands and supported single/MFJ standard deductions',
    statement:
      'Form MO-1040ES (2026) publishes TY2026 federal basic standard-deduction cells of $16,100 single and $32,200 married filing jointly (and combined Missouri). Those are the basic amounts under Rev. Proc. 2025-32 section 4.14, not the full allowable federal standard deduction. RSMo §143.131(2) provides that the Missouri standard deduction is the allowable federal standard deduction; under the federal sibling record `irc-63-c-7-B-ii-conformed-state-deduction-tracks-federal`, that allowable amount is the basic amount plus each IRC §63(f) additional amount for age 65 or older. The pack\'s `standardDeductionConformity: \'federal\'` therefore applies $18,150 for a single age-65 filer and $33,850 or $35,500 for an MFJ household with one or two age-65 people on top of these basic cells. Settled only for those supported single/MFJ basic deduction cells and the age relief represented by `peopleAged65Plus`; blindness, dependent-filer limitations, head-of-household $24,150, married-filing-separate paths, combined-return per-spouse allocation, and itemization are outside this record. The form also lists a whole-dollar tax-rate chart with a $0 band through $1,348, graduated bands in $1,348 steps through 4.5% at $9,436, and $263 plus 4.7% of excess over $9,436 above that. The pack stores those bracket cells and represents the chart as continuous marginal breakpoints at the band edges. Approximated: DOR publishes accumulated-tax constants at each band boundary (for example $202 at $8,088 and $263 at $9,436) while bracketTax composes marginal slices continuously, so pre-return tax can differ in either direction from the chart before whole-dollar Line 10 rounding — which this record does not model. At taxable $9,436 the chart arithmetic is $202 + 4.5% × ($9,436 − $8,088) = $262.66 versus the pack\'s continuous $262.86; at $10,000 it is $263 + 4.7% × $564 = $289.508 versus $289.368. Retirement exemptions and return-level whole-dollar rounding remain outside this record.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'The MO-1040ES chart quotes accumulated tax at band floors; bracketTax applies continuous marginal rates between breakpoints. Intermediate chart comparison is therefore stated at pre-return precision with whole-dollar return rounding omitted. The signed gaps at the pinned taxable-income coordinates are preserved rather than closed by parameter edits.',
    jurisdiction: 'state:MO',
    authority: [{
      kind: 'formInstruction',
      citation: 'Missouri DOR, Form MO-1040ES (2026), form year header',
      url: 'https://dor.mo.gov/forms/MO-1040ES_2026.pdf',
      quotedText:
        'Form MO-1040ES 2026 Declaration of Estimated Tax for Individuals',
    }, {
      kind: 'formInstruction',
      citation: 'Missouri DOR, Form MO-1040ES (2026), worksheet Line 6 basic standard deduction',
      url: 'https://dor.mo.gov/forms/MO-1040ES_2026.pdf',
      quotedText:
        'Missouri standard deductions are: (1) Single - $16,100 (2) Head of household - $24,150; (3) Married filing joint federal and combined Missouri or Qualifying widow(er) with dependent child - $32,200; (4) Married filing separate returns $16,100.',
    }, {
      kind: 'statute',
      citation: 'RSMo §143.131(2)',
      url: 'https://revisor.mo.gov/main/OneSection.aspx?section=143.131',
      quotedText:
        'The Missouri standard deduction shall be the allowable federal standard deduction.',
    }, {
      kind: 'irsNotice',
      citation: 'Rev. Proc. 2025-32, section 4.14, 2026 standard deduction',
      url: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
      quotedText:
        'In general. For taxable years beginning in 2026, the standard deduction amounts under § 63(c)(2) are as follows: … Married Individuals Filing Joint Returns and Surviving Spouses (§ 1(j)(2)(A)) $32,200 … Unmarried Individuals (other than Surviving Spouses and Heads of Households) (§ 1(j)(2)(C)) $16,100 … Aged or blind. For taxable years beginning in 2026, the additional standard deduction amount under § 63(f) for the aged or the blind is $1,650. The additional standard deduction amount is increased to $2,050 if the individual is also unmarried and not a surviving spouse.',
    }, {
      kind: 'formInstruction',
      citation: 'Missouri DOR, Form MO-1040ES (2026), tax rate chart zero band',
      url: 'https://dor.mo.gov/forms/MO-1040ES_2026.pdf',
      quotedText:
        '$0 to $1,348                                             $0',
    }, {
      kind: 'formInstruction',
      citation: 'Missouri DOR, Form MO-1040ES (2026), tax rate chart 2.0% band',
      url: 'https://dor.mo.gov/forms/MO-1040ES_2026.pdf',
      quotedText:
        'Over $1,348 but not over $2,696                          2.0% of excess over $1,348',
    }, {
      kind: 'formInstruction',
      citation: 'Missouri DOR, Form MO-1040ES (2026), tax rate chart 2.5% band',
      url: 'https://dor.mo.gov/forms/MO-1040ES_2026.pdf',
      quotedText:
        'Over $2,696 but not over $4,044                          $27 plus 2.5% of excess over $2,696',
    }, {
      kind: 'formInstruction',
      citation: 'Missouri DOR, Form MO-1040ES (2026), tax rate chart 3.0% band',
      url: 'https://dor.mo.gov/forms/MO-1040ES_2026.pdf',
      quotedText:
        'Over $4,044 but not over $5,392                          $61 plus 3.0% of excess over $4,044',
    }, {
      kind: 'formInstruction',
      citation: 'Missouri DOR, Form MO-1040ES (2026), tax rate chart 3.5% band',
      url: 'https://dor.mo.gov/forms/MO-1040ES_2026.pdf',
      quotedText:
        'Over $5,392 but not over $6,740                          $101 plus 3.5% of excess over $5,392',
    }, {
      kind: 'formInstruction',
      citation: 'Missouri DOR, Form MO-1040ES (2026), tax rate chart 4.0% band',
      url: 'https://dor.mo.gov/forms/MO-1040ES_2026.pdf',
      quotedText:
        'Over $6,740 but not over $8,088                          $148 plus 4.0% of excess over $6,740',
    }, {
      kind: 'formInstruction',
      citation: 'Missouri DOR, Form MO-1040ES (2026), tax rate chart 4.5% band',
      url: 'https://dor.mo.gov/forms/MO-1040ES_2026.pdf',
      quotedText:
        'Over $8,088 but not over $9,436                          $202 plus 4.5% of excess over $8,088',
    }, {
      kind: 'formInstruction',
      citation: 'Missouri DOR, Form MO-1040ES (2026), tax rate chart 4.7% top band',
      url: 'https://dor.mo.gov/forms/MO-1040ES_2026.pdf',
      quotedText:
        'Over $9,436 ................................             $263 plus 4.7% of excess over $9,436',
    }, {
      kind: 'formInstruction',
      citation: 'Missouri DOR, Form MO-1040ES (2026), tax rate chart whole-dollar example',
      url: 'https://dor.mo.gov/forms/MO-1040ES_2026.pdf',
      quotedText:
        '$1,304) = $59.60 The whole dollar to enter on Line 10 would be $60.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-09-12',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#MO',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#bracketTax',
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
    title: 'Iowa excludes qualifying retirement for age, disability, and survivors',
    statement: 'Iowa Code 422.7(19)(a) excludes federally included qualifying retirement income when the recipient is disabled, at least 55, or the surviving spouse or insurable-interest survivor of an individual who would qualify that tax year. Each characterized event applies its own eligibility; an unknown eligibility fact is incomplete. Military and Railroad Retirement Act amounts follow their separate categorical treatment. No general age-only proxy establishes these limbs.',
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
    verifiedOn: '2026-09-12',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/tax/stateIowaRetirement.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.IA',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult',
      'packages/engine/src/tax/stateIowaRetirement.ts#iowaDistributionExclusion',
      'packages/engine/src/tax/stateIowaRetirement.ts#iowaRetirementExclusionTotal',
    ],
  },

  'iowa-code-422-7-8-social-security-subtraction': {
    title: 'Iowa subtracts Social Security taxable under IRC section 86',
    statement:
      'Iowa subtracts, to the extent included, the amount of Social Security benefits taxable under IRC section 86. That is what `taxesSocialSecurity: false` encodes: the federally taxable share is subtracted back out and never reaches the Iowa base.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:IA',
    authority: [{
      kind: 'statute',
      citation: 'Iowa Code 422.7(8) (2026)',
      url: 'https://www.legis.iowa.gov/docs/code/422.7.pdf',
      quotedText:
        'Subtract, to the extent included, the amount of social security benefits taxable under section 86 of the Internal Revenue Code.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-09',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.IA',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
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
    statement: 'The complete closed enumeration in N.D.C.C. 57-38-30.3(2)(a)–(t), together with subsection (1) limiting eligibility to specifically provided adjustments, contains no general subtraction for ordinary private pensions, annuities or traditional IRA distributions. Explicit exceptions include federally protected income and RRB under (a), retired military personnel benefits under (r), Social Security under (s), and qualified retired law enforcement personnel benefits under (t). This is a bounded negative inference from the entire list, not a quotation saying all retirement is taxable. The existing coarse public-pension approximation remains separately relevant: source and service facts must not be inferred from a public-income aggregate.',
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
    }, {
      kind: 'statute',
      citation: 'N.D.C.C. 57-38-30.3(1)',
      url: 'https://ndlegis.gov/cencode/t57c38.pdf',
      quotedText:
        'A taxpayer computing the tax under this section is only eligible for those adjustments or credits that are specifically provided for in this section.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Form ND-1 booklet, p. 11, line 1b',
      url: 'https://www.tax.nd.gov/sites/www/files/documents/forms/individual/2025-iit/2025-individual-income-tax-booklet.pdf',
      quotedText: 'On Form 1040 or 1040-SR, line 15, you are instructed to enter “0” for your federal taxable income if it calculates out to be less than zero. However, for purposes of completing Form ND-1, enter the negative number on line 1b. Enter a minus sign (-) to the left of the number.',
    }, {
      kind: 'statute',
      citation: 'N.D.C.C. 57-38-30.3(2)(r)',
      url: 'https://ndlegis.gov/cencode/t57c38.pdf',
      quotedText:
        'Reduced by the amount received by a taxpayer as retired military personnel benefits, including retired military personnel benefits paid to the surviving spouse of a deceased retired member of the armed forces of the United States, a reserve component of the armed forces of the United States, or the national guard, but only to the extent the amount was included in federal taxable income.',
    }, {
      kind: 'statute',
      citation: 'N.D.C.C. 57-38-30.3(2)(a)–(t), complete enumeration',
      url: 'https://ndlegis.gov/cencode/t57c38.pdf',
      quotedText: '2. For purposes of this section, "North Dakota taxable income" means the federal taxable income of an individual, estate, or trust as computed under the Internal Revenue Code of 1986, as amended, adjusted as follows: a. Reduced by interest income from obligations of the United States and income exempt from state income tax under federal statute or United States or North Dakota constitutional provisions. b. Reduced by the portion of a distribution from a qualified investment fund described in section 57-38-01 which is attributable to investments by the qualified investment fund in obligations of the United States, obligations of North Dakota or its political subdivisions, and any other obligation the interest from which is exempt from state income tax under federal statute or United States or North Dakota constitutional provisions. c. Reduced by the amount equal to the earnings that are passed through to a taxpayer in connection with an allocation and apportionment to North Dakota under section 57-38-01.35. d. Reduced by forty percent of: (1) The excess of the taxpayer\'s net long-term capital gain for the taxable year over the net short-term capital loss for that year, as computed for purposes of the Internal Revenue Code of 1986, as amended. The adjustment provided by this subdivision is allowed only to the extent the net long-term capital gain is allocated to this state. (2) Qualified dividends as defined under Internal Revenue Code section 1(h) (11), added by section 302(a) of the Jobs and Growth Tax Relief Reconciliation Act of 2003 [Pub. L. 108-27; 117 Stat. 752; 2 U.S.C. 963 et seq.], but only if taxed at a federal income tax rate that is lower than the regular federal income tax rates applicable to ordinary income. If, for any taxable year, qualified dividends are taxed at the regular federal income tax rates applicable to ordinary income, the reduction allowed under this subdivision is equal to thirty percent of all dividends included in federal taxable income. The adjustment provided by this subdivision is allowed only to the extent the qualified dividend income is allocated to this state. e. Increased by the amount of a lump sum distribution for which income averaging was elected under section 402 of the Internal Revenue Code of 1986 [26 U.S.C. 402], as amended. This adjustment does not apply if the taxpayer received the lump sum distribution while a nonresident of this state and the distribution is exempt from taxation by this state under federal law. … f. Increased by an amount equal to the losses that are passed through to a taxpayer in connection with an allocation and apportionment to North Dakota under section 57-38-01.35. g. Reduced by the amount of military pay received by a taxpayer as a member of the armed forces of the United States on federal active duty, member of the national guard or reserve member of the armed forces of the United States, to the extent that military pay is included in North Dakota taxable income of the taxpayer. For purposes of this subdivision, "military pay" includes all federal pay for training, education, mobilization, and bonuses and state pay when called to support an emergency on state active duty. h. Reduced by income from a new and expanding business exempt from state income tax under section 40-57.1-04. i. Reduced by up to ten thousand dollars of qualified expenses that are related to a donation by a taxpayer or a taxpayer\'s dependent, while living, of one or more human organs to another human being for human organ transplantation. A taxpayer may claim the reduction in this subdivision only once for each instance of organ donation during the taxable year in which the human organ donation and the human organ transplantation occurs but if qualified expenses are incurred in more than one taxable year, the reduction for those expenses must be claimed in the year in which the expenses are incurred. For purposes of this subdivision: (1) "Human organ transplantation" means the medical procedure by which transfer of a human organ is made from the body of one person to the body of another person. (2) "Organ" means all or part of an individual\'s liver, pancreas, kidney, intestine, lung, or bone marrow. (3) "Qualified expenses" means lost wages not compensated by sick pay and unreimbursed medical expenses as defined for federal income tax purposes, to the extent not deducted in computing federal taxable income, whether or not the taxpayer itemizes federal income tax deductions. j. Increased by the amount of the contribution upon which the credit under section 57-38-01.21 is computed, but only to the extent that the contribution reduced federal taxable income. k. Reduced by the amount of any payment received by a veteran or beneficiary of a veteran under section 37-28-03 or 37-28-04. l. Reduced by the amount received by a taxpayer that was paid by an employer under paragraph 4 of subdivision a of subsection 2 of section 57-38-01.25 to hire the taxpayer for a hard-to-fill position under section 57-38-01.25, but only to the extent the amount received by the taxpayer is included in federal taxable income. The reduction applies only if the employer is entitled to the credit under section 57-38-01.25. The taxpayer must attach a statement from the employer in which the employer certifies that the employer is entitled to the credit under section 57-38-01.25 and which specifically identified the type of payment and the amount of the exemption under this section. m. Reduced by the amount up to a maximum of five thousand dollars, or ten thousand dollars if a joint return is filed, for contributions made under a higher education savings plan administered by the Bank of North Dakota, pursuant to section 6-09-38. n. Reduced by the amount of income of a taxpayer, who resides anywhere within the exterior boundaries of a reservation situated in this state or situated both in this state and in an adjoining state and who is an enrolled member of a federally recognized Indian tribe, from activities or sources anywhere within the exterior boundaries of a reservation situated in this state or both situated in this state and in an adjoining state. o. For married individuals filing jointly, reduced by an amount equal to the excess of the recomputed itemized deductions or standard deduction over the amount of the itemized deductions or standard deduction deducted in computing federal … taxable income. For purposes of this subdivision, "itemized deductions or standard deduction" means the amount under section 63 of the Internal Revenue Code that the married individuals deducted in computing their federal taxable income and "recomputed itemized deductions or standard deduction" means an amount determined by computing the itemized deductions or standard deduction in a manner that replaces the basic standard deduction under section 63(c)(2) of the Internal Revenue Code for married individuals filing jointly with an amount equal to double the amount of the basic standard deduction under section 63(c) (2) of the Internal Revenue Code for a single individual other than a head of household and surviving spouse. If the married individuals elected under section 63(e) of the Internal Revenue Code to deduct itemized deductions in computing their federal taxable income even though the amount of the allowable standard deduction is greater, the reduction under this subdivision is not allowed. Married individuals filing jointly shall compute the available reduction under this subdivision in a manner prescribed by the tax commissioner. p. Reduced by an amount equal to four thousand one hundred fifty dollars for taxable year 2018, for each birth resulting in stillbirth, as defined in section 23-02.1-01, for which a fetal death certificate has been filed under section 23-02.1-20. For taxable years beginning after December 31, 2018, the deduction amount must be adjusted annually on January first of each year by the cost-of-living adjustment. For purposes of this subdivision, "cost-of-living adjustment" means the percentage increase in the consumer price index for all urban consumers in the midwest region as determined by the United States department of labor, bureau of labor statistics, for the most recent year ending December thirty-first. The exemption may only be claimed in the taxable year in which the stillbirth occurred. q. Reduced by the amount of expenses incurred by an employee which are directly related to the attainment of higher education or career and technical education which are reimbursed by the employee\'s employer, but only to the extent the amount of reimbursement is reported as federal taxable income. r. Reduced by the amount received by a taxpayer as retired military personnel benefits, including retired military personnel benefits paid to the surviving spouse of a deceased retired member of the armed forces of the United States, a reserve component of the armed forces of the United States, or the national guard, but only to the extent the amount was included in federal taxable income. s. Reduced by the amount of social security benefits included in a taxpayer\'s federal adjusted gross income under section 86 of the Internal Revenue Code. t. Reduced by the amount of retired law enforcement personnel benefits received by a taxpayer who has served a combined total of at least twenty years as a peace officer or has medically retired from the taxpayer\'s duties as a peace officer with a medical certificate due to a permanent mental or physical disability that rendered the taxpayer unable to discharge the taxpayer\'s duties as a peace officer, but only to the extent the amount was included in federal taxable income. For purposes of this subdivision: (1) "Peace officer" means a public servant authorized by law or by a government agency or branch of the United States, a state, or a political subdivision of a state to enforce the law and to conduct or engage in investigations of violations of the law. (2) "Retired law enforcement personnel benefits" means retirement income received by a taxpayer eligible to receive retirement income attributable to the taxpayer\'s employment as a peace officer from a retirement plan maintained by or through the employer from which the taxpayer retired as a peace officer.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Form ND-1 instructions, Line 9, licensed peace officer retirement',
      url: 'https://www.tax.nd.gov/sites/www/files/documents/forms/individual/2025-iit/2025-individual-income-tax-booklet.pdf',
      quotedText: 'Certain retirement benefits of a licensed peace officer are excludable from North Dakota taxable income. The exclusion is allowable for a retired licensed peace officer with a minimum of 20 years of service or that was retired disabled. If allowable, enter on this line the amount of taxable retirement benefits included in federal taxable income on Form 1040 or Form 1040-SR, line 5b. Only include benefits issued by your employer’s retirement plan, generally found on Form 1099-R, box 2a. Attach Form 1099-R to your return.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Form ND-1 instructions, Line 14, military retirement',
      url: 'https://www.tax.nd.gov/sites/www/files/documents/forms/individual/2025-iit/2025-individual-income-tax-booklet.pdf',
      quotedText: 'If you are a retired military service member, or a surviving spouse of a deceased retired military service member, you may deduct the amount of taxable military retirement benefits that you reported on Form 1040 or Form 1040-SR, line 5b. Include benefits received as a retired member of the U.S. armed forces or its reserve components, Army National Guard, or Air Force National Guard. “U.S. armed forces” means the Army, Navy, Air Force, Marine Corps, and Coast Guard. Retirement benefits received for federal civil service employment as a dual status military technician under Title 32 or Title 10 are also eligible for this deduction. Federal Taxable Income — One Big Beautiful Bill Act (OBBBA) Consent to Obtain Form 1099-G Electronically In July 2025, Congress passed H.R. 1, also known as the OBBBA. Among the changes were extensions of several tax provisions from the Tax Cuts and Jobs Act of 2017, along with several other new changes affecting both individual and business income taxes. The starting point for computing North Dakota taxable income perpetually conforms to the computation of federal taxable income. As a result, the federal changes to income and deductions that impact the computation of federal taxable income are by default included in the starting point for computing North Dakota taxable income for all years. Some of the federal changes affecting individuals are: The North Dakota Office of State Tax Department mails a paper Form 1099-G if there was an overpayment on the 2024 Form ND-EZ or Form ND-1 (last year\'s return), you itemized deductions on your federal return using Schedule A, and you have not previously consented to receive a Form 1099‑G electronically. If you have consented to receive Form 1099-G electronically, a paper 2025 Form 1099-G showing the overpayment amount will not be mailed to you. If this information is needed to complete your 2025 federal income tax return, it can be found on our website: tax.nd.gov/individual/form-1099-g using the 1099-G Lookup Tool. • Increased standard deduction across all filing statuses, with an additional $6,000 for some seniors. Online Payment Options • Increased state and local tax deduction to $40,000. • Tip income and overtime pay exclusions. Federal changes to federal income tax credits do not have any direct impact on the computation of North Dakota income tax credits. Reminder — Contribution Tax Credit Documentation If claiming a tax credit for a contribution, in addition to any required schedule, attach a copy of the letter you received from the school or charitable organization to substantiate your contribution and prevent delays in processing your return. Some commonly used credit Schedules are: • Schedule ND-1PSC: Nonprofit private school tax credits for individuals. • Schedule ND-1QEC: Qualified endowment fund tax credit. • Schedule MCP: Contributions to a maternity home, child placing agency, or pregnancy help center. North Dakota offers a variety of online payment options for submitting an estimated tax payment, extension payment, or payment of a balance due on a return. For convenience, security, and reassurance knowing the payment was timely received by our office, you are encouraged to pay online with a free electronic check or a debit or credit card using North Dakota Taxpayer Access Point (ND TAP). To pay online, go to: tax.nd.gov/payment. Choosing a Tax Return Preparer You are ultimately responsible for the accuracy of your tax return. Here are some tips to consider when selecting a tax return preparer: • Choose a reputable tax professional. Do your research and ask trusted family or friends for recommendations. • Make sure your preparer provides a copy of your tax returns for your records. • Select a preparer based on your needs. Some preparers are open seasonally and others are available year-round. Stay Informed Individuals, businesses, or other interested persons may sign up to receive email notifications when a newsletter or other important information is issued by the Office of State Tax Commissioner. To sign up, go to tax.nd.gov and select “News Center” at the top of the page. Then select “Email Sign-Up”. North Dakota This page intentionally left blank. 3 4 North Dakota General information for all filers Steps to completing your return Step Action  1  2  3 Determine if you have to file a return ............................... current page Complete your federal return......................................................page 7 Determine which form to use......................................................page 6 Have you considered e-filing your return? ...............................page 1  4 Go to the applicable instructions If using Form ND-EZ ................................................................page 9 If using Form ND-1 .................................................................page 11  5  6  7 Assemble your completed return..............................................page 28 Read “Before you file” ................................................. page 10 or 16 File your return on or before April 15, 2026 Where to file .............................................................................page 7 Need an extension? .................................................................page 7 Who must file a return Full‑year resident If you were a full-year resident of North Dakota for the 2025 tax year and you are required to file a 2025 federal individual income tax return, you must file a 2025 North Dakota individual income tax return. This applies even if you worked outside North Dakota (including employment overseas) during the tax year or have income from sources outside North Dakota. You were a full-year resident of North Dakota if you were a resident of North Dakota for the entire tax year or meet the statutory 7-month rule— see “Statutory 7-month rule” on this page. Definition of resident—In these instructions, the term “resident” refers to an individual who is a legal resident of North Dakota. Legal residence (which is also called domicile) means the place that is your permanent home to which you always intend to return whenever absent from it. If you have more than one physical place of abode, only one of them may be your legal residence. Legal residence is based on your intent and your actions. Statutory 7‑month rule—Even though you were not a resident of North Dakota for any part of the tax year—that is, you were a fullyear nonresident—you must file as a full-year resident of North Dakota if you maintain a permanent place of abode in North Dakota and spend in the aggregate more than 210 days of the tax year in North Dakota. A permanent place of abode means a house, apartment, or other dwelling containing cooking and bathroom facilities that is suitable for year-round living and is maintained on a permanent or indefinite basis. This 7-month rule does not apply if you were (1) a partyear resident of North Dakota, (2) a full-year nonresident serving in the U.S. armed forces, or (3) a full-year resident of Montana or Minnesota covered by reciprocity. Resident in U.S. armed forces—If you were a full-year resident of North Dakota serving in the U.S. armed forces during the 2025 tax year and you are required to file a 2025 federal individual income tax return, you must file a 2025 North Dakota individual income tax return as a full-year resident. This applies regardless of where you were stationed during 2025. Civilian spouse of U.S. armed forces service member—If you are a civilian spouse of a U.S. armed forces service member, you must file a 2025 North Dakota individual income tax return if both of the following apply: • You are required to file a 2025 federal individual income tax return. • You were a full-year resident of North Dakota for the 2025 tax year. You are treated as a resident for this purpose if you elect under the federal Servicemembers Civil Relief Act to be a North Dakota resident for state tax purposes. For more information, see the Civilian Spouses of Military Service Members income tax guideline. Full‑year nonresident If you were a full-year nonresident of North Dakota for the 2025 tax year, you must file a 2025 North Dakota individual income tax return if both of the following apply: • You are required to file a 2025 federal individual income tax return. • You derived gross income from North Dakota sources during the 2025 tax year. (See the box on page 5 for what is included in gross income from North Dakota sources.) You were a full-year nonresident if you were not a resident of North Dakota for any part of the tax year and do not meet the statutory 7-month rule—see “Statutory 7-month rule” on this page. Nonresident in U.S. armed forces—If you were a full-year nonresident of North Dakota serving in the U.S. armed forces during the 2025 tax year and you are required to file a 2025 federal individual income tax return, you must file a 2025 North Dakota individual income tax return as a full-year nonresident if you have gross income from North Dakota sources other than your military compensation. North Dakota Civilian spouse of U.S. armed forces service member—If you are a civilian spouse of a U.S. armed forces service member, you are not required to file a 2025 North Dakota individual income tax return if all of the following apply: Minnesota or Montana resident—If you were a full-year resident of Minnesota for the 2025 tax year, you do not have to file a 2025 North Dakota individual income tax return if both of the following apply: • Your service member spouse’s permanent duty station is in North Dakota. • Your only gross income from North Dakota sources was compensation for personal or professional services. • Your only gross income from North Dakota sources was wages for work performed in North Dakota. • You returned to your home in Minnesota at least once each month during the time you worked in North Dakota. • You resided in North Dakota only because you wanted to live with your service member spouse. • Both you and your service member spouse were full-year nonresidents of North Dakota for the 2025 tax year. You are treated as a nonresident for this purpose if you elect under the federal Servicemembers Civil Relief Act to be a resident of a state other than North Dakota for state tax purposes. For more information, see the Civilian Spouses of Military Service Members income tax guideline. If you were a full-year resident of Montana for the 2025 tax year, you do not have to file a 2025 North Dakota individual income tax return if your only gross income from North Dakota sources was wages. See “Reciprocity” on page 6 for more information. Nonresident alien—If you were a nonresident alien of the United States and received gross income from North Dakota sources during the 2025 tax year, you must file a 2025 North Dakota individual income tax return. Except where an income tax treaty Gross income from North Dakota sources for nonresidents only For a nonresident, “gross income from North Dakota sources” includes the following: • Compensation for services performed in North Dakota, such as wages, salaries, tips, commissions, and fees. • Income from tangible property in North Dakota, such as rents, oil and gas royalties, and gain from the sale or exchange of the property. • Income from a trade or business carried on in North Dakota, whether as a sole proprietorship, partnership, S corporation, or limited liability company treated like a partnership or S corporation. • Income from an estate or trust, but only to the extent the income is derived from tangible property or a trade or business in North Dakota. • Income from gambling activity carried on in North Dakota. • Unemployment compensation attributable to previous employment in North Dakota. Exceptions Gross income from North Dakota sources does not include these items received while a nonresident of North Dakota: military pay, interest, dividends, pensions, annuities, gain from the sale or exchange of intangible property, compensation exempted under reciprocity with Minnesota or Montana, compensation exempted under federal military and interstate commerce laws, or compensation exempted under North Dakota’s mobile workforce exemption. Note: Interest, dividends, gains, and other income from intangible property are included in gross income from North Dakota sources if derived from a trade or business carried on in North Dakota, such as a sole proprietorship, partnership, or S corporation. 5 between the United States and a foreign country specifically exempts income from taxation by a U.S. state, income tax treaties between the U.S. and foreign countries do not apply for North Dakota income tax purposes. Therefore, you may have to pay North Dakota income tax on gross income from North Dakota sources even though the income is exempt from U.S. income tax because of a treaty. For more information, see the guideline Income Taxation of Nonresident Aliens under “Guidelines” at tax.nd.gov. Disaster recovery tax exemptions— Exemptions from state and local tax filing and payment obligations are available to out-ofstate businesses and their employees who are in North Dakota on a temporary basis for the sole purpose of repairing or replacing natural gas, electrical, or telecommunication transmission property that is damaged, or under threat of damage, from a state-or presidentially-declared disaster or emergency. For more information, go to tax.nd.gov. Part‑year resident If you were a part-year resident of North Dakota for the 2025 tax year, you must file a 2025 North Dakota individual income tax return if both of the following apply: • You are required to file a 2025 federal individual income tax return. • You derived gross income from (1) any source inside or outside North Dakota while you were a resident of North Dakota or (2) a North Dakota source while you were a nonresident of North Dakota. (See the box on this page for what is included in gross income from North Dakota sources while a nonresident.) You were a part-year resident of North Dakota if you were a resident of North Dakota for only part of the year. This generally applies if you moved into or out of North Dakota and the move constituted a change in your legal residence. See “Definition of resident” on page 4. 6 North Dakota Native Americans If you are a Native American, you are not subject to North Dakota income tax and do not have to file a North Dakota income tax return if all of the following apply: • You are enrolled as a member of a federally-recognized Indian tribe. • You lived on any Indian reservation in North Dakota. • You derived all of your income from sources on any Indian reservation in North Dakota. If any of the above criteria are not met, you may be subject to North Dakota income tax. For more information, see the guideline Income Taxation of Native Americans under “Guidelines” at tax.nd.gov. Which form to use If you are required to file a 2025 North Dakota individual income tax return, see the box on this page to determine whether you should use Form ND-EZ or Form ND-1. Reciprocity North Dakota has income tax reciprocity agreements with the states of Minnesota and Montana. If certain conditions in the agreements are met, compensation for services is taxable only by the state of residence. Minnesota and Montana residents If you are a resident of Minnesota and maintain a permanent home in Minnesota to which you return at least once each month during the time you work in North Dakota, the compensation you receive for personal or professional services performed in North Dakota is not taxable by North Dakota. If you are a resident of Montana, wages you receive for work performed in North Dakota are not taxable by North Dakota. If you received wages covered by reciprocity, and your employer withheld North Dakota income tax of $5.00 or more from them, you must file a North Dakota individual income tax return at the end of the tax year to obtain a refund of the amount withheld. If this applies to you and you do not have any other gross income from North Dakota sources, complete Form ND-1 as follows: Which form to use—Form ND-EZ or Form ND-1? Use Form ND-EZ ....... if you answer No to ALL of the questions below. Use Form ND‑1 .......... if you answer Yes to ANY of the questions below. Note: If you are filing a joint return with your spouse, check “Yes” if the answer is “Yes” for either you or your spouse. Yes No 1. Were you a nonresident of North Dakota at any time in 2025? ...................... 2. Do you have any North Dakota addition adjustments? (*See Form ND-1, lines 2-3)............................................................................ 3. Do you have any North Dakota subtraction adjustments? (*See Form ND-1, lines 5-16).......................................................................... 4. Are you claiming any North Dakota tax credits? (*See Form ND-1, lines 21-23)........................................................................ 5. Did you pay, or were you required to pay, North Dakota estimated income tax for 2025, or did you apply an overpayment (refund) from your 2024 North Dakota return as an estimated payment for 2025? (*See Form ND-1, line 27) .................... 6. Are you going to use the 3-year income averaging method for farm income (on Schedule ND-1FA) to calculate your tax? ....................... 7. Are you going to make an extension payment on Form ND-1EXT? * The references show where to find more information. 1. Complete the applicable items at the top of Form ND-1, page 1 (through line E), as instructed. 2. For item F, fill in the circle next to “MN/MT RECIPROCITY” at the top of Form ND-1, page 1. Also enter “MN” or “MT”, whichever applies, in the space under “State.” 3. Leave lines 1 through 25 blank. 4. Fill in the amount of the North Dakota income tax withheld on lines 26, 28, 29, and 32. 5. File Form ND-1 with a copy of your federal return and Form W-2s showing North Dakota income tax withholding. If your wages are covered by reciprocity and you do not want your employer to withhold North Dakota income tax from them, you must obtain and complete Form NDW-R and give it to your employer. North Dakota residents If you are a resident of North Dakota and maintain a permanent home in North Dakota to which you return at least once each month during the time you work in Minnesota, the compensation that you receive for personal or professional services performed in Minnesota is not taxable by Minnesota. Also, wages you receive for work performed in Montana while a resident of North Dakota are not taxable by Montana. If you received wages covered by reciprocity and your employer withheld Minnesota or Montana income tax from them, you must file an income tax return with the applicable state to obtain a refund of the amount withheld. If your wages are covered by reciprocity and you do not want your employer to withhold Minnesota or Montana tax from them, you must give your employer a properly completed Minnesota Form MW-R or Montana Form MT-R, whichever applies. For assistance and forms, contact: • Minnesota Department of Revenue Email: individual.incometax@state.mn.us Phone: 651-296-3781 Website: revenue.state.mn.us • Montana Department of Revenue Email: DORCustomerAssistance@mt.gov Phone: 406-444-6900 Website: mtrevenue.gov North Dakota When and where to file If you are filing on a calendar year basis, you must file your 2025 North Dakota individual income tax return on or before April 15, 2026. If you are filing on a fiscal year basis, you must file on or before the 15th day of the fourth month following the close of your fiscal tax year. If the due date falls on a Saturday, Sunday or holiday, you have until the next day that is not a Saturday, Sunday, or holiday to file your return. Mail your return to: Office of State Tax Commissioner P.O. Box 5621 Bismarck, ND 58506-5621 Extension of time to file You may obtain an extension of time to file your North Dakota individual income tax return by obtaining either a federal extension or a North Dakota extension. Federal extension If you obtain an extension of time to file your federal return, it will be recognized for North Dakota individual income tax purposes. This includes the automatic extension allowed for being outside the U.S. and Puerto Rico on April 15. You do not have to file a separate state extension form or notify the Office of State Tax Commissioner that you have obtained a federal extension prior to filing your North Dakota return. Fill in the circle next to “Extension” at the top of Form ND-EZ or Form ND-1, whichever applies. North Dakota extension If you do not obtain a federal extension, but need additional time to file your North Dakota return, you may apply for a North Dakota extension by completing and filing Form 101. This is not an automatic extension—you must have good cause to request a North Dakota extension. Form 101 must be postmarked on or before the due date of your return. You will be notified whether your extension request is approved or rejected. If approved, fill in the circle next to “Extension” at the top of Form ND-EZ or Form ND-1, whichever applies. Extension interest If you obtain an extension and file your North Dakota return on or before the extended due date, and you pay any tax balance due with the return, no penalty will be charged. Interest on any tax due on the return will be charged at the rate of 12% per year from the original due date of your return to the earlier of the date you file your return or the extended due date. Prepayment of tax due If you are applying for an extension of time to file, you may prepay the tax that you expect to owe to avoid paying extension interest. For payment options, go to tax.nd.gov and select “Make A Payment.” If submitting a payment by paper check or money order, you must complete and submit a 2025 Form ND-1EXT payment voucher with the payment. Alternatively, you may submit a paper check or money order along with a letter containing the following: • Your name. • Your social security number. • Your address and phone number. • Statement that you are making a 2025 Form ND-1EXT payment. If you prepay your tax, you must file Form ND-1 and claim the payment on page 2, line 27; you may not file Form ND-EZ. Penalty and interest If you obtain an extension of time to file your return, you may pay the tax due by the extended due date of the return without penalty, but extension interest will apply—see “Extension interest” and “Prepayment of tax due” on this page. If you file your return by its due date (or extended due date), but you do not pay all of the tax due on it by the return’s due date (or extended due date), a penalty equal to 5% of the unpaid tax due or $5.00, whichever is greater, must be paid. If you file your return after its due date (or extended due date), and there is an unpaid tax due on it, a penalty equal to 5% of the unpaid tax due or $5.00, whichever is greater, applies for the month the return was due, with an additional 5% of the unpaid tax due for each month (or fraction of a month) the return remains delinquent, not to exceed 25% of the tax due. 7 In addition to any penalty, interest must be paid at the rate of 1% per month or fraction of a month, except for the month in which the tax was due, on any tax due that remains unpaid after the return’s due date (or extended due date). Federal income tax return You must complete your 2025 federal individual income tax return (Form 1040 or 1040-SR) before you complete your 2025 North Dakota individual income tax return. Certain information from your federal return is needed to complete your North Dakota return. If you are filing your North Dakota return on paper, you must attach a complete copy of your federal income tax return to your North Dakota return. A complete copy consists of Form 1040 or 1040-SR and all supplemental forms and schedules. You do not have to include depreciation schedules or any other statements that you may have prepared as supporting documentation to your federal return. Changing your return If you need to change your North Dakota return after you file it, you must file an amended return. There is no special form for this purpose. See “How to prepare an amended return” on page 8. If you paid too much tax because of an error in your return, you generally have three years after you file your original return to file an amended return to correct the error and claim a refund of the overpayment. For other time periods that may apply, see North Dakota Century Code § 57-38-40 or contact the Office of State Tax Commissioner. Penalty and interest apply to additional tax due on an amended return. Change to federal return By law, you must file an amended North Dakota return to report changes made to your federal return. This applies whether the changes are attributable to your filing of an amended federal return or an audit or correction by the IRS. The amended North Dakota return must be filed within 90 days after filing the amended federal return or within 90 days after the final determination of the IRS changes. 8 North Dakota How to prepare an amended return 1. Obtain a blank Form ND-1 for the tax year affected by the changes. 2. Enter your name, current address, social security number, and other information required at top of return. 3. Fill in the circle next to “Amended return: General” or “Amended return: Federal NOL,” whichever applies, in the top righthand corner of the return. See “Amended return” on page 11 for more information. 4. Complete the return through the net tax liability line. 5. Leave the line for income tax withholding blank unless you are claiming an additional amount not previously claimed. 6. On the “Total payments” line, enter the net tax liability shown on your original return or previously filed amended return. If the net tax liability has not been fully paid at the time the amended return is filed, only enter the amount of tax that has been paid. 7. Complete the remaining portion of the return according to the instructions. On an amended return, you may not adjust the amount of any voluntary contribution, nor the amount of an overpayment applied to the next year’s estimated tax. 8. Attach a statement explaining why you are changing your return. If you are doing so because of changes you or the IRS made to your federal return, attach a copy of the amended federal return or IRS notice. If amending to claim a net operating loss carryback, attach Form 1045 or 1040X. 9. Write "State Only Amended" at the top of Form ND-1 if filing a paper return. Estimated tax requirement (for 2026) How to file a return for a deceased taxpayer You must pay estimated North Dakota income tax for the 2026 tax year if all of the following conditions apply: If a final federal income tax return is required to be filed for a decedent for the year of death, a final North Dakota income tax return also must be filed. A court-appointed personal representative is responsible for filing the decedent’s final return, even if there is a surviving spouse. The information from the final federal return is used to complete the final North Dakota return, and the North Dakota return is to be signed in the same manner as required for federal income tax purposes. If there is a personal representative and no surviving spouse, a copy of the court document showing the appointment must be attached to the final return. If there is a surviving spouse and the final return will be filed on a joint basis, a refund will be mailed in both spouses’ names. 1. You are required to pay estimated federal income tax for 2026. 2. Your North Dakota net tax liability for 2025 is $1,000 or more. (If you are not required to file a North Dakota return for 2025, you do not have to pay estimated tax for 2026.) 3. You expect to owe (after subtracting any estimated North Dakota income tax withholding) at least $1,000 in North Dakota income tax for 2025. 4. You expect your North Dakota income tax withholding for 2026 to be less than the smaller of the following: (a) 90% of your 2026 North Dakota net tax liability. Note: Substitute 66 2/3% if a qualified farmer—see instructions for 2026 Form ND-1ES. (b) 100% of your 2025 North Dakota net tax liability. If you moved into North Dakota during 2025 and had no income from North Dakota prior to the move, this 100% threshold does not apply; you must satisfy the 90% threshold in part (a). In general, one-fourth (25%) of the total estimated tax required to be paid for the 2026 tax year must be paid by April 15, June 15, and September 15, 2026, and January 15, 2027. For payment options, go to tax.nd.gov and select “Make A Payment.” If submitting a payment by paper check or money order, you must complete and submit a 2026 Form ND-1ES payment voucher with the payment. If there is no surviving spouse and no personal representative has been appointed for the decedent, attach a copy of the death certificate and a copy of one of the following: • Letter of Testamentary. • Letter of Administration. • Affidavit for Collection of Personal Property of Decedent. For assistance, see back cover of booklet. Fill in the circle for “Deceased” and enter the date of death next to the deceased taxpayer’s name on Form ND-EZ or Form ND-1, whichever applies. Disclosure notification Upon written request from the chairman of a North Dakota legislative standing committee or Legislative Management, the law requires the Office of State Tax Commissioner to disclose the amount of any deduction or credit claimed on a tax return. Any other confidential information, such as a taxpayer’s name or social security number, may not be disclosed. North Dakota 9 2025 Form ND-EZ Instructions Before you begin . . . • Are you eligible to use Form ND-EZ? See “Which form to use” on page 6. • Be sure to have a copy of your completed 2025 federal income tax return (Form 1040 or 1040-SR) at hand. You will need information from it to complete Form ND-EZ. Note: A complete copy of your federal return must be filed with your state return. Instructions for top of Form ND-EZ Name and address Enter your full name and current address. If you are married and filing a joint return, include your spouse’s full name. If the taxpayer died during the 2025 tax year, fill in the circle for “Deceased” and enter the date of death. Social security numbers Enter your social security number. If married filing jointly, also enter your spouse’s social security number. Item A ‑ Filing status Fill in the circle next to the filing status that you used on your 2024 Form 1040 or 1040SR. Item B ‑ School district code Select the code number from the list of school district codes on page 19. Item C ‑ Income source code Select from the following list the code number corresponding to the area from which you derived the majority of your North Dakota sourced income for the tax year. Source Code number of income Farming, ranching, or agricultural production............................1 Retail, wholesale trade, and eating and drinking places .....................2 Federal, state, county, or city government service................................3 Public or private education ........................4 Accounting, legal, health, motel, and other personal or professional services not classified elsewhere...........5 Construction ..............................................6 Manufacturing ............................................7 Transportation, communication, and public utilities...................................8 Exploration, development, and extraction of coal, oil, and natural gas .............................................9 Banking, insurance, real estate, and other financial services .................10 Military service .........................................11 Retirement (Pensions, annuities, IRAs, etc.) ..........12 Item D ‑ Extension Fill in the circle next to “Extension” only if you have an extension to file your North Dakota return. See “Extension of time to file” on page 7. Instructions for lines 1‑9 of Form ND-EZ Line 1b ‑ Federal taxable income On Form 1040 or 1040-SR line 15, you are instructed to enter "-0-" for your federal taxable income if it calculates out to be less than zero. However, for purposes of completing Form ND-EZ, enter the negative number on line 1b. Enter a minus sign (-) to the left of the number. Line 3 ‑ Withholding Enter the North Dakota income tax withheld shown on a 2025 Form W-2, Form 1099, or North Dakota Schedule K-1. Also enter North Dakota income tax withheld shown on a 2024 North Dakota Schedule K-1 if the tax year of the partnership, S corporation, estate, or trust shown on the Schedule K-1 is a fiscal year ending in your 2025 tax year. Be sure the state identified on the Form W-2 or Form 1099 is North Dakota. Do not enter on this line North Dakota extraction or production taxes withheld from mineral interest income, such as an oil or gas royalty, because they are not income taxes. Include a copy of the Form W‑2, Form 1099, or North Dakota Schedule K‑1. Line 5 ‑ Voluntary contribution of overpayment If you have an overpayment on line 4, you may make a voluntary contribution of part or all of it to any of the three funds on this line. Enter the amount you wish to contribute on the line to the right of the fund name. If contributing, you must contribute at least $1.00 to the fund. A contribution will reduce your refund. Line 6 ‑ Direct deposit of refund If you want us to deposit your refund directly into your bank account, complete items a, b, and c below line 6. Check with your financial institution to see if it will accept direct deposit and to obtain the correct routing and account numbers. Routing number (Item b)—Enter the 9-digit routing number. The first two digits must be within the range of 01 through 12 or 21 through 32. Account number (Item c)—Enter the account number. It may have up to 17 digits (both letters and numbers). Include hyphens, but omit special symbols. If depositing into a checking account, see the sample check on page 10 for where to find the routing and account numbers. If depositing into a savings account without a check writing feature, ask your financial institution for the correct account number to use. 10 North Dakota Sample check for direct deposit (line 6) Taxpayer(s) Name(s) 9999 Main Ave. Anytown, ND 99999 Pay to Order of __________________________________________ 9999 15-0000/0000 $ __________ ________________________________________________________ Your Bank Anytown, ND USA 99999 Memo _______________________ Dollars ___________________________ : 123456789 : 12345678912345678 • 9999 Routing number (Item b) Account number (Item c) Do not include the check number as part of the account number. Please note: • Do not use the number on a deposit slip for the routing or account number. • You will not receive notification of when the deposit is made by our office. Contact your bank or check your bank statement to verify the deposit. • If the routing or account number is incorrect, or if your financial institution does not accept the direct deposit, a paper check will be issued. • Due to electronic banking rules, the Office of State Tax Commissioner will not allow a direct deposit to or through a foreign financial institution. In this case, a paper check will be issued. Line 8 ‑ Voluntary contribution If you have a tax due on line 7, you may make a voluntary contribution to any of the three funds on this line. Enter the amount you wish to contribute on the line to the right of the fund name. If contributing, you must contribute at least $1.00 to a fund. A contribution will increase your balance due. Line 9 ‑ Balance due The balance due must be paid in full with your return. You may pay the balance due online with an electronic check or a debit or credit card. To pay online, go to tax.nd.gov and select “Make A Payment.” If you are filing a paper return and paying the balance due with a paper check or money order, complete a 2025 Form ND-1PRV payment voucher and enclose it with the payment. However, if you are filing your return electronically, complete and submit a 2025 Form ND-1V with the paper check or money order. Make check or money order payable to “ND State Tax Commissioner,” and write the last four digits of your social security number and “2025 Form ND-EZ” on your check or money order. A check must be drawn on a U.S. or Canadian bank, be in U.S. dollars, and use a standard 9-digit routing number. A check drawn on a foreign bank (except one in Canada) cannot be accepted. Signatures Sign and date your return. If a joint return, both spouses must sign. Form 1099‑G consent and disclosure authorization At the bottom of Form ND-EZ (below line 9), fill in the applicable circle(s) to indicate if you want either or both of the following items to apply. Form 1099‑G consent. If there is an overpayment on your 2025 Form ND-EZ, line 4, federal tax law requires our office to file with the IRS and mail to you a Form 1099-G showing the overpayment amount. You may need this information when preparing your 2026 federal income tax return. Fill in the circle for this item if you want to obtain Form 1099-G electronically from our website instead of receiving it by mail. The 2026 Form 1099-G will be available on our website in January 2027. For more information, go to our website at tax.nd.gov. Disclosure authorization. Fill in the circle for this item if you want to authorize our office to communicate directly with your tax return preparer about your 2025 return. This may include requesting information needed to process the return and responding to inquiries from your preparer about correction notices you receive from us. The authorization does not allow your preparer to receive your refund check, to bind you in any way, or to legally represent you. The authorization only applies to the individual whose printed name and signature appear in the preparer’s signature area, and it automatically expires on the due date (including extensions) for filing your 2026 return. Before you file, did you—  Sign your return? An unsigned return is incomplete.  Include a complete copy of your federal return? Return is incomplete without it.  Write your social security number on return? We use this number to identify your return.  Check your math? Most common error made.  Include all Form W‑2s? Also include a copy of a 1099 or Schedule K-1 showing North Dakota withholding.  Use the correct postage? Avoid mailing problems by using the correct postage. Important! If your return is missing your signature or a copy of your federal return, it will be sent back to you. This may result in late filing and payment charges if you resubmit it after the due date. For worry-free filing, file your return electronically—see page 1! North Dakota 11 2025 Form ND‑1 Instructions Before you begin . . . • Be sure to have a copy of your completed 2025 federal income tax return (Form 1040 or 1040-SR) at hand. You will need information from it to complete Form ND-1. Note: A complete copy of your federal return must be filed with your state return. Nonresident of North Dakota for part or all of the 2025 tax year Social security numbers Item D ‑ Amended return If you were a nonresident of North Dakota for part or all of the 2025 tax year, first complete Form ND-1 through line 19. Then complete Schedule ND-1NR to calculate the amount of your tax. On Schedule ND-1NR, you will indicate whether you were a nonresident for part or all of the tax year by filling in your residency information at the top of the schedule. Enter your social security number (and your spouse’s social security number, if married filing jointly). If you are filing this return to change a return you previously filed for the 2025 tax year, fill in the circle next to: Item A ‑ Filing status If you are married and filing a joint return, and either you or your spouse was a nonresident of North Dakota for part or all of the tax year, you must complete Schedule ND-1NR on a joint basis and attach it to Form ND-1. On Schedule ND-1NR, each of you must indicate your residency status by filing in your residency information at the top of the schedule. Instructions for top of page 1 of Form ND‑1 Fiscal year filer only If you are filing your 2025 federal income tax return (Form 1040 or 1040-SR) on a fiscal year basis, you must file your 2025 North Dakota income tax return for the same fiscal year. Enter in the spaces provided at the top of Form ND-1 the ending date of your fiscal tax year. Name and address Enter your full name and current address. If you are married and filing a joint return, include your spouse’s full name. If the taxpayer died during the 2025 tax year, fill in the circle for “Deceased” and enter the date of death. Fill in the circle next to the filing status that you used on your 2025 Form 1040 or 1040-SR. Item B ‑ School district code Select the code number from the list of school district codes on page 19. Item C ‑ Income source code Select from the following list the code number corresponding to the area from which you derived the majority of your North Dakota sourced income for the tax year. Source Code number of income Farming, ranching, or agricultural production............................1 Retail, wholesale trade, and eating and drinking places .....................2 Federal, state, county, or city government service................................3 Public or private education ........................4 Accounting, legal, health, motel, and other personal or professional services not classified elsewhere...........5 Construction ..............................................6 Manufacturing ............................................7 Transportation, communication, and public utilities...................................8 Exploration, development, and extraction of coal, oil, and natural gas .............................................9 Banking, insurance, real estate, and other financial services .................10 Military service .........................................11 Retirement (Pensions, annuities, IRAs, etc.) ..........12 • Amended return: General— If you are changing the return for any reason other than a federal net operating loss carryback. • Amended return: Federal NOL— If you are changing the return because of a federal net operating loss carryback. See “Changing your return” on page 7 for more information. Item E ‑ Extension Fill in the circle next to “Extension” only if you have an extension to file your North Dakota return. See “Extension of time to file” on page 7. Item F ‑ MN/MT reciprocity Fill in the circle next to “MN/MT Reciprocity” only if you are a Minnesota or Montana resident who is filing this return solely to claim a refund of North Dakota income tax because of reciprocity. See page 6 for details. Instructions for lines 1‑37 of Form ND‑1 Line 1b ‑ Federal taxable income On Form 1040 or 1040-SR, line 15, you are instructed to enter “0” for your federal taxable income if it calculates out to be less than zero. However, for purposes of completing Form ND-1, enter the negative number on line 1b. Enter a minus sign (-) to the left of the number. 12 North Dakota Line 2 ‑ Contribution adjustment Enter on this line the amount, if any, from Schedule ND-1PG, line 15, or Schedule ND-1QEC, line 16. However, if you are claiming a credit on both Schedule ND-1PG, line 7, and Schedule ND-1QEC, line 5, or you are claiming an endowment credit from a North Dakota Schedule K-1, obtain and complete the Contribution Adjustment Worksheet to calculate the amount to enter on this line. The worksheet is available online at tax.nd.gov. Include a copy of the worksheet. If you claimed the standard deduction on your 2025 Form 1040 or 1040-SR, line 12, you do not have to make an adjustment on this line unless you are claiming a credit on Schedule ND-1QEC based on a contribution you made from an individual retirement account under I.R.C. § 408(d). See the instructions to Schedule ND-1QEC, line 13. If you are only claiming an unused planned gift or endowment credit carried over from a prior tax year, and none of the contribution on which it is based was carried over and deducted on your 2025 Form 1040 or 1040-SR, no adjustment is required on this line. Line 5 ‑ U.S. obligation interest Enter the following on this line: • Interest income from U.S. obligations. • Interest income from other securities that is specifically exempted from state income tax by federal statute. • The portion of dividend income from a mutual fund attributable to investment in U.S. obligations and other securities the interest from which is exempted from state income tax by federal statute. Common sources of interest income that may be entered on this line include: • U.S. savings bonds and Treasury bills and notes. • Securities issued by: Banks for cooperatives Commodity Credit Corporation Federal Deposit Insurance Corporation Federal Farm Credit System Federal Home Loan Banks Federal Intermediate Credit Banks Federal Land Banks Federal Savings & Loan Insurance Corporations Student Loan Marketing Association Do not enter on this line interest income from securities of the Federal Home Loan Mortgage Corporation (Freddie Mac), Federal National Mortgage Association (Fannie Mae), and Government National Mortgage Association (Ginnie Mae), nor from a federal income tax refund or repurchase agreement. Line 6 ‑ Net long‑term capital gain exclusion If your federal taxable income includes a net long-term capital gain (including a capital gain distribution from a mutual fund), you may be able to exclude 40 percent of the gain from your North Dakota taxable income. If you were a full-year nonresident or a partyear resident of North Dakota for the year, only a net long-term capital gain reportable to North Dakota is eligible for the exclusion. A net long-term capital gain included in an amount entered on line 7, or 16 of Form ND-1 is not eligible for the exclusion. Line 9 - Licensed peace officer retirement benefits exclusion Certain retirement benefits of a licensed peace officer are excludable from North Dakota taxable income. The exclusion is allowable for a retired licensed peace officer with a minimum of 20 years of service or that was retired disabled. If allowable, enter on this line the amount of taxable retirement benefits included in federal taxable income on Form 1040 or Form 1040-SR, line 5b. Only include benefits issued by your employer’s retirement plan, generally found on Form 1099-R, box 2a. Attach Form 1099-R to your return. For the first tax year claiming this exclusion, also provide the following with your return: • If having at least 20 years of licensed status in North Dakota: O Complete the worksheet on page 13 to calculate the amount to enter on this line. Line 7 ‑ Native American’s exempt income If you are an enrolled member of a federallyrecognized Indian tribe who lived on any Indian reservation in North Dakota for all of 2025, enter on this line income you derived from sources on any Indian reservation in North Dakota. This includes the portion of the Standing Rock and Lake Traverse Indian Reservations situated in South Dakota. Do not enter income derived from nonreservation sources in North Dakota. If you lived in North Dakota in 2025, but you did not reside on an Indian reservation for part or all of 2025, do not enter income earned or received while living off the reservation. Line 8 ‑ U.S. Railroad Retirement Board benefits Enter on this line the portion of any unemployment, sick pay, or retirement benefits received from the U.S. Railroad Retirement Board that are taxable on your federal income tax return. The U.S. Railroad Retirement Board will be shown as the payer or employer on the Form 1099-G (unemployment), Form W-2 (sick pay), or Forms RRB-1099 and RRB-1099-R (retirement) issued to you. Attach page 1 of your Peace Officer Standards and Training (POST) board training profile document. A copy may be obtained from the POST board. • If meeting 20 years of licensed status attributable to service other states: O Attach documentation from each official licensing board or jurisdiction to reflect the years or term of licensed service, totaling at least 20 years. • For retired disabled: O Attach the documentation from the employer’s plan or medical documentation to substantiate the individual became medically or physically disabled while employed as a licensed peace officer and unable to discharge the person’s duties. For additional information, please see Guideline – Income Tax: Licensed Peace Officer Retirement Exclusion on our website. Line 10 ‑ Servicemember Civil Relief Act adjustment If you were a full-year nonresident of North Dakota for the tax year, enter on this line compensation received for active duty in the U.S. armed forces or the commissioned corps of the Public Health Service or National Oceanic and Atmospheric Administration. If a part-year resident, only enter the amount received for service while a nonresident of North Dakota. Include a copy of Form W‑2 showing the military pay. North Dakota Line 11 ‑ Military pay exclusion Enter on this line the military pay you received as a member of the U.S. armed forces on active and reserve duty and a member of the national guard. The deduction is allowed to the extent the military pay is included in federal taxable income. Military pay for purposes of this deduction is all military pay, including federal pay for training, education, mobilization, and bonuses and state pay when called to state active duty. Include a copy of Form W‑2 showing the military pay. If you included wages as a Dual Status Technician on line 11, include a copy of Standard Form 50 (SF-50), Notification of Personnel Action. If you included income on line 10 for federal active duty pay under the Servicemember Civil Relief Act, do not include that income on line 11. Line 12 ‑ ND College SAVE contribution deduction If you made a contribution during the tax year to a North Dakota College SAVE account administered by the Bank of North Dakota, you are allowed a deduction for the contribution, up to a maximum of $5,000 ($10,000, if married filing jointly). You are allowed the deduction regardless of whether you or someone else owns the account. A rollover of funds from another I.R.C. § 529 college savings plan into a North Dakota College SAVE account does not qualify. Line 13 - Qualified dividend exclusion If you were a full-year resident of North Dakota during the tax year, multiply the qualified dividends from Form 1040 or 1040-SR, line 3a, by 40 percent and enter the result. If you were a part-year resident or full-year nonresident of North Dakota during the tax year, multiply the portion of the qualified dividends from Form 1040 or 1040-SR, line 3a, that are reported to North Dakota by 40% and enter the result. Note: Only include dividends that are reported on Schedule ND-1NR, line 2, column B. Line 14 - Military retirement benefit exclusion If you are a retired military service member, or a surviving spouse of a deceased retired military service member, enter on this line the amount of taxable military retirement benefits that you reported on Form 1040 or Form 1040-SR, line 5b. Include benefits received as a retired member of the U.S. armed forces or its reserve components, Army National Guard, or Air Force National Guard. “U.S. armed forces” means the Army, Navy, … Air Force, Marine Corps, and Coast Guard. Retirement benefits received for federal civil service employment as a dual status military technician under Title 32 or Title 10 are also eligible for this deduction. Include a copy of Form 1099‑R.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Form ND-1 instructions, Line 15, Social Security and Tier I allocation',
      url: 'https://www.tax.nd.gov/sites/www/files/documents/forms/individual/2025-iit/2025-individual-income-tax-booklet.pdf',
      quotedText: 'Enter on this line the taxable portion of your Social Security benefit`s reported on Form 1040 or 1040-SR, line 6b. Do not enter on this line taxable Tier 1 Social Security equivalent benefits reported on a Form RRB-1099 from the U.S. Railroad Retirement Board; instead, enter the taxable portion of these benefits on Form ND-1, line 8. If you receive both Tier 1 benefits (Form RRB-1099) and social security benefits (Form SSA-1099) determine the amount to enter on Form ND-1, lines 8 and 15, respectively, by multiplying the amount from Form 1040 or 1040-SR, line 6b, by a ratio equal to the gross amount of each type of benefit divided by the gross amount of both benefits combined.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2023,
    effectiveThrough: null,
    verifiedOn: '2026-09-12',
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
      'Indiana imposes one flat rate on Indiana adjusted gross income, with no brackets and no variation by filing status. For taxable years beginning after December 31, 2025, and before January 1, 2027, the quoted schedule is 2.95%; for taxable years beginning after December 31, 2026, and before January 1, 2030, 2.9%. Subsection (b)(9) governs taxable years beginning after December 31, 2029, and before January 1, 2032: a further 0.05-percentage-point reduction is conditional on the budget agency determination — each of the four specified fiscal years must meet the 3.5% revenue-growth test and the specified forecast must also meet 3.5% — and the decrease begins January 1 of the even-numbered year immediately succeeding the year of that determination. This record does not certify a projected rate after 2029 or fix when the determination occurs. The pack holds 2.95% for both filing statuses. A refresh that carries a prior year’s rate forward is wrong by construction, which is why Indiana sits on the never-hold-forward list in the pack header.',
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
      kind: 'statute',
      citation: 'IC 6-3-2-1(b)(9)',
      url: 'https://iga.in.gov/ic/2026/Title_6/Article_3/Chapter_2.pdf',
      quotedText:
        '(9) For taxable years beginning after December 31, 2029, and before January 1, 2032, if, as determined by the budget agency under subsection (e), the: (A) state general fund revenue collections in each of the state fiscal years ending: (i) June 30, 2025; (ii) June 30, 2026; (iii) June 30, 2027; and (iv) June 30, 2028; exceed by at least three and one-half percent (3.5%) the state general fund revenue collections for the respective immediately preceding state fiscal year; and (B) amount of forecasted state general fund revenue collections for the state fiscal year ending June 30, 2029, are estimated to exceed by at least three and one-half percent (3.5%) the state general fund revenue collections in the state fiscal year ending June 30, 2028; the tax rate shall be decreased by the percentage point of five one-hundredths of one percent (0.05%) beginning January 1 of the even-numbered year immediately succeeding the year of the budget agency determination under subsection (e).',
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
    statement: 'Indiana DOR affirmatively lists pensions and annuities as taxable income. Its current complete deductions page, quoted by heading, supplies targeted civil-service, military, disability and Social Security/Railroad deductions but no general public-pension deduction or general private-pension deduction. The conclusion is bounded to ordinary retirement income not meeting a named exception, rather than claiming that every pension payment is taxable. The standard private and state-local public pension buckets have no general retirement deduction.',
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
      citation: 'Indiana DOR, Income Tax Information Bulletin #26 (January 2023), pension and annuity income',
      url: 'https://www.in.gov/dor/files/ib26.pdf',
      quotedText:
        'Nontaxable income includes, but is not limited to, income from the following sources: Social Security Railroad retirement benefits Life insurance proceeds',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Indiana DOR, Income Tax Information Bulletin #26 (January 2023), Taxable Versus Nontaxable Income',
      url: 'https://www.in.gov/dor/files/ib26.pdf',
      quotedText:
        'Taxable income includes, but is not limited to, income from the following sources: … Pensions (taxable portion) … Annuities (taxable portion)',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Indiana DOR current deductions, complete displayed headings, retrieved September 12, 2026',
      url: 'https://www.in.gov/dor/i-am-a/individual/deductions/',
      quotedText: 'Auto Loan Interest Deduction … Overtime Deduction … Tips Deduction … Broadband Expansion Grants Deduction … Career Scholarship Account Deduction … Civil Service Annuity Deduction … Disability Retirement Deduction … Employer Student Loan Payment Interest Deduction … Enterprise Zone Employee Deduction … Health Care Sharing Ministry Deduction … Human Services Tax Deduction … Indiana Education Scholarship Account Deduction … Indiana Net Operation Loss Deduction … Indiana Partnership Long Term Care Policy Premiums Deduction … Interest from U.S. Government Obligations Deduction … Military Retirement Income and/or Survivor’s Benefits Deduction … Military Service Deduction … National Guard and Reserve Component Members Deduction … 30 Days or Less Nonresident Employee Wage Deduction … Olympic/Paralympic Medal Winners Deductions … Private School/Homeschool Deduction … Qualified Patents Income Exemption Deduction … Railroad Unemployment and Sickness Benefits Deduction … Recovery of Itemized Deductions, Including State Tax Refund … Renter’s Deduction … Repayment of Previously Taxed Income Deduction … Residential Homeowner’s Property Tax Deduction … Small Employer Health Insurance Premium Deduction … Social Security and Railroad Retirement Benefits … Specified Research and Experimental Expenses Deduction … Unemployment Compensation Deduction',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-12',
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
      citation: 'IC 6-3-1-3.5(a)(4)',
      url: 'https://iga.in.gov/ic/2026/Title_6/Article_3/Chapter_1.pdf',
      quotedText:
        '(4) Subtract one thousand dollars ($1,000) for: (A) each of the exemptions provided by Section 151(c) of the Internal Revenue Code (as effective January 1, 2017); (B) each additional amount allowable under Section 63(f) of the Internal Revenue Code; and (C) the spouse of the taxpayer if a separate return is made by the taxpayer and if the spouse, for the calendar year in which the taxable year of the taxpayer begins, has no gross income and is not the dependent of another taxpayer.',
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
    title: 'Kansas exempts named retirement systems',
    statement: 'Kansas subtracts the named statutory systems, including federal civil service and armed forces, KPERS, qualifying city and public-utility plans, Washburn University, and the Overland Park police and fire plans. The characterized selector requires an eligible named plan code; private and unlisted public plans receive no named-plan subtraction. Unknown public identity remains incomplete. Generic public income does not establish eligibility.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
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
    verifiedOn: '2026-09-12',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/tax/stateMidwestExtras.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.KS',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult',
      'packages/engine/src/tax/stateMidwestExtras.ts#kansasNamedPlanExclusion',
    ],
  },

  'mi-mcl-206-30-f-iii-social-security': {
    title: 'Michigan permanently subtracts federally included Social Security',
    statement: 'MCL 206.30(1)(f)(iii) subtracts Social Security benefits as defined in IRC section 86 to the extent included in AGI. The subtraction itself has no 2028 sunset. The quoted subsection (9)(e) and RAB 2026-1 permit affected taxpayers to subtract both Social Security and the full standard deduction in 2026–2028. That non-conditioning statement is a source-evidence constraint on this record, not a claim that the engine calculates every elective standard retirement deduction. It does not limit this permanent Social Security exclusion.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:MI',
    authority: [{
      kind: 'statute',
      citation: 'Mich. Comp. Laws 206.30(1)(f)',
      url: 'https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-206-30',
      quotedText:
        'Deduct the following to the extent included in adjusted gross income subject to the limitations and restrictions set forth in subsection (9), (10), or (11), as applicable:',
    }, {
      kind: 'statute',
      citation: 'Mich. Comp. Laws 206.30(1)(f)(iii)',
      url: 'https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-206-30',
      quotedText:
        'Social Security benefits as defined in section 86 of the internal revenue code.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Michigan Treasury RAB 2026-1 Issue 11',
      url: 'https://www.michigan.gov/taxes/rep-legal/rab/2026-revenue-administrative-bulletins/revenue-administrative-bulletin-2026-1',
      quotedText:
        'For tax years 2026 through 2028, these taxpayers who have Social Security income included in AGI may subtract both the Social Security income and a full standard deduction.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-12',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#MI',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'mi-mcl-206-30-9-e-nonconditioning': {
    title: 'Michigan temporarily removes Social Security from the Tier 3 standard-deduction reduction',
    statement: 'For taxpayers born after 1952 who reach age 67, RAB 2026-1 Issue 11 allows federally included Social Security and the subsection (9) standard deduction together in TY2026–2028. The standard deduction still reduces for the personal exemption and specified railroad/military benefits. Before 2026 and after 2028, the Social Security reduction returns for this election. This separate window does not sunset the permanent Social Security subtraction. Out of scope: StateTaxParams has no subsection (9) election or personal-exemption reduction inputs; the ordinary Michigan retirement ceiling and permanent Social Security exclusion do not implement the elective full-standard-deduction calculation. This record preserves the original source-evidence limb and its limits without claiming new monetary coverage.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
        'Michigan subsection (9) standard-deduction election: StateTaxParams has no election fact',
        'Michigan personal exemption used to reduce that elected standard deduction: StateTaxParams has no personal-exemption reduction input',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:MI',
    authority: [{
      kind: 'stateAgencyPublication',
      citation: 'Michigan Treasury RAB 2026-1 Issue 11, Tier 3 cohort and temporary subsection (9) reduction relief',
      url: 'https://www.michigan.gov/taxes/rep-legal/rab/2026-revenue-administrative-bulletins/revenue-administrative-bulletin-2026-1',
      quotedText: 'Specifically, for taxpayers born after 1952 who reach the age of 67, the following rules apply: For tax years 2026 through 2028, these taxpayers who have Social Security income included in AGI may subtract both the Social Security income and a full standard deduction. However, their standard deduction must still be reduced by the personal exemption and any deductions claimed for taxable railroad retirement benefits, compensation (including retirement benefits) due to service in the U.S. Armed Forces, or retirement benefits due to service in the Michigan National Guard. For tax years prior to 2026 and after 2028, their standard deduction must be reduced by the personal exemption and any deductions claimed for taxable Social Security, taxable railroad retirement benefits, compensation (including retirement benefits) due to service in the U.S. Armed Forces, or retirement benefits due to service in the Michigan National Guard.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: 2028,
    verifiedOn: '2026-09-12',
    implementedBy: ['packages/engine/src/params/state/types.ts'],
    implementedByFunctions: ['packages/engine/src/params/state/types.ts#StateTaxParams'],
  },

  'mi-mcl-206-30-retirement-and-ss': {
    title: 'Michigan\'s 2026 ordinary retirement deduction is a combined ceiling, not a full exemption',
    statement:
      'For the 2026 tax year MCL 206.30(10)(d) lets a Michigan taxpayer deduct retirement or pension benefits as provided under subsection (1)(f), except that amounts deductible under (1)(f)(i) and (ii) combined are subject to the same maximum (1)(f)(iv) allows for a single return and a joint return for that same tax year. Treasury RAB 2026-1 states that for tax year 2026 and each year thereafter, regardless of year of birth, taxpayers may deduct combined public and private retirement benefits up to the inflation-adjusted private retirement maximum under (1)(f)(iv), and that the inflation-adjusted maximum does not apply to the public retirement benefits of taxpayers born before 1946. The 2026 Withholding Guide (Form 446) publishes that ordinary post-1945 qualifying maximum as $67,610 if single or married filing separately, or $135,220 if married filing jointly, and separately that recipients born before 1946 are not taxed on qualifying public benefits. The “payments are made for life to a senior citizen” phrase in (1)(f)(iv) attaches to the retirement-annuity-policy branch, not to every private pension; private benefits include senior-citizen annuities as one private source, and the 2026 ordinary path is not an automatic full exemption of all retirement income. The pack encoding of that ordinary combined ceiling is `{ kind: \'capped\', capPerPerson: 67610 }` with no birth-year test, no public/private split, and no election among subsections (9), (10), and (11). Approximated both directions: a pre-1946 qualifying federal or Michigan public benefit above $67,610 is under-excluded at the shared cap; a nonqualifying amount placed in the retirement bucket is over-excluded; an unrepresented, more favorable subsection-(9) election can be under-excluded; and the per-person `agesAlive` proxy can over- or under-exclude when it does not match the return-level filing-status ceiling. Social Security is a different (1)(f) limb and is registered separately at mi-mcl-206-30-f-iii-social-security.',
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
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Mich. Dept. of Treasury, Revenue Administrative Bulletin 2026-1',
      url: 'https://www.michigan.gov/taxes/rep-legal/rab/2026-revenue-administrative-bulletins/revenue-administrative-bulletin-2026-1',
      quotedText:
        'Tax year 2026 and each year thereafter – regardless of year of birth, taxpayers may deduct combined public and private retirement benefits up to the inflation-adjusted private retirement maximum under subsection (1)(f)(iv) of section 30 of the MITA. The inflation-adjusted maximum does not apply to the public retirement benefits of taxpayers born before 1946.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Mich. Dept. of Treasury, Revenue Administrative Bulletin 2026-1, Issue 3',
      url: 'https://www.michigan.gov/taxes/rep-legal/rab/2026-revenue-administrative-bulletins/revenue-administrative-bulletin-2026-1',
      quotedText:
        'Under PA 4, for the final phase-in year of 2026, and each tax year thereafter, subtractions of retirement income from these public sources are limited to the private retirement maximum under subsection 30(1)(f)(iv) of the MITA (except for taxpayers born before 1946, for whom retirement subtractions of public benefits remain unlimited). In applying the private retirement maximum, a taxpayer must combine all deductible public retirement income, whether it is federal, Michigan, or from another state government with a similar or reciprocal deduction, and any private retirement income and then apply the limitation to the combined amounts.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Mich. Dept. of Treasury, Revenue Administrative Bulletin 2026-1',
      url: 'https://www.michigan.gov/taxes/rep-legal/rab/2026-revenue-administrative-bulletins/revenue-administrative-bulletin-2026-1',
      quotedText:
        'The provisions of subsections (10) and (11) of Section 30 of the MITA are elective. MCL 206.30(10) and (11). Taxpayers may choose the maximum deduction available under either provision, if applicable, or under subsection (9) (the tiered provisions and standard deduction that went into effect in 2012 under 2011 PA 38 and later amendatory acts).',
    }, {
      kind: 'formInstruction',
      citation: '2026 Michigan Income Tax Withholding Guide (Form 446)',
      url: 'https://www.michigan.gov/taxes/-/media/Project/Websites/taxes/Forms/SUW/TY2026/446_Withholding-Guide_2026.pdf',
      quotedText:
        'For 2026, recipients born after 1945 may generally subtract qualifying retirement and pension benefits up to $67,610 if single or married filing separately, or $135,220 if married and filing a joint return.',
    }, {
      kind: 'formInstruction',
      citation: '2026 Michigan Income Tax Withholding Guide (Form 446)',
      url: 'https://www.michigan.gov/taxes/-/media/Project/Websites/taxes/Forms/SUW/TY2026/446_Withholding-Guide_2026.pdf',
      quotedText:
        'Recipients born before 1946 are not taxed on any qualifying pension and retirement benefits received from public sources, and may subtract qualifying private pension and retirement benefits up to the remaining balance of $67,610 if single or married filing separately, or $135,220 if married and filing a joint return.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Mich. Dept. of Treasury, Revenue Administrative Bulletin 2026-1, "Pre-2012 Michigan Tax Treatment of Retirement Distributions"',
      url: 'https://www.michigan.gov/taxes/rep-legal/rab/2026-revenue-administrative-bulletins/revenue-administrative-bulletin-2026-1',
      quotedText:
        'A private retirement benefit maximum applied to qualified distributions generally from individual IRAs, private employer retirement plans, plans for self-employed people, and qualified senior citizen retirement annuities. MCL 206.30(1)(f)(iv).',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Mich. Dept. of Treasury, Revenue Administrative Bulletin 2026-1, "What Are Qualifying Retirement and Pension Benefits?"',
      url: 'https://www.michigan.gov/taxes/rep-legal/rab/2026-revenue-administrative-bulletins/revenue-administrative-bulletin-2026-1',
      quotedText:
        'For Michigan purposes, qualifying retirement benefits include most payments that are reported on a Form 1099-R for federal tax purposes. This includes defined benefit pensions, Individual Retirement Arrangement (IRA) distributions, and most payments from defined contribution plans. The distinction between qualified and nonqualified plans is important because it may allow a recipient to subtract some or all of a distribution that is included in AGI.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-05',
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

  'mn-dor-2026-rate-schedule-and-standard-deduction': {
    title: 'Minnesota publishes TY2026 single/MFJ deductions and income-tax bands',
    statement:
      'For TY2026, Minnesota publishes a $15,300 standard deduction for single filers and $30,600 for MFJ. Its whole-dollar bands are single: 5.35% for $0-$33,310, 6.80% for $33,311-$109,430, 7.85% for $109,431-$203,150, and 9.85% from $203,151; MFJ: 5.35% for $0-$48,700, 6.80% for $48,701-$193,480, 7.85% for $193,481-$337,930, and 9.85% from $337,931. The pack represents those bands as continuous mathematical breakpoints at $33,310/$109,430/$203,150 single and $48,700/$193,480/$337,930 MFJ. Settled only for those supported TY2026 cells; other statuses, exemptions, additions, limitations, surtax, Social Security subtraction, and whole-return accuracy are outside this record.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'DOR publishes the annually adjusted whole-dollar ranges. bracketTax uses endpoint breakpoints over continuous modeled dollars; at whole-dollar inputs this represents the published ranges. The record expires after TY2026. Later plan years may reuse the latest 2026 pack as a planning stand-in and are not certified by this annual record.',
    jurisdiction: 'state:MN',
    authority: [{
      kind: 'stateAgencyPublication',
      citation: 'Minnesota DOR, Income Tax Rates for 2026, single filers',
      url: 'https://www.revenue.state.mn.us/minnesota-income-tax-rates-and-brackets',
      quotedText:
        'Income Tax Rates for 2026 … Single … Tax Rate … Income From... … Up To … 5.35% … $0 … $33,310 … 6.80% … $33,311 … $109,430 … 7.85% … $109,431 … $203,150 … 9.85% … $203,151',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Minnesota DOR, Income Tax Rates for 2026, married filing jointly',
      url: 'https://www.revenue.state.mn.us/minnesota-income-tax-rates-and-brackets',
      quotedText:
        'Income Tax Rates for 2026 … Married Filing Jointly … Tax Rate … Income From... … Up To … 5.35% … $0 … $48,700 … 6.80% … $48,701 … $193,480 … 7.85% … $193,481 … $337,930 … 9.85% … $337,931',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Minnesota DOR, Tax Year 2026 Inflation-Adjusted Amounts, section 290.0123 subd. 1',
      url: 'https://www.revenue.state.mn.us/sites/default/files/2025-12/inflation-adjusted-amounts-2026.pdf',
      quotedText:
        'Married Joint or Surviving Spouse 2023 $30,600 … Single, Married Separate 2023 $15,300',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Minnesota DOR, Tax Year 2026 Inflation-Adjusted Amounts, publication scope',
      url: 'https://www.revenue.state.mn.us/sites/default/files/2025-12/inflation-adjusted-amounts-2026.pdf',
      quotedText:
        'All income tax amounts are for tax year 2026.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-09-07',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#MN',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#bracketTax',
    ],
  },

  'mn-dor-seniors-resident-pension-inclusion': {
    title: 'Minnesota taxes resident pension income by default before listed subtractions',
    statement:
      'Minnesota Department of Revenue guidance for seniors states that pensions, including federal pensions, received while a Minnesota resident are taxable by Minnesota regardless of where the pension was earned. Military retirement pay is addressed separately on the same page and is outside this record, as are qualified public-pension subtractions, Social Security subtraction schedules, and distinctions among IRA, 401(k), annuity, and private-employer plan sourcing that the input model cannot express. The pack\'s resolved `retirementPrivate: { kind: \'none\' }` therefore matches the agency\'s default inclusion of ordinary resident private-employer pension distributions in the Minnesota base before the TY2026 standard deduction. Settled only for that narrow resident private-employer pension inclusion limb; rate schedules, Social Security subtraction, military and public limbs, and whole-return accuracy remain in separate records. The record\'s `effectiveFrom`/`effectiveThrough` of 2026 is the supported product year window for this guidance claim, not a statutory start or sunset date. The authority is a versionless DOR web page, so `annuallyIndexed` applies the registry\'s conservative 120-day re-verification budget rather than treating the page like enacted statutory text.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:MN',
    authority: [{
      kind: 'stateAgencyPublication',
      citation: 'Minnesota DOR, Seniors — Pension Income',
      url: 'https://www.revenue.state.mn.us/seniors',
      quotedText:
        'Pensions, including federal pensions, received while a Minnesota resident are taxable by Minnesota regardless of where your pension was earned.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Minnesota DOR, Seniors — military carve-out scope (excluded limb)',
      url: 'https://www.revenue.state.mn.us/seniors',
      quotedText:
        'Military retirement pay (including pensions) is not taxable in Minnesota.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-09-12',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#MN',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'mn-stat-290-0132-subd-26-social-security-inclusion': {
    title: 'Minnesota subtracts federally taxable Social Security on an income-tested schedule the pack omits',
    statement:
      'For TY2026, Minnesota allows the greater of a simplified subtraction of federally taxable Social Security or an alternate subtraction. The simplified amount is reduced 10 percent for each $4,000 of AGI, or fraction, above $86,410 single/HOH or $110,780 MFJ/surviving spouse; MFS uses $55,390. The DOR table marks alternate maxima $4,560 single/HOH, $5,840 MFJ/surviving spouse, and $2,920 MFS as Not Indexed. Approximated: the pack encodes taxesSocialSecurity:true and subtracts nothing, so it overstates tax while either subtraction remains. Private retirement stays kind:none; subdivision 34\'s qualified-public-pension subtraction is separate and unmodeled.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale:
      'The existing subdivision 26(c)(1)-(2) quotations are statutory-year base amounts. Subdivision 26(j) requires annual adjustment of the simplified-subtraction thresholds, and the DOR TY2026 table supplies the operative values. The quoted DOR table marks the alternate maxima as Not Indexed. The engine has no field or enforcer for either subtraction; later pack fallback remains an annually stale stand-in.',
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
    }, {
      kind: 'statute',
      citation: 'Minn. Stat. 290.0132, subd. 26(j)',
      url: 'https://www.revisor.mn.gov/statutes/cite/290.0132',
      quotedText:
        'The commissioner shall adjust the phaseout threshold amounts in paragraph (c), clauses (1) and (2), as provided in section 270C.22.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Minnesota DOR, Tax Year 2026 Inflation-Adjusted Amounts, section 290.0132 subd. 26 simplified thresholds',
      url: 'https://www.revenue.state.mn.us/sites/default/files/2025-12/inflation-adjusted-amounts-2026.pdf',
      quotedText:
        'Tax Year 2026 Inflation-Adjusted Amounts … All income tax amounts are for tax year 2026. … Social Security Subtraction … Simplified Subtraction … Phase-out Threshold … Married Joint or Surviving Spouse … 2023 … $110,780 … Single; Head of Household … 2023 … $86,410 … Married Separate … 2023 … $55,390',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Minnesota DOR, Tax Year 2026 Inflation-Adjusted Amounts, section 290.0132 subd. 26 alternate maxima',
      url: 'https://www.revenue.state.mn.us/sites/default/files/2025-12/inflation-adjusted-amounts-2026.pdf',
      quotedText:
        'Tax Year 2026 Inflation-Adjusted Amounts … All income tax amounts are for tax year 2026. … Social Security Subtraction … Alternate Subtraction … Maximum Subtraction … Married Joint or Surviving Spouse … Not Indexed … $5,840 … Single, Head of Household … Not Indexed … $4,560 … Married Separate … Not Indexed … $2,920',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-09-07',
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

  'ne-dor-2026-rate-schedule-and-standard-deduction': {
    title: 'Nebraska publishes TY2026 estimated-tax brackets and supported single/MFJ standard deductions',
    statement:
      'Nebraska Form 1040N-ES (2026) — labeled 2026 throughout the booklet though the download path uses a 2025 folder — publishes the supported ordinary taxable-income rate schedule and basic single and married-filing-jointly standard deductions used by the pack. The form lists standard deductions of $8,850 single and $17,700 married filing jointly on worksheet Line 5, and a 2026 estimated income tax rate schedule with single breakpoints at $4,130, $24,760, and $39,900 at rates 2.46%, 3.51%, and 4.55% with chart constants $101.60, $825.71, and $1,514.58, and under Married, Filing Jointly and Surviving Spouses breakpoints at $8,250, $49,530, and $79,800 at the same rates with chart constants $202.95, $1,651.88, and $3,029.16. The pack stores those deduction cells and three marginal bands ending at 4.55% for each supported status. Settled only for that ordinary taxable-income/rate schedule and those basic single/MFJ deduction amounts: at taxable $39,900 the chart tax is $1,514.58 ($825.71 + 4.55% × ($39,900 − $24,760)), which matches the continuous engine to cents. Other filing statuses, additional deduction amounts, credits, later-year rates, and whole-return accuracy are outside this record.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The form\'s estimated schedule uses accumulated chart constants at band floors; bracketTax composes the same marginal rates continuously. At the pinned single third-bracket ceiling the chart constant and continuous composition agree to cents; this record does not claim exact parity at every interior coordinate or beyond cents tolerance.',
    jurisdiction: 'state:NE',
    authority: [{
      kind: 'formInstruction',
      citation: 'Nebraska DOR, Form 1040N-ES (2026), worksheet Line 5 standard deduction',
      url: 'https://revenue.nebraska.gov/sites/default/files/doc/tax-forms/2025/f_1040N-ES.pdf',
      quotedText:
        '5 Nebraska standard deduction:\n			 Single $8,850;',
    }, {
      kind: 'formInstruction',
      citation: 'Nebraska DOR, Form 1040N-ES (2026), worksheet Line 5 MFJ standard deduction',
      url: 'https://revenue.nebraska.gov/sites/default/files/doc/tax-forms/2025/f_1040N-ES.pdf',
      quotedText:
        'Married, Filing Jointly $17,700;\n			 Head of Household $12,950;',
    }, {
      kind: 'formInstruction',
      citation: 'Nebraska DOR, Form 1040N-ES (2026), estimated rate schedule scope',
      url: 'https://revenue.nebraska.gov/sites/default/files/doc/tax-forms/2025/f_1040N-ES.pdf',
      quotedText:
        '2026 Nebraska Estimated Income Tax Rate Schedule',
    }, {
      kind: 'formInstruction',
      citation: 'Nebraska DOR, Form 1040N-ES (2026), single rate schedule first bracket',
      url: 'https://revenue.nebraska.gov/sites/default/files/doc/tax-forms/2025/f_1040N-ES.pdf',
      quotedText:
        '$        0        $    4,130                         2.46% of the income',
    }, {
      kind: 'formInstruction',
      citation: 'Nebraska DOR, Form 1040N-ES (2026), single rate schedule second bracket',
      url: 'https://revenue.nebraska.gov/sites/default/files/doc/tax-forms/2025/f_1040N-ES.pdf',
      quotedText:
        '4,130                24,760          $ 101.60 + 3.51% of the excess over $ 4,130',
    }, {
      kind: 'formInstruction',
      citation: 'Nebraska DOR, Form 1040N-ES (2026), single rate schedule third bracket',
      url: 'https://revenue.nebraska.gov/sites/default/files/doc/tax-forms/2025/f_1040N-ES.pdf',
      quotedText:
        '24,760               39,900            825.71 + 4.55% of the excess over $24,760',
    }, {
      kind: 'formInstruction',
      citation: 'Nebraska DOR, Form 1040N-ES (2026), single rate schedule fourth bracket',
      url: 'https://revenue.nebraska.gov/sites/default/files/doc/tax-forms/2025/f_1040N-ES.pdf',
      quotedText:
        '39,900                   ——            1,514.58 +4.55% of the excess over $39,900',
    }, {
      kind: 'formInstruction',
      citation: 'Nebraska DOR, Form 1040N-ES (2026), MFJ rate schedule heading',
      url: 'https://revenue.nebraska.gov/sites/default/files/doc/tax-forms/2025/f_1040N-ES.pdf',
      quotedText:
        'Married, Filing Jointly and Surviving Spouses',
    }, {
      kind: 'formInstruction',
      citation: 'Nebraska DOR, Form 1040N-ES (2026), MFJ rate schedule first bracket',
      url: 'https://revenue.nebraska.gov/sites/default/files/doc/tax-forms/2025/f_1040N-ES.pdf',
      quotedText:
        '$        0        $    8,250                         2.46% of the income',
    }, {
      kind: 'formInstruction',
      citation: 'Nebraska DOR, Form 1040N-ES (2026), MFJ rate schedule second bracket',
      url: 'https://revenue.nebraska.gov/sites/default/files/doc/tax-forms/2025/f_1040N-ES.pdf',
      // Text layer drops the but-not-over $49,530 cell on this row (column interleave
      // with Married Filing Separately). Ellipsis marks that omitted cell; formula
      // words match the PDF in source order. Visual page 6 confirms over $8,250
      // but not over $49,530.
      quotedText:
        '8,250 … $ 202.95 + 3.51% of the excess over $ 8,250',
    }, {
      kind: 'formInstruction',
      citation: 'Nebraska DOR, Form 1040N-ES (2026), MFJ rate schedule third bracket',
      url: 'https://revenue.nebraska.gov/sites/default/files/doc/tax-forms/2025/f_1040N-ES.pdf',
      quotedText:
        '49,530                79,800         1,651.88 + 4.55% of the excess over $49,530',
    }, {
      kind: 'formInstruction',
      citation: 'Nebraska DOR, Form 1040N-ES (2026), MFJ rate schedule fourth bracket',
      url: 'https://revenue.nebraska.gov/sites/default/files/doc/tax-forms/2025/f_1040N-ES.pdf',
      quotedText:
        '79,800                   ——            3,029.16 + 4.55% of the excess over $79,800',
    }, {
      kind: 'formInstruction',
      citation: 'Nebraska DOR, Form 1040N-ES (2026), TY2026 third/fourth bracket rate note',
      url: 'https://revenue.nebraska.gov/sites/default/files/doc/tax-forms/2025/f_1040N-ES.pdf',
      quotedText:
        'Note: The tax year 2026 individual income tax rates for the third and fourth brackets are at the same rate of 4.55% per Neb. Rev. Stat. § 77-2715.03(2)(c)(v).',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-09-12',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.NE',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#bracketTax',
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

  'oh-rev-code-5747-02-a-3-c-2026-nonbusiness-rate-schedule': {
    title: 'Ohio TY2026 nonbusiness tax carries a $332 cumulative base above $26,050',
    statement:
      'For TY2026, Ohio Rev. Code §5747.02(A)(3) imposes no tax when the individual nonbusiness balance B — Ohio adjusted gross income minus taxable business income and applicable taxpayer, spouse, and dependent exemptions — is at most $26,050, and §5747.02(A)(3)(c) sets tax at $332.00 plus 2.75% of the amount in excess of $26,050. Division (A)(3) supplies one schedule for individuals without a filing-status branch; single and married filing jointly therefore share the breakpoint, base, and rate. The enacted Legislative Service Commission H.B. 96 tax Greenbook independently confirms TY2026 uses that single bracket and that H.B. 96 suspends inflation indexing for TY2025 and TY2026, so the TY2026 threshold remains $26,050. Settled for this narrow pre-credit schedule only: the OH pack cells and bracketTax enforce the 0% band to $26,050 and the 2.75% band with baseTax $332 and the cumulative base strictly above the threshold. Taxable business income under (A)(4), exemptions that reduce B, retirement and senior credits, municipal tax, and whole-return liability remain outside this record. The captured Ohio Department of Taxation 2026 IT 1040 ES worksheet prints the prior-year $342 / 2.75% / 3.125% table and conflicts with enacted law; that administrative artifact is disclosed here but does not support the $332 formula and has not been reconciled.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'For the legal TY2026 nonbusiness schedule the current statute plus enacted analysis controls the supported reading. The captured 2026 IT 1040 ES estimated-payment worksheet reproduces the 2025 schedule ($342 plus 2.75% of excess over $26,050, then $2,394.32 plus 3.125% above $100,000) and conflicts directly with enacted §5747.02(A)(3)(c) and the LSC enacted-budget Greenbook; that administrative artifact is disclosed but not adopted as support for the pack. Part-year residency uses the engine\'s existing linear month-proration convention (prorateParams scales bracket breakpoints and baseTax); that scaling is a model convention, not authority-backed Ohio part-year law. The record expires after TY2026; later plan years may reuse the latest 2026 pack as a planning stand-in and are not certified by this annual record.',
    jurisdiction: 'state:OH',
    authority: [{
      kind: 'statute',
      citation: 'Ohio Rev. Code §5747.02(A)(3)',
      url: 'https://codes.ohio.gov/ohio-revised-code/section-5747.02',
      quotedText:
        '(3) In the case of individuals, the tax imposed by this section on income other than taxable business income shall be measured by Ohio adjusted gross income, less taxable business income and less an exemption for the taxpayer, the taxpayer\'s spouse, and each dependent as provided in section 5747.025 of the Revised Code. If the balance thus obtained is equal to or less than twenty-six thousand fifty dollars, no tax shall be imposed on that balance.',
    }, {
      kind: 'statute',
      citation: 'Ohio Rev. Code §5747.02(A)(3)(c)',
      url: 'https://codes.ohio.gov/ohio-revised-code/section-5747.02',
      quotedText:
        'For taxable years beginning in 2026 and thereafter, $332.00 plus 2.75% of the amount in excess of $26,050.',
    }, {
      kind: 'legislativeHistory',
      citation: 'LSC enacted H.B. 96 Tax Greenbook, PDF p. 2 / extracted lines 108-112',
      url: 'https://www.lsc.ohio.gov/assets/legislation/136/hb96/en0/files/hb96-tax-greenbook-as-enacted-136th-general-assembly.pdf',
      quotedText:
        'creates a single tax bracket in which a taxpayer owes $332 plus 2.75% of income above $26,050. H.B. 96 suspends the inflation indexing of both the income tax brackets and personal exemption amounts in TY 2025 and TY 2026.',
    }, {
      kind: 'formInstruction',
      citation: 'Ohio Department of Taxation, 2026 IT 1040 ES estimated-payment worksheet (captured v1768492539), nonbusiness bracket table',
      url: 'https://dam.assets.ohio.gov/image/upload/v1768492539/tax.ohio.gov/forms/ohio_individual/individual/2026/ites-instructions-fi.pdf',
      quotedText:
        '$342.00 plus 2.750% of the amount in excess of $ 26,050…$2,394.32 plus 3.125% of the amount in excess of $100,000',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-09-08',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.OH',
      'packages/engine/src/tax/stateTax.ts#bracketTax',
    ],
  },

  'wi-stat-71-05-retirement-income-subtraction': {
    title: 'Wisconsin’s $24,000 age-67 retirement subtraction is per-recipient and credits-restricted; the pack caps pooled income and skips the election',
    statement:
      'The 2025 Schedule SB instructions let an individual aged 67 or older subtract up to $24,000 of federally taxable qualified-plan or IRA retirement income the individual received, and a joint couple who are both 67 subtract up to $48,000 regardless of which spouse received it, with no federal AGI ceiling; claiming forfeits every Schedule CR credit and the credits on Form 1 lines 13 through 20 and 30 through 35 for the year, and the separate income-restricted Line 17 allows up to $5,000 at age 65 or older only when federal AGI is under $15,000 single / $30,000 joint. Approximated: the pack encodes `{ kind: \'capped\', capPerPerson: 24000, minAge: 67 }` — min(household retirement income, $24,000 × members 67 or older) — with no per-spouse attribution, no credit forfeiture, and no Line 17 limb. A both-67 couple matches the pooled $48,000 rule exactly, but a mixed-age couple has the $24,000 cap run against pooled income, sheltering dollars the under-67 spouse received that the instructions withhold and understating Wisconsin tax, while the unmodeled credit forfeiture and the unmodeled Line 17 subtraction run the other way — the engine models no Wisconsin nonrefundable credits and grants a 65- or 66-year-old nothing — overstating tax for those households. Social Security remains excluded by the pack\'s `taxesSocialSecurity: false`, matching the Schedule SB Line 4 limb. The TY2026 Form 1-ES income-tested standard deduction and personal exemptions are modeled separately through `wisconsinStandardDeduction` / `wisconsinPersonalExemption` and are not this record. The separate 30% long-term capital-gain exclusion is registered at `wi-schedule-sb-line-5-long-term-capital-gain-exclusion`.',
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

  'wi-schedule-sb-15-railroad-benefits-not-modeled': {
    title: 'Wisconsin excludes U.S. Railroad Retirement Board benefits on federal line 5b; the engine cannot certify RRB payer',
    statement:
      'The 2025 Wisconsin Schedule SB instructions for tax year 2025, Line 15, state that Wisconsin does not tax amounts received from the U.S. Railroad Retirement Board and that a taxpayer may subtract railroad retirement benefits included on line 5b of federal Form 1040 or 1040-SR; the line title also names railroad unemployment insurance and sickness benefits. That exclusion is scoped to RRB-paid amounts with federal line 5b inclusion, not to every pension — qualified-plan and IRA retirement subtractions on Line 16 remain registered at `wi-stat-71-05-retirement-income-subtraction`, and Social Security at Line 4. Out of scope: `incomeStreamSchema` has no railroad-retirement type, `pensionSchema` has no U.S. Railroad Retirement Board payer fact, and `StateTaxParams` / `StateRetirementExclusion` carry no railroad-benefit payer facts — so no accepted ordinary, wages, public or private pension, or `ssBenefits` input can identify Line 15 railroad retirement, unemployment, or sickness dollars. Generic amounts entered through those channels are still priced under the pack\'s existing rules; the engine emits no law-specific refusal for this limb. This record quotes tax year 2025 Schedule SB instructions only and does not extend that exclusion to later years without a later source.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
        'U.S. Railroad Retirement Board-paid railroad retirement, unemployment, or sickness benefits included on federal Form 1040 or 1040-SR line 5b: incomeStreamSchema has no railroad-retirement type',
        'U.S. Railroad Retirement Board payer on pensionSchema, whose `source` enum is only private or public',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:WI',
    authority: [{
      kind: 'formInstruction',
      citation: '2025 Wisconsin Schedule SB Instructions, title page',
      url: 'https://www.revenue.wi.gov/TaxForms2025/2025-ScheduleSB-Inst.pdf',
      quotedText:
        '2025 Schedule SB Instructions Subtractions from Income',
    }, {
      kind: 'formInstruction',
      citation: '2025 Wisconsin Schedule SB Instructions, Line 15',
      url: 'https://www.revenue.wi.gov/TaxForms2025/2025-ScheduleSB-Inst.pdf',
      quotedText:
        'Line 15 – Railroad Retirement Benefits, Railroad Unemployment Insurance, and Sickness Benefits\nWisconsin does not tax amounts received from the U.S. Railroad Retirement Board. You may subtract railroad retirement benefits included on line 5b of your federal Form 1040 or 1040-SR.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2025,
    effectiveThrough: 2025,
    verifiedOn: '2026-09-09',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/params/state/types.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#incomeStreamSchema',
      'packages/engine/src/model/plan.ts#pensionSchema',
      'packages/engine/src/params/state/types.ts#StateTaxParams',
    ],
  },
  'iowa-code-422-5-alternate-minimum-tax': {
    title: 'Iowa tests minimum income and alternate tax separately from taxable income',
    statement: 'Iowa applies the $9,000/$13,500 minimum-income thresholds, raised to $24,000/$32,000 for the age-65 provision. The test adds back federal standard/itemized, personal-exemption and QBI deductions, including the enhanced senior deduction. Single returns use minimum-income retention, not a 4.3% alternate tax. Eligible joint/HOH/surviving-spouse returns compare regular tax with 4.3% of test net income above the applicable joint threshold. MFS requires combined spousal test income and allocates alternate tax using the Iowa taxable-income ratio; spouse NOL carry elections disallow alternate tax and the separate-return minimum relief. A claimed dependent is ineligible when the claiming household exceeds its applicable threshold. Unknown worksheet facts are incomplete. The test net-income base must not replace Iowa taxable income.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:IA',
    authority: [
      {
        kind: 'statute',
        citation: 'Iowa Code 422.5(2)(a), minimum retention and household limitations',
        url: 'https://www.legis.iowa.gov/docs/code/422.5.pdf',
        quotedText: 'The tax shall not be imposed on a resident or nonresident whose net income, as defined in section 422.7, is thirteen thousand five hundred dollars or less in the case of married persons filing jointly, heads of household, and surviving spouses or nine thousand dollars or less in the case of all other persons; but in the event that the payment of tax under this subchapter would reduce the net income to less than thirteen thousand five hundred dollars or nine thousand dollars as applicable, then the tax shall be reduced to that amount which would result in allowing the taxpayer to retain a net income of thirteen thousand five hundred dollars or nine thousand dollars as applicable. The preceding sentence does not apply to estates or trusts. For the purpose of this subsection, the entire net income, including any part of the net income not allocated to Iowa, shall be taken into account. In calculating net income for purposes of this subsection, any amount of itemized or standard deduction, personal exemption deduction, or qualified business income deduction that was allowed as a deduction in computing federal taxable income under the Internal Revenue Code shall be added back. If the combined net income of a husband and wife exceeds thirteen thousand five hundred dollars, neither of them shall receive the benefit of this subsection, and it is immaterial whether they file a joint return or separate returns. However, if a husband and wife file separate returns and have a combined net income of thirteen thousand five hundred dollars or less, neither spouse shall receive the benefit of this paragraph, if one spouse has a net operating loss and elects to carry back or carry forward the loss as provided under the Internal Revenue Code or in section 422.9. A person who is claimed as a dependent by another person as defined in section 422.12 shall not receive the benefit of this subsection if the person claiming the dependent has net income exceeding thirteen thousand five hundred dollars or nine thousand dollars as applicable or the person claiming the dependent and the person’s spouse have combined net income exceeding thirteen thousand five hundred dollars or nine thousand dollars as applicable.',
      },
      {
        kind: 'statute',
        citation: 'Iowa Code 422.5(2)(b), alternate tax and spouse NOL election',
        url: 'https://www.legis.iowa.gov/docs/code/422.5.pdf',
        quotedText: 'b. In lieu of the computation in subsection 1, or in paragraph “a” of this subsection, if the married persons’ filing jointly, head of household’s, or surviving spouse’s net income exceeds thirteen thousand five hundred dollars, the regular tax imposed under this subchapter shall be the lesser of the alternate state individual income tax rate of four and three-tenths percent times the portion of the net income in excess of thirteen thousand five hundred dollars or the regular tax liability computed without regard to this sentence. Taxpayers electing to file separately shall compute the alternate tax described in this paragraph using the total net income of the spouses. The alternate tax described in this paragraph does not apply if one spouse elects to carry back or carry forward a net operating loss as provided under the Internal Revenue Code or in section 422.9.',
      },
      {
        kind: 'statute',
        citation: 'Iowa Code 422.5(3)(a)–(c), age-65 thresholds and limitations',
        url: 'https://www.legis.iowa.gov/docs/code/422.5.pdf',
        quotedText: 'The tax shall not be imposed on a resident or nonresident who is at least sixty-five years old on December 31 of the tax year and whose net income, as defined in section 422.7, is thirty-two thousand dollars or less in the case of married persons filing jointly, heads of household, and surviving spouses or twenty-four thousand dollars or less in the case of all other persons; but in the event that the payment of tax under this subchapter would reduce the net income to less than thirty-two thousand dollars or twenty-four thousand dollars as applicable, then the tax shall be reduced to that amount which would result in allowing the taxpayer to retain a net income of thirty-two thousand dollars or twenty-four thousand dollars as applicable. The preceding sentence does not apply to estates or trusts. For the purpose of this subsection, the entire net income, including any part of the net income not allocated to Iowa, shall be taken into account. In calculating net income for purposes of this subsection, any amount of itemized or standard deduction, personal exemption deduction, or qualified business income deduction that was allowed as a deduction in computing federal taxable income under the Internal Revenue Code shall be added back. If the combined net income of a husband and wife exceeds thirty-two thousand dollars, neither of them shall receive the benefit of this subsection, and it is immaterial whether they file a joint return or separate returns. However, if a husband and wife file separate returns and have a combined net income of thirty-two thousand dollars or less, neither spouse shall receive the benefit of this paragraph, if one spouse has a net operating loss and elects to carry back or carry forward the loss as provided under the Internal Revenue Code or in section 422.9. A person who is claimed as a dependent by another person as defined in section 422.12 shall not receive the benefit of this subsection if the person claiming the dependent has net income exceeding thirty-two thousand dollars or twenty-four thousand dollars as applicable or the person claiming the dependent and the person’s spouse have combined net income exceeding thirty-two thousand dollars or twenty-four thousand dollars as applicable. b. In lieu of the computation in subsection 1 or 2, if the married persons’ filing jointly, head of household’s, or surviving spouse’s net income exceeds thirty-two thousand dollars, the regular tax imposed under this subchapter shall be the lesser of the alternate state individual income tax rate of four and three-tenths percent times the portion of the net income in excess of thirty-two thousand dollars or the regular tax liability computed without regard to this sentence. Taxpayers electing to file separately shall compute the alternate tax described in this paragraph using the total net income of the spouses. The alternate tax described in this paragraph does not apply if one spouse elects to carry back or carry forward a net operating loss as provided under the Internal Revenue Code or in section 422.9. c. This subsection applies even though one spouse has not attained the age of sixty-five, if the other spouse is at least sixty-five at the end of the tax year.',
      },
      {
        kind: 'stateAgencyPublication',
        citation: 'Iowa DOR, 2025 Line 05 Iowa Tax, married-filing-separately proration instructions',
        url: 'https://revenue.iowa.gov/taxes/tax-guidance/individual-income-tax/1040-expanded-instructions/iowa-tax',
        quotedText: 'must be prorated in the ratio of the Iowa taxable income of each spouse ... combined Iowa taxable income of both spouses',
      },
    ],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-12',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/tax/stateIowaRetirement.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.IA',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult',
      'packages/engine/src/tax/stateIowaRetirement.ts#iowaAlternateOrMinimumTax',
    ],
  },
  'il-personal-exemption-2026': {
    title: 'Illinois applies the 2026 exemption and AGI eligibility limits',
    statement: 'The TY2026 basic allowance is $2,925 per eligible exemption, with a separate $1,000 age-65 addition. The allowance is unavailable above $250,000 federal AGI for nonjoint returns or $500,000 joint. Return exemption/dependency and age counts are required independently of retirement subtraction eligibility.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:IL',
    authority: [
      {
        kind: 'stateAgencyPublication',
        citation: 'Illinois FY 2026-15',
        url: 'https://tax.illinois.gov/research/publications/bulletins/fy-2026-15.html',
        quotedText: 'The personal exemption amount for tax year 2026 will increase to $2,925.',
      },
      {
        kind: 'statute',
        citation: '35 ILCS 5/204(d), (g)',
        url: 'https://www.ilga.gov/documents/legislation/ilcs/documents/003500050K204.htm',
        quotedText: '(A) For taxpayer. An additional exemption of $1,000 for the taxpayer if he or she has attained the age of 65 before the end of the taxable year. … (g) Notwithstanding any other provision of law, for taxable years beginning on or after January 1, 2017, no taxpayer may claim an exemption under this Section if the taxpayer\'s adjusted gross income for the taxable year exceeds (i) $500,000, in the case of spouses filing a joint federal tax return or (ii) $250,000, in the case of all other taxpayers.',
      },
    ],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-09-12',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/tax/stateMidwestExtras.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.IL',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult',
      'packages/engine/src/tax/stateMidwestExtras.ts#illinoisPersonalExemptionAllowance',
    ],
  },
  'mo-retirement-income-deduction': {
    title: 'Missouri separates public, private, military and railroad retirement',
    statement: 'TY2026 public retirement is limited to the $48,967 maximum Social Security benefit less the applicable Social Security subtraction, without the pre-2024 AGI gate. Private retirement is capped at $6,000 per taxpayer and reduced by excess Missouri AGI above $25,000 single/HOH/QSS, $32,000 joint or $16,000 MFS. Military and qualifying Railroad Retirement benefits have separate full-subtraction treatment. Survivor Benefit Plan annuities belong to public pension treatment, not the military subtraction. Characterized source, owner and income facts are required.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:MO',
    authority: [
      {
        kind: 'stateAgencyPublication',
        citation: 'Missouri DOR pension FAQ',
        url: 'https://dor.mo.gov/faq/taxation/individual/pension.html',
        quotedText: 'The maximum exemption for private pension income is $6,000. … 2026 … $48,967',
      },
      {
        kind: 'statute',
        citation: 'RSMo 143.124.5, .7',
        url: 'https://revisor.mo.gov/main/OneSection.aspx?section=143.124',
        quotedText: 'For all tax years beginning on or after January 1, 2024, a taxpayer shall be entitled to the maximum exemption provided by this subsection regardless of the taxpayer\'s filing status or the amount of the taxpayer\'s Missouri adjusted gross income. … For purposes of calculating the subtraction provided in subsection 5 of this section, such subtraction shall be decreased by an amount equal to any Social Security benefit exemption provided under section 143.125.',
      },
    ],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-09-12',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/tax/stateMidwestExtras.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.MO',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult',
      'packages/engine/src/tax/stateMidwestExtras.ts#missouriPrivatePensionDeduction',
      'packages/engine/src/tax/stateMidwestExtras.ts#missouriPublicPensionDeduction',
      'packages/engine/src/tax/stateMidwestExtras.ts#missouriMilitaryAndRailroad',
    ],
  },
  'wi-2026-rates-standard-deduction-exemptions': {
    title: 'Wisconsin applies the 2026 income-tested deduction, exemptions and status schedules',
    statement: 'TY2026 Form 1-ES supplies the 3.5%, 4.4%, 5.3% and 7.65% schedules, with separate published MFS boundaries rather than rounded half-joint values. Standard deductions phase down with Wisconsin income: maximum $13,960 single, $18,030 HOH, $25,840 joint and $12,280 MFS. Eligible personal/dependent exemptions add $700 each and eligible age-65 additions add $250; dependency disallows the personal exemption. Part-year/nonresident calculations need the instructed income-ratio proration. The 2026 estimated-tax source is explicit; this record does not claim unpublished final 2026 Form 1 instructions.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:WI',
    authority: [
      {
        kind: 'formInstruction',
        citation: 'Wisconsin 2026 Form 1-ES, pages 2–3',
        url: 'https://www.revenue.wi.gov/TaxForms2026/2026-Form1-ES-Inst.pdf',
        quotedText: 'Your exemptions are $700 for yourself, $700 for your spouse if filing a joint return, and $700 for each dependent.',
      },
    ],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-09-12',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/tax/stateMidwestExtras.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.WI',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult',
      'packages/engine/src/tax/stateMidwestExtras.ts#wisconsinStandardDeduction',
      'packages/engine/src/tax/stateMidwestExtras.ts#wisconsinPersonalExemption',
    ],
  },
  'ks-direct-qcd-conformity': {
    title: 'Kansas preserves direct QCD exclusion and separately tests charitable-credit modifications',
    statement: 'Kansas begins with federal AGI and lists its additions. There is no general direct-QCD addition in the reviewed current enactment, so an eligible federally excluded direct QCD flows through without another subtraction. Covered charitable-credit additions are separate and require actual claimed-credit facts; unknown credit facts produce incomplete status. This bounded inference is not blanket conformity for all transaction types or a presumption that credits were not claimed.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:KS',
    authority: [
      {
        kind: 'statute',
        citation: 'Kansas 2026 chapter 154, section 2, 79-32,117(a),(b)(vii)',
        url: 'https://www.sos.ks.gov/publications/sessionlaws/2026/Chapter-154-SB-300.html',
        quotedText: 'The Kansas adjusted gross income of an individual means such individual’s federal adjusted gross income for the taxable year, with the modifications specified in this section. … (vii) The amount of any charitable contribution made to the extent the same is claimed as the basis for the credit allowed pursuant to K.S.A. 79-32,196, and amendments thereto. ',
      },
    ],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-12',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/tax/stateQcdHsa.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.KS',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult',
      'packages/engine/src/tax/stateQcdHsa.ts#stateDirectQcdCollectionAdjustment',
    ],
  },
} satisfies Record<string, TaxRuleRecord>
