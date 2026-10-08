"""Independent part-year arithmetic; transcribed 2026 parameters, no engine imports."""
from decimal import Decimal as D


def money(value):
    return D(str(value))


def graduated(taxable, edges):
    taxable = money(taxable)
    total = D(0)
    for pos, (floor, rate) in enumerate(edges):
        floor, rate = money(floor), money(rate) / 100
        next_floor = money(edges[pos + 1][0]) if pos + 1 < len(edges) else taxable
        total += max(D(0), min(taxable, next_floor) - floor) * rate
    return total


# State, annual standard deduction, deduction share, annual exemption,
# exemption share, and ordinary single rate schedule. Each slice is $50,000.
cases = [
    ("NJ", 0, "0.5", 1000, "0.5", [(0, 1.4), (20000, 1.75), (35000, 3.5), (40000, 5.525), (75000, 6.37)]),
    ("HI", 8000, "0.5", 0, "0.5", [(0, 1.4), (9600, 3.2), (14400, 5.5), (19200, 6.4), (24000, 6.8), (36000, 7.2), (48000, 7.6)]),
    ("SC", 15000, "0.5", 0, "0.5", [(0, 1.99), (30000, 5.21)]),
    ("DC", 15000, "0.5", 0, "0.5", [(0, 4), (10000, 6), (40000, 6.5)]),
    ("MS", 2300, "0.5", 0, "0.5", [(0, 0), (10000, 4)]),
    ("ID", 16100, "0.5", 0, "0.5", [(0, 0), (4811, 5.3)]),
    ("MD", 3400, "0.5", 0, "0.5", [(0, 2), (1000, 3), (2000, 4), (3000, 4.75)]),
    ("AZ", 15750, "1", 0, "0.5", [(0, 2.5)]),
    ("LA", 12875, "1", 0, "0.5", [(0, 3)]),
    ("KY", 3360, "1", 0, "0.5", [(0, 3.5)]),
    ("AL", 3000, "1", 0, "1", [(0, 2), (500, 4), (3000, 5)]),
]

for state, deduction, d_share, exemption, e_share, edges in cases:
    taxable = money(50000) - money(deduction) * money(d_share) - money(exemption) * money(e_share)
    print(f"{state}: deduction={money(deduction)*money(d_share)}, exemption={money(exemption)*money(e_share)}, taxable={taxable}, tax={graduated(taxable, edges)}")

wi_deduction = money(13960) - money("0.12") * (money(100000) - money(20120))
wi_taxable = money(100000) - wi_deduction
wi_full_tax = graduated(wi_taxable, [(0, 3.5), (15110, 4.4), (51950, 5.3), (332720, 7.65)])
print(f"WI: full_year_deduction={wi_deduction}, full_year_taxable={wi_taxable}, full_year_tax={wi_full_tax}, half_tax={wi_full_tax/2}")

print(f"SC full-year AGI $100,000 SCIAD phaseout: tax={graduated(50000, [(0, 1.99), (30000, 5.21)])}")
print(f"KY July move standard-deduction difference: {(money(3360)/2)*money('0.035')}")
