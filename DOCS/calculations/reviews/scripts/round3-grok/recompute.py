"""Independent recomputation of the two restated records.

Uses decimal arithmetic only. Imports nothing from the repository.
"""
from decimal import Decimal, getcontext

getcontext().prec = 50

def show(label, value, expected):
    match = value == expected
    print(f"{label}: {value}  expected {expected}  match={match}")
    return match

print("=== rmd-uniform-lifetime-divisor, original worked case ===")
balance = Decimal("246000")
div75 = Decimal("24.6")
div74 = Decimal("25.5")
rmd = balance / div75
show("246000 / 24.6", rmd, Decimal("10000"))
wrong_age = balance / div74
print(f"wrong reading age-74 divisor 25.5: {wrong_age}")
print(f"  worksheet: 9647.058823...  equal={wrong_age == Decimal('246000') / Decimal('25.5')}")
print(f"  differs from 10000: {wrong_age != Decimal('10000')}")
current_ye = Decimal("240000") / div75
print(f"wrong reading current year-end 240000: {current_ye}")
print(f"  worksheet: 9756.097561...  differs from 10000: {current_ye != Decimal('10000')}")

print()
print("=== restated pooled-IRA limit ===")
shared = Decimal("100000") / Decimal("24.6")
own = Decimal("29600") / Decimal("24.6")
print(f"100000 / 24.6 = {shared}")
print(f"  rounded half-up to cents: {shared.quantize(Decimal('0.01'))}")
print(f"29600 / 24.6 = {own}")
print(f"  rounded half-up to cents: {own.quantize(Decimal('0.01'))}")
print(f"difference: {shared - own} = {(shared - own).quantize(Decimal('0.01'))}")
# exact fractions
print(f"100000/24.6 = {1000000}/246 = reduced check")
from fractions import Fraction
f_shared = Fraction(100000) / Fraction("24.6")
f_own = Fraction(29600) / Fraction("24.6")
print(f"exact shared {f_shared} = {float(f_shared)}")
print(f"exact own {f_own} = {float(f_own)}")
print(f"cents half-up shared {round(f_shared * 100) / 100}")
# banker's vs half-up: 4065.040650... so the third decimal is 0, cents are exact 4065.04
# 1203.252032... third decimal is 2, so half-up and truncation both give 1203.25

print()
print("=== tax-penalties-annual original ===")
early = Decimal("20000") * Decimal("10") / Decimal("100")
shortfall = max(Decimal("0"), Decimal("12000") - Decimal("4000"))
excise = shortfall * Decimal("25") / Decimal("100")
total = early + excise
show("early", early, Decimal("2000"))
show("shortfall", shortfall, Decimal("8000"))
show("excise", excise, Decimal("2000"))
show("total", total, Decimal("4000"))
wrong1_excise = Decimal("12000") * Decimal("25") / Decimal("100")
wrong1_total = early + wrong1_excise
show("wrong 25% of full 12000 excise", wrong1_excise, Decimal("3000"))
show("wrong 25% of full total", wrong1_total, Decimal("5000"))
wrong2_excise = shortfall * Decimal("10") / Decimal("100")
wrong2_total = early + wrong2_excise
show("wrong 10% excise", wrong2_excise, Decimal("800"))
show("wrong 10% total", wrong2_total, Decimal("2800"))
show("omitted early", excise, Decimal("2000"))
print(f"omitted differs from 4000: {excise != Decimal('4000')}")

print()
print("=== restated election-year 4974 case ===")
owner = Decimal("100000") / Decimal("24.6")
paid_before = Decimal("1000")
paid_after = owner - paid_before
print(f"owner RMD {owner} cents {owner.quantize(Decimal('0.01'))}")
print(f"after election {paid_after} cents {paid_after.quantize(Decimal('0.01'))}")
print(f"1000 + after = {paid_before + paid_after} equals owner: {paid_before + paid_after == owner}")
beneficiary = Decimal("99000") / Decimal("14.8")
print(f"beneficiary 99000/14.8 = {beneficiary}")
print(f"  cents {beneficiary.quantize(Decimal('0.01'))}")
added = beneficiary * Decimal("25") / Decimal("100")
print(f"second unpaid obligation excise {added}")
print(f"  cents {added.quantize(Decimal('0.01'))}")
print(f"excise on the paid owner obligation: 0")
print(f"second obligation differs from 0: {added != 0}")

# confirm the cent figures are not rounding artifacts
from decimal import ROUND_HALF_UP
def cents(x):
    return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

print()
print("cent checks:")
print("owner", cents(owner), "expected 4065.04", cents(owner) == Decimal("4065.04"))
print("after", cents(paid_after), "expected 3065.04", cents(paid_after) == Decimal("3065.04"))
print("own 29600", cents(own), "expected 1203.25", cents(own) == Decimal("1203.25"))
print("beneficiary", cents(beneficiary), "expected 6689.19", cents(beneficiary) == Decimal("6689.19"))
print("added excise", cents(added), "expected 1672.30", cents(added) == Decimal("1672.30"))
# also check the third decimal so half-up is unambiguous
for name, val in [("owner", owner), ("after", paid_after), ("own", own), ("ben", beneficiary), ("added", added)]:
    third = (val * 1000) % 10
    print(f"  {name} third decimal digit {third} (0 or 5 would be a tie)")
