## 3. Social Security benefit taxation

Provisional income = AGI (excl. SS) + tax-exempt interest + excluded foreign earned income + 50% of SS benefits.

| Filing | 50% tier begins | 85% tier begins |
|--------|-----------------|-----------------|
| Single | $25,000 | $34,000 |
| MFJ | $32,000 | $44,000 |

Maximum 85% of benefits taxable; thresholds are **statutorily unindexed** (more benefits become taxable over time — model this, don't index it). The exact calculator follows the two-tier formula (`irc-86-a-taxable-social-security-two-tier`). The optimizer's in-solve proxy is a disclosed approximation (`irc-86-a-optimizer-taxable-social-security-linearization`, approximated / `bothDirections`): it omits the half-benefit plateau and the 85-percent-of-benefits cap, and it freezes a baseline already at or above 84.5% of benefits, so modeled inclusion can miss in either direction. See [optimizer.md](../../features/optimizer.md). The OBBBA senior deduction does **not** change SS taxation itself, despite popular framing.
