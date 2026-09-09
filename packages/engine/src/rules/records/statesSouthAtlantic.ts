/**
 * State records for the South Atlantic: DE, DC, FL, GA, MD, NC, SC, VA, WV.
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
export const southAtlanticStateRecords = {
  'fl-const-7-5-a-income-tax-prohibited': {
    title: 'No Florida income tax reaches a natural person',
    statement:
      'The Florida Constitution caps any tax on the income of a natural person resident or citizen of the state at the amounts creditable against or deductible from a similar federal or state tax. The income tax Florida does impose is chapter 220\'s, and that chapter reaches no natural person: it falls on "every taxpayer", and "taxpayer" is defined as a corporation. A constitutional ceiling above and an imposition that stops at the corporate boundary below are what leave a Florida retiree with nothing to compute, which the pack encodes as `hasIncomeTax: false`.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:FL',
    authority: [{
      kind: 'statute',
      citation: 'Fla. Const. art. VII, sec. 5(a)',
      url: 'https://www.flsenate.gov/Laws/Constitution/Article7',
      quotedText:
        'NATURAL PERSONS. No tax upon estates or inheritances or upon the income of natural persons who are residents or citizens of the state shall be levied by the state, or under its authority, in excess of the aggregate of amounts which may be allowed to be credited upon or deducted from any similar tax levied by the United States or any state.',
    }, {
      kind: 'statute',
      citation: 'Fla. Stat. 220.11(1)',
      url: 'https://www.flsenate.gov/Laws/Statutes/2025/220.11',
      quotedText:
        'A tax measured by net income is hereby imposed on every taxpayer for each taxable year for the privilege of conducting business, earning or receiving income in this state, or being a resident or citizen of this state.',
    }, {
      kind: 'statute',
      citation: 'Fla. Stat. 220.03(1)(z)',
      url: 'https://www.flsenate.gov/Laws/Statutes/2025/220.03',
      quotedText:
        '“Taxpayer” means any corporation subject to the tax imposed by this code, and includes all corporations for which a consolidated return is filed under s. 220.131.',
    }, {
      // Added 2026-08-05. The three authorities above are a ceiling and an
      // imposition, and a reader has to reason from them to reach the operative
      // fact. Worse, the ceiling is not flat: section 5(a) bars a tax "in
      // excess of" what may be "credited upon or DEDUCTED FROM" a similar
      // federal tax, and whether "deducted from" reaches the federal deduction
      // for state taxes — which would make the ceiling non-zero — is not
      // resolved on the text alone and no Florida construction of it was found.
      // The Legislature's own Office of Economic and Demographic Research
      // states the fact flatly instead, so the record no longer has to rest the
      // whole negative on a clause whose reach is open.
      kind: 'stateAgencyPublication',
      citation: 'Florida Tax Handbook 2025 (Office of Economic and Demographic Research), Personal Income Tax',
      url: 'https://edr.state.fl.us/Content/revenues/reports/tax-handbook/taxhandbook2025.pdf',
      quotedText: 'SUMMARY: Florida currently does not levy a personal income tax.',
    }],
    volatility: 'staticStatute',
    // 2026 under the convention above, not 1971. The constitutional cap does
    // carry a 1971 adoption note, but two of the three authorities here are
    // quoted from the 2025 compilation of the Florida Statutes, and chapter 220
    // has plainly been amended since 1971 — the definition of "taxpayer" in
    // particular. Dating the record from the constitution alone would extend
    // the two statutory quotations back over fifty years of text nobody read.
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#FL',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'wv-code-11-21-12-social-security-full-modification': {
    title: 'West Virginia exempts all Social Security from 2026',
    statement:
      'West Virginia phased a decreasing modification for Social Security up to 100 percent, and from tax years beginning on or after January 1, 2026 the phase is complete at every income level. It takes all four subdivisions to see that, and each does a different job: (A) allows 100 percent of the benefits included in federal adjusted gross income as a decreasing modification, (B) confines (A) to a taxpayer whose federal AGI does NOT exceed $100,000 on a joint return or $50,000 otherwise, (E) allows 100 percent from 2026, and (F) makes (E) available precisely to the taxpayers above those thresholds — the band (B) shuts (A) out of. The two bands are complementary and exhaust the range, so from 2026 no federally taxable Social Security survives into the West Virginia base, which is what `taxesSocialSecurity: false` encodes for the pack.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:WV',
    authority: [{
      kind: 'statute',
      citation: 'W. Va. Code 11-21-12(c)(8)(A)',
      url: 'https://code.wvlegislature.gov/11-21-12/',
      quotedText:
        'For taxable years beginning on or after January 1, 2022, 100 percent of the social security benefits received pursuant to Chapter 7 of Title 42 of the United States Code, including, but not limited to, social security benefits paid by the Social Security Administration as Old Age, Survivors and Disability Insurance Benefits as provided in 42 U.S.C. § 401 et. seq. or as Supplemental Security Income for the Aged, Blind, and Disabled as provided in 42 U.S.C. § 1381 et. seq., included in federal adjusted gross income for the taxable year shall be allowed as a decreasing modification from federal adjusted gross income when determining West Virginia taxable income subject to the tax imposed by this article, subject to the limitation in §11-21-12(c)(8)(B) of this code.',
    }, {
      kind: 'statute',
      citation: 'W. Va. Code 11-21-12(c)(8)(B)',
      url: 'https://code.wvlegislature.gov/11-21-12/',
      quotedText:
        'The deduction allowed by §11-21-12(c)(8)(A) of this code are allowable only when the federal adjusted gross income of a married couple filing a joint return does not exceed $100,000, or $50,000 in the case of a single individual or a married individual filing a separate return.',
    }, {
      kind: 'statute',
      citation: 'W. Va. Code 11-21-12(c)(8)(E)',
      url: 'https://code.wvlegislature.gov/11-21-12/',
      quotedText:
        'For taxable years beginning on or after January 1, 2026, 100 percent of the social security benefits received pursuant to Chapter 7 of Title 42 of the United States Code, including, but not limited to, social security benefits paid by the Social Security Administration as Old Age, Survivors and Disability Insurance Benefits as provided in 42 U.S.C. § 401 et. seq. or as Supplemental Security Income for the Aged, Blind, and Disabled as provided in 42 U.S.C. 1381 et. seq., included in federal adjusted gross income for the taxable year shall be allowed as a decreasing modification from federal adjusted gross income when determining West Virginia taxable income subject to the tax imposed by this article, subject to the limitation in §11-21-12(c)(8)(F) of this code.',
    }, {
      kind: 'statute',
      citation: 'W. Va. Code 11-21-12(c)(8)(F)',
      url: 'https://code.wvlegislature.gov/11-21-12/',
      quotedText:
        'The deduction allowed by §11-21-12(c)(8)(C), §11-21-12(c)(8)(D), and §11-21-12(c)(8)(E) of this code are allowable only when the federal adjusted gross income of a married couple filing a joint return exceeds $100,000, or $50,000 in the case of a single individual or a married individual filing a separate return.',
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
      'packages/engine/src/params/state/data/year2026.ts#WV',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'wv-code-11-21-4j-graduated-income-tax-rate-schedule': {
    title: 'West Virginia’s 2026 graduated rates run on the modeled taxable base',
    statement:
      'For taxable years beginning on or after January 1, 2026, §11-21-4j applies in lieu of §11-21-4i. Subsection (a) sets a five-band schedule on West Virginia taxable income for every individual except a married individual filing separately — including heads of household, joint filers, surviving spouses, and estates and trusts (with a stated trust exception). The pack models single and married filing jointly against the same (a) table; subsection (b)\'s separate married-filing-separately schedule is out of scope. Subsection (e) makes the section apply for all such taxable years. The pack\'s `brackets` carry the rates and shared break points; `bracketTax` applies them to the modeled West Virginia taxable base.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Personal exemptions under §11-21-16, the age-65 or disability modification under §11-21-12(c)(9), military and other listed subtractions, and a full return reconciliation are not certified here. This record registers only the progressive rates and shared break points the pack carries as a stand-in for 2026.',
    jurisdiction: 'state:WV',
    authority: [{
      kind: 'statute',
      citation: 'W. Va. Code §11-21-4j(a)',
      url: 'https://code.wvlegislature.gov/11-21-4J/',
      quotedText:
        '(a) Rate of tax on individuals (except married individuals filing separate returns), individuals filing joint returns, heads of households, and estates and trusts. — For taxable years beginning on and after January 1, 2026, the tax imposed by §11-21-3 of this code on the West Virginia taxable income of every individual (except married individuals filing separate returns); every individual who is a head of a household in the determination of his or her federal income tax for the taxable year; every husband and wife who file a joint return under this article; every individual who is entitled to file his or her federal income tax return for the taxable year as a surviving spouse; and every estate and trust (except non-grantor trusts administered by licensed private trust companies created pursuant to the provisions of §31I-1-1 et seq. of this code) shall be determined in accordance with the following table:',
    }, {
      kind: 'statute',
      citation: 'W. Va. Code §11-21-4j(a)',
      url: 'https://code.wvlegislature.gov/11-21-4J/',
      quotedText:
        'If the West Virginia taxable income is: The tax is: Not over $10,000 2.11% of the taxable income Over $10,000 but not over $25,000 $211 plus 2.81% of excess over $10,000 Over $25,000 but not over $40,000 $632.50 plus 3.16% of excess over $25,000 Over $40,000 but not over $60,000 $1,106.50 plus 4.22% of excess over $40,000 Over $60,000 $1,950.50 plus 4.58% of excess over $60,000',
    }, {
      kind: 'statute',
      citation: 'W. Va. Code §11-21-4j(e)',
      url: 'https://code.wvlegislature.gov/11-21-4J/',
      quotedText:
        '(e) Applicability of this section. — The provisions of this section shall be applicable in determining the rates of tax imposed by this article and shall apply for all taxable years beginning on and after January 1, 2026, and shall be in lieu of the rates of tax specified in §11-21-4i of this code.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#WV',
      'packages/engine/src/tax/stateTax.ts#bracketTax',
    ],
  },

  'sc-code-12-6-1170-retirement-income-deduction': {
    title: 'South Carolina’s retirement deduction has a tier below age 65',
    statement:
      'South Carolina allows the original owner of a qualified retirement account a deduction of up to three thousand dollars of retirement income, rising to ten thousand dollars beginning in the year the taxpayer reaches sixty-five. Approximated: the pack models the upper tier only, as `{ kind: \'capped\', capPerPerson: 10000, minAge: 65 }`, so a South Carolinian under sixty-five is given no deduction at all and is charged tax on three thousand dollars the statute reaches. The separate section (B) deduction of up to fifteen thousand dollars at sixty-five, net of the (A) amount, is likewise unmodelled and errs the same way.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:SC',
    authority: [{
      kind: 'statute',
      citation: 'S.C. Code 12-6-1170(A)(1)',
      url: 'https://www.scstatehouse.gov/code/t12c006.php',
      quotedText:
        'An individual taxpayer who is the original owner of a qualified retirement account is allowed an annual deduction from South Carolina taxable income of not more than three thousand dollars of retirement income received. Beginning in the year in which the taxpayer reaches age sixty-five, the taxpayer may deduct not more than ten thousand dollars of retirement income that is included in South Carolina taxable income.',
    }, {
      kind: 'statute',
      citation: 'S.C. Code 12-6-1170(B)',
      url: 'https://www.scstatehouse.gov/code/t12c006.php',
      quotedText:
        'Beginning for the taxable year during which a resident individual taxpayer attains the age of sixty-five years, the resident individual taxpayer is allowed a deduction from South Carolina taxable income received in an amount not to exceed fifteen thousand dollars reduced by any amount the taxpayer deducts pursuant to subsection (A) not including amounts deducted as a surviving spouse.',
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
      'packages/engine/src/params/state/data/year2026.ts#states.SC',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'sc-code-12-6-1120-7-reserve-national-guard-pay-not-modeled': {
    title: 'South Carolina excludes limited Guard and Reserve pay under §12-6-1120(7); the engine cannot certify service or pay type',
    statement:
      'S.C. Code §12-6-1120(7) excludes from South Carolina gross income compensation or retirement benefits from the United States or any state for service in a state National Guard or reserve component, but only for the customary annual training period (not exceeding fifteen days for guard members or fourteen days plus travel time for reserve members), weekend drills, and inactive duty training, with a fifteen-day active-duty deduction when annual-training pay was not excluded in the same taxable year. That exclusion is a different limb from the retirement deduction at `sc-code-12-6-1170-retirement-income-deduction` and from federally taxable Social Security the pack removes through `taxesSocialSecurity: false`; it does not reach every Guard or Reserve dollar. Out of scope: `wagesIncomeSchema` carries only annual gross wages with no Guard or reserve service, pay-type, training-day, drill, inactive-duty, or active-duty facts, `pensionSchema` distinguishes only private versus public source, and `StateTaxParams` / `StateRetirementExclusion` carry no National Guard or reserve pay-type facts — so no accepted wages, ordinary, public or private pension input can identify qualifying §12-6-1120(7) compensation or retirement benefits. Generic amounts entered through those channels are still priced under the pack\'s existing rules; the engine emits no law-specific refusal for this limb.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
        'compensation or retirement benefits from the United States or any state for service in a state National Guard or reserve component',
        'pay limited to customary annual training (not more than fifteen days for guard or fourteen days plus travel for reserve), weekend drills, inactive duty training, or fifteen days of active-duty pay when annual-training pay was not excluded in the same year: wagesIncomeSchema has no Guard or reserve service or pay-type fields',
        'National Guard or reserve service category on pensionSchema, whose `source` enum is only private or public',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:SC',
    authority: [{
      kind: 'statute',
      citation: 'S.C. Code 12-6-1120(7)',
      url: 'https://www.scstatehouse.gov/code/t12c006.php',
      quotedText:
        '(7) South Carolina gross income does not include compensation or retirement benefits received from the United States or any state for service in a state National Guard or a reserve component of the Armed Forces of the United States. This exclusion only applies to compensation and retirement benefits received for the customary annual training period not to exceed fifteen days for guard members or fourteen days plus travel time for reserve members, weekend drills, and inactive duty training. National Guard or reserve members that are called to active duty are allowed to deduct fifteen days of active duty pay if they have not excluded pay for the annual training period for the same taxable year.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/params/state/types.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#wagesIncomeSchema',
      'packages/engine/src/model/plan.ts#pensionSchema',
      'packages/engine/src/params/state/types.ts#StateTaxParams',
    ],
  },

  'dc-code-47-1803-03-federal-standard-and-ss': {
    title: 'The District excludes federally taxable Social Security and follows the federal standard-deduction choice',
    statement:
      'D.C. separately excludes Social Security and Tier 1 Railroad benefits that were taxable under IRC section 86, exactly the federal share omitted by the pack\'s `taxesSocialSecurity: false`. It also requires a federal standard-deduction claimant to take the applicable District standard deduction, whose amount is specified in a separate definition. The staged sections establish the Social Security subtraction and the linked filing choice; they do not restate that definition section\'s dollar amount, so this record makes no independent claim about the amount or its future indexation.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:DC',
    authority: [{
      kind: 'statute',
      citation: 'D.C. Code 47-1803.02(a)(2)(L)',
      url: 'https://code.dccouncil.gov/us/dc/council/code/sections/47-1803.02',
      quotedText:
        'The following items shall be excluded in the computation of District gross income: ... Social security and tier 1 railroad retirement benefits subject to taxation under \u00a7\u200286 of the Internal Revenue Code of 1986.',
    }, {
      kind: 'statute',
      citation: 'D.C. Code 47-1803.03(c)',
      url: 'https://code.dccouncil.gov/us/dc/council/code/sections/47-1803.03',
      quotedText:
        'Every individual who claims the standard deduction on his or her federal income tax return shall claim the applicable standard deduction specified in \u00a7 47-1801.04(26).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/state/index.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#DC',
      'packages/engine/src/params/state/index.ts#conformStateStandardDeduction',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ga-code-48-7-27-retirement-and-social-security-exclusion': {
    title: 'Georgia has a $35,000 retirement-income tier at ages 62-64 and separately subtracts taxable Social Security',
    statement:
      'Georgia DOR\'s filing instructions make taxable Social Security a subtraction and direct retirees to the official IT-511 worksheet. That worksheet allows $35,000 at ages 62-64 and $65,000 at age 65 or older. Approximated: the pack preserves the age-65 $65,000 cap and separately excludes federally taxable Social Security, but has no $35,000 62-64 tier. It therefore leaves that source-covered retirement income in the base and overstates tax for the 62-64 limb. The DOR page also says retirement income reaches investment sources and up to $5,000 of earned income; the two retirement buckets cannot represent that broader base, so the record does not pretend that the age-65 bucket alone exhausts Georgia\'s exclusion.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale:
      'Georgia\'s official Code host is script-rendered and did not yield quote-verifiable operative text. The Department of Revenue is deliberately admitted as the state\'s own publisher because its retirement page supplies the operative filing instruction and points taxpayers to its own IT-511 booklet and worksheet, which supplies the two dollar amounts. This is the same primary-agency-publication boundary used where a usable code text is unavailable, not a secondary summary substituted for one.',
    jurisdiction: 'state:GA',
    authority: [{
      kind: 'stateAgencyPublication',
      citation: 'Georgia Department of Revenue, Retirement Income Exclusion',
      url: 'https://dor.georgia.gov/retirement-income-exclusion',
      quotedText:
        'Taxpayers who are 62 or older, or permanently and totally disabled regardless of age, may be eligible for a retirement income adjustment on their Georgia tax return.',
    }, {
      kind: 'formInstruction',
      citation: 'Georgia Department of Revenue, 2025 Form 500 Schedule 1, Retirement Income Exclusion worksheet',
      url: 'https://dor.georgia.gov/document/document/2025-it-511-individual-income-tax-booklet/download',
      quotedText:
        '*If age 62-64 or less than age 62 and permanently disabled enter $35,000, or if age 65 or older enter $65,000.',
    }, {
      kind: 'formInstruction',
      citation: 'Georgia Department of Revenue, 2025 Form 500 Schedule 1, line 8',
      url: 'https://dor.georgia.gov/document/document/2025-it-511-individual-income-tax-booklet/download',
      quotedText:
        'SUBTRACTION from INCOME (See IT-511 Tax Booklet) ... Social Security Benefits (Taxable portion from Federal return)',
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
      'packages/engine/src/params/state/data/year2026.ts#GA',
      'packages/engine/src/params/state/types.ts#StateRetirementExclusion',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'de-code-30-1106-social-security-retirement-subtractions': {
    title: 'Delaware subtracts federally taxable Social Security and up to $12,500 of retirement income at age 60',
    statement:
      'Delaware subtracts Social Security included in federal adjusted gross income and permits a single $12,500 retirement-income subtraction for a person age 60 or older. The statute’s shared per-person ceiling reaches pensions from employers and eligible retirement income, and the pack therefore applies its capped rule once to combined private and public retirement income through `retirementRuleShared`, rather than once per bucket. Its separate `taxesSocialSecurity: false` removes exactly the federally included benefit amount.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:DE',
    authority: [{
      kind: 'statute',
      citation: 'Del. Code tit. 30, 1106(b)(3)(b)(2)',
      url: 'https://delcode.delaware.gov/title30/c011/sc02/index.html',
      quotedText:
        'For persons age 60 or older, amounts received, not to exceed $12,500, as pensions from employers, the United States, this State, or any subdivision of this State, or as eligible retirement income.',
    }, {
      kind: 'statute',
      citation: 'Del. Code tit. 30, 1106(b)(4)',
      url: 'https://delcode.delaware.gov/title30/c011/sc02/index.html',
      quotedText:
        'Social Security benefits paid by the United States and all payments received under the Railroad Retirement Act of 1974 [45 U.S.C. §§ 231-231[v]] to the extent included in federal adjusted gross income;',
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
      'packages/engine/src/params/state/data/year2026.ts#DE',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'de-code-30-1102-a-14-rate-schedule': {
    title: 'Delaware assigns 5.55% to taxable income over $25,000 through $60,000',
    statement:
      'For taxable years after 2013, Delaware’s graduated rate schedule assigns 5.55 percent to the slice of taxable income over $25,000 but not over $60,000. The pack carries the shared bracket thresholds and rates for single and married filing jointly; `bracketTax` applies them to modeled Delaware taxable income after the standard deduction. Personal credits, exemptions, itemization, and whole-return accuracy are outside this record.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This record registers only the statutory rate schedule on modeled taxable income. Delaware’s basic standard deduction is registered separately at `de-code-30-1108-standard-deduction`. Qualifying-surviving-spouse routing, blindness, retirement subtractions, and credits are outside this record.',
    jurisdiction: 'state:DE',
    authority: [{
      kind: 'statute',
      citation: 'Del. Code tit. 30, §1102(a)(14) (effective period)',
      url: 'https://delcode.delaware.gov/title30/c011/sc01/index.html',
      quotedText:
        '(14) For taxable years beginning after December 31, 2013, the amount of tax shall be determined as follows:',
    }, {
      kind: 'statute',
      citation: 'Del. Code tit. 30, §1102(a)(14) (5.55% band)',
      url: 'https://delcode.delaware.gov/title30/c011/sc01/index.html',
      quotedText:
        '5.55% of taxable income in excess of $25,000 but not in excess of $60,000; and',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2014,
    effectiveThrough: null,
    verifiedOn: '2026-09-07',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#DE',
      'packages/engine/src/tax/stateTax.ts#bracketTax',
    ],
  },

  'de-code-30-1108-standard-deduction': {
    title: 'Delaware’s standard deduction is $3,250 single and $6,500 joint plus $2,500 per age-65 person',
    statement:
      'For a nonblind Delaware resident taking the standard deduction on a single or married-filing-jointly return, the basic deduction is $3,250 or $6,500 respectively, with an additional $2,500 for each qualifying taxpayer or spouse age 65 or older.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Blindness, the itemization election under § 1107, personal credits, and whole-return accuracy are outside this record. Delaware’s amounts are fixed statutory dollars with no federal scaling tag. `effectiveFrom: 2000` is the first tax year in which this record’s combined $3,250 single / $6,500 joint basic deductions and $2,500 age addition all governed. Verification is against the 2026 parameter pack; the selector’s use of that pack for earlier years is an unmarked historical approximation, and this record does not certify other Delaware parameters for those years. Qualifying-surviving-spouse years are outside this settled single/MFJ record and are disclosed separately at `de-pit-est-2026-qss-standard-deduction-joint-mapper`. The § 1102 rate schedule is registered separately at `de-code-30-1102-a-14-rate-schedule`.',
    jurisdiction: 'state:DE',
    authority: [{
      kind: 'statute',
      citation: 'Del. Code tit. 30, 1107',
      url: 'https://delcode.delaware.gov/title30/c011/sc02/index.html',
      quotedText:
        'The deduction of a resident individual shall be the standard deduction, unless the individual elects to itemize deductions as provided in § 1109 of this title.',
    }, {
      kind: 'statute',
      citation: 'Del. Code tit. 30, 1108(a)(3)',
      url: 'https://delcode.delaware.gov/title30/c011/sc02/index.html',
      quotedText:
        'For taxable periods beginning after December 31, 1999, the standard deduction of a resident individual shall be $3,250, and the standard deduction of resident spouses shall be $6,500 if they file a joint return and $3,250 each if they file separate returns.',
    }, {
      kind: 'statute',
      citation: 'Del. Code tit. 30, 1108(b)(1)',
      url: 'https://delcode.delaware.gov/title30/c011/sc02/index.html',
      quotedText:
        'The sum of $2,500 shall be added to the standard deduction determined under subsection (a) of this section in each of the following circumstances: … For the taxpayer who has attained the age of 65 before the close of the taxable year;',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Delaware Division of Revenue, 2026 Form PIT-EST instructions, line 3',
      url: 'https://revenuefiles.delaware.gov/2025/PITForms_Instructions/Instructions/PIT-EST_Instructions_2026-01.pdf',
      quotedText:
        '(a) If deductions will be itemized, enter estimated itemized deductions total. If not itemizing, use Standard Deduction ($3,250 single, divorced or widow(er), head of household) ($6,500 if married filing jointly), or ($3,250 if married or entered into a civil union filing separately). (b) Additional Standard Deduction Allowance(s) of $2,500 for taxpayer &/or spouse. If 65 years old or over or blind and filing Standard Deduction.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2000,
    effectiveThrough: null,
    verifiedOn: '2026-09-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/index.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#DE',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/params/index.ts#age65StandardDeductionAddition',
    ],
  },

  'de-pit-est-2026-qss-standard-deduction-joint-mapper': {
    title: 'Delaware QSS is routed through the joint standard-deduction row',
    statement:
      'For a modeled Delaware qualifying-surviving-spouse year resolved through the 2026 state parameter pack, the engine selects the married-filing-jointly row: $6,500 basic and $9,000 for one nonblind survivor age 65. Current §1108 and the 2026 Form PIT-EST instructions put a widow(er) on the $3,250 individual row, or $5,750 with one age-65 addition. For projection years after 2026, `stateParamsFor` repeats these amounts only by carrying the latest published pack forward. That is a disclosed frozen-pack product approximation, not verification of a future Delaware form, future legislation, or any other future-year Delaware parameter.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'DISCLOSED APPROXIMATION. ProjectedFilingStatus can express qualifyingSurvivingSpouse, but taxParameterFilingStatus maps every non-single status to marriedFilingJointly before computeStateTaxableIncome selects the Delaware deduction row. The $3,250 excess deduction can understate Delaware tax where it reduces positive taxable income; tax can be unchanged at a floor. `effectiveFrom: 2026` is the first observed and fixture-backed modeled year. `effectiveThrough: null` means the current mapper and unsunset statutory comparison have no scheduled expiry. Later-year persistence depends on latest-pack fallback and must be rechecked when a new state pack, form, or amendment appears. Earlier years, QSS brackets, itemization, credits, blindness, other return lines, and whole-return accuracy remain outside this record.',
    jurisdiction: 'state:DE',
    authority: [{
      kind: 'statute',
      citation: 'Del. Code tit. 30, 1108(a)(3)',
      url: 'https://delcode.delaware.gov/title30/c011/sc02/index.html',
      quotedText:
        'For taxable periods beginning after December 31, 1999, the standard deduction of a resident individual shall be $3,250, and the standard deduction of resident spouses shall be $6,500 if they file a joint return and $3,250 each if they file separate returns.',
    }, {
      kind: 'statute',
      citation: 'Del. Code tit. 30, 1108(b)(1)',
      url: 'https://delcode.delaware.gov/title30/c011/sc02/index.html',
      quotedText:
        'The sum of $2,500 shall be added to the standard deduction determined under subsection (a) of this section in each of the following circumstances: … For the taxpayer who has attained the age of 65 before the close of the taxable year;',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Delaware Division of Revenue, 2026 Form PIT-EST instructions, line 3',
      url: 'https://revenuefiles.delaware.gov/2025/PITForms_Instructions/Instructions/PIT-EST_Instructions_2026-01.pdf',
      quotedText:
        '(a) If deductions will be itemized, enter estimated itemized deductions total. If not itemizing, use Standard Deduction ($3,250 single, divorced or widow(er), head of household) ($6,500 if married filing jointly), or ($3,250 if married or entered into a civil union filing separately). (b) Additional Standard Deduction Allowance(s) of $2,500 for taxpayer &/or spouse. If 65 years old or over or blind and filing Standard Deduction.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-06',
    implementedBy: [
      'packages/engine/src/projection/internal/types/tax.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/index.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/types/tax.ts#taxParameterFilingStatus',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/params/state/data/year2026.ts#DE',
      'packages/engine/src/params/index.ts#age65StandardDeductionAddition',
    ],
  },

  'md-tax-10-207-social-security-exclusion': {
    title: 'Maryland subtracts Social Security and railroad-retirement payments',
    statement:
      'Maryland adjusted gross income subtracts a payment received under Title II of the Social Security Act or as a benefit under the Railroad Retirement Act, to the extent the payment was included in federal adjusted gross income. That is what `taxesSocialSecurity: false` encodes: no federally taxable Social Security survives into the Maryland base. The $41,200 pension exclusion the pack also carries is not in this section — §10-207(mm) points at §10-209 for "employee retirement system" — and is registered separately at md-tax-10-209-pension-exclusion.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:MD',
    authority: [{
      kind: 'statute',
      citation: 'Md. Tax-General 10-207(a)',
      url: 'https://mgaleg.maryland.gov/2026RS/Statute_Web/gtg/10-207.pdf',
      quotedText:
        'To the extent included in federal adjusted gross income, the amounts under this section are subtracted from the federal adjusted gross income of a resident to determine Maryland adjusted gross income.',
    }, {
      kind: 'statute',
      citation: 'Md. Tax-General 10-207(j)',
      url: 'https://mgaleg.maryland.gov/2026RS/Statute_Web/gtg/10-207.pdf',
      quotedText:
        'The subtraction under subsection (a) of this section includes a payment received: (1) under Title II of the Social Security Act; or (2) as a benefit under the Railroad Retirement Act.',
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
      'packages/engine/src/params/state/data/year2026.ts#MD',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'md-tax-10-209-pension-exclusion': {
    title: 'Maryland’s pension subtraction is not a flat $41,200 of all retirement',
    statement:
      'Maryland subtracts the lesser of (1) annuity, pension or endowment income from an "employee retirement system" included in federal AGI and (2) the Comptroller’s maximum annual Social Security benefit for an individual who retired at 65 in the prior calendar year, reduced by Social Security and railroad-retirement payments received. An employee retirement system is a §401(a), §403 or §457(b) employer plan; it does not include an IRA, a Roth IRA, a rollover IRA, a SEP or a §457(f) plan. The age gate is 65, or total disability, or a 55-year-old retired forest, park or wildlife ranger. Approximated: the pack encodes `{ kind: \'capped\', capPerPerson: 41200, minAge: 65 }` on the shared retirement buckets, so an IRA distribution of a 65-year-old is excluded up to $41,200 the statute withholds, and a Social Security recipient keeps the full cap the statute reduces dollar-for-dollar. Both of those flatter the taxpayer. The other way: a disabled resident or a 55-year-old ranger who is not 65 is granted nothing, and the Comptroller’s unpublished 2026 maximum may sit above or below the pack’s $41,200 — that figure is not in §10-209, and neither is the shopping-list $30,000. Social Security itself is a different section and is registered separately at md-tax-10-207-social-security-exclusion.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale: null,
    jurisdiction: 'state:MD',
    authority: [{
      kind: 'statute',
      citation: 'Md. Tax-General 10-209(a)(1)',
      url: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtg&section=10-209&enactments=false',
      quotedText:
        '“employee retirement system” means a plan: (i) established and maintained by an employer for the benefit of its employees; and (ii) qualified under § 401(a), § 403, or § 457(b) of the Internal Revenue Code',
    }, {
      kind: 'statute',
      citation: 'Md. Tax-General 10-209(a)(2)(i)',
      url: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtg&section=10-209&enactments=false',
      quotedText:
        '“employee retirement system” does not include: (i) an individual retirement account or annuity under § 408 of the Internal Revenue Code;',
    }, {
      kind: 'statute',
      citation: 'Md. Tax-General 10-209(b)',
      url: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtg&section=10-209&enactments=false',
      quotedText:
        'Subject to subsections (d) and (e) of this section, to determine Maryland adjusted gross income, if, on the last day of the taxable year, a resident is at least 65 years old or is totally disabled or the resident’s spouse is totally disabled, or the resident is 55 years old and is a retired forest ranger, park ranger, or wildlife ranger of the United States, the State, or a political subdivision of the State, an amount is subtracted from federal adjusted gross income equal to the lesser of:',
    }, {
      kind: 'statute',
      citation: 'Md. Tax-General 10-209(b)(1)–(2)',
      url: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtg&section=10-209&enactments=false',
      quotedText:
        '(1) the cumulative or total annuity, pension, or endowment income from an employee retirement system included in federal adjusted gross income; or (2) the maximum annual benefit under the Social Security Act computed under subsection (c) of this section, less any payment received as old age, survivors, or disability benefits under the Social Security Act, the Railroad Retirement Act, or both.',
    }, {
      kind: 'statute',
      citation: 'Md. Tax-General 10-209(c)',
      url: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtg&section=10-209&enactments=false',
      quotedText:
        'the Comptroller: (1) shall determine the maximum annual benefit under the Social Security Act allowed for an individual who retired at age 65 for the prior calendar year; and (2) may allow the subtraction to the nearest $100.',
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
      'packages/engine/src/params/state/data/year2026.ts#MD',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'ncgs-105-153-5-social-security-exclusion': {
    title: 'North Carolina subtracts Title II Social Security benefits',
    statement:
      'North Carolina\'s other-deductions subdivision lists both benefits received under Title II of the Social Security Act and amounts received from retirement annuities or pensions paid under the Railroad Retirement Act of 1937. The pack\'s `taxesSocialSecurity: false` implements the Title II Social Security limb; Railroad Retirement has no separate input field, and this record does not extend the quoted provision to North Carolina\'s separate retirement-income rules.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:NC',
    authority: [{
      kind: 'statute',
      citation: 'N.C. Gen. Stat. §105-153.5(b)(3)',
      url: 'https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_105/GS_105-153.5.html',
      quotedText:
        '(b) Other Deductions. - In calculating North Carolina taxable income, a taxpayer may deduct from the taxpayer\'s adjusted gross income any of the following items that are included in the taxpayer\'s adjusted gross income: ... (3) Benefits received under Title II of the Social Security Act and amounts received from retirement annuities or pensions paid under the provisions of the Railroad Retirement Act of 1937.',
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
      'packages/engine/src/params/state/data/year2026.ts#NC',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'va-code-58-1-322-03-age-deduction-and-social-security': {
    title: 'Virginia phases the age-65 deduction out against adjusted federal AGI',
    statement:
      'Virginia grants an age-65 deduction of $12,000, but reduces it dollar-for-dollar when adjusted federal AGI exceeds $50,000 for a single taxpayer or $75,000 for a married taxpayer, with a combined-AGI rule for married-separate returns. The statute defines adjusted federal AGI by subtracting Title II Social Security benefits and other benefits taxable solely under Internal Revenue Code section 86. The pack maps the $12,000 amount to a retirement-income cap and does not carry the phase-out or the wage-only age deduction, so exposure can run in both directions: high-income retirees receive a deduction the statute has phased away, while low-income age-65 filers with no modeled retirement distribution receive none.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale: null,
    jurisdiction: 'state:VA',
    authority: [{
      kind: 'statute',
      citation: 'Va. Code §58.1-322.03(5)',
      url: 'https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.03/',
      quotedText:
        '5. a. A deduction in the amount of $ 12,000 for individuals born on or before January 1, 1939. b. A deduction in the amount of $ 12,000 for individuals born after January 1, 1939, who have attained the age of 65. This deduction shall be reduced by $ 1 for every $ 1 that the taxpayer\'s adjusted federal adjusted gross income exceeds $ 50,000 for single taxpayers or $ 75,000 for married taxpayers. For married taxpayers filing separately, the deduction shall be reduced by $ 1 for every $ 1 that the total combined adjusted federal adjusted gross income of both spouses exceeds $ 75,000. For the purposes of this subdivision, "adjusted federal adjusted gross income" means federal adjusted gross income minus any benefits received under Title II of the Social Security Act and other benefits subject to federal income taxation solely pursuant to § 86 of the Internal Revenue Code, as amended.',
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
      'packages/engine/src/params/state/data/year2026.ts#VA',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'va-railroad-retirement-and-unemployment-benefits-not-modeled': {
    title: 'Virginia subtracts Tier 2 and other railroad benefits included in federal AGI; the engine cannot certify benefit type',
    statement:
      'Virginia Department of Taxation guidance on Tier 2 and other Railroad Retirement and Railroad Unemployment Benefits states that federal and Virginia law exempt Tier 2 vested dual benefits, as well as certain other Railroad Retirement Act benefits and Railroad Unemployment Insurance benefits from income tax, and that the subtraction is the benefit amount included in federal adjusted gross income as a taxable pension or annuity that was not already deducted on the federal return. Social Security and Tier 1 Railroad Retirement benefits taxed under IRC section 86 are a separate subtraction limb; the age deduction registered at `va-code-58-1-322-03-age-deduction-and-social-security` references adjusted federal AGI reduced by those benefits but does not reach Tier 2 or Railroad Unemployment. Out of scope: `incomeStreamSchema` has no railroad-retirement type, `pensionSchema` carries only a private-or-public `source` enum, and `StateTaxParams` / `StateRetirementExclusion` carry no railroad-benefit type or federal-deduction facts — so no accepted ordinary, wages, public or private pension, or `ssBenefits` input can identify qualifying Tier 2, vested dual, other Railroad Retirement Act, or Railroad Unemployment Insurance dollars or federal-AGI inclusion not already deducted federally. Generic amounts entered through those channels are still priced under the pack\'s existing rules; the engine emits no law-specific refusal for this limb.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
        'Tier 2, vested dual, other Railroad Retirement Act, or Railroad Unemployment Insurance benefits included in federal adjusted gross income as a taxable pension or annuity not already deducted on the federal return: incomeStreamSchema has no railroad-retirement type',
        'railroad benefit type or federal-AGI inclusion and federal-deduction status on pensionSchema, whose `source` enum is only private or public',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:VA',
    authority: [{
      kind: 'stateAgencyPublication',
      citation: 'Virginia Department of Taxation, Subtractions — Social Security Act and Equivalent Tier 1 Railroad Retirement Act Benefits',
      url: 'https://www.tax.virginia.gov/subtractions',
      quotedText:
        'Virginia law exempts Social Security and Tier 1 Railroad Retirement benefits from taxation. If you were required to include any of your benefits in federal adjusted gross income, subtract that amount on your Virginia return. Do not include Tier 2 Railroad Retirement Benefits and Other Railroad Retirement and Railroad Unemployment Benefits. For subtracting other benefits, see Tier 2 and other Railroad Retirement and Railroad Unemployment Benefits.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Virginia Department of Taxation, Subtractions — Tier 2 and other Railroad Retirement and Railroad Unemployment Benefits',
      url: 'https://www.tax.virginia.gov/subtractions',
      quotedText:
        'Federal and Virginia law exempt Tier 2 vested dual benefits, as well as certain other Railroad Retirement Act benefits and Railroad Unemployment Insurance benefits from income tax. The amount to be subtracted is the benefit amount that was included in federal adjusted gross income as a taxable pension or annuity, and that was not already deducted on your federal return.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
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
} satisfies Record<string, TaxRuleRecord>
