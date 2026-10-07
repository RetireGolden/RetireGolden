"""Independent Decimal worksheets from the cited state statutes and forms.

No project code is imported or executed.
"""
from decimal import Decimal as D


def va_tax(base, scaled_brackets=False):
    scale = D('0.5') if scaled_brackets else D(1)
    taxable = D(base)
    return (min(taxable, 3000 * scale) * D('.02')
            + min(max(taxable - 3000 * scale, 0), 2000 * scale) * D('.03')
            + min(max(taxable - 5000 * scale, 0), 12000 * scale) * D('.05')
            + max(taxable - 17000 * scale, 0) * D('.0575'))


def show(name, **values):
    print(name + ': ' + ', '.join(f'{k}={v}' for k, v in values.items()))


# Va. Code 58.1-322.03; age worksheet: adjusted federal AGI excludes taxable SS.
va_base_single_aged = D(8750 + 930 + 800)
va_base_single_young = D(8750 + 930)
va_base_joint_both = D(17500 + 2 * 930 + 2 * 800)
for name, ordinary, age_deduction, deductions in [
    ('single-wages-40k', 40000, 12000, va_base_single_aged),
    ('single-old-reading', 40000, 0, va_base_single_aged),
    ('single-55k', 55000, 7000, va_base_single_aged),
    ('single-ss-taxable', 56000, 6000, va_base_single_aged),
    ('single-ss-gross-reading', 56000, 10500, va_base_single_aged),
    ('single-ss-unadjusted', 56000, 0, va_base_single_aged),
    ('single-tier1', 40000, 12000, va_base_single_aged),
    ('single-tier1-unadjusted', 40000, 2000, va_base_single_aged),
    ('single-pre1939', 120000, 12000, va_base_single_aged),
    ('single-pre1939-income-tested', 120000, 0, va_base_single_aged),
    ('single-under65', 40000, 0, va_base_single_young),
    ('joint-60k', 60000, 24000, va_base_joint_both),
    ('joint-60k-old', 60000, 0, va_base_joint_both),
    ('joint-80k', 80000, 19000, va_base_joint_both),
    ('joint-80k-double-reduction', 80000, 14000, va_base_joint_both),
    ('joint-mixed-90k', 90000, 12000, va_base_joint_both),
    ('joint-mixed-90k-all-tested', 90000, 9000, va_base_joint_both),
]:
    ti = D(ordinary) - D(age_deduction) - deductions
    show(name, taxable=ti, tax=va_tax(ti))
show('joint-80k-one-aged', taxable=D(80000 - 7000 - 17500 - 1860 - 800))
show('va-birthday-aged-exemption', jan1_ti=D(70000) - va_base_single_aged,
     jan2_ti=D(70000) - va_base_single_young,
     tax_difference=va_tax(D(70000) - va_base_single_young) - va_tax(D(70000) - va_base_single_aged))
show('va-birthday-age-and-exemption', jan1_ti=D(40000 - 12000) - va_base_single_aged,
     jan2_ti=D(40000) - va_base_single_young)

# Illustrative exactly-half residence: month model in tests. Law uses days for exemptions.
for name, income, age_deduction, exemptions in [
    ('va-part-young', 30000, 0, D(930) / 2),
    ('va-part-old', 30000, 1000, D(1730) / 2),
    ('va-part-young-whole-exemption', 30000, 0, D(930)),
    ('va-part-old-whole-exemption', 30000, 1000, D(1730)),
    ('va-part-old-62k', 31000, 0, D(1730) / 2),
]:
    ti = D(income) - D(age_deduction) - D(8750) / 2 - exemptions
    show(name, taxable=ti, legal_brackets=va_tax(ti), test_scaled_brackets=va_tax(ti, True))

# K.S.A. 79-32,117(c)(xix): Washburn 403(b) benefit; plan code matters.
show('ks-washburn-employer-plan', distribution=D(24000), named_subtraction=D(24000),
     unnamed_assumed_subtraction=D(0))

# Maine 1040ME, Pennsylvania PA-40, SC 12-6-1170, MI Treasury FAQ, NY TSB.
show('me', conversion=D(0), mixed_nonconversion=D(40000 - 25000),
     in_plan_conversion=D(0), ordinary_ira=D(30000), old_conversion=D(30000),
     old_mixed=D(40000))
show('pa', conversion_excluded=D(40000), tax_without_exclusion=D(40000) * D('.0307'),
     mixed_excluded=D(30000), in_plan_at50_excluded=D(0))
show('sc', conversion_at50=min(D(20000), D(3000)),
     conversion_at66=min(D(20000), D(10000)), old_at50=D(0))
show('mi-ny', mi_post_half_birthday=min(D(30000), D(67610)), mi_pre_half_birthday=D(0),
     ny_post_half_birthday=min(D(30000), D(20000)), ny_pre_half_birthday=D(0))

ct_single = [(0, D(1)), (75000, D('.85')), (77500, D('.70')), (80000, D('.55')),
             (82500, D('.40')), (85000, D('.25')), (87500, D('.10')),
             (90000, D('.05')), (95000, D('.025')), (100000, D(0))]
ct_joint = [(0, D(1)), (100000, D('.85')), (105000, D('.70')), (110000, D('.55')),
            (115000, D('.40')), (120000, D('.25')), (125000, D('.10')),
            (130000, D('.05')), (140000, D('.025')), (150000, D(0))]
for name, agi, schedule in [('ct-single-60k', 60000, ct_single), ('ct-single-78k', 78000, ct_single),
                            ('ct-single-99k', 99000, ct_single), ('ct-single-120k', 120000, ct_single),
                            ('ct-joint-112k', 112000, ct_joint), ('ct-survivor-112k', 112000, ct_single)]:
    rate = next(rate for lower, rate in reversed(schedule) if agi >= lower)
    show(name, rate=rate, subtraction=D(30000) * rate, old_subtraction=D(30000))

for name, income, payments, qualifying, maximum, rate in [
    ('nj-single-80k', 80000, 80000, 80000, 75000, None),
    ('nj-single-110k', 110000, 80000, 80000, 75000, D('.375')),
    ('nj-single-140k', 140000, 80000, 80000, 75000, D('.1875')),
    ('nj-single-200k', 200000, 80000, 80000, 75000, D(0)),
    ('nj-joint-one-95k', 95000, 90000, 90000, 100000, None),
    ('nj-joint-one-120k', 120000, 70000, 40000, 100000, D('.5')),
    ('nj-joint-both-110k', 110000, 110000, 110000, 100000, D('.5')),
    ('nj-conversion-62', 60000, 60000, 60000, 75000, None),
    ('nj-disabled-55', 40000, 40000, 40000, 75000, None),
    ('nj-young-55', 40000, 40000, 0, 75000, None),
]:
    exclusion = min(D(qualifying), D(maximum) if rate is None else D(payments) * rate)
    show(name, exclusion=exclusion)
show('nj-part-year', slice_payments=D(40000), prorated_maximum=D(75000) / 2,
     excluded=min(D(40000), D(75000) / 2), taxable=D(40000) - D(75000) / 2,
     tax=(D(40000) - D(75000) / 2) * D('.014'))
