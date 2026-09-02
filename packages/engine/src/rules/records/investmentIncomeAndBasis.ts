/**
 * Investment income and basis records: the preferential rate schedule and its
 * stacking, capital loss offset and carryforward, wash sales, lot basis and basis at
 * death, the net investment income tax, municipal and federal obligation interest,
 * savings bonds, and TIPS inflation adjustments.
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
export const investmentIncomeAndBasisRecords = {
  'irc-1411-a-net-investment-income-tax': {
    title: 'Net investment income tax is the lesser of two amounts',
    statement:
      'The 3.8 percent tax applies to the lesser of net investment income for the year or the excess of modified adjusted gross income over the threshold amount. A taxpayer with large investment income but modified adjusted gross income barely over the threshold is taxed on the small excess, not on the investment income.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The thresholds are not indexed, so the record is static rather than annually indexed. Modified adjusted gross income is built under 1411(d) rather than read off the adjusted gross income line; see irc-1411-d-modified-agi-foreign-exclusion-addback.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 1411(a)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1411&num=0&edition=prelim',
      quotedText:
        'In the case of an individual, there is hereby imposed (in addition to any other tax imposed by this subtitle) for each taxable year a tax equal to 3.8 percent of the lesser of- (A) net investment income for such taxable year, or (B) the excess (if any) of- (i) the modified adjusted gross income for such taxable year, over (ii) the threshold amount.',
    }, {
      kind: 'statute',
      citation: 'IRC 1411(b)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1411&num=0&edition=prelim',
      quotedText:
        'For purposes of this chapter, the term "threshold amount" means- (1) in the case of a taxpayer making a joint return under section 6013 or a surviving spouse (as defined in section 2(a)), $250,000, (2) in the case of a married taxpayer (as defined in section 7703) filing a separate return, ½ of the dollar amount determined under paragraph (1), and (3) in any other case, $200,000.',
    }],
    volatility: 'staticStatute',
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

  'irc-1411-tax-exempt-interest-outside-both-niit-legs': {
    title: 'Tax-exempt interest enters neither leg of the net investment income tax',
    statement:
      'Net investment income reaches gross income from interest, and interest excluded from gross income under section 103 is never gross income, so tax-exempt interest is not net investment income; the modified adjusted gross income compared against the section 1411(b) threshold adds back only the section 911 foreign exclusion. Tax-exempt interest is accordingly never counted in the income leg and never an add-back to the threshold leg — though when Social Security is present it can still lift the threshold leg indirectly, by raising taxable benefits under section 86 and with them adjusted gross income.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 103(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section103&num=0&edition=prelim',
      quotedText:
        'Except as provided in subsection (b), gross income does not include interest on any State or local bond.',
    }, {
      kind: 'statute',
      citation: 'IRC 1411(c)(1)(A)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1411&num=0&edition=prelim',
      quotedText:
        'gross income from interest, dividends, annuities, royalties, and rents, other than such income which is derived in the ordinary course of a trade or business not described in paragraph (2),',
    }, {
      kind: 'statute',
      citation: 'IRC 1411(d)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1411&num=0&edition=prelim',
      quotedText:
        'the term "modified adjusted gross income" means adjusted gross income increased by the excess of- (1) the amount excluded from gross income under section 911(a)(1), over (2) the amount of any deductions (taken into account in computing adjusted gross income) or exclusions disallowed under section 911(d)(6) with respect to the amounts described in paragraph (1).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-07',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
    implementedByFunctions: [
      'packages/engine/src/tax/federalTax.ts#computeFederalTax',
    ],
  },

  'irc-103-a-state-local-bond-interest-exclusion': {
    title: 'State and local bond interest is excluded from gross income',
    statement:
      'Except for the section 103(b) exceptions, interest on a State or local bond is excluded from gross income under IRC 103(a). The engine keeps municipal-bond interest in its separate tax-exempt stream, so the interest itself never enters federal ordinary income, AGI, or federal taxable income by direct inclusion. Municipal-bond interest can still raise AGI indirectly through section 86: it increases provisional income and can enlarge the taxable Social Security inclusion that does enter AGI.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 103(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section103&num=0&edition=prelim',
      quotedText:
        'Except as provided in subsection (b), gross income does not include interest on any State or local bond.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/projection/internal/distributedTaxableYieldRows.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/projection/internal/distributedTaxableYieldRows.ts#distributedTaxableYieldRows',
      'packages/engine/src/tax/federalTax.ts#computeFederalTax',
    ],
  },

  'irc-1211-b-capital-loss-ordinary-offset': {
    title: 'A net capital loss offsets ordinary income only up to 3,000 dollars',
    statement:
      'Losses from sales of capital assets are allowed against gains, plus the lower of 3,000 dollars or the excess of losses over gains. The rest is not lost; it carries forward under section 1212(b), so a large loss is deducted a little at a time rather than all at once.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The statute sets 1,500 dollars for a married individual filing separately. The projection collapses every filing status to single or married-filing-jointly, so that case is out of scope rather than handled at half the cap. The 3,000 dollar figure has never been indexed since 1978.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 1211(b)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1211&num=0&edition=prelim',
      quotedText:
        'In the case of a taxpayer other than a corporation, losses from sales or exchanges of capital assets shall be allowed only to the extent of the gains from such sales or exchanges, plus (if such losses exceed such gains) the lower of- (1) $3,000 ($1,500 in the case of a married individual filing a separate return), or (2) the excess of such losses over such gains.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-29',
    implementedBy: [
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/tax/federalTax.ts#applyCapitalLossCarryforward',
    ],
  },

  'irc-1212-b-capital-loss-carryforward': {
    title: 'Individual capital-loss carryforwards continue into succeeding tax years',
    statement:
      'After the section 1211(b) ordinary-income allowance is taken, a noncorporate taxpayer\'s remaining net capital loss is a capital loss in the succeeding taxable year. The projection keeps the unabsorbed balance in a single carryforward pool and applies it again in later years until gains and the annual ordinary-income allowance exhaust it; it does not impose a fixed expiration year.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The plan stores one combined pool rather than separate short- and long-term carryovers. That missing character is already registered with the account-level lot and holding-period approximation (treas-reg-1-1012-1-c-lot-basis-and-holding-period). The section 1212(b)(2) adjusted-taxable-income limit on how much of a section 1211(b) allowance burns the carryforward pool in a zero-income year is registered separately. The describeRule fixture drives the pool through simulatePlan so the year-to-year threading in simulate.ts is inside the rule\'s coverage.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 1212(b)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1212&num=0&edition=prelim',
      quotedText:
        'If a taxpayer other than a corporation has a net capital loss for any taxable year- (A) the excess of the net short-term capital loss over the net long-term capital gain for such year shall be a short-term capital loss in the succeeding taxable year, and (B) the excess of the net long-term capital loss over the net short-term capital gain for such year shall be a long-term capital loss in the succeeding taxable year.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/tax/federalTax.ts#applyCapitalLossCarryforward',
    ],
  },

  'irc-1212-b-2-zero-income-section-1211-allowance-preserves-carryforward': {
    title: 'A section 1211(b) allowance cannot burn the carryforward pool without adjusted taxable income',
    statement:
      'For purposes of measuring the excess that becomes next year\'s capital loss under section 1212(b)(1), section 1212(b)(2)(A) treats as a short-term capital gain only the lesser of the section 1211(b) amount allowed for the year or the year\'s adjusted taxable income, and (B) defines that adjusted taxable income so a year with no taxable income to offset preserves the unused loss in the carryforward pool rather than consuming it.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale:
      'applyCapitalLossCarryforward burns up to the annual ordinary-income allowance from the pool whenever a loss remains, even when ordinary income is zero and there is no taxable income for a section 1211(b) deduction to offset. A smaller remaining pool overstates tax when a later year\'s gains would otherwise have been absorbed. The companion fixture pins a zero-income year\'s remaining pool against statutory preservation.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 1212(b)(2)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1212&num=0&edition=prelim',
      quotedText:
        'For purposes of determining the excess referred to in subparagraph (A) or (B) of paragraph (1), there shall be treated as a short-term capital gain in the taxable year an amount equal to the lesser of- (i) the amount allowed for the taxable year under paragraph (1) or (2) of section 1211(b), or (ii) the adjusted taxable income for such taxable year.',
    }, {
      kind: 'statute',
      citation: 'IRC 1212(b)(2)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1212&num=0&edition=prelim',
      quotedText:
        'For purposes of subparagraph (A), the term "adjusted taxable income" means taxable income increased by the sum of- (i) the amount allowed for the taxable year under paragraph (1) or (2) of section 1211(b), and (ii) the deduction allowed for such year under section 151 or any deduction in lieu thereof. ... For purposes of the preceding sentence, any excess of the deductions allowed for the taxable year over the gross income for such year shall be taken into account as negative taxable income.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
    implementedByFunctions: [
      'packages/engine/src/tax/federalTax.ts#applyCapitalLossCarryforward',
    ],
  },

  'irc-1-h-1-0-15-20-preferential-rate-schedule': {
    title: 'The modeled net-capital-gain schedule has 0, 15, and 20 percent layers',
    statement:
      'For the adjusted net capital gain the engine models, section 1(h)(1) applies a zero-percent layer, then a 15-percent layer, then a 20-percent layer. Section 1(j)(5)(B) supplies the maximum zero rate amount and maximum 15-percent rate amount that override the statute\'s 25-percent and 39.6-percent boundary references; the 2026 pack stores those indexed dollars. The rates and the order of the layers are statutory; this record does not reach the separately registered 25-percent unrecaptured-section-1250 or 28-percent collectibles layers.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The quoted 1(h)(1) text still keys its layer boundaries to income taxed below 25 and 39.6 percent; section 1(j)(5)(B) overrides those references with the maximum zero rate amount and maximum 15-percent rate amount, which are the indexed dollar breakpoints the parameter pack stores and the engine reads. The rates and layer order come from the quoted text; the boundary dollars come from the override and the Rev. Proc. 2025-32 2026 amounts. The companion fixture locks the rates and layer order against the 2026 pack only.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 1(h)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1&num=0&edition=prelim',
      quotedText:
        'If a taxpayer has a net capital gain for any taxable year, the tax imposed by this section for such taxable year shall not exceed the sum of- (A) a tax computed at the rates and in the same manner as if this subsection had not been enacted on the greater of- (i) taxable income reduced by the net capital gain; or (ii) the lesser of- (I) the amount of taxable income taxed at a rate below 25 percent; or (II) taxable income reduced by the adjusted net capital gain; (B) 0 percent of so much of the adjusted net capital gain (or, if less, taxable income) as does not exceed the excess (if any) of- (i) the amount of taxable income which would (without regard to this paragraph) be taxed at a rate below 25 percent, over (ii) the taxable income reduced by the adjusted net capital gain; (C) 15 percent of the lesser of- (i) so much of the adjusted net capital gain (or, if less, taxable income) as exceeds the amount on which a tax is determined under subparagraph (B), or (ii) the excess of- (I) the amount of taxable income which would (without regard to this paragraph) be taxed at a rate below 39.6 percent, over (II) the sum of the amounts on which a tax is determined under subparagraphs (A) and (B), (D) 20 percent of the adjusted net capital gain (or, if less, taxable income) in excess of the sum of the amounts on which tax is determined under subparagraphs (B) and (C),',
    }, {
      kind: 'statute',
      citation: 'IRC 1(j)(5)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1&num=0&edition=prelim',
      quotedText:
        'Section 1(h)(1) shall be applied- (i) by substituting "below the maximum zero rate amount" for "which would (without regard to this paragraph) be taxed at a rate below 25 percent" in subparagraph (B)(i), and (ii) by substituting "below the maximum 15-percent rate amount" for "which would (without regard to this paragraph) be taxed at a rate below 39.6 percent" in subparagraph (C)(ii)(I).',
    }, {
      kind: 'irsNotice',
      citation: 'Rev. Proc. 2025-32, section 4.03',
      url: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
      quotedText:
        'Maximum Capital Gains Rate (§ 1(h), § 1(j)(5)). For taxable years beginning in 2026, the maximum zero rate amounts and maximum 15 percent rate amounts under § 1(j)(5)(B), as adjusted for inflation, are as follows: ... All Other Individuals $49,450 ... $545,500',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/tax/federalTax.ts#capitalGainsTaxStacked',
    ],
  },

  'irc-1-h-optimizer-flat-fifteen-percent-preferential-rate': {
    title: 'The optimizer linearizes all taxable-bucket gain at 15 percent',
    statement:
      'The optimizer prices every taxable-bucket gain at one 15-percent federal preferential rate, rather than the statutory 0/15/20-percent layers. That can overstate the taxpayer\'s exposure when the marginal gain is in the zero-percent layer and understate it when the marginal gain is in the 20-percent layer; the exact ledger later re-prices a proposed schedule, but the linearized solve itself remains directional only by scenario.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'A single rate makes the optimizer\'s taxable-bucket objective linear. Its 15-percent value is a chosen planning approximation, not a statutory rate that applies uniformly to a taxpayer\'s gains. The companion fixtures pin marginal rates in the same unit: the statutory marginal rate derived from the exact tax delta on the plan the optimizer sees, against the optimizer\'s flat 0.15.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 1(h)(1)(B)-(D)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1&num=0&edition=prelim',
      quotedText:
        '(B) 0 percent of so much of the adjusted net capital gain (or, if less, taxable income) as does not exceed the excess (if any) of- (i) the amount of taxable income which would (without regard to this paragraph) be taxed at a rate below 25 percent, over (ii) the taxable income reduced by the adjusted net capital gain; (C) 15 percent of the lesser of- (i) so much of the adjusted net capital gain (or, if less, taxable income) as exceeds the amount on which a tax is determined under subparagraph (B), or (ii) the excess of- (I) the amount of taxable income which would (without regard to this paragraph) be taxed at a rate below 39.6 percent, over (II) the sum of the amounts on which a tax is determined under subparagraphs (A) and (B), (D) 20 percent of the adjusted net capital gain (or, if less, taxable income) in excess of the sum of the amounts on which tax is determined under subparagraphs (B) and (C),',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: ['packages/engine/src/projection/optimizePlan.ts'],
    implementedByFunctions: [
      'packages/engine/src/projection/optimizePlan.ts#buildOptimizerInput',
      'packages/engine/src/projection/optimizePlan.ts#LP_LTCG_RATE',
    ],
  },

  'irc-1091-a-wash-sale-thirty-day-window': {
    title: 'Wash-sale losses are disallowed for substantially identical securities acquired in the 61-day window',
    statement:
      'A claimed stock-or-security loss is disallowed when the taxpayer acquires substantially identical stock or securities, or enters a contract or option to acquire them, from 30 days before through 30 days after the sale or disposition, subject to the dealer exception. The engine nevertheless emits a realized loss on a taxable-account sale and deducts it through the capital-loss path; nothing fails closed. A wash-sale reality would disallow that deduction, understating tax in the sale year, while replacement-basis effects under section 1091(d) can flip later years — the same both-directions pattern as the account-level lot and holding-period approximation.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'Approximated rather than out of scope because the engine emits a realized gain or loss for every taxable sale and deducts net losses through the capital-loss path in simulate.ts; nothing here fails closed. The accepted Plan surface is model/plan.ts: a taxable account carries aggregate balance and cost basis, but no security or lot identity, acquisition or disposition date, replacement purchase, contract or option, substantially-identical determination, or dealer-status fact, so a wash-sale cannot be identified and every realized loss is allowed. The companion fixture drives one taxable account (basis above balance) through simulatePlan with a year-one one-time goal forcing its full sale and wages high enough to absorb the section 1211(b) ordinary offset, then stands that single observed ordinary-offset figure against both authority limbs: (1) replacement inside the 61-day window (deduction disallowed → $0) and (2) no replacement purchase (loss allowed → $3,000). The Plan cannot express a replacement purchase, so the annual projection observably deducts $3,000 under both limbs — that collapse is the approximation. Understating tax in the sale year and over- or under-stating it later through missing replacement-basis adjustments is why the direction cannot be narrowed — the same rationale shape as treas-reg-1-1012-1-c-lot-basis-and-holding-period.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 1091(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1091&num=0&edition=prelim',
      quotedText:
        'In the case of any loss claimed to have been sustained from any sale or other disposition of shares of stock or securities where it appears that, within a period beginning 30 days before the date of such sale or disposition and ending 30 days after such date, the taxpayer has acquired (by purchase or by an exchange on which the entire amount of gain or loss was recognized by law), or has entered into a contract or option so to acquire, substantially identical stock or securities, then no deduction shall be allowed under section 165 unless the taxpayer is a dealer in stock or securities and the loss is sustained in a transaction made in the ordinary course of such business.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/projection/internal/annualWithdrawalPlanning.ts',
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/model/plan.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#taxableAccountSchema',
      'packages/engine/src/projection/internal/annualWithdrawalPlanning.ts#annualWithdrawalPlan',
      'packages/engine/src/tax/federalTax.ts#applyCapitalLossCarryforward',
    ],
  },

  'rev-rul-2008-5-ira-wash-sale-permanent-loss-disallowance': {
    title: 'An IRA repurchase disallows the wash-sale loss without an IRA basis adjustment',
    statement:
      'When an individual sells stock at a loss and causes that individual\'s traditional or Roth IRA to buy substantially identical stock within the section 1091 window, the loss is disallowed and the IRA\'s basis is not increased. The loss therefore has no replacement-basis adjustment inside the IRA. Not modelled: the plan has no security or lot identities, trade dates, taxable-to-IRA ownership linkage, or IRA purchase event to reach this ruling.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'TaxRuleAuthorityKind has no revenue-ruling member. This is recorded as irsNotice, the closest existing kind for IRB guidance — a revenue ruling is IRB guidance; a publication is not.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'irsNotice',
      citation: 'Rev. Rul. 2008-5, FACTS',
      url: 'https://www.irs.gov/pub/irs-drop/rr-08-05.pdf',
      quotedText:
        'A, an individual, owns 100 shares of X Company stock with a basis of $1,000. On December 20, 2007, A sells the 100 shares of X Company stock for $600 (the “Sale”). On December 21, 2007, A causes an individual retirement account (within the meaning of § 408) or a Roth IRA (within the meaning of § 408A), established for the exclusive benefit of A or A’s beneficiaries, to purchase 100 shares of X Company stock for its then fair market value (the “Purchase”).',
    }, {
      kind: 'irsNotice',
      citation: 'Rev. Rul. 2008-5, HOLDING',
      url: 'https://www.irs.gov/pub/irs-drop/rr-08-05.pdf',
      quotedText:
        'The loss on the Sale of stock is disallowed under § 1091. A’s basis in the individual retirement account or Roth IRA is not increased by virtue of § 1091(d).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: ['packages/engine/src/model/plan.ts'],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#taxableAccountSchema',
    ],
  },

  'irc-1014-a-1-basis-at-death-fair-market-value': {
    title: 'Inherited property generally takes date-of-death fair-market-value basis',
    statement:
      'Subject to the section 1014 exceptions and any alternate-valuation election, property acquired from a decedent generally takes the property\'s fair market value at the decedent\'s date of death as its basis, so heirs are not taxed on embedded gain at death. The estate/legacy metric in compare.ts keeps taxable balances whole and charges heirs nothing on that embedded gain (an implicit full step-up), while simulate.ts never writes date-of-death fair market value onto costBasis, so a post-death sale in the surviving path keeps the original basis and can tax the same embedded gain.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'Approximated rather than out of scope because both surfaces produce figures the rule touches. compare.ts\'s after-tax estate treats taxable (and equity-comp) balances as stepped-up and untaxed to heirs, while simulate.ts leaves costBasis unchanged through a death year, so the surviving path can realize the pre-death embedded gain. One half understates heir tax relative to a no-step-up reading; the other overstates tax on a post-death sale relative to a consistent step-up. The companion fixture discriminates those readings through simulatePlan and summarizeProjection.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 1014(a)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1014&num=0&edition=prelim',
      quotedText:
        'Except as otherwise provided in this section, the basis of property in the hands of a person acquiring the property from a decedent or to whom the property passed from a decedent shall, if not sold, exchanged, or otherwise disposed of before the decedent\'s death by such person, be- (1) the fair market value of the property at the date of the decedent\'s death,',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.1014-1(a)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.1014-1',
      quotedText:
        'The purpose of section 1014 is, in general, to provide a basis for property acquired from a decedent that is equal to the value placed upon such property for purposes of the federal estate tax. Accordingly, the general rule is that the basis of property acquired from a decedent is the fair market value of such property at the date of the decedent\'s death, or, if the decedent\'s executor so elects, at the alternate valuation date prescribed in section 2032, or in section 811(j) of the Internal Revenue Code (Code) of 1939.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/projection/compare.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/model/plan.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#taxableAccountSchema',
      'packages/engine/src/projection/compare.ts#summarizeProjection',
      'packages/engine/src/projection/simulate.ts#BalanceState',
    ],
  },

  'irc-1400z-2-qof-deferral-and-ten-year-basis-election': {
    title: 'Qualified opportunity fund investment defers eligible gain and can receive a ten-year basis election',
    statement:
      'For elections on sales or exchanges on or before December 31, 2026 (the legacy limb), a taxpayer may elect to exclude eligible gain to the amount invested in a qualified opportunity fund within 180 days, no new election may be made after that date, and deferred gain is included at the earlier of disposition or December 31, 2026. Pub. L. 119-21 (OBBBA sec. 70421) amended section 1400Z-2 for amounts invested after December 31, 2026 into a permanent regime: the amended (a)(2) carries no December 31, 2026 bar (only the prior-election-in-effect limit), deferred gain is included at the earlier of disposition or five years after the QOF investment, and a qualifying investment held at least 10 years can still elect fair-market-value basis (with the amended (c) limbs). Not modelled: the plan has no qualified-opportunity-fund account or election, eligible-sale or unrelated-person facts, investment amount or date, deferred-gain basis, or ten-year holding-period fact.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'One record keeps both limbs quote-carried from the staged compiled text. The body still prints the pre-2027 December 31, 2026 election and inclusion cutoffs; the Amendment of Section note carries the Pub. L. 119-21 post-2026 permanent text (rolling five-year deferral, amended (a)(2) without a new-sale cutoff, qualified rural opportunity fund). volatility is staticStatute because the program is permanent after the amending act — sunsetting would fit only a legacy-only record — and the legacy cutoff stays in the statement rather than effectiveThrough, which moots a dueOn-after-cutoff alarm for a still-open permanent regime.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 1400Z-2(a)(1)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1400Z-2&num=0&edition=prelim',
      quotedText:
        'In the case of gain from the sale to, or exchange with, an unrelated person of any property held by the taxpayer, at the election of the taxpayer- (A) gross income for the taxable year shall not include so much of such gain as does not exceed the aggregate amount invested by the taxpayer in a qualified opportunity fund during the 180-day period beginning on the date of such sale or exchange,',
    }, {
      kind: 'statute',
      citation: 'IRC 1400Z-2(a)(2) (legacy pre-2027 elections)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1400Z-2&num=0&edition=prelim',
      quotedText:
        'No election may be made under paragraph (1)- (A) with respect to a sale or exchange if an election previously made with respect to such sale or exchange is in effect, or (B) with respect to any sale or exchange after December 31, 2026.',
    }, {
      kind: 'statute',
      citation: 'IRC 1400Z-2(b)(1) (legacy pre-2027 elections)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1400Z-2&num=0&edition=prelim',
      quotedText:
        'Gain to which subsection (a)(1)(B) applies shall be included in income in the taxable year which includes the earlier of- (A) the date on which such investment is sold or exchanged, or (B) December 31, 2026.',
    }, {
      kind: 'legislativeHistory',
      citation: 'Amendment note to IRC 1400Z-2, P.L. 119-21 sec. 70421 - post-2026 (a)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1400Z-2&num=0&edition=prelim',
      quotedText:
        '"No election may be made under paragraph (1) with respect to a sale or exchange if an election previously made with respect to such sale or exchange is in effect."',
    }, {
      kind: 'legislativeHistory',
      citation: 'Amendment note to IRC 1400Z-2, P.L. 119-21 sec. 70421 - post-2026 (b)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1400Z-2&num=0&edition=prelim',
      quotedText:
        '"Gain to which subsection (a)(1)(B) applies shall be included in gross income in the taxable year which includes the earlier of- "(A) the date on which such investment is sold or exchanged, or "(B) the date which is 5 years after the date the investment in the qualified opportunity fund was made.',
    }, {
      kind: 'statute',
      citation: 'IRC 1400Z-2(c) (legacy / continuing ten-year election)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1400Z-2&num=0&edition=prelim',
      quotedText:
        'In the case of any investment held by the taxpayer for at least 10 years and with respect to which the taxpayer makes an election under this clause, the basis of such property shall be equal to the fair market value of such investment on the date that the investment is sold or exchanged.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: ['packages/engine/src/model/plan.ts'],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#taxableAccountSchema',
    ],
  },

  'irc-1-h-capital-gain-stacked-on-ordinary': {
    title: 'Net capital gain stacks on top of ordinary taxable income',
    statement:
      'The preferential rates apply to bands measured from where ordinary taxable income ends, not from zero. Ordinary income fills the lower brackets first and the net capital gain sits on top of it, so the same gain can be taxed at 0, 15 or 20 percent depending only on how much ordinary income precedes it.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The statute frames the result as a ceiling -- the tax "shall not exceed" the sum of its components -- and enumerates the bands as offsets from the amount of taxable income otherwise taxed below 25 percent. The engine computes the bands directly from the ordinary taxable amount, which reaches the same figure for the rate schedule it models and is the reason the code carries no explicit 25 percent reference.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 1(h)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/1',
      quotedText:
        'If a taxpayer has a net capital gain for any taxable year, the tax imposed by this section for such taxable year shall not exceed the sum of - (A) a tax computed at the rates and in the same manner as if this subsection had not been enacted on the greater of - (i) taxable income reduced by the net capital gain; or (ii) the lesser of - (I) the amount of taxable income taxed at a rate below 25 percent; or (II) taxable income reduced by the adjusted net capital gain, (B) 0 percent of so much of the adjusted net capital gain (or, if less, taxable income) as does not exceed the excess (if any) of - (i) the amount of taxable income which would (without regard to this paragraph) be taxed at a rate below 25 percent, over (ii) the taxable income reduced by the adjusted net capital gain.',
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
      'packages/engine/src/tax/federalTax.ts#capitalGainsTaxStacked',
    ],
  },

  'irc-121-d-6-exclusion-cannot-reach-recapture': {
    title: 'The residence exclusion cannot reach depreciation recapture',
    statement:
      'Gain on a principal residence owned and used as such for two of the preceding five years is excluded up to 250,000 dollars, or 500,000 on a joint return. The exclusion does not apply to gain up to the depreciation adjustments attributable to periods after 6 May 1997, so recapture is carved out first and the cap then applies only to what remains.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The engine takes recapture as an input rather than deriving it from a depreciation schedule, and prices it at ordinary rates rather than the section 1250 25 percent maximum. Both are planning-grade stand-ins; the ordering that this rule fixes is not.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 121(a)',
      url: 'https://www.law.cornell.edu/uscode/text/26/121',
      quotedText:
        'Gross income shall not include gain from the sale or exchange of property if, during the 5-year period ending on the date of the sale or exchange, such property has been owned and used by the taxpayer as the taxpayer\u2019s principal residence for periods aggregating 2 years or more.',
    }, {
      kind: 'statute',
      citation: 'IRC 121(d)(6)',
      url: 'https://www.law.cornell.edu/uscode/text/26/121',
      quotedText:
        'Subsection (a) shall not apply to so much of the gain from the sale of any property as does not exceed the portion of the depreciation adjustments (as defined in section 1250(b)(3)) attributable to periods after May 6, 1997, in respect of such property.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/tax/propertySale.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/tax/propertySale.ts#propertySaleTax',
    ],
  },

  'usc-31-3124-a-federal-obligations-state-exempt': {
    title: 'Interest on federal obligations is outside every state income tax base',
    statement:
      'Stocks and obligations of the United States Government are exempt from taxation by a State or its subdivisions, and the exemption reaches any form of taxation that would require the interest to be counted in computing a tax. Only a nondiscriminatory corporate franchise tax and an estate or inheritance tax are excepted, neither of which is a state income tax on an individual.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This is why the exemption is applied uniformly rather than per state pack: it is federal law binding every state, so no state entry can opt into taxing it. The engine subtracts the interest from the state base because it arrives inside ordinary income.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '31 U.S.C. 3124(a)',
      url: 'https://www.law.cornell.edu/uscode/text/31/3124',
      quotedText:
        'Stocks and obligations of the United States Government are exempt from taxation by a State or political subdivision of a State. The exemption applies to each form of taxation that would require the obligation, the interest on the obligation, or both, to be considered in computing a tax, except - (1) a nondiscriminatory franchise tax or another nonproperty tax instead of a franchise tax, imposed on a corporation; and (2) an estate or inheritance tax.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/tax/stateTax.ts'],
    implementedByFunctions: [
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },
  'irc-165-c-personal-use-sale-loss-nondeductible': {
    title: 'The property-sale path floors every loss at zero; 165(c) only bars the personal-use ones',
    statement:
      'Section 165(c) limits an individual\'s loss deduction to business losses, losses in transactions entered into for profit, and casualty or theft losses. A loss on personal-use property, a home sold below basis among them, is therefore nondeductible, and flooring that gain at zero is exact. But the engine prices every property account\'s planned sale through the same function, and for an investment property a sale below basis is a deductible loss under 165(c)(2) that the floor denies.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale:
      'One disposition path prices all property sales. The zero floor is the statutory answer for personal-use property and an approximation for profit-transaction property, where the forgone capital loss (and its 1211(b) ordinary offset) overstates tax.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 165(c)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section165&num=0&edition=prelim',
      quotedText:
        'In the case of an individual, the deduction under subsection (a) shall be limited to- (1) losses incurred in a trade or business; (2) losses incurred in any transaction entered into for profit, though not connected with a trade or business; and (3) except as provided in subsection (h), losses of property not connected with a trade or business or a transaction entered into for profit, if such losses arise from fire, storm, shipwreck, or other casualty, or from theft.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-29',
    implementedBy: [
      'packages/engine/src/tax/propertySale.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/tax/propertySale.ts#propertySaleTax',
    ],
  },
  'irc-1411-d-modified-agi-foreign-exclusion-addback': {
    title: 'Modified adjusted gross income adds back excluded foreign income',
    statement:
      'Two limits in this engine run off modified adjusted gross income rather than adjusted gross income, and both define it as adjusted gross income increased by income the taxpayer excluded from gross income abroad. Section 1411(d) adds the section 911(a)(1) foreign earned income exclusion, net of the deductions section 911(d)(6) disallows, for the net investment income tax. Section 151(d)(5)(C)(iii)(II) adds any amount excluded under section 911, 931, or 933 for the senior deduction phase-out. Reading modified adjusted gross income as plain adjusted gross income understates the tax and overstates the deduction at the same time.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The two definitions are not identical: 1411(d) reaches only section 911 and nets out the deductions 911(d)(6) disallows, while 151(d)(5)(C)(iii)(II) reaches sections 911, 931, and 933 with no netting. The engine carries one excluded-foreign-income figure and applies it to both, which is the broader definition in both places. That same figure already feeds section 86 provisional income, where 86(b)(2)(A) likewise reaches 911, 931, and 933, so splitting the two would mean splitting an input the household reports as one number.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 1411(d)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1411&num=0&edition=prelim',
      quotedText:
        'For purposes of this chapter, the term "modified adjusted gross income" means adjusted gross income increased by the excess of- (1) the amount excluded from gross income under section 911(a)(1), over (2) the amount of any deductions (taken into account in computing adjusted gross income) or exclusions disallowed under section 911(d)(6) with respect to the amounts described in paragraph (1).',
    }, {
      kind: 'statute',
      citation: 'IRC 151(d)(5)(C)(iii)(II)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section151&num=0&edition=prelim',
      quotedText:
        'For purposes of this clause, the term "modified adjusted gross income" means the adjusted gross income of the taxpayer for the taxable year increased by any amount excluded from gross income under section 911, 931, or 933.',
    }, {
      kind: 'formInstruction',
      citation: 'Schedule 1-A (Form 1040) (2025), Part I, lines 1 to 3',
      url: 'https://www.irs.gov/pub/irs-pdf/f1040s1a.pdf',
      quotedText:
        'Enter the amount from Form 1040, 1040-SR, or 1040-NR, line 11b … Enter any income from Puerto Rico that you excluded … Enter the amount from Form 2555, line 45 … Enter the amount from Form 2555, line 50 … Enter the amount from Form 4563, line 15 … Add lines 2a, 2b, 2c, and 2d … Add lines 1 and 2e',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-28',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
    implementedByFunctions: [
      'packages/engine/src/tax/federalTax.ts#computeFederalTax',
    ],
  },
  'irc-1-h-11-qualified-dividends-as-net-capital-gain': {
    title: 'Qualified dividends are folded into net capital gain',
    statement:
      'For purposes of the preferential rate schedule, net capital gain means net capital gain increased by qualified dividend income. Qualified dividends therefore stack with long-term gain and are taxed at 0, 15, or 20 percent, even though they are ordinary gross income that enters AGI in full and is not itself a capital gain.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The engine carries qualified dividends as a separate input rather than as a slice of ordinary income, and adds them to AGI once. That matters because a qualified dividend is simultaneously ordinary income for AGI, provisional income, and NIIT modified AGI, and preferential income for the rate schedule. Note also that 1(h)(11)(B) and (C) impose holding-period and qualified-foreign-corporation tests the engine cannot verify: it takes the qualified character of the supplied figure on trust.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 1(h)(11)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1&num=0&edition=prelim',
      quotedText:
        'For purposes of this subsection, the term "net capital gain" means net capital gain (determined without regard to this paragraph) increased by qualified dividend income.',
    }, {
      kind: 'statute',
      citation: 'IRC 1(h)(11)(B)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1&num=0&edition=prelim',
      quotedText:
        'The term "qualified dividend income" means dividends received during the taxable year from- (I) domestic corporations, and (II) qualified foreign corporations.',
    }, {
      kind: 'irsNotice',
      citation: 'Rev. Proc. 2025-32, section 4.03',
      url: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
      quotedText:
        'Maximum Capital Gains Rate (§ 1(h), § 1(j)(5)). For taxable years beginning in 2026, the maximum zero rate amounts and maximum 15 percent rate amounts under § 1(j)(5)(B), as adjusted for inflation, are as follows: ... All Other Individuals $49,450 ... $545,500',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
    implementedByFunctions: [
      'packages/engine/src/tax/federalTax.ts#capitalGainsTaxStacked',
      'packages/engine/src/tax/federalTax.ts#computeFederalTax',
    ],
  },
  'irc-1411-c-5-plan-distributions-excluded-from-nii': {
    title: 'Retirement plan distributions are not net investment income',
    statement:
      'Net investment income does not include any distribution from a plan or arrangement described in section 401(a), 403(a), 403(b), 408, 408A, or 457(b). A traditional IRA withdrawal, an RMD, or a Roth conversion therefore bears no net investment income tax itself, but it does raise modified adjusted gross income and can push other interest, dividends, and gains above the threshold.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This is the mechanism behind the most common NIIT surprise in retirement planning, and it only appears correctly if the two halves of 1411(a)(1) are kept separate: the distribution is absent from the net investment income leg and present in the modified AGI leg. The engine gets this right structurally by carrying plan distributions in ordinary income and building net investment income from a separate set of inputs. Note the exclusion is keyed to the type of plan, not to the character of the earnings inside it, so the investment return accumulated in an IRA never becomes net investment income.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 1411(c)(5)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1411&num=0&edition=prelim',
      quotedText:
        'The term "net investment income" shall not include any distribution from a plan or arrangement described in section 401(a), 403(a), 403(b), 408, 408A, or 457(b).',
    }, {
      kind: 'statute',
      citation: 'IRC 1411(a)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1411&num=0&edition=prelim',
      quotedText:
        'In the case of an individual, there is hereby imposed (in addition to any other tax imposed by this subtitle) for each taxable year a tax equal to 3.8 percent of the lesser of- (A) net investment income for such taxable year, or (B) the excess (if any) of- (i) the modified adjusted gross income for such taxable year, over (ii) the threshold amount.',
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
  'irc-1-h-1-E-unrecaptured-section-1250-gain': {
    title: 'Depreciation on real property is capital gain capped at 25 percent, not ordinary income',
    statement:
      'Depreciation taken on real property is generally not section 1250 recapture, because additional depreciation means only the excess over the straight-line method and real property placed in service after 1986 is depreciated straight line. It is unrecaptured section 1250 gain: long-term capital gain to which the maximum rate is 25 percent. Not modelled: the engine adds the whole recapture figure to ordinary income. The direction is fixed by the fact that 25 percent is a ceiling rather than a rate. For a taxpayer whose marginal ordinary rate exceeds 25 percent the engine overstates tax on that slice by the difference between the two rates; for a taxpayer already below 25 percent the answer is the same either way. It cannot understate.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 1(h)(1)(E)',
      url: 'https://www.law.cornell.edu/uscode/text/26/1',
      quotedText:
        'If a taxpayer has a net capital gain for any taxable year, the tax imposed by this section for such taxable year shall not exceed the sum of— ... (E) 25 percent of the excess (if any) of— (i) the unrecaptured section 1250 gain (or, if less, the net capital gain (determined without regard to paragraph (11))), over (ii) the excess (if any) of ...',
    }, {
      kind: 'statute',
      citation: 'IRC 1(h)(6)(A)(i)',
      url: 'https://www.law.cornell.edu/uscode/text/26/1',
      quotedText:
        'The term “unrecaptured section 1250 gain” means the excess (if any) of— (i) the amount of long-term capital gain (not otherwise treated as ordinary income) which would be treated as ordinary income if section 1250(b)(1) included all depreciation and the applicable percentage under section 1250(a) were 100 percent, over ...',
    }, {
      kind: 'statute',
      citation: 'IRC 1250(b)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/1250',
      quotedText:
        'The term “additional depreciation” means, in the case of any property, the depreciation adjustments in respect of such property; except that, in the case of property held more than one year, it means such adjustments only to the extent that they exceed the amount of the depreciation adjustments which would have resulted if such adjustments had been determined for each taxable year under the straight line method of adjustment.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/tax/propertySale.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/tax/propertySale.ts#propertySaleTax',
    ],
  },
  'irc-121-a-b-principal-residence-eligibility-tests': {
    title: 'Eligibility tests that gate the principal-residence exclusion',
    statement:
      'The exclusion is available only where the property was owned and used as the principal residence for periods aggregating two years within the five years ending on the sale, is denied outright where another sale qualifying under the section occurred in the two years before, reaches the larger joint figure only where either spouse meets the ownership test and both meet the use test, and does not reach the share of gain allocated to periods of nonqualified use after 2008. Not modelled: the engine applies the whole filing-status cap whenever a boolean primary-residence flag is set. Every test it omits can only reduce an exclusion, never enlarge one, so the engine can only over-exclude and understate tax; the extreme case is a full joint exclusion where the correct answer is nothing at all.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 121(a)',
      url: 'https://www.law.cornell.edu/uscode/text/26/121',
      quotedText:
        'Gross income shall not include gain from the sale or exchange of property if, during the 5-year period ending on the date of the sale or exchange, such property has been owned and used by the taxpayer as the taxpayer’s principal residence for periods aggregating 2 years or more.',
    }, {
      kind: 'statute',
      citation: 'IRC 121(b)(2)(A)',
      url: 'https://www.law.cornell.edu/uscode/text/26/121',
      quotedText:
        'Paragraph (1) shall be applied by substituting “$500,000” for “$250,000” if— (i) either spouse meets the ownership requirements of subsection (a) with respect to such property; (ii) both spouses meet the use requirements of subsection (a) with respect to such property; and (iii) neither spouse is ineligible for the benefits of subsection (a) with respect to such property by reason of paragraph (3).',
    }, {
      kind: 'statute',
      citation: 'IRC 121(b)(3)',
      url: 'https://www.law.cornell.edu/uscode/text/26/121',
      quotedText:
        'Subsection (a) shall not apply to any sale or exchange by the taxpayer if, during the 2-year period ending on the date of such sale or exchange, there was any other sale or exchange by the taxpayer to which subsection (a) applied.',
    }, {
      kind: 'statute',
      citation: 'IRC 121(b)(5)(A) and (B)',
      url: 'https://www.law.cornell.edu/uscode/text/26/121',
      quotedText:
        'Subsection (a) shall not apply to so much of the gain from the sale or exchange of property as is allocated to periods of nonqualified use. ... gain shall be allocated to periods of nonqualified use based on the ratio which— (i) the aggregate periods of nonqualified use during the period such property was owned by the taxpayer, bears to (ii) the period such property was owned by the taxpayer.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/tax/propertySale.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/insights/detectors/missingDataBasis.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/tax/propertySale.ts#propertySaleTax',
      'packages/engine/src/insights/detectors/missingDataBasis.ts#missingDataBasis',
    ],
  },

  'treas-reg-1-1012-1-c-lot-basis-and-holding-period': {
    title: 'Taxable-account basis and holding period are properties of a lot',
    statement:
      'Where shares bought on different dates or at different prices are sold and the taxpayer does not adequately identify the lot, the sale is charged against the earliest lot acquired, and that lot fixes both the basis and the holding period; the average basis method reaches only the stock the regulation names, chiefly regulated investment company shares and dividend reinvestment plan holdings. Not modelled: the engine holds one cost-basis figure and one fair market value for the whole account and recovers basis in the ratio of the two, which is account-level average cost, and it emits a single realized gain or loss carrying no holding period at all. Two errors follow. The basis recovered on a partial sale is wrong in either direction depending on which lots a first-in-first-out or specific-identification seller would actually have sold. More seriously, nothing separates long-term from short-term, so gain belonging in the preferential rate schedule and gain taxed as ordinary income are reported as one number, which understates tax on a short-term sale and overstates it on a long-term one.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'Approximated rather than out of scope because the engine emits a realized gain or loss for every taxable sale; nothing here fails closed. Both of its errors run in both directions, which is why the direction cannot be narrowed: the basis recovered on a partial sale is too high or too low depending on which lots a first-in-first-out or specific-identification seller would have sold, and the missing holding-period character understates tax on a short-term sale and overstates it on a long-term one. The average-cost approximation is defensible for a long-horizon projection and indefensible for a filing-grade statement of a particular year, and the two uses are not distinguished here. Across a full drawdown the account-level ratio and true lot accounting converge, because every lot is eventually sold and the total basis is the same either way, so the approximation costs little over a lifetime. It costs a great deal in any single year a user might act on. The missing holding-period character is the larger of the two gaps and is not an approximation at all: it is a fact the engine never had, since no lot acquisition dates enter the account model, and no convention over a single blended number can recover it.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: '26 CFR 1.1012-1(c)(1)(i)',
      url: 'https://www.ecfr.gov/api/renderer/v1/content/enhanced/current/title-26?chapter=I&subchapter=A&part=1&section=1.1012-1',
      quotedText:
        'Except as provided in paragraph (e)(2) of this section (dealing with stock for which the average basis method is permitted), if a taxpayer sells or transfers shares of stock in a corporation that the taxpayer purchased or acquired on different dates or at different prices and the taxpayer does not adequately identify the lot from which the stock is sold or transferred, the stock sold or transferred is charged against the earliest lot the taxpayer purchased or acquired to determine the basis and holding period of the stock.',
    }, {
      kind: 'statute',
      citation: 'IRC 1222(3)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1222&num=0&edition=prelim',
      quotedText:
        'The term "long-term capital gain" means gain from the sale or exchange of a capital asset held for more than 1 year, if and to the extent such gain is taken into account in computing gross income.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/actions/taxableWithdrawalCharacter.ts',
      'packages/engine/src/projection/internal/annualAnnuityPurchaseFunding.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/taxableWithdrawalCharacter.ts#classifyIndividuallyOwnedTaxableWithdrawal',
      'packages/engine/src/projection/internal/annualAnnuityPurchaseFunding.ts#annualAnnuityPurchaseFunding',
    ],
  },

  'cfr-31-363-52-savings-bond-annual-purchase-limit': {
    title: 'Series EE/I book-entry annual purchase principal limit is not modeled',
    statement:
      'Book-entry Series EE and Series I savings-bond purchases are subject to a $10,000 annual principal limit per series for an individual owner. RetireGolden has no savings-bond account or annual purchase ledger, so no accepted plan input reaches a purchase-cap result.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The absence surface is model/plan.ts: taxableAccountSchema carries an aggregate brokerage balance, cost basis, and generic annual contribution, but no savings-bond instrument, TreasuryDirect owner, or annual bond-purchase history. The generic contribution field cannot be treated as a book-entry savings-bond purchase without inventing the instrument and owner facts on which the annual limit turns.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: '31 CFR 363.52',
      url: 'https://www.ecfr.gov/current/title-31/section-363.52',
      quotedText:
        'The principal amount of book-entry savings bonds that you may acquire in any calendar year is limited to $10,000 for Series EE savings bonds and $10,000 for Series I savings bonds.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: ['packages/engine/src/model/plan.ts'],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#taxableAccountSchema',
    ],
  },

  'irc-454-savings-bond-interest-deferral': {
    title: 'Savings-bond interest is deferred until redemption, maturity, or disposition unless elected',
    statement:
      'IRC 454(a) permits a cash-method holder of a discount savings obligation to elect current inclusion of the increase in redemption price, but absent that election section 454(c) includes the increase in redemption value (to the extent not previously includible) in gross income in the taxable year of final redemption or final maturity, whichever is earlier. RetireGolden has no savings-bond instrument, redemption or maturity date, or section 454 election and therefore produces no savings-bond deferral or default-inclusion result.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The absence surface spans model/plan.ts, projection/internal/distributedTaxableYieldRows.ts, and projection/simulate.ts. taxableAccountSchema.interestYieldPct is a generic current-year yield; distributedTaxableYieldRows prices it for the current year, and simulate.ts immediately adds the returned interest to ordinary income. None of those surfaces identifies a savings bond, redemption or maturity date, accounting method, or the section 454 election that would select current inclusion. Treating generic interest as a savings bond would conflate an ordinary brokerage yield with a deferred savings-bond obligation.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 454(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section454&num=0&edition=prelim',
      quotedText:
        'If, in the case of a taxpayer owning any non-interest-bearing obligation issued at a discount and redeemable for fixed amounts increasing at stated intervals or owning an obligation described in paragraph (2) of subsection (c), the increase in the redemption price of such obligation occurring in the taxable year does not (under the method of accounting used in computing his taxable income) constitute income to him in such year, such taxpayer may, at his election made in his return for any taxable year, treat such increase as income received in such taxable year.',
    }, {
      kind: 'statute',
      citation: 'IRC 454(c)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section454&num=0&edition=prelim',
      quotedText:
        'the increase in redemption value (to the extent not previously includible in gross income) in excess of the amount paid for such series E bond shall be includible in gross income in the taxable year in which the obligation is finally redeemed or in the taxable year of final maturity, whichever is earlier.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/projection/internal/distributedTaxableYieldRows.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#taxableAccountSchema',
      'packages/engine/src/projection/internal/distributedTaxableYieldRows.ts#distributedTaxableYieldRows',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'irc-135-education-savings-bond-interest-exclusion': {
    title: 'Education savings-bond interest exclusion is limited by qualified expenses and modified AGI',
    statement:
      'IRC 135 excludes interest on a qualified United States savings bond redeemed to pay qualified higher-education expenses, subject to the redemption-proceeds expense ratio and the modified-AGI phaseout. RetireGolden has no savings-bond redemption, qualified education-expense, dependent, or section 135 exclusion input, so it produces no education-bond exclusion amount.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The absence surface is model/plan.ts and tax/federalTax.ts: the Plan has no qualified savings-bond redemption or education-expense vocabulary, and the federal calculator has no section 135 exclusion line. Generic taxable interest and one-time income cannot be relabeled as bond interest used for a qualifying student without inventing the required redemption, expense, and MAGI facts.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 135(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section135&num=0&edition=prelim',
      quotedText:
        'In the case of an individual who pays qualified higher education expenses during the taxable year, no amount shall be includible in gross income by reason of the redemption during such year of any qualified United States savings bond.',
    }, {
      kind: 'statute',
      citation: 'IRC 135(b)(1)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section135&num=0&edition=prelim',
      quotedText:
        '(A) In general If- (i) the aggregate proceeds of qualified United States savings bonds redeemed by the taxpayer during the taxable year exceed (ii) the qualified higher education expenses paid by the taxpayer during such taxable year, the amount excludable from gross income under subsection (a) shall not exceed the applicable fraction of the amount excludable from gross income under subsection (a) without regard to this subsection.',
    }, {
      kind: 'statute',
      citation: 'IRC 135(b)(1)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section135&num=0&edition=prelim',
      quotedText:
        '(B) Applicable fraction For purposes of subparagraph (A), the term "applicable fraction" means the fraction the numerator of which is the amount described in subparagraph (A)(ii) and the denominator of which is the amount described in subparagraph (A)(i).',
    }, {
      kind: 'statute',
      citation: 'IRC 135(b)(2)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section135&num=0&edition=prelim',
      quotedText:
        'If the modified adjusted gross income of the taxpayer for the taxable year exceeds $40,000 ($60,000 in the case of a joint return), the amount which would (but for this paragraph) be excludable from gross income under subsection (a) shall be reduced (but not below zero) by the amount which bears the same ratio to the amount which would be so excludable as such excess bears to $15,000 ($30,000 in the case of a joint return).',
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
      'packages/engine/src/model/plan.ts#taxableAccountSchema',
      'packages/engine/src/tax/federalTax.ts#computeFederalTax',
    ],
  },

  'treas-reg-1-1275-7-d-4-positive-inflation-adjustment-oid': {
    title: 'A positive TIPS inflation adjustment is annual OID',
    statement:
      'For a TIPS inflation-indexed debt instrument accounted for under the coupon-bond method, an inflation adjustment is taken into account for every taxable year the instrument is outstanding, and a positive inflation adjustment is OID. The TIPS ladder ledger records that positive accretion as ordinary U.S.-government interest alongside the coupon.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.1275-7(a)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.1275-7',
      quotedText:
        'This section provides rules for the Federal income tax treatment of an inflation-indexed debt instrument. If a debt instrument is an inflation-indexed debt instrument, one of two methods will apply to the instrument: the coupon bond method (as described in paragraph (d) of this section) or the discount bond method (as described in paragraph (e) of this section). Both methods determine the amount of OID that is taken into account each year by a holder or an issuer of an inflation-indexed debt instrument.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.1275-7(b)(1)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.1275-7',
      quotedText:
        'Except as provided in paragraph (b)(2) of this section, this section applies to an inflation-indexed debt instrument as defined in paragraph (c)(1) of this section. For example, this section applies to Treasury Inflation-Protected Securities (TIPS).',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.1275-7(d)(4)(i)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.1275-7',
      quotedText:
        'Under the coupon bond method, an inflation adjustment is taken into account for each taxable year in which the debt instrument is outstanding.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.1275-7(d)(4)(iii)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.1275-7',
      quotedText:
        'Positive inflation adjustments. A positive inflation adjustment is OID.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/ladder/ladderMath.ts',
      'packages/engine/src/projection/internal/tipsLadderAnnualCashFlow.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/ladder/ladderMath.ts#ladderRealFlowsAtOffset',
      'packages/engine/src/projection/internal/tipsLadderAnnualCashFlow.ts#tipsLadderAnnualCashFlows',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'treas-reg-1-1275-7-f-1-deflation-adjustment-income': {
    title: 'TIPS deflation adjustments reduce interest with an ordinary-loss carry limit',
    statement:
      'A negative TIPS inflation adjustment is a deflation adjustment that first reduces the holder\'s interest otherwise includible, allows an ordinary loss only to the extent of prior net interest inclusions, and carries any excess forward. The engine clamps ladder accretion at zero and emits neither the interest reduction nor the ordinary-loss carry, so a deflation year overstates tax on the income leg.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale:
      'DEFECT — no behavior change in this registration slice. projection/internal/tipsLadderAnnualCashFlow.ts computes `accretion` as `outstandingFace * Math.max(0, inflFactor - prevInflFactor)`, so a deflation year contributes no negative adjustment, no ordinary-loss carry, and no interest reduction. A paired market path with prior positive inflation followed by deflation drives the gap: the authority reduces current interest (and may permit a bounded ordinary loss), while the engine still reports the coupon as taxable ordinary income. The fixture adds 100,000 of ordinary wages so the tax line remains above zero and pins the produced annual MAGI. The basis decrease under (f)(2) is registered separately at treas-reg-1-1275-7-f-2-deflation-basis-decrease-not-modeled.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.1275-7(f)(1)(i)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.1275-7',
      quotedText:
        'A deflation adjustment reduces the amount of interest otherwise includible in income by a holder with respect to the debt instrument for the taxable year. For purposes of this paragraph (f)(1)(i), interest includes OID, qualified stated interest, and market discount. If the amount of the deflation adjustment exceeds the interest otherwise includible in income by the holder with respect to the debt instrument for the taxable year, the excess is treated as an ordinary loss by the holder for the taxable year. However, the amount treated as an ordinary loss is limited to the amount by which the holder\'s total interest inclusions on the debt instrument in prior taxable years exceed the total amount treated by the holder as an ordinary loss on the debt instrument in prior taxable years. If the deflation adjustment exceeds the interest otherwise includible in income by the holder with respect to the debt instrument for the taxable year and the amount treated as an ordinary loss for the taxable year, this excess is carried forward to reduce the amount of interest otherwise includible in income by the holder with respect to the debt instrument for subsequent taxable years.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/ladder/ladderMath.ts',
      'packages/engine/src/projection/internal/tipsLadderAnnualCashFlow.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/model/plan.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/ladder/ladderMath.ts#ladderRealFlowsAtOffset',
      'packages/engine/src/model/plan.ts#tipsLadderSchema',
      'packages/engine/src/projection/internal/tipsLadderAnnualCashFlow.ts#tipsLadderAnnualCashFlows',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'treas-reg-1-1275-7-f-2-deflation-basis-decrease-not-modeled': {
    title: 'TIPS deflation basis decrease is not modeled',
    statement:
      'A holder\'s adjusted basis in an inflation-indexed debt instrument is decreased by the amount of any deflation adjustment taken into account to reduce interest otherwise includible in income or treated as an ordinary loss. The engine does not track per-rung holder basis or apply deflation basis decreases.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The absence surface is ladder/ladderMath.ts and projection/internal/tipsLadderAnnualCashFlow.ts: ladder accretion is clamped at zero and no holder-basis ledger records deflation adjustments taken into account under (f)(1). Omitting the (f)(2) basis decrease leaves basis too high and can understate later gain tax when that basis is recovered, but that limb is separate from the income-year clamp registered at treas-reg-1-1275-7-f-1-deflation-adjustment-income.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.1275-7(f)(2)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.1275-7',
      quotedText:
        'A holder\'s adjusted basis in an inflation-indexed debt instrument is determined under § 1.1272-1(g). However, a holder\'s adjusted basis in the debt instrument is decreased by the amount of any deflation adjustment the holder takes into account to reduce the amount of interest otherwise includible in income or treats as an ordinary loss with respect to the instrument during the taxable year. The decrease occurs when the deflation adjustment is taken into account under paragraph (f)(1) of this section.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/ladder/ladderMath.ts',
      'packages/engine/src/projection/internal/tipsLadderAnnualCashFlow.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/model/plan.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/ladder/ladderMath.ts#LadderRung',
      'packages/engine/src/model/plan.ts#tipsLadderSchema',
      'packages/engine/src/projection/internal/tipsLadderAnnualCashFlow.ts#tipsLadderAnnualCashFlows',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'treas-reg-1-1275-7-f-3-tips-acquisition-premium': {
    title: 'TIPS acquisition premium reduces OID under acquisition-premium rules',
    statement:
      'Acquisition premium on an inflation-indexed debt instrument reduces OID under the acquisition-premium rules, with the premium measured by reference to adjusted issue price on the acquisition date and taken into account over the remaining term as if there were no further inflation or deflation. The engine has no acquisition-premium or OID-offset facts.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The absence surface is model/plan.ts, ladder/ladderMath.ts, and projection/simulate.ts. tipsLadderSchema stores only target real income, payout years, and an optional aggregate purchase transfer; ladderMath.ts retains synthetic rung cost but no holder basis, issue price, or acquisition-premium ledger, and simulate.ts carries no premium balance to offset OID. Bond premium amortization under section 171 is registered separately at irc-171-tips-bond-premium-amortization.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.1275-7(f)(3)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.1275-7',
      quotedText:
        'A holder determines the amount of acquisition premium or market discount on an inflation-indexed debt instrument by reference to the adjusted issue price of the instrument on the date the holder acquires the instrument. ... Any premium or market discount is taken into account over the remaining term of the debt instrument as if there were no further inflation or deflation.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/ladder/ladderMath.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/ladder/ladderMath.ts#LadderRung',
      'packages/engine/src/model/plan.ts#tipsLadderSchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'irc-171-tips-bond-premium-amortization': {
    title: 'TIPS bond premium amortization requires bond-level facts',
    statement:
      'Section 171 bond premium amortization offsets qualified stated interest and OID for a taxable inflation-indexed bond. RetireGolden has no bond issue price, principal, acquisition date, holder basis, call or maturity schedule, or premium election, so no accepted input reaches a bond-premium amortization result.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The absence surface is model/plan.ts, ladder/ladderMath.ts, and projection/simulate.ts. tipsLadderSchema stores only target real income, payout years, and an optional aggregate purchase transfer; ladderMath.ts retains synthetic rung cost but no holder basis or issue-price ledger, and simulate.ts carries no premium balance to offset coupon or OID. A taxable account costBasis is an aggregate brokerage basis and cannot identify a TIPS rung or a section 171 election, so it is not an accepted premium fact. Acquisition premium on TIPS is registered separately at treas-reg-1-1275-7-f-3-tips-acquisition-premium.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 171(a)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section171&num=0&edition=prelim',
      quotedText:
        'In the case of a bond (other than a bond the interest on which is excludable from gross income), the amount of the amortizable bond premium for the taxable year shall be allowed as a deduction.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.171-2(a)(1)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.171-2',
      quotedText:
        'A holder amortizes bond premium by offsetting the qualified stated interest allocable to an accrual period with the bond premium allocable to the accrual period. This offset occurs when the holder takes the qualified stated interest into account under the holder\'s regular method of accounting.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.171-2(a)(3)(iii)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.171-2',
      quotedText:
        'The bond premium allocable to an accrual period is the excess of the qualified stated interest allocable to the accrual period over the product of the holder\'s adjusted acquisition price (as defined in paragraph (b) of this section) at the beginning of the accrual period and the holder\'s yield.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.1275-7(f)(3)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.1275-7',
      quotedText:
        'A holder determines the amount of bond premium on an inflation-indexed debt instrument by assuming that the amount payable at maturity on the instrument is equal to the instrument\'s inflation-adjusted principal amount for the day the holder acquires the instrument. ... See section 171 for additional rules relating to the amortization of bond premium and sections 1276 through 1278 for additional rules relating to market discount.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/ladder/ladderMath.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/ladder/ladderMath.ts#LadderRung',
      'packages/engine/src/model/plan.ts#tipsLadderSchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },
} satisfies Record<string, TaxRuleRecord>
