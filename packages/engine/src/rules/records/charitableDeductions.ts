/**
 * Charitable deduction records: the section 170 percentage ceilings, the 0.5% floor
 * and its ordering, the section 68 overall limitation, and the split-interest and
 * donor-advised-fund vehicles the engine does not model.
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
export const charitableDeductionRecords = {
  'irc-170-b-1-I-half-percent-floor': {
    title: 'The 0.5% floor on an itemizer’s charitable contributions',
    statement:
      'An itemizer may deduct a charitable contribution only to the extent the aggregate of such contributions exceeds 0.5 percent of the contribution base, which 170(b)(1)(H) defines as adjusted gross income before any net operating loss carryback. Because the allowance is only of the excess, a gift at or below the floor is disallowed in full rather than merely reduced.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 170(b)(1)(I)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'Any charitable contribution otherwise allowable (without regard to this subparagraph) as a deduction under this section shall be allowed only to the extent that the aggregate of such contributions exceeds 0.5 percent of the taxpayer\'s contribution base for the taxable year.',
    }, {
      kind: 'statute',
      citation: 'IRC 170(b)(1)(H)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'For purposes of this section, the term "contribution base" means adjusted gross income (computed without regard to any net operating loss carryback to the taxable year under section 172).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/actions/annualQcdItemizedSection170Ledger.ts',
      'packages/engine/src/tax/annualCharitableDeductionParameters.ts',
      'packages/engine/src/tax/federalTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdItemizedSection170Ledger.ts#stageAnnualQcdItemizedSection170Ledger',
      'packages/engine/src/tax/annualCharitableDeductionParameters.ts#annualCharitableDeductionParameters',
      'packages/engine/src/tax/federalTax.ts#charitableAfterFloor',
    ],
  },

  'irc-170-b-1-I-floor-ordering': {
    title: 'Order of the 0.5% floor and the percentage ceiling',
    statement:
      'The 0.5% itemizer floor reduces the contribution otherwise allowable after the percentage ceiling has been applied: min(C, L) - F, never min(C - F, L).',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 170(b)(1)(I)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'Any charitable contribution otherwise allowable (without regard to this subparagraph) as a deduction under this section shall be allowed only to the extent that the aggregate of such contributions exceeds 0.5 percent of the taxpayer’s contribution base for the taxable year.',
    }, {
      kind: 'legislativeHistory',
      citation: 'JCT, General Explanation of P.L. 119-21 (JCS-1-26)',
      url: 'https://www.jct.gov/getattachment/16f5eded-d2f9-425e-80a2-83a930056c38/s-1-26.pdf',
      quotedText:
        'Charitable contributions that exceed the applicable percentage limit generally may be carried forward for up to five years.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-02',
    implementedBy: ['packages/engine/src/actions/annualQcdItemizedSection170Ledger.ts'],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdItemizedSection170Ledger.ts#stageAnnualQcdItemizedSection170Ledger',
    ],
  },

  'irc-170-d-1-C-floor-carryforward-gate': {
    title: 'Floor-disallowed amounts carry forward only from a year with an excess',
    statement:
      'The amount disallowed by the 0.5% floor has no independent carryover. It survives only by increasing an excess already carried forward under another carryover rule, so in a year with no percentage-limit excess it is permanently lost.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 170(d)(1)(C)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'In the case of any taxable year from which an excess is carried forward (determined without regard to this subparagraph) under any carryover rule, the applicable carryover rule shall be applied by increasing the excess determined under such applicable carryover rule for the contribution year (before the application of subparagraph (B)) by the amount attributable to the charitable contributions to which such rule applies which is not allowed as a deduction for the contribution year by reason of subsection (b)(1)(I).',
    }, {
      kind: 'legislativeHistory',
      citation: 'JCT, General Explanation of P.L. 119-21 (JCS-1-26)',
      url: 'https://www.jct.gov/getattachment/16f5eded-d2f9-425e-80a2-83a930056c38/s-1-26.pdf',
      quotedText:
        'If a taxpayer has excess contributions in a taxable year, the taxpayer is permitted to carry forward the amount disallowed by the 0.5 percent floor.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-02',
    implementedBy: ['packages/engine/src/actions/annualQcdItemizedSection170Ledger.ts'],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdItemizedSection170Ledger.ts#stageAnnualQcdItemizedSection170Ledger',
    ],
  },

  'irc-170-b-1-I-ii-category-waterfall': {
    title: 'Category order in which the 0.5% floor is absorbed',
    statement:
      'The floor is consumed against contribution categories in the fixed order (D), (C), (B), (E), (A), (G), so 60% cash gifts to public charities absorb it last. A single-category ledger must be told the floor already consumed by earlier categories.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 170(b)(1)(I)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'The preceding sentence shall be applied— (i) first, by taking into account charitable contributions to which subparagraph (D) applies to the extent thereof, (ii) second, ... subparagraph (C) ..., (iii) third, ... subparagraph (B) ..., (iv) fourth, ... subparagraph (E) ..., (v) fifth, ... subparagraph (A) ..., and (vi) sixth, by taking into account charitable contributions to which subparagraph (G) applies to the extent thereof.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-02',
    implementedBy: ['packages/engine/src/actions/annualQcdItemizedSection170Ledger.ts'],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdItemizedSection170Ledger.ts#stageAnnualQcdItemizedSection170Ledger',
    ],
  },

  'irc-170-p-standard-deduction-carryover': {
    title: 'Carryover generated in a standard-deduction year',
    statement:
      'A year in which the taxpayer claims the 170(p) nonitemizer deduction still generates a five-year carryover, but only for contributions exceeding the percentage-of-contribution-base ceiling. The 170(p) dollar cap is not a carryover-generating limitation, so the slice between the cap and the ceiling is permanently lost.',
    classification: 'unsettled',
    contraryReading:
      'Practitioner literature states without qualification that unused 170(p) amounts do not carry forward, which read literally would deny a carryover even above the ceiling. That shorthand describes the 170(p) allowance itself rather than 170(d)(1), and no published source addresses the question either way. The supporting regulation still cites section 144, repealed in 1976, and no post-OBBBA authority applies it.',
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 170(d)(1)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'In the case of an individual, if the amount of charitable contributions described in subsection (b)(1)(A) payment of which is made within a taxable year ... exceeds 50 percent of the taxpayer\'s contribution base for such year, such excess shall be treated as a charitable contribution described in subsection (b)(1)(A) paid in each of the 5 succeeding taxable years in order of time ...',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.170A-10(a)(2)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.170A-10',
      quotedText:
        'The carryover provisions apply with respect to contributions made during a taxable year in excess of the applicable percentage limitation even though the taxpayer elects under section 144 to take the standard deduction in that year instead of itemizing the deduction allowable in computing taxable income for that year.',
    }, {
      kind: 'statute',
      citation: 'IRC 170(d)(1)(C)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'For purposes of this subparagraph, the term “carryover rule” means— (I) subparagraph (A) of this paragraph, (II) subparagraphs (C)(ii), (D)(ii), (E)(ii), and (G)(ii) of subsection (b)(1), and (III) the second sentence of subsection (b)(1)(B).',
    }],
    volatility: 'awaitingGuidance',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: ['packages/engine/src/actions/annualQcdStandardSection170pLedger.ts'],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdStandardSection170pLedger.ts#stageAnnualQcdStandardSection170pLedger',
    ],
  },

  // --- Registered 2026-08-03 from the second research batch ---------------

  'irc-68-overall-itemized-limitation': {
    title: 'Overall limitation on itemized deductions',
    statement:
      'Itemized deductions otherwise allowable are reduced by exactly 2/37 of the lesser of those deductions or the excess of taxable income, computed without regard to section 68 and increased by those deductions, over the dollar amount at which the 37 percent bracket begins. It applies after every other limitation on an itemized deduction.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Publication 505 states the rate as 5.4 percent, which is a truncation of 2/37 (0.0540540...), not the rule. The engine computes the exact rational because the difference is roughly $5.41 per $100,000 of limitation base and this provision only bites at incomes where that is real money. Note also that the amended section has no exempt categories and no 80 percent cap, both features of the pre-2018 Pease rule, so logic ported from that era would carry forward carve-outs that no longer exist. The indexed thresholds are the starts of the 37 percent rows in Rev. Proc. 2025-32 section 4.01, quoted below. Its filing-status rows map directly to the parameter carrier: joint and surviving-spouse share one row, while head of household, unmarried individuals, and married filing separately each retain their own row. This preserves the same rate-table convention as irc-1-j-2-progressive-ordinary-rate-schedule while retaining every status-specific threshold required by section 68.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 68(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section68&num=0&edition=prelim',
      quotedText:
        'the amount of the itemized deductions otherwise allowable for the taxable year (determined without regard to this section) shall be reduced by 2/37 of the lesser of- (1) such amount of itemized deductions, or (2) so much of the taxable income of the taxpayer for the taxable year (determined without regard to this section and increased by such amount of itemized deductions) as exceeds the dollar amount at which the 37 percent rate bracket under section 1 begins with respect to the taxpayer.',
    }, {
      kind: 'statute',
      citation: 'IRC 68(b)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section68&num=0&edition=prelim',
      quotedText:
        'This section shall be applied after the application of any other limitation on the allowance of any itemized deduction.',
    }, {
      kind: 'irsNotice',
      citation: 'Rev. Proc. 2025-32, section 4.01, Tables 1-4',
      url: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
      quotedText:
        'TABLE 1 - Section 1(j)(2)(A) –Married Individuals Filing Joint Returns and Surviving Spouses … Over $768,700 $206,583.50 plus 37% of the excess over $768,700 … TABLE 2 - Section 1(j)(2)(B) - Heads of Households … Over $640,600 $191,171 plus 37% of the excess over $640,600 … TABLE 3 - Section 1(j)(2)(C) – Unmarried Individuals (other than Surviving Spouses and Heads of Households) … Over $640,600 $192,979.25 plus 37% of the excess over $640,600 … TABLE 4 - Section 1(j)(2)(D) – Married Individuals Filing Separate Returns … Over $384,350 $103,291.75 plus 37% of the excess over $384,350',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-29',
    implementedBy: [
      'packages/engine/src/actions/annualSection68ItemizedDeduction.ts',
      'packages/engine/src/tax/annualCharitableDeductionParameters.ts',
      'packages/engine/src/tax/federalTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualSection68ItemizedDeduction.ts#buildAnnualSection68ItemizedDeductionEvidence',
      'packages/engine/src/tax/annualCharitableDeductionParameters.ts#annualCharitableDeductionParameters',
      'packages/engine/src/tax/federalTax.ts#section68Reduction',
    ],
  },

  'irc-170-b-1-C-capital-gain-property-ceiling-not-modeled': {
    title: 'The 30 percent capital-gain-property ceiling is not an input or calculation surface',
    statement:
      'Section 170(b)(1)(C) limits certain capital-gain-property contributions to 30 percent of contribution base and orders them after other charitable contributions. The Plan carries one undifferentiated nonnegative charitable amount, not the contributed property\'s gain character, the section 170(b)(1)(A) recipient status, subsection (e)(1)(B) treatment, contribution ordering, or any carryforward. No accepted Plan fact identifies a contribution to which 170(b)(1)(C) applies, so the engine produces no capital-gain-property ceiling figure; a user-entered charitable amount is not such a claim.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 170(b)(1)(C)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'In the case of charitable contributions described in subparagraph (A) of capital gain property to which subsection (e)(1)(B) does not apply, the total amount of contributions of such property which may be taken into account under subsection (a) for any taxable year shall not exceed 30 percent of the taxpayer\'s contribution base for such year. For purposes of this subsection, contributions of capital gain property to which this subparagraph applies shall be taken into account after all other charitable contributions (other than charitable contributions to which subparagraph (D) applies).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: ['packages/engine/src/model/plan.ts'],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#itemizedDeductionsSchema',
    ],
  },

  'irc-170-b-1-G-cash-percentage-ceiling': {
    title: 'Sixty percent ceiling for cash gifts to public charities',
    statement:
      'Cash contributions to public charities are allowed up to 60 percent of the contribution base reduced by contributions already taken into account under 170(b)(1)(A), with the excess carried forward five years. It is a combined ceiling, not an independent bucket stacked on the 50 percent limit.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Effective from 2018 rather than 2026, aligned with irc-170-b-1-G-projection-cash-ceiling-not-applied on 2026-08-04 after the two records disagreed about the same clause. This field means the first tax year the rule governs, and (G)(i) fixes that in its own words: for taxable years beginning after December 31, 2017. Pub. L. 119-21 section 70425(b)(1) rewrote the clause for years beginning after 2025, but what it removed was the pre-OBBBA expiry scheduled for the end of 2025; the 60 percent figure and the 2018 start survived it unchanged. Reading the rewrite as a new start date would imply the ceiling did not govern 2018 through 2025, which is false, and would make a year filter over this registry answer wrongly for those years.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 170(b)(1)(G)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'For taxable years beginning after December 31, 2017, any contribution of cash to an organization described in subparagraph (A) shall be allowed as a deduction under subsection (a) to the extent that the aggregate of such contributions does not exceed the excess of- (I) 60 percent of the taxpayer\'s contribution base for the taxable year, over (II) the aggregate amount of contributions taken into account under subparagraph (A) for such taxable year.',
    }, {
      kind: 'statute',
      citation: 'IRC 170(b)(1)(G)(iii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'Contributions taken into account under this subparagraph shall not be taken into account under subparagraph (A). ... subparagraph (A) shall be applied by reducing (but not below zero) the contribution limitation allowed for the taxable year under such subparagraph by the aggregate contributions allowed under this subparagraph for such taxable year.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2018,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/actions/annualQcdItemizedSection170Ledger.ts',
      'packages/engine/src/tax/annualCharitableDeductionParameters.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdItemizedSection170Ledger.ts#stageAnnualQcdItemizedSection170Ledger',
      'packages/engine/src/tax/annualCharitableDeductionParameters.ts#annualCharitableDeductionParameters',
    ],
  },

  'irc-664-charitable-remainder-trust-payout-and-character-mechanics-not-modeled': {
    title: 'Charitable remainder trust payout, remainder, and distribution-character mechanics are not modelled',
    statement:
      'Section 664 applies to charitable remainder annuity trusts and unitrusts, exempts those trusts from income tax under section 664(c)(1) except for the unrelated-business taxable income excise under section 664(c)(2), and defines their required payout and charitable-remainder conditions. RetireGolden has no charitable-remainder trust entity; no initial or annual trust property value, payout rate or amount, annuitant or life/term, remainder recipient, trust income-category or corpus balance, basis, or trustee distribution. It therefore produces neither a section 664 qualification, exemption, payout, or remainder-value figure nor a section 664(b) beneficiary income-character result. A split-interest QCD is refused before settlement instead of supplying any of those trust facts.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The 5-to-50-percent payout bounds, the 10-percent remainder tests, the four-tier distribution ordering, and the CRAT probability-of-exhaustion question all share this absent CRT entity and payout surface. The supplied text of Treas. Reg. 1.664-2 contains no probability-of-exhaustion language to quote, so that practical test is not separately registered on this source set.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 664(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section664&num=0&edition=prelim',
      quotedText:
        'Notwithstanding any other provision of this subchapter, the provisions of this section shall, in accordance with regulations prescribed by the Secretary, apply in the case of a charitable remainder annuity trust and a charitable remainder unitrust.',
    }, {
      kind: 'statute',
      citation: 'IRC 664(c)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section664&num=0&edition=prelim',
      quotedText:
        'A charitable remainder annuity trust and a charitable remainder unitrust shall, for any taxable year, not be subject to any tax imposed by this subtitle.',
    }, {
      kind: 'statute',
      citation: 'IRC 664(c)(2)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section664&num=0&edition=prelim',
      quotedText:
        'In the case of a charitable remainder annuity trust or a charitable remainder unitrust which has unrelated business taxable income (within the meaning of section 512, determined as if part III of subchapter F applied to such trust) for a taxable year, there is hereby imposed on such trust or unitrust an excise tax equal to the amount of such unrelated business taxable income.',
    }, {
      kind: 'statute',
      citation: 'IRC 664(d)(1)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section664&num=0&edition=prelim',
      quotedText:
        '(A) from which a sum certain (which is not less than 5 percent nor more than 50 percent of the initial net fair market value of all property placed in trust) is to be paid, not less often than annually, to one or more persons (at least one of which is not an organization described in section 170(c) and, in the case of individuals, only to an individual who is living at the time of the creation of the trust) for a term of years (not in excess of 20 years) or for the life or lives of such individual or individuals,',
    }, {
      kind: 'statute',
      citation: 'IRC 664(d)(1)(D)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section664&num=0&edition=prelim',
      quotedText:
        '(D) the value (determined under section 7520) of such remainder interest is at least 10 percent of the initial net fair market value of all property placed in the trust.',
    }, {
      kind: 'statute',
      citation: 'IRC 664(d)(2)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section664&num=0&edition=prelim',
      quotedText:
        '(A) from which a fixed percentage (which is not less than 5 percent nor more than 50 percent) of the net fair market value of its assets, valued annually, is to be paid, not less often than annually, to one or more persons (at least one of which is not an organization described in section 170(c) and, in the case of individuals, only to an individual who is living at the time of the creation of the trust) for a term of years (not in excess of 20 years) or for the life or lives of such individual or individuals,',
    }, {
      kind: 'statute',
      citation: 'IRC 664(d)(2)(D)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section664&num=0&edition=prelim',
      quotedText:
        '(D) with respect to each contribution of property to the trust, the value (determined under section 7520) of such remainder interest in such property is at least 10 percent of the net fair market value of such property as of the date such property is contributed to the trust.',
    }, {
      kind: 'statute',
      citation: 'IRC 664(b)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section664&num=0&edition=prelim',
      quotedText:
        'Amounts distributed by a charitable remainder annuity trust or by a charitable remainder unitrust shall be considered as having the following characteristics in the hands of a beneficiary to whom is paid the annuity described in subsection (d)(1)(A) or the payment described in subsection (d)(2)(A): (1) First, as amounts of income (other than gains, and amounts treated as gains, from the sale or other disposition of capital assets) includible in gross income to the extent of such income of the trust for the year and such undistributed income of the trust for prior years; (2) Second, as a capital gain to the extent of the capital gain of the trust for the year and the undistributed capital gain of the trust for prior years; (3) Third, as other income to the extent of such income of the trust for the year and such undistributed income of the trust for prior years; and (4) Fourth, as a distribution of trust corpus.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: ['packages/engine/src/model/plan.ts'],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#planSchema',
    ],
  },

  'irc-7520-and-2522-split-interest-valuation-not-modeled': {
    title: 'Section 7520 and section 2522 split-interest valuation are not modelled',
    statement:
      'Section 7520 values annuity, life-or-term, remainder, and reversionary interests under prescribed tables and a valuation-month interest rate. Section 2522 allows the gift-tax charitable deduction for a retained-property transfer only subject to its stated conditions, including charitable-remainder, pooled-income, guaranteed-annuity, and fixed-percentage forms. RetireGolden has no transfer or valuation date, applicable section 7520 rate, trust property value, payout terms, measuring lives or term, prescribed-table factors, retained interest, gift, or gift-tax calculation, so it produces no section 7520 or section 2522 split-interest valuation or deduction figure.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 7520(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section7520&num=0&edition=prelim',
      quotedText:
        'For purposes of this title, the value of any annuity, any interest for life or a term of years, or any remainder or reversionary interest shall be determined- (1) under tables prescribed by the Secretary, and (2) by using an interest rate (rounded to the nearest 2/10ths of 1 percent) equal to 120 percent of the Federal midterm rate in effect under section 1274(d)(1) for the month in which the valuation date falls.',
    }, {
      kind: 'statute',
      citation: 'IRC 2522(c)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section2522&num=0&edition=prelim',
      quotedText:
        'Where a donor transfers an interest in property (other than an interest described in section 170(f)(3)(B)) to a person, or for a use, described in subsection (a) or (b) and an interest in the same property is retained by the donor, or is transferred or has been transferred (for less than an adequate and full consideration in money or money\'s worth) from the donor to a person, or for a use, not described in subsection (a) or (b), no deduction shall be allowed under this section for the interest which is, or has been transferred to the person, or for the use, described in subsection (a) or (b), unless- (A) in the case of a remainder interest, such interest is in a trust which is a charitable remainder annuity trust or a charitable remainder unitrust (described in section 664) or a pooled income fund (described in section 642(c)(5)), or (B) in the case of any other interest, such interest is in the form of a guaranteed annuity or is a fixed percentage distributed yearly of the fair market value of the property (to be determined yearly).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: ['packages/engine/src/model/plan.ts'],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#planSchema',
    ],
  },

  // --- Registered 2026-08-04: the charitable and section 68 cluster --------
  //
  // Four of these say the same structural thing from different angles. The
  // engine holds an exact, well-tested implementation of the OBBBA charitable
  // and section 68 rules in packages/engine/src/actions -- the section 170
  // ledgers, the section 68 attribution chain, and the parameters they read --
  // and `git grep` finds no reference to any of it from
  // packages/engine/src/projection or packages/engine/src/tax/federalTax.ts.
  // The figure a plan actually shows comes from `itemizedTotal`, which sums
  // capped SALT, mortgage interest and charitable and applies no limitation to
  // the third. So the correct code is not what runs, and the records below
  // pin the live behaviour rather than the shelved one.

  'irc-170-p-nonitemizer-deduction-dollar-cap': {
    title: 'Dollar cap on the charitable deduction of a taxpayer who does not itemize',
    statement:
      'An individual who does not elect to itemize is still allowed a charitable deduction, but only for gifts made in cash to a 170(b)(1)(A) organization and only up to $1,000, or $2,000 on a joint return. The allowance is computed without regard to 170(b)(1)(G)(ii), 170(b)(1)(I), and 170(d)(1), so the 0.5 percent floor never reduces it and no carried-forward contribution can feed it; the 60 percent ceiling of (G)(i) is not on that list and does still apply. The cap is a flat statutory figure carrying no inflation adjustment.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The engine hard-codes $1,000 and $2,000 while the codified text quoted below reads "not in excess of 1,000 ($2,000 in the case of a joint return)", with no currency symbol on the first figure. That is a compilation artifact, not a reading: Pub. L. 119-21 section 70424(a) substituted "$1,000 ($2,000" for "$300 ($600" as a single quoted fragment, and the Office of the Law Revision Counsel reports it that way in its own amendment note, which is the second authority below. The engine takes the enacted figure. The other trap here is the predecessor: this subsection carried $300 ($600 joint) for 2021 under the CARES-era rule, and code or test data ported from that era is wrong by a factor of more than three in the taxpayer’s disfavour.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 170(p)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'In the case of any taxable year, if the individual does not elect to itemize deductions for such taxable year, the deduction under this section shall be equal to the deduction, not in excess of 1,000 ($2,000 in the case of a joint return), which would be determined under this section if the only charitable contributions taken into account in determining such deduction were contributions made in cash during such taxable year (determined without regard to subsections (b)(1)(G)(ii), (b)(1)(I), and (d)(1)) to an organization described in section 170(b)(1)(A)',
    }, {
      kind: 'statute',
      citation: 'IRC 170(p), Editorial Notes, Amendments, 2025',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'in introductory provisions, struck out "beginning in 2021" after "In the case of any taxable year" and substituted "$1,000 ($2,000" for "$300 ($600".',
    }, {
      kind: 'statute',
      citation: 'Pub. L. 119-21, sec. 70424(b) (OBBBA)',
      url: 'https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm',
      quotedText:
        'Effective Date.--The amendments made by this section shall apply to taxable years beginning after December 31, 2025.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/actions/annualQcdStandardSection170pLedger.ts',
      'packages/engine/src/tax/annualCharitableDeductionParameters.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdStandardSection170pLedger.ts#stageAnnualQcdStandardSection170pLedger',
      'packages/engine/src/tax/annualCharitableDeductionParameters.ts#annualCharitableDeductionParameters',
    ],
  },

  'irc-170-b-1-G-projection-cash-ceiling-not-applied': {
    title: 'The 60 percent ceiling on cash gifts is not applied to the projected charitable deduction',
    statement:
      'Cash contributions to public charities are deductible only up to 60 percent of the contribution base reduced by contributions already taken into account under 170(b)(1)(A), and (G)(ii) carries the excess forward as a contribution of the same class in each of the 5 succeeding years. Not modelled: the live tax path applies the 170(b)(1)(I) floor but no percentage ceiling, and holds no carryforward state of any kind, so a household giving above the ceiling receives in one year a deduction the statute spreads across as many as six, and receives nothing in the five that follow. The ceiling is deliberately not wired ahead of the carryforward: applying it alone would disallow dollars 170(b)(1)(G)(ii) merely defers and never return them, which is a worse answer than the present one rather than a partial fix. It also treats the whole supplied figure as cash to a public charity, which the plan schema cannot contradict -- an appreciated-property gift faces a 30 percent limit under 170(b)(1)(C) and would need a category the input does not carry.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'This is the timing case the errorDirection doc comment describes, and the sign really does turn on the year rather than being undetermined. In the gift year the engine’s deduction is too large and tax is understated; in each of the five succeeding years it is too small, because the carryforward the statute grants is not there, and tax is overstated. It does not net to nothing even in principle: a carryforward the taxpayer never has the income to absorb expires unused, which for a household drawing down in retirement is the likely outcome, and in that case the engine’s year-one generosity is a permanent understatement. Nor is an annual projection indifferent to which year a deduction lands in, since the year decides the bracket it offsets, the capital-gain stacking threshold, and the modified AGI that sets the Medicare premium adjustment two years later. The effectiveFrom is 2018 rather than 2026 because the clause quoted below says so in its own words; Pub. L. 119-21 section 70425(b)(1) rewrote (G)(i) effective for taxable years beginning after 2025, but what it removed was the pre-OBBBA expiry, leaving both the 60 percent figure and the 2018 start date intact. The correct implementation lives in packages/engine/src/actions/annualQcdItemizedSection170Ledger.ts and is registered at irc-170-b-1-G-cash-percentage-ceiling; the live path does not reach it.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 170(b)(1)(G)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'For taxable years beginning after December 31, 2017, any contribution of cash to an organization described in subparagraph (A) shall be allowed as a deduction under subsection (a) to the extent that the aggregate of such contributions does not exceed the excess of- (I) 60 percent of the taxpayer\'s contribution base for the taxable year, over (II) the aggregate amount of contributions taken into account under subparagraph (A) for such taxable year.',
    }, {
      kind: 'statute',
      citation: 'IRC 170(b)(1)(G)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'If the aggregate amount of contributions described in clause (i) exceeds the applicable limitation under clause (i) for any taxable year described in such clause, such excess shall be treated (in a manner consistent with the rules of subsection (d)(1)) as a charitable contribution to which clause (i) applies in each of the 5 succeeding years in order of time.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2018,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
    implementedByFunctions: [
      'packages/engine/src/tax/federalTax.ts#itemizedTotal',
    ],
  },

  'irc-170-p-projection-nonitemizer-deduction-not-allowed': {
    title: 'The nonitemizer charitable deduction is not allowed in the projection',
    statement:
      'For an individual who does not elect to itemize, 63(b) defines taxable income as adjusted gross income minus a list of deductions that includes both the standard deduction and the deduction provided in section 170(p), so the nonitemizer charitable allowance of up to $1,000, or $2,000 on a joint return, is additive to the standard deduction rather than a competitor to it. Not modelled: the live tax path uses the supplied charitable figure only inside its itemized total and then takes the greater of that total and the standard deduction, so a household that does not itemize deducts nothing whatever for its gifts and pays tax on up to $2,000 more income than the statute reaches, every year it gives.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale:
      'The smallest of these gaps per year and the one that reaches the most households, because after the OBBBA standard deduction most retirees do not itemize at all, and for them the engine’s charitable input is inert. It is also the only one of the four whose sign favours the fisc, and no interaction runs the other way: the allowance is a floor-free, carryover-free addition to a base the engine already grants, so omitting it can only enlarge taxable income. What it is NOT is a typed refusal — the projection accepts the charitable figure, silently discards it, and returns a number, which is why this is approximated rather than outOfScope. The correct ledger, including the shared joint cap and the (G)(i) capacity interaction, is in packages/engine/src/actions/annualQcdStandardSection170pLedger.ts and is registered at irc-170-p-nonitemizer-deduction-dollar-cap.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 63(b)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section63&num=0&edition=prelim',
      quotedText:
        'In the case of an individual who does not elect to itemize his deductions for the taxable year, for purposes of this subtitle, the term "taxable income" means adjusted gross income, minus- (1) the standard deduction, (2) the deduction for personal exemptions provided in section 151, (3) any deduction provided in section 199A, (4) the deduction provided in section 170(p),',
    }, {
      kind: 'statute',
      citation: 'IRC 170(p)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'In the case of any taxable year, if the individual does not elect to itemize deductions for such taxable year, the deduction under this section shall be equal to the deduction, not in excess of 1,000 ($2,000 in the case of a joint return), which would be determined under this section if the only charitable contributions taken into account in determining such deduction were contributions made in cash during such taxable year',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
    implementedByFunctions: [
      'packages/engine/src/tax/federalTax.ts#deduction',
    ],
  },

  // --- Registered 2026-08-27: WS4c Cluster 4 (DAF vehicle) -------------------
  //
  // Cluster 3 owns the engine-behavior classification of the 170(b)(1)(C)
  // 30 percent capital-gain-property ceiling. A gift of appreciated property
  // to a DAF has no distinct percentage surface once the DAF vehicle itself
  // is absent, so that limb is not minted here.

  'irc-4966-d-donor-advised-fund-vehicle-not-modeled': {
    title: 'A donor advised fund is not a modeled contribution vehicle',
    statement:
      'A donor advised fund is a separately identified fund owned and controlled by a sponsoring organization, with respect to which the donor has only advisory privileges; a section 170 deduction for a contribution to it is allowed only under the section 170(f)(18) conditions, including the sponsoring organization\'s acknowledgment of exclusive legal control over the assets contributed. Not modelled: the Plan has no donor-advised-fund account, contribution event, grant schedule, advisory-privilege, sponsoring-organization, or exclusive-legal-control fact, so no accepted input reaches this rule. Generic itemized charitable and QCD fields are not a DAF. The 4966 taxable-distribution excise and the 4967 more-than-incidental-benefit excise turn on the same absent vehicle and are folded here rather than given records of their own. A named QCD whose charity is designated a donor-advised fund is a different surface, already refused at irc-408-d-8-B-i-qualified-recipient.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 4966(d)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section4966&num=0&edition=prelim',
      quotedText:
        'The term "sponsoring organization" means any organization which- (A) is described in section 170(c) (other than in paragraph (1) thereof, and without regard to paragraph (2)(A) thereof), (B) is not a private foundation (as defined in section 509(a)), and (C) maintains 1 or more donor advised funds.',
    }, {
      kind: 'statute',
      citation: 'IRC 4966(d)(2)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section4966&num=0&edition=prelim',
      quotedText:
        'Except as provided in subparagraph (B) or (C), the term "donor advised fund" means a fund or account- (i) which is separately identified by reference to contributions of a donor or donors, (ii) which is owned and controlled by a sponsoring organization, and (iii) with respect to which a donor (or any person appointed or designated by such donor) has, or reasonably expects to have, advisory privileges with respect to the distribution or investment of amounts held in such fund or account by reason of the donor\'s status as a donor.',
    }, {
      kind: 'statute',
      citation: 'IRC 170(f)(18)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'A deduction otherwise allowed under subsection (a) for any contribution to a donor advised fund (as defined in section 4966(d)(2)) shall only be allowed if-',
    }, {
      kind: 'statute',
      citation: 'IRC 170(f)(18)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'the taxpayer obtains a contemporaneous written acknowledgment (determined under rules similar to the rules of paragraph (8)(C)) from the sponsoring organization (as so defined) of such donor advised fund that such organization has exclusive legal control over the assets contributed.',
    }, {
      kind: 'statute',
      citation: 'IRC 4966(a)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section4966&num=0&edition=prelim',
      quotedText:
        'There is hereby imposed on each taxable distribution a tax equal to 20 percent of the amount thereof. The tax imposed by this paragraph shall be paid by the sponsoring organization with respect to the donor advised fund.',
    }, {
      kind: 'statute',
      citation: 'IRC 4967(a)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section4967&num=0&edition=prelim',
      quotedText:
        'There is hereby imposed on the advice of any person described in subsection (d) to have a sponsoring organization make a distribution from a donor advised fund which results in such person or any other person described in subsection (d) receiving, directly or indirectly, a more than incidental benefit as a result of such distribution, a tax equal to 125 percent of such benefit. The tax imposed by this paragraph shall be paid by any person described in subsection (d) who advises as to the distribution or who receives such a benefit as a result of the distribution.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: ['packages/engine/src/model/plan.ts'],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#itemizedDeductionsSchema',
    ],
  },
} satisfies Record<string, TaxRuleRecord>
