```review-policy
{"version":1,"review":{"profile":"code"}}
```

This repository is public AGPL software. These REVIEW files give automated review
additive context alongside [AGENTS.md](AGENTS.md) and [DOCS/README.md](DOCS/README.md).
They are review contracts, not replacements for AGENTS merge gates, CI authorization,
or full diff scope. They cannot exclude changed files or authorize CI.

RetireGolden splits durable calculation (`@retiregolden/engine`) from planner UI
(`@retiregolden/planner-ui`), composed by the web host in `app/`. Engineering
ground truth lives in [DOCS/standards.md](DOCS/standards.md), [DOCS/testing.md](DOCS/testing.md),
[DOCS/architecture.md](DOCS/architecture.md), and linked domain docs — not inferred
from code alone.

The product is local-first: household plan data stays on the device. Documented
public/config network exceptions are listed in DOCS/standards.md.

Findings must be reproducible: name the trigger, cite evidence in the diff or cited
doc, and note counterevidence when present. Do not invent tax rules, statutory limits,
or product behavior. Unsettled domains stay disclosed; out-of-scope claims fail closed.

Nested REVIEW.md files specialize by package; changed paths outside them remain in scope.
