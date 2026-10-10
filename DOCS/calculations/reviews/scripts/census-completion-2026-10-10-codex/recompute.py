"""Independent Decimal recomputation of the three census worksheets.

Uses only standard Python; inputs are the worksheet/evidence ledger constants.
"""
from decimal import Decimal as D, ROUND_FLOOR, ROUND_HALF_UP


def money(value):
    return D(str(value))


def estate_rows(variant):
    accounts = [
        ("Emergency cash", "cash", money(315000), "spouse", D(0)),
        ("Jordan traditional IRA", "traditional", money(915000), "spouse", D(0)),
        # SPIA and QLAC are annuities and cannot be selected as balance accounts.
        ("Jordan 401k", "traditional", money(310000), "charity" if variant == 2 else "nonSpouse", D(25) if variant == 2 else D(0)),
        ("Roth IRA", "roth", money(0 if variant == 2 else 50000), "spouse", D(0)),
    ]
    if variant == 2:
        accounts.extend([
            ("Jordan HSA", "hsa", money(40000), "nonSpouse", D(0)),
            ("Jordan RSUs", "taxable", money(20000), "spouse", D(0)),
        ])
    traditional_total = sum((gross for _, category, gross, _, _ in accounts if category == "traditional"), D(0))
    remaining_basis = money(49000 if variant == 2 else 0)
    allocated_total = min(remaining_basis, traditional_total)
    result = []
    for name, category, gross, destination, charity_pct in accounts:
        if gross <= 0:
            continue
        if category == "traditional":
            base = max(D(0), gross - allocated_total * (gross / traditional_total)) if traditional_total > 0 else gross
        elif category == "hsa":
            base = D(0) if destination == "spouse" else gross
        else:
            base = D(0)
        rate_pct = D(32 if category == "traditional" else 24 if category == "hsa" else 28) if variant == 2 else D(28)
        fraction = min(D(1), charity_pct / D(100)) if destination == "charity" else D(0)
        charity = gross * fraction
        tax = D(0) if destination == "spouse" else base * (D(1) - fraction) * (rate_pct / D(100))
        result.append((name, category, destination, gross, base, rate_pct, charity, tax, gross - charity - tax))
    return result


def savings_rates():
    wages = D(65000)
    deferral = D(6000)
    roth_contribution = D(3000)
    employer_match = min(deferral, wages * D(4) / D(100)) * D(100) / D(100)
    annual_pia = D(12) * D(2000)
    print("Example match and annual PIA:", employer_match, annual_pia)
    years = [
        (2026, deferral + roth_contribution, employer_match, D(1400), wages),
        (2062, D(0), D(0), D(0), D(0)),
        (2070, D(0), D(0), D(6000), annual_pia),
        (2076, D(0), D(0), D(30000), annual_pia),
    ]
    return [(year, max(D(0), min(D(100), (contributions + match + surplus) / income * D(100))) if income > 0 else D(0))
            for year, contributions, match, surplus, income in years]


def bisect_spending(resolution):
    feasible_through = D(63000)
    current_base = D(40000)
    probes = []
    def probe(amount):
        probes.append(amount)
        return amount <= feasible_through
    seed = current_base.to_integral_value(rounding=ROUND_HALF_UP)
    assert probe(seed)
    lower = seed
    next_amount = max(seed * D(2), D(20000))
    while probe(next_amount):
        lower = next_amount
        next_amount *= D(2)
    upper = next_amount
    while upper - lower > resolution:
        mid = ((lower + upper) / D(2)).to_integral_value(rounding=ROUND_HALF_UP)
        if probe(mid):
            lower = mid
        else:
            upper = mid
    feasible = lower
    published = (feasible / D(100)).to_integral_value(rounding=ROUND_FLOOR) * D(100)
    return probes, feasible, published, published - current_base, upper - lower


for variant in (1, 2):
    rows = estate_rows(variant)
    print(f"ESTATE CASE {variant}")
    for row in rows:
        print(" | ".join(str(value) for value in row))
    print("sums gross/base/charity/tax/net:", *(sum((row[i] for row in rows), D(0)) for i in (3, 4, 6, 7, 8)))

print("SAVINGS", savings_rates())
for resolution in (D(1000), D(100)):
    print("SPENDING", resolution, bisect_spending(resolution))

# Counterexample to the estate record's HSA limit: a charity designation is
# accepted for an HSA, and the heir tax uses only the non-charity slice.
hsa_gross, hsa_charity_fraction, hsa_rate = D(40000), D(25) / D(100), D(24) / D(100)
print("HSA CHARITY LIMIT", "base", hsa_gross, "charity", hsa_gross * hsa_charity_fraction,
      "heir tax", hsa_gross * (D(1) - hsa_charity_fraction) * hsa_rate,
      "whole-base tax", hsa_gross * hsa_rate)
