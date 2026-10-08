"""Independent Decimal recomputation of the scoped part-year fixtures.

All constants below were transcribed from the official 2025 forms and the
snapshot's 2026 parameter table.  No RetireGolden modules are imported.
"""

from decimal import Decimal, getcontext

getcontext().prec = 30
D = lambda value: Decimal(str(value))
HALF = D(1) / D(2)


def bracket_tax(base, bands):
    base = max(D(0), base)
    total = D(0)
    for index, (lower, rate) in enumerate(bands):
        upper = bands[index + 1][0] if index + 1 < len(bands) else base
        total += max(D(0), min(base, upper) - lower) * rate / 100
    return total


BANDS = {
    'AL': [(D(0), D(2)), (D(500), D(4)), (D(3000), D(5))],
    'DC': [(D(0), D(4)), (D(10000), D(6)), (D(40000), D(6.5)), (D(60000), D(8.5)),
           (D(250000), D(9.25))],
    'HI': [(D(0), D(1.4)), (D(9600), D(3.2)), (D(14400), D(5.5)),
           (D(19200), D(6.4)), (D(24000), D(6.8)), (D(36000), D(7.2)),
           (D(48000), D(7.6)), (D(125000), D(7.9))],
    'NJ': [(D(0), D(1.4)), (D(20000), D(1.75)), (D(35000), D(3.5)),
           (D(40000), D(5.525)), (D(75000), D(6.37)), (D(500000), D(8.97))],
    'SC': [(D(0), D(1.99)), (D(30000), D(5.21))],
    'VA': [(D(0), D(2)), (D(3000), D(3)), (D(5000), D(5)), (D(17000), D(5.75))],
    'MD': [(D(0), D(2)), (D(1000), D(3)), (D(2000), D(4)),
           (D(3000), D(4.75)), (D(100000), D(5))],
    'MS': [(D(0), D(0)), (D(10000), D(4))],
    'ID': [(D(0), D(0)), (D(4811), D(5.3))],
}


def independent(state, scenario):
    conv_here = scenario == 'resident'
    annual = D(140000) if scenario != 'even' else D(100000)
    resident = D(90000) if conv_here else D(50000)
    ratio = resident / annual
    half = HALF
    if state == 'AL':
        return bracket_tax(resident - D(3000), BANDS[state])
    if state == 'AZ':
        return (resident - D(15750)) * D('.025')
    if state == 'DC':
        return bracket_tax(resident - D(15000) * half, BANDS[state])
    if state == 'GA':
        return (resident - D(15000) * ratio) * D('.0499')
    if state == 'HI':
        return bracket_tax(resident - D(8000) * ratio, BANDS[state])
    if state == 'ID':
        return bracket_tax(resident - D(16100) * ratio, BANDS[state])
    if state == 'IL':
        return (resident - (D(40000) if conv_here else D(0))) * D('.0495')
    if state == 'IN':
        return resident * D('.0295')
    if state == 'KY':
        # 2025 Schedule P, Part III, line 3: full $31,110 cap for pension
        # income received while a Kentucky resident, including a conversion.
        exclusion = D(31110) if conv_here else D(0)
        return (resident - D(3360) - exclusion) * D('.035')
    if state == 'LA':
        return (resident - D(12875)) * D('.03')
    if state == 'MD':
        return bracket_tax(resident - D(3400) * ratio, BANDS[state])
    if state == 'MA':
        return resident * D('.05')
    if state == 'MI':
        return resident * D('.0425')
    if state == 'MS':
        return bracket_tax(resident - (D(40000) if conv_here else D(0)) - D(2300) * half, BANDS[state])
    if state == 'NJ':
        return bracket_tax(resident - D(1000) * half, BANDS[state])
    if state == 'PA':
        return (resident - (D(40000) if conv_here else D(0))) * D('.0307')
    if state == 'SC':
        retirement = D(3000) if conv_here else D(0)
        return bracket_tax(resident - D(15000) * ratio - retirement, BANDS[state])
    if state == 'VA':
        return bracket_tax(resident - D(8750) * ratio - D(930) * half, BANDS[state])
    raise KeyError(state)


ENGINE_TESTS = {
    'AL': ('2310', '4310', '2310'), 'AZ': ('856.25', '1856.25', '856.25'),
    'DC': ('2362.5', '5412.5', '2362.5'), 'GA': ('2120.75', '4009.821', '2227.679'),
    'HI': ('2395.2', '5340.343', '2477.486'), 'ID': ('1968.367', '3966.467', '2090.267'),
    'IL': ('2475', '2475', '2475'), 'IN': ('1475', '2655', '1475'),
    'KY': ('1632.4', '2487.975', '1632.4'), 'LA': ('1113.75', '2313.75', '1113.75'),
    'MD': ('2241.75', '4118.679', '2264.821'), 'MA': ('2500', '4500', '2500'),
    'MI': ('2125', '3825', '2125'), 'MS': ('1554', '1554', '1554'),
    'NJ': ('1242.375', '3574.9', '1242.375'), 'PA': ('1535', '1535', '1535'),
    'SC': ('1248.25', '3064.307', '1359.893'), 'VA': ('2339.2', '4567.325', '2411.075'),
}

for state, targets in ENGINE_TESTS.items():
    results = [independent(state, case) for case in ('even', 'resident', 'texas')]
    matches = [abs(result - D(target)) < D('.001') for result, target in zip(results, targets)]
    print(state, ' / '.join(f'{value:.6f}' for value in results), matches)
