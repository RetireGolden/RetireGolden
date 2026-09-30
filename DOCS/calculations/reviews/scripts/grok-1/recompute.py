"""Independent recomputation of the thirteen worksheet cases.

Imports nothing from the repository. Integer cases are exact; the ACA
credit and the above-cliff percentage use Decimal.
"""

from decimal import Decimal, getcontext

getcontext().prec = 50


def accounts_ending_balance_by_category() -> dict[str, int]:
    rows = [
        ("cash", 10_000),
        ("taxable", 20_000),
        ("taxable", 5_000),
        ("traditional", 30_000),
        ("roth", 40_000),
        ("hsa", 6_000),
    ]
    totals = {name: 0 for name in ("cash", "taxable", "traditional", "roth", "hsa")}
    for name, balance in rows:
        totals[name] += balance
    return totals


def glidepath() -> dict[int, tuple[Decimal, Decimal]]:
    start, end = 2020, 2030
    us0, bond0 = Decimal("0.8"), Decimal("0.2")
    us1, bond1 = Decimal("0.6"), Decimal("0.4")

    def at(year: int) -> tuple[Decimal, Decimal]:
        if year <= start or end <= start:
            return us0, bond0
        if year >= end:
            return us1, bond1
        t = Decimal(year - start) / Decimal(end - start)
        return us0 + t * (us1 - us0), bond0 + t * (bond1 - bond0)

    return {year: at(year) for year in (2015, 2020, 2025, 2030, 2035)}


def drift() -> tuple[Decimal, Decimal]:
    stocks = Decimal("0.6") * Decimal("1.10")
    bonds = Decimal("0.4") * Decimal("0.95")
    total = stocks + bonds
    return stocks / total, bonds / total


def normalize() -> list[Decimal]:
    weights = [Decimal(60), Decimal(20), Decimal(20), Decimal(0)]
    total = sum(weights, Decimal(0))
    return [weight / total for weight in weights]


def annuity() -> int:
    full = 1_500 * 12 * Decimal("1.02")
    return int(full * Decimal("60") / Decimal("100"))


def one_time() -> int:
    return int(Decimal(50_000) * Decimal("1.12"))


def debt_service() -> tuple[int, int, int]:
    grown_a = int(Decimal(10_000) * Decimal("1.12"))
    pay_a = min(500 * 12, grown_a)
    grown_b = int(Decimal(1_000) * Decimal("1.12"))
    pay_b = grown_b  # payoff year
    return pay_a, pay_b, pay_a + pay_b


def one_time_goals() -> int:
    roof = int(Decimal(10_000) * Decimal("1.10"))
    trip = int(Decimal(5_000) * Decimal("1.10"))
    return roof + trip


def property_costs() -> int:
    return int((3_000 + 1_200) * Decimal("1.10"))


def bisection() -> tuple[list[int], int, int]:
    lo, hi, resolution = 60_000, 70_000, 1_000
    probes: list[int] = []
    while hi - lo > resolution:
        mid = (lo + hi) // 2
        probes.append(mid)
        if mid <= 63_000:
            lo = mid
        else:
            hi = mid
    return probes, lo, lo - 40_000


def estate_deltas() -> tuple[int, int]:
    return 530_000 - 500_000, 185_000 - 200_000


def tips() -> dict[str, int]:
    face_a, coupon_a, maturity_a = 10_000, Decimal("0.01"), 1
    face_b, coupon_b, maturity_b = 20_000, Decimal("0.02"), 3
    scale = Decimal("0.8")
    factors = {0: Decimal(1), 1: Decimal("1.05"), 2: Decimal("1.10")}
    rungs = [(face_a, coupon_a, maturity_a), (face_b, coupon_b, maturity_b)]
    out: dict[str, int] = {}
    for offset, factor in factors.items():
        coupons = sum(
            (face * coupon for face, coupon, maturity in rungs if maturity >= offset),
            Decimal(0),
        )
        principal = sum(
            (Decimal(face) for face, _coupon, maturity in rungs if maturity == offset),
            Decimal(0),
        )
        remaining = sum(
            (Decimal(face) for face, _coupon, maturity in rungs if maturity > offset),
            Decimal(0),
        )
        cash = 0 if offset == 0 else (coupons + principal) * scale * factor
        out[f"offset-{offset}-cash"] = int(cash)
        out[f"offset-{offset}-value"] = int(
            (face_a + face_b if offset == 0 else remaining) * scale * factor
        )
    return out


def aca() -> dict[str, Decimal | bool]:
    fpl = Decimal(21_150)
    rate = Decimal("9.96")
    slcsp, enroll = Decimal(12_000), Decimal(10_000)
    at = Decimal(84_600)
    over = Decimal(84_601)
    fpl_at = at / fpl * 100
    fpl_over = over / fpl * 100
    contribution = at * rate / 100
    credit = min(enroll, slcsp - contribution)
    continued = min(enroll, slcsp - over * rate / 100)
    return {
        "fpl_at": fpl_at,
        "fpl_over": fpl_over,
        "credit_at": credit,
        "over_cliff_at": fpl_at > 400,
        "credit_over": Decimal(0) if fpl_over > 400 else continued,
        "continued_rate_wrong_reading": continued,
    }


if __name__ == "__main__":
    print("categories", accounts_ending_balance_by_category())
    print("glidepath", glidepath())
    print("drift", drift())
    print("normalize", normalize())
    print("annuity", annuity())
    print("one_time", one_time())
    print("debt", debt_service())
    print("goals", one_time_goals())
    print("property", property_costs())
    print("bisection", bisection())
    print("deltas", estate_deltas())
    print("tips", tips())
    print("aca", aca())
