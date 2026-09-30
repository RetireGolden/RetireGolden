"""Recompute both worksheets with exact rationals. Imports nothing from the repository."""
from decimal import Decimal, getcontext
from fractions import Fraction

getcontext().prec = 50


def money(x: Fraction, places: int = 2) -> str:
    q = Decimal(x.numerator) / Decimal(x.denominator)
    return f"{q:.{places}f}"


def show(label: str, value: Fraction, expected: str) -> None:
    got = money(value)
    mark = "MATCH" if got == expected else "DIFF"
    print(f"{mark:5} {label}: {got}  expected {expected}  exact={value}")


print("=== own claim year and later year ===")
pia = Fraction(2000)
factor = Fraction(49, 60)
claim = pia * factor * 9 * 1 * Fraction(95, 100)
later = pia * factor * 12 * Fraction(106, 100) * Fraction(95, 100)
show("own claim year", claim, "13965.00")
show("later year", later, "19737.20")
print("  49/60 check:", Fraction(1) - 33 * Fraction(5, 9) / 100)

print("=== two-person ===")
higher = Fraction(2000)
lower = Fraction(300)
excess = max(Fraction(0), Fraction(1, 2) * higher - lower) * 1
candidate = min(lower, lower) + excess
household = (higher + candidate) * 12
show("two-person", household, "36000.00")
print("  excess-only wrong reading:", money((higher + excess) * 12))

print("=== below FRA ===")
withheld = max(Fraction(0), (Fraction(34480) - Fraction(24480)) / 2)
paid = Fraction(24000) - withheld
show("below-FRA withheld", withheld, "5000.00")
show("below-FRA paid", paid, "19000.00")
wrong_withheld = (Fraction(34480) - Fraction(24480)) / 3
print("  divide-by-3 withheld:", money(wrong_withheld), "paid", money(Fraction(24000) - wrong_withheld))
print("  incompatible 0.8 x 9 x 0.95 x 2000:", money(Fraction(2000) * Fraction(4, 5) * 9 * Fraction(95, 100)))

print("=== early factors ===")
def ret(months: int) -> Fraction:
    return 1 - min(months, 36) * Fraction(5, 9) / 100 - max(0, months - 36) * Fraction(5, 12) / 100


def spouse(months: int) -> Fraction:
    return 1 - min(months, 36) * Fraction(25, 36) / 100 - max(0, months - 36) * Fraction(5, 12) / 100


print("retirement 60 months early:", ret(60), "expected 0.70")
print("spouse 60 months early:", spouse(60), "expected 0.65")
print("retirement 50 months early:", ret(50), float(ret(50)))
print("spouse 50 months early:", spouse(50), float(spouse(50)))
print("retirement 48 months early:", ret(48), float(ret(48)))
print("spouse 48 months early:", spouse(48), float(spouse(48)))
print("retirement 54 months early:", ret(54), float(ret(54)))

print("=== E5 ===")
w_own = Fraction(2000) * ret(60)
s_own = Fraction(400) * ret(60)
spouse_base = Fraction(1000)  # half of 2000
s_spouse = (spouse_base - Fraction(400)) * spouse(60)
family = w_own + s_spouse
s_total = s_own + s_spouse
print(f"W own {money(w_own)} S own {money(s_own)} S spouse {money(s_spouse)} family {money(family)} S total {money(s_total)}")
excess_w = (Fraction(60000) - Fraction(24480)) // 2
print("W excess floor:", excess_w)
full_months = excess_w // family
remainder_charge = excess_w - full_months * family
left = family - remainder_charge
print(f"full months {full_months} remainder charge {money(remainder_charge)} left {money(left)}")
# proportion of benefits before any reduction: PIA 2000 to half 1000
w_share = left * Fraction(2000) / Fraction(3000)
s_share = left * Fraction(1000) / Fraction(3000)
print(f"shares W {money(w_share, 10)} S {money(s_share, 10)}")
# remaining months of the year after the partial month
# January-September = 9 full, October partial, November-December paid in full
w_paid_2026 = w_share + 2 * w_own
s_paid_2026 = 12 * s_own + s_share + 2 * s_spouse
show("E5 W 2026", w_paid_2026, "2893.33")
show("E5 S 2026", s_paid_2026, "4186.67")
print("  cents exact?", w_paid_2026 * 100, s_paid_2026 * 100)

w_2031_monthly = Fraction(2000) * ret(50)
s_2031_monthly = s_own + Fraction(600) * spouse(50)
show("E5 W 2031", w_2031_monthly * 12, "17800.00")
show("E5 S 2031", s_2031_monthly * 12, "8340.00")
print("  W monthly", money(w_2031_monthly, 10), "factor", float(ret(50)))
print("  S monthly", money(s_2031_monthly, 10), "spouse factor", float(spouse(50)))

print("=== wrong reading: charge own benefit only ===")
# W excess 17760 against his own 1400/month only
w_full = excess_w // w_own
w_rem = excess_w - w_full * w_own
w_paid_wrong = (12 - w_full) * w_own - w_rem
print("W paid if own only:", money(w_paid_wrong), "full months", w_full, "rem", money(w_rem))
print("S paid if untouched: 12 * 670 =", money(12 * s_total))
print("worksheet says W 0 and S 8040")
print("  12*670 =", 12 * 670)

print("=== E7b ===")
excess_s = (Fraction(36000) - Fraction(24480)) // 2
print("S excess floor:", excess_s)
# left of her benefits: own 280 Jan-Sep (2520), 326.67 October, 670 Nov and Dec
oct_left = s_own + s_share
left_of_hers = 9 * s_own + oct_left + 2 * s_total
print("left of hers:", money(left_of_hers), "vs excess", excess_s)
print("paid 2026 S:", money(max(Fraction(0), left_of_hers - excess_s)))
print("W unchanged:", money(w_paid_2026))
s_2031_e7b = Fraction(400) * ret(48) + Fraction(600) * spouse(48)
show("E7b S 2031", s_2031_e7b * 12, "8640.00")
print("  monthly", money(s_2031_e7b, 10), "ret", float(ret(48)), "spouse", float(spouse(48)))
print("  400*0.75 + 600*0.70 =", 400 * 0.75 + 600 * 0.70)

print("=== wrong readings E7b ===")
print("spare own in months his excess took spouse: 9*280 =", money(9 * s_own))
print("leave his charge out: 8040 - 5760 =", 8040 - 5760)

print("=== E1 ===")
gross_2026 = Fraction(1400) * 12
excess_e1 = (Fraction(40000) - Fraction(24480)) // 2
print("excess", excess_e1, "gross", money(gross_2026))
# January and February unchargeable. March-July = 5 * 1400 = 7000, August 760
paid_2026 = gross_2026 - excess_e1
show("E1 2026", paid_2026, "9040.00")
e1_factor = ret(54)
print("54 months early factor", e1_factor, float(e1_factor), "monthly", money(Fraction(2000) * e1_factor, 10))
show("E1 2031", 2 * Fraction(1400) + 10 * Fraction(2000) * e1_factor, "17300.00")
show("E1 2032", 12 * Fraction(2000) * e1_factor, "17400.00")

print("=== wrong readings E1 ===")
print("adjustment from January of FRA year: 12 * 1450 =", 12 * 1450)
# charge January and February too, credit only March-June
# excess 7760 takes Jan-May (7000) and 760 of June. Crediting months: March, April, May, June = 4
# months early at FRA: 60 - 4 = 56
wrong_factor = ret(56)
print("56 months early factor", wrong_factor, float(wrong_factor))
print("monthly", money(Fraction(2000) * wrong_factor, 10))
# 2031: January and February at unadjusted 1400, March-December at adjusted
print("2031 if adjusted from March with 4 credits:", money(2 * Fraction(1400) + 10 * Fraction(2000) * wrong_factor))
print("2032:", money(12 * Fraction(2000) * wrong_factor))
# worksheet says 17133.33 and 17200
print("worksheet 17133.33 / 17200")
# maybe they adjusted the whole year at the 4-credit factor? 12 * 1433.33
print("12 * monthly:", money(12 * Fraction(2000) * wrong_factor))
# or January-February still 1400 and they used a different month count
# "2031 pays 17,133.33, 17,200 after"
# 17133.33 = 17133 + 1/3 = 51400/3
print("17133.33 as fraction check", Fraction(1713333, 100))
# perhaps 2*1400 + 10 * (2000 * something)
# 17133.33 - 2800 = 14333.33 over 10 months = 1433.333 per month
print("implied monthly after March:", (Fraction(1713333, 100) - 2800) / 10)
# 1433.333... = 4300/3 = 1433.333, factor 4300/3 / 2000 = 4300/6000 = 43/60 = 0.71666...
print("implied factor", Fraction(43, 60), float(Fraction(43, 60)))
print("ret(56) =", ret(56), "which is", float(ret(56)))
# 1 - 36*5/9% - 20*5/12% = 1 - 0.2 - 20*5/1200 = 1 - 0.2 - 100/1200 = 0.8 - 1/12 = 0.71666...
print("ret(56) money monthly", money(Fraction(2000) * ret(56), 10))
print("2*1400 + 10*that =", money(2 * Fraction(1400) + 10 * Fraction(2000) * ret(56)))
print("rounded to cent:", money(2 * Fraction(1400) + 10 * Fraction(2000) * ret(56)))
# 17133.33 is the unrounded display of 2*1400 + 10*(2000*ret(56)) if they rounded the monthly to 1433.33
monthly_rounded = Fraction(143333, 100)  # 1433.33
print("if monthly rounded to 1433.33:", money(2 * Fraction(1400) + 10 * monthly_rounded))
monthly_exact = Fraction(2000) * ret(56)
print("exact 2031:", money(2 * Fraction(1400) + 10 * monthly_exact, 10))
print("exact 2032:", money(12 * monthly_exact, 10))
# 12 * 1433.333... = 17200 exactly if they used 1433.333... * 12
print("12 * ret(56) * 2000 =", 12 * Fraction(2000) * ret(56), money(12 * Fraction(2000) * ret(56)))
# So "17,133.33, 17,200 after" is 2*1400 + 10*1433.333... = 17133.333... and 12*1433.333... = 17200
# The worksheet states 17,133.33 which is the cent display of that exact third.
print("2031 exact third:", 2 * Fraction(1400) + 10 * Fraction(2000) * ret(56))

print("=== COLA ===")
rate = Fraction(28, 1000)  # 2.8%
for n, expected in ((0, "1"), (1, "1.028"), (2, "1.056784")):
    factor = (1 + rate) ** n
    print(n, factor, float(factor), "expected", expected, "MATCH" if str(factor) == expected or money(factor, 6).rstrip("0") else "")
    print("   decimal", Decimal(factor.numerator) / Decimal(factor.denominator))
print("monthly:", [Decimal(2000) * (Decimal("1.028") ** n) for n in range(3)])
print("wrong first-year COLA:", [(Decimal("1.028") ** n) for n in (1, 2, 3)])
print("simple addition year 3:", Decimal("1") + 2 * Decimal("0.028"))

print("=== IEEE check of 1.028**2 ===")
print(repr((1 + 2.8 / 100) ** 2))
print(repr(1.028 ** 2))
print(abs((1 + 2.8 / 100) ** 2 - 1.056784))
print("2000 * 1.028**2", repr(2000 * (1.028 ** 2)))
