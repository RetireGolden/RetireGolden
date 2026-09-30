"""Independent recomputation of the twelve worksheets. Imports nothing from the repository."""

import math
from decimal import Decimal, getcontext

getcontext().prec = 80


def imul(a: int, b: int) -> int:
    """Math.imul: low 32 bits of a signed 32-bit multiply, returned as a signed int32."""
    a &= 0xFFFFFFFF
    b &= 0xFFFFFFFF
    if a >= 0x80000000:
        a -= 0x100000000
    if b >= 0x80000000:
        b -= 0x100000000
    prod = (a * b) & 0xFFFFFFFF
    if prod >= 0x80000000:
        prod -= 0x100000000
    return prod


def u32(x: int) -> int:
    return x & 0xFFFFFFFF


def derive(seed: int, path_index: int) -> tuple[int, int, int, int]:
    h0 = u32(seed ^ u32(imul(path_index + 1, 0x9E3779B9)))
    h1 = u32(imul(h0 ^ (h0 >> 16), 0x21F0AAAD))
    h2 = u32(imul(h1 ^ (h1 >> 15), 0x735A2D97))
    result = u32(h2 ^ (h2 >> 15))
    return h0, h1, h2, result


def main() -> None:
    print("aca credit", Decimal(12000) - Decimal("2791.80"))
    print("aca net", Decimal(10000) - Decimal("9208.20"))
    print("part B", Decimal("202.90") * 12)
    print("ratio", Decimal(59000) / Decimal(70000))
    print("float ratio", 59000 / 70000)

    l22 = (Decimal(1) - Decimal("0.5") ** 2).sqrt()
    print("L22", l22)
    print("L22 diff", abs(l22 - Decimal("0.866025403784439")))

    r = 1 - 1e-13
    pivot = 1 - r * r
    print("near pivot", pivot, pivot == 2.000621890374532e-13)
    print("near L22", math.sqrt(pivot), math.sqrt(pivot) == 4.4728311955343587e-7)

    expected = {
        (42, 7): 1351098177,
        (42, 8): 2450979136,
        (1, 0): 3950124170,
    }
    for (seed, index), want in expected.items():
        words = derive(seed, index)
        print((seed, index), [hex(w) for w in words], words[-1] == want)


if __name__ == "__main__":
    main()
