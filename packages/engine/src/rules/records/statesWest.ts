/**
 * State records for the West: AK, AZ, CA, CO, HI, ID, MT, NV, NM, OR, UT, WA, WY.
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
export const westStateRecords = {
  'nv-const-10-1-9-no-personal-income-tax': {
    title: 'Nevada may not tax the personal income of a natural person',
    statement:
      'The Nevada Constitution forbids an income tax on the wages OR the personal income of natural persons, reserving to the Legislature only the income or revenue of a business conducted for profit. The bar is not confined to earned income, so a Nevada retiree\'s pension, IRA and 401(k) distributions, Social Security and capital gains are all beyond the state\'s reach. The pack models this as `hasIncomeTax: false`, which makes the whole state base zero rather than exempting income category by category.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:NV',
    authority: [{
      kind: 'statute',
      citation: 'Nev. Const. art. 10, sec. 1(9)',
      url: 'https://www.leg.state.nv.us/const/nvconst.html',
      quotedText:
        'No income tax shall be levied upon the wages or personal income of natural persons. Notwithstanding the foregoing provision, and except as otherwise provided in subsection 1 of this Section, taxes may be levied upon the income or revenue of any business in whatever form it may be conducted for profit in the State.',
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
      'packages/engine/src/params/state/data/year2026.ts#NV',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },
  // ---------------------------------------------------------------------------
  // The remaining no-individual-income-tax states, researched 2026-08-05.
  //
  // Nevada, Texas and Florida were registered in the first state slice above.
  // Alaska, South Dakota, Tennessee and Wyoming are the rest of the seven, and
  // they are here in one block because they share a problem the earlier three
  // did not have: what has to be established is an ABSENCE, and an absence has
  // no operative language. There is no section to quote, because the point is
  // that no section exists.
  //
  // That splits the seven into two grades, and the grade is the most important
  // thing each record below carries:
  //
  //   Constitutional — a prohibition addressed to a natural person's income.
  //   It carries the whole claim by itself, because the legislature CANNOT
  //   levy: the absence is not a policy fact that could change between pack
  //   refreshes. Nevada, Texas and Tennessee (for earned income only).
  //
  //   Statutory absence — no imposition exists in the code. That is a fact
  //   about what is missing, so the record rests on the revenue department's
  //   or the legislature's own affirmative statement of the negative, and the
  //   state is one ordinary session away from changing. South Dakota and
  //   Wyoming, and Tennessee again for everything a retiree actually lives on.
  //
  // Alaska sits between them and closer to the top: 43.20.012(a) is not an
  // absence at all but an express statutory exclusion of individuals from the
  // only income tax Alaska has, which needs no negative inference. What it
  // lacks is permanence.
  //
  // Two of these records quote an authority that appears to CONTRADICT the
  // statement above it. That is deliberate and it is the whole reason the
  // record is trustworthy. South Dakota's constitution expressly EMPOWERS its
  // legislature to tax incomes, and Wyoming's conditions an income tax on a
  // full credit rather than barring one — so a reader who saw only "no income
  // tax" would come away believing both states are locked the way Nevada is.
  // Quoting the provision that runs the other way is what stops that, and what
  // tells the annual re-verification pass which of these five can move.
  // ---------------------------------------------------------------------------

  'ak-stat-43-20-012-a-tax-does-not-apply-to-individuals': {
    title: 'Alaska’s net income tax does not apply to an individual',
    statement:
      'Alaska has one income tax, the Alaska Net Income Tax Act of chapter 43.20, and 43.20.012(a) states in terms that the tax imposed by that chapter does not apply to an individual or to a fiduciary. What the chapter does impose, at 43.20.011(e), falls on the taxable income of every CORPORATION. So no wage, capital gain, Social Security benefit, pension, or IRA or 401(k) distribution of an Alaska individual is subject to Alaska income tax, which is what the pack encodes as `hasIncomeTax: false`. This is a stronger footing than an absence: the exclusion is enumerated, so nobody has to be persuaded that a list of impositions is exhaustive. It is a weaker footing than Nevada\'s or Texas\'s: Alaska has no constitutional bar on an income tax, and a later legislature can amend 43.20.012(a) by simple majority.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:AK',
    authority: [{
      // The print-fetch URL rather than the practitioner one. akleg.gov serves
      // its statutes through an AJAX endpoint: `statutes.asp#43.20.012`
      // resolves in a browser and returns a shell to everything else, so a
      // citation to it could never be checked against the text it claims to
      // quote. This URL is the same publisher serving the same chapter, and it
      // is the one that actually contains the words below.
      kind: 'statute',
      citation: 'Alaska Stat. 43.20.012(a)',
      url: 'https://www.akleg.gov/basis/statutes.asp?media=print&type=fetch&secEnd=43.20.030',
      quotedText:
        'The tax imposed by this chapter does not apply to (1) an individual; (2) a fiduciary;',
    }, {
      // Quoted so the record is not read as "Alaska has no income tax". It has
      // one; individuals are excluded from it. Without this the reader cannot
      // tell whether the exclusion above is the whole chapter or a carve-out
      // from something broader.
      kind: 'statute',
      citation: 'Alaska Stat. 43.20.011(e)',
      url: 'https://www.akleg.gov/basis/statutes.asp?media=print&type=fetch&secEnd=43.20.030',
      quotedText:
        'There is imposed for each taxable year upon the entire taxable income of every corporation derived from sources within the state a tax computed as follows:',
    }],
    volatility: 'staticStatute',
    // Not 1981. The individual tax was dismantled in two steps — 43.20.010 in
    // 1975 and the rate schedules that had moved to 43.20.011(a)-(d) in 1980 —
    // and neither session law is published on akleg.gov in any form. The only
    // evidence of either is the codifier's bracketed note in the current
    // statute, which this record deliberately does not quote: akleg.gov serves
    // latin-1, so the section sign in "[Repealed, § 13 ch 70 SLA 1975.]" cannot
    // survive as text and a quote carrying it could never be verified. A start
    // year inferred from a repeal nobody can read is a guess.
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#AK',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'wy-stat-39-12-101-no-state-or-local-income-tax': {
    title: 'Wyoming levies no income tax, and no local one is possible',
    statement:
      'Wyoming\'s entire statutory income tax chapter is one section, and it imposes nothing. Title 39 chapter 12 consists of 39-12-101 alone, which preempts the field of income, earning and wage-based taxation to the state and forbids every county, city, town and other political subdivision to impose, levy or collect one. So the state-level negative the pack carries as `hasIncomeTax: false` is a statutory absence — the field is simply empty — while the LOCAL negative is affirmative, quotable and stronger: no Wyoming local income tax can exist, whatever rate a caller supplies. Article 15, section 18 of the Wyoming Constitution does not change the first half. It is not a prohibition but a condition on imposition: no income tax without a full credit for the sales, use and ad valorem taxes the same taxpayer paid that year. That is a severe practical deterrent and a legal presupposition that an income tax MAY be imposed, so Wyoming, like South Dakota, is one session away from changing.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:WY',
    authority: [{
      // The whole chapter, quoted in full. The line after it in the title is
      // "CHAPTER 13 - AD VALOREM TAXATION"; the former income tax chapter is
      // printed as "39-7-101. Repealed By Laws 1998, ch. 5, § 4."
      kind: 'statute',
      citation: 'Wyo. Stat. § 39-12-101',
      url: 'https://www.wyoleg.gov/statutes/compress/title39.pdf',
      quotedText:
        'The state of Wyoming does hereby preempt for itself the field of imposing and levying income taxes, earning taxes, or any other form of tax based on wages or other income and no county, city, town or other political subdivision shall have the right to impose, levy or collect such taxes.',
    }, {
      // Quoted for what it is NOT. "No tax shall be imposed upon income
      // WITHOUT allowing full credit" is a condition, and a reader told only
      // that Wyoming has a constitutional provision about income tax would
      // reasonably assume a bar.
      kind: 'statute',
      citation: 'Wyo. Const. art. 15, § 18',
      url: 'https://sos.wyo.gov/Forms/Publications/WYConstitution.pdf',
      quotedText:
        'No tax shall be imposed upon income without allowing full credit against such tax liability for all sales, use, and ad valorem taxes paid in the taxable year by the same taxpayer to any taxing authority in Wyoming.',
    }],
    volatility: 'staticStatute',
    // The pack year, for South Dakota's reason: no primary source was found
    // establishing when Wyoming last levied an individual income tax or whether
    // it ever did. 39-12-101 states no operative date of its own.
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#WY',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetail',
    ],
  },

  // ---------------------------------------------------------------------------
  // Arizona — 2026-08-05.
  //
  // Two things about these citations, said once.
  //
  // The URL for the rate is load-bearing and counter-intuitive. Laws 2021
  // chapters 411 and 412 both amended A.R.S. 43-1011 and were never blended, so
  // azleg publishes two versions of the section. `/ars/43/01011.htm` — the URL
  // any reasonable citation would reach for — is the chapter 411 version, whose
  // rate table stops at the 2019-2021 graduated schedule and never prints
  // paragraph 9. The 2.5% flat rate is only on `/ars/43/01011.01.htm`. The
  // `.01` is a versioning artifact in the filename; there is no A.R.S.
  // 43-1011.01.
  //
  // And azleg publishes no session-law history for most of Title 43. Only
  // 43-1011's two versions carry a source note, so the effective years on the
  // records below rest on each statute's own "for taxable years beginning from
  // and after" language where it has one, and otherwise on the year the current
  // text is known to have been operative. Where a record would want a
  // `legislativeHistory` authority there is nothing on the host to point at.
  // ---------------------------------------------------------------------------

  'ars-43-1011-a-9-flat-rate': {
    title: 'Arizona taxes individual income at a flat 2.5%',
    statement:
      'A.R.S. 43-1011(A)(9) imposes a single rate of 2.5% on Arizona taxable income, with no graduated bands and no dependence on filing status. The paragraph is conditioned on the revenue notice of 43-243(B)(2); that notice was given, 43-243(D) directs the department to use paragraph 9 from the following taxable year, and 43-243(E) makes the notice a one-time event, so the rate cannot ratchet back. The department has applied 2.5% since tax year 2023 and the 2025 return still computes tax as 2.5% of line 45. The pack carries a single bracket at 2.5% for both filing statuses.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:AZ',
    authority: [{
      kind: 'statute',
      citation: 'A.R.S. 43-1011(A)(9)',
      url: 'https://www.azleg.gov/ars/43/01011.01.htm',
      quotedText:
        'Subject to subsection F of this section, for taxable years beginning from and after December 31 of the year in which notice is provided to the department pursuant to section 43-243, subsection B, paragraph 2, the tax is 2.5% of taxable income.',
    }, {
      kind: 'statute',
      citation: 'A.R.S. 43-243(D)',
      url: 'https://www.azleg.gov/ars/43/00243.htm',
      quotedText:
        'On receipt of the notice required pursuant to subsection B, paragraph 2 of this section, the department shall use the tax rates provided in section 43-1011, subsection A, paragraph 9 for taxable years beginning from and after December 31 of the year in which the notice required pursuant to subsection B, paragraph 2 of this section is received.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Arizona Form 140, line 46',
      url: 'https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140Booklet.pdf',
      quotedText: '46 Tax: Multiply line 45 by 2.5% (.025). Enter the result',
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
      'packages/engine/src/params/state/data/year2026.ts#states.AZ',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetail',
    ],
  },

  'ars-43-1041-standard-deduction-published-amount': {
    title: 'Arizona’s standard deduction is its own amount, indexed in the federal manner',
    statement:
      'A.R.S. 43-1041(A) prescribes Arizona’s own standard deductions, and 43-1041(H) directs the department to adjust those amounts for inflation "in the same manner in which" the federal basic standard deduction is adjusted under IRC 63. That is a borrowed method, not an incorporated amount: no provision of Title 43 says the Arizona deduction equals the federal one, and 43-105(A) excludes from Arizona’s conformity any change to the Code enacted after January 1, 2025. The pack therefore carries Arizona’s published figures — $15,750 single and $31,500 joint for 2025, the most recent the department has published — with NO `standardDeductionConformity` tag, which is also what keeps the federal age-65 additional standard deduction off the Arizona base, since Arizona grants no such addition. Arizona was tagged `federal` until 2026-08-05; the published amounts have in fact equalled the federal basic deduction in every year checked, but that is administrative practice rather than Arizona law, and the tag was importing a federal age-65 amount alongside it.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:AZ',
    authority: [{
      kind: 'statute',
      citation: 'A.R.S. 43-1041(A)(1)',
      url: 'https://www.azleg.gov/ars/43/01041.htm',
      quotedText:
        'In the case of a single person or a married person filing separately, the standard deduction is $12,200, subject to subsection H of this section.',
    }, {
      kind: 'statute',
      citation: 'A.R.S. 43-1041(H)',
      url: 'https://www.azleg.gov/ars/43/01041.htm',
      quotedText:
        'For each taxable year beginning from and after December 31, 2019, the department shall adjust the dollar amounts prescribed by subsection A, paragraphs 1, 2 and 3 of this section for inflation in the same manner in which the federal basic standard deduction is adjusted for inflation pursuant to section 63 of the internal revenue code.',
    }, {
      kind: 'statute',
      citation: 'A.R.S. 43-105(A)',
      url: 'https://www.azleg.gov/ars/43/00105.htm',
      quotedText:
        'For the purposes of computing income tax pursuant to this title, for taxable years beginning from and after December 31, 2024, "internal revenue code" means the United States internal revenue code of 1986, as amended, in effect on January 1, 2025, including those provisions that became effective during 2024 with the specific adoption of all retroactive effective dates, but excluding any changes to the code enacted after January 1, 2025.',
    }, {
      // The published dollar amounts, from the short form's own deduction line
      // rather than from the booklet's "What's New" bullet list, which reflows
      // through a two-column page and cannot be quoted as printed.
      kind: 'formInstruction',
      citation: '2025 Arizona Form 140A, line 18',
      url: 'https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140Booklet.pdf',
      quotedText:
        '18 Standard deduction: If you checked filing status box 4 enter $31,500; box 5 enter $23,625; or box 6 or 7 enter $15,750.',
    }],
    // The amount moves every year under (H) even though the mechanism is
    // statutory, so this falls due with the autumn figures rather than on the
    // annual statutory pass.
    volatility: 'annuallyIndexed',
    effectiveFrom: 2020,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/state/index.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.AZ',
      'packages/engine/src/params/state/index.ts#conformStateStandardDeduction',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ars-43-1022-10-social-security-railroad-exclusion': {
    title: 'Arizona subtracts every federally taxable Social Security dollar',
    statement:
      'A.R.S. 43-1022(10) subtracts from Arizona gross income the amount included in federal adjusted gross income under IRC 86 — Social Security and railroad retirement benefits — with no income threshold, age condition or cap; Form 140 line 30 uses the same scope for taxpayers who included such social security or railroad retirement benefits on the federal return. The pack expresses it as `taxesSocialSecurity: false`, so no federally taxable benefit dollar reaches the 2.5% rate at any income level.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:AZ',
    authority: [{
      kind: 'statute',
      citation: 'A.R.S. 43-1022(10)',
      url: 'https://www.azleg.gov/ars/43/01022.htm',
      quotedText:
        'The amount included in federal adjusted gross income pursuant to section 86 of the internal revenue code, relating to taxation of social security and railroad retirement benefits.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Arizona Form 140 instructions, Line 30',
      url: 'https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140Booklet.pdf',
      quotedText:
        'If you included such social security or railroad retirement benefits as income on your federal return, use line 30 to subtract this income.',
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
      'packages/engine/src/params/state/data/year2026.ts#states.AZ',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ars-43-1022-26-uniformed-services-exclusion': {
    title: 'Arizona excludes uniformed-services retired and retainer pay in full',
    statement:
      'For taxable years beginning after December 31, 2020, A.R.S. 43-1022(26)(c) subtracts from Arizona gross income the full amount of benefits, annuities and pensions received as retired or retainer pay of the uniformed services of the United States — no cap, no age condition, no phase-out — where the same paragraph capped the subtraction at $2,500 through 2018 and $3,500 for 2019 and 2020. The department extends it to each spouse on a joint return and to a surviving spouse receiving payments from the uniformed services. The pack expresses it by listing AZ in `PUBLIC_PENSION_OVERRIDES` as `{ kind: \'full\' }`, which is also what stops the public rule being copied onto private retirement income: Arizona subtracts nothing for a private pension or an IRA, and must keep subtracting nothing.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:AZ',
    authority: [{
      kind: 'statute',
      citation: 'A.R.S. 43-1022(26)',
      url: 'https://www.azleg.gov/ars/43/01022.htm',
      quotedText:
        'Benefits, annuities and pensions received as retired or retainer pay of the uniformed services of the United States in amounts as follows: (a) For taxable years through December 31, 2018, an amount totaling not more than $2,500. (b) For taxable years beginning from and after December 31, 2018 through December 31, 2020, an amount totaling not more than $3,500. (c) For taxable years beginning from and after December 31, 2020, the full amount received.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Arizona Form 140 instructions, Line 29b',
      url: 'https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140Booklet.pdf',
      quotedText:
        'If you received benefits, annuities and pensions as retired or retainer pay of the uniformed services of the United States, you may subtract 100% of the amount you received. If you are married and filing a joint return and both you and your spouse each received such income, each spouse may subtract 100% of the amount received. If you are the surviving spouse of a deceased military veteran, and are receiving payments from the uniformed services of the United States, you may exclude 100% of the payments you received.',
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
      'packages/engine/src/params/state/data/year2026.ts#PUBLIC_PENSION_OVERRIDES',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'ars-43-1022-no-private-retirement-exclusion': {
    title: 'Arizona grants no exclusion for a private pension, annuity or IRA distribution',
    statement:
      'The subtractions that turn Arizona gross income into Arizona adjusted gross income are the closed enumeration of A.R.S. 43-1022. Two of its paragraphs reach retirement income — uniformed-services retired pay under (26) and government pensions under (2) — and none of them reaches a private pension, a commercial annuity, or a distribution from a traditional IRA or 401(k), so that income is taxed in full at 2.5%. The pack keeps `retirementPrivate` at `{ kind: \'none\' }`, and the entry for Arizona in `PUBLIC_PENSION_OVERRIDES` leaves `retirementRuleShared` false, so the public bucket’s exclusion cannot spill onto the private one.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:AZ',
    authority: [{
      // A negative claim's evidence is the closedness of the enumeration. The
      // opening line makes the list exhaustive; the return's own subtraction
      // line for pensions names only the government ones.
      kind: 'statute',
      citation: 'A.R.S. 43-1022',
      url: 'https://www.azleg.gov/ars/43/01022.htm',
      quotedText:
        'In computing Arizona adjusted gross income, the following amounts shall be subtracted from Arizona gross income:',
    }, {
      kind: 'formInstruction',
      citation: '2025 Arizona Form 140, line 29a',
      url: 'https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140Booklet.pdf',
      quotedText:
        '29a Exclusion for federal, Arizona state or local government pensions (up to $2,500 per taxpayer)',
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
      'packages/engine/src/params/state/data/year2026.ts#states.AZ',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'ars-43-1022-2-government-pension-exclusion': {
    title: 'Arizona caps a civil-service pension subtraction at $2,500, and the pack exempts it in full',
    statement:
      'A.R.S. 43-1022(2) subtracts benefits, annuities and pensions "in an amount totaling not more than $2,500" received from the federal civil-service and foreign-service retirement systems and any other retirement system established by federal law other than uniformed-services retired pay, and from the Arizona State Retirement System, the Corrections Officer Retirement Plan, the Public Safety Personnel Retirement System, the Elected Officials\' Retirement Plan, the Arizona Board of Regents and community-college optional programs, and county, city or town plans. Each spouse may claim their own $2,500, and a public pension from another state qualifies for nothing. Not modelled. `retirementPublic` is one flag covering every public pension the input model can carry, and it is set to `full` for the sake of 43-1022(26)’s uniformed-services exclusion, so a federal, Arizona state or Arizona local government pension is exempted outright when Arizona exempts only $2,500 of it. The error runs toward the taxpayer: an Arizona civil-service retiree is shown a state tax lower than they owe, by 2.5% of everything above $2,500.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale: null,
    jurisdiction: 'state:AZ',
    authority: [{
      kind: 'statute',
      citation: 'A.R.S. 43-1022(2)',
      url: 'https://www.azleg.gov/ars/43/01022.htm',
      quotedText:
        'Benefits, annuities and pensions in an amount totaling not more than $2,500 received from one or more of the following: (a) The United States government service retirement and disability fund, the United States foreign service retirement and disability system and any other retirement system or plan established by federal law, except retired or retainer pay of the uniformed services of the United States that qualifies for a subtraction under paragraph 26 of this section.',
    }, {
      kind: 'statute',
      citation: 'A.R.S. 43-1022(2)(b)',
      url: 'https://www.azleg.gov/ars/43/01022.htm',
      quotedText:
        'The Arizona state retirement system, the corrections officer retirement plan, the public safety personnel retirement system, the elected officials\' retirement plan, an optional retirement program established by the Arizona board of regents under section 15-1628, an optional retirement program established by a community college district board under section 15-1451 or a retirement plan established for employees of a county, city or town in this state.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Arizona Form 140 instructions, Line 29a',
      url: 'https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140Booklet.pdf',
      quotedText:
        'If you received pension income from any of the sources listed below, subtract the amount you received or $2,500, whichever is less.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Arizona Form 140 instructions, Line 29a, each-spouse amount',
      url: 'https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140Booklet.pdf',
      quotedText:
        'If both you and your spouse receive such pension income, each spouse may subtract the amount received or $2,500, whichever is less.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Arizona Form 140 instructions, Line 29a, out-of-state public pensions',
      url: 'https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140Booklet.pdf',
      quotedText:
        'NOTE: Public retirement pensions from states other than Arizona do not qualify for this subtraction.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2021,
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

  'ars-43-1022-22-long-term-capital-gain-subtraction': {
    title: 'Arizona subtracts 25% of long-term gain on a post-2011 asset only',
    statement:
      'A.R.S. 43-1022(22) subtracts a share of net long-term capital gain included in federal adjusted gross income, but only gain "derived from an investment in an asset acquired after December 31, 2011", and subdivision (c) sets that share at twenty-five percent for taxable years after 2014 while adding that no subtraction is allowed at all where the acquisition date cannot be verified. The pack carries `capitalGainsTaxablePct: 75`, which is right for an asset bought after 2011 and wrong for one bought before. Not modelled: the engine holds no acquisition date for the position a gain came from, so it applies the seventy-five percent inclusion to every Arizona gain, including one on a long-held pre-2012 holding that Arizona taxes in full. The error runs toward the taxpayer on exactly the households most likely to have one — a retiree realizing a position held for fifteen years — at 2.5% of the quarter Arizona does not exclude.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale: null,
    jurisdiction: 'state:AZ',
    authority: [{
      kind: 'statute',
      citation: 'A.R.S. 43-1022(22)',
      url: 'https://www.azleg.gov/ars/43/01022.htm',
      quotedText:
        'An amount of any net long-term capital gain included in federal adjusted gross income for the taxable year that is derived from an investment in an asset acquired after December 31, 2011, as follows:',
    }, {
      kind: 'statute',
      citation: 'A.R.S. 43-1022(22)(c)',
      url: 'https://www.azleg.gov/ars/43/01022.htm',
      quotedText:
        'For taxable years beginning from and after December 31, 2014, twenty-five percent of the net long-term capital gain included in federal adjusted gross income. For the purposes of this paragraph, a transferee that receives an asset by gift or at the death of a transferor is considered to have acquired the asset when the asset was acquired by the transferor. If the date an asset is acquired cannot be verified, a subtraction under this paragraph is not allowed.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Arizona Form 140 instructions, Line 24',
      url: 'https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140Booklet.pdf',
      quotedText:
        'You may subtract 25% (.25) of any net long-term capital gain included in your federal adjusted gross income that is derived from an investment in an asset acquired after December 31, 2011.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2015,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/types.ts',
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#AZ.capitalGainsTaxablePct',
      'packages/engine/src/params/state/types.ts#StateTaxParams',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ars-43-1023-e-age-65-exemption': {
    title: 'Arizona’s age-65 relief is a flat $2,100 exemption the pack does not model',
    statement:
      'A.R.S. 43-1023(E) allows an exemption of $2,100 to a taxpayer who has attained age 65 before the close of the taxable year, and a second $2,100 for a spouse who has on a joint return. It reaches the return through 43-1022(1), which subtracts the 43-1023 exemptions from Arizona gross income — so it sits above the deduction line, and it is not an addition to the standard deduction. Nothing in 43-1023 indexes it. Not modelled: the pack has one age-65 field, `standardDeductionAge65Addition`, and `conformStateStandardDeduction` attaches it only to a state whose deduction IS the federal one, which Arizona’s is not. So an Arizona household aged 65 or over is charged 2.5% on $2,100 per person that Arizona exempts. Modelling it through the conformity tag was the alternative and is worse: that path attaches the FEDERAL age-65 addition, a different figure under a different statute, indexed every year while Arizona’s $2,100 is frozen, so the gap between the two would widen in every projected year of a plan.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:AZ',
    authority: [{
      kind: 'statute',
      citation: 'A.R.S. 43-1023(E)',
      url: 'https://www.azleg.gov/ars/43/01023.htm',
      quotedText:
        'A taxpayer is allowed an exemption of $2,100: 1. If the taxpayer has attained sixty-five years of age before the close of the taxable year filing a separate or joint return and the taxpayer is not claimed as a dependent by another taxpayer. 2. For the taxpayer\'s spouse if the spouse has attained sixty-five years of age before the close of the taxable year, a joint return is filed and the spouse is not a dependent of another taxpayer.',
    }, {
      // Where the exemption enters the return, and why it is not a deduction:
      // 43-1022(1) subtracts it from Arizona GROSS income, so it is gone before
      // 43-1001(11) reaches taxable income by taking the article 4 deductions
      // off Arizona adjusted gross income. 43-1001 is not cited alongside it
      // because that page carries under 1,600 characters of text and the quote
      // verifier cannot tell so short a document from a shell page.
      kind: 'statute',
      citation: 'A.R.S. 43-1022(1)',
      url: 'https://www.azleg.gov/ars/43/01022.htm',
      quotedText: 'The amount of exemptions allowed by section 43-1023.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Arizona Form 140, line 38',
      url: 'https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140Booklet.pdf',
      quotedText: '38 Age 65 or over: Multiply the number in box 8 by $2,100',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2021,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/state/index.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.AZ',
      'packages/engine/src/params/state/index.ts#conformStateStandardDeduction',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  // ---------------------------------------------------------------------------
  // WS4d Batch A — 2026-08-27.
  //
  // These records deliberately cover only the parts of the Batch A packs whose
  // staged primary texts carry operative language. The CA, CO, DC, and GA
  // records below use the refreshed sources; they are not reconstructed from
  // the old matrix. Alabama is registered separately below from the 2025 Form
  // 40 booklet and the DOR individual-income-tax page (verified 2026-08-28).
  // ---------------------------------------------------------------------------

  'ca-ftb-2026-540-es-standard-deduction': {
    title: 'California\'s 2026 estimated-tax worksheet lists $5,706/$11,412 standard deductions',
    statement:
      'California FTB\'s 2026 estimated-tax worksheet lists a $5,706 standard deduction for single/MFS and $11,412 for MFJ/HOH/QSS. The pack stores those published amounts in its supported single/MFJ deduction cells. Settled only for that deduction instruction and mapping: itemization, credits, unsupported filing-status routing, the separate tax-table calculation, the additional tax above $1 million, final 2026 resident-return figures, and whole-return accuracy are outside this record.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This record transcribes a 2026 estimated-tax instruction, not a final 2026 resident-return schedule. The record expires after 2026. Because stateParamsFor reuses the latest pack in later plan years, any later-year use is a 2026-pack stand-in rather than a claim that these amounts remain legally current.',
    jurisdiction: 'state:CA',
    authority: [{
      kind: 'formInstruction',
      citation: 'California FTB, 2026 Form 540-ES Instructions, Estimated Tax Worksheet line 2b',
      url: 'https://www.ftb.ca.gov/forms/2026/2026-540-es-instructions.html',
      quotedText:
        '$5,706 single or married/RDP filing separately … $11,412 married/RDP filing jointly, head of household, or qualifying surviving spouse/RDP',
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
      'packages/engine/src/params/state/data/year2026.ts#CA',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ca-rtc-17087-social-security-exclusion': {
    title: 'California does not apply IRC 86 to Social Security or Tier 1 Railroad benefits',
    statement:
      'California says IRC section 86 does not apply, so federally taxable Social Security and Tier 1 Railroad benefits are not part of the California base. The pack\'s `taxesSocialSecurity: false` omits precisely that federal inclusion. This source does not decide California\'s treatment of pension or IRA income, so the separate `{ kind: \'none\' }` data choice is deliberately not claimed by this record.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:CA',
    authority: [{
      kind: 'statute',
      citation: 'Cal. Rev. & Tax. Code 17087(a)',
      url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=RTC&sectionNum=17087.',
      quotedText:
        'Section 86 of the Internal Revenue Code, relating to Social Security and Tier 1 Railroad Retirement Benefits, shall not apply.',
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
      'packages/engine/src/params/state/data/year2026.ts#CA',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'co-crs-39-22-104-federal-base-and-pension-cap': {
    title: 'Colorado applies recipient-level Social Security and pension shared caps',
    statement: 'Colorado starts from federal taxable income. The characterized path applies each recipient’s $20,000 age-55–64 or $24,000 age-65-plus combined pension and Social Security cap. It increases the cap to federally taxable Social Security when that exceeds the ordinary ceiling at age 65+, or at ages 55–64 when AGI is at most $75,000 individual/$95,000 joint. Social Security uses the cap first; remaining capacity applies to eligible pension income. Joint benefits require recipient allocation; premature IRA distributions do not qualify merely as pensions. Unknown age, source, allocation, or relevant AGI produces incomplete status.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:CO',
    authority: [{
      kind: 'statute',
      citation: 'Colo. Rev. Stat. 39-22-104(1.7)(c), (2)',
      url: 'https://olls.info/crs/crs2026-title-39.htm',
      quotedText:
        'Except as otherwise provided in section 39-22-627, subject to subsection (2) of this section, with respect to taxable years commencing on or after January 1, 2022, a tax of four and forty one-hundredths percent is imposed on the federal taxable income, as determined pursuant to section 63 of the internal revenue code, of every individual, estate, and trust. … Prior to the application of the rate of tax prescribed in subsection (1), (1.5), or (1.7) of this section, the federal taxable income shall be modified as provided in subsections (3) and (4) of this section.',
    }, {
      kind: 'statute',
      citation: 'Colo. Rev. Stat. 39-22-104(4)(f)(III)(A), (D)',
      url: 'https://olls.info/crs/crs2026-title-39.htm',
      quotedText:
        'Amounts subtracted under this subsection (4)(f) are capped at twenty thousand dollars per tax year for any individual who is fifty-five years of age or older but less than sixty-five years of age at the close of the taxable year. ... "Pensions and annuities" includes distributions from individual retirement arrangements and self-employed retirement accounts to the extent that such distributions are not deemed to be premature distributions for federal income tax purposes, amounts received from fully matured privately purchased annuities, social security benefits, and amounts paid from any such sources by reason of permanent disability or death of the person entitled to receive the benefits.',
    }, {
      kind: 'statute',
      citation: 'C.R.S. 39-22-104(4)(f)(III)(A), (V)',
      url: 'https://olls.info/crs/crs2026-title-39.htm',
      quotedText: 'Amounts subtracted under this subsection (4)(f) are capped at twenty thousand dollars per tax year for any individual who is fifty-five years of age or older but less than sixty-five years of age at the close of the taxable year. For income tax years commencing on or after January 1, 2025, the cap set forth in this subsection (4)(f)(III)(A) is calculated by first considering the total amount of social security benefits a taxpayer received that were included in federal taxable income at the close of the taxable year. If the total amount of such social security benefits exceeds the cap set forth in this subsection (4)(f)(III)(A), and the taxpayer\'s adjusted gross income for the applicable tax year is less than or equal to seventy-five thousand dollars if filing individually or ninety-five thousand dollars if filing jointly, then the cap is increased to an amount equal to the total amount of such social security benefits. … For the purpose of determining the subtraction allowed by this subsection (4)(f), in the case of a joint return, social security benefits included in federal taxable income shall be apportioned in a ratio of the gross social security benefits of each taxpayer to the total gross social security benefits of both taxpayers.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-12',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/tax/stateColoradoTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.CO',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult',
      'packages/engine/src/tax/stateColoradoTax.ts#coloradoSsPensionSubtraction',
    ],
  },

  'co-crs-39-22-104-social-security-inclusion': {
    title: 'Colorado raises the combined cap to eligible taxable Social Security',
    statement: 'Colorado raises the combined pension-and-annuity cap to taxable Social Security above $24,000 at age 65+, and above $20,000 at ages 55–64 when the statutory AGI threshold is met. For Social Security below the ordinary cap, the remaining cap can exclude other qualifying pension income. Only the federally included share is eligible, allocated by recipient; gross benefits are not the subtraction base.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:CO',
    authority: [{
      kind: 'statute',
      citation: 'Colo. Rev. Stat. 39-22-104(4)(f)(III)(B)',
      url: 'https://olls.info/crs/crs2026-title-39.htm',
      quotedText:
        'Amounts subtracted under this subsection (4)(f) are capped at twenty-four thousand dollars per tax year for any individual who is sixty-five years of age or older at the close of the taxable year. For income tax years commencing on or after January 1, 2022, the cap set forth in this subsection (4)(f)(III)(B) is calculated by first considering the total amount of social security benefits a taxpayer received that were included in federal taxable income at the close of the taxable year. If the total amount of such social security benefits exceeds the cap set forth in this subsection (4)(f)(III)(B), then the cap is increased to an amount equal to the total amount of such social security benefits.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-12',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/tax/stateColoradoTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.CO',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult',
      'packages/engine/src/tax/stateColoradoTax.ts#coloradoSsPensionSubtraction',
    ],
  },

  'hi-hrs-235-2-4-a-2-f-2026-standard-deduction': {
    title: 'Hawaii’s TY2026 standard deduction is $8,000 single and $16,000 joint',
    statement:
      'For tax year 2026, Hawaii’s standard deduction is $8,000 for an unmarried individual and $16,000 on a joint return. The pack models supported single and married-filing-jointly statuses only; head-of-household, married-filing-separately, and surviving-spouse limbs are outside this record. Personal exemptions, itemization, and whole-return accuracy are also outside this record.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The Hawaii Department of Taxation’s unofficial HRS compilation labels itself as of 2025-12-31; the operative subsection and effective-year language are nevertheless explicit. Later phased increases under Act 46 beyond tax year 2027 (from the §235-2.4(a)(2)(G) phase beginning 2028) are not certified here. Hawaii’s private-pension approximation remains registered separately at `hi-hrs-235-7-pension-and-social-security`.',
    jurisdiction: 'state:HI',
    authority: [{
      kind: 'statute',
      citation: 'Haw. Rev. Stat. §235-2.4(a)(2)(F)',
      url: 'https://files.hawaii.gov/tax/legal/hrs/hrs_235.pdf',
      quotedText:
        '(F) For taxable years beginning after December 31, 2025: (i) $16,000 in the case of a joint return as provided by section 235-93 or a surviving spouse (as defined in section 2(a) of the Internal Revenue Code); (ii) $12,000 in the case of a head of household (as defined in section 2(b) of the Internal Revenue Code); (iii) $8,000 in the case of an individual who is not married and who is not a surviving spouse or head of household; or (iv) $8,000 in the case of a married individual filing a separate return;',
    }, {
      kind: 'statute',
      citation: 'Haw. Rev. Stat. §235-2.4(a)(2)(G) (next phase)',
      url: 'https://files.hawaii.gov/tax/legal/hrs/hrs_235.pdf',
      quotedText:
        '(G) For taxable years beginning after December 31, 2027:',
    }],
    volatility: 'sunsetting',
    effectiveFrom: 2026,
    effectiveThrough: 2027,
    verifiedOn: '2026-09-07',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.HI',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'hi-hrs-235-2-3-social-security-subtraction': {
    title: 'Hawaii makes IRC section 86 nonoperative for federally included Social Security',
    statement:
      'Hawaii\'s conformity section lists IRC section 86 among the Code provisions that are not operative for Hawaii income-tax purposes, so the federally taxable share of Social Security and tier 1 railroad retirement benefits does not enter the Hawaii base. The pack expresses that limb as `taxesSocialSecurity: false` in `computeStateTaxableIncome`. This record registers only that federal-inclusion subtraction; it does not claim railroad-benefit eligibility typing, pension exclusions under section 235-7, or whole-return accuracy.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The Hawaii Department of Taxation\'s unofficial HRS compilation is labeled as of 2025-12-31; the quoted lead-in and paragraph (3) are nevertheless explicit. Later conformity changes beyond that compilation are not certified here.',
    jurisdiction: 'state:HI',
    authority: [{
      kind: 'statute',
      citation: 'Haw. Rev. Stat. §235-2.3(b)(3)',
      url: 'https://files.hawaii.gov/tax/legal/hrs/hrs_235.pdf',
      quotedText:
        '(b) The following Internal Revenue Code subchapters, parts of subchapters, sections, subsections, and parts of subsections shall not be operative for the purposes of this chapter, unless otherwise provided: … (3) Section 86 (with respect to social security and tier 1 railroad retirement benefits);',
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
      'packages/engine/src/params/state/data/year2026.ts#states.HI',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'hi-hrs-235-7-pension-and-social-security': {
    title: 'Hawaii excludes every pension for past services, not only public pensions',
    statement:
      'Hawaii excludes public-retirement-system benefits and any compensation received as a pension for past services from gross, adjusted gross, and taxable income. The public-pension override correctly makes the public bucket full, but the `privateRetirementIncome` bucket combines private pensions with IRAs and other distributions, so the pack gives it `{ kind: \'none\' }`. A private pension is therefore taxed even though the statute excludes it. The output overstates tax for that source-covered limb; treating the entire bucket as exempt would instead overreach to private IRA distributions, which the staged text does not establish. No staged source here states the separate `taxesSocialSecurity: false` behavior, so that limb is intentionally not claimed by this record.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:HI',
    authority: [{
      kind: 'statute',
      citation: 'Haw. Rev. Stat. 235-7(a), lead-in',
      url: 'https://files.hawaii.gov/tax/legal/hrs/hrs_235.pdf',
      quotedText:
        '(a) There shall be excluded from gross income, adjusted gross income, and taxable income:',
    }, {
      kind: 'statute',
      citation: 'Haw. Rev. Stat. 235-7(a)(2)',
      url: 'https://files.hawaii.gov/tax/legal/hrs/hrs_235.pdf',
      quotedText:
        'Rights, benefits, and other income exempted from taxation by section 88-91, having to do with the state retirement system, and the rights, benefits, and other income, comparable to the rights, benefits, and other income exempted by section 88-91, under any other public retirement system;',
    }, {
      kind: 'statute',
      citation: 'Haw. Rev. Stat. 235-7(a)(3)',
      url: 'https://files.hawaii.gov/tax/legal/hrs/hrs_235.pdf',
      quotedText: 'Any compensation received in the form of a pension for past services;',
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
      'packages/engine/src/params/state/data/year2026.ts#states.HI',
      'packages/engine/src/params/state/types.ts#StateRetirementExclusion',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'id-code-63-3022-federal-standard-and-ss': {
    title: 'Idaho subtracts the federally included Social Security and Railroad amount',
    statement:
      'Idaho deducts every amount that IRC 86 included in gross income for Social Security and Railroad benefits. The state’s `taxesSocialSecurity: false` setting therefore removes the same federally taxable share before Idaho brackets apply. The staged section does not define Idaho taxable income or the standard-deduction reference, so this record deliberately registers only the Social Security behavior despite its planned umbrella id.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:ID',
    authority: [{
      kind: 'statute',
      citation: 'Idaho Code 63-3022(l)',
      url: 'https://legislature.idaho.gov/statutesrules/idstat/title63/t63ch30/sect63-3022/',
      quotedText:
        'Deduct any amounts included in gross income under the provisions of section 86 of the Internal Revenue Code relating to certain social security and railroad benefits.',
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
      'packages/engine/src/params/state/data/year2026.ts#ID',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'mt-mca-15-30-2120-federal-taxable-income-base': {
    title: 'Montana starts from federal taxable income, so federally taxable Social Security stays in the base',
    statement:
      'Montana taxable income means federal taxable income adjusted as provided in 15-30-2120, and the subtraction list in 15-30-2120(3), quoted below END-TO-END so the negative is checkable rather than an absence-from-excerpt, contains no Social Security item of any kind, so the federally taxable share of benefits stays in the Montana base - `taxesSocialSecurity: true`. Starting from federal TAXABLE income also imports the federal standard deduction directly, which is what `standardDeductionConformity: \'federal\'` encodes and what the 2026 department withholding notice confirms. This record supersedes mt-mca-15-30-2110-federal-agi-social-security: former 15-30-2110 was repealed by Secs. 65 and 70(1) of Ch. 503, L. 2021 (SB 399). The income-tested Social Security subtraction and the $3,600 pension exclusion that the research corpus and the predecessor record\'s 2013-compilation source DESCRIBED lived in that repealed section; whether or not they read exactly as described, the quoted, complete current subtraction list settles the operative claim on its own - so under current law those reliefs are a NO-GRANT, not an unmodeled subtraction, which closes the BLOCKED-SOURCE residual the predecessor record carried. The age-65 subtraction current law DOES grant is registered separately as mt-mca-15-30-2120-3-g-age-65-subtraction.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:MT',
    authority: [{
      kind: 'statute',
      citation: 'Mont. Code Ann. 15-30-2101(22) (2025)',
      url: 'https://mca.legmt.gov/bills/mca/title_0150/chapter_0300/part_0210/section_0010/0150-0300-0210-0010.html',
      quotedText:
        '"Montana taxable income" means federal taxable income as determined for federal income tax purposes and adjusted as provided in 15-30-2120',
    }, {
      kind: 'statute',
      citation: 'Mont. Code Ann. 15-30-2120(1) (2025)',
      url: 'https://mca.legmt.gov/bills/mca/title_0150/chapter_0300/part_0210/section_0200/0150-0300-0210-0200.html',
      quotedText:
        'The items in subsection (2) are added to and the items in subsection (3) are subtracted from federal taxable income to determine Montana taxable income.',
    }, {
      kind: 'statute',
      citation: 'Mont. Code Ann. 15-30-2120(3) (2025)',
      url: 'https://mca.legmt.gov/bills/mca/title_0150/chapter_0300/part_0210/section_0200/0150-0300-0210-0200.html',
      // Online 2025 MCA compilation dropped already-expired (3)(r) (property-tax
      // rebate under 15-1-2307; terminated June 30, 2026 per sec. 29, Ch. 767,
      // L. 2025). Quote now ends at (q); (3)(a)'s still-literal "(3)(r)" cross-
      // reference is preserved as published. Source hygiene only — no new law.
      quotedText:
        '(3) To the extent they are included as income or gain or not already excluded as a deduction or expense in determining federal taxable income, the following are subtracted from federal taxable income: (a) a deduction for an income distribution from an estate or trust to a beneficiary in accordance with sections 651 and 661 of the Internal Revenue Code, 26 U.S.C. 651 and 661, recalculated according to the additions and subtractions in subsections (2) and (3)(b) through (3)(r); (b) if exempt from taxation by Montana under federal law: (i) interest from obligations of the United States government and exempt-interest dividends attributable to that interest; and (ii) railroad retirement benefits; (c) (i) salary received from the armed forces by residents of Montana who are serving on active duty in the regular armed forces and who entered into active duty from Montana; (ii) the salary received by residents of Montana for active duty in the national guard. For the purposes of this subsection (3)(c)(ii), "active duty" means duty performed under an order issued to a national guard member pursuant to: (A) Title 10, U.S.C.; or (B) Title 32, U.S.C., for a homeland defense activity, as defined in 32 U.S.C. 901, or a contingency operation, as defined in 10 U.S.C. 101, and the person was a member of a unit engaged in a homeland defense activity or contingency operation. (iii) the amount received by a beneficiary pursuant to 10-1-1201 ; and (iv) all payments made under the World War I bonus law, the Korean bonus law, and the veterans\' bonus law. Any income tax that has been or may be paid on income received from the World War I bonus law, Korean bonus law, and the veterans\' bonus law is considered an overpayment and must be refunded upon the filing of an amended return and a verified claim for refund on forms prescribed by the department in the same manner as other income tax refund claims are paid. (d) annual contributions and income in a medical care savings account provided for in Title 15, chapter 61, and any withdrawal for payment of eligible medical expenses or for the long-term care of the employee or account holder or a dependent of the employee or account holder; (e) contributions or earnings withdrawn from a family education savings account provided for in Title 15, chapter 62, or from a qualified tuition program established and maintained by another state as provided in section 529(b)(1)(A)(ii) of the Internal Revenue Code, 26 U.S.C. 529(b)(1)(A)(ii), for qualified education expenses, as defined in 15-62-103 , of a designated beneficiary; (f) interest and other income related to contributions that were made prior to January 1, 2024, that are retained in a first-time home buyer savings account provided for in Title 15, chapter 63, and any withdrawal for payment of eligible costs for the first-time purchase of a single-family residence; (g) for each taxpayer that has attained the age of 65, an additional subtraction of $5,500; (h) the amount of a scholarship to an eligible student by a student scholarship organization pursuant to 15-30-3104 ; (i) a payment received by a private landowner for providing public access to public land pursuant to Title 76, chapter 17, part 1; (j) the amount of any refund or credit for overpayment of income taxes imposed by this state or any other taxing jurisdiction to the extent included in gross income for federal income tax purposes but not previously allowed as a deduction for Montana income tax purposes; (k) the recovery during the tax year of any amount deducted in any prior tax year to the extent that the recovered amount did not reduce the taxpayer\'s Montana income tax in the year deducted; (l) the amount of the gain recognized from the sale or exchange of a mobile home park as provided in 15-31-163 ; (m) payments from the Montana end of watch trust as provided in 2-15-2041 ; (n) (i) subject to subsection (9), a portion of military pensions or military retirement income as calculated pursuant to subsection (8) that is received by a retired member of: (A) the armed forces of the United States, as defined in 10 U.S.C. 101; (B) the Montana army national guard or the army national guard of other states; (C) the Montana air national guard or the air national guard of other states; or (D) a reserve component, as defined in 38 U.S.C. 101, of the United States armed forces; and (ii) subject to subsection (9), up to 50% of all income received as survivor benefits for military service provided for in subsections (3)(n)(i)(A) through (3)(n)(i)(D); (o) subject to subsection (10), for each taxpayer that is a qualified volunteer firefighter or volunteer emergency care provider, an additional subtraction of $3,000; (p) income received from the manufacture of ammunition components by an entity, owner, or partner engaged in the primary business of the manufacture of ammunition components as provided in 30-20-207 ; and (q) income attributable to providing a bona fide loan in an arms\'-length transaction to a manufacturer of ammunition components as provided in 30-20-208 .',
    }, {
      kind: 'statute',
      citation: 'Mont. Code Ann. 15-30-2110 (repealed) (2025)',
      url: 'https://mca.legmt.gov/bills/mca/title_0150/chapter_0300/part_0210/section_0100/0150-0300-0210-0100.html',
      quotedText: 'Repealed. Secs. 65, 70(1), Ch. 503, L. 2021.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Montana Department of Revenue, Updated Montana Wage Withholding Tables and MW-4 Now Available (2026)',
      url: 'https://revenue.mt.gov/news/recent-news/2026-withholding-updates',
      quotedText:
        'Additionally, recent federal legislation changed the standard deductions amounts which affect Montana taxable income. The withholding tax tables were updated to also reflect these changes.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-04',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/state/index.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#MT',
      'packages/engine/src/params/state/index.ts#conformStateStandardDeduction',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'mt-mca-15-30-2120-3-g-age-65-subtraction': {
    title: 'Montana subtracts $5,500 per taxpayer at 65, inflation-adjusted; the pack has no such knob',
    statement:
      'For each taxpayer that has attained the age of 65, 15-30-2120(3)(g) subtracts an additional $5,500 from federal taxable income, and 15-30-2120(7) directs the department to multiply that subtraction by the inflation factor each year (rounded to the nearest $10), so the operative figure grows above the statutory floor. The pack carries `retirement: { kind: \'none\' }`, and while the schema does have one age-keyed relief path - the federal standard-deduction age-65 addition that flows through conformity against `peopleAged65Plus` - it has no state-subtraction knob, so beyond that federal addition the engine taxes the full base. Produced pin: on the fixture household (single, age 65, $90,000 ordinary income, $16,100 federal-conformed deduction) the engine leaves Montana taxable income at $73,900 where the statute reads at most $68,400 - overstating tax by the top-bracket rate on the subtraction, about $311 at 5.65% on the $5,500 floor alone, and by more once the (7) inflation factor lifts it. A married couple who have both attained 65 doubles the gap.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale:
      'The record pins the $5,500 statutory floor rather than the department\'s inflation-adjusted figure for the tax year: the floor is in the quoted statute, while the adjusted amount is published administratively under 15-30-2120(7) and no primary source for the 2026 figure is staged. The floor understates the size of the overstatement, never the direction.',
    jurisdiction: 'state:MT',
    authority: [{
      kind: 'statute',
      citation: 'Mont. Code Ann. 15-30-2120(3)(g) (2025)',
      url: 'https://mca.legmt.gov/bills/mca/title_0150/chapter_0300/part_0210/section_0200/0150-0300-0210-0200.html',
      quotedText: 'for each taxpayer that has attained the age of 65, an additional subtraction of $5,500;',
    }, {
      kind: 'statute',
      citation: 'Mont. Code Ann. 15-30-2120(7)(a) (2025)',
      url: 'https://mca.legmt.gov/bills/mca/title_0150/chapter_0300/part_0210/section_0200/0150-0300-0210-0200.html',
      quotedText:
        'By November 1 of each year, the department shall multiply the subtractions from federal taxable income in subsections (3)(g) and (3)(o) by the inflation factor for that tax year for a taxpayer that either: (i) has attained the age of 65; or (ii) is a qualified volunteer firefighter or volunteer emergency care provider.',
    }, {
      kind: 'statute',
      citation: 'Mont. Code Ann. 15-30-2120(7)(b) (2025)',
      url: 'https://mca.legmt.gov/bills/mca/title_0150/chapter_0300/part_0210/section_0200/0150-0300-0210-0200.html',
      quotedText: 'The department shall round the results in subsection (7)(a) to the nearest $10.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-29',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#MT',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'mt-hb337-2026-ordinary-rate-schedule': {
    title: 'Montana HB 337 publishes TY2026 ordinary two-bracket rates for supported single and MFJ filers',
    statement:
      'Montana Department of Revenue guidance on HB 337 lists Tax Year 2026 ordinary income tax brackets of 4.7% on taxable income from $0 to $47,500 single (and married filing separately) and $0 to $95,000 married filing jointly, and 5.65% above those thresholds. The pack stores those breakpoints and rates for single and married filing jointly. Federal-conformed standard deductions flow through `mt-mca-15-30-2120-federal-taxable-income-base` and are not re-quoted here. Settled only for that TY2026 ordinary two-bracket schedule on supported single and MFJ cells; the separate long-term capital gains table, Tax Year 2027 brackets, head-of-household, married-filing-separate, age-65 subtractions, and whole-return accuracy are outside this record.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:MT',
    authority: [{
      kind: 'stateAgencyPublication',
      citation: 'Montana DOR, HB337 effective year scope',
      url: 'https://revenuefiles.mt.gov/news/recent-news/HB-337',
      quotedText:
        'House Bill 337 (HB337) changes income taxes for individuals by expanding the bracket for the lower rate and reducing the upper rate. These changes apply to tax years 2026 and 2027, as shown below:',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Montana DOR, HB337 — Tax Year 2026 Income Tax Brackets table',
      url: 'https://revenuefiles.mt.gov/news/recent-news/HB-337',
      quotedText:
        'Tax Year 2026 Income Tax Brackets\nTax Year 2026 – Montana Individual Income Tax Rates\nTax rate on taxable income*\nMarried filing Jointly and Surviving Spouse\nHead of Household\nSingle and Married filing Separately\n4.7% on taxable income*\n$0.00 to $95,000\n$0.00 to $71,250\n$0.00 to $47,500\n5.65% on taxable income*\nover $95,000\nover $71,250\nover $47,500',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Montana DOR, HB337 — ordinary-income scope note',
      url: 'https://revenuefiles.mt.gov/news/recent-news/HB-337',
      quotedText:
        '*taxable income does not include long-term capital gains',
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
      'packages/engine/src/params/state/data/year2026.ts#MT',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#bracketTax',
    ],
  },

  // Batch C state records — verified against the staged sources on 2026-08-27.
  'nm-stat-7-2-5-14-social-security-and-federal-standard': {
    title: 'New Mexico applies an income-tested Social Security exemption',
    statement:
      'New Mexico does not exempt every dollar of Social Security. The Taxation and Revenue Department describes the exemption as beginning in 2022 but limits it by filing status and income: a single filer must be below $100,000, a joint filer, surviving spouse, or head of household below $150,000, and a married-separate filer below $75,000. The pack\'s `taxesSocialSecurity: false` is therefore a conservative boolean for low-income retirees but understates a high-income retiree\'s New Mexico tax. This record registers that source-backed Social Security limb. The federal-standard-deduction component remains covered by the federal conformity record `irc-63-c-7-B-ii-conformed-state-deduction-tracks-federal`; the staged New Mexico statutes index did not expose operative NMSA §7-2-5.14 text, so no separate New Mexico deduction reading is asserted here.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale: null,
    jurisdiction: 'state:NM',
    authority: [{
      kind: 'stateAgencyPublication',
      citation: 'New Mexico Taxation and Revenue Department, Social Security Income Tax Exemption',
      url: 'https://www.tax.newmexico.gov/social-security-income-tax-exemption/',
      quotedText:
        'Beginning with tax year 2022, most seniors will be exempt from paying taxes on their Social Security benefits when they file their New Mexico Personal Income Tax returns. Tax relief from the new Social Security exemption is expected to total $84.1 million in the first year. The exemption is available to single taxpayers with less than $100,000 in income, to married couples filing jointly, surviving spouses and heads of household with under $150,000 in income, and to married couples filing separately with under $75,000 in income.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/params/state/index.ts',
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#NM',
      'packages/engine/src/params/state/index.ts#conformStateStandardDeduction',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'nm-nmsa-7-2-7-individual-income-tax-rates': {
    title: 'New Mexico taxes single and joint taxable income on the HB 252 §7-2-7 rate schedules from 2025 onward',
    statement:
      'NMSA §7-2-7, as amended by HB 252 SECTION 5, assigns graduated rates for any taxable year beginning on or after January 1, 2025: Schedule A for married individuals filing joint returns, heads of household, and surviving spouses, and Schedule B for single individuals and for estates and trusts. The pack\'s `brackets` carry those single and married-filing-jointly thresholds and rates; `bracketTax` applies them to modeled taxable income. Settled only for those supported filing statuses and schedule cells; estates, trusts, head-of-household, surviving-spouse, married-filing-separate, and whole-return accuracy are outside this record. Social Security exemption remains at `nm-stat-7-2-5-14-social-security-and-federal-standard`.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:NM',
    // Schedule A and Schedule B are quoted as separate authorities. Ellipses omit PDF line numbers and page furniture only; they do not omit statutory words.
    authority: [{
      kind: 'statute',
      citation: 'NMSA §7-2-7 (HB 252 SECTION 5), effective period',
      url: 'https://www.nmlegis.gov/Sessions/24%20Regular/final/HB0252.pdf',
      quotedText:
        '7-2-7. INDIVIDUAL INCOME TAX RATES.--The tax imposed … by Section 7-2-3 NMSA 1978 shall be at the following rates … for any taxable year beginning on or after January 1, 2025:',
    }, {
      kind: 'statute',
      citation: 'NMSA §7-2-7 (HB 252 SECTION 5), Schedule A',
      url: 'https://www.nmlegis.gov/Sessions/24%20Regular/final/HB0252.pdf',
      quotedText:
        'A. For married individuals filing joint returns, \u2026 heads of household and surviving spouses: \u2026 For taxable income: \u2026 The tax shall be: \u2026 Not over $8,000 \u2026 1.5% of taxable income \u2026 Over $8,000 but not over $25,000 \u2026 $120 plus 3.2% of \u2026 excess over $8,000 \u2026 Over $25,000 but not over $50,000 \u2026 $664 plus 4.3% of \u2026 excess over $25,000 \u2026 Over $50,000 but not over $100,000 \u2026 $1,739 plus 4.7% of \u2026 excess over $50,000 \u2026 Over $100,000 but not over $315,000 \u2026 $4,089 plus 4.9% of \u2026 excess over $100,000 \u2026 Over $315,000 \u2026 $14,624 plus 5.9% of \u2026 excess over $315,000.',
    }, {
      kind: 'statute',
      citation: 'NMSA §7-2-7 (HB 252 SECTION 5), Schedule B',
      url: 'https://www.nmlegis.gov/Sessions/24%20Regular/final/HB0252.pdf',
      quotedText:
        'B. For single individuals and for estates and \u2026 trusts: \u2026 For taxable income: \u2026 The tax shall be: \u2026 Not over $5,500 \u2026 1.5% of taxable income \u2026 Over $5,500 but not over $16,500 \u2026 $82.50 plus 3.2% of \u2026 excess over $5,500 \u2026 Over $16,500 but not over $33,500 \u2026 $434.50 plus 4.3% of \u2026 excess over $16,500 \u2026 Over $33,500 but not over $66,500 \u2026 $1,165.50 plus 4.7% of \u2026 excess over $33,500 \u2026 Over $66,500 but not over $210,000 \u2026 $2,716.50 plus 4.9% of \u2026 excess over $66,500 \u2026 Over $210,000 \u2026 $9,748 plus 5.9% of \u2026 excess over $210,000.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2025,
    effectiveThrough: null,
    verifiedOn: '2026-09-10',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#NM',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetail',
      'packages/engine/src/tax/stateTax.ts#bracketTax',
    ],
  },

  'or-lro-2026-rate-schedule-and-standard-deduction': {
    title: 'Oregon publishes TY2026 indexed brackets and basic deductions represented by continuous marginal breakpoints',
    statement:
      'For tax year 2026, Oregon\'s resident income tax uses four rates — 4.75%, 6.75%, 8.75%, and 9.9% — on an annually indexed schedule adopted under ORS 316.037 in lieu of the statutory base table, with ORS 316.042 making a joint return twice the tax on half the joint taxable income. The Oregon Legislative Revenue Office Report #1-26 publishes the TY2026 single schedule at taxable-income breakpoints $4,550, $11,400, and $125,000 and the joint schedule at $9,100, $22,800, and $250,000, with basic standard deductions of $2,910 for single and married-filing-separately filers and $5,820 for joint returns. The pack stores those TY2026 single and MFJ deduction and breakpoint cells. Approximated: bracketTax applies continuous marginal rates at breakpoint thresholds and does not replicate LRO\'s printed whole-dollar base-tax constants ($216, $679, $432, and $1,357 at the gate\'s boundary taxable-income coordinates). Supported pack scope is single and married filing jointly only; head-of-household $4,685, age or blind additions, exemption credits, reduced business rates, and other return modifications are documented but unsupported.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'The signed gap at LRO boundary coordinates is +$0.125 at single $4,550 taxable, −$0.50 at single $11,400, +$0.25 at joint $9,100, and $0 at joint $22,800 — so the continuous engine neither uniformly over- nor under-states relative to LRO\'s printed whole-dollar table. This record registers the continuous-breakpoint representation authorized for the current single/MFJ pack fields and does not claim exact replication of Oregon\'s printed table or whole-return fidelity. Primary gate evidence is LRO Report #1-26; final resident-return closure is outside this record. The record expires after TY2026.',
    jurisdiction: 'state:OR',
    authority: [{
      kind: 'statute',
      citation: 'Or. Rev. Stat. §316.037(1)(b)',
      url: 'https://www.oregonlegislature.gov/bills_laws/ors/ors316.html',
      quotedText:
        'For tax years beginning in each calendar year, the Department of Revenue shall adopt a table that shall apply in lieu of the table contained in paragraph (a) of this subsection, as follows:',
    }, {
      kind: 'statute',
      citation: 'Or. Rev. Stat. §316.037(1)(b)(B)',
      url: 'https://www.oregonlegislature.gov/bills_laws/ors/ors316.html',
      quotedText: 'The rate applicable to any rate bracket as adjusted under subparagraph (A) of this paragraph may not be changed.',
    }, {
      kind: 'statute',
      citation: 'Or. Rev. Stat. §316.042',
      url: 'https://www.oregonlegislature.gov/bills_laws/ors/ors316.html',
      quotedText:
        'In the case of a joint return of spouses in a marriage, pursuant to ORS 316.122 or pursuant to ORS 316.367, the tax imposed by ORS 316.037 shall be twice the tax which would be imposed if the taxable income were cut in half.',
    }, {
      kind: 'statute',
      citation: 'Or. Rev. Stat. §316.695(1)(c)(C)(i)',
      url: 'https://www.oregonlegislature.gov/bills_laws/ors/ors316.html',
      quotedText:
        'For purposes of subparagraph (A) of this paragraph for tax years beginning on or after January 1, 2003, the Department of Revenue shall annually recompute the basic standard deduction for each category of return filer listed under subparagraph (B) of this paragraph.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Oregon Legislative Revenue Office, Oregon Public Finance: Basic Facts, Report #1-26, page C2, TY2026 basic deductions',
      url: 'https://apps.oregonlegislature.gov/liz/2026R1/Downloads/CommitteeMeetingDocument/312065',
      quotedText:
        'The Oregon standard deductions for tax year 2026 are $5,820 on joint returns, $2,910 on single and married-filing-separate returns and $4,685 for head-of-household returns.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Oregon Legislative Revenue Office, Oregon Public Finance: Basic Facts, Report #1-26, page C2, TY2026 single and joint rate schedule breakpoints',
      url: 'https://apps.oregonlegislature.gov/liz/2026R1/Downloads/CommitteeMeetingDocument/312065',
      quotedText:
        '2026 TAX YEAR RATE SCHEDULE … SINGLE RETURNS … JOINT RETURNS … Not over $4,550 … Not over $9,100 … $4,550 to $11,400 … $9,100 to $22,800 … $11,400 to $125,000 … $22,800 to $250,000 … Over $125,000 … Over $250,000',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Oregon Legislative Revenue Office, Oregon Public Finance: Basic Facts, Report #1-26, page C2, TY2026 printed whole-dollar base taxes',
      url: 'https://apps.oregonlegislature.gov/liz/2026R1/Downloads/CommitteeMeetingDocument/312065',
      quotedText:
        '$4,550 to $11,400 $216 + 6.75% of income over $4,550 … $9,100 to $22,800 $432 + 6.75% of income over $9,100 … $11,400 to $125,000 $679 + 8.75% of income over $11,400 … $22,800 to $250,000 $1,357 + 8.75% of income over $22,800',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-09-09',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.OR',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#bracketTax',
    ],
  },

  'or-stat-316-054-social-security-exclusion': {
    title: 'Oregon subtracts federally taxable Social Security from federal taxable income',
    statement:
      'Oregon starts its resident income-tax base with federal taxable income and then subtracts every Social Security benefit included in federal gross income under Internal Revenue Code section 86. The pack\'s `taxesSocialSecurity: false` expresses that full subtraction; Oregon has no separate retirement exclusion in this record, so private and public retirement distributions remain in the ordinary base.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:OR',
    authority: [{
      kind: 'statute',
      citation: 'Or. Rev. Stat. §316.054',
      url: 'https://www.oregonlegislature.gov/bills_laws/ors/ors316.html',
      quotedText:
        '316.054 Social Security benefits to be subtracted from federal taxable income. In addition to the other modifications to federal taxable income contained in this chapter, there shall be subtracted from federal taxable income the amount of any Social Security benefits, as defined in section 86 of the Internal Revenue Code (Title II Social Security or tier 1 railroad retirement benefits) included in gross income for federal income tax purposes under section 86 of the Internal Revenue Code.',
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
      'packages/engine/src/params/state/data/year2026.ts#states.OR',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'or-oar-150-316-0065-railroad-benefits-not-modeled': {
    title: 'Oregon subtracts RRB-administered supplemental railroad benefits; the engine cannot certify payer or benefit type',
    statement:
      '2025 Publication OR-17 (rev. 01-29-26) for tax year 2025 states that administrative rule extended Oregon\'s railroad-benefit subtraction to supplemental Railroad Retirement Board benefits including Tier 2, windfall, vested dual, supplemental annuities, unemployment, and sickness under OAR 150-316-0065, and that there is no Oregon subtraction for retirement benefits paid by private railroad employers. Title II Social Security and tier 1 railroad retirement included under Internal Revenue Code section 86 remain at `or-stat-316-054-social-security-exclusion`. Out of scope: `incomeStreamSchema` has no railroad-retirement type, `pensionSchema` carries only a private-or-public `source` enum, and `StateTaxParams` / `StateRetirementExclusion` carry no Railroad Retirement Board payer or supplemental-benefit category — so no accepted ordinary, wages, pension, or `ssBenefits` input can identify RRB-administered Tier 2, windfall, vested-dual, supplemental-annuity, unemployment, or sickness dollars versus a private railroad-employer pension. Generic amounts entered through those channels are still priced under the pack\'s existing rules; the engine emits no law-specific refusal for this limb. This record quotes tax year 2025 Publication OR-17 only and does not extend that treatment to later years without a later source.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
        'a railroad-retirement income stream: incomeStreamSchema has no railroad-retirement type',
        'U.S. Railroad Retirement Board payer or RRA Tier 2, windfall, vested-dual, supplemental-annuity, unemployment, or sickness category on pensionSchema, whose `source` enum is only private or public',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:OR',
    authority: [{
      kind: 'formInstruction',
      citation: 'Oregon Department of Revenue, 2025 Publication OR-17 (rev. 01-29-26), title page',
      url: 'https://www.oregon.gov/dor/forms/FormsPubs/publication-or-17_101-431_2025.pdf',
      quotedText:
        '2025 Publication OR-17 ... 150-101-431 (Rev. 01-29-26)',
    }, {
      kind: 'formInstruction',
      citation: 'Oregon Department of Revenue, 2025 Publication OR-17 (rev. 01-29-26), supplemental RRB benefits under OAR 150-316-0065',
      url: 'https://www.oregon.gov/dor/forms/FormsPubs/publication-or-17_101-431_2025.pdf',
      quotedText:
        'The subtraction has been extended by administrative rule to the other supplemental RRB benefits including Tier 2, windfall, vested dual, supplemental annuities, unemployment, and sickness (OAR 150-316-0065).',
    }, {
      kind: 'formInstruction',
      citation: 'Oregon Department of Revenue, 2025 Publication OR-17 (rev. 01-29-26), private railroad-employer pensions',
      url: 'https://www.oregon.gov/dor/forms/FormsPubs/publication-or-17_101-431_2025.pdf',
      quotedText:
        'There is no Oregon subtraction for retirement benefits paid by private railroad employers.',
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

  'ut-code-59-10-114-2-d-railroad-benefits-not-modeled': {
    title: 'Utah subtracts qualifying Railroad Retirement Act of 1974 benefits included in federal AGI',
    statement:
      'The quoted Utah Code §59-10-114(2)(d) version effective October 14, 2025 subtracts from adjusted gross income the amount of a railroad retirement benefit paid in accordance with the Railroad Retirement Act of 1974 to a resident or nonresident individual for the taxable year, to the extent that benefit is included in adjusted gross income on the individual\'s federal return for that year. That October 14 date is the quoted edition\'s effective date, not the original enactment of the railroad exclusion. `computeStateTaxDetailResult` applies that subtraction only to characterized Railroad Retirement Act benefits with a known federally included amount; a private railroad-employer pension is not treated as an RRA benefit. The input is incomplete, rather than zero, when the source or federal-inclusion fact is not established. The subtraction is distinct from the Social Security benefits credit at `ut-code-59-10-114-social-security-tax-credit`; a RRB amount already subtracted is not eligible Social Security-credit base.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:UT',
    authority: [{
      kind: 'statute',
      citation: 'Utah Code §59-10-114, edition effective 10/14/2025',
      url: 'https://le.utah.gov/xcode/Title59/Chapter10/C59-10-S114_2025101420251206.pdf',
      quotedText:
        'Effective 10/14/2025 59-10-114 Additions to and subtractions from adjusted gross income of an individual.',
    }, {
      kind: 'statute',
      citation: 'Utah Code §59-10-114(2)(d)',
      url: 'https://le.utah.gov/xcode/Title59/Chapter10/C59-10-S114_2025101420251206.pdf',
      quotedText:
        '(d) the amount of a railroad retirement benefit: (i) paid: (A) in accordance with The Railroad Retirement Act of 1974, 45 U.S.C. Sec. 231 et seq.; (B) to a resident or nonresident individual; and (C) for the taxable year; and (ii) to the extent that railroad retirement benefit is included in adjusted gross income on that resident or nonresident individual\'s federal individual income tax return for that taxable year;',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2025,
    effectiveThrough: null,
    verifiedOn: '2026-09-09',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/tax/stateWestExtras.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.UT',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult',
      'packages/engine/src/tax/stateWestExtras.ts#utahRailroadSubtraction',
    ],
  },

  'ut-code-59-10-104-2026-individual-rate': {
    title: 'Utah taxes resident individuals at 4.45% for tax years beginning in 2026',
    statement:
      'For taxable years beginning on or after January 1, 2026, Utah imposes a single 4.45 percent rate on a resident individual’s Utah taxable income. The pack carries one flat bracket at that rate for supported single and married-filing-jointly statuses; `bracketTax` applies it to the modeled Utah base before credits. Utah’s taxpayer, Social Security, retirement, and military credits are outside this pre-credit rate record.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This record registers only the enacted flat rate on modeled taxable income. The separate Social Security benefits credit is registered at `ut-code-59-10-114-social-security-tax-credit`. Whole-return accuracy is outside this record.',
    jurisdiction: 'state:UT',
    authority: [{
      kind: 'statute',
      citation: '2026 Utah S.B. 60, enrolled, §3 (amending Utah Code §59-10-104)',
      url: 'https://le.utah.gov/~2026/bills/sbillenr/SB0060.pdf',
      quotedText:
        '(1) A tax is imposed on the state taxable income of a resident individual as provided in this section.',
    }, {
      kind: 'statute',
      citation: '2026 Utah S.B. 60, enrolled, §3 (4.45% rate)',
      url: 'https://le.utah.gov/~2026/bills/sbillenr/SB0060.pdf',
      quotedText:
        '(2) For purposes of Subsection (1), for a taxable year, the tax is an amount equal to the … product of: … (a) the resident individual\'s state taxable income for that taxable year; and … (b) 4.45%.',
    }, {
      kind: 'statute',
      citation: '2026 Utah S.B. 60, enrolled, §§4-5',
      url: 'https://le.utah.gov/~2026/bills/sbillenr/SB0060.pdf',
      quotedText:
        'Section 4. Effective Date. … This bill takes effect on May 6, 2026. … Section 5. Retrospective operation. … This bill has retrospective operation for a taxable year beginning on or after January 1, … 2026.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-07',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#UT',
      'packages/engine/src/tax/stateTax.ts#bracketTax',
    ],
  },

  'ut-code-59-10-114-social-security-tax-credit': {
    title: 'Utah taxes Social Security but offers a separate Social Security benefits credit',
    statement:
      'Effective January 1, 2026, Utah permits a claimant receiving a Social Security benefit to claim a nonrefundable credit equal to the percentage in §59-10-104(2) multiplied by the benefit included in state taxable income. The credit is reduced by 2.5 cents for each dollar of modified adjusted gross income above $54,000 for a single return or $90,000 for a joint return. S.B. 60 makes the referenced §59-10-104(2) rate 4.45 percent for tax years beginning in 2026. `computeStateTaxDetailResult` uses the characterized amount actually included in Utah taxable income, subtracts any overlapping RRB amount already removed under §59-10-114(2)(d), applies the filing-status phaseout, and caps the nonrefundable credit at remaining Utah liability. Missing inclusion, MAGI, or overlap evidence is incomplete rather than a zero credit. The credit is an alternative to the general retirement credit at §59-10-1019 and may be paired with the military credit at §59-10-1043.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:UT',
    authority: [{
      kind: 'statute',
      citation: 'Utah Code §59-10-1042(2), effective Jan. 1, 2026',
      url: 'https://le.utah.gov/xcode/Title59/Chapter10/C59-10-S1042_2026010120250507.pdf',
      quotedText:
        '(2) Except as provided in Section 59-10-1002.2 and Subsections (3) and (4), each claimant on a return that receives a social security benefit may claim a nonrefundable tax credit against taxes otherwise due under this part equal to the product of: (a) the percentage listed in Subsection 59-10-104(2); and (b) the claimant\'s social security benefit that is included in the claimant\'s state taxable income for the taxable year.',
    }, {
      kind: 'statute',
      citation: 'Utah Code §59-10-1042(4), effective Jan. 1, 2026',
      url: 'https://le.utah.gov/xcode/Title59/Chapter10/C59-10-S1042_2026010120250507.pdf',
      quotedText:
        '(4) The tax credit allowed by Subsection (2) claimed on a return filed under this part shall be reduced by $.025 for each dollar by which modified adjusted gross income for purposes of the return exceeds: (a) for a return filed under this chapter that is allowed a married filing separately status, $45,000; (b) for a return filed under this chapter that is allowed a single filing status, $54,000; (c) for a return filed under this chapter that is allowed a head of household filing status, $90,000; or (d) for a return filed under this chapter that is allowed a joint filing status, $90,000.',
    }, {
      kind: 'statute',
      citation: '2026 Utah S.B. 60, enrolled, §3 (referenced rate)',
      url: 'https://le.utah.gov/~2026/bills/sbillenr/SB0060.pdf',
      quotedText:
        '(2) For purposes of Subsection (1), for a taxable year, the tax is an amount equal to the … product of: … (a) the resident individual\'s state taxable income for that taxable year; and … (b) 4.45%.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-07',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#UT',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult',
    ],
  },

  'ut-code-59-10-1019-retirement-credit': {
    title: 'Utah provides a $450 nonrefundable retirement credit to each eligible claimant',
    statement:
      'Utah Code §59-10-1019 makes a claimant born on or before December 31, 1952 eligible regardless of whether the claimant is retired. Each eligible claimant may claim a $450 nonrefundable credit, reduced by 2.5 cents for each dollar of return modified adjusted gross income above the stated filing-status threshold. A return claiming the Social Security credit under §59-10-1042 or the military retirement credit under §59-10-1043 cannot claim this alternative. `computeStateTaxDetailResult` applies the return-level election, phaseout, and liability cap; exact dates of birth and Utah MAGI are required rather than inferred from a rounded age or an ordinary-income amount.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:UT',
    authority: [{
      kind: 'statute',
      citation: 'Utah Code §59-10-1019(1)(a), edition effective 03/23/2022',
      url: 'https://le.utah.gov/xcode/Title59/Chapter10/C59-10-S1019_2022032320220323.pdf',
      quotedText: '"Eligible claimant" means a claimant, regardless of whether that claimant is retired, who was born on or before December 31, 1952.',
    }, {
      kind: 'statute',
      citation: 'Utah Code §59-10-1019(2)–(4), edition effective 03/23/2022',
      url: 'https://le.utah.gov/xcode/Title59/Chapter10/C59-10-S1019_2022032320220323.pdf',
      quotedText: 'Except as provided in Section 59-10-1002.2 and Subsections (3) and (4), each eligible claimant may claim a nonrefundable tax credit of $450 against taxes otherwise due under this part. ... An eligible claimant may not: ... claim a tax credit under this section for a taxable year if a tax credit under Section 59-10-1042 or 59-10-1043 is claimed on the claimant\'s return for the same taxable year. ... The tax credit allowed by Subsection (2) claimed on a return filed under this part shall be reduced by $.025 for each dollar by which modified adjusted gross income for purposes of the return exceeds:',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2022,
    effectiveThrough: null,
    verifiedOn: '2026-09-12',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/tax/stateWestExtras.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.UT',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult',
      'packages/engine/src/tax/stateWestExtras.ts#utahRetirementCredit',
    ],
  },

  'ut-code-59-10-114-2-i-401a-prior-state-tax-subtraction': {
    title: 'Utah subtracts a federally included qualified-plan distribution previously taxed by another state',
    statement:
      'Utah Code §59-10-114(2)(i) permits the specified subtraction only for a distribution from a qualified IRC §401(a) retirement plan that is included in federal adjusted gross income and was taxed by another state, the District of Columbia, or a United States possession in the contribution year. `computeStateTaxDetailResult` requires the §401(a) identity and the prior-tax state evidence, and limits the subtraction to characterized federally included dollars and remaining state basis. IRA, 403(b), and 457 distributions do not satisfy this record merely because they are retirement distributions. A 401(k) label alone neither establishes nor disproves qualification under section 401(a); actual plan and prior-tax history control.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:UT',
    authority: [{
      kind: 'statute',
      citation: 'Utah Code §59-10-114(2)(i), edition effective 10/14/2025',
      url: 'https://le.utah.gov/xcode/Title59/Chapter10/C59-10-S114_2025101420251206.pdf',
      quotedText: '(i) an amount of a distribution from a qualified retirement plan under Section 401(a), Internal Revenue Code, if: (i) the amount of the distribution is included in adjusted gross income on the resident or nonresident individual\'s federal individual income tax return for the taxable year; and (ii) for the taxable year when the amount of the distribution was contributed to the qualified retirement plan, the amount of the distribution: (A) was not included in adjusted gross income on the resident or nonresident individual\'s federal individual income tax return for the taxable year; and (B) was taxed by another state of the United States, the District of Columbia, or a possession of the United States;',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2025,
    effectiveThrough: null,
    verifiedOn: '2026-09-12',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/tax/stateWestExtras.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.UT',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult',
      'packages/engine/src/tax/stateWestExtras.ts#utahPriorTaxed401aSubtraction',
    ],
  },

  'wa-dor-no-broad-individual-income-tax': {
    title: 'Washington has no broad individual income-tax figure in this pack',
    statement:
      'Washington\'s staged Department of Revenue page describes a capital-gains excise that applies only to individuals and only on sales or exchanges of long-term capital assets under RCW 82.87, not a broad tax on wages, pensions, IRA distributions, or Social Security. The pack therefore keeps `hasIncomeTax: false`, so the ordinary-income state-tax path returns zero and `capitalGainsAsOrdinary: true` is inert on that path. The separate capital-gains excise levy itself is registered at `wa-rcw-82-87-capital-gains-excise` and is not settled by this record.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:WA',
    authority: [{
      kind: 'stateAgencyPublication',
      citation: 'Washington Department of Revenue, Capital gains tax',
      url: 'https://dor.wa.gov/taxes-rates/other-taxes/capital-gains-tax',
      quotedText:
        'The 2021 Washington State Legislature passed ESSB 5096 ( RCW 82.87 ) which created a 7% tax on the sale or exchange of long-term capital assets such as stocks, bonds, business interests, or other investments and tangible assets. This tax only applies to individuals.',
    }, {
      kind: 'statute',
      citation: 'Wash. Rev. Code §82.87.040(1)',
      url: 'https://app.leg.wa.gov/RCW/default.aspx?cite=82.87.040',
      quotedText:
        '(1)(a) Beginning January 1, 2022, an excise tax is imposed on the sale or exchange of long-term capital assets. Only individuals are subject to payment of the tax, which equals seven percent multiplied by an individual\'s Washington capital gains. (b) Beginning January 1, 2025, an additional excise tax is imposed on the sale or exchange of long-term capital assets, which equals 2.90 percent multiplied by the portion of an individual\'s Washington capital gains exceeding $1,000,000.',
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
      'packages/engine/src/params/state/data/year2026.ts#WA',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'wa-rcw-82-87-capital-gains-excise': {
    title: 'Washington’s long-term capital-gains excise is absent from the state-tax surface',
    statement:
      'RCW 82.87.040 imposes a separate excise on an individual’s Washington capital gains from sales or exchanges of long-term capital assets, with a further tier above $1,000,000, and RCW 82.87.050 excepts retirement-savings vehicles. Typed absence: `model/plan.ts` and `params/types.ts` do not carry the holding-period, Washington allocation, adjusted-capital-gain, exemption, deduction, or $1,000,000 tier facts needed to price that levy, and `tax/stateTax.ts` has no refusal naming the missing excise — with `hasIncomeTax: false` a capital-gain input emits zero state tax and continues, so the ordinary path never surfaces the levy.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'the holding period that makes a capital asset long-term',
      'the Washington allocation of the gain',
      'adjusted capital gain after the statutory exemptions and deductions',
      'the 1,000,000-dollar tier boundary in the ParameterPack',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:WA',
    authority: [{
      kind: 'statute',
      citation: 'Wash. Rev. Code §82.87.040(1)',
      url: 'https://app.leg.wa.gov/RCW/default.aspx?cite=82.87.040',
      quotedText:
        '(1)(a) Beginning January 1, 2022, an excise tax is imposed on the sale or exchange of long-term capital assets. Only individuals are subject to payment of the tax, which equals seven percent multiplied by an individual\'s Washington capital gains. (b) Beginning January 1, 2025, an additional excise tax is imposed on the sale or exchange of long-term capital assets, which equals 2.90 percent multiplied by the portion of an individual\'s Washington capital gains exceeding $1,000,000.',
    }, {
      kind: 'statute',
      citation: 'Wash. Rev. Code §82.87.050, lead-in',
      url: 'https://app.leg.wa.gov/RCW/default.aspx?cite=82.87.050',
      quotedText:
        'This chapter does not apply to the sale or exchange of:',
    }, {
      kind: 'statute',
      citation: 'Wash. Rev. Code §82.87.050(3)',
      url: 'https://app.leg.wa.gov/RCW/default.aspx?cite=82.87.050',
      quotedText:
        '(3) Assets held under a retirement savings account under Title 26 U.S.C. Sec. 401(k) of the internal revenue code, a tax-sheltered annuity or custodial account described in Title 26 U.S.C. Sec. 403(b) of the internal revenue code, a deferred compensation plan under Title 26 U.S.C. Sec. 457(b) of the internal revenue code, an individual retirement account or individual retirement annuity described in Title 26 U.S.C. Sec. 408 of the internal revenue code, a Roth individual retirement account described in Title 26 U.S.C. Sec. 408A of the internal revenue code, an employee defined contribution program, an employee defined benefit plan, or a similar retirement savings vehicle, whether foreign or domestic, that penalizes withdrawals until the legal or beneficial owner reaches a certain age;',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Washington Department of Revenue, Capital gains tax',
      url: 'https://dor.wa.gov/taxes-rates/other-taxes/capital-gains-tax',
      quotedText:
        'The 2021 Washington State Legislature passed ESSB 5096 ( RCW 82.87 ) which created a 7% tax on the sale or exchange of long-term capital assets such as stocks, bonds, business interests, or other investments and tangible assets. This tax only applies to individuals.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/params/types.ts',
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#planSchema',
      'packages/engine/src/params/state/data/year2026.ts#WA',
      'packages/engine/src/params/types.ts#ParameterPack',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetail',
    ],
  },
  'co-39-22-104-p-7-high-income-addback': {
    title: 'Colorado limits federal deductions for high-AGI returns in 2026',
    statement: 'For federal AGI at least $300,000, add back the claimed federal standard or itemized deduction exceeding $1,000 single or $2,000 joint. Below that threshold no subsection (p.7) addback applies. The actual federal deduction used is required; applying another Colorado standard deduction would count it twice.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:CO',
    authority: [
      {
        kind: 'statute',
        citation: 'C.R.S. 39-22-104(3)(p.7)',
        url: 'https://olls.info/crs/crs2026-title-39.htm',
        quotedText: 'For income tax years commencing on or after January 1, 2026, for taxpayers who claim itemized deductions as defined in section 63 (d) of the internal revenue code or the standard deduction as defined in section 63 (c) of the internal revenue code and who have a federal adjusted gross income in the income tax year equal to or exceeding three hundred thousand dollars: … For a taxpayer who files a single return, the amount by which the itemized deductions deducted from gross income under section 63 (a) of the internal revenue code exceed, or the standard deduction deducted from gross income under section 63 (c) of the internal revenue code exceeds one thousand dollars; and … For taxpayers who file a joint return, the amount by which the itemized deductions deducted from gross income under section 63 (a) of the internal revenue code exceed, or the standard deduction deducted from gross income under section 63 (c) of the internal revenue code exceeds two thousand dollars.',
      },
    ],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-12',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/tax/stateColoradoTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.CO',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult',
      'packages/engine/src/tax/stateColoradoTax.ts#coloradoHighAgiFederalDeductionAddback',
    ],
  },
  'id-code-63-3022a-qualified-retirement-deduction': {
    title: 'Idaho permits only named and individually eligible retirement benefits',
    statement: 'Eligible CSRS/FSRDS and specified Idaho firefighter/police benefits require age 65 or age 62 and disability. Military has its distinct disabled/age-62/employment-filing test. Married taxpayers must file jointly. FERS and generic private or public plans are excluded. The statutory maximum is reduced by household Social Security and Railroad Retirement benefits and cannot exceed qualifying federally included income. Survivor and remarriage facts remain necessary where applicable.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:ID',
    authority: [
      {
        kind: 'statute',
        citation: 'Idaho Code 63-3022A(1)–(3)',
        url: 'https://legislature.idaho.gov/statutesrules/idstat/title63/t63ch30/sect63-3022a/',
        quotedText: 'If such individual has either attained age sixty-five (65) years or has attained age sixty-two (62) years and is classified as disabled: (i) Retirement annuities paid to a retired employee or the unmarried widow or widower of a retired employee by the United States of America under the: 1. Civil service retirement system; or 2. Foreign service retirement and disability system; or 3. Offset program of the civil service retirement system or foreign service retirement and disability system. (ii) Retirement benefits paid from the firefighters’ retirement fund of the state of Idaho to a retired firefighter or the unremarried widow or widower of a retired firefighter. (iii) Retirement benefits paid to a retired Idaho city police officer: 1. By a city or its agent in regard to a police retirement fund that no longer admits new members and on January 1, 2012, was administered by a city in this state; or 2. In regard to a police retirement fund that no longer admits new members and on January 1, 2012, was administered by the public employee retirement system of Idaho; or 3. By the public employee retirement system of Idaho to a retired police officer in regard to Idaho employment not included in the federal social security retirement system; or 4. An unremarried widow or widower of a person described in 1., 2., or 3. of this subparagraph. … Retirement benefits paid by the United States of America to a retired member of the military services of the United States, or the unremarried widow or widower of such member, who: (i) Is classified as disabled, as defined in subsection (4) of this section; (ii) Has attained the age of sixty-two (62) years by the end of the tax year; or (iii) Was employed during the tax year and received sufficient income from such employment to be required to file a federal return under section 6012(a)(1) of the Internal Revenue Code. … The amount of retirement benefits that may be deducted from taxable income shall be an amount not in excess of maximum retirement benefits under the social security act, as amended, on the date on which this act is passed and approved, including adjustments to be made based on consumer price index adjustments provided in section 215 of the social security act. The state tax commission shall ascertain benefit changes made in accordance with the social security act and publish the appropriate deduction amounts provided by this section reflecting such changes annually. … Taxpayers not described in paragraphs (a), (b), (c), and (d) of this subsection may not deduct any amount of retirement benefits under this section. This includes retirement benefits paid by the federal employees retirement system or foreign service pension system. … The total deduction under this section may not exceed the total amount of retirement benefits or annuities that are described in subsection (1) of this section and that are included in the taxpayer’s gross income in the tax year. If the taxpayer or the taxpayer’s spouse receives retirement benefits under the federal railroad retirement act or the federal social security act in the tax year, then the amount of any retirement annuities computed under subsection (2) of this section shall be reduced by the amount of such federal railroad retirement act and federal social security act retirement benefits received by either the taxpayer or the taxpayer’s spouse, and the lesser of the amount so computed or the total amount of retirement benefits or annuities that are described in subsection (1) of this section and that are included in the taxpayer’s gross income shall constitute the allowable deduction.',
      },
    ],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-12',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/tax/stateWestExtras.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.ID',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult',
      'packages/engine/src/tax/stateWestExtras.ts#idahoQualifiedRetirementDeduction',
    ],
  },
  'mt-long-term-capital-gain-schedule': {
    title: 'Montana stacks long-term gains above ordinary taxable income',
    statement: 'TY2026 net long-term capital gains use 3.0% and 4.1%, with the rate boundary shared with ordinary income: $47,500 single/MFS, $71,250 HOH and $95,000 joint/QSS. Ordinary taxable income consumes the lower band first. A return cannot apply the full lower capital-gain band again independently of ordinary income.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:MT',
    authority: [
      {
        kind: 'stateAgencyPublication',
        citation: 'Montana DOR HB337 notice',
        url: 'https://revenuefiles.mt.gov/news/recent-news/HB-337',
        quotedText: 'The rates on long-term capital gains remain at 3.0% and 4.1%; however, the bill does adjust the brackets to match the new ranges for ordinary income.',
      },
    ],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-09-12',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/tax/stateWestExtras.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.MT',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult',
      'packages/engine/src/tax/stateWestExtras.ts#montanaLtcgTax',
    ],
  },
  'or-316-157-retirement-income-credit': {
    title: 'Oregon caps the age-62 retirement credit by net pension and liability',
    statement: 'An eligible recipient age 62 or older receives 9% of net qualifying pension income, capped by remaining Oregon liability. Net pension is capped at $7,500 nonjoint/$15,000 joint, reduced by household Social Security/Tier-I benefits and household income above $15,000/$30,000. Only qualifying pension included in Oregon taxable income enters; a gross pension amount alone does not establish the credit.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:OR',
    authority: [
      {
        kind: 'statute',
        citation: 'ORS 316.157',
        url: 'https://www.oregonlegislature.gov/bills_laws/ors/ors316.html',
        quotedText: '(1) In the case of an eligible individual, there shall be allowed as a credit against the taxes otherwise due under this chapter for the taxable year an amount equal to the lesser of the tax liability of the taxpayer or nine percent of net pension income. (2) For purposes of this section: (a) “Eligible individual” means any individual who is receiving pension income and who has attained 62 years of age before the close of the taxable year. (b) “Household income” means the aggregate income of the taxpayer and the spouse of the taxpayer who reside in the household, that was received during the taxable year for which a credit is claimed, except that “household income” does not include Social Security benefits received by the taxpayer or the spouse of the taxpayer. (c) “Income” means “adjusted gross income” as defined in the federal Internal Revenue Code, as amended and in effect on December 31, 2023, even when the amendments take effect or become operative after that date, relating to the measurement of taxable income of individuals, estates and trusts, with the following modifications: (A) There shall be added to adjusted gross income the following items of otherwise exempt income: (i) The gross amount of any otherwise exempt pension less return of investment, if any. (ii) Child support received by the taxpayer. (iii) Inheritances. (iv) Gifts and grants, the sum of which are in excess of $500 per year. (v) Amounts received by a taxpayer or spouse of a taxpayer for support from a parent who is not a member of the taxpayer’s household. (vi) Life insurance proceeds. (vii) Accident and health insurance proceeds, except reimbursement of incurred medical expenses. (viii) Personal injury damages. (ix) Sick pay that is not included in federal adjusted gross income. (x) Strike benefits excluded from federal gross income. (xi) Worker’s compensation, except for reimbursement of medical expense. (xii) Military pay and benefits. (xiii) Veteran’s benefits. (xiv) Payments received under the federal Social Security Act that are excluded from federal gross income. (xv) Welfare payments, except as follows: (I) Payments for medical care, drugs and medical supplies, if the payments are not made directly to the welfare recipient; (II) In-home services authorized and approved by the Department of Human Services; and (III) Direct or indirect reimbursement of expenses paid or incurred for participation in work or training programs. (xvi) Nontaxable dividends. (xvii) Nontaxable interest not included in federal adjusted gross income. (xviii) Rental allowance paid to a minister that is excluded from federal gross income. (xix) Income from sources without the United States that is excluded from federal gross income. (B) Adjusted gross income shall be increased due to the disallowance of the following deductions: (i) The amount of the net loss, in excess of $1,000, from all dispositions of tangible or intangible properties. (ii) The amount of the net loss, in excess of $1,000, from the operation of a farm or farms. (iii) The amount of the net loss, in excess of $1,000, from all operations of a trade or business, profession or other activity entered into for the production or collection of income. (iv) The amount of the net loss, in excess of $1,000, from tangible or intangible property held for the production of rents, royalties or other income. (v) The amount of any net operating loss carryovers or carrybacks included in federal adjusted gross income. (vi) The amount, in excess of $5,000, of the combined deductions or other allowances for depreciation, amortization or depletion. (vii) The amount added or subtracted, as required within the context of this section, for adjustments made under ORS 316.680 (2)(d) and 316.707 to 316.737. (C) “Income” does not include the following: (i) Any governmental grant that must be used by the taxpayer for rehabilitation of the homestead of the taxpayer. (ii) Any refund of Oregon personal income taxes that were imposed under this chapter. (d) “Net pension income” means: (A) For eligible individuals filing a joint return, the lesser of the pension income of the eligible individuals received during the taxable year or the excess, if any, of $15,000 over the sum of the following amounts: (i) Any Social Security benefits received by the eligible individual, or by the spouse of the individual, during the taxable year; and (ii) The excess, if any, of household income over $30,000. (B) For an eligible individual filing a return other than a joint return, the lesser of the pension income of the eligible individual received during the taxable year or the excess, if any, of $7,500 over the sum of the following amounts: (i) Any Social Security benefits received by the eligible individual during the taxable year; and (ii) The excess, if any, of household income over $15,000. (e) “Pension income” means income included in Oregon taxable income from: (A) Distributions from or pursuant to an employee pension benefit plan, as defined in section 3(2) of the Employee Retirement Income Security Act of 1974, which satisfies the requirements of section 401 of the Internal Revenue Code; (B) Distributions from or pursuant to a public retirement system of this state or a political subdivision of this state, or a public retirement system created by an Act of this state or a political subdivision of this state, or the public retirement system of any other state or local government; (C) Distributions from or pursuant to a federal retirement system created by the federal government for any officer or employee of the United States, including any person retired from service in the United States Civil Service, the Armed Forces of the United States or any agency or subdivision thereof; (D) Distributions or withdrawals from or pursuant to an eligible deferred compensation plan which satisfies the requirements of section 457 of the Internal Revenue Code; (E) Distributions or withdrawals from or pursuant to an individual retirement account, annuity or trust or simplified employee pension which satisfies the requirements of section 408 of the Internal Revenue Code; and (F) Distributions or withdrawals from or pursuant to an employee annuity, including custodial accounts treated as annuities, subject to section 403 (a) or (b) of the Internal Revenue Code. (f) “Social Security benefits” means Social Security benefits, as defined in section 86 of the Internal Revenue Code (Title II Social Security or tier 1 railroad retirement benefits).',
      },
    ],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-12',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/tax/stateWestExtras.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.OR',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult',
      'packages/engine/src/tax/stateWestExtras.ts#oregonRetirementIncomeCredit',
    ],
  },
  'ut-code-59-10-1043-military-retirement-credit': {
    title: 'Utah credits taxable military retirement at the current state rate',
    statement: 'The military credit equals 4.45% for TY2026 of qualifying military retirement, including qualifying survivor pay, included in federal AGI. Social Security, IRA/401(k) withdrawals and nonmilitary federal pensions are excluded. The return may combine military with Social Security credit, or elect general retirement credit instead. Nonrefundable liability and residency apportionment limits apply; no carryforward is created.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:UT',
    authority: [
      {
        kind: 'statute',
        citation: 'Utah Code 59-10-1043(1)–(3)',
        url: 'https://le.utah.gov/xcode/Title59/Chapter10/C59-10-S1043_2022032320220323.pdf',
        quotedText: '(1) As used in this section: (a) (i) "Military retirement pay" means retirement pay, including survivor benefits, that relates to service in the armed forces or the reserve components, as described in 10 U.S.C. Sec. 10101. (ii) "Military retirement pay" does not include: (A) Social Security income; (B) 401(k) or IRA distributions; or (C) income from other sources. (b) "Survivor benefits" means the retired pay portion of the benefits described in 10 U.S.C. Secs. 1447 through 1455. (2) Except as provided in Section 59-10-1002.2, a claimant who receives military retirement pay may claim a nonrefundable tax credit against taxes equal to the product of: (a) the percentage listed in Subsection 59-10-104(2); and (b) the amount of military retirement pay that is included in adjusted gross income on the claimant\'s federal income tax return for the taxable year. (3) A claimant may not: (a) carry forward or carry back the amount of a tax credit that exceeds the claimant\'s tax liability for the taxable year; or (b) claim a tax credit under this section for a taxable year if a tax credit under Section 59-10-1019 is claimed on the claimant\'s return for the same taxable year.',
      },
    ],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-12',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/tax/stateWestExtras.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.UT',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult',
      'packages/engine/src/tax/stateWestExtras.ts#utahMilitaryRetirementCredit',
      'packages/engine/src/tax/stateWestExtras.ts#utahSelectNonrefundableCredit',
    ],
  },
  'ca-hsa-state-basis-nonconformity': {
    title: 'California taxes HSA contributions and current earnings without taxing basis twice',
    statement: 'California reverses the federal HSA deduction and excluded employer contributions and includes current HSA interest, dividends and realized gains. Federally taxable nonqualified HSA withdrawals are removed from that federal starting component; qualified cash withdrawals are not a second deduction. Separate state basis and disposition facts prevent taxing principal twice. Unknown annual activity or basis is incomplete, not known zero. State basis must remain keyed by owner/account and be committed only for an accepted annual result.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:CA',
    authority: [
      {
        kind: 'formInstruction',
        citation: 'FTB 2025 Schedule CA, lines 1h, 2, 8f and 13',
        url: 'https://www.ftb.ca.gov/forms/2025/2025-540-ca-instructions.html',
        quotedText: 'Interest or earnings in an HSA are taxable in the year earned. … California law does not conform.',
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
      'packages/engine/src/params/state/data/year2026.ts#states.CA',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult',
      'packages/engine/src/tax/stateQcdHsa.ts#californiaHsaAccountAdjustment',
      'packages/engine/src/tax/stateQcdHsa.ts#californiaHsaCollectionAdjustment',
    ],
  },
  'hi-head-of-household-rate-schedule': {
    title: 'Hawaii uses the head-of-household schedule',
    statement: 'HRS 235-51 supplies a distinct head-of-household schedule. Its first band ends at $14,400 and is taxed at 1.4%, then 3.2% through $21,600, 5.5% through $28,800, with the remaining statutory bands in the versioned pack. HOH does not borrow single or joint bands. This record concerns the rate schedule on an established taxable-income base, not all Hawaii credits or filing eligibility.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:HI',
    authority: [
      {
        kind: 'statute',
        citation: 'HRS 235-51(b), HOH table effective after December 31, 2024',
        url: 'https://files.hawaii.gov/tax/legal/hrs/hrs_235.pdf',
        quotedText: 'There is hereby imposed on the taxable income of every head of a household a tax determined in accordance with the following table:',
      },
    ],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-12',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/tax/stateWestExtras.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.HI',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult',
      'packages/engine/src/tax/stateWestExtras.ts#hawaiiTaxForStatus',
    ],
  },
  'state-direct-qcd-conformity-policies': {
    title: 'Arkansas direct QCDs use the adopted 2017 federal ceiling',
    statement: 'Arkansas adopts the listed federal retirement provisions, including IRC 408, as in effect January 1, 2017. Its direct IRA-to-charity QCD exclusion therefore uses the adopted $100,000 annual per-owner ceiling, not the current federal indexed ceiling. This is an inference from express adoption, corroborated by DFA’s expenditure inventory, not a claimed 2026 QCD-specific ruling. Eligibility, direct transfer, otherwise-taxable amounts and prior-year-to-date transfers must be established. Excess interacts with separately supported Arkansas retirement deductions once. Unknown policy or eligibility facts remain incomplete; split-interest transactions do not inherit this direct-QCD treatment.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:AR',
    authority: [
      {
        kind: 'statute',
        citation: 'Arkansas Act 155 (2017) section 18, amendment replaces 2015 with 2017',
        url: 'https://www.arkleg.state.ar.us/Home/FTPDocument?path=%2FACTS%2F2017R%2FPublic%2FACT155.pdf',
        quotedText: 'Title 26 U.S.C. §§ 72, 219, 402-404, 406-416, and 457, … as in effect on January 1, 2015 2017; and',
      },
      {
        kind: 'irsPublication',
        citation: 'IRS Publication 590-B (2016), adopted-era direct QCD ceiling',
        url: 'https://www.irs.gov/pub/irs-prior/p590b--2016.pdf',
        quotedText: 'The maximum annual exclusion for QCDs is $100,000.',
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
      'packages/engine/src/params/state/data/year2026.ts#states.AR',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult',
      'packages/engine/src/tax/stateQcdHsa.ts#stateDirectQcdCollectionAdjustment',
      'packages/engine/src/tax/stateQcdHsa.ts#newJerseyWorksheetCTaxableAmount',
    ],
  },
  'hi-direct-qcd-conformity': {
    title: 'Hawaii 2026 adopts direct QCD exclusion with the 2025 federal Code',
    statement: 'Hawaii Act 35 (2026) updates the Code adoption to December 31, 2025 for taxable years after December 31, 2025, subject to enumerated exceptions. The direct IRC 408(d)(8) exclusion survives those exceptions; retaining the federal excluded amount requires no extra state subtraction. This is a statutory adoption inference. Unknown direct-transfer eligibility and unsupported split-interest transactions do not silently conform.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:HI',
    authority: [
      {
        kind: 'statute',
        citation: 'Hawaii Act 35 (2026), section 2 (amended date 2025), section 7',
        url: 'https://data.capitol.hawaii.gov/sessions/session2026/bills/GM1135_.PDF',
        quotedText: '"Internal Revenue Code" means subtitle A, chapter 1, … of the federal Internal Revenue Code of 1986, as amended as of … December 31, … 2025, as it applies to the determination of … gross income, adjusted gross income, ordinary income and loss, … and taxable income',
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
      'packages/engine/src/params/state/data/year2026.ts#states.HI',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetailResult',
      'packages/engine/src/tax/stateQcdHsa.ts#stateDirectQcdCollectionAdjustment',
    ],
  },
} satisfies Record<string, TaxRuleRecord>
