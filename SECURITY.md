# Security Policy

## Reporting a Vulnerability

If you believe you've found a security vulnerability in cmail, please **do not** open a public GitHub issue.

Instead, report it privately by emailing the maintainer at the address listed on the [project's GitHub profile](https://github.com/choyiny), or by opening a [private security advisory](https://github.com/choyiny/cmail/security/advisories/new) on the repository.

Please include:

- A description of the issue and its potential impact
- Steps to reproduce (proof-of-concept, affected endpoints, sample payloads)
- Your suggested remediation, if any

You can expect an initial response within a few business days. Fixes for confirmed vulnerabilities will be coordinated privately and released alongside a public advisory once a patch is available.

## Scope

In scope:

- The cmail worker (`worker/`)
- The web UI (`src/`)
- The deployment templates (`wrangler.jsonc.example`, `.dev.vars.example`)

Out of scope:

- Vulnerabilities in upstream dependencies (please report those to the respective projects)
- Misconfiguration of a self-hosted instance (e.g., missing `BETTER_AUTH_SECRET`, exposed secrets, unrestricted email routing)

## Supported Versions

cmail is distributed as source. Security fixes land on `main`. Deployers are responsible for pulling updates and redeploying their own instance.
