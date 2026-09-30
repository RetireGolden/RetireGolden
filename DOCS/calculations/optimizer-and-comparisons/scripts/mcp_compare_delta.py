"""Worked cases of mcp-compare-ending-after-tax-estate-delta, in exact decimals.

Imports and reads nothing from packages/. Two plans with no income, no spending and 0% returns,
so each account ends where it starts; the heir tax is the plan's rate on the traditional balance.
Run from the repository root: python DOCS/calculations/optimizer-and-comparisons/scripts/mcp_compare_delta.py
"""
from decimal import Decimal as D, getcontext

getcontext().prec = 40
START = 2026
INFLATION = D('0.025')
HEIR = D('0.25')
plans = {
    'A (baseline)': {'end': 2050, 'cash': D(1_500_000), 'traditional': D(400_000)},
    'B (proposal)': {'end': 2054, 'cash': D(1_400_000), 'traditional': D(800_000)},
}
estate, net_worth, today = {}, {}, {}
for name, p in plans.items():
    net_worth[name] = p['cash'] + p['traditional']
    estate[name] = net_worth[name] - HEIR * p['traditional']
    factor = (1 + INFLATION) ** (p['end'] - START)
    today[name] = estate[name] / factor
    print(f"{name}: net worth {net_worth[name]}, heir tax {HEIR * p['traditional']}, estate {estate[name]}, "
          f"factor 1.025^{p['end'] - START} = {factor}, estate in {START} dollars {today[name]}")
a, b = 'A (baseline)', 'B (proposal)'
print('delta B - A (nominal):', estate[b] - estate[a])
print('wrong: A - B:', estate[a] - estate[b])
print('wrong: net worth delta:', net_worth[b] - net_worth[a])
print(f'wrong: {START}-dollar delta (the Compare page basis):', today[b] - today[a])
