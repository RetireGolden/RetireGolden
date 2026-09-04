/**
 * Transfer tax and adjacent regime records: the estate and gift exclusions, DSUE
 * portability, 529-to-Roth rollovers, the section 199A deduction, and the HECM age
 * floor. Every record here is one the engine declines to model, recorded so the
 * refusal is citable.
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
export const transferAndUnmodeledRegimeRecords = {
  'irc-199A-a-qualified-business-income-deduction-not-modeled': {
    title: 'The section 199A qualified business income deduction is not a modeled surface',
    statement:
      'A taxpayer other than a corporation is allowed a deduction equal to the lesser of the combined qualified business income amount or 20 percent of taxable income reduced by net capital gain, with taxable income for that limitation computed without regard to section 68 and without regard to the section 199A deduction itself. Not modelled: the Plan has no qualified trade or business, qualified business income, W-2 wages allocable to QBI, unadjusted basis of qualified property, specified-service, REIT-dividend, or publicly-traded-partnership-income fact. Recurring and one-time ordinary streams are unlabeled dollars, and wages are Form W-2 compensation, not pass-through QBI. federalTax.ts therefore subtracts a genuine zero for QBI when assembling the section 68 base. The subsection (i) $400 minimum for an applicable taxpayer with at least $1,000 of QBI is folded here: it turns on the same absent qualified-trade-or-business facts. No accepted input reaches this deduction.',
    classification: 'outOfScope',
    outOfScope: { shape: 'typedRefusal' },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 199A(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section199A&num=0&edition=prelim',
      quotedText:
        'In the case of a taxpayer other than a corporation, except as provided in subsection (i), there shall be allowed as a deduction for any taxable year an amount equal to the lesser of- (1) the combined qualified business income amount of the taxpayer, or (2) an amount equal to 20 percent of the excess (if any) of- (A) the taxable income of the taxpayer for the taxable year, over (B) the net capital gain (as defined in section 1(h)) of the taxpayer for such taxable year.',
    }, {
      kind: 'statute',
      citation: 'IRC 199A(b)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section199A&num=0&edition=prelim',
      quotedText:
        'The term "combined qualified business income amount" means, with respect to any taxable year, an amount equal to- (A) the sum of the amounts determined under paragraph (2) for each qualified trade or business carried on by the taxpayer, plus (B) 20 percent of the aggregate amount of the qualified REIT dividends and qualified publicly traded partnership income of the taxpayer for the taxable year.',
    }, {
      kind: 'statute',
      citation: 'IRC 199A(e)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section199A&num=0&edition=prelim',
      quotedText:
        'Except as otherwise provided in subsection (g)(2)(B), taxable income shall be computed without regard to section 68 and without regard to any deduction allowable under this section.',
    }, {
      kind: 'statute',
      citation: 'IRC 199A(i)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section199A&num=0&edition=prelim',
      quotedText:
        'In the case of an applicable taxpayer for any taxable year, the deduction allowed under subsection (a) for the taxable year shall be equal to the greater of- (A) the amount of such deduction determined without regard to this subsection, or (B) $400.',
    }, {
      kind: 'statute',
      citation: 'IRC 199A(i)(2)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section199A&num=0&edition=prelim',
      quotedText:
        'The term "applicable taxpayer" means, with respect to any taxable year, a taxpayer whose aggregate qualified business income with respect to all active qualified trades or businesses of the taxpayer for such taxable year is at least $1,000.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/tax/federalTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#incomeStreamSchema',
      'packages/engine/src/tax/federalTax.ts#section68Reduction',
    ],
  },
  'usc-12-1715z-20-b-hecm-minimum-age-62': {
    title: 'A HECM borrower (or spouse) must be at least 62',
    statement:
      'The FHA home equity conversion mortgage program defines the eligible homeowner as one who is, or whose spouse is, at least 62 years of age. The HECM buffer detector enforces that floor as a conservative screen: no reverse-mortgage line-of-credit candidate is surfaced unless every household member has reached 62, measured at year granularity.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'First housing-law record in the registry, admitted on the same test as its Title 42 and POMS records: an engine gate whose refusal traces to an operative statutory clause. Two deliberate deviations from the clause itself: the screen requires the YOUNGEST member to be 62 where the statute is satisfied by either spouse - conservative, because the principal limit factor is keyed to the youngest age anyway and a candidate the statute would allow is merely not suggested - and age is measured at year granularity, so a member attaining 62 during the start year is treated as eligible for the suggestion a few months early. Neither deviation touches a tax figure; the card is a scenario suggestion.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '12 U.S.C. 1715z-20(b)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title12-section1715z-20&num=0&edition=prelim',
      quotedText:
        'The terms "elderly homeowner" and "homeowner" mean any homeowner who is, or whose spouse is, at least 62 years of age or such higher age as the Secretary may prescribe.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-29',
    implementedBy: [
      'packages/engine/src/insights/detectors/hecmBufferCandidate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/insights/detectors/hecmBufferCandidate.ts#hecmBufferCandidate',
    ],
  },

  'irc-529-c-3-E-529-to-roth-rollover-not-modeled': {
    title: 'A long-term 529-to-Roth rollover is not modeled',
    statement:
      'A distribution from a qualified tuition program of a designated beneficiary that has been maintained for the 15-year period ending on the distribution date is not includible under section 529(c)(3)(A) to the extent it is paid in a direct trustee-to-trustee transfer to a Roth IRA of that beneficiary, does not exceed contributions (and earnings) made before the 5-year period ending on that date, does not exceed the beneficiary\'s remaining section 408A(c)(2) Roth contribution room for the year, and does not cause lifetime such distributions for that beneficiary to exceed $35,000. The Plan has no qualified-tuition-program account type, no 15-year account-age or lifetime 529-to-Roth tally, and no retirement-action vocabulary for a 529-to-Roth transfer, so no accepted input reaches this rule.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'a qualified-tuition-program account type in accountUnionSchema',
      'the 15-year account age and the 5-year contribution window the exclusion turns on',
      'a lifetime 529-to-Roth tally to test the 35,000-dollar cap against',
      '529-to-Roth vocabulary in persistedRetirementActionRequestSchema',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This is a schema boundary, not a Roth-contribution result. accountUnionSchema\'s closed type set is taxable, equityComp, traditional, roth, hsa, cash, pension, annuity, property, and debt; there is no 529 or qualified-tuition-program member, which model/plan.test.ts already pins. retirementActionRequestSchema carries ordinary-withdrawal, Roth-conversion, QCD, and legacy aggregate arms, none of which carries a 529 source or rollover fact, so a 529-to-Roth rollover cannot be expressed as an action. The 15-year account-age test, the 5-year contribution seasoning, the annual 408A(c)(2) room, and the $35,000 lifetime cap share that one absence surface and are folded here rather than registered separately. The annual Roth IRA ceiling for ordinary Roth contributions remains the settled irc-408A-c-2-roth-shares-the-section-219-ceiling record; this record is only the 529(c)(3)(E) path. effectiveFrom is floored at 2026; the enacting applicability is distributions after December 31, 2023.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 529(c)(3)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section529&num=0&edition=prelim',
      quotedText:
        'Any distribution under a qualified tuition program shall be includible in the gross income of the distributee in the manner as provided under section 72 to the extent not excluded from gross income under any other provision of this chapter.',
    }, {
      kind: 'statute',
      citation: 'IRC 529(c)(3)(E)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section529&num=0&edition=prelim',
      quotedText:
        'In the case of a distribution from a qualified tuition program of a designated beneficiary which has been maintained for the 15-year period ending on the date of such distribution, subparagraph (A) shall not apply to so much the portion of such distribution which- (I) does not exceed the aggregate amount contributed to the program (and earnings attributable thereto) before the 5-year period ending on the date of the distribution, and (II) is paid in a direct trustee-to-trustee transfer to a Roth IRA maintained for the benefit of such designated beneficiary.',
    }, {
      kind: 'statute',
      citation: 'IRC 529(c)(3)(E)(ii)(I)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section529&num=0&edition=prelim',
      quotedText:
        'Clause (i) shall only apply to so much of any distribution as does not exceed the amount applicable to the designated beneficiary under section 408A(c)(2) for the taxable year (reduced by the amount of aggregate contributions made during the taxable year to all individual retirement plans maintained for the benefit of the designated beneficiary).',
    }, {
      kind: 'statute',
      citation: 'IRC 529(c)(3)(E)(ii)(II)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section529&num=0&edition=prelim',
      quotedText:
        'This subparagraph shall not apply to any distribution described in clause (i) to the extent that the aggregate amount of such distributions with respect to the designated beneficiary for such taxable year and all prior taxable years exceeds $35,000.',
    }, {
      kind: 'statute',
      citation: 'P.L. 117-328, division T, title I, section 126(d)',
      url: 'https://www.govinfo.gov/content/pkg/PLAW-117publ328/pdf/PLAW-117publ328.pdf',
      // The enrolled text continues immediately into section 127, so the
      // terminal U+2026 honestly discloses that omitted continuation.
      quotedText:
        '(d) EFFECTIVE DATE.--The amendments made by this section shall apply with respect to distributions after December 31, 2023…',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/actions/contract.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/contract.ts#persistedRetirementActionRequestSchema',
      'packages/engine/src/model/plan.ts#accountUnionSchema',
    ],
  },

  'irc-2503-b-annual-gift-exclusion-not-modeled': {
    title: 'The annual gift-tax exclusion is a transfer-tax rule the engine does not compute',
    statement:
      'Section 2503(b) excludes the first $10,000 of present-interest gifts to each donee from the donor\'s total gifts for the calendar year, and that dollar amount is increased for inflation for gifts made after 1998, rounded down to the next lowest multiple of $1,000. The engine computes no gift tax under chapter 12. The Plan has no taxable-gifts, donee, or annual-exclusion facts, and the parameter pack has no gift-tax exclusion figure, so no accepted input produces an annual-exclusion or gift-tax result.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'taxable gifts and the donees they were made to',
      'whether a gift is a present interest',
      'an annual-exclusion figure in the ParameterPack',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This is a transfer-tax absence, not an income-tax approximation. tax/federalTax.ts computes chapter 1 income tax only. projection/compare.ts\'s heirTax is an assumed heir income-tax haircut on inherited pre-tax balances, not a chapter 12 gift tax. model/plan.ts has no gift, donee, or annual-exclusion field, and params/types.ts\'s federalTax pack has no gift-exclusion amount. The staged 2503 text still carries the statutory $10,000 base plus the 2503(b)(2) COLA; it does not publish a 2026 indexed dollar, so this record does not invent one. The 15-year / $35,000 529-to-Roth mechanics are a different Code section and live at irc-529-c-3-E-529-to-roth-rollover-not-modeled.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 2503(b)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section2503&num=0&edition=prelim',
      quotedText:
        'In the case of gifts (other than gifts of future interests in property) made to any person by the donor during the calendar year, the first $10,000 of such gifts to such person shall not, for purposes of subsection (a), be included in the total amount of gifts made during such year. Where there has been a transfer to any person of a present interest in property, the possibility that such interest may be diminished by the exercise of a power shall be disregarded in applying this subsection, if no part of such interest will at any time pass to any other person.',
    }, {
      kind: 'statute',
      citation: 'IRC 2503(b)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section2503&num=0&edition=prelim',
      quotedText:
        'In the case of gifts made in a calendar year after 1998, the $10,000 amount contained in paragraph (1) shall be increased by an amount equal to- (A) $10,000, multiplied by (B) the cost-of-living adjustment determined under section 1(f)(3) for such calendar year by substituting "calendar year 1997" for "calendar year 2016" in subparagraph (A)(ii) thereof. If any amount as adjusted under the preceding sentence is not a multiple of $1,000, such amount shall be rounded to the next lowest multiple of $1,000.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/params/types.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#planSchema',
      'packages/engine/src/params/types.ts#ParameterPack',
    ],
  },

  'irc-2010-c-3-basic-exclusion-amount-not-modeled': {
    title: 'The 2026 basic exclusion amount is a chapter 11 credit base, not an income-tax deduction',
    statement:
      'Section 2010(a) allows a credit against the section 2001 estate tax equal to the tentative tax on the applicable exclusion amount. For decedents dying and gifts made after December 31, 2025, the basic exclusion amount under section 2010(c)(3)(A) is $15,000,000; that dollar amount is increased for inflation only for decedents dying in a calendar year after 2026. The applicable exclusion amount is the sum of that basic exclusion and, for a surviving spouse, any deceased spousal unused exclusion. The engine computes no estate tax. The Plan and parameter pack have no basic-exclusion or taxable-estate facts, so no accepted input produces an estate-tax exclusion result.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'a taxable estate for the section 2001 tax to apply to',
      'a basic-exclusion amount in the ParameterPack',
      'adjusted taxable gifts that share the applicable exclusion',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Transfer-tax computation, not income tax. tax/federalTax.ts returns chapter 1 income tax and never reads a basic exclusion amount. projection/compare.ts\'s heirTax and endingAfterTaxEstate discount inherited pre-tax balances at assumptions.heirTaxRatePct; that is an income-tax-basis estate metric, not the section 2001 tax or the section 2010 credit. The $15,000,000 figure is quote-carried from 2010(c)(3)(A); indexing does not begin until a decedent dying after 2026, so 2026 is the unindexed statutory year. Do not treat this record as the same tax base as irc-151-d-5-C-senior-deduction-not-indexed: that deduction is a chapter 1 subtraction of 6,000 dollars per qualified individual, and this credit is a chapter 11 exclusion. Portability of unused exclusion is a separate election and is registered at irc-2010-c-5-dsue-portability-election-not-modeled.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 2010(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section2010&num=0&edition=prelim',
      quotedText:
        'A credit of the applicable credit amount shall be allowed to the estate of every decedent against the tax imposed by section 2001.',
    }, {
      kind: 'statute',
      citation: 'IRC 2010(c)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section2010&num=0&edition=prelim',
      quotedText:
        'For purposes of this section, the applicable credit amount is the amount of the tentative tax which would be determined under section 2001(c) if the amount with respect to which such tentative tax is to be computed were equal to the applicable exclusion amount.',
    }, {
      kind: 'statute',
      citation: 'IRC 2010(c)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section2010&num=0&edition=prelim',
      quotedText:
        'For purposes of this subsection, the applicable exclusion amount is the sum of- (A) the basic exclusion amount, and (B) in the case of a surviving spouse, the deceased spousal unused exclusion amount.',
    }, {
      kind: 'statute',
      citation: 'IRC 2010(c)(3)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section2010&num=0&edition=prelim',
      quotedText:
        'For purposes of this subsection, the basic exclusion amount is $15,000,000.',
    }, {
      kind: 'statute',
      citation: 'IRC 2010(c)(3)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section2010&num=0&edition=prelim',
      quotedText:
        'In the case of any decedent dying in a calendar year after 2026, the dollar amount in subparagraph (A) shall be increased by an amount equal to- (i) such dollar amount, multiplied by (ii) the cost-of-living adjustment determined under section 1(f)(3) for such calendar year by substituting "calendar year 2025" for "calendar year 2016" in subparagraph (A)(ii) thereof. If any amount as adjusted under the preceding sentence is not a multiple of $10,000, such amount shall be rounded to the nearest multiple of $10,000.',
    }, {
      kind: 'statute',
      citation: 'IRC 2010, Editorial Notes, Effective Date of 2025 Amendment',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section2010&num=0&edition=prelim',
      quotedText:
        'The amendments made by this section [amending this section] shall apply to estates of decedents dying and gifts made after December 31, 2025.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/params/types.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#planSchema',
      'packages/engine/src/params/types.ts#ParameterPack',
    ],
  },

  'irc-2010-c-5-dsue-portability-election-not-modeled': {
    title: 'Deceased-spousal unused exclusion requires a timely estate-tax-return election',
    statement:
      'A surviving spouse may take a deceased spousal unused exclusion amount into account only if the executor of the deceased spouse\'s estate files an estate tax return on which that amount is computed and elects on that return that it may be so taken into account. The election is irrevocable and may not be made on a return filed after the time prescribed by law, including extensions. Treas. Reg. 20.2010-2(a) requires the election on a timely filed Form 706. The Plan has no estate-tax-return, Form 706, DSUE, or portability-election facts, and the engine computes no chapter 11 tax, so no accepted input reaches this rule.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'an estate tax return for a deceased spouse, timely filed or otherwise',
      'a computed deceased spousal unused exclusion amount',
      'the portability election made on that return',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The statute and the regulation share one absence surface: model/plan.ts has no Form 706, DSUE amount, or portability-election field, and neither tax/federalTax.ts nor projection/compare.ts computes estate tax. compare.ts\'s heirTax remains an assumed heir income-tax haircut, which is not a portable unused exclusion and does not become one when a spouse dies in the projection. The timely-filing mechanics of Treas. Reg. 20.2010-2(a) and (a)(1) are folded here rather than split from 2010(c)(5)(A). The $15,000,000 basic exclusion itself is irc-2010-c-3-basic-exclusion-amount-not-modeled.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 2010(c)(5)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section2010&num=0&edition=prelim',
      quotedText:
        'A deceased spousal unused exclusion amount may not be taken into account by a surviving spouse under paragraph (2) unless the executor of the estate of the deceased spouse files an estate tax return on which such amount is computed and makes an election on such return that such amount may be so taken into account. Such election, once made, shall be irrevocable. No election may be made under this subparagraph if such return is filed after the time prescribed by law (including extensions) for filing such return.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 20.2010-2(a)',
      url: 'https://www.ecfr.gov/current/title-26/section-20.2010-2',
      quotedText:
        'To allow a decedent\'s surviving spouse to take into account that decedent\'s deceased spousal unused exclusion (DSUE) amount, the executor of the decedent\'s estate must elect portability of the DSUE amount on a timely filed Form 706, \u201cUnited States Estate (and Generation-Skipping Transfer) Tax Return\u201d (estate tax return). This election is referred to in this section and in \u00a7 20.2010-3 as the portability election.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 20.2010-2(a)(1)',
      url: 'https://www.ecfr.gov/current/title-26/section-20.2010-2',
      quotedText:
        'An estate that elects portability will be considered, for purposes of subtitle B and subtitle F of the Internal Revenue Code (Code), to be required to file a return under section 6018(a). Accordingly, the due date of an estate tax return required to elect portability is nine months after the decedent\'s date of death or the last day of the period covered by an extension (if an extension of time for filing has been obtained).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#planSchema',
    ],
  },
} satisfies Record<string, TaxRuleRecord>
