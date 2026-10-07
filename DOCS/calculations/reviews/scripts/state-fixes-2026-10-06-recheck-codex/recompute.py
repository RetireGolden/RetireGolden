"""Independent arithmetic from Va. Code §§58.1-320, 58.1-322.03 and Form 760PY.

No project code is imported or executed.
"""
from decimal import Decimal as D


def virginia_tax(taxable):
    boundaries = (D(0), D(3000), D(5000), D(17000))
    rates = (D('0.02'), D('0.03'), D('0.05'), D('0.0575'))
    total = D(0)
    for i, lower in enumerate(boundaries):
        if taxable <= lower:
            break
        upper = boundaries[i + 1] if i + 1 < len(boundaries) else taxable
        total += (min(taxable, upper) - lower) * rates[i]
    return total


def slice_tax(annual_income, age):
    half = D('0.5')
    slice_income = D(annual_income) * half
    standard = D(8750) * half
    personal = (D(930) + (D(800) if age >= 65 else D(0))) * half
    age_deduction = max(D(0), D(12000) - max(D(0), D(annual_income) - D(50000))) * half if age >= 65 else D(0)
    taxable = slice_income - standard - personal - age_deduction
    return taxable, virginia_tax(taxable)


for annual, age in ((60000, 60), (60000, 70), (62000, 70)):
    taxable, tax = slice_tax(annual, age)
    print(f"annual={annual}, age={age}: taxable={taxable}, tax={tax}")
print('age-deduction fixture difference:', slice_tax(62000, 70)[1] - slice_tax(60000, 70)[1])
