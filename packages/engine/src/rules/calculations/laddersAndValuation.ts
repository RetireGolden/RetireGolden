/**
 * Ladders-and-valuation calculation records.
 *
 * One slice of the calculation registry: the TIPS-ladder math, the funded
 * ratio that discounts on the same curve, the embedded Treasury real-yield
 * snapshot they read, and the FedInvest reference-price helpers.
 * `../calculationRegistry.ts` composes every slice into `CALCULATION_REGISTRY`;
 * read it for what a record must carry.
 */
import type { CalculationRecord } from '../calculationRegistry.js'

export const laddersAndValuationRecords = {
  'ladder-real-yield-interpolation': {
    title: 'Par real yield at a maturity: linear interpolation with flat endpoints',
    purpose: 'The real yield the ladder engine reads off the TIPS curve at any maturity.',
    kind: 'formula',
    // A pure intermediate: no surface publishes the interpolated yield itself.
    // It is the discount rate behind every funded-ratio present value, the
    // quantity the rung coupon is floored from, and, through the rung price,
    // an input to the income-floor ladder yield.
    outputs: [],
    feeds: [
      'income-floor-ladder-yield-pct',
      'ladder-rung-coupon-rate-pct',
      'funded-ratio-result-essential-spending-pv',
      'funded-ratio-result-guaranteed-income-pv',
      'funded-ratio-result-funded-ratio-pct',
      'funded-ratio-result-unfunded-pv',
    ],
    statement:
      'Given a curve of (maturity m_i years, par real yield y_i percent) points sorted ascending and a finite maturity m, the yield is y_first when m <= m_first, y_last when m >= m_last, and otherwise y_i + (m - m_i)(y_{i+1} - y_i)/(m_{i+1} - m_i) on the first segment with m <= m_{i+1}. An empty curve yields 0. Units: percent per year, real. Rounding: none - the production function returns a binary float.',
    formula: {
      expression:
        'y(m) = y_i + (m - m_i)(y_{i+1} - y_i)/(m_{i+1} - m_i) for m_i <= m <= m_{i+1}; y(m) = y_first for m <= m_first; y(m) = y_last for m >= m_last',
      variables: [
        { symbol: 'm', meaning: 'Maturity, years from the anchor year', unit: 'years', domain: 'finite m' },
        { symbol: 'm_i', meaning: 'Maturity of curve point i', unit: 'years', domain: 'strictly ascending in i' },
        { symbol: 'y_i', meaning: 'Par real yield at curve point i', unit: 'percent/year', domain: 'y_i > -100' },
        { symbol: 'y(m)', meaning: 'Interpolated par real yield at m', unit: 'percent/year', domain: 'between the yields of the bracketing points' },
      ],
      timing: 'annual maturities; time-invariant lookup on one dated curve',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/ladders-and-valuation/ladder-real-yield-interpolation.md',
    },
    limits: [
      'Endpoints are held flat, never extrapolated: a maturity beyond the last point reads the last yield, and one before the first point reads the first',
      'The curve must already be sorted ascending by maturity; the function neither sorts nor validates it',
      'An empty curve returns 0% rather than failing closed',
      'Every caller consumes the interpolated par yield as a spot rate (the par-as-spot planning approximation documented in the ladderMath.ts header)',
    ],
    implementedBy: ['packages/engine/src/ladder/ladderMath.ts'],
    implementedByFunctions: ['packages/engine/src/ladder/ladderMath.ts#realYieldAt'],
    verifiedOn: '2026-09-14',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'ladder-annual-coupon-par-pricing': {
    title: 'Synthetic TIPS rung: floored coupon and par-curve price',
    purpose:
      'What one ladder rung costs today: its annual real coupons and principal discounted on the curve, with the coupon set to the yield at maturity floored at 0.125%.',
    kind: 'formula',
    outputs: ['ladder-rung-cost', 'ladder-rung-coupon-rate-pct'],
    // totalCost is buildLadder's sum over the rung prices; each price enters it.
    feeds: ['ladder-build-total-cost'],
    statement:
      'For a rung of real face F maturing n whole years out, the coupon rate is c = max(0.125%, y(n)), where y(n) is the interpolated par real yield at n years. The price is the sum over k = 1..n of (F·c/100 + [k = n]·F)/(1 + y(k)/100)^k: each end-of-year cash flow discounted at the interpolated par yield for its own year treated as a spot rate. On a flat curve with a nonbinding floor c = y and the price equals F. Units: real (today\'s) dollars; percent inputs are divided by 100. Domain: F >= 0, integer n >= 1, y(k) > -100%. Rounding: none.',
    formula: {
      expression: 'c = max(0.125, y(n)); P = sum_{k=1..n} (F c/100 + [k = n] F) / (1 + y(k)/100)^k',
      variables: [
        { symbol: 'F', meaning: 'Real face (principal) of the rung', unit: 'usd', domain: 'F >= 0' },
        { symbol: 'n', meaning: 'Maturity offset from the anchor year', unit: 'years', domain: 'integer n >= 1' },
        { symbol: 'y(k)', meaning: 'Interpolated par real yield at k years', unit: 'percent/year', domain: 'y(k) > -100' },
        { symbol: 'c', meaning: 'Annual coupon rate of the synthetic rung', unit: 'percent/year', domain: 'c >= 0.125' },
        { symbol: 'P', meaning: 'Real purchase price of the rung', unit: 'usd', domain: 'P >= 0' },
      ],
      timing: 'end of year, annual coupons, principal with the last coupon',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/ladders-and-valuation/ladder-annual-coupon-par-pricing.md',
    },
    limits: [
      'Coupons pay annually; real-world semiannual TIPS timing is ignored (ladderMath.ts header)',
      'Par yields are used as spot rates for discounting; no zero curve is bootstrapped (ladderMath.ts header)',
      'The 0.125% floor is the regulatory minimum TIPS coupon; a curve yield below it prices the rung above par',
      'No CUSIP-level lot rounding in core mode: face is continuous at $1 granularity (ladderMath.ts header)',
      'tipsCouponRatePct and priceRung are module-private; the evidence reaches them through buildLadder with a one-rung ladder whose target is F(1 + c), which the back-substitution solves to face F exactly',
    ],
    implementedBy: ['packages/engine/src/ladder/ladderMath.ts'],
    implementedByFunctions: [
      'packages/engine/src/ladder/ladderMath.ts#tipsCouponRatePct',
      'packages/engine/src/ladder/ladderMath.ts#priceRung',
    ],
    verifiedOn: '2026-09-14',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'ladder-real-present-value': {
    title: 'Real present value of a cash-flow stream on the TIPS curve',
    purpose: 'What it would cost today to defease each future real dollar with a Treasury of matching maturity.',
    kind: 'formula',
    // The discounting step, not a published number: computeFundedRatio
    // (funded-ratio-hand-present-value) selects the horizon, deflates and sums
    // the flows and consumes this present value for each side of the ratio,
    // and priceRung (ladder-annual-coupon-par-pricing) is the same discounting
    // applied to one rung's coupons and principal.
    outputs: [],
    feeds: [
      'funded-ratio-result-essential-spending-pv',
      'funded-ratio-result-guaranteed-income-pv',
      'funded-ratio-result-funded-ratio-pct',
      'funded-ratio-result-unfunded-pv',
      'ladder-rung-cost',
    ],
    statement:
      'For flows (t, C_t) with t years from now and C_t in real dollars, PV = sum of C_t/(1 + y(t)/100)^t, where y(t) is the interpolated par real yield at maturity t with flat endpoints. A flow at t = 0 is added undiscounted; flows with t < 0 or C_t = 0 are skipped. Units: real (today\'s) dollars. Domain: finite flows, t >= 0, y(t) > -100%. Rounding: none.',
    formula: {
      expression: 'PV = sum_t C_t / (1 + y(t)/100)^t; the t = 0 term is C_0',
      variables: [
        { symbol: 't', meaning: 'Years from now to the flow', unit: 'years', domain: 't >= 0' },
        { symbol: 'C_t', meaning: 'Real amount of the flow at t', unit: 'usd', domain: 'finite' },
        { symbol: 'y(t)', meaning: 'Interpolated par real yield at t years', unit: 'percent/year', domain: 'y(t) > -100' },
        { symbol: 'PV', meaning: 'Present value of the stream', unit: 'usd', domain: 'finite' },
      ],
      timing: 'end of year t, annual; t = 0 is today',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/ladders-and-valuation/ladder-real-present-value.md',
    },
    limits: [
      'Par yields are treated as spot rates; this is a planning approximation, not a bootstrapped zero curve',
      'Negative offsets and zero amounts are dropped silently rather than rejected',
      'A non-integer offset is discounted with a fractional exponent; no current caller supplies one',
    ],
    implementedBy: ['packages/engine/src/ladder/ladderMath.ts'],
    implementedByFunctions: ['packages/engine/src/ladder/ladderMath.ts#realPresentValue'],
    verifiedOn: '2026-09-14',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'ladder-backward-face-construction': {
    title: 'Level-real-income ladder: faces solved back to front',
    purpose:
      'The face amount of each rung so that every payout year\'s maturing principal plus the coupons of the rungs still outstanding equals the target real income.',
    kind: 'formula',
    outputs: [
      'ladder-rung-face',
      'ladder-build-annual-real-income-by-offset',
      'ladder-build-total-cost',
      'ladder-build-target-annual-real-income',
    ],
    statement:
      'For target real income A, first payout offset p and payout count q (each rounded to an integer and clamped to at least 1), rungs mature at offsets m = p..p+q-1 with coupon rates c_m = max(0.125%, y(m))/100. Faces are solved from the last offset backward: F_m = max(0, (A - sum over later offsets j of F_j c_j)/(1 + c_m)), so that F_m(1 + c_m) plus the coupons of every rung still outstanding equals A in year m. Each rung is then priced on the curve (ladder-annual-coupon-par-pricing); totalCost is the sum of rung costs; annualRealIncomeByOffset lists coupons plus maturing principal for offsets 1..p+q-1 (coupon-only inside a deferral window); targetAnnualRealIncome echoes A. Units: real (today\'s) dollars. Rounding: none.',
    formula: {
      expression:
        'F_m = max(0, (A - sum_{j>m} F_j c_j) / (1 + c_m)) for m from last to first; income_m = F_m (1 + c_m) + sum_{j>m} F_j c_j = A',
      variables: [
        { symbol: 'A', meaning: 'Level real income target per payout year', unit: 'usd', domain: 'A >= 0' },
        { symbol: 'm', meaning: 'Maturity offset of a rung', unit: 'years', domain: 'integer, p <= m <= p+q-1, p >= 1' },
        { symbol: 'c_m', meaning: 'Coupon rate of the rung maturing at m, as a fraction', unit: '1', domain: 'c_m >= 0.00125' },
        { symbol: 'F_m', meaning: 'Real face of the rung maturing at m', unit: 'usd', domain: 'F_m >= 0' },
      ],
      timing: 'end of year, annual; the rung maturing in year m pays its last coupon and principal that year',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/ladders-and-valuation/ladder-backward-face-construction.md',
    },
    limits: [
      'Faces are floored at zero: a target smaller than the later rungs\' coupons yields a zero-face rung and that year then receives more than the target',
      'Payout offset and count are rounded and clamped to at least 1 rather than rejected',
      'Coupons pay annually and par yields serve as spot rates for pricing (ladderMath.ts header simplifications)',
      'No CUSIP-level lot rounding in core mode; faces are continuous',
    ],
    implementedBy: ['packages/engine/src/ladder/ladderMath.ts'],
    implementedByFunctions: ['packages/engine/src/ladder/ladderMath.ts#buildLadder'],
    verifiedOn: '2026-09-14',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'ladder-rung-flows-and-remaining-face': {
    title: 'Ladder cash flows in a year and face outstanding after it',
    purpose:
      'The real coupons, maturing principal and outstanding face of a rung set in one year, and the face still outstanding once that year completes.',
    kind: 'formula',
    outputs: ['ladder-real-flows-coupons', 'ladder-real-flows-maturing-principal'],
    // ladderValue is the ledger's product of remaining face, purchase scale and
    // the year's inflation factor; this record pins only the remaining-face input.
    feeds: ['ladder-value-annual'],
    statement:
      'For a rung set and an integer offset k >= 1: coupons = sum over rungs with maturity offset >= k of F·c/100; maturingPrincipal = sum of F over rungs with maturity offset = k; outstandingFace = sum of F over rungs with maturity offset >= k, the maturing rung included so it earns its last coupon and its inflation accretion. ladderRemainingFace(k) = sum of F over rungs with maturity offset > k, the face still outstanding after year k completes. Units: real (today\'s) dollars. Rounding: none.',
    formula: {
      expression:
        'coupons_k = sum_{m >= k} F_m c_m/100; maturing_k = sum_{m = k} F_m; outstanding_k = sum_{m >= k} F_m; remaining_k = sum_{m > k} F_m',
      variables: [
        { symbol: 'k', meaning: 'Year offset from the anchor year', unit: 'years', domain: 'integer k >= 1' },
        { symbol: 'F_m', meaning: 'Real face of the rung maturing at offset m', unit: 'usd', domain: 'F_m >= 0' },
        { symbol: 'c_m', meaning: 'Annual coupon rate of that rung', unit: 'percent/year', domain: 'c_m >= 0.125' },
      ],
      timing: 'annual; a rung is outstanding through the year it matures and gone the year after',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/ladders-and-valuation/ladder-rung-flows-and-remaining-face.md',
    },
    limits: [
      'Values are real (today\'s) dollars; the ledger multiplies by its own inflation path to index them',
      'ladder-value-annual is the ledger\'s nominal figure: ladderRemainingFace at the year\'s offset times the purchase scale and the year\'s inflation factor (projection/internal/tipsLadderAnnualCashFlow.ts); this record pins the remaining-face half of that product',
      'Offsets are whole years by construction; a fractional offset matches no maturity',
    ],
    implementedBy: ['packages/engine/src/ladder/ladderMath.ts'],
    implementedByFunctions: [
      'packages/engine/src/ladder/ladderMath.ts#ladderRealFlowsAtOffset',
      'packages/engine/src/ladder/ladderMath.ts#ladderRemainingFace',
    ],
    verifiedOn: '2026-09-14',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'funded-ratio-hand-present-value': {
    title: 'Funded ratio: present values of essential spending and guaranteed income',
    purpose:
      'How much of the essential-spending floor, valued on the TIPS curve, is covered by guaranteed income valued the same way.',
    kind: 'composition',
    outputs: [
      'funded-ratio-result-essential-spending-pv',
      'funded-ratio-result-guaranteed-income-pv',
      'funded-ratio-result-funded-ratio-pct',
      'funded-ratio-result-unfunded-pv',
    ],
    statement:
      'From the deterministic ledger years with calendar year >= fromYear (default: the start year), each year\'s expenses.requiredSpending and the sum incomes.socialSecurity + pension + annuity + tipsLadder are deflated to today\'s dollars by the caller-supplied deflator and discounted as real flows at offset t = year - startYear on the TIPS par curve (ladder-real-present-value; t = 0 is undiscounted). essentialSpendingPv = E, guaranteedIncomePv = G, fundedRatioPct = 100·G/E, unfundedPv = max(0, E - G). Returns null when there are no years or E <= 0. Units: real dollars and percent. Rounding: none.',
    formula: {
      expression:
        'E = sum_t d_t S_t/(1 + y(t)/100)^t; G = sum_t d_t I_t/(1 + y(t)/100)^t; ratio = 100 G/E; unfunded = max(0, E - G)',
      variables: [
        { symbol: 't', meaning: 'Years from the start year to the ledger year', unit: 'years', domain: 'integer t >= 0' },
        { symbol: 'd_t', meaning: 'Deflator from nominal year-t dollars to today\'s dollars', unit: '1', domain: 'd_t > 0' },
        { symbol: 'S_t', meaning: 'Nominal required-floor spending in year t', unit: 'usd', domain: 'S_t >= 0' },
        { symbol: 'I_t', meaning: 'Nominal guaranteed income in year t (Social Security + pension + annuity + TIPS ladder)', unit: 'usd', domain: 'I_t >= 0' },
        { symbol: 'y(t)', meaning: 'Interpolated par real yield at t years', unit: 'percent/year', domain: 'y(t) > -100' },
      ],
      timing: 'end of year t, annual; the start year is t = 0 and undiscounted',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/ladders-and-valuation/funded-ratio-hand-present-value.md',
    },
    limits: [
      'Par yields are treated as spot rates: a planning convention, not a bootstrapped zero curve',
      'Guaranteed income counts Social Security, pensions, annuities and TIPS-ladder flows only; wages and portfolio income are excluded by design',
      'Years before fromYear are excluded from both sides; the horizon ends at the last ledger year',
      'The deflator is supplied by the caller; the record assumes it maps nominal ledger dollars to the same real basis as the curve',
      'Returns null rather than a ratio when the essential present value is not positive',
    ],
    implementedBy: ['packages/engine/src/ladder/fundedRatio.ts'],
    implementedByFunctions: ['packages/engine/src/ladder/fundedRatio.ts#computeFundedRatio'],
    verifiedOn: '2026-09-14',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'fedinvest-csv-tips-parsing': {
    title: 'FedInvest security-price CSV: TIPS rows to reference records',
    purpose: 'Turns the FedInvest end-of-day price file into TIPS reference rows with rates in percent and ISO maturities.',
    kind: 'data',
    // The worksheet names no family ("none yet"): FedInvest reference prices
    // are not a census output. The nearest ladders-and-valuation family is
    // ladder-rung-cost, because the parsed end-of-day price per $100 face is
    // the reference the ladder quote shows beside each rung's embedded-curve
    // cost; nothing else in the census consumes these rows. A nearest family
    // is fed, not output: no rung's cost is this parser's number.
    outputs: [],
    feeds: ['ladder-rung-cost'],
    statement:
      'Each line of the header-less FedInvest CSV is split on commas (surrounding quotes trimmed) into cusip, type, rate, maturity (MM/DD/YYYY), call, buy, sell, endOfDay. A row is kept only when it has at least eight cells, type is exactly TIPS, cusip is non-empty, the maturity is a valid calendar date, rate and end-of-day price are finite and the price is positive. Output per row: ratePct = rate × 100, maturityIso = YYYY-MM-DD, endOfDayPrice = the end-of-day price per $100 face; rows sorted ascending by maturityIso. Rounding: none.',
    formula: {
      expression: 'ratePct = 100 × rate; maturityIso = YYYY-MM-DD from MM/DD/YYYY; endOfDayPrice = endOfDay',
      variables: [
        { symbol: 'rate', meaning: 'Coupon rate as published, a decimal fraction', unit: '1', domain: 'finite' },
        { symbol: 'ratePct', meaning: 'Coupon rate in percent', unit: 'percent/year', domain: 'finite' },
        { symbol: 'endOfDay', meaning: 'End-of-day price per $100 face', unit: 'usd per 100 face', domain: '> 0' },
      ],
      timing: 'one price file per business day; the file carries no date of its own',
      rounding: 'none',
    },
    justification: {
      kind: 'dataset',
      source: {
        citation:
          'TreasuryDirect FedInvest security price detail CSV (securityprice.csv): one row per marketable Treasury with columns cusip, security type, rate as a decimal fraction, maturity MM/DD/YYYY, call date, buy, sell, end-of-day price per $100 face; no header row',
        url: 'https://www.treasurydirect.gov/GA-FI/FedInvest/securityPriceDetail',
        asOf: '2026-07-08',
        retrievedOn: '2026-09-14',
        rights:
          'U.S. federal government data; only the column layout, the endpoint and a synthetic row are used, no FedInvest content is reproduced; source reuse terms were not established (worksheet rights note)',
      },
      transformation:
        'The column layout is the one fedInvest.test.ts records as verified on 2026-07-08. The evidence parses the synthetic row 912TEST01,TIPS,0.00125,01/15/2030,,99.500000,99.500000,99.50 through the production function: rate × 100, maturity reordered to ISO, price read as-is. The digest is sha256 over that synthetic row as UTF-8.',
      digest: 'sha256:c25e23f04637d7d5011839bc9f916d6e78162e9e0a2072762445194da826e29b',
    },
    limits: [
      'FedInvest omits the TIPS inflation index ratio, so parsed prices are a reference check against the embedded-curve quote, never a replacement for it',
      'Rows with fewer than eight cells, a non-TIPS type, an invalid date, a non-finite number or a non-positive price are dropped silently',
      'The CSV carries no price date; a snapshot imported from a file has no date',
      'Cells are split on every comma; a quoted cell containing a comma is not supported',
    ],
    implementedBy: ['packages/engine/src/ladder/fedInvest.ts'],
    implementedByFunctions: ['packages/engine/src/ladder/fedInvest.ts#parseFedInvestCsv'],
    verifiedOn: '2026-09-14',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'fedinvest-latest-price-date': {
    title: 'Latest FedInvest price date: previous business day in local time',
    purpose: 'The most recent date FedInvest prices are likely to be published for, used as the snapshot and cache key.',
    kind: 'model',
    // "none yet" in the worksheet: the price date keys the reference-price
    // snapshot that sits beside each rung's cost, so ladder-rung-cost is the
    // nearest ladders-and-valuation family (same reasoning as the parser card),
    // fed rather than output: no rung's cost is a date.
    outputs: [],
    feeds: ['ladder-rung-cost'],
    statement:
      'From a local timestamp now, step back one calendar day (today\'s prices are not out yet), then keep stepping back while the local weekday is Saturday or Sunday. latestPriceDateIso formats that date from local calendar components as YYYY-MM-DD, never through toISOString, which is UTC and disagrees near a timezone boundary. Domain: any valid Date. Rounding: whole civil days.',
    formula: {
      expression: 'd = now - 1 day; while weekday(d) in {Saturday, Sunday}: d = d - 1 day; iso = local YYYY-MM-DD of d',
      variables: [
        { symbol: 'now', meaning: 'The observation instant, read in local time', unit: 'timestamp', domain: 'valid Date' },
        { symbol: 'd', meaning: 'Candidate price date', unit: 'civil day', domain: 'weekday(d) in Monday..Friday' },
      ],
      timing: 'civil days in the local time zone',
      rounding: 'whole days',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/ladders-and-valuation/fedinvest-latest-price-date.md',
    },
    limits: [
      'Federal holidays are not recognized: the day after a Monday holiday reads the holiday itself as the price date',
      'No evening publication cutoff is modeled: early on a business day the previous business day is assumed published',
      'A publication-availability heuristic, not a data source; FedInvest is an opt-in reference and never replaces the embedded planning yields',
      'Local-time components are used throughout; a Date built from a UTC string near midnight resolves to the local civil date',
    ],
    implementedBy: ['packages/engine/src/ladder/fedInvest.ts'],
    implementedByFunctions: [
      'packages/engine/src/ladder/fedInvest.ts#latestPriceDate',
      'packages/engine/src/ladder/fedInvest.ts#latestPriceDateIso',
    ],
    verifiedOn: '2026-09-14',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'fedinvest-nearest-tips-maturity': {
    title: 'Nearest FedInvest TIPS for a rung year',
    purpose: 'The reference TIPS whose maturity year is closest to a ladder rung\'s maturity year.',
    kind: 'formula',
    // "none yet" in the worksheet: the matched row is the reference price
    // shown beside a rung's cost, so ladder-rung-cost is the nearest family,
    // fed rather than output: the matched row labels the cost, it is not the cost.
    outputs: [],
    feeds: ['ladder-rung-cost'],
    statement:
      'From a list of parsed TIPS and a target calendar year, select the record minimizing |year(maturityIso) - target|, comparing calendar years only; null for an empty list. The first minimum in list order wins a tie. See limits for the one-year window the production entry also applies, which the worksheet did not derive.',
    formula: {
      expression: 'selected = argmin_t |year(maturityIso_t) - target|; null when the list is empty',
      variables: [
        { symbol: 'target', meaning: 'Calendar year the rung matures', unit: 'year', domain: 'integer' },
        { symbol: 'maturityIso_t', meaning: 'ISO maturity date of candidate t', unit: 'date', domain: 'YYYY-MM-DD' },
      ],
      timing: 'calendar-year granularity; month and day are ignored',
      rounding: 'none',
    },
    justification: {
      kind: 'derivation',
      worksheet: 'DOCS/calculations/ladders-and-valuation/fedinvest-nearest-tips-maturity.md',
    },
    limits: [
      'DISCREPANCY (2026-09-14): fedInvest.ts returns null when the nearest maturity is more than one calendar year from the target (bestDistance <= 1), a window the signature comment does not state and the worksheet did not derive. For the worksheet example (2030 and 2035 for target 2033) production returns null where the worksheet expects the 2035 record. The evidence test asserts the worksheet value and fails until the orchestrator settles which reading stands; this record does not resolve it',
      'Ties are resolved by list order (first minimum wins); the worksheet states no tie rule',
      'Only the calendar year of the maturity is compared; a January and a December maturity of the same year are equidistant',
      'A reference-row match for display, not CUSIP-level ladder optimization',
    ],
    implementedBy: ['packages/engine/src/ladder/fedInvest.ts'],
    implementedByFunctions: ['packages/engine/src/ladder/fedInvest.ts#nearestTipsForYear'],
    verifiedOn: '2026-09-14',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
  'treasury-real-yield-curve-2026': {
    title: 'Embedded Treasury par real-yield curve, 2026-06-30',
    purpose: 'The offline TIPS real-yield snapshot every ladder quote and funded ratio discounts on.',
    kind: 'data',
    // No surface publishes the curve's own yields; every ladder quote and
    // funded ratio reads them as its coupon and discount input.
    outputs: [],
    feeds: [
      'income-floor-ladder-yield-pct',
      'ladder-rung-cost',
      'ladder-rung-coupon-rate-pct',
      'ladder-build-total-cost',
      'funded-ratio-result-essential-spending-pv',
      'funded-ratio-result-guaranteed-income-pv',
      'funded-ratio-result-funded-ratio-pct',
      'funded-ratio-result-unfunded-pv',
    ],
    statement:
      'Five par real yields in percent per year at 5, 7, 10, 20 and 30 years, dated 2026-06-30, sourced from the U.S. Treasury Daily Par Real Yield Curve and stored as {asOfIso, source, points[]} sorted ascending by maturity. Consumers interpolate linearly between points and hold the endpoints flat (ladder-real-yield-interpolation). Embedded values: 1.85, 2.05, 2.25, 2.55, 2.70. Rounding: the file header states nearest 5 basis points; see limits for why the values do not reconcile with the official row.',
    formula: null,
    justification: {
      kind: 'dataset',
      source: {
        citation:
          'U.S. Department of the Treasury, Daily Treasury Par Real Yield Curve Rates, row dated 2026-06-30 (5-, 7-, 10-, 20- and 30-year)',
        url: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?field_tdr_date_value=2026&type=daily_treasury_real_yield_curve',
        asOf: '2026-06-30',
        retrievedOn: '2026-09-14',
        rights: 'U.S. federal government factual data, attributed and linked; no expressive material is reproduced',
      },
      transformation:
        'Embedded as percent per year at the five published maturities; the file header says the readings were rounded to 5bp, which the limits show they were not. The digest is sha256 over the canonical JSON of the embedded points array, [{"maturityYears":5,"realYieldPct":1.85},...,{"maturityYears":30,"realYieldPct":2.7}], as UTF-8.',
      digest: 'sha256:15ccae3de237f0f0f328632af05a920fd68b39401391be0ada1f5ce1cb8cd139',
    },
    limits: [
      'DISCREPANCY (2026-09-14): the official 2026-06-30 row is 1.93/2.06/2.20/2.54/2.73 (worksheet, retrieved 2026-09-14); the embedded values are 1.85/2.05/2.25/2.55/2.70, which is neither the official row nor its nearest-5bp rounding 1.95/2.05/2.20/2.55/2.75. Embedded-minus-official errors: -0.08/-0.01/+0.05/+0.01/-0.03 percentage points',
      'The correction, and the card\'s choice between exact official values and declared nearest-5bp values, is a separate packet; this slice pins the embedded values as they stand and does not change them',
      'Maturities below 5 years read the 5-year yield and above 30 years the 30-year yield (flat endpoints)',
      'Par yields are consumed as spot rates by every ladder and funded-ratio calculation',
      'Refresh cadence is annual with the parameter packs; the opt-in FedInvest fetch never replaces this snapshot',
    ],
    implementedBy: ['packages/engine/src/params/data/realYieldCurve2026.ts'],
    implementedByFunctions: ['packages/engine/src/params/data/realYieldCurve2026.ts#REAL_YIELD_CURVE_2026'],
    verifiedOn: '2026-09-14',
    provenance: { derivedBy: 'codex', implementedBy: 'claude-subagent', reviewedBy: 'cursor' },
  },
} satisfies Record<string, CalculationRecord>
