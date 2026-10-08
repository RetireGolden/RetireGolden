"""Independent Decimal worksheet; no RetireGolden imports or execution."""
from decimal import Decimal as D, ROUND_HALF_UP


def tax(taxable, bands):
    taxable = D(taxable)
    return sum((max(D(0), min(taxable, D(hi)) - D(lo)) * D(rate) / 100
                for lo, hi, rate in bands), D(0)).quantize(D('.01'), rounding=ROUND_HALF_UP)


def fmt(value):
    return f"{D(value).quantize(D('.01'), rounding=ROUND_HALF_UP):.2f}"


mo = [(0, 1348, 0), (1348, 2696, 2), (2696, 4044, 2.5),
      (4044, 5392, 3), (5392, 6740, 3.5), (6740, 8088, 4),
      (8088, 9436, 4.5), (9436, 999999999, 4.7)]
nj_single = [(0, 20000, 1.4), (20000, 35000, 1.75),
             (35000, 40000, 3.5), (40000, 75000, 5.525)]
nj_joint = [(0, 20000, 1.4), (20000, 50000, 1.75)]
md = [(0, 1000, 2), (1000, 2000, 3), (2000, 3000, 4),
      (3000, 100000, 4.75)]
nm = [(0, 5500, 1.5), (5500, 16500, 3.2), (16500, 33500, 4.3),
      (33500, 66500, 4.7), (66500, 210000, 4.9)]
mt = [(0, 47500, 4.7), (47500, 999999999, 5.65)]
de = [(0, 2000, 0), (2000, 5000, 2.2), (5000, 10000, 3.9),
      (10000, 20000, 4.8), (20000, 25000, 5.2),
      (25000, 60000, 5.55), (60000, 999999999, 6.6)]

results = {
    'CO under55': tax(100000 - 16100 - 15000, [(0, 999999999, 4.4)]),
    'CO age60': tax(100000 - 16100 - 20000, [(0, 999999999, 4.4)]),
    'CO age65': tax(100000 - 18150 - 24000 - 4500, [(0, 999999999, 4.4)]),
    'MD under55': tax(100000 - 3400 - 12500, md),
    'MD age60': tax(100000 - 3400 - 20000, md),
    'MD age65': tax(100000 - 3400 - 20000 - 40600, md),
    'GA under62': tax(100000 - 15000 - 17500, [(0, 999999999, 4.99)]),
    'GA wages20k': tax(120000 - 15000 - 35000, [(0, 999999999, 4.99)]),
    'NM 30k': tax(100000 - 16100 - 30000, nm),
    'MT pay+wages': tax(120000 - 16100 - 20000, mt),
    'MT survivor': tax(100000 - 16100 - 50000, mt),
    'MO SBP100k': tax(100000 - 16100 - 48967, mo),
    'MO SBP hypothetical49824': tax(100000 - 16100 - 49824, mo),
    'DE under60 military': tax(100000 - 3250 - 12500, de),
    'NJ single60': tax(50000 - 1000, nj_single),
    'NJ single66': tax(50000 - 2000, nj_single),
    'NJ joint60': tax(50000 - 2000, nj_joint),
    'NJ joint66': tax(50000 - 4000, nj_joint),
    'NJ veteran66': tax(50000 - 2000 - 6000, nj_single),
}

# Federal section 86 provisional-income worksheet, then Utah's 4.45% and
# larger-of-credits election. 1950 case: $25,920 benefits, $20,000 pension.
ss_1950 = min(D('25920') * D('.85'),
              D('.5') * (D('32960') - D('25000')))
agi_1950 = D('20000') + ss_1950
results['UT born1950'] = fmt(agi_1950 * D('.0445') - D('450'))

# Born 1956: where the $20,000 other-income case stays below the $54,000
# phaseout, the Social Security credit cancels the tax on included benefits.
results['UT born1956'] = fmt(D('20000') * D('.0445'))

# Railroad case: $32,000 SS, $20,000 tier II, $20,000 other income.
# Section 86: provisional income 56,000, included SS 4,500 + .85*22,000.
ss_rail = D('4500') + D('.85') * D('22000')
federal_agi_rail = D('40000') + ss_rail
ut_taxable_rail = federal_agi_rail - D('20000')
credit_rail = ss_rail * D('.0445')
results['UT railroad form'] = fmt(ut_taxable_rail * D('.0445') - credit_rail)
results['UT railroad statute'] = fmt(ut_taxable_rail * D('.0445') -
                                    (credit_rail - (federal_agi_rail - D('54000')) * D('.025')))

expected = {'CO under55': '3031.60', 'CO age60': '2811.60', 'CO age65': '2347.40',
            'MD under55': '3942.25', 'MD age60': '3586.00', 'MD age65': '1657.50',
            'GA under62': '3368.25', 'GA wages20k': '3493.00', 'NM 30k': '2124.30',
            'MT pay+wages': '4289.10', 'MT survivor': '1593.30', 'MO SBP100k': '1461.22',
            'MO SBP hypothetical49824': '1420.94', 'NJ single60': '1214.75',
            'DE under60 military': '4544.00',
            'NJ single66': '1159.50', 'NJ joint60': '770.00', 'NJ joint66': '735.00',
            'NJ veteran66': '828.00', 'UT born1950': '617.11', 'UT born1956': '890.00',
            'UT railroad form': '890.00', 'UT railroad statute': '1120.00'}
for name, value in results.items():
    print(f'{name}: {fmt(value)}')
    assert fmt(value) == expected[name], name
