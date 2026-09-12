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

  'sc-code-12-6-1120-4-social-security-subtraction': {
    title: 'South Carolina determines gross income without Internal Revenue Code section 86 for Social Security',
    statement:
      'South Carolina gross income is determined without application of Internal Revenue Code section 86. That is what `taxesSocialSecurity: false` encodes for the Social Security limb only: federally included Social Security never reaches the South Carolina base. Railroad Retirement Act annuity provenance is outside this record and is registered separately at `sc-45-usc-231m-railroad-annuities-not-modeled`; the 2025 return-instruction limb at `sc-form1040-line-o-railroad-benefits-not-modeled`, the retirement deduction at `sc-code-12-6-1170-retirement-income-deduction`, and Guard or Reserve pay at `sc-code-12-6-1120-7-reserve-national-guard-pay-not-modeled` are separate limbs as well.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:SC',
    authority: [{
      kind: 'statute',
      citation: 'S.C. Code 12-6-1120(4)',
      url: 'https://www.scstatehouse.gov/code/t12c006.php',
      quotedText:
        '(4) South Carolina gross income is determined without application of Internal Revenue Code Sections 78 (Gross-up of Dividends received from Certain Foreign Corporations), 86 (Social Security and Tier 1 Railroad Retirement Benefits), and 87 (Alcohol Fuel Credit).',
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
      'packages/engine/src/params/state/data/year2026.ts#states.SC',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'sc-45-usc-231m-railroad-annuities-not-modeled': {
    title: '45 U.S.C. 231m exempts Railroad Retirement Act annuities from state income tax; the engine cannot certify annuity category or federally included amount',
    statement:
      'Section 231m(a) of title 45 prohibits state income tax on any annuity or supplemental annuity except as provided in subsection (b) and the Internal Revenue Code — a federal exemption that reaches South Carolina to the extent qualifying Railroad Retirement Act annuity or supplemental-annuity amounts would otherwise enter the state base. Subsection (b)(1) preserves federal income taxation of supplemental annuities under section 231a(b), so federal and state treatment can diverge for that limb. S.C. Code §12-6-1120(4) independently supplies the state-law counterpart for IRC section 86 Social Security and Tier 1 Railroad Retirement benefits; the companion settled record certifies only Title 2 Social Security, while Tier 1 railroad identification remains within this record’s missing-input boundary. The broader Railroad Retirement Act annuity exemption registered here rests on 45 U.S.C. 231m, not on South Carolina paragraph (4) alone. This record covers RRA annuities and supplemental annuities only; it does not reach every payment issued by the Railroad Retirement Board, private railroad-employer pensions, or unemployment or sickness benefits. That limb is separate from the Social Security subtraction registered at `sc-code-12-6-1120-4-social-security-subtraction`, which settles only Internal Revenue Code section 86 for Title 2 Social Security, and from the 2025 return-instruction limb at `sc-form1040-line-o-railroad-benefits-not-modeled`, which quotes broader tax-year-2025 SC1040 line o wording without fixing a post-2025 form window. Out of scope: `incomeStreamSchema` has no railroad-retirement type, `pensionSchema.source` is only `private` or `public`, and `StateTaxParams` carries no RRA annuity or supplemental-annuity qualification, Railroad Retirement Board payer or category, or separately identifiable federally included RRA benefit amount — so no accepted `socialSecurity`, wages, pension, or generic ordinary income input can identify qualifying 231m annuity dollars. Generic amounts entered through those channels are still priced under the pack\'s existing rules; the engine emits no law-specific refusal for this limb. `effectiveFrom: 2026` marks the first observed and supported modeling window for this statutory limb, not an assertion that section 231m began in 2026.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
        'RRA annuity or supplemental-annuity qualification and payer/category distinct from ordinary private/public pension and Social Security streams: incomeStreamSchema has no railroad-retirement type and pensionSchema.source is only private or public',
        'separately identifiable federally included RRA benefit amount otherwise entering the state base on StateTaxParams, which carries only the `taxesSocialSecurity` boolean and no railroad-benefit classification',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:SC',
    authority: [{
      kind: 'statute',
      citation: '45 U.S.C. 231m(a)',
      url: 'https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title45-section231m',
      quotedText:
        '(a) Except as provided in subsection (b) of this section and the Internal Revenue Code of 1986 [26 U.S.C. 1 et seq.], notwithstanding any other law of the United States, or of any State, territory, or the District of Columbia, no annuity or supplemental annuity shall be assignable or be subject to any tax or to garnishment, attachment, or other legal process under any circumstances whatsoever, nor shall the payment thereof be anticipated',
    }, {
      kind: 'statute',
      citation: '45 U.S.C. 231m(b)(1)',
      url: 'https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title45-section231m',
      quotedText:
        '(b)(1) This section shall not operate to exclude the amount of any supplemental annuity paid to an individual under section 231a(b) of this title from income taxable pursuant to the Federal income tax provisions of the Internal Revenue Code of 1986 [26 U.S.C. 1 et seq.].',
    }, {
      kind: 'statute',
      citation: 'S.C. Code 12-6-1120(4)',
      url: 'https://www.scstatehouse.gov/code/t12c006.php',
      quotedText:
        '(4) South Carolina gross income is determined without application of Internal Revenue Code Sections 78 (Gross-up of Dividends received from Certain Foreign Corporations), 86 (Social Security and Tier 1 Railroad Retirement Benefits), and 87 (Alcohol Fuel Credit).',
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

  'sc-form1040-line-o-railroad-benefits-not-modeled': {
    title: 'South Carolina’s 2025 SC1040 line o reaches federally taxed railroad retirement; the engine cannot certify payer or category',
    statement:
      'The 2025 South Carolina Form SC1040 instructions direct taxpayers to enter on line o the amount of Social Security from Title 2 of the Social Security Act or railroad retirement that was taxed on the federal return. That form line is a different limb from the Social Security subtraction registered at `sc-code-12-6-1120-4-social-security-subtraction`, which rests on section 12-6-1120(4) and the pack\'s `taxesSocialSecurity: false` carrier rather than on line o, and from the current Railroad Retirement Act annuity exemption registered at `sc-45-usc-231m-railroad-annuities-not-modeled`, which rests on 45 U.S.C. 231m rather than on return-instruction wording. This record quotes tax year 2025 form instructions only — broader line o language that reaches Social Security and railroad retirement taxed federally in one entry — and does not extend that line to later years without a later source; its `effectiveFrom`/`effectiveThrough` window is 2025 only. Out of scope: `incomeStreamSchema` has no railroad-retirement type, `pensionSchema.source` is only `private` or `public`, and `StateTaxParams` carries no Railroad Retirement Board payer, Title 2 versus railroad category, or federal-taxability facts — so no accepted `socialSecurity`, wages, pension, or generic ordinary income input can identify qualifying line o railroad retirement. Generic amounts entered through those channels are still priced under the pack\'s existing rules; the engine emits no law-specific refusal for this limb.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
        'railroad retirement benefits taxed on the federal return, as distinct from Title 2 Social Security benefits taxed on the federal return: incomeStreamSchema has no railroad-retirement type',
        'Railroad Retirement Board payer or railroad benefit category on pensionSchema, whose `source` enum is only private or public',
        'federal return inclusion status for railroad retirement on StateTaxParams, which carries only the `taxesSocialSecurity` boolean and no railroad-benefit classification',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:SC',
    authority: [{
      kind: 'formInstruction',
      citation: 'South Carolina Department of Revenue, 2025 Form SC1040 instructions, line o',
      url: 'https://dor.sc.gov/sites/dor/files/forms/SC1040Instr_2025.pdf',
      quotedText:
        '2025 Individual Income Tax Instructions ... Line o: Social Security and/or railroad retirement if taxed on your federal return Enter the amount of Social Security from Title 2 of the Social Security Act or railroad retirement that was taxed on your federal return.',
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

  "sc-code-12-6-1170-retirement-income-deduction": {
    "title": "South Carolina ordinary retirement deduction has owner, age and penalty gates",
    "statement": "An original account owner may deduct up to $3,000 of qualifying included retirement income, increasing to $10,000 in the year the owner turns 65. Premature-penalty distributions do not qualify. Surviving-spouse income attributable to the decedent retains its separate statutory treatment. Ordinary nonmilitary public income belongs in this capped pool, not the full military exclusion. Legacy aggregate classification remains approximate when source and penalty facts are unavailable.",
    "classification": "approximated",
    "contraryReading": null,
    "errorDirection": "bothDirections",
    "conventionRationale": null,
    "jurisdiction": "state:SC",
    "authority": [
      {
        "kind": "statute",
        "citation": "S.C. Code §12-6-1170(A)(1)-(4)",
        "url": "https://www.scstatehouse.gov/code/t12c006.php",
        "quotedText": "(A)(1) An individual taxpayer who is the original owner of a qualified retirement account is allowed an annual deduction from South Carolina taxable income of not more than three thousand dollars of retirement income received. Beginning in the year in which the taxpayer reaches age sixty-five, the taxpayer may deduct not more than ten thousand dollars of retirement income that is included in South Carolina taxable income. (2) The term \"retirement income\", as used in this subsection, means the total of all otherwise taxable income not subject to a penalty for premature distribution received by the taxpayer or the taxpayer's surviving spouse in a taxable year from qualified retirement plans which include those plans defined in Internal Revenue Code Sections 401, 403, 408, and 457, and all public employee retirement plans of the federal, state, and local governments, including military retirement. (3) A surviving spouse receiving retirement income that is attributable to the deceased spouse shall apply this deduction in the same manner that the deduction applied to the deceased spouse. If the surviving spouse also has another retirement income, an additional retirement exclusion is allowed."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#SC",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult"
    ]
  },

  "sc-code-12-6-1171-military-retirement": {
    "title": "South Carolina fully deducts qualifying military retirement",
    "statement": "Qualifying included military retirement and qualifying military survivor benefits are deductible in full under §1171. Ordinary public pensions are not military retirement. Premature-distribution and survivor definitions remain operative. Inactive-duty National Guard/reserve compensation under §1120(7) is a separate rule and is not silently treated as military retirement.",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:SC",
    "authority": [
      {
        "kind": "statute",
        "citation": "S.C. Code §12-6-1171(A)-(D)",
        "url": "https://www.scstatehouse.gov/code/t12c006.php",
        "quotedText": "(A) An individual taxpayer may deduct all military retirement income that is included in South Carolina taxable income. (B) The term \"retirement income\", as used in this section, means the total of all otherwise taxable income not subject to a penalty for premature distribution received by the taxpayer or the taxpayer's surviving spouse in a taxable year from a qualified military retirement plan. For purposes of a surviving spouse, \"retirement income\" also includes a retirement benefit plan and dependent indemnity compensation related to the deceased spouse's military service. (C) A surviving spouse receiving military retirement income that is attributable to the deceased spouse shall apply this deduction in the same manner that the deduction applied to the deceased spouse. If the surviving spouse also has another retirement income, an additional retirement exclusion is allowed."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#SC",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult"
    ]
  },

  "sc-code-12-6-1170-b-age-65-deduction": {
    "title": "South Carolina age-65 deduction follows each owner’s retirement deductions",
    "statement": "Beginning in the year a resident reaches 65, up to $15,000 of that owner’s remaining South Carolina income is deductible. Reduce the limit by that owner’s §1170(A) and §1171 deductions, except deductions claimed as a surviving spouse. Two eligible spouses have separate $15,000 limits; one owner cannot consume the other’s remaining income. Unknown owner-attributed remaining income produces incomplete results.",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:SC",
    "authority": [
      {
        "kind": "statute",
        "citation": "S.C. Code §12-6-1170(B)-(C)",
        "url": "https://www.scstatehouse.gov/code/t12c006.php",
        "quotedText": "Beginning for the taxable year during which a resident individual taxpayer attains the age of sixty-five years, the resident individual taxpayer is allowed a deduction from South Carolina taxable income received in an amount not to exceed fifteen thousand dollars reduced by any amount the taxpayer deducts pursuant to subsection (A) not including amounts deducted as a surviving spouse. If married taxpayers eligible for this deduction file a joint federal income tax return, then the maximum deduction allowed is fifteen thousand dollars in the case when only one spouse has attained the age of sixty-five years and thirty thousand dollars when both spouses have attained such age. … Notwithstanding any other provision of this section, if a taxpayer claims a deduction pursuant to Section 12-6-1171, then the deduction allowed by this section must be reduced by the amount the taxpayer deducts pursuant to Section 12-6-1171; however, this subsection does not apply if the deduction claimed pursuant to Section 12-6-1171 is claimed by a surviving spouse."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#SC",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult"
    ]
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

  "de-code-30-1106-social-security-retirement-subtractions": {
    "title": "Delaware pension exclusions distinguish age, source and tax year",
    "statement": "For TY2026, each recipient under 60 takes the greater of qualifying ordinary pension capped at $2,000 or U.S. military pension capped at $12,500; the two amounts are not added. At 60 or older, the $12,500 pension/eligible-retirement-income cap applies separately to each owner. Source, age, and early-distribution facts must establish eligibility. SB219 (85 Del. Laws ch.426), signed August 17, 2026, increases future military tiers beginning in 2027; it does not increase the 2026 cap. The broad aggregate retirement path remains an approximation of qualifying source and owner allocation.",
    "classification": "approximated",
    "contraryReading": null,
    "errorDirection": "bothDirections",
    "conventionRationale": null,
    "jurisdiction": "state:DE",
    "authority": [
      {
        "kind": "statute",
        "citation": "30 Del. C. §1106(b)(3)b-c",
        "url": "https://delcode.delaware.gov/title30/c011/sc02/index.html",
        "quotedText": "For persons age 60 or older, amounts received, not to exceed $12,500, as pensions from employers, the United States, this State, or any subdivision of this State, or as eligible retirement income. … Amounts received, not to exceed $2,000, as pensions from employers, the United States, this State, or any subdivision of this State; or … Amounts received, not to exceed $12,500, as a United States military pension."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts",
      "packages/engine/src/tax/stateNortheastExtras.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#DE",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult",
      "packages/engine/src/tax/stateNortheastExtras.ts#delawareUnder60PensionDeduction"
    ]
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
      'Maryland adjusted gross income subtracts a payment received under Title II of the Social Security Act or as a benefit under the Railroad Retirement Act, to the extent the payment was included in federal adjusted gross income. That is what `taxesSocialSecurity: false` encodes: no federally taxable Social Security survives into the Maryland base. The $40,600 pension exclusion the pack also carries is not in this section — §10-207(mm) points at §10-209 for "employee retirement system" — and is registered separately at md-tax-10-209-pension-exclusion.',
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

  "md-tax-10-209-pension-exclusion": {
    "title": "Maryland TY2026 pension maximum is $40,600 before the benefit offset",
    "statement": "For TY2026 the published maximum is $40,600 per qualifying recipient. Section 10-209 permits the lesser of included qualifying employee-plan income and the maximum less all Social Security/Railroad Retirement benefits received, including nontaxable benefits. IRAs, Roth IRAs, rollover IRAs, SEPs and ineligible deferred compensation do not qualify. Age 65, total disability, or a totally disabled spouse supplies the ordinary eligibility gate. The current coarse cap does not establish source eligibility, disability or the recipient-specific gross-benefit offset and remains approximated; $50,000 qualifying pension and $20,000 benefits require $20,600, not $40,600.",
    "classification": "approximated",
    "contraryReading": null,
    "errorDirection": "understatesTax",
    "conventionRationale": null,
    "jurisdiction": "state:MD",
    "authority": [
      {
        "kind": "stateAgencyPublication",
        "citation": "Maryland Comptroller, Pension Exclusion, calendar 2026 maximum",
        "url": "https://services.marylandcomptroller.gov/taxes/en/maryland-pension-exclusion?id=kb_article_view&sysparm_article=KB0010012",
        "quotedText": "For calendar year 2025. For calendar year 2026, the maximum pension exclusion is $40,600."
      },
      {
        "kind": "statute",
        "citation": "Md. Tax-General §10-209(a)-(e)",
        "url": "https://mgaleg.maryland.gov/2026RS/Statute_Web/gtg/10-209.pdf",
        "quotedText": "(a) In this section: (1) “employee retirement system” means a plan: (i) established and maintained by an employer for the benefit of its employees; and (ii) qualified under § 401(a), § 403, or § 457(b) of the Internal Revenue Code; and (2) “employee retirement system” does not include: (i) an individual retirement account or annuity under § 408 of the Internal Revenue Code; (ii) a Roth individual retirement account under § 408A of the Internal Revenue Code; (iii) a rollover individual retirement account; (iv) a simplified employee pension under Internal Revenue Code § 408(k); or (v) an ineligible deferred compensation plan under § 457(f) of the Internal Revenue Code. (b) Subject to subsections (d) and (e) of this section, to determine Maryland adjusted gross income, if, on the last day of the taxable year, a resident is at least 65 years old or is totally disabled or the resident’s spouse is totally disabled, or the resident is 55 years old and is a retired forest ranger, park ranger, or wildlife ranger of the United States, the State, or a political subdivision of the State, an amount is subtracted from federal adjusted gross income equal to the lesser of: (1) the cumulative or total annuity, pension, or endowment income from an employee retirement system included in federal adjusted gross income; or (2) the maximum annual benefit under the Social Security Act computed under subsection (c) of this section, less any payment received as old age, … survivors, or disability benefits under the Social Security Act, the Railroad Retirement Act, or both. (c) For purposes of subsection (b)(2) of this section, the Comptroller: (1) shall determine the maximum annual benefit under the Social Security Act allowed for an individual who retired at age 65 for the prior calendar year; and (2) may allow the subtraction to the nearest $100. (d) (1) Military retirement income that is included in the subtraction under § 10–207(q) of this subtitle may not be taken into account for purposes of the subtraction under this section. (2) Public safety employee retirement income that is included in the subtraction under § 10–207(mm) of this subtitle may not be taken into account for purposes of the subtraction under this section. (e) In the case of a retired forest ranger, park ranger, or wildlife ranger of the United States, the State, or a political subdivision of the State, the amount included under subsection (b)(1) of this section is limited to the first $15,000 of retirement income that is attributable to the resident’s employment as a forest ranger, park ranger, or wildlife ranger of the United States, the State, or a political subdivision of the State unless: (1) the resident is at least 65 years old or is totally disabled; or (2) the resident’s spouse is totally disabled."
      }
    ],
    "volatility": "annuallyIndexed",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#MD",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult"
    ]
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

  'ncgs-105-153-7-2026-flat-rate-and-standard-deduction': {
    title: 'North Carolina taxes TY2026 ordinary income at 3.99% after supported single/MFJ standard deductions',
    statement:
      'For taxable years beginning after calendar 2025, N.C. Gen. Stat. §105-153.7(a) imposes a flat 3.99% tax on North Carolina taxable income. Section 105-153.7(a1)\'s revenue-trigger rate reductions apply only from taxable years beginning in 2027 onward and are outside this record. Section 105-153.5(a)(1) sets fixed standard-deduction amounts by filing status: $12,750 single and $25,500 married filing jointly/surviving spouse. The statute has no annual indexing formula; NCDOR\'s 2026 NC-40 worksheet republishes the same cells under a "For Tax Years Beginning on or after January 1, 2026" footer. The pack stores those deduction cells and a single 3.99% bracket for both supported filing statuses. North Carolina does not import the federal age-65 standard-deduction addition; the state amount is filing-status based only. Settled only for that TY2026 flat ordinary rate and supported single/MFJ standard-deduction mapping; head-of-household, married-filing-separate, itemization, child-deduction schedules, Bailey and military limbs, and whole-return accuracy are outside this record. The record is bounded to TY2026 even though the current statutory table continues until amended.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:NC',
    authority: [{
      kind: 'statute',
      citation: 'N.C. Gen. Stat. §105-153.7(a)',
      url: 'https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_105/GS_105-153.7.html',
      quotedText:
        'Except as otherwise provided in subsection (a1) of this section, the tax is a percentage of the taxpayer\'s North Carolina taxable income computed as follows:',
    }, {
      kind: 'statute',
      citation: 'N.C. Gen. Stat. §105-153.7(a), TY2026 flat rate',
      url: 'https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_105/GS_105-153.7.html',
      quotedText:
        'Taxable Years Beginning	Tax\nIn 2022	4.99%\nIn 2023	4.75%\nIn 2024	4.5%\nIn 2025	4.25%\nAfter 2025	3.99%.',
    }, {
      kind: 'statute',
      citation: 'N.C. Gen. Stat. §105-153.7(a1) (trigger scope)',
      url: 'https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_105/GS_105-153.7.html',
      quotedText:
        'Notwithstanding the tax rates set out in subsection (a) of this section, if total General Fund revenue in a fiscal year set out below exceeds the trigger amount indicated for that fiscal year, then the applicable tax rate for the indicated and subsequent tax years shall be equal to the greater of (i) the prior taxable year\'s rate decreased by one-half percentage point (0.50%) or (ii) two and forty-nine hundredths percent (2.49%). For purposes of this subsection, total General Fund revenue is the amount stated in the final accounting of total General Fund Reverting Net Tax and Non-Tax Revenues for the fiscal year, as reported by the Office of State Controller in August following the end of the fiscal year.\nFiscal Year	Trigger Amount	Taxable Year Beginning\nFY 2025-2026	$33,042,000,000	In 2027',
    }, {
      kind: 'statute',
      citation: 'N.C. Gen. Stat. §105-153.5(a)(1), standard deduction table',
      url: 'https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_105/GS_105-153.5.html',
      quotedText:
        'The standard deduction amount is zero for a person who is not eligible for a standard deduction under section 63 of the Code. For all other taxpayers, the standard deduction amount is equal to the amount listed in the table below based on the taxpayer\'s filing status: … Filing Status Standard Deduction Married, filing jointly/surviving spouse $25,500 Head of Household 19,125 Single 12,750 Married, filing separately 12,750.',
    }, {
      kind: 'formInstruction',
      citation: 'North Carolina DOR, Form NC-40 2026, worksheet Line 6 standard deduction instruction',
      url: 'https://www.ncdor.gov/individual-estimated-income-tax/open',
      quotedText:
        'If you plan to claim the N.C. standard deduction, use the amount shown below for your filing status.',
    }, {
      kind: 'formInstruction',
      citation: 'North Carolina DOR, Form NC-40 2026, worksheet page 2 standard deduction table',
      url: 'https://www.ncdor.gov/individual-estimated-income-tax/open',
      quotedText:
        'If you plan to claim the N.C. standard deduction, use the amount shown below for your filing status. … Married, filing jointly/surviving spouse $ 25,500 … Single $ 12,750 … For Tax Years Beginning on or after January 1, 2026',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-09-12',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#NC',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#bracketTax',
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
  "de-early-distribution-gate": {
    "title": "Delaware early-distribution gate applies before pension exclusions",
    "statement": "An early distribution with Form 1099-R Box 7 code 1 or a federal premature-distribution penalty does not qualify for the pension exclusion, including the age-60-plus branch. Unknown classification is incomplete, not eligibility. The latest final TY2025 instructions are carried forward for TY2026 because enacted SB219 does not change this classification; final TY2026 instructions must be checked when published.",
    "classification": "unsettled",
    "contraryReading": "Final TY2026 administrative instructions may clarify or revise the carried-forward classification.",
    "errorDirection": null,
    "conventionRationale": "Use the latest final administrative classification without treating future instructions as published.",
    "jurisdiction": "state:DE",
    "authority": [
      {
        "kind": "formInstruction",
        "citation": "2025 PIT-RES instructions, p.6, Line 6 pension exclusion",
        "url": "https://revenuefiles.delaware.gov/2025/PITForms_Instructions/Instructions/PIT-RES_Instructions_2025-01.pdf",
        "quotedText": "An early distribution from an IRA or pension fund for emergency reasons or following a separation from employment does not qualify for the pension exclusion. If the distribution code listed in Box 7 of your 1099 R is a 1 (one), or if you were assessed an early withdrawal penalty on federal 1040, Schedule 2, Line 8 for the distribution, then that distribution DOES NOT qualify for the pension exclusion."
      }
    ],
    "volatility": "awaitingGuidance",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts",
      "packages/engine/src/tax/stateNortheastExtras.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#DE",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult",
      "packages/engine/src/tax/stateNortheastExtras.ts#delawareUnder60PensionDeduction"
    ]
  },

  "dc-code-47-1803-03-government-survivor-exclusion": {
    "title": "District government survivor exclusion remains after the old pension exclusion expires",
    "statement": "Section 47-1803.02(a)(2)(N)(ii) excludes District or federal government survivor benefits received by a person age 62 or older at year end. It is separate from the $3,000 government-pension provision in (N)(i), which applies only before 2015. The eligible amount must be included in the federal base; ordinary pensions, nonqualifying issuers, Social Security survivor benefits and unknown issuer/age cannot establish this subtraction.",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:DC",
    "authority": [
      {
        "kind": "statute",
        "citation": "D.C. Code §47-1803.02(a)(2)(N)(ii)",
        "url": "https://code.dccouncil.gov/us/dc/council/code/sections/47-1803.02",
        "quotedText": "Survivor benefits received from the District of Columbia or the federal government by persons who are 62 years of age or older by the end of the taxable year."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts",
      "packages/engine/src/tax/stateNortheastExtras.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#DC",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult",
      "packages/engine/src/tax/stateNortheastExtras.ts#dcGovernmentSurvivorExclusion"
    ]
  },

  "sc-sciad-act-110-retirement-income-deduction": {
    "title": "South Carolina SCIAD replaces the federal deduction for TY2026",
    "statement": "Act 110 establishes SCIAD of $15,000 single/MFS, $22,500 HOH, and $30,000 joint/surviving spouse. The phaseout uses federal AGI and status-specific start/width values in the 2026 pack, with zero deduction at or beyond the endpoint. It is a general return deduction, not a pension-only allowance. The rate schedule and SCIAD first apply after 2025.",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:SC",
    "authority": [
      {
        "kind": "statute",
        "citation": "2026 Act 110, H.4216, SCIAD and effective date",
        "url": "https://www.scstatehouse.gov/sess126_2025-2026/bills/4216.htm",
        "quotedText": "a South Carolina Income Adjusted Deduction (SCIAD) equal to: (i) fifteen thousand dollars for taxpayers who file as single or married filing separately; (ii) twenty-two thousand five hundred dollars for taxpayers who file as head of household; and (iii) thirty thousand dollars for taxpayers who file as married filing jointly or as a surviving spouse. … The deduction set forth in subitem (a)(i) is subject to being reduced by a fraction whereby the numerator is the amount the taxpayer's federal adjusted gross income exceeds forty thousand dollars and the denominator is fifty-five thousand. … If the fraction calculated by this subitem is equal to or exceeds one, then the deduction is not allowed. If the fraction is zero, then the deduction is not subject to being reduced. If the fraction is between zero and one, then the deduction must be reduced by the corresponding fraction. … This act takes effect upon approval by the Governor and first applies to tax years beginning after 2025."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#SC",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult"
    ]
  },

  "va-code-58-1-322-02-28-military-retirement-subtraction": {
    "title": "Virginia military subtraction is $40,000 per recipient from TY2025",
    "statement": "Section 58.1-322.02(18)(c) permits up to $40,000 of qualifying military benefits for TY2025 and later, at any age. Qualifying survivor benefits are included. OPM civil-service income and amounts already excluded or deducted under another provision do not enter this pool. Each recipient has a separate cap. The stable record ID retains its earlier suffix; the operative current paragraph is (18), not (28).",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:VA",
    "authority": [
      {
        "kind": "statute",
        "citation": "Va. Code §58.1-322.02(18)(c)",
        "url": "https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.02/",
        "quotedText": "For taxable years beginning on and after January 1, 2024, but before January 1, 2025, up to $30,000 of military benefits; and for taxable years beginning on and after January 1, 2025, up to $40,000 of military benefits. … For purposes of subdivisions b and c, \"military benefits\" means any (i) military retirement income received for service in the Armed Forces of the United States, (ii) qualified military benefits received pursuant to § 134 of the Internal Revenue Code, (iii) benefits paid to the surviving spouse of a veteran of the Armed Forces of the United States under the Survivor Benefit Plan program established by the U.S. Department of Defense, and (iv) military benefits paid to the surviving spouse of a veteran of the Armed Forces of the United States. The subtraction allowed by subdivision b shall be allowed only for military benefits received by an individual age 55 or older. The subtraction allowed by subdivision c shall be allowed for military benefits received by an individual of any age. No subtraction shall be allowed pursuant to subdivisions b and c if a credit, exemption, subtraction, or deduction is claimed for the same income pursuant to subdivision a or any other provision of Virginia or federal law."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts",
      "packages/engine/src/tax/stateWestExtras.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#VA",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult",
      "packages/engine/src/tax/stateWestExtras.ts#virginiaMilitarySubtraction"
    ]
  },

  "va-code-58-1-322-02-3-ss-tier1": {
    "title": "Virginia paragraph (3) subtracts included Social Security and Tier I",
    "statement": "Paragraph (3) subtracts benefits taxable solely under IRC §86, including included Social Security and Tier I Railroad Retirement. Do not subtract Social Security again when already removed from the state base. Tier II and ordinary annuities are outside this paragraph; separate federal-protection authority may govern other railroad benefits.",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:VA",
    "authority": [
      {
        "kind": "statute",
        "citation": "Va. Code §58.1-322.02(3)",
        "url": "https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.02/",
        "quotedText": "Benefits received under Title II of the Social Security Act and other benefits subject to federal income taxation solely pursuant to § 86 of the Internal Revenue Code."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts",
      "packages/engine/src/tax/stateWestExtras.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#VA",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult",
      "packages/engine/src/tax/stateWestExtras.ts#virginiaSsTier1Subtraction"
    ]
  },

  "va-code-58-1-322-02-11-basis": {
    "title": "Virginia recovers contributions previously taxed by another state",
    "statement": "The subtraction covers included distributions from the enumerated §401, §408, §457 and federal retirement arrangements only to the extent contributions were federally deductible but taxed by another state. A Virginia-only contribution history is not sufficient. Require the prior taxing jurisdiction, qualifying plan and remaining unrecovered contribution basis; reduce the basis ledger only by accepted recovery.",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:VA",
    "authority": [
      {
        "kind": "statute",
        "citation": "Va. Code §58.1-322.02(11)",
        "url": "https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.02/",
        "quotedText": "Any income received during the taxable year derived from a qualified pension, profit-sharing, or stock bonus plan as described by § 401 of the Internal Revenue Code, an individual retirement account or annuity established under § 408 of the Internal Revenue Code, a deferred compensation plan as defined by § 457 of the Internal Revenue Code, or any federal government retirement program, the contributions to which were deductible from the taxpayer's federal adjusted gross income, but only to the extent the contributions to such plan or program were subject to taxation under the income tax in another state."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts",
      "packages/engine/src/tax/stateWestExtras.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#VA",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult",
      "packages/engine/src/tax/stateWestExtras.ts#virginiaPriorStateBasisSubtraction"
    ]
  },

  "wv-code-11-21-exemptions-retirement-public-ss": {
    "title": "West Virginia personal and surviving-spouse exemptions",
    "statement": "The personal exemption is $2,000 per qualifying exemption. The $500 alternative applies specifically to the IRC §151(d)(2) dependency reason, not every zero federal exemption. An unremarried surviving spouse receives the additional $2,000 in each of the two tax years after death. Unknown exemption count, zero-exemption reason or survivor conditions cannot establish an allowance. Retirement modifications and historical Social Security have separate records.",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:WV",
    "authority": [
      {
        "kind": "statute",
        "citation": "W. Va. Code §11-21-16(a),(c),(d)",
        "url": "https://code.wvlegislature.gov/11-21-16/",
        "quotedText": "With respect to any taxable year beginning on or after January 1, 1987, said exemption shall be $2,000. … For taxable years beginning after December 31, 1986, a surviving spouse shall be allowed one additional exemption of $2,000 for the two taxable years beginning after the year of death of the deceased spouse."
      },
      {
        "kind": "statute",
        "citation": "W. Va. Code §11-21-16(d)",
        "url": "https://code.wvlegislature.gov/11-21-16/",
        "quotedText": "Notwithstanding any provisions in this section, for taxable years beginning after December 31, 1986, a resident individual whose exemption amount for federal tax purposes is zero by virtue of section 151(d)(2) of the Internal Revenue Code of 1986, shall be allowed a single West Virginia exemption in the amount of $500."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts",
      "packages/engine/src/tax/stateMidwestExtras.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#WV",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult",
      "packages/engine/src/tax/stateMidwestExtras.ts#westVirginiaExemptions"
    ]
  },

  "wv-code-11-21-12-c9-age-disability-residual": {
    "title": "West Virginia $8,000 age/disability modification uses the owner’s residual limit",
    "statement": "An owner age 65 at year end or properly certified permanently and totally disabled may deduct no more than $8,000 of included income less that owner’s modifications under (c)(1),(2),(5),(6),(7),(8). The total cannot exceed remaining included income. Apply the prior-modification ledger per person, not a new household $8,000 allowance. Unknown certification or prior modifications is incomplete.",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:WV",
    "authority": [
      {
        "kind": "statute",
        "citation": "W. Va. Code §11-21-12(c)(9)(i)-(ii)",
        "url": "https://code.wvlegislature.gov/11-21-12/",
        "quotedText": "(9) Federal adjusted gross income in the amount of $8,000 received from any source after December 31, 1986, by any person who has attained the age of 65 on or before the last day of the taxable year, or by any person certified by proper authority as permanently and totally disabled, regardless of age, on or before the last day of the taxable year, to the extent includable in federal adjusted gross income for federal tax purposes: Provided, That if a person has a medical certification from a prior year and he or she is still permanently and totally disabled, a copy of the original certificate is acceptable as proof of disability. A copy of the form filed for the federal disability income tax exclusion is acceptable: Provided, however, That: (i) Where the total modification under subdivisions (1), (2), (5), (6), (7), and (8) of this subsection is $8,000 per person or more, no deduction shall be allowed under this subdivision; and (ii) Where the total modification under subdivisions (1), (2), (5), (6), (7), and (8) of this subsection is less than $8,000 per person, the total modification allowed under this subdivision for all gross income received by that person shall be limited to the difference between $8,000 and the sum of modifications under subdivisions (1), (2), (5), (6), (7), and (8) of this subsection;"
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts",
      "packages/engine/src/tax/stateMidwestExtras.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#WV",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult",
      "packages/engine/src/tax/stateMidwestExtras.ts#westVirginiaAge65Modification"
    ]
  },

  "wv-code-11-21-12-c5-c6-public-retirement": {
    "title": "West Virginia distinguishes the combined $2,000 public bucket from full police/fire exclusions",
    "statement": "PERS, Teachers and qualifying federal retirement systems share a $2,000 limit per recipient; they do not each create a new cap. Named West Virginia police/fire systems have a separate full exclusion. A generic public or federalCivilService label without statutory-system proof does not establish the appropriate bucket.",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:WV",
    "authority": [
      {
        "kind": "statute",
        "citation": "W. Va. Code §11-21-12(c)(5)-(6)",
        "url": "https://code.wvlegislature.gov/11-21-12/",
        "quotedText": "(5) Annuities, retirement allowances, returns of contributions and any other benefit received under the West Virginia Public Employees Retirement System, and the West Virginia State Teachers Retirement System, including any survivorship annuities derived therefrom, to the extent includable in gross income for federal income tax purposes: Provided, That notwithstanding any provisions in this code to the contrary this modification shall be limited to the first $2,000 of benefits received under the West Virginia Public Employees Retirement System, the West Virginia State Teachers Retirement System and, including any survivorship annuities derived therefrom, to the extent includable in gross income for federal income tax purposes for taxable years beginning after December 31, 1986; and the first $2,000 of benefits received under any federal retirement system to which 4 U.S.C. § 111 applies: Provided, however, That the total modification under this paragraph shall not exceed $2,000 per person receiving retirement benefits and this limitation shall apply to all returns or amended returns filed after December 31, 1988; (6) Retirement income received in the form of pensions and annuities after December 31, 1979, under any West Virginia police, West Virginia Firemen’s Retirement System or the West Virginia State Police Death, Disability and Retirement Fund, the West Virginia State Police Retirement System or the West Virginia Deputy Sheriff Retirement System, including any survivorship annuities derived from any of these programs, to the extent includable in gross income for federal income tax purposes;"
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts",
      "packages/engine/src/tax/stateMidwestExtras.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#WV",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult",
      "packages/engine/src/tax/stateMidwestExtras.ts#westVirginiaPublicMilitary"
    ]
  },

  "wv-code-11-21-12-c7-military": {
    "title": "West Virginia qualifying uniformed-services retirement and survivors are fully excluded",
    "statement": "The current military/uniformed-services provisions exclude the included qualifying retirement and survivor amount without the older $20,000 cap. The named military, reserve, Guard, PHS and NOAA source definitions matter; private and unclassified public pensions do not qualify.",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:WV",
    "authority": [
      {
        "kind": "statute",
        "citation": "W. Va. Code §11-21-12(c)(7)(C)",
        "url": "https://code.wvlegislature.gov/11-21-12/",
        "quotedText": "For taxable years beginning after December 31, 2017, military retirement income, including retirement income from the regular Armed Forces, Reserves and National Guard paid by the United States or by this state after December 31, 2017, including any survivorship annuities, to the extent included in federal adjusted gross income for the taxable year. … For taxable years beginning after December 31, 2018, retirement income from the uniformed services, including the Army, Navy, Marines, Air Force, Space Force, Coast Guard, Public Health Service, National Oceanic Atmospheric Administration, reserves, and National Guard, paid by the United States or by this state after December 31, 2018, including any survivorship annuities, to the extent included in federal adjusted gross income for the taxable year."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts",
      "packages/engine/src/tax/stateMidwestExtras.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#WV",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult",
      "packages/engine/src/tax/stateMidwestExtras.ts#westVirginiaPublicMilitary"
    ]
  },

  "wv-code-11-21-12-c12-railroad": {
    "title": "West Virginia subtracts federally protected Tier I income",
    "statement": "Included Tier I Railroad Retirement is protected by (c)(12). Do not subtract gross benefits exceeding the amount in federal AGI or claim a second subtraction for an already removed amount. Ordinary pensions are outside this category.",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:WV",
    "authority": [
      {
        "kind": "statute",
        "citation": "W. Va. Code §11-21-12(c)(12)",
        "url": "https://code.wvlegislature.gov/11-21-12/",
        "quotedText": "Any other income which this state is prohibited from taxing under the laws of the United States including, but not limited to, tier I retirement benefits as defined in Section 86(d)(4) of the Internal Revenue Code."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2026,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#WV",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult"
    ]
  },

  "wv-code-11-21-12-c8-social-security-phase-in": {
    "title": "West Virginia historical Social Security phase-in depends on AGI and year",
    "statement": "At or below $50,000 AGI ($100,000 joint), 100% of federally included Social Security is subtracted since 2022. Above that threshold the subtraction is 35% in 2024, 65% in 2025 and 100% from 2026. The year-specific rule applies only to the federally included amount; the 2026 no-SS-tax base must not subtract it twice. Unsupported historical years must not inherit a guessed percentage.",
    "classification": "settled",
    "contraryReading": null,
    "errorDirection": null,
    "conventionRationale": null,
    "jurisdiction": "state:WV",
    "authority": [
      {
        "kind": "statute",
        "citation": "W. Va. Code §11-21-12(c)(8)(A)-(F)",
        "url": "https://code.wvlegislature.gov/11-21-12/",
        "quotedText": "(A) For taxable years beginning on or after January 1, 2022, 100 percent of the social security benefits received pursuant to Chapter 7 of Title 42 of the United States Code, including, but not limited to, social security benefits paid by the Social Security Administration as Old Age, Survivors and Disability Insurance Benefits as provided in 42 U.S.C. § 401 et. seq. or as Supplemental Security Income for the Aged, Blind, and Disabled as provided in 42 U.S.C. § 1381 et. seq., included in federal adjusted gross income for the taxable year shall be allowed as a decreasing modification from federal adjusted gross income when determining West Virginia taxable income subject to the tax imposed by this article, subject to the limitation in §11-21-12(c)(8)(B) of this code. (B) The deduction allowed by §11-21-12(c)(8)(A) of this code are allowable only when the federal adjusted gross income of a married couple filing a joint return does not exceed $100,000, or $50,000 in the case of a single individual or a married individual filing a separate return. (C) For taxable years beginning on and after January 1, 2024, 35 percent of the amount of social security benefits received pursuant to Chapter 7 of Title 42 of the United States Code, including, but not limited to, social security benefits paid by the Social Security Administration as Old Age, Survivors and Disability Insurance Benefits as provided in 42 U.S.C. § 401 et. seq. or as Supplemental Security Income for the Aged, Blind, and Disabled as provided in 42 U.S.C. § 1381 et. seq., included in federal adjusted gross income for the taxable year shall be allowed as a decreasing modification from federal adjusted gross income when determining West Virginia taxable income subject to the tax imposed by this article, subject to the limitation in §11-21-12(c)(8)(F) of this code. (D) For taxable years beginning on or after January 1, 2025, 65 percent of the social security benefits received pursuant to Chapter 7 of Title 42 of the United States Code, including, but not limited to, social security benefits paid by the Social Security Administration as Old Age, Survivors and Disability Insurance Benefits as provided in 42 U.S.C. § 401 et. seq. or as Supplemental Security Income for the Aged, Blind, and Disabled as provided in 42 U.S.C. § 1381 et. seq., included in federal adjusted gross income for the taxable year shall be allowed as a decreasing modification from federal adjusted gross income when determining West Virginia taxable income subject to the tax imposed by this article, subject to the limitation in §11-21-12(c)(8)(F) of this code. (E) For taxable years beginning on or after January 1, 2026, 100 percent of the social security benefits received pursuant to Chapter 7 of Title 42 of the United States Code, including, but not limited to, social security benefits paid by the Social Security Administration as Old Age, Survivors and Disability Insurance Benefits as provided in 42 U.S.C. § 401 et. seq. or as Supplemental Security Income for the Aged, Blind, and Disabled as provided in 42 U.S.C. 1381 et. seq., included in federal adjusted gross income for the taxable year shall be allowed as a decreasing modification from federal adjusted gross income when determining West Virginia taxable income subject to the tax imposed by this article, subject to the limitation in §11-21-12(c)(8)(F) of this code. (F) The deduction allowed by §11-21-12(c)(8)(C), §11-21-12(c)(8)(D), and §11-21-12(c)(8)(E) of this code are allowable only when the federal adjusted gross income of a married couple filing a joint return exceeds $100,000, or $50,000 in the case of a single individual or a married individual filing a separate return."
      }
    ],
    "volatility": "staticStatute",
    "effectiveFrom": 2022,
    "effectiveThrough": null,
    "verifiedOn": "2026-09-12",
    "implementedBy": [
      "packages/engine/src/tax/stateTax.ts",
      "packages/engine/src/params/state/data/year2026.ts",
      "packages/engine/src/tax/stateMidwestExtras.ts"
    ],
    "implementedByFunctions": [
      "packages/engine/src/params/state/data/year2026.ts#WV",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult",
      "packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult",
      "packages/engine/src/tax/stateMidwestExtras.ts#westVirginiaSocialSecuritySubtraction"
    ]
  },

} satisfies Record<string, TaxRuleRecord>
