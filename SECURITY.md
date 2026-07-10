# Security Policy

## Supported Versions

RetireGolden is under active development. Security fixes are applied to the latest code on the `main` branch and deployed from there.

| Version | Supported |
| ------- | --------- |
| Latest on `main` | :white_check_mark: |
| Older commits or unmaintained forks | :x: |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report security issues privately:

1. Go to the [Security](https://github.com/FlyOverCoderKY/RetireGolden/security) tab of this repository.
2. Click **Report a vulnerability** (GitHub private vulnerability reporting).

Include:

- A clear description of the issue and impact
- Steps to reproduce (URLs, browser version, sample input if relevant)
- Any proof-of-concept you are comfortable sharing

We will acknowledge your report within **7 business days** and work with you on validation and disclosure timing.

## Scope

**In scope**

- Cross-site scripting (XSS) or other client-side code execution
- Unsafe handling of user-supplied data (e.g. imported plan files)
- Issues in this repository’s application code or deployment configuration
- Privacy or integrity issues affecting data stored locally in the browser

**Out of scope**

- Incorrect financial, tax, or Social Security calculations (please use a regular issue)
- Issues in third-party services or dependencies without a practical fix in this repo
- Denial-of-service against the static site itself

## Safe Harbor

We support good-faith security research on this project. We will not pursue legal action against researchers who follow this policy and avoid privacy violations, data destruction, or disruption of our services.
