/**
 * State records for the South Central states: AL, KY, MS, TN, AR, LA, OK, TX.
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
export const southCentralStateRecords = {
  // Texas takes two records rather than one because its two prohibitions have
  // two different start years. Section 24-a has barred a tax on individual net
  // income since the voters adopted it in November 2019; section 24-b did not
  // bar a tax on capital gains until November 2025. A single record spanning
  // both would have to carry one `effectiveFrom`, and either value makes it lie
  // about half its range: 2020 asserts a capital-gains prohibition that did not
  // exist until 2026, and 2026 disclaims a net-income prohibition that has been
  // in force for six years. Split, each record is true of every year it claims.
  'tx-const-8-24-a-individual-income-tax-prohibited': {
    title: 'Texas may not tax an individual’s net income',
    statement:
      'Section 24-a, adopted November 5, 2019, forbids the Legislature to impose a tax on the net incomes of individuals. A Texas retiree\'s pension, IRA and employer-plan distributions and Social Security are therefore beyond the state\'s reach, which is what the pack\'s `hasIncomeTax: false` encodes. What the quoted text does NOT mention is capital gains; that prohibition arrived separately and later, and is registered at tx-const-8-24-b-capital-gains-tax-prohibited.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:TX',
    authority: [{
      // Re-pointed 2026-08-05 from statutes.capitol.texas.gov, which has become
      // a JavaScript application: every /Docs/CN/ path now answers 200 with a
      // 1,354-character shell and no constitutional text, including the .pdf
      // path, which returns HTML. A citation to it cannot be checked against
      // the words it claims to quote by any automated means, which is the one
      // property this registry's citations exist to have. The Texas Legislative
      // Council publishes the same constitution as a real PDF with a clean text
      // layer, dated on its cover page — "Includes Amendments Through the
      // November 4, 2025, Constitutional Amendment Election" — which is also
      // what makes it a better citation for section 24-b below.
      kind: 'statute',
      citation: 'Tex. Const. art. VIII, sec. 24-a',
      url: 'https://tlc.texas.gov/docs/legref/TxConst.pdf',
      quotedText:
        'INDIVIDUAL INCOME TAX PROHIBITED. The legislature may not impose a tax on the net incomes of individuals, including an individual\'s share of partnership and unincorporated association income. (Added Nov. 5, 2019.)',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2020,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#TX',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'tx-const-8-24-b-capital-gains-tax-prohibited': {
    title: 'Texas may not tax an individual’s capital gains from 2026',
    statement:
      'Section 24-b, adopted November 4, 2025, forbids the Legislature to impose a tax on the realized OR unrealized capital gains of an individual, family, estate or trust, subject only to carve-outs for ad valorem, sales and use taxes. It is a separate prohibition from section 24-a rather than a restatement of it: 24-a reaches "net incomes" and its text, quoted at tx-const-8-24-a-individual-income-tax-prohibited, does not mention capital gains. This record therefore claims nothing about tax years before 2026 — only that from 2026 a zero Texas figure on a realized gain is what the constitution requires. The engine has returned zero throughout, carried by `capitalGainsAsOrdinary: false` alongside `hasIncomeTax: false`.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:TX',
    authority: [{
      kind: 'statute',
      citation: 'Tex. Const. art. VIII, sec. 24-b(a)',
      url: 'https://tlc.texas.gov/docs/legref/TxConst.pdf',
      quotedText:
        'Subject to Subsection (b) of this section, the legislature may not impose a tax on the realized or unrealized capital gains of an individual, family, estate, or trust, including a tax on the sale or transfer of a capital asset that is payable by the individual, family, estate, or trust selling or transferring the asset.',
    }, {
      // The carve-outs are quoted from the enrolled resolution rather than from
      // the Legislative Council PDF the two authorities above use, for a reason
      // that is about the document and not about the text: a running page
      // header — "163 Art. VIII Sec.25" — falls between subdivisions (1) and
      // (2), so every extraction of that page interleaves it into the middle of
      // this subsection. The words are identical in both sources. Quoting the
      // compilation would mean either carrying a page header inside the
      // quotation or marking an elision that claims operative text was dropped
      // when none was. S.J.R. 18 is the enrolled text the voters adopted, and
      // it prints the subsection unbroken. Its `kind` is `legislativeHistory`
      // because that is what an enrolled resolution is; the (Added Nov. 4,
      // 2025.) note that closes the compilation's version is the compiler's
      // annotation, not enacted text, so it is not quoted here.
      kind: 'legislativeHistory',
      citation: 'Tex. S.J.R. 18, 89th Leg., R.S. (2025) (enrolled), § 1 (proposed art. VIII, sec. 24-b(b))',
      url: 'https://capitol.texas.gov/tlodocs/89R/billtext/html/SJ00018F.htm',
      quotedText:
        'This section may not be construed as modifying the applicability or prohibiting the imposition or change in the rate of: (1) an ad valorem tax on property; (2) a sales tax on the sale of goods or services; or (3) a use tax on the storage, use, or other consumption in this state of goods or services.',
    }, {
      // The adoption date, inside a span, which is what authority-sufficiency
      // section 3 requires of any fact the record's `effectiveFrom` depends on.
      // It used to travel on the tail of the subsection (b) quote as the
      // compilation's "(Added Nov. 4, 2025.)" note; moving that quote to the
      // enrolled resolution would have dropped the date off the record
      // entirely, since an enrolled bill carries no compiler's annotation. The
      // resolution states the election date itself instead, which is the better
      // source for it either way — a "(Added …)" note is the publisher's
      // summary of an event, and this is the enacted instruction that fixed it.
      kind: 'legislativeHistory',
      citation: 'Tex. S.J.R. 18, 89th Leg., R.S. (2025) (enrolled), § 2',
      url: 'https://capitol.texas.gov/tlodocs/89R/billtext/html/SJ00018F.htm',
      quotedText:
        'This proposed constitutional amendment shall be submitted to the voters at an election to be held November 4, 2025.',
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
      'packages/engine/src/params/state/data/year2026.ts#TX',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  // Tennessee takes two records because the two halves of its negative rest on
  // different authority with different durability, and collapsing them would
  // let the constitutional weight of the earned-income bar silently vouch for a
  // statutory repeal it says nothing about. The split matters more here than it
  // did for Texas: there the two sections were both prohibitions differing only
  // in start year, whereas Tennessee's constitution reaches only the income a
  // retiree has already stopped earning.
  'tn-const-2-28-earned-income-tax-prohibited': {
    title: 'Tennessee’s constitution bars a tax on payroll or earned income only',
    statement:
      'Article II, section 28 forbids the Legislature to levy, authorize or permit any state OR LOCAL tax upon payroll or earned personal income, or measured by it, subject only to a carve-out for a tax already in effect on January 1, 2011. Read carefully, the prohibition reaches earned income and stops there. A pension, an IRA or 401(k) withdrawal, a capital gain, interest and dividends are none of them earned personal income — and the same section still contains the affirmative grant that authorised the Hall tax in the first place, which the 2014 amendment did not repeal. So for precisely the income a Tennessee retiree lives on, the negative is NOT constitutional; it is registered separately at tn-hall-income-tax-repealed-from-2021 and rests on a statute the Legislature retains express constitutional power to reverse. The local limb is what makes this record bear on more than the state rate: no Tennessee county or city may reach earned income either.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:TN',
    authority: [{
      kind: 'statute',
      citation: 'Tenn. Const. art. II, § 28',
      url: 'https://publications.tnsosfiles.com/pub/2023%20TN%20Constitution.pdf',
      quotedText:
        'Notwithstanding the authority to tax privileges or any other authority set forth in this Constitution, the Legislature shall not levy, authorize or otherwise permit any state or local tax upon payroll or earned personal income or any state or local tax measured by payroll or earned personal income; however, nothing contained herein shall be construed as prohibiting any tax in effect on January 1, 2011, or adjustment of the rate of such tax.',
    }, {
      // The retained grant, from the SAME section. Included deliberately: it is
      // the clause that stops this record being read as covering unearned
      // income, and it is still there.
      kind: 'statute',
      citation: 'Tenn. Const. art. II, § 28 (retained grant)',
      url: 'https://publications.tnsosfiles.com/pub/2023%20TN%20Constitution.pdf',
      quotedText:
        'The Legislature shall have power to levy a tax upon incomes derived from stocks and bonds that are not taxed ad valorem.',
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
      'packages/engine/src/params/state/data/year2026.ts#TN',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetail',
    ],
  },

  'tn-hall-income-tax-repealed-from-2021': {
    title: 'Tennessee’s Hall tax on interest and dividends is gone from 2021',
    statement:
      'The Hall income tax — Tennessee\'s tax on interest from bonds and notes and on dividends from stock, and the one tax the 2014 constitutional amendment expressly preserved — was stepped down by statute from four percent for 2017 to one percent for 2020 and repealed beginning January 1, 2021. Together with the constitutional bar on taxing earned income, that leaves Tennessee levying no individual income tax of any kind, which is what the pack\'s `hasIncomeTax: false` encodes. The date is 2021 and not 2022: the 2016 act that created the elimination set it at 2022, and the 2017 IMPROVE Act moved it forward a year. This half of Tennessee\'s negative is statutory, and article II, section 28 leaves the Legislature express power to tax stock and bond income again by simple majority.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:TN',
    authority: [{
      // The department's own statement carries the whole claim including its
      // date. The two enrolled public chapters that produced it — 2016 Pub. Ch.
      // 1064 and 2017 Pub. Ch. 181 — are deliberately NOT cited: both are
      // scanned PDFs whose OCR layer is visibly corrupt ("four percent (4o/o)",
      // "January 1,2021"), and pasting a span from either into `quotedText`
      // would put text in this registry that the document does not contain.
      //
      // The department's Hall landing page carries the same statement in
      // plainer words and is the more obvious citation. It is not used, for a
      // reason about the page rather than about its contents: stripped of
      // markup it yields about 1,900 characters, and `verify-quotes` treats a
      // page under 2,000 as a shell or a bot challenge — a rule that is right
      // far more often than it is wrong and cannot tell a genuinely short page
      // from a blocked one. A citation nothing can check is the one thing these
      // records must not have, so the rates page, which states the repeal with
      // its date and its statutory ramp, is cited instead.
      //
      // The elision is real. What falls between the two segments is the
      // department's four-row rate table for 2017 through 2020; the segments
      // are the sentence that introduces it and the row that ends it.
      kind: 'stateAgencyPublication',
      citation: 'TN Dept. of Revenue, Hall Income Tax — Due Date and Tax Rates',
      url: 'https://www.tn.gov/revenue/taxes/hall-income-tax/due-date-and-tax-rates.html',
      quotedText:
        'The Hall income tax has been repealed, and the applicable tax rate for each year leading up to the repeal is as follows: ... Repeal beginning January 1, 2021',
    }, {
      // The grant the repeal did NOT touch, which is what makes this record
      // statutory-grade rather than constitutional. Quoted here as well as on
      // the sister record so neither can be read on its own and come out wrong.
      kind: 'statute',
      citation: 'Tenn. Const. art. II, § 28 (retained grant)',
      url: 'https://publications.tnsosfiles.com/pub/2023%20TN%20Constitution.pdf',
      quotedText:
        'The Legislature shall have power to levy a tax upon incomes derived from stocks and bonds that are not taxed ad valorem.',
    }],
    volatility: 'staticStatute',
    // Stated by the cited text itself, so the convention's 2026 fallback does
    // not apply: the department names tax periods beginning January 1, 2021.
    effectiveFrom: 2021,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#TN',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  // ---------------------------------------------------------------------------
  // Arkansas — 2026-08-05.
  //
  // Three things about these citations have to be said once rather than on each
  // record.
  //
  // First, Arkansas does not publish its own code. The codified statutes and
  // the Constitution of 1874 are both published by LexisNexis under contract,
  // and the legislature links out to advance.lexis.com for both — a commercial
  // host serving no statutory text to a verifier. The operative statutory
  // language below is therefore quoted from the ENROLLED ACT that produced it,
  // which prints the amended section in full, and every dollar amount that the
  // Secretary indexes is quoted from the Department of Finance and
  // Administration, which is its only publisher.
  //
  // Second, an enrolled Arkansas act prints a line number in the margin of
  // every line, and the extractor reads those numbers as part of the text. A
  // quotation that spans printed lines therefore carries them — "in excess of
  // ten million 5 dollars ($10,000,000)". They are reproduced rather than
  // deleted for the same reason the North Dakota rate schedule keeps its leader
  // dots: removing them would be retyping the source, and a quote that has been
  // retyped once can be retyped again.
  //
  // Third, an enrolled act sets an amendment in strike-through and underline,
  // and extraction interleaves the struck and inserted words — 26-51-307(a)(1)
  // prints as "received by any a resident" and "shall be is exempt", and
  // 26-51-201(d)(1) as "a table which tables that shall apply". That is what
  // the document contains; reconstructing the post-amendment sentence would be
  // a paraphrase of the markup, which is exactly what `quotedText` forbids.
  // ---------------------------------------------------------------------------

  'aca-26-51-201-published-indexed-rate-schedule': {
    title: 'Arkansas’s operative brackets are the Secretary’s published indexed schedule',
    statement:
      'Arkansas taxes net taxable income on a five-rate schedule — 0%, 2%, 3%, 3.4% and 3.9% — but the dollar thresholds those rates turn on are never the ones printed in the Code. A.C.A. 26-51-201(d)(1) directs the Secretary of the Department of Finance and Administration to prescribe tables annually that apply in lieu of the statutory ones, increasing each bracket’s minimum and maximum by the cost-of-living adjustment, rounded to the nearest $100, without changing any rate. The operative schedule for a year is therefore whatever the department published for it, and for 2026 that is 0% below $5,599, 2% from $5,600, 3% from $11,200, 3.4% from $16,000 and 3.9% from $26,400 — the same thresholds the department published for 2025, because that year’s adjustment rounded to zero. The pack carries those. What it carried before was the un-indexed two-rate schedule 26-51-201(a)(3)(B) prints, which by its own terms reaches only a filer whose net income exceeds the statutory threshold — above about $94,700, where the published schedule hands off to it — so every modelled Arkansas retiree below that was priced on a schedule Arkansas does not apply to them.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:AR',
    authority: [{
      kind: 'formInstruction',
      citation: '2026 Form AR1000ES instructions, Tax Rate Schedule',
      url: 'https://www.dfa.arkansas.gov/wp-content/uploads/2026_Final_AR1000ES.pdf',
      quotedText:
        'If your NET TAXABLE INCOME is less than $5,599, your tax is zero percent (0%) of your net taxable income.',
    }, {
      // The AR1000ES schedule's two halves interleave in extraction, so this
      // separate threshold-only quotation preserves its literal text run. The
      // following indexed-brackets quotation preserves one endpoint/percentage
      // pair from each extracted row, with ellipses marking the omitted text
      // between pairs.
      kind: 'formInstruction',
      citation: '2026 Form AR1000ES instructions, Tax Rate Schedule, "IF YOUR NET TAXABLE INCOME IS" column',
      url: 'https://www.dfa.arkansas.gov/wp-content/uploads/2026_Final_AR1000ES.pdf',
      quotedText: '$ 5,600.00 11,200.00 16,000.00 26,400.00 30,000.00 40,000.00 50,000.00',
    }, {
      kind: 'formInstruction',
      citation: '2025 Indexed Tax Brackets, "Less Than or Equal To" and "Percentage" columns',
      url: 'https://www.dfa.arkansas.gov/wp-content/uploads/2025_TaxBrackets.pdf',
      quotedText: '$5,599 0.00% … $11,199 2.00% … $15,999 3.00% … $26,399 3.40% … $94,700 3.90%',
    }, {
      kind: 'formInstruction',
      citation: '2025 Indexed Tax Brackets, "From" column',
      url: 'https://www.dfa.arkansas.gov/wp-content/uploads/2025_TaxBrackets.pdf',
      quotedText: 'From $0 $5,600 $11,200 $16,000 $26,400 $94,701',
    }, {
      kind: 'statute',
      citation: 'Ark. Code Ann. 26-51-201(d)(1) (2023 Ark. Acts, Act 532, § 2)',
      url: 'https://arkleg.state.ar.us/Home/FTPDocument?path=%2FACTS%2F2023R%2FPublic%2FACT532.pdf',
      quotedText:
        '(d)(1) The Secretary of the Department of Finance and Administration 2 shall prescribe annually a table which tables that shall apply in lieu of the 3 table tables contained in subsection (a) of this section with respect to each 4 succeeding taxable year.',
    }, {
      kind: 'statute',
      citation: 'Ark. Code Ann. 26-51-201(d)(1) (2023 Ark. Acts, Act 532, § 2)',
      url: 'https://arkleg.state.ar.us/Home/FTPDocument?path=%2FACTS%2F2023R%2FPublic%2FACT532.pdf',
      quotedText:
        'The secretary shall increase the minimum and maximum 5 dollar amounts for each rate bracket, rounding to the nearest one hundred 6 dollars ($100), for which a tax is imposed under the table by the cost-of- 7 living adjustment for each calendar year and by not changing the rate 8 applicable to any rate bracket as adjusted.',
    }],
    // Rates fixed by statute, thresholds republished every year by the
    // department: the record goes stale on the autumn schedule, not on the
    // annual statutory pass.
    volatility: 'annuallyIndexed',
    effectiveFrom: 2024,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#AR',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetail',
    ],
  },

  'aca-26-51-430-c-published-indexed-standard-deduction': {
    title: 'Arkansas’s standard deduction is its own figure, indexed annually and capped at 3%',
    statement:
      'Arkansas publishes a standard deduction of its own — $2,470 per taxpayer and $4,940 on a joint return, the amount printed for both 2025 and 2026 — and A.C.A. 26-51-430(c)(1) requires the Secretary to increase it every year by the cost-of-living adjustment, rounded to the nearest $10, with (c)(2)(A)(i) capping that adjustment at three percent. Nothing derives it from the federal standard deduction, so the Arkansas entry carries no `standardDeductionConformity` tag and takes no federal age-65 addition. The pack previously carried $2,410 and $4,820, which are the 2024 amounts.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:AR',
    authority: [{
      kind: 'statute',
      citation: 'Ark. Code Ann. 26-51-430(c)(1) (2021 Ark. Acts (2d Ex. Sess.), Act 1, § 9)',
      url: 'https://arkleg.state.ar.us/Home/FTPDocument?path=%2FACTS%2F2021S2%2FPublic%2FACT1.pdf',
      quotedText:
        '(c)(1) The Secretary of the Department of Finance and Administration 19 shall increase annually the standard deduction provided under subsection (b) 20 of this section by the cost-of-living adjustment for the current calendar 21 year, rounding the amount to the nearest ten dollars ($10.00).',
    }, {
      kind: 'statute',
      citation: 'Ark. Code Ann. 26-51-430(c)(2)(A)(i) (2021 Ark. Acts (2d Ex. Sess.), Act 1, § 9)',
      url: 'https://arkleg.state.ar.us/Home/FTPDocument?path=%2FACTS%2F2021S2%2FPublic%2FACT1.pdf',
      quotedText:
        '(2)(A)(i) For purposes of subdivision (c)(1) of this section, 23 the cost-of-living adjustment for a calendar year is the percentage, if any, 24 by which the Consumer Price Index for the current calendar year exceeds the 25 Consumer Price Index for the preceding calendar year, not to exceed three 26 percent (3%).',
    }, {
      kind: 'formInstruction',
      citation: '2026 Form AR1000ES worksheet, line 2',
      url: 'https://www.dfa.arkansas.gov/wp-content/uploads/2026_Final_AR1000ES.pdf',
      quotedText:
        'If you do not expect to itemize deductions, enter the standard deduction of $2,470 per taxpayer',
    }, {
      // The booklet's own Standard Deduction row, filing statuses 1 through 4,
      // which is where the joint figure appears. Quoted as the row prints
      // rather than as a sentence, for the reason the rate-schedule record
      // gives about tables.
      kind: 'formInstruction',
      citation: '2025 Form AR1000F/AR1000NR instructions, Standard Deduction table',
      url: 'https://www.dfa.arkansas.gov/wp-content/uploads/2025_AR1000F_and_AR1000NR_Instructions.pdf',
      quotedText: 'Standard Deduction $2,470 $4,940 $2,470 $2,470 each',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2022,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#AR',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'aca-26-51-307-six-thousand-retirement-exemption': {
    title: 'Arkansas exempts $6,000 of retirement income per taxpayer, once across every source',
    statement:
      'A.C.A. 26-51-307(a)(1) exempts the first $6,000 of benefits a resident receives from an individual retirement account, or the first $6,000 of retirement benefits received from a public or private employment-related retirement system, plan or program, regardless of how the plan is funded. The $6,000 is one annual ceiling per taxpayer rather than one per source: the department states it as a total across the employer-plan and IRA items alike. The pack expresses this as `{ kind: \'capped\', capPerPerson: 6000 }`, and by leaving Arkansas out of `PUBLIC_PENSION_OVERRIDES` it also sets `retirementRuleShared`, which is what makes the cap apply once to a household’s combined private and public retirement income instead of once in each bucket.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:AR',
    authority: [{
      kind: 'statute',
      citation: 'Ark. Code Ann. 26-51-307(a)(1) (2017 Ark. Acts, Act 141, § 3)',
      url: 'https://arkleg.state.ar.us/Home/FTPDocument?path=%2FACTS%2F2017R%2FPublic%2FACT141.pdf',
      quotedText:
        '(a)(1) The first six thousand dollars ($6,000) of benefits received by 9 any a resident of this state from an individual retirement account or the 10 first six thousand dollars ($6,000) of retirement benefits received by any a 11 resident of this state from public or private employment-related retirement 12 systems, plans, or programs, regardless of the method of funding for these 13 systems, plans, or programs, shall be is exempt from the state income tax.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Form AR1000F/AR1000NR instructions, Exempt Income, note to items 12 and 13',
      url: 'https://www.dfa.arkansas.gov/wp-content/uploads/2025_AR1000F_and_AR1000NR_Instructions.pdf',
      quotedText:
        'Total exemptions from all plans described under 12 and 13 cannot exceed $6,000 per taxpayer, not including recovery of cost.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Form AR1000F/AR1000NR instructions, Line 18A',
      url: 'https://www.dfa.arkansas.gov/wp-content/uploads/2025_AR1000F_and_AR1000NR_Instructions.pdf',
      quotedText:
        'You are entitled to a $6,000 exemption from the taxable amount; the balance is taxable to Arkansas.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2018,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#AR',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'aca-26-51-307-a-1-public-pension-inside-the-six-thousand': {
    title: 'Arkansas gives a civil-service pension the same $6,000 as a private one',
    statement:
      'Outside the uniformed services, Arkansas grants public retirement income no exemption beyond the $6,000 of 26-51-307(a)(1). The subsection reaches "public or private employment-related retirement systems, plans, or programs" in one breath and caps both at the same figure, so a pension from the Arkansas Public Employees\' Retirement System, the Arkansas Teacher Retirement System, or a county, municipal, police or fire plan is exempt to exactly the extent a private pension is. The pack says so by keeping Arkansas out of `PUBLIC_PENSION_OVERRIDES`, which leaves the same capped rule in both buckets. Arkansas carried `{ kind: \'full\' }` there until 2026-08-05, which exempted every public pension in the state outright.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:AR',
    authority: [{
      kind: 'statute',
      citation: 'Ark. Code Ann. 26-51-307(a)(1) (2017 Ark. Acts, Act 141, § 3)',
      url: 'https://arkleg.state.ar.us/Home/FTPDocument?path=%2FACTS%2F2017R%2FPublic%2FACT141.pdf',
      quotedText:
        '(a)(1) The first six thousand dollars ($6,000) of benefits received by 9 any a resident of this state from an individual retirement account or the 10 first six thousand dollars ($6,000) of retirement benefits received by any a 11 resident of this state from public or private employment-related retirement 12 systems, plans, or programs, regardless of the method of funding for these 13 systems, plans, or programs, shall be is exempt from the state income tax.',
    }, {
      // The department restating the same breadth on the return: one exemption,
      // available whatever the plan is and however it was paid for. Quoted
      // around the phrase "employment-related", which the booklet's own text
      // layer breaks across a line and rejoins without the hyphen.
      kind: 'formInstruction',
      citation: '2025 Form AR1000F/AR1000NR instructions, Line 17',
      url: 'https://www.dfa.arkansas.gov/wp-content/uploads/2025_AR1000F_and_AR1000NR_Instructions.pdf',
      quotedText:
        '(The recipient does not have to be retired.) The method of funding is irrelevant. The exemption may be taken from either lump-sum or installment payments.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2018,
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

  'aca-26-51-307-e-uniformed-services-full-exemption': {
    title: 'Arkansas exempts uniformed-services retirement in full, and the pack caps it at $6,000',
    statement:
      'A.C.A. 26-51-307(e) exempts retirement benefits received by a member of the uniformed services, and survivor benefits funded by such retirement pay, from the Arkansas income tax entirely — no cap, no age condition, no phase-out. Under 26-51-307(f) that exemption and the $6,000 of subsection (a) are alternatives rather than additions: a taxpayer claiming the military exemption may claim the $6,000 only to the extent the military exemption falls short of it. Not modelled. The pack’s public bucket is one flag for every public pension the input model can carry, and in Arkansas that bucket is dominated by civil-service pensions the state exempts only to $6,000, so the bucket carries the capped rule and a military pension is charged Arkansas tax on everything above $6,000 that Arkansas does not charge. The direction is deliberate: the same flag set to `full` — which is what Arkansas carried until 2026-08-05 — is exact for the military retiree and exempts every teacher, trooper and state employee’s pension in Arkansas along with them, which errs the other way and by far the larger population.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:AR',
    authority: [{
      kind: 'statute',
      citation: 'Ark. Code Ann. 26-51-307(e)(1) (2017 Ark. Acts, Act 141, § 3)',
      url: 'https://arkleg.state.ar.us/Home/FTPDocument?path=%2FACTS%2F2017R%2FPublic%2FACT141.pdf',
      quotedText:
        '(e)(1) The following are exempt from the income tax imposed under this 22 chapter: 23 (A) Retirement benefits received by a member of the 24 uniformed services from any of the uniformed services identified in 25 subdivision (e)(2) of this section; and 26 (B) Survivor benefits that are funded by the retirement 27 pay of a member of the uniformed services.',
    }, {
      kind: 'statute',
      citation: 'Ark. Code Ann. 26-51-307(f)(1) (2023 Ark. Acts, Act 358, § 1)',
      url: 'https://arkleg.state.ar.us/Home/FTPDocument?path=%2FACTS%2F2023R%2FPublic%2FACT358.pdf',
      quotedText:
        '(f)(1) A Except as provided in subdivision (f)(2) of this section, a 30 taxpayer claiming an exemption under subsection (e) of this section is not 31 eligible for an exemption under subsection (a) of this section.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Form AR1000F/AR1000NR instructions, Line 17',
      url: 'https://www.dfa.arkansas.gov/wp-content/uploads/2025_AR1000F_and_AR1000NR_Instructions.pdf',
      quotedText:
        'LINE 17. Retirement benefits received by a member of the uniformed services are exempt from income tax.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Form AR1000F/AR1000NR instructions, Line 17, military retirement and the $6,000 exemption',
      url: 'https://www.dfa.arkansas.gov/wp-content/uploads/2025_AR1000F_and_AR1000NR_Instructions.pdf',
      quotedText:
        'Military retirees cannot claim the $6,000 exemption for traditional or employer-sponsored distributions if their military retirement exemption exceeds $6,000. If the military retirement exemption is less than $6,000, the remaining amount of the exemption may be taken for traditional or employer-sponsored distributions.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2018,
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

  'aca-26-51-307-a-2-ira-age-fifty-nine-and-a-half-gate': {
    title: 'Arkansas’s $6,000 reaches an IRA distribution only at 59½, and the pack does not test it',
    statement:
      'A.C.A. 26-51-307(a)(2) admits an individual retirement account distribution to the $6,000 exemption only after the participant reaches age 59½, or on the participant’s death or disability; every other premature distribution or early withdrawal is denied it, including one taken for medical expenses, higher education or a first home. Employer-plan benefits carry no such condition — the department states expressly that the recipient need not even be retired. Not modelled. `StateRetirementExclusion` has one `minAge`, and it gates the whole bucket: setting 59.5 would deny the exemption to an under-59½ Arkansan drawing an employer pension, which Arkansas allows. Leaving it unset grants the exemption on a pre-59½ IRA withdrawal Arkansas taxes in full, so the engine under-charges a household that draws an IRA early by the Arkansas tax on up to $6,000 per person.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale: null,
    jurisdiction: 'state:AR',
    authority: [{
      kind: 'statute',
      citation: 'Ark. Code Ann. 26-51-307(a)(2)(A) (2017 Ark. Acts, Act 141, § 3)',
      url: 'https://arkleg.state.ar.us/Home/FTPDocument?path=%2FACTS%2F2017R%2FPublic%2FACT141.pdf',
      quotedText:
        '(2)(A) Only individual retirement account benefits received by 15 an individual retirement account participant after reaching fifty-nine and 16 one-half (59½) years of age qualify for the exemption.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Form AR1000F/AR1000NR instructions, Line 17, traditional IRA distributions',
      url: 'https://www.dfa.arkansas.gov/wp-content/uploads/2025_AR1000F_and_AR1000NR_Instructions.pdf',
      quotedText:
        'If you received a traditional IRA distribution after reaching the age of fifty-nine and one-half (59 1/2), the first $6,000 is exempt from tax.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2018,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/state/types.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#AR',
      'packages/engine/src/params/state/types.ts#StateRetirementExclusion',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'aca-26-51-404-b-6-social-security-exclusion': {
    title: 'Arkansas leaves Social Security out of gross income altogether',
    statement:
      'Social Security payments and railroad retirement benefits are excluded from the Arkansas definition of gross income by 26-51-404(b)(6)(B), rather than deducted from it, so no part of a federally taxable benefit enters the Arkansas base at any income level; the department lists Social Security, VA benefits, workers\' compensation and railroad retirement together as exempt. 26-51-307(b)(2) then keeps the $6,000 retirement exemption from being spent on any of them. The pack expresses this as `taxesSocialSecurity: false`.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:AR',
    authority: [{
      kind: 'formInstruction',
      citation: '2025 Form AR1000F/AR1000NR instructions, Exempt Income, item 8',
      url: 'https://www.dfa.arkansas.gov/wp-content/uploads/2025_AR1000F_and_AR1000NR_Instructions.pdf',
      quotedText:
        'Social Security benefits, VA benefits, Workers\' Compensation, Railroad Retirement benefits and related supplemental benefits are exempt from tax.',
    }, {
      kind: 'statute',
      citation: 'Ark. Code Ann. 26-51-404(b)(6)(B) (2017 Ark. Acts, Act 141, § 5)',
      url: 'https://arkleg.state.ar.us/Home/FTPDocument?path=%2FACTS%2F2017R%2FPublic%2FACT141.pdf',
      quotedText:
        '(B) Social Security payments, railroad retirement 21 benefits, unemployment compensation benefits paid from federal unemployment 22 trust funds, and unemployment insurance benefits received from the railroad 23 retirement boards, and unemployment compensation paid under Title IV of the 24 Social Security Act, 42 U.S.C. § 601 et seq.;',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2018,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#AR',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'aca-26-51-815-b-2-fifty-percent-capital-gain-exclusion': {
    title: 'Arkansas exempts 50% of net capital gain',
    statement:
      'A.C.A. 26-51-815(b)(2) exempts a portion of a taxpayer’s net capital gain from the Arkansas income tax, and subdivision (C) sets that portion at fifty percent for gains on and after July 1, 2016. Form AR1000D is the arithmetic: line 8 multiplies the net capital gain by fifty percent to reach the Arkansas taxable amount. The pack says so with `capitalGainsTaxablePct: 50`, which the calculator reads in preference to the 100 percent that `capitalGainsAsOrdinary: true` would otherwise default to — the half that does reach the base is still stacked with ordinary income, because Arkansas has no preferential RATE, only a partial exclusion.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:AR',
    authority: [{
      kind: 'statute',
      citation: 'Ark. Code Ann. 26-51-815(b)(2) (2015 Ark. Acts, Act 1173, § 1)',
      url: 'https://arkleg.state.ar.us/Acts/FTPDocument?path=%2FACTS%2F2015R%2FPublic%2F&file=1173.pdf&ddBienniumSession=2015%2F2015R',
      quotedText:
        '(2) If a taxpayer has a net capital gain, the following portion 29 of the gain is exempt from state income tax:',
    }, {
      kind: 'statute',
      citation: 'Ark. Code Ann. 26-51-815(b)(2)(C) (2015 Ark. Acts, Act 1173, § 1)',
      url: 'https://arkleg.state.ar.us/Acts/FTPDocument?path=%2FACTS%2F2015R%2FPublic%2F&file=1173.pdf&ddBienniumSession=2015%2F2015R',
      quotedText: '(C) Beginning on and after July 1, 2016, fifty percent 35 (50%).',
    }, {
      kind: 'formInstruction',
      citation: '2025 Form AR1000D, line 8',
      url: 'https://www.dfa.arkansas.gov/wp-content/uploads/2025_AR1000D_CapitalGains.pdf',
      quotedText:
        '8. Arkansas taxable amount. If a gain multiply line 7b by 50 percent (.50), otherwise enter loss',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2016,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#AR.capitalGainsTaxablePct',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'aca-26-51-815-b-3-ten-million-dollar-gain-exemption': {
    title: 'Arkansas exempts net capital gain above $10 million in full',
    statement:
      'A.C.A. 26-51-815(b)(3) exempts from the Arkansas income tax the amount of net capital gain in excess of $10,000,000 from a gain realized on or after January 1, 2014, so the fifty percent inclusion of (b)(2) applies to the first $10,000,000 and nothing above it is taxed at all. Form AR1000D implements it at line 7b, which caps the figure the fifty percent is applied to. Not modelled: `capitalGainsTaxablePct` is a single share applied to the whole modelled gain, with no ceiling above which the share falls to zero, so a realization above $10,000,000 is charged Arkansas tax on half of the excess that Arkansas exempts entirely. The population this reaches is one the engine will essentially never see, which is a reason to record the gap rather than to model it.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:AR',
    authority: [{
      kind: 'statute',
      citation: 'Ark. Code Ann. 26-51-815(b)(3) (2015 Ark. Acts, Act 1173, § 2)',
      url: 'https://arkleg.state.ar.us/Acts/FTPDocument?path=%2FACTS%2F2015R%2FPublic%2F&file=1173.pdf&ddBienniumSession=2015%2F2015R',
      quotedText:
        '(3) The amount of net capital gain in excess of ten million 5 dollars ($10,000,000) from a gain realized on or after January 1, 2014, is 6 exempt from the state income tax.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Form AR1000D, line 7b',
      url: 'https://www.dfa.arkansas.gov/wp-content/uploads/2025_AR1000D_CapitalGains.pdf',
      quotedText:
        '7b. If the amount on line 7a is over $10,000,000, only enter $10,000,000. If less than $10,000,000, enter the total amount',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2014,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/types.ts',
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#AR',
      'packages/engine/src/params/state/types.ts#StateTaxParams',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  // ---------------------------------------------------------------------------
  // Mississippi — 2026-08-05.
  //
  // Mississippi publishes no free `.gov` copy of its own Code. The
  // legislature's only link to it points at `lexisnexis.com/hottopics/mscode/`,
  // which redirects into a cookie-and-JavaScript session app on
  // advance.lexis.com and serves no text to a verifier — the Arkansas pattern
  // exactly, and for the same commercial reason. The statutory language below
  // is therefore quoted from BILLS on `billstatus.ls.state.ms.us`, which
  // reprint the affected section in full.
  //
  // A bill reprint is a reprint, so two guards were applied rather than
  // assumed. Where possible the citation is to a bill that BRINGS THE SECTION
  // FORWARD, which prints it unmarked — 27-7-17 and 27-7-21 below. Where the
  // section was being amended, Mississippi's markup sets deletions in
  // `<s>`/hidden spans and insertions in `<u>`, so the strike and the insertion
  // interleave; 27-7-15's paragraphs were cross-checked word for word between
  // two independent 2026 bills, and 27-7-5's own 2026 subparagraph is the one
  // place a reconstruction would have been needed, so the 4% figure is quoted
  // from the department's clean prose instead of from the bill.
  //
  // What is NOT reachable, stated so nobody assumes it was checked: Title 35,
  // Part III of the Mississippi Administrative Code — the department's own
  // income tax regulations — is published only on `www.sos.ms.gov`, and that
  // host returns HTTP 403 to every non-browser client, with a browser
  // User-Agent, with a Referer from the linking DOR page, over http, and on the
  // apex domain alike. So no Mississippi record here can rest on regulation
  // authority, which matters most for the early-distribution carve-out below:
  // the regulation is exactly where a `regulation`-tier source for it would
  // live. That is a reason to classify the record carefully, not to omit it.
  //
  // One document-URL trap: DOR form filenames contain SPACES, so a citation has
  // to keep the `%20` — `80100251%202.pdf` is one file, not two.
  // ---------------------------------------------------------------------------

  'ms-27-7-5-rate-ramp': {
    title: 'Mississippi’s zero band and its legislated rate ramp',
    statement:
      'Mississippi levies no tax on the first $10,000 of an individual’s taxable income and a single flat rate above it. That zero band is two clauses rather than one — 27-7-5(1)(a)(i)6 removed the tax on the first $5,000 from 2022 and (1)(b)(i) removed it on $5,000 to $10,000 from 2023 — and the pack models the pair as a 0% bracket below $10,000. The rate above the band is 4.4% for 2025, 4% for 2026, 3.75% for 2027, 3.5% for 2028, 3.25% for 2029 and 3% for 2030 and after, with a further revenue-triggered reduction of 0.2 to 0.3 of a point a year from 2031 under 27-7-5.1, and a self-repeal of the individual income tax entirely if the rate ever reaches zero. The pack holds 4% for both filing statuses. The next four refreshes each have a published figure waiting, so carrying this one forward is wrong by construction.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:MS',
    authority: [{
      // One subparagraph per entry rather than the enumeration as a run. The
      // bill is a Microsoft Word export and every indent between subparagraphs
      // survives extraction as a U+FFFD replacement character, so a quotation
      // spanning two of them is a passage the page does not contain. Splitting
      // is the honest repair: an elision would say text was dropped, and what
      // sits between these sentences is not text.
      kind: 'statute',
      citation: 'Miss. Code Ann. 27-7-5(1)(b)(ii)4, as amended by 2025 Miss. H.B. 1, § 1',
      url: 'https://billstatus.ls.state.ms.us/documents/2025/html/HB/0001-0099/HB0001SG.htm',
      quotedText:
        'For calendar year 2027, on such taxable income, the rate shall be three and three-quarters percent (3.75%);',
    }, {
      kind: 'statute',
      citation: 'Miss. Code Ann. 27-7-5(1)(b)(ii)5, as amended by 2025 Miss. H.B. 1, § 1',
      url: 'https://billstatus.ls.state.ms.us/documents/2025/html/HB/0001-0099/HB0001SG.htm',
      quotedText:
        'For calendar year 2028, on such taxable income, the rate shall be three and one-half percent (3.5%);',
    }, {
      kind: 'statute',
      citation: 'Miss. Code Ann. 27-7-5(1)(b)(ii)6, as amended by 2025 Miss. H.B. 1, § 1',
      url: 'https://billstatus.ls.state.ms.us/documents/2025/html/HB/0001-0099/HB0001SG.htm',
      quotedText:
        'For calendar year 2029, on such taxable income, the rate shall be three and one-quarter percent (3.25%); and',
    }, {
      kind: 'statute',
      citation: 'Miss. Code Ann. 27-7-5(1)(b)(ii)7, as amended by 2025 Miss. H.B. 1, § 1',
      url: 'https://billstatus.ls.state.ms.us/documents/2025/html/HB/0001-0099/HB0001SG.htm',
      quotedText:
        'For calendar year 2030 and all calendar years thereafter, except as otherwise provided in Section 2 of this act, on such taxable income, the rate shall be three percent (3%).',
    }, {
      // The self-repeal, which is what makes the post-2030 trigger something a
      // planner has to know about rather than a curiosity.
      kind: 'statute',
      citation: 'Miss. Code Ann. 27-7-5(1)(b)(ii), closing sentence',
      url: 'https://billstatus.ls.state.ms.us/documents/2025/html/HB/0001-0099/HB0001SG.htm',
      quotedText:
        'If the revised tax rates provided for in this subparagraph (ii) are further decreased for calendar years after calendar year 2026 to the extent that there is no tax levied on the taxable income of individuals under this subparagraph (ii), the individual income tax shall stand repealed.',
    }, {
      // The 2026 figure itself, and the reason it is quoted from the department
      // rather than the bill: H.B. 1 amended subparagraph 3 by STRIKING "and
      // all calendar years thereafter" from it, so the bill's text for 2026 is
      // struck and inserted words interleaved, and any single-string rendering
      // of it would be a reconstruction of markup rather than a quotation. The
      // bill quote above covers 2027 onward, which is verbatim insertion.
      //
      // The missing space after "2026" is the department's own HTML table cell
      // boundary. It is reproduced rather than silently repaired, for the same
      // reason the Arkansas act quotes keep their margin line numbers.
      kind: 'stateAgencyPublication',
      citation: 'MS DOR, Individual Income Tax — Tax Rates',
      url: 'https://www.dor.ms.gov/individual/tax-rates',
      quotedText: 'Tax Year 2026Excess of $10,000 of Taxable Income is taxed @ 4%',
    }, {
      kind: 'legislativeHistory',
      citation: '2025 Miss. H.B. 1 (Build Up Mississippi Act), § 30',
      url: 'https://billstatus.ls.state.ms.us/documents/2025/html/HB/0001-0099/HB0001SG.htm',
      quotedText:
        'Sections 1 through 13 and Sections 25 through 29 of this act shall take effect and be in force from and after July 1, 2025, and Sections 15 through 24 of this act shall take effect and be in force from and after March 1, 2026.',
    }],
    volatility: 'staticStatute',
    // Deliberate, exactly as for Indiana: the rate moves on January 1, 2027.
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#MS',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetail',
    ],
  },

  'ms-27-7-15-4-retirement-income-excluded-from-gross-income': {
    title: 'Mississippi excludes all retirement income from gross income, public and private',
    statement:
      'Retirement allowances, pensions, annuities and optional retirement allowances are excluded from Mississippi GROSS income, not deducted from it — paragraph (k) covering Social Security, Railroad Retirement, the Federal Civil Service Retirement Act, any other United States government system, the Mississippi Public Employees’ Retirement System, the Highway Safety Patrol Retirement System and any other Mississippi state or political-subdivision system, and paragraph (l) covering every other governmental system and any private retirement system or plan of which the recipient was a member during employment. Roth distributions follow the Internal Revenue Code. There is no cap, no income phase-out and no age condition in the statute, and the exclusion passes to the spouse or other beneficiary at the retiree’s death. Because it is an exclusion from gross income, exempt retirement income never enters the base and so never affects a threshold. The pack expresses it as `{ kind: \'full\' }` in both buckets with `retirementRuleShared` true — and here that shared flag is the law rather than a conservatism, since (k) and (l) between them reach all retirement income and neither is capped, so there is nothing to double.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:MS',
    authority: [{
      kind: 'statute',
      // One sentence per entry, for the reason the block comment above gives:
      // the bill's Word-export indents survive extraction as U+FFFD, so a
      // quotation crossing a sentence boundary is a passage the page does not
      // contain.
      citation: 'Miss. Code Ann. 27-7-15(4)(k), as reprinted in 2026 Miss. H.B. 693',
      url: 'https://billstatus.ls.state.ms.us/documents/2026/html/HB/0600-0699/HB0693IN.htm',
      quotedText:
        'Amounts received as retirement allowances, pensions, annuities or optional retirement allowances paid under the federal Social Security Act, the Railroad Retirement Act, the Federal Civil Service Retirement Act, or any other retirement system of the United States government, retirement allowances paid under the Mississippi Public Employees\' Retirement System, Mississippi Highway Safety Patrol Retirement System or any other retirement system of the State of Mississippi or any political subdivision thereof.',
    }, {
      kind: 'statute',
      citation: 'Miss. Code Ann. 27-7-15(4)(l), as reprinted in 2026 Miss. H.B. 693',
      url: 'https://billstatus.ls.state.ms.us/documents/2026/html/HB/0600-0699/HB0693IN.htm',
      quotedText:
        'Amounts received as retirement allowances, pensions, annuities or optional retirement allowances paid by any public or governmental retirement system not designated in paragraph (k) or any private retirement system or plan of which the recipient was a member at any time during the period of his employment.',
    }, {
      kind: 'statute',
      citation: 'Miss. Code Ann. 27-7-15(4)(l), Roth distributions',
      url: 'https://billstatus.ls.state.ms.us/documents/2026/html/HB/0600-0699/HB0693IN.htm',
      quotedText:
        'Amounts received as a distribution under a Roth Individual Retirement Account shall be treated in the same manner as provided under the Internal Revenue Code of 1986, as amended.',
    }, {
      kind: 'statute',
      citation: 'Miss. Code Ann. 27-7-15(4)(l), survivor sentence',
      url: 'https://billstatus.ls.state.ms.us/documents/2026/html/HB/0600-0699/HB0693IN.htm',
      quotedText:
        'The exemption allowed under this paragraph (l) shall be available to the spouse or other beneficiary at the death of the primary retiree.',
    }, {
      // The independent cross-check. H.B. 489 reprints the same subsection in
      // the same session, word for word on (4)(k) and (4)(l), which is what
      // makes a bill reprint usable as a statutory source at all.
      kind: 'statute',
      citation: 'Miss. Code Ann. 27-7-15(4), as reprinted in 2026 Miss. H.B. 489',
      url: 'https://billstatus.ls.state.ms.us/documents/2026/html/HB/0400-0499/HB0489PS.htm',
      quotedText:
        'The words "gross income" do not include the following items of income which shall be exempt from taxation under this article:',
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
      'packages/engine/src/params/state/data/year2026.ts#MS',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'ms-early-or-excess-distribution-not-exempt': {
    title: 'Mississippi’s retirement exclusion does not reach an early or excess distribution',
    statement:
      'A pension or annuity distribution taxable as an early or excess distribution under the Internal Revenue Code — the department points to federal Form 5329 — does not qualify for Mississippi’s retirement exemption and is reported as taxable income. Separation pay is not retirement income, and a deferred-compensation distribution taken before the plan’s retirement age or service requirement is likewise taxable. The operative test is the federal additional tax rather than a bare age cutoff, so a distribution falling inside an IRC 72(t) exception — 59½, death, disability, a substantially-equal-periodic-payment series — carries no additional tax and stays exempt. Not modelled, and deliberately not approximated by `minAge`. The condition is a fact about a DISTRIBUTION and the input model carries none: `retirementExclusion` reads `minAge` against the household’s ages and restores the exclusion if ANY person alive meets it, so `minAge: 60` would exempt a 58-year-old’s unqualified withdrawal on the strength of a 62-year-old spouse, and would simultaneously deny the exclusion to a genuine 72(t) series a Mississippi resident of any age may take. That is a different wrong rather than a smaller one. So the pack keeps the unconditional `full`. A single 58-year-old drawing $40,000 from a traditional IRA with no exception is shown $0, where this pack would charge $1,108 with the carve-out alone modelled and Mississippi itself charges about $868 — the difference between those two being the personal exemption that `ms-27-7-21-personal-and-age-65-exemptions` records as running the other way. It bites precisely the bridge-to-Social-Security and Rule-of-55 households a retirement planner exists to model.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale: null,
    jurisdiction: 'state:MS',
    authority: [{
      kind: 'formInstruction',
      citation: 'MS DOR, 2025 Form 80-100 instructions, Line 46 — Total Pensions and Annuities',
      url: 'https://www.dor.ms.gov/sites/default/files/tax-forms/individual/80100251%202.pdf',
      quotedText:
        'Pensions and annuities that are taxable as early or excess distributions under the Federal Internal Revenue Code (see Federal Form 5329) do not qualify for exemption from Mississippi income tax. Such income should be reported on this line as taxable income. Separation pay is not retirement income and does not qualify for exemption. Deferred compensation plan distributions received prior to attainment of retirement age and/or service requirements are taxable for Mississippi purposes and should be reported on this line.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'MS DOR, Individual Income Tax FAQ — "Is retirement income taxable?"',
      url: 'https://www.dor.ms.gov/individual/individual-income-tax-frequently-asked-questions',
      quotedText:
        'Generally, retirement income, pensions and annuities are not subject to Mississippi Income tax if the recipient has met the retirement plan requirements. Early distributions are not considered retirement income and may be subject to tax.',
    }, {
      // The statutory hook is thin on its own, and saying so is part of the
      // record: the words that carry the carve-out are the department's, not
      // the legislature's. What 27-7-15(4)(l) supplies is the employment-link
      // qualifier, which is where the department's authority to police the
      // boundary sits.
      kind: 'statute',
      citation: 'Miss. Code Ann. 27-7-15(4)(l), as reprinted in 2026 Miss. H.B. 693',
      url: 'https://billstatus.ls.state.ms.us/documents/2026/html/HB/0600-0699/HB0693IN.htm',
      quotedText:
        'any private retirement system or plan of which the recipient was a member at any time during the period of his employment',
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
      'packages/engine/src/params/state/data/year2026.ts#MS',
      'packages/engine/src/params/state/types.ts#StateRetirementExclusion',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ms-27-7-17-standard-deduction-unindexed': {
    title: 'Mississippi’s standard deduction is fixed in statute and never indexed',
    statement:
      'Mississippi’s optional standard deduction is $4,600 for married individuals filing a joint or combined return, $2,300 for married individuals filing separate returns, $3,400 for a head of family and $2,300 for an individual who is not married. The statute states these as the amounts "for each calendar year thereafter" following 1998 and provides no indexation, so unlike Arkansas’s or North Dakota’s they do not move and cannot go stale — which is also why the pack entry carries no `standardDeductionConformity` tag: nothing in Mississippi law references IRC 63(c), and tagging it would move a frozen state figure with an annually rising federal one and hand the Mississippi base a federal age-65 addition Mississippi does not grant.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:MS',
    authority: [{
      kind: 'statute',
      // Subdivision (i), the joint figure the pack carries. One subdivision
      // per entry, for the reason the Mississippi block comment gives.
      citation: 'Miss. Code Ann. 27-7-17(3)(b)(i), as brought forward in 2026 Miss. H.B. 866',
      url: 'https://billstatus.ls.state.ms.us/documents/2026/html/HB/0800-0899/HB0866IN.htm',
      quotedText:
        'Three Thousand Four Hundred Dollars ($3,400.00) through calendar year 1997, Four Thousand Two Hundred Dollars ($4,200.00) for the calendar year 1998 and Four Thousand Six Hundred Dollars ($4,600.00) for each calendar year thereafter in the case of married individuals filing a joint or combined return;',
    }, {
      kind: 'statute',
      citation: 'Miss. Code Ann. 27-7-17(3)(b)(iv), as brought forward in 2026 Miss. H.B. 866',
      url: 'https://billstatus.ls.state.ms.us/documents/2026/html/HB/0800-0899/HB0866IN.htm',
      quotedText:
        'Two Thousand Three Hundred Dollars ($2,300.00) in the case of an individual who is not married.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 1999,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#MS',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ms-27-7-21-personal-and-age-65-exemptions': {
    title: 'Mississippi’s personal and age-65 exemptions sit on top of the standard deduction',
    statement:
      'In addition to the standard or itemized deduction, a Mississippi resident subtracts a personal exemption of $6,000 if single, $12,000 jointly for married individuals living together, or $9,500 as a head of family, plus $1,500 for each dependent, plus a further $1,500 each for the taxpayer and the spouse aged 65 or over, and the same again for blindness. Form 80-105 runs them as their own line, below the deduction and above taxable income. None of it is modelled: `standardDeduction` holds a state’s standard deduction, and the pack models no state personal exemption anywhere, so folding Mississippi’s into that slot would make one state an unmarked exception to a fifty-one-state convention. The result is that a married couple both 65 or over is charged 4% on $15,000 Mississippi exempts — about $600 a year — and a single filer aged 65 or over on $7,500, about $300. Note which way this runs and against whom: it OVER-charges the modal Mississippi retiree, whose pension and Social Security are already outside the base and whose remaining income is investment income, while `ms-early-or-excess-distribution-not-exempt` UNDER-charges the early retiree. Mississippi is the state in this pack where the sign of the error flips with the household’s age, and the flip point sits where a planner’s most interesting decisions get made — so the two records must be read separately rather than netted into one direction.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:MS',
    authority: [{
      kind: 'statute',
      citation: 'Miss. Code Ann. 27-7-21(b), as brought forward in 2026 Miss. H.B. 1996',
      url: 'https://billstatus.ls.state.ms.us/documents/2026/html/HB/1900-1999/HB1996IN.htm',
      quotedText:
        'In the case of a single individual, a personal exemption of Five Thousand Two Hundred Fifty Dollars ($5,250.00) for the 1979 and 1980 calendar years and Six Thousand Dollars ($6,000.00) for each calendar year thereafter.',
    }, {
      kind: 'statute',
      citation: 'Miss. Code Ann. 27-7-21(c), as brought forward in 2026 Miss. H.B. 1996',
      url: 'https://billstatus.ls.state.ms.us/documents/2026/html/HB/1900-1999/HB1996IN.htm',
      quotedText:
        'In the case of married individuals living together, a joint personal exemption of Eight Thousand Dollars ($8,000.00) for the 1979 and 1980 calendar years and Nine Thousand Five Hundred Dollars ($9,500.00) for the 1981 through 1997 calendar years, Ten Thousand Dollars ($10,000.00) for the calendar year 1998, Eleven Thousand Dollars ($11,000.00) for the calendar year 1999, and Twelve Thousand Dollars ($12,000.00) for each calendar year thereafter.',
    }, {
      // The one-exemption-per-couple sentence, separately: it is what makes the
      // $12,000 a single joint figure rather than $6,000 apiece.
      kind: 'statute',
      citation: 'Miss. Code Ann. 27-7-21(c), one exemption per couple',
      url: 'https://billstatus.ls.state.ms.us/documents/2026/html/HB/1900-1999/HB1996IN.htm',
      quotedText:
        'A husband and wife living together shall receive but one (1) personal exemption in the amounts provided for in this subsection for each calendar year against their aggregate income.',
    }, {
      // Quoted from the operative sentence rather than from the paragraph
      // heading that precedes it, which the export separates with an indent.
      kind: 'statute',
      citation: 'Miss. Code Ann. 27-7-21(f), as brought forward in 2026 Miss. H.B. 1996',
      url: 'https://billstatus.ls.state.ms.us/documents/2026/html/HB/1900-1999/HB1996IN.htm',
      quotedText:
        'In the case of any taxpayer or the spouse of the taxpayer who has attained the age of sixty-five (65) before the close of his taxable year, an additional exemption of One Thousand Five Hundred Dollars ($1,500.00).',
    }, {
      kind: 'formInstruction',
      citation: 'MS DOR, 2025 Form 80-105, line 15',
      url: 'https://www.dor.ms.gov/sites/default/files/tax-forms/individual/80105258%201.pdf',
      quotedText: 'Exemptions (from line 12; if married filing separately use 1/2 amount)',
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
      'packages/engine/src/params/state/data/year2026.ts#MS',
      'packages/engine/src/params/state/types.ts#StateTaxParams',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ms-combined-return-runs-the-schedule-per-spouse': {
    title: 'A Mississippi combined return runs the rate schedule separately for each spouse',
    statement:
      'Mississippi married couples may file jointly, combined, or separately, and the department tells them to pick whichever costs least. On a COMBINED return, Mississippi adjusted gross income, deductions, exemptions and taxable income each go in a separate column for taxpayer and spouse, and the Schedule of Tax Computation applies the $10,000 zero band in EACH column — so a two-income couple has a $20,000 zero band, not $10,000. Not modelled. `PerStatus<StateTaxBracket[]>` holds one schedule per filing status with no notion of a per-spouse column, and simply doubling the married-filing-jointly thresholds would be wrong for a single-income couple, who cannot use the combined method at all. So the pack’s $10,000 band is exact for a joint return and over-charges a combined one by up to $400 a year. The previous research file asserted the pack’s treatment here was "correct", which made this defect documented as verified — a worse state than undocumented. One thing the sources do not settle: the department writes "(both spouses work)" and Form 80-100 "both spouses having earned incomes", while 27-7-17 and 27-7-21 say only "having separate incomes", so whether a retired couple with only investment income may file combined is genuinely open, and it changes this record’s magnitude for exactly the households the engine models.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:MS',
    authority: [{
      kind: 'stateAgencyPublication',
      citation: 'MS DOR, Individual Income Tax — Tax Rates, combined returns',
      url: 'https://www.dor.ms.gov/individual/tax-rates',
      quotedText:
        'If filing a combined return (both spouses work), each spouse can calculate their tax liability separately and add the results.',
    }, {
      kind: 'formInstruction',
      citation: 'MS DOR, 2025 Form 80-100 instructions, Schedule of Tax Computation, Line 1',
      url: 'https://www.dor.ms.gov/sites/default/files/tax-forms/individual/80100251%202.pdf',
      quotedText:
        'Enter the first $10,000 of taxable income or part ($0 - $10,000) in Column A and Column B if applicable. Multiply the total of these two columns by 0% and enter the resulting tax in the far right column labeled "Income Tax".',
    }, {
      kind: 'formInstruction',
      citation: 'MS DOR, 2025 Form 80-100 instructions, Filing Status for Married Persons',
      url: 'https://www.dor.ms.gov/sites/default/files/tax-forms/individual/80100251%202.pdf',
      quotedText:
        'Married persons may file tax returns in any of these three methods: 1) joint, 2) combined or 3) separate. Choose the method which results in the least amount of tax.',
    }, {
      // The statutory half, and the source of the open question the statement
      // names: the Code conditions the combined method on "separate incomes",
      // where the department writes "both spouses work" and the form writes
      // "earned incomes". Which of the three governs a retired couple with only
      // investment income is not settled by anything retrievable, and it sets
      // this record's magnitude for exactly the households the engine models.
      kind: 'statute',
      citation: 'Miss. Code Ann. 27-7-17(3)(b), combined returns',
      url: 'https://billstatus.ls.state.ms.us/documents/2026/html/HB/0800-0899/HB0866IN.htm',
      quotedText:
        'In the case of a husband and wife living together, having separate incomes, and filing combined returns, the standard deduction authorized may be divided in any manner they choose.',
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
      'packages/engine/src/params/state/data/year2026.ts#MS',
      'packages/engine/src/params/state/types.ts#StateTaxParams',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetail',
    ],
  },

  'ms-capital-gains-taxed-as-ordinary': {
    title: 'Mississippi taxes capital gains at the ordinary rate',
    statement:
      'Mississippi computes capital gains and losses on federal rules, including the federal capital-loss limitation, and has no preferential rate, exclusion or holding-period benefit for them — the department says outright that all income is taxed at the same rate. The pack carries `capitalGainsAsOrdinary: true` with no `capitalGainsTaxablePct`, which is correct here and, like Indiana, is NOT the defect North Dakota, Arkansas and Arizona each turned out to carry; a reviewer sweeping for that pattern must leave Mississippi alone. The one unmodelled wrinkle is narrow: gain from the sale of an ownership interest must first be reduced by losses from transactions described in 27-7-9(f)(10).',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:MS',
    authority: [{
      kind: 'formInstruction',
      citation: 'MS DOR, 2025 Form 80-100 instructions, Line 40 — Capital Gain or Loss',
      url: 'https://www.dor.ms.gov/sites/default/files/tax-forms/individual/80100251%202.pdf',
      quotedText:
        'Mississippi generally follows IRS rules concerning computation of capital gains and losses. Capital loss deductions are subject to the same limitations as federal. However, Mississippi does not have different tax rates for capital gains. All income is taxed at the same rate. Gains from the sales of ownership interests must first be reduced by the amount of any losses determined from sales or transactions described in Miss. Code Ann. Section 27-7-9(f)(10).',
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
      'packages/engine/src/params/state/data/year2026.ts#MS',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  // ---------------------------------------------------------------------------
  // WS4d Batch B — KY, LA, MD, MA, MI, MN, MT, NE, NH, NJ. 2026-08-27.
  //
  // KY was BLOCKED-SOURCE on the first pass (chapter TOC only). The section
  // PDFs for KRS 141.019 and 141.020 are now staged and registered. NH was
  // blocked on the first pass (DOR Access Denied); the RSA Chapter 77 repeal
  // page is now in the staged set and is registered. KRS 141.0215 (post-1997
  // government-retirement inclusion fraction) is staged but not a pack limb.
  // ---------------------------------------------------------------------------

  'ky-krs-141-retirement-and-social-security': {
    title: 'Kentucky excludes Social Security and up to $31,110 of retirement distributions at a flat 3.5%',
    statement:
      'Kentucky adjusted gross income excludes Social Security and railroad retirement benefits subject to federal income tax, and for taxable years beginning on or after January 1, 2018 excludes up to thirty-one thousand one hundred ten dollars of total distributions from pension plans, annuity contracts, profit-sharing plans, retirement plans, or employee savings plans — a ceiling that reaches IRAs and both public and private employer plans, with no age gate. That is what `taxesSocialSecurity: false` and the shared `{ kind: \'capped\', capPerPerson: 31110 }` pack fields encode, and it is why a shopping-list reading that still describes only certain public-pension relief is rejected. For taxable years beginning on or after January 1, 2026 the tax is three and one-half percent of net income, which is the pack\'s flat 3.5% bracket.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:KY',
    authority: [{
      kind: 'statute',
      citation: 'KRS 141.019(1)(e)',
      url: 'https://apps.legislature.ky.gov/law/statutes/statute.aspx?id=57914',
      quotedText:
        'Exclude Social Security and railroad retirement benefits subject to federal income tax;',
    }, {
      kind: 'statute',
      citation: 'KRS 141.019(1)(g)1.b.',
      url: 'https://apps.legislature.ky.gov/law/statutes/statute.aspx?id=57914',
      quotedText:
        'For taxable years beginning on or after January 1, 2018, exclude up to thirty-one thousand one hundred ten dollars ($31,110) of total distributions from pension plans, annuity contracts, profit-sharing plans, retirement plans, or employee savings plans.',
    }, {
      kind: 'statute',
      citation: 'KRS 141.019(1)(g)2.c.',
      url: 'https://apps.legislature.ky.gov/law/statutes/statute.aspx?id=57914',
      quotedText:
        '"Pension plans, profit-sharing plans, retirement plans, or employee savings plans" means any trust or other entity created or organized under a written retirement plan and forming part of a stock bonus, pension, or profit-sharing plan of a public or private employer for the exclusive benefit of employees or their beneficiaries and includes plans qualified or unqualified under Section 401 of the Internal Revenue Code and individual retirement accounts as defined in Section 408 of the Internal Revenue Code;',
    }, {
      kind: 'statute',
      citation: 'KRS 141.020(2)(f)',
      url: 'https://apps.legislature.ky.gov/law/statutes/statute.aspx?id=56339',
      quotedText:
        'For taxable years beginning on or after January 1, 2026, the tax shall be three and one-half percent (3.5%) of net income.',
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
      'packages/engine/src/params/state/data/year2026.ts#KY',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'la-rs-47-44-1-retirement-exemption': {
    title: 'Louisiana exempts retirement income from age 65, CPI-U indexed from 2026; the pack holds $12,000 flat',
    statement:
      'Louisiana exempts annual retirement income — pension and annuity income included in tax-table income — received by an individual sixty-five years of age or older. The statute states a twelve-thousand-dollar starting amount and requires that amount to be adjusted annually beginning January 1, 2026 by multiplying the prior year\'s exemption by the percentage increase in the CPI-U for the previous calendar year. Approximated: the pack encodes `{ kind: \'capped\', capPerPerson: 12000, minAge: 65 }` as a held-forward unindexed figure, so once the first CPI-U adjustment applies the engine understates the exemption and overstates Louisiana tax. The staged text states the indexing method but does not publish the 2026 indexed dollar, so the accepted reading is that method (first adjustment beginning January 1, 2026) rather than a derived amount. The separate six-thousand-dollar disability exemption in subsection B is not modelled.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:LA',
    authority: [{
      kind: 'statute',
      citation: 'La. R.S. 47:44.1(A)',
      url: 'https://www.legis.la.gov/legis/Law.aspx?d=102133',
      quotedText:
        'Twelve thousand dollars of annual retirement income which is received by an individual sixty-five years of age or older shall be exempt from state income taxation. "Annual retirement income" is defined as pension and annuity income which is included in "tax table income" as defined in R.S. 47:293.  This Section shall not affect the status of any income which is exempt from state income taxation by law.  The amount of the exemption provided for in this Subsection shall be adjusted annually beginning January 1, 2026, by an amount calculated by multiplying the amount of the prior year\'s exemption by the percentage increase in the Consumer Price Index United States city average for all urban consumers (CPI-U),  as reported by the United States Department of Labor, Bureau of Labor Statistics, or its successor, for the previous calendar year.',
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
      'packages/engine/src/params/state/data/year2026.ts#states.LA',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'la-rs-47-44-2-social-security-federal-retirement': {
    title: 'Louisiana exempts Social Security, federal retirement, and railroad retirement',
    statement:
      'Louisiana exempts any benefit received under Chapter 7 of Title 42 of the United States Code, any income received under a retirement system for retirees of the United States Government, and any income received under the Railroad Retirement Act of 1974. That is what `taxesSocialSecurity: false` encodes, and it is the United States Government retirement the pack\'s public-pension `{ kind: \'full\' }` override carries.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:LA',
    authority: [{
      kind: 'statute',
      citation: 'La. R.S. 47:44.2',
      url: 'https://www.legis.la.gov/legis/Law.aspx?d=102134',
      quotedText:
        'Any benefit received by an individual pursuant to the provisions of Chapter 7 of Title 42 of the United States Code (42 U.S.C. 301 et seq.), and any income received by an individual pursuant to a retirement system for retirees of the United States Government or pursuant to the Railroad Retirement Act of 1974 (45 U.S.C. 231 et seq.) shall be exempt from the state income tax.',
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
      'packages/engine/src/params/state/data/year2026.ts#states.LA',
      'packages/engine/src/params/state/data/year2026.ts#PUBLIC_PENSION_OVERRIDES.LA',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'ok-stat-68-2358-retirement-and-social-security': {
    title: 'Oklahoma subtracts Social Security and caps ordinary retirement exclusions at $10,000 per person',
    statement:
      'The Oklahoma Tax Commission\'s Form 511 packet directs a resident to subtract Social Security benefits included in federal AGI and permits each individual to exclude up to $10,000 of qualifying retirement benefits. The packet separately makes military and CSRS retirement fully excludable; the pack carries the common $10,000 cap and Social Security subtraction but cannot distinguish those special categories, so it overstates Oklahoma tax for an eligible military or CSRS retiree. The rate and standard-deduction figures in the pack are not re-asserted by this retirement record.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:OK',
    authority: [{
      kind: 'formInstruction',
      citation: '2025 Oklahoma Form 511 packet, Schedule 511-A line 2',
      url: 'https://oklahoma.gov/content/dam/ok/en/tax/documents/forms/individuals/current/511-Pkt.pdf',
      quotedText:
        'Social Security benefits that are included in the Federal AGI shall be subtracted. Provide a copy of your federal return.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Oklahoma Form 511 packet, Schedule 511-A line 4',
      url: 'https://oklahoma.gov/content/dam/ok/en/tax/documents/forms/individuals/current/511-Pkt.pdf',
      quotedText:
        'Each individual may exclude 100% of retirement benefits from any component of the Armed Forces of the United States.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Oklahoma Form 511 packet, Schedule 511-A line 5',
      url: 'https://oklahoma.gov/content/dam/ok/en/tax/documents/forms/individuals/current/511-Pkt.pdf',
      quotedText:
        'Each individual may exclude their retirement benefits up to $10,000, but not to exceed the amount included in the Federal AGI. (To be eligible, you must have retirement income in your name.) The retirement benefits must be received from the following:',
    }, {
      kind: 'formInstruction',
      citation: '2025 Oklahoma Form 511 packet, Schedule 511-A line 6',
      url: 'https://oklahoma.gov/content/dam/ok/en/tax/documents/forms/individuals/current/511-Pkt.pdf',
      quotedText:
        'Each individual may exclude their retirement benefits up to $10,000, but not to exceed the amount included in the Federal AGI. For any individual who claims the exclusions for government retirees on Schedule 511-A, line 5, the amount of the exclusion on this line cannot exceed $10,000 minus the amounts already claimed on Schedule 511-A, line 5 (if less than zero, enter "0"). If the maximum $10,000 is claimed on Schedule 511-A, line 5, no additional amount is allowed on Schedule 511-A, line 6.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Oklahoma Form 511 packet, Schedule 511-A line 3',
      url: 'https://oklahoma.gov/content/dam/ok/en/tax/documents/forms/individuals/current/511-Pkt.pdf',
      quotedText:
        'Each individual may exclude 100% of their retirement benefits received from the Federal Civil Service Retirement System (CSRS), including survivor benefits, paid in lieu of Social Security to the extent such benefits are included in the Federal AGI.',
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
      'packages/engine/src/params/state/data/year2026.ts#OK',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  // ---------------------------------------------------------------------------
  // Alabama — 2026-08-28. Staged 2025 Form 40 booklet (25f40bk.pdf) and AL DOR
  // individual-income-tax page. The pack's `$6,000` age-65 retirement cap has
  // no operative text in those staged sources (BLOCKED-SOURCE on that limb).
  // ---------------------------------------------------------------------------

  'al-form40-social-security-exclusion': {
    title: 'Alabama excludes Federal Social Security benefits',
    statement:
      'Alabama\'s Form 40 booklet lists Federal Social Security benefits among the amounts a taxpayer does not report. The pack\'s `taxesSocialSecurity: false` omits the federally taxable Social Security share from the Alabama base. The exempt list\'s Federal Railroad Retirement item is registered separately at `al-form40-railroad-retirement-not-modeled` — the engine carries no railroad-retirement input, so that limb has no discriminating fixture here.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:AL',
    authority: [{
      kind: 'formInstruction',
      citation: 'Alabama Department of Revenue, 2025 Form 40 booklet, Examples of Income You DO NOT Report',
      url: 'https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40bk.pdf',
      quotedText:
        'Examples of Income You DO NOT Report … Federal Railroad Retirement benefits. … Federal Social Security benefits.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-28',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.AL',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'al-form40-defined-benefit-414j-exemption': {
    title: 'Alabama exempts any IRC 414(j) defined-benefit payment; the pack caps the private bucket at $6,000',
    statement:
      'The Form 40 booklet lists payments from any defined-benefit retirement plan in accordance with IRC 414(j) among the amounts a taxpayer does not report, whatever the employer. Approximated: the pack has no plan-identity test — `PUBLIC_PENSION_OVERRIDES` carries `AL: { kind: \'full\' }` for the public bucket, consistent with the booklet\'s exempt list of federal, Alabama-system, and military retirement, while `retirementPrivate` stays `{ kind: \'capped\', capPerPerson: 6000, minAge: 65 }` — so a private-employer 414(j) defined-benefit pension riding the private bucket is taxed above the age-65 cap the booklet exempts, overstating Alabama tax. Under the booklet\'s general rule a public-bucket draw not on the exempt list would be taxable, and the pack\'s full override would exempt it — an understating edge this record notes without pinning: which public plans fall outside the exempt list is not established by the staged sources, and the two independent verifiers of this slice split on whether the general rule reaches them. The registered, pinned direction is the private-bucket overstatement.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:AL',
    authority: [{
      kind: 'formInstruction',
      citation: 'Alabama Department of Revenue, 2025 Form 40 booklet, Examples of Income You DO NOT Report',
      url: 'https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40bk.pdf',
      quotedText:
        'Examples of Income You DO NOT Report … Payments from a “Defined Benefit Retirement Plan” in accordance with IRC 414(j). Contact your retirement plan administrator to determine if your plan qualifies.',
    }, {
      kind: 'formInstruction',
      citation: 'Alabama Department of Revenue, 2025 Form 40 booklet, Examples of Income You DO NOT Report (retirement systems)',
      url: 'https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40bk.pdf',
      quotedText:
        'United States Retirement System benefits … State of Alabama Teachers Retirement System benefits … State of Alabama Employees Retirement System benefits … State of Alabama Judicial Retirement System benefits … Military retirement pay',
    }, {
      kind: 'formInstruction',
      citation: 'Alabama Department of Revenue, 2025 Form 40 booklet, Pensions and Annuities — amounts not taxable',
      url: 'https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40bk.pdf',
      quotedText:
        'Any “defined benefit” retirement plan in accordance with IRC 414(j). Contact your retirement plan administrator to determine if your plan qualifies.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-28',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/state/types.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.AL',
      'packages/engine/src/params/state/types.ts#StateRetirementExclusion',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'al-form40-ira-dc-distributions-taxable': {
    title: 'Alabama taxes IRA and defined-contribution distributions on Schedule RS',
    statement:
      'The Form 40 booklet directs a taxpayer to complete Schedule RS for fully or partially taxable IRA distributions, including SEP, Keogh, 401(k)(2), and 403(b) distributions, and states that pension payments are, unless specifically excluded by law, fully taxable only where the taxpayer contributed no cost or has already recovered the cost on prior Alabama returns — a distribution with unrecovered cost is partially taxable. The pack encodes only the fully-taxable side of that rule once a distribution is not on the exempt list: it carries no Alabama cost-recovery mechanics, so the partial-taxability limb for unrecovered cost is registered as an absence at `al-form40-cost-recovery-not-modeled`, never claimed as encoded here.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:AL',
    authority: [{
      kind: 'formInstruction',
      citation: 'Alabama Department of Revenue, 2025 Form 40 booklet, Line 4 — Retirement Income (Schedule RS)',
      url: 'https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40bk.pdf',
      quotedText:
        'Complete Schedule RS to report fully or partially taxable pensions, annuities, IRA distributions (include SEP, Keogh, 401(k)(2), 403(b) distributions), other distributions and retirement distribution(s) exempt from Alabama Income.',
    }, {
      kind: 'formInstruction',
      citation: 'Alabama Department of Revenue, 2025 Form 40 booklet, Pensions and Annuities',
      url: 'https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40bk.pdf',
      quotedText:
        'Generally, unless specifically excluded by law, your pension payments are fully taxable if you did not contribute to the cost of your pension annuity or you have recovered your cost in the plan on prior Alabama income tax returns.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-28',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.AL',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'al-form40-cost-recovery-not-modeled': {
    title: 'Alabama cost-recovery (basis) mechanics for retirement distributions are not modeled',
    statement:
      'The Form 40 booklet makes a pension or IRA distribution with unrecovered cost only partially taxable, and routes withdrawals whose cost recovery began before January 1, 1987 onto a separate pre-1987 worksheet path. RetireGolden\'s state tax input carries only aggregate private and public retirement dollars and ages — no Alabama cost basis, no recovery start date, and no Schedule RS worksheet lines — so no accepted plan fact reaches either cost-recovery limb; the engine taxes a non-exempt distribution in full.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'an Alabama cost basis in a pension or IRA distribution: StateRetirementExclusion carries only aggregate private and public retirement dollars and ages',
      'the date cost recovery began, which selects the pre-1987 worksheet path',
      'the Schedule RS worksheet lines the booklet computes the partial exclusion on',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:AL',
    authority: [{
      kind: 'formInstruction',
      citation: 'Alabama Department of Revenue, 2025 Form 40 booklet, Worksheet for Partially Taxable Pensions — pre-1987 recovery',
      url: 'https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40bk.pdf',
      quotedText:
        'Use lines 1 through 8 to report amounts you withdrew from your IRA, SEP, Keogh, 401(k)(2), or 403(b) account which are not fully taxable and for which you have not recovered any of your cost basis before January 1, 1987. If you began recovering your cost before January 1, 1987, you should report these distributions on lines 11, 12, and 13.',
    }, {
      kind: 'formInstruction',
      citation: 'Alabama Department of Revenue, 2025 Form 40 booklet, Pensions and Annuities',
      url: 'https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40bk.pdf',
      quotedText:
        'Generally, unless specifically excluded by law, your pension payments are fully taxable if you did not contribute to the cost of your pension annuity or you have recovered your cost in the plan on prior Alabama income tax returns.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-28',
    implementedBy: [
      'packages/engine/src/params/state/types.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/types.ts#StateRetirementExclusion',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'al-form40-railroad-retirement-not-modeled': {
    title: 'Alabama excludes Federal Railroad Retirement benefits; the engine has no railroad input',
    statement:
      'The Form 40 booklet lists Federal Railroad Retirement benefits among the amounts a taxpayer does not report. Out of scope: the engine has no railroad-retirement income field, so the exclusion cannot be modeled or discriminated by a fixture — a household entering railroad benefits as ordinary income would see them taxed where the booklet exempts them. Registered as an absence rather than folded into the Social Security record, whose fixture only exercises `taxesSocialSecurity`.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'a railroad-retirement income stream: incomeStreamSchema has no railroad-retirement type, and a household entering the benefits as ordinary income is indistinguishable from any other ordinary stream',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:AL',
    authority: [{
      kind: 'formInstruction',
      citation: 'Alabama Department of Revenue, 2025 Form 40 booklet, Examples of Income You DO NOT Report',
      url: 'https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40bk.pdf',
      quotedText:
        'Examples of Income You DO NOT Report … United States Retirement System benefits. … Federal Railroad Retirement benefits.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-28',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#incomeStreamSchema',
      'packages/engine/src/params/state/data/year2026.ts#states.AL',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'al-form40-personal-and-dependent-exemptions-not-modeled': {
    title: 'Alabama subtracts personal and dependent exemptions the engine does not model',
    statement:
      'Form 40 subtracts a personal exemption on line 13, taken from the filing-status line, and a dependent exemption on line 14 for each qualifying dependent. Approximated: `computeStateTaxableIncome` subtracts only the standard deduction and retirement exclusions, so every Alabama return is overtaxed by the omitted exemptions at the filer\'s marginal rate. The pin uses the booklet\'s only extractable personal-exemption dollar — the $1,500 of the dependent-filer passage — as a floor: any line-1-through-4 amount at or above it makes the true overstatement at least the pinned delta. The filing-status amounts and the line-14 dependent dollar print on the form face and are not quote-carried, so those limbs are named but unpinned. The Department\'s rate page also attaches the schedules only at stated adjusted-gross-income levels; within the modeled filing statuses that applicability floor is arithmetically shadowed by these exemptions plus the standard deduction, so no separate below-threshold record is registered.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:AL',
    authority: [{
      kind: 'formInstruction',
      citation: 'Alabama Department of Revenue, 2025 Form 40 booklet, Line 13 — Personal Exemption',
      url: 'https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40bk.pdf',
      quotedText:
        'Line 13 Personal Exemption Enter the personal exemption from line 1, 2, 3, or 4.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Alabama Department of Revenue, Individual Income Tax — Rate (applicability levels)',
      url: 'https://www.revenue.alabama.gov/individual-corporate/taxes-administered-by-individual-corporate-income-tax/individual-income-tax/',
      quotedText:
        'Single persons with adjusted gross income of $4,000, head of family with adjusted gross income of $7,700, and married persons filing separate returns with adjusted gross income of $5,250 or more: 2 percent on first $500 of taxable income',
    }, {
      kind: 'formInstruction',
      citation: 'Alabama Department of Revenue, 2025 Form 40 booklet, Dependent\'s and Student\'s Income',
      url: 'https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40bk.pdf',
      quotedText:
        'exemption of $1,500, and his or her parents may claim a dependent exemption if they provided more than 50% of his or her total support.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-28',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.AL',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'al-form40-age-65-retirement-exclusion-cap': {
    title: 'Alabama\'s age-65 retirement exclusion: the pack\'s $6,000 private-bucket cap has no staged operative text',
    statement:
      'The pack encodes `retirementPrivate: { kind: \'capped\', capPerPerson: 6000, minAge: 65 }` — the private bucket only; the public bucket carries its own full override. The staged Form 40 booklet establishes that non-exempt pensions and IRA distributions are taxable but carries no operative text for an age-65 dollar exclusion, and the repo\'s research corpus describes a $6,000-per-person age-65 exclusion of defined-contribution retirement income for 2025 rising to $12,000 for 2026 — a description this registry cannot quote as authority. Unsettled: the encoded $6,000, the research corpus\'s larger 2026 amount, and the staged instructions\' silence are recorded side by side; no reading is presented as settled until a quotable primary is staged.',
    classification: 'unsettled',
    contraryReading:
      'If the research corpus\'s 2026 parameter is operative — $12,000 per person at age 65 — the pack\'s $6,000 understates the exclusion and overstates Alabama tax; if no exclusion exists, the pack understates tax by the granted cap.',
    errorDirection: null,
    conventionRationale:
      'BLOCKED-SOURCE: the $6,000 age-65 exclusion\'s operative text is not in the staged booklet; quote pends a staged primary',
    jurisdiction: 'state:AL',
    authority: [{
      kind: 'formInstruction',
      citation: 'Alabama Department of Revenue, 2025 Form 40 booklet, Pensions and Annuities',
      url: 'https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40bk.pdf',
      quotedText:
        'Generally, unless specifically excluded by law, your pension payments are fully taxable if you did not contribute to the cost of your pension annuity or you have recovered your cost in the plan on prior Alabama income tax returns.',
    }, {
      kind: 'formInstruction',
      citation: 'Alabama Department of Revenue, 2025 Form 40 booklet, Line 4 — Retirement Income (Schedule RS)',
      url: 'https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40bk.pdf',
      quotedText:
        'Complete Schedule RS to report fully or partially taxable pensions, annuities, IRA distributions (include SEP, Keogh, 401(k)(2), 403(b) distributions), other distributions and retirement distribution(s) exempt from Alabama Income.',
    }],
    volatility: 'awaitingGuidance',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-28',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/state/types.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.AL',
      'packages/engine/src/params/state/types.ts#StateRetirementExclusion',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'al-form40-standard-deduction-agi-slide': {
    title: 'Alabama\'s standard deduction slides down with AGI; the pack holds the maxima flat',
    statement:
      'The Form 40 booklet requires a standard-deduction claimant to use the page-9 chart, which reduces the deduction as Alabama adjusted gross income rises — for a single filer from $3,000 at AGI $0–$12,999 down to $2,500 at AGI $17,750 and above, and for joint filers from $8,500 at AGI $0–$25,999 down to $5,000 at AGI $35,500 and above. Approximated: the pack\'s `standardDeduction: { single: 3000, marriedFilingJointly: 8500 }` grants those maxima at every income, understating tax wherever the chart has already slid. The chart-row quotes verify against the staged booklet copy; the live PDF\'s chart region defeats the fetch-time extractor, so the fidelity ledger carries them as PDF-NOT-VERIFIABLE rather than confirmed — the documented undetermined class.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale: null,
    jurisdiction: 'state:AL',
    authority: [{
      kind: 'formInstruction',
      citation: 'Alabama Department of Revenue, 2025 Form 40 booklet, Line 11 — Standard Deduction',
      url: 'https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40bk.pdf',
      quotedText:
        'Standard Deduction. If you elect to claim the Standard Deduction, you must check box b on line 11 and use the Standard Deduction chart on page 9 to determine your allowable deduction.',
    }, {
      kind: 'formInstruction',
      citation: 'Alabama Department of Revenue, 2025 Form 40 booklet, page 9 Standard Deduction chart — Single column',
      url: 'https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40bk.pdf',
      quotedText:
        '$ 0 – $12,999 … $3,000 … $17,750 and above … $2,500',
    }, {
      kind: 'formInstruction',
      citation: 'Alabama Department of Revenue, 2025 Form 40 booklet, page 9 Standard Deduction chart — Married Filing Joint column',
      url: 'https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40bk.pdf',
      quotedText:
        '$ 0 – $25,999 … $8,500 … $35,500 and above … $5,000',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-28',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.AL',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'al-dor-individual-income-tax-rate-schedule': {
    title: 'Alabama taxes taxable income at 2%, 4%, and 5% with filing-status break points',
    statement:
      'The Alabama Department of Revenue\'s individual income-tax page states the rate schedule: for a single filer, 2 percent on the first $500 of taxable income, 4 percent on the next $2,500, and 5 percent on all over $3,000; for married filing jointly, 2 percent on the first $1,000, 4 percent on the next $5,000, and 5 percent on all over $6,000. The pack\'s `brackets` carry those rates and break points.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:AL',
    authority: [{
      kind: 'stateAgencyPublication',
      citation: 'Alabama Department of Revenue, Individual Income Tax — Rate',
      url: 'https://www.revenue.alabama.gov/individual-corporate/taxes-administered-by-individual-corporate-income-tax/individual-income-tax/',
      quotedText:
        'Single persons with adjusted gross income of $4,000, head of family with adjusted gross income of $7,700, and married persons filing separate returns with adjusted gross income of $5,250 or more: 2 percent on first $500 of taxable income … 4 percent on next $2,500 … 5 percent on all over $3,000',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Alabama Department of Revenue, Individual Income Tax — Rate (joint)',
      url: 'https://www.revenue.alabama.gov/individual-corporate/taxes-administered-by-individual-corporate-income-tax/individual-income-tax/',
      quotedText:
        'Married persons filing a joint return with adjusted gross income of $10,500 or more: … 2 percent on first $1,000 … 4 percent on next $5,000 … 5 percent on all over $6,000',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-28',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.AL',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxDetail',
    ],
  },
} satisfies Record<string, TaxRuleRecord>
