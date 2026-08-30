/**
 * Individual income tax records: the ordinary rate schedule and its annual
 * adjustment, the standard deduction and its additions, the senior and SALT
 * deductions, qualified residence interest, and the alternative minimum tax.
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
export const individualIncomeTaxRecords = {
  'irc-55-a-amt-is-the-excess-over-regular-tax': {
    title: 'AMT is the excess of tentative minimum tax over regular tax',
    statement:
      'The tentative minimum tax is a two-layer schedule on the taxable excess, 26 percent to the breakpoint and 28 percent above it. What is actually owed is only the amount by which that exceeds the regular tax, so a taxpayer whose regular tax already exceeds the tentative amount owes no additional minimum tax at all.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Section 55(b)(1) states the breakpoint as $175,000 and it is inflation-adjusted; the 2026 pack carries 244,500. The record is annually indexed for that reason, and the statutory figure should not be read as the current one.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 55(a)',
      url: 'https://www.law.cornell.edu/uscode/text/26/55',
      quotedText:
        'There is hereby imposed (in addition to any other tax imposed by this subtitle) a tax equal to the excess (if any) of\u2014 (1) the tentative minimum tax for the taxable year, over (2) the regular tax for the taxable year plus, in the case of an applicable corporation, the tax imposed by section 59A.',
    }, {
      kind: 'statute',
      citation: 'IRC 55(b)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/55',
      quotedText:
        'The tentative minimum tax for the taxable year is the sum of— (i) 26 percent of so much of the taxable excess as does not exceed $175,000, plus (ii) 28 percent of so much of the taxable excess as exceeds $175,000.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-28',
    implementedBy: [
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/tax/federalTax.ts#computeFederalTax',
      'packages/engine/src/tax/federalTax.ts#tentativeMinimumTax',
    ],
  },

  'irc-55-d-exemption-phase-out-rate': {
    title: 'The AMT exemption phases out at 50 percent from 2026',
    statement:
      'The exemption is reduced, but not below zero, by 50 percent of the amount by which alternative minimum taxable income exceeds the phase-out threshold. The threshold is 500,000 dollars for an unmarried taxpayer and 1,000,000 dollars on a joint return, both indexed.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'One authority per claim in the statement, because each claim rests on a different provision. 55(d)(2) carries the reduction formula and the not-below-zero floor; its 25 percent is the unmodified figure the substitution below replaces, so the two have to be read together. The codified 55(d)(4)(A)(ii) carries the rest: subclause (I) substitutes the 1,000,000 dollar threshold and subclause (IV) substitutes 50 percent for 25 percent. 55(d)(4)(B)(i) carries the indexing, and independently names the 1,000,000 dollar amount as the subparagraph (A)(ii)(I) amount. Paragraph (2)(A) is the joint-return figure and (B) is 50 percent of it, which is where the 500,000 dollar amount for an unmarried taxpayer comes from. The enrolled bill is kept beside it as the amending authority, because (IV) exists only because section 70107(c) added it and a reader tracing the 50 percent figure should be able to see the instruction that created it. Corrected 2026-08-04: an earlier version of this record said neither uscode.house.gov nor law.cornell.edu carried the amended text and cited the enrolled bill alone for that reason. That was true when the quote sweep ran and is no longer true -- uscode has since published the OBBBA text. A rationale that explains why a citation looks unusual has to be re-checked when the reason expires, or it becomes the next stale claim. Corrected again on the same day: this paragraph opened "Two authorities" after two more were added, so it failed its own instruction inside one commit. The count is now stated nowhere in this paragraph, because a number in prose beside a list is a second place to keep in step, and this one had already gone stale once. Extended on 2026-08-04: the statement keys the figures to filing status, and effectiveFrom keys the whole record to 2026, and neither was visible in what was quoted. Both were one clause away in spans already cited -- the chapeau continues into subparagraphs (A) and (B), which tie the amounts to paragraph (1)(A) and (1)(B), and section 70107 continues into subsection (d), which supplies the applicability date. The date deliberately stays in effectiveFrom rather than being added to the statement: a structured field already carries it, and restating it in prose would create exactly the second place to keep in step that this paragraph gave up its own count to avoid. The chapeau was widened in place. The enrolled bill could not be, because subsections (c) and (d) are not contiguous in the enrolled text: govinfo prints a codification annotation between them, and that annotation is the publisher speaking rather than Congress, so it cannot sit inside a quotedText. That left an elision or a split, and a split is better here -- each subsection is then quoted whole and verbatim, which is what a reader checking the citation expects to find, and neither quote depends on the checker honouring an ellipsis to read as accurate.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 55(d)(2), phase-out chapeau and subparagraphs (A)-(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section55&num=0&edition=prelim',
      quotedText:
        'The exemption amount of any taxpayer shall be reduced (but not below zero) by an amount equal to 25 percent of the amount by which the alternative minimum taxable income of the taxpayer exceeds- (A) $150,000 in the case of a taxpayer described in paragraph (1)(A), (B) $112,500 in the case of a taxpayer described in paragraph (1)(B), and',
    }, {
      kind: 'statute',
      citation: 'IRC 55(d)(4)(B)(i), inflation adjustment',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section55&num=0&edition=prelim',
      quotedText:
        '(B) Inflation adjustment (i) In general In the case of any taxable year beginning in a calendar year after 2018 (2026, in the case of the $1,000,000 amount in subparagraph (A)(ii)(I)), the amounts described in clause (ii) shall each be increased by an amount equal to- (I) such dollar amount, multiplied by (II) the cost-of-living adjustment determined under section 1(f)(3) for the calendar year in which the taxable year begins,',
    }, {
      kind: 'statute',
      citation: 'IRC 55(d)(4)(A)(ii), as amended by Pub. L. 119-21',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section55&num=0&edition=prelim',
      quotedText:
        '(ii) paragraph (2) shall be applied- (I) by substituting "$1,000,000" for "$150,000" in subparagraph (A), (II) by substituting "50 percent of the dollar amount applicable under subparagraph (A)" for "$112,500" in subparagraph (B), (III) in the case of a taxpayer described in paragraph (1)(D), without regard to the substitution under subclause (I), and (IV) by substituting "50 percent" for "25 percent", and',
    }, {
      kind: 'statute',
      citation: 'Pub. L. 119-21, sec. 70107(c) (OBBBA)',
      url: 'https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm',
      quotedText:
        '(c) Modification of Phaseout Amount.--Section 55(d)(4)(A)(ii) is amended by striking ``and\'\' at the end of subclause (II), and by adding at the end the following new subclause: ``(IV) by substituting `50 percent\' for `25 percent\', and\'\'.',
    }, {
      kind: 'statute',
      citation: 'Pub. L. 119-21, sec. 70107(d) (OBBBA), effective date',
      url: 'https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm',
      quotedText:
        'Effective Date.--The amendments made by this section shall apply to taxable years beginning after December 31, 2025.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/tax/federalTax.ts#amtExemptionAmount',
    ],
  },

  'irc-57-a-5-private-activity-bond-interest-amt-preference': {
    title: 'Private-activity-bond interest as an AMT preference item',
    statement:
      'Interest on specified private activity bonds, reduced by deductions that would have been allowable were the interest includible in gross income, is an item of tax preference added to alternative minimum taxable income. Not modelled: the engine treats every tax-exempt interest amount as non-preference interest and adds none of it to AMTI, so a household holding specified private activity bonds has its AMTI and any resulting alternative minimum tax understated by the preference amount.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'The plan model carries tax-exempt interest as a single annual amount with no issue-level detail, so identifying a specified private activity bond under 57(a)(5)(C) — an issue-date test with carve-outs for qualified 501(c)(3) bonds, certain housing bonds, refundings, and 2009–2010 issues — cannot be expressed in the input model. Treating the whole amount as non-preference matches the common diversified-fund case, and the omission is disclosed here rather than guessed per issue.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 57(a)(5)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section57&num=0&edition=prelim',
      quotedText:
        'Interest on specified private activity bonds reduced by any deduction (not allowable in computing the regular tax) which would have been allowable if such interest were includible in gross income.',
    }, {
      kind: 'statute',
      citation: 'IRC 57(a)(5)(C)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section57&num=0&edition=prelim',
      quotedText:
        'the term "specified private activity bond" means any private activity bond (as defined in section 141) which is issued after August 7, 1986, and the interest on which is not includible in gross income under section 103.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-07',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
    implementedByFunctions: [
      'packages/engine/src/tax/federalTax.ts#amtPreferenceItems',
    ],
  },

  'irc-63-f-additional-standard-deduction-aged': {
    title: 'The age-65 standard deduction addition is per qualifying person',
    statement:
      'A taxpayer is entitled to an additional amount for himself if he has attained age 65 before the close of the taxable year, and to a further additional amount for a spouse who has done the same. On a joint return with two qualifying people the addition is taken twice, not once for the household.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The statute states 600 dollars, and 750 dollars for an unmarried individual who is not a surviving spouse; both are inflation-adjusted, and the 2026 pack carries 1,650 and 2,050. The test is attainment before the close of the taxable year, which the engine models as age attained in the calendar year -- equivalent except for a taxpayer born on January 1, whom the IRS treats as attaining age on the preceding December 31.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 63(f)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section63&num=0&edition=prelim',
      quotedText:
        'The taxpayer shall be entitled to an additional amount of $600- (A) for himself if he has attained age 65 before the close of his taxable year, and (B) for the spouse of the taxpayer if the spouse has attained age 65 before the close of the taxable year and an additional exemption is allowable to the taxpayer for such spouse under section 151(b).',
    }, {
      kind: 'statute',
      citation: 'IRC 63(f)(3)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section63&num=0&edition=prelim',
      quotedText:
        'In the case of an individual who is not married and is not a surviving spouse, paragraphs (1) and (2) shall be applied by substituting "$750" for "$600".',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-29',
    implementedBy: [
      'packages/engine/src/params/index.ts',
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/params/index.ts#age65StandardDeductionAddition',
      'packages/engine/src/params/index.ts#standardDeduction',
      'packages/engine/src/tax/federalTax.ts#computeFederalTax',
    ],
  },

  'irc-164-b-7-salt-cap-schedule': {
    title: 'The SALT cap is a schedule and reverts to 10,000 in 2030',
    statement:
      'The applicable limitation amount is 40,000 dollars for 2025 and 40,400 for 2026, then 101 percent of the preceding year through 2029, and 10,000 dollars for taxable years beginning in 2030 and after. It is a schedule written into the statute, not an inflation-indexed figure, and the 2030 step is a reversion rather than a continuation.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The cap is halved for a married individual filing separately, which the projection cannot express because it collapses every filing status to single or married-filing-jointly. The high-income phase-out that OBBBA also added is not modelled either — that gap is registered separately as irc-164-b-7-B-magi-phasedown — so the cap here binds later than it would for a taxpayer above that threshold.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 164(b)(6)(B)',
      url: 'https://www.law.cornell.edu/uscode/text/26/164',
      quotedText:
        'the aggregate amount of taxes taken into account under paragraphs (1), (2), and (3) of subsection (a) and paragraph (5) of this subsection for any taxable year shall not exceed the applicable limitation amount (half the applicable limitation amount in the case of a married individual filing a separate return).',
    }, {
      kind: 'statute',
      citation: 'IRC 164(b)(7)(A)',
      url: 'https://www.law.cornell.edu/uscode/text/26/164',
      quotedText:
        'For purposes of paragraph (6), the term \u201capplicable limitation amount\u201d means\u2014 (i) in the case of any taxable year beginning in calendar year 2025, $40,000, (ii) in the case of any taxable year beginning in calendar year 2026, $40,400, (iii) in the case of any taxable year beginning after calendar year 2026 and before 2030, 101 percent of the dollar amount in effect under this subparagraph for taxable years beginning in the preceding calendar year, and (iv) in the case of any taxable year beginning after calendar year 2029, $10,000.',
    }],
    volatility: 'sunsetting',
    effectiveFrom: 2025,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/tax/federalTax.ts#saltCapForYear',
    ],
  },

  'irc-164-b-7-B-magi-phasedown': {
    title: 'High MAGI phases the SALT limitation down to no less than $10,000',
    statement:
      'For taxable years beginning before January 1, 2030, the applicable limitation amount is reduced by 30 percent of MAGI above the threshold amount, but not below $10,000. For the 2026 modeled year the scheduled limitation is $40,400 and the threshold amount is $505,000; that $505,000 figure is not doubled on a joint return — single and MFJ share it — and a married individual filing separately uses half the threshold amount. The engine instead uses the scheduled $40,400 cap without this MAGI phasedown, so a high-MAGI taxpayer can deduct too much SALT and the engine understates tax.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'DEFECT — no behavior change in this registry slice. A research bot\'s 2026-08-26 change alert surfaced the OBBBA MAGI phasedown, and review verified that `saltCapForYear(pack, year)` takes only a pack and year while `itemizedTotal` applies that result without the phasedown. The calculator does compute MAGI for other rules, but neither function carries it into the SALT limitation. The fixture pins the current full-cap result until a separately authorized implementation fix changes it.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 164(b)(6)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section164&num=0&edition=prelim',
      quotedText:
        'the aggregate amount of taxes taken into account under paragraphs (1), (2), and (3) of subsection (a) and paragraph (5) of this subsection for any taxable year shall not exceed the applicable limitation amount (half the applicable limitation amount in the case of a married individual filing a separate return).',
    }, {
      kind: 'statute',
      citation: 'IRC 164(b)(7)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section164&num=0&edition=prelim',
      quotedText:
        'For purposes of paragraph (6), the term "applicable limitation amount" means- … (ii) in the case of any taxable year beginning in calendar year 2026, $40,400,',
    }, {
      kind: 'statute',
      citation: 'IRC 164(b)(7)(B)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section164&num=0&edition=prelim',
      quotedText:
        'Except as provided in clause (iii), in the case of any taxable year beginning before January 1, 2030, the applicable limitation amount shall be reduced by 30 percent of the excess (if any) of the taxpayer\'s modified adjusted gross income over the threshold amount (half the threshold amount in the case of a married individual filing a separate return).',
    }, {
      kind: 'statute',
      citation: 'IRC 164(b)(7)(B)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section164&num=0&edition=prelim',
      quotedText:
        'For purposes of this subparagraph, the term "threshold amount" means-',
    }, {
      kind: 'statute',
      citation: 'IRC 164(b)(7)(B)(ii)(II)-(III)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section164&num=0&edition=prelim',
      quotedText:
        '(II) in the case of any taxable year beginning in calendar year 2026, $505,000, and (III) in the case of any taxable year beginning after calendar year 2026, 101 percent of the dollar amount in effect under this subparagraph for taxable years beginning in the preceding calendar year.',
    }, {
      kind: 'statute',
      citation: 'IRC 164(b)(7)(B)(iii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section164&num=0&edition=prelim',
      quotedText:
        'The reduction under clause (i) shall not result in the applicable limitation amount being less than $10,000.',
    }, {
      kind: 'statute',
      citation: 'IRC 164(b)(7)(B)(iv)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section164&num=0&edition=prelim',
      quotedText:
        'For purposes of this paragraph, the term "modified adjusted gross income" means adjusted gross income increased by any amount excluded from gross income under section 911, 931, or 933.',
    }],
    volatility: 'sunsetting',
    effectiveFrom: 2026,
    effectiveThrough: 2029,
    verifiedOn: '2026-08-26',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
    implementedByFunctions: [
      'packages/engine/src/tax/federalTax.ts#itemizedTotal',
      'packages/engine/src/tax/federalTax.ts#saltCapForYear',
    ],
  },

  'irc-63-c-2-joint-standard-deduction-doubles': {
    title: 'The joint standard deduction is 200 percent of the unmarried one',
    statement:
      'The basic standard deduction for a joint return or a surviving spouse is 200 percent of the amount for any other case. The two figures are not independently set: the joint amount is defined in terms of the unmarried one, so they move together and the ratio between them is fixed at two.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Section 63(c)(2)(B) gives a head of household its own figure -- 23,625 dollars as substituted by (c)(7) -- which is neither the unmarried amount nor twice it. The projection collapses every filing status to single or married-filing-jointly, so that third figure is unreachable and the doubling holds across everything the engine can express.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 63(c)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section63&num=0&edition=prelim',
      quotedText:
        'For purposes of paragraph (1), the basic standard deduction is- (A) 200 percent of the dollar amount in effect under subparagraph (C) for the taxable year in the case of- (i) a joint return, or (ii) a surviving spouse (as defined in section 2(a)), (B) $4,400 in the case of a head of household (as defined in section 2(b)), or (C) $3,000 in any other case.',
    }, {
      kind: 'statute',
      citation: 'IRC 63(c)(7)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section63&num=0&edition=prelim',
      quotedText:
        'In the case of a taxable year beginning after December 31, 2017- … Paragraph (2) shall be applied- (i) by substituting "$23,625" for "$4,400" in subparagraph (B), and (ii) by substituting "$15,750" for "$3,000" in subparagraph (C).',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-29',
    implementedBy: [
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/tax/federalTax.ts#computeFederalTax',
    ],
  },
  'irc-151-d-5-C-iii-I-senior-deduction-per-individual-phase-out': {
    title: 'The senior deduction phase-out reduces the per-individual amount',
    statement:
      'Clause (i) allows 6,000 dollars for each qualified individual, and clause (iii)(I) reduces the 6,000 dollar amount in clause (i) by 6 percent of modified adjusted gross income over 75,000 dollars, or 150,000 dollars on a joint return. The reduction lands on the per-individual amount, so it is taken once for each qualified individual rather than once against the combined total. A joint return with two spouses aged 65 or over therefore exhausts the deduction at 250,000 dollars of modified adjusted gross income, the same point a one-person joint return exhausts it, and not at 350,000 dollars.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 151(d)(5)(C)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section151&num=0&edition=prelim',
      quotedText:
        'In the case of a taxable year beginning before January 1, 2029, there shall be allowed a deduction in an amount equal to $6,000 for each qualified individual with respect to the taxpayer.',
    }, {
      kind: 'statute',
      citation: 'IRC 151(d)(5)(C)(iii)(I)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section151&num=0&edition=prelim',
      quotedText:
        'In the case of any taxpayer for any taxable year, the $6,000 amount in clause (i) shall be reduced (but not below zero) by 6 percent of so much of the taxpayer\'s modified adjusted gross income as exceeds $75,000 ($150,000 in the case of a joint return).',
    }, {
      kind: 'formInstruction',
      citation: 'Schedule 1-A (Form 1040) (2025), Part V, lines 32 to 37',
      url: 'https://www.irs.gov/pub/irs-pdf/f1040s1a.pdf',
      quotedText:
        'Enter $75,000 ($150,000 if married filing jointly) … Multiply line 33 by 6% (0.06) … Subtract line 34 from $6,000. If zero or less, enter -0- … If you have a valid social security number (see instructions) and were born before January 2, 1961, enter the amount from line 35 … If you are married filing jointly, your spouse has a valid social security number (see instructions), and your spouse was born before January 2, 1961, enter the amount from line 35 … Enhanced deduction for seniors. Add lines 36a and 36b',
    }],
    volatility: 'sunsetting',
    effectiveFrom: 2026,
    effectiveThrough: 2028,
    verifiedOn: '2026-08-29',
    implementedBy: [
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/strategies/optimizer.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/strategies/optimizer.ts#buildOptimizerModel',
      'packages/engine/src/tax/federalTax.ts#seniorDeductionAmount',
    ],
  },
  'irc-56-b-1-D-section-151-deduction-disallowed-for-amt': {
    title: 'The senior deduction is a section 151 deduction disallowed for AMT',
    statement:
      'Section 56(b)(1)(D) disallows the standard deduction under section 63(c), the deduction for personal exemptions under section 151, and the deduction under section 642(b) in computing alternative minimum taxable income. The senior deduction is allowed by section 151(d)(5)(C), so it is added back whether or not the return elects to itemize. Only the section 63(c) standard deduction turns on that election.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Section 63(b) was never amended to give the senior deduction a paragraph of its own, so a taxpayer who does not itemize can reach it only through 63(b)(2), the deduction for personal exemptions provided in section 151. A reading under which that phrase does not carry the senior deduction would deny the deduction to every non-itemizer, so the parallel phrase in 56(b)(1)(D) has to carry it as well. Form 6251 line 1a confirms both the result and its unconditional scope: it removes Schedule 1-A line 37, the senior deduction alone and not the rest of that schedule, from total deductions with no itemized-or-standard branch.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 56(b)(1)(D)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section56&num=0&edition=prelim',
      quotedText:
        'Standard deduction and deduction for personal exemptions not allowed. The standard deduction under section 63(c), the deduction for personal exemptions under section 151, and the deduction under section 642(b) shall not be allowed.',
    }, {
      kind: 'statute',
      citation: 'IRC 63(b)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section63&num=0&edition=prelim',
      quotedText:
        'In the case of an individual who does not elect to itemize his deductions for the taxable year, for purposes of this subtitle, the term "taxable income" means adjusted gross income, minus- (1) the standard deduction, (2) the deduction for personal exemptions provided in section 151, (3) any deduction provided in section 199A, … (7) so much of the deduction allowed by section 163(a) as is attributable to the exception under section 163(h)(4)(A).',
    }, {
      kind: 'formInstruction',
      citation: 'Form 6251 (2025), lines 1a and 1b',
      url: 'https://www.irs.gov/pub/irs-pdf/f6251.pdf',
      quotedText:
        'Subtract Schedule 1-A (Form 1040), line 37, from Form 1040, 1040-SR, or 1040-NR, line 14 … Subtract line 1a from Form 1040, 1040-SR, or 1040-NR, line 11b (if less than zero, enter as a negative amount)',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-29',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
    implementedByFunctions: [
      'packages/engine/src/tax/federalTax.ts#computeFederalTax',
    ],
  },

  'irc-1-j-2-progressive-ordinary-rate-schedule': {
    title: 'Ordinary rate schedule is marginal, and permanent after OBBBA',
    statement:
      'Tax on ordinary taxable income is the sum of each bracket rate applied only to the portion of taxable income falling inside that bracket, using the 1(j)(2) tables as annually adjusted. The schedule no longer expires: OBBBA struck the January 1, 2026 sunset from 1(j)(1), so the 10/12/22/24/32/35/37 structure is current law indefinitely.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Two things about the 2026 tables are easy to get wrong from memory. First, the 37 percent bracket begins at the same figure for unmarried individuals and for heads of household ($640,600), while the married-filing-separately table diverges from the unmarried table only at the top, at $384,350. Second, OBBBA gave the boundaries of the 10 and 12 percent brackets one extra year of indexing by confining the 2017-base substitution in 1(j)(3)(B)(i) to brackets above 12 percent, so those two thresholds move on a different base than the rest of the table. The engine models only unmarried and married-filing-jointly, mapping every other status onto one of the two.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 1(j)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1&num=0&edition=prelim',
      quotedText:
        'In the case of a taxable year beginning after December 31, 2017- (A) subsection (i) shall not apply, and (B) this section (other than subsection (i)) shall be applied as provided in paragraphs (2) through (6).',
    }, {
      kind: 'statute',
      citation: 'IRC 1(j)(2)(C)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1&num=0&edition=prelim',
      quotedText:
        'The following table shall be applied in lieu of the table contained in subsection (c): ... Not over $9,525 ... 10% of taxable income. Over $9,525 but not over $38,700 ... $952.50, plus 12% of the excess over $9,525. ...',
    }, {
      kind: 'legislativeHistory',
      citation: 'Amendment note to IRC 1, P.L. 119-21 sec. 70101(a)(1), (b)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1&num=0&edition=prelim',
      quotedText:
        'Subsec. (j)(1). ... struck out ", and before January 1, 2026" after "December 31, 2017" in introductory provisions. Subsec. (j)(3)(B)(i). ... inserted "solely for purposes of determining the dollar amounts at which any rate bracket higher than 12 percent ends and at which any rate bracket higher than 22 percent begins," before "subsection (f)(3)".',
    }, {
      kind: 'irsNotice',
      citation: 'Rev. Proc. 2025-32, section 4.01, Table 3',
      url: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
      quotedText:
        'For taxable years beginning in 2026, the tax rate tables under § 1 are as follows: ... Not over $12,400 ... 10% of the taxable income ... Over $12,400 but not over $50,400 ... $1,240 plus 12% of the excess over $12,400 ... Over $50,400 but not over $105,700 ... $5,800 plus 22% of the excess over $50,400 ... Over $640,600 ... $192,979.25 plus 37% of the excess over $640,600',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/tax/federalTax.ts#bracketTax',
    ],
  },
  'irc-1-j-3-B-rate-tables-adjusted-each-year': {
    title: 'The rate tables are re-prescribed every year, so a nominal projection must index them',
    statement:
      'For taxable years beginning after December 31, 2018 the Secretary prescribes rate tables that apply in lieu of the ones printed in section 1(j)(2), adjusted in the same manner as under section 1(f). The printed thresholds are therefore the figures for one year only. A projection that carries nominal income forward must carry the thresholds forward with it; holding a published year fixed measures inflated income against unadjusted brackets and creates bracket creep the statute does not.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The same reasoning reaches the other annually adjusted figures the federal engine reads, each under its own provision: the basic standard deduction under 63(c)(7)(B)(ii), the age-65 addition under 63(c)(4) (which indexes the dollar amounts in subsection (f)), the maximum zero-rate and maximum 15-percent capital gain amounts under 1(j)(5)(C), and the AMT exemption, its phase-out threshold and the 28 percent rate threshold under 55(d)(4)(B) and 55(d)(3)(B). Their base years differ -- 2016, 2017, 2024, 2025, 2011 -- and so do their rounding steps, but none of that survives into the projection: the pack figure has already absorbed every adjustment through the pack year, so carrying it forward is one multiplication for all of them. Two approximations remain and are deliberate. The index is the plan assumed general inflation rather than the C-CPI-U of 1(f)(3), and the statutory rounding to a multiple of 50 or 100 dollars is not reproduced -- the same two liberties limitScale already takes with the contribution limits. What must not be swept along are the figures with no indexing provision at all: the section 86 provisional-income thresholds, the section 1411 thresholds, the section 121 exclusion, the section 1211(b) ordinary offset and the section 151(d)(5)(C) senior deduction are unindexed by design, and the SALT cap follows the explicit 164(b)(7) schedule rather than an index. Scaling any of those would be the mirror-image defect.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 1(j)(3)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1&num=0&edition=prelim',
      quotedText:
        'For taxable years beginning after December 31, 2018, the Secretary shall prescribe tables which shall apply in lieu of the tables contained in paragraph (2) in the same manner as under paragraphs (1) and (2) of subsection (f) (applied without regard to clauses (i) and (ii) of subsection (f)(2)(A)), except that in prescribing such tables- (i) solely for purposes of determining the dollar amounts at which any rate bracket higher than 12 percent ends and at which any rate bracket higher than 22 percent begins, subsection (f)(3) shall be applied by substituting "calendar year 2017" for "calendar year 2016" in subparagraph (A)(ii) thereof, (ii) subsection (f)(7)(B) shall apply to any unmarried individual other than a surviving spouse or head of household, and (iii) subsection (f)(8) shall not apply.',
    }, {
      kind: 'statute',
      citation: 'IRC 1(j)(5)(C)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1&num=0&edition=prelim',
      quotedText:
        'In the case of any taxable year beginning after 2018, each of the dollar amounts in clauses (i) and (ii) of subparagraph (B) shall be increased by an amount equal to- (i) such dollar amount, multiplied by (ii) the cost-of-living adjustment determined under subsection (f)(3) for the calendar year in which the taxable year begins, determined by substituting "calendar year 2017" for "calendar year 2016" in subparagraph (A)(ii) thereof. If any increase under this subparagraph is not a multiple of $50, such increase shall be rounded to the next lowest multiple of $50.',
    }, {
      kind: 'statute',
      citation: 'IRC 63(c)(7)(B)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section63&num=0&edition=prelim',
      quotedText:
        'In the case of a taxable year beginning after 2025, the $23,625 and $15,750 amounts in subparagraph (A) shall each be increased by an amount equal to- (I) such dollar amount, multiplied by (II) the cost-of-living adjustment determined under section 1(f)(3) for the calendar year in which the taxable year begins, determined by substituting "2024" for "2016" in subparagraph (A)(ii) thereof.',
    }, {
      kind: 'statute',
      citation: 'IRC 55(d)(4)(B)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section55&num=0&edition=prelim',
      quotedText:
        'In the case of any taxable year beginning in a calendar year after 2018 (2026, in the case of the $1,000,000 amount in subparagraph (A)(ii)(I)), the amounts described in clause (ii) shall each be increased by an amount equal to- (I) such dollar amount, multiplied by (II) the cost-of-living adjustment determined under section 1(f)(3) for the calendar year in which the taxable year begins, determined by substituting for "calendar year 2016" in subparagraph (A)(ii) thereof- (1) "calendar year 2017", in the case of the $109,400 amount in subparagraph (A)(i)(I) and the $70,300 amount in subparagraph (A)(i)(II), and (2) "calendar year 2025", in the case of the $1,000,000 amount in subparagraph (A)(ii)(I).',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-29',
    implementedBy: [
      'packages/engine/src/params/index.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/index.ts#indexFederalTaxPack',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },
  'irc-151-d-5-C-senior-deduction-not-indexed': {
    title: 'The senior deduction is a flat 6,000 dollars that never grows',
    statement:
      'For a taxable year beginning before January 1, 2029 a deduction of 6,000 dollars is allowed for each qualified individual, reduced by 6 percent of modified adjusted gross income over 75,000 dollars (150,000 dollars on a joint return). No provision adjusts either figure for inflation: section 151(d)(4) indexes only the dollar amount in paragraph (1) and is expressly subordinated to paragraph (5), whose subparagraph (C) is where this deduction lives. The amount and the phase-out threshold both stay fixed for every year the deduction applies.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This record exists because of the change that produced it. The engine now carries the annually indexed federal figures forward past the published pack, and the senior deduction is the figure most likely to be swept into that projection by a later reader: it sits in the same pack object as the standard deduction, is claimed by the same taxpayers in the same years, and is the one deduction in the group that has no cost-of-living clause. Indexing the 6,000 dollars, or the 75,000 dollar threshold, would overstate the deduction in exactly the years a 65-plus household is deciding how much to convert. The fixed threshold also means the phase-out bites harder each year in a nominal projection, which is a real effect of the drafting and must be preserved rather than smoothed away. The expiry is modeled from the same subparagraph: taxable years beginning before January 1, 2029 makes 2028 the last applicable year.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 151(d)(5)(C)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section151&num=0&edition=prelim',
      quotedText:
        'In the case of a taxable year beginning before January 1, 2029, there shall be allowed a deduction in an amount equal to $6,000 for each qualified individual with respect to the taxpayer.',
    }, {
      kind: 'statute',
      citation: 'IRC 151(d)(5)(C)(iii)(I)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section151&num=0&edition=prelim',
      quotedText:
        'In the case of any taxpayer for any taxable year, the $6,000 amount in clause (i) shall be reduced (but not below zero) by 6 percent of so much of the taxpayer\'s modified adjusted gross income as exceeds $75,000 ($150,000 in the case of a joint return).',
    }, {
      kind: 'statute',
      citation: 'IRC 151(d)(4)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section151&num=0&edition=prelim',
      quotedText:
        'Except as provided in paragraph (5), in the case of any taxable year beginning in a calendar year after 1989, the dollar amount contained in paragraph (1) shall be increased by an amount equal to- (A) such dollar amount, multiplied by (B) the cost-of-living adjustment determined under section 1(f)(3) for the calendar year in which the taxable year begins, by substituting "calendar year 1988" for "calendar year 2016" in subparagraph (A)(ii) thereof.',
    }],
    volatility: 'sunsetting',
    effectiveFrom: 2025,
    effectiveThrough: 2028,
    verifiedOn: '2026-08-29',
    implementedBy: [
      'packages/engine/src/params/index.ts',
      'packages/engine/src/tax/federalTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/index.ts#indexFederalTaxPack',
      'packages/engine/src/tax/federalTax.ts#seniorDeductionAmount',
    ],
  },
  'irc-63-b-e-itemize-election-and-section-151-additivity': {
    title: 'Itemizing is an election; the section 151 deduction is additive',
    statement:
      'No itemized deduction is allowed unless the individual elects to itemize, and the election replaces the standard deduction rather than supplementing it. The section 151 senior deduction sits outside that trade: 63(d)(2) excludes from the definition of itemized deductions anything listed in a paragraph of 63(b), and 63(b)(2) lists the section 151 deduction, so it is subtracted on top of whichever base the taxpayer uses.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Nothing in section 63 requires the election to be the one that minimises tax; the engine assumes the taxpayer elects to itemize exactly when the itemized total exceeds the standard deduction, and compares against the standard deduction alone because the senior deduction is common to both branches. That assumption can be wrong in two directions the engine does not explore. Itemizing state and local taxes creates an AMT add-back that the standard deduction branch also creates but at a different amount, so the larger deduction is not always the lower total tax. And because the senior deduction is not an itemized deduction, it also escapes the section 68 overall limitation, which only bites on the itemized side.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 63(e)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section63&num=0&edition=prelim',
      quotedText:
        'Unless an individual makes an election under this subsection for the taxable year, no itemized deduction shall be allowed for the taxable year. For purposes of this subtitle, the determination of whether a deduction is allowable under this chapter shall be made without regard to the preceding sentence.',
    }, {
      kind: 'statute',
      citation: 'IRC 63(b)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section63&num=0&edition=prelim',
      quotedText:
        'In the case of an individual who does not elect to itemize his deductions for the taxable year, for purposes of this subtitle, the term "taxable income" means adjusted gross income, minus- (1) the standard deduction, (2) the deduction for personal exemptions provided in section 151, (3) any deduction provided in section 199A, (4) the deduction provided in section 170(p), ...',
    }, {
      kind: 'statute',
      citation: 'IRC 63(d)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section63&num=0&edition=prelim',
      quotedText:
        'For purposes of this subtitle, the term "itemized deductions" means the deductions allowable under this chapter other than- (1) the deductions allowable in arriving at adjusted gross income, and (2) any deduction referred to in any paragraph of subsection (b).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
    implementedByFunctions: [
      'packages/engine/src/tax/federalTax.ts#computeFederalTax',
    ],
  },
  'irc-67-h-miscellaneous-itemized-permanently-disallowed': {
    title: 'Miscellaneous itemized deductions are permanently disallowed',
    statement:
      'No miscellaneous itemized deduction is allowed for any taxable year beginning after December 31, 2017, with no expiry date. Miscellaneous itemized deductions are defined by exclusion in 67(b), so investment advisory fees, tax preparation fees, and safe deposit box rent are all disallowed while interest, taxes, casualty losses, charitable contributions, and medical expenses are not.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The provision moved. OBBBA added a new 67(g) defining educator expenses and redesignated the former 67(g) suspension as 67(h), while striking the January 1, 2026 expiry, so a citation to 67(g) now points at the wrong subsection. The engine builds its itemized total from state and local taxes, mortgage interest, and charitable gifts only, and offers no input channel for advisory or preparation fees. That absence is the correct answer rather than a gap, which is why this rule is registered as settled rather than out of scope.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 67(h)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section67&num=0&edition=prelim',
      quotedText:
        'Notwithstanding subsection (a), no miscellaneous itemized deduction shall be allowed for any taxable year beginning after December 31, 2017.',
    }, {
      kind: 'statute',
      citation: 'IRC 67(b)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section67&num=0&edition=prelim',
      quotedText:
        'For purposes of this section, the term "miscellaneous itemized deductions" means the itemized deductions other than- (1) the deduction under section 163 (relating to interest), (2) the deduction under section 164 (relating to taxes), (3) the deduction under section 165(a) for casualty or theft losses described in paragraph (2) or (3) of section 165(c) or for losses described in section 165(d), (4) the deductions under section 170 ... (5) the deduction under section 213 (relating to medical, dental, etc., expenses), ...',
    }, {
      kind: 'legislativeHistory',
      citation: 'Amendment note to IRC 67, P.L. 119-21 sec. 70110(a), (b)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section67&num=0&edition=prelim',
      quotedText:
        'Subsec. (g). ... added subsec. (g). Former subsec. (g) redesignated (h). ... substituted "beginning after 2017" for "2018 through 2025" in heading and struck out ", and before January 1, 2026" after "December 31, 2017" in text.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
    implementedByFunctions: [
      'packages/engine/src/tax/federalTax.ts#itemizedTotal',
    ],
  },
  'irc-56-b-1-A-ii-state-and-local-taxes-disallowed-for-amt': {
    title: 'Deducted state and local taxes are an AMT add-back',
    statement:
      'For AMT purposes no deduction is allowed for any tax described in paragraph (1), (2), or (3) of 164(a), which covers state and local income, real property, and personal property taxes, nor for any miscellaneous itemized deduction. Mortgage interest and charitable contributions are not add-backs, so an itemizing taxpayer adds back the state and local component only.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The add-back is the amount actually deducted, so the 164(b)(6) cap applies first and the AMT add-back is the capped figure rather than the taxes paid. Two refinements are unmodelled. 56(b)(1)(B) substitutes qualified housing interest for qualified residence interest, which can make part of a deducted mortgage interest amount an AMT add-back where the loan was not used to acquire, construct, or substantially improve the residence. And the final sentence of 56(b)(1)(A) preserves taxes allowable in computing adjusted gross income, which never arises in this engine because it deducts no above-the-line taxes.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 56(b)(1)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section56&num=0&edition=prelim',
      quotedText:
        'No deduction shall be allowed- (i) for any miscellaneous itemized deduction (as defined in section 67(b)), or (ii) for any taxes described in paragraph (1), (2), or (3) of section 164(a) or clause (ii) of section 164(b)(5)(A). Clause (ii) shall not apply to any amount allowable in computing adjusted gross income.',
    }, {
      kind: 'statute',
      citation: 'IRC 56(b)(1)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section56&num=0&edition=prelim',
      quotedText:
        'In determining the amount allowable as a deduction for interest, subsections (d) and (h) of section 163 shall apply, except that- (i) in lieu of the exception under section 163(h)(2)(D), the term "personal interest" shall not include any qualified housing interest (as defined in subsection (e)), ...',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
    implementedByFunctions: [
      'packages/engine/src/tax/federalTax.ts#computeFederalTax',
    ],
  },
  'irc-55-b-3-amt-net-capital-gain-maximum-rate': {
    title: 'Preferential capital gain rates survive into the AMT',
    statement:
      'Tentative minimum tax computed under 55(b)(1)(A) may not exceed the amount produced by removing net capital gain from the taxable excess, taxing what remains at 26 and 28 percent, and taxing the adjusted net capital gain at 0, 15, and 20 percent using the same section 1(h) breakpoints as the regular tax. Long-term gain and qualified dividends are therefore never taxed at 26 or 28 percent, though they still enlarge alternative minimum taxable income and so can crowd out the exemption.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The engine stacks the AMT preferential income on top of the AMT ordinary excess and applies the regular-tax breakpoints to that stack, which is the Form 6251 Part III construction. Two layers of 55(b)(3) are not modelled anywhere in this engine: the 25 percent layer for unrecaptured section 1250 gain in subparagraph (E) and, in the regular tax, the 28 percent collectibles rate. Both would raise tax, so their absence understates it for a taxpayer holding depreciated real property or collectibles.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 55(b)(3)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section55&num=0&edition=prelim',
      quotedText:
        'The amount determined under the first sentence of paragraph (1)(A) shall not exceed the sum of- (A) the amount determined under such first sentence computed at the rates and in the same manner as if this paragraph had not been enacted on the taxable excess reduced by the lesser of- (i) the net capital gain; or (ii) the sum of- (I) the adjusted net capital gain, plus (II) the unrecaptured section 1250 gain, plus (B) 0 percent of so much of the adjusted net capital gain (or, if less, taxable excess) as does not exceed an amount equal to the excess described in section 1(h)(1)(B), plus (C) 15 percent of the lesser of- (i) so much of the adjusted net capital gain (or, if less, taxable excess) as exceeds the amount on which tax is determined under subparagraph (B), or (ii) the excess described in section 1(h)(1)(C)(ii), plus (D) 20 percent of the adjusted net capital gain (or, if less, taxable excess) in excess of the sum of the amounts on which tax is determined under subparagraphs (B) and (C), plus (E) 25 percent of the amount of taxable excess in excess of the sum of the amounts on which tax is determined under the preceding subparagraphs of this paragraph.',
    }, {
      kind: 'statute',
      citation: 'IRC 55(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section55&num=0&edition=prelim',
      quotedText:
        'There is hereby imposed (in addition to any other tax imposed by this subtitle) a tax equal to the excess (if any) of- (1) the tentative minimum tax for the taxable year, over (2) the regular tax for the taxable year plus, in the case of an applicable corporation, the tax imposed by section 59A.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
    implementedByFunctions: [
      'packages/engine/src/tax/federalTax.ts#tentativeMinimumTax',
    ],
  },
  'irc-163-h-3-F-acquisition-indebtedness-limit': {
    title: 'Mortgage interest is limited to $750,000 of acquisition debt',
    statement:
      'Only interest on acquisition indebtedness is qualified residence interest, home equity indebtedness interest is disallowed outright, and the aggregate acquisition indebtedness taken into account may not exceed $750,000 ($375,000 for a separate return) for debt incurred after December 15, 2017. Not modelled: the engine deducts the supplied mortgage interest figure in full with no principal limit and no home-equity test, so a household with acquisition debt above the cap has its deduction overstated in proportion to the excess and its tax understated, up to 37 cents per dollar of disallowed interest.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'The error scales with the mortgage rather than with income: at $1.5 million of acquisition debt half the interest is disallowed, and a household paying $90,000 of interest would see $45,000 of deduction that does not exist. The grandfather in 163(h)(3)(F)(i)(IV) preserves the older $1,000,000 limit for debt incurred on or before December 15, 2017, so the engine cannot even apply a flat cap without knowing when the loan was taken out, which is why this is left unmodelled rather than approximated.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 163(h)(3)(F)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section163&num=0&edition=prelim',
      quotedText:
        'In the case of taxable years beginning after December 31, 2017- (I) Disallowance of home equity indebtedness interest Subparagraph (A)(ii) shall not apply. (II) Limitation on acquisition indebtedness Subparagraph (B)(ii) shall be applied by substituting "$750,000 ($375,000" for "$1,000,000 ($500,000".',
    }, {
      kind: 'statute',
      citation: 'IRC 163(h)(3)(B)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section163&num=0&edition=prelim',
      quotedText:
        'The aggregate amount treated as acquisition indebtedness for any period shall not exceed $1,000,000 ($500,000 in the case of a married individual filing a separate return).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/tax/federalTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#itemizedDeductionsSchema',
      'packages/engine/src/tax/federalTax.ts#itemizedTotal',
    ],
  },

  'irc-163-h-3-E-i-pmi-qualified-residence-interest-restart': {
    title: 'Qualified mortgage-insurance premiums again count as qualified residence interest',
    statement:
      'For taxable years beginning after 2025, a taxpayer\'s qualified mortgage-insurance premiums connected with acquisition indebtedness on the taxpayer\'s qualified residence are treated as qualified residence interest, subject to the 10-percent-per-$1,000 AGI phaseout above $100,000 and the pre-2007-contract exclusion. OBBBA disables the prior termination. Not modelled: the engine builds its itemized total from state and local taxes, mortgage interest, and charitable gifts alone and has no mortgage-insurance-premium input, so a household with qualifying premiums has its itemized total understated by the includible premium amount and its tax overstated.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale:
      'What this is NOT is a typed refusal — `itemizedTotal` still emits a dollar figure that simply omits PMI, which is why this is approximated rather than outOfScope, the same shape as the medical-expense and §170(p) projection records. The fixture pins the produced total without the hypothesized premium until a separately authorized input and implementation fix closes the gap.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 163(h)(3)(E)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section163&num=0&edition=prelim',
      quotedText:
        'Premiums paid or accrued for qualified mortgage insurance by a taxpayer during the taxable year in connection with acquisition indebtedness with respect to a qualified residence of the taxpayer shall be treated for purposes of this section as interest which is qualified residence interest.',
    }, {
      kind: 'statute',
      citation: 'IRC 163(h)(3)(E)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section163&num=0&edition=prelim',
      quotedText:
        'The amount otherwise treated as interest under clause (i) shall be reduced (but not below zero) by 10 percent of such amount for each $1,000 ($500 in the case of a married individual filing a separate return) (or fraction thereof) that the taxpayer\'s adjusted gross income for the taxable year exceeds $100,000 ($50,000 in the case of a married individual filing a separate return).',
    }, {
      kind: 'statute',
      citation: 'IRC 163(h)(3)(E)(iii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section163&num=0&edition=prelim',
      quotedText:
        'Clause (i) shall not apply with respect to any mortgage insurance contracts issued before January 1, 2007.',
    }, {
      kind: 'statute',
      citation: 'IRC 163(h)(3)(E)(iv)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section163&num=0&edition=prelim',
      quotedText:
        'Clause (i) shall not apply to amounts- (I) paid or accrued after December 31, 2021, or (II) properly allocable to any period after such date.',
    }, {
      kind: 'statute',
      citation: 'IRC 163(h)(3)(F)(i)(III)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section163&num=0&edition=prelim',
      quotedText: 'Clause (iv) of subparagraph (E) shall not apply.',
    }, {
      kind: 'statute',
      citation: 'IRC 163, Editorial Notes, Effective Date of 2025 Amendment (P.L. 119-21 § 70108(b))',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section163&num=0&edition=prelim',
      quotedText:
        'The amendments made by this section [amending this section] shall apply to taxable years beginning after December 31, 2025.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/tax/federalTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#itemizedDeductionsSchema',
      'packages/engine/src/tax/federalTax.ts#itemizedTotal',
    ],
  },
  'irc-63-c-7-B-ii-conformed-state-deduction-tracks-federal': {
    title: 'A state deduction defined by reference to the federal one moves when the federal one moves',
    statement:
      'The basic standard deduction is increased for every taxable year beginning after 2025, so its value is a function of the year rather than a constant. What a state that defines its deduction by reference to the federal one borrows is not that basic amount alone: 63(c)(1) makes the standard deduction the sum of the basic standard deduction and the additional standard deduction, 63(c)(3) sends the second of those to subsection (f), and 63(f)(1) entitles the taxpayer to an additional amount for himself if he has attained age 65 before the close of his taxable year and again for a spouse who has. A state pack tagged as conformed carries no state figure of its own: it carries a copy of the federal basic amount together with the federal per-person age-65 addition, and both are scaled by the same factor the federal pack is indexed by, so the copy takes the federal value in every projected year. Holding it at the pack year while the federal figure is projected forward would put two different values on one amount inside a single year and tax the whole widening difference at the state rate. Which packs may carry that tag is a question of each state’s own law, and this record does not answer it -- nothing quoted below says anything about any state.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This record is anchored federally because the proposition it settles is federal: it does not decide how a state adjusts a figure of its own, it keeps a borrowed federal figure equal to the federal figure, and it says what that federal figure comprises. The roster is deliberately no longer part of it. An earlier version named nine packs (AZ, CO, DC, IA, ID, MO, MT, ND, NM) and asserted that their law defines the state deduction by reference to the federal one, on the strength of two citations that are both federal and neither of which mentions any state -- a settled record whose disputed half rested on nothing. Research outside this record, resting on no authority carried here, reports two of the nine wrongly tagged: Arizona conforming in method rather than in amount, and the District of Columbia decoupled from the OBBBA increase. Neither is asserted here and neither can be, because confirming either needs an Arizona or a District of Columbia primary source and the conformance guard admits no publisher for either state; the pack corrections are separately decided work. The right long-term shape is a per-state record carrying that state’s own authority for its own conformity, one for each pack that claims to borrow the federal figure. That is a larger piece of work than this correction and is scoped as a follow-up, not attempted here. Three boundaries survive from the earlier version and are deliberate. State BRACKETS are not touched -- those are state dollar amounts under state law, some indexed, some fixed by statute, several on legislated rate ramps, and the per-state research to move any of them does not exist yet -- and neither are the state retirement-exclusion caps, which are likewise state figures (the Colorado 24,000 dollar pension subtraction is not indexed by Colorado law). A state that decouples from the federal amount loses the tag, keeps its own figure, and gets no age-65 addition from this path either; Maine and South Carolina did exactly that for 2026 and are untagged. And the scaling factor is the plan assumed general inflation rather than the C-CPI-U of section 1(f)(3), with the statutory rounding of the increase to the next lowest multiple of 50 dollars not reproduced -- the same two approximations indexFederalTaxPack already makes, and they must be the same ones, because a conformed copy indexed on any other basis would diverge from the federal figure it is a copy of.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 63(c)(7)(B)(ii)',
      url: 'https://www.law.cornell.edu/uscode/text/26/63',
      quotedText:
        'In the case of a taxable year beginning after 2025, the $23,625 and $15,750 amounts in subparagraph (A) shall each be increased by an amount equal to— (I) such dollar amount, multiplied by (II) the cost-of-living adjustment determined under section 1(f)(3) for the calendar year in which the taxable year begins, determined by substituting “2024” for “2016” in subparagraph (A)(ii) thereof. If any increase under this clause is not a multiple of $50, such increase shall be rounded to the next lowest multiple of $50.',
    }, {
      kind: 'statute',
      citation: 'IRC 63(c)(7)(A)',
      url: 'https://www.law.cornell.edu/uscode/text/26/63',
      quotedText:
        'Paragraph (2) shall be applied— (i) by substituting “$23,625” for “$4,400” in subparagraph (B), and (ii) by substituting “$15,750” for “$3,000” in subparagraph (C).',
    }, {
      kind: 'statute',
      citation: 'IRC 63(c)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/63',
      quotedText:
        'Except as otherwise provided in this subsection, the term “standard deduction” means the sum of— (A) the basic standard deduction, and (B) the additional standard deduction.',
    }, {
      kind: 'statute',
      citation: 'IRC 63(c)(3)',
      url: 'https://www.law.cornell.edu/uscode/text/26/63',
      quotedText:
        'For purposes of paragraph (1), the additional standard deduction is the sum of each additional amount to which the taxpayer is entitled under subsection (f).',
    }, {
      kind: 'statute',
      citation: 'IRC 63(f)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/63',
      quotedText:
        'The taxpayer shall be entitled to an additional amount of $600— (A) for himself if he has attained age 65 before the close of his taxable year, and (B) for the spouse of the taxpayer if the spouse has attained age 65 before the close of the taxable year and an additional exemption is allowable to the taxpayer for such spouse under section 151(b).',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/params/state/index.ts',
      'packages/engine/src/params/index.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/index.ts#indexFederalTaxPack',
      'packages/engine/src/params/state/data/year2026.ts#CO',
      'packages/engine/src/params/state/data/year2026.ts#DC',
      'packages/engine/src/params/state/data/year2026.ts#IA',
      'packages/engine/src/params/state/data/year2026.ts#ID',
      'packages/engine/src/params/state/data/year2026.ts#MO',
      'packages/engine/src/params/state/data/year2026.ts#MT',
      'packages/engine/src/params/state/data/year2026.ts#states.ND',
      'packages/engine/src/params/state/data/year2026.ts#NM',
      'packages/engine/src/params/state/index.ts#conformStateStandardDeduction',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },
} satisfies Record<string, TaxRuleRecord>
