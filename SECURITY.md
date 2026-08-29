# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in OphirPay, please **do not** open a public issue.

Instead, email **security@ophirpay.com** with:
- A description of the vulnerability
- Steps to reproduce
- Affected versions
- Any potential mitigations

We will respond within 48 hours and work with you on a fix.

## Responsible Disclosure Process

### Step 1: Report the Vulnerability

Email **security@ophirpay.com** with the following information:

- **Subject**: `[SECURITY] Brief description of the vulnerability`
- **Body**:
  - Description of the vulnerability
  - Steps to reproduce (include URLs, endpoints, and request/response examples if applicable)
  - Affected versions (check `package.json` or `Cargo.toml`)
  - Potential impact (what an attacker could achieve)
  - Any suggested mitigations (if you have them)
  - Your preferred contact method for follow-up questions

### Step 2: Acknowledgment

We will acknowledge receipt of your report within **48 hours** via email.

### Step 3: Validation

Our security team will validate the vulnerability within **5 business days**. We may contact you for additional details or clarification.

### Step 4: Resolution

Once validated, we will:
- Develop and test a fix
- Deploy the fix to production
- Publish a security advisory on GitHub
- Credit you in the advisory (unless you prefer anonymity)

### Step 5: Reward

If eligible, you will receive a reward based on the severity of the vulnerability (see Bug Bounty Program below).

## Security.txt

OphirPay publishes a `security.txt` file at `/.well-known/security.txt` following the [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) standard. This file provides security researchers with contact information and disclosure policies.

The file is accessible at:
- **Production**: https://ophirpay.vercel.app/.well-known/security.txt
- **Repository**: https://github.com/OphirPay/OphirPay/blob/main/.well-known/security.txt

## Security Best Practices

### For Users
- OphirPay never stores private keys — all signing happens client-side via Freighter
- Always verify the destination address before signing
- Check transaction details in Freighter before approving
- Use a hardware wallet for production/mainnet operations
- Never share your wallet seed phrase or private keys

### For Developers
- Run `npm audit` regularly to check for dependency vulnerabilities
- Keep all dependencies up to date
- Review PRs for security implications
- Never commit secrets or API keys
- Use environment variables for all sensitive configuration
- Follow the principle of least privilege
- Validate all user inputs server-side

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | ✅ Active (current)|
| 0.1.x   | ⚠️ Security patches only |

## Bug Bounty Program

OphirPay offers rewards for responsibly disclosed vulnerabilities:

| Severity | Reward | Examples |
|---|---|---|
| **Critical** (9.0-10.0) | Up to $5,000 | Fund drainage, unauthorized admin takeover, key extraction |
| **High** (7.0-8.9) | Up to $2,000 | Reentrancy, signature bypass, privilege escalation |
| **Medium** (4.0-6.9) | Up to $500 | CSRF on sensitive endpoints, information disclosure, DoS |
| **Low** (0.1-3.9) | Swag + recognition | Minor issues, defense-in-depth improvements |

### Scope

- Smart contracts: `contracts/ophirpay/src/lib.rs`, `contracts/emitter/src/lib.rs`
- API routes: `src/app/api/**/route.ts`
- Authentication: Wallet session auth, API key auth
- Webhook system: URL validation, HMAC signing, SSRF prevention
- Infrastructure: Dockerfile, Kubernetes manifests, Helm chart
- Frontend: Next.js application, wallet integration

### Out of Scope

- Denial of service attacks against the infrastructure
- Social engineering attacks
- Attacks requiring physical access to user devices
- Issues in third-party dependencies (report these to the respective maintainers)
- Issues already reported by someone else

### Rules

1. **Do not** exploit the vulnerability beyond what is necessary to demonstrate it
2. **Do not** access, modify, or delete other users' data
3. **Do not** disrupt the live service (ophirpay.vercel.app)
4. **Do not** disclose the vulnerability publicly before it is resolved
5. Provide a clear proof-of-concept with steps to reproduce
6. Report vulnerabilities in good faith

### Process

1. Email **security@ophirpay.com** with your report
2. We acknowledge within 48 hours
3. We validate and determine severity within 5 business days
4. We ship a fix and publish an advisory
5. You receive credit in the advisory + reward

> Payouts are in XLM or USDC on Stellar. We follow [CVSS v3.1](https://www.first.org/cvss/v3.1/specification-document) scoring.

## Security Headers

OphirPay implements the following security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-XSS-Protection: 1; mode=block`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## Smart Contract Security

- All contract functions use proper access control
- Cross-contract calls are validated
- Contracts use Result types for error handling
- Timestamps and metadata are recorded for audit trails
- Reentrancy guards protect all token transfer paths
- Emergency pause functionality available for circuit breaking

## Web & API Security

- CSRF protection with double-submit cookie pattern
- HMAC-SHA256 signed session cookies
- API keys hashed at rest with SHA-256
- SSRF protection for webhook URLs
- Input validation with Zod schemas
- Rate limiting (120 RPM default)
- CSP headers with Stellar-only connect-src

## Dependency Vulnerability Policy

OphirPay runs an automated dependency vulnerability scan that **fails the build** on advisories rated **high or critical**.

### How the scan works

- Runs on **every pull request** and on a **nightly schedule** (`.github/workflows/dependency-scan.yml`), plus on demand via `workflow_dispatch`.
- Uses `npm audit --json` via `scripts/audit-dependencies.mjs`.
- Uploads the full audit report (`dependency-audit-report/`) as a CI artifact on every run — including passes — so findings are reviewable.
- Fails (exit 1) when any **un-suppressed** advisory is at/above `AUDIT_FAIL_ON` (default `high`, i.e. high + critical).
- Treats an un-scannable dependency tree (registry outage, malformed output) as a **scan failure** — a broken scan must not silently pass.

### When a suppression is acceptable

A maintainer may document an **accepted risk** by adding an entry to `.github/dependency-suppressions.json`. Suppressions are only acceptable when **all** of the following hold:

1. **No fix is available** — the vulnerable package has no patched release, and no compatible upgrade path exists (e.g. the maintainer still pins the vulnerable range).
2. **Limited exposure** — the vulnerable code path is dev-only tooling (e.g. the Prisma CLI) or otherwise not reachable from the app runtime / production attack surface.
3. **Justified and tracked** — the entry records a reason, an expiry date, and a tracking link (advisory URL).
4. **Reviewed** — the entry is added by a maintainer in a reviewed PR, not silently.

Suppressions are **temporary**: the policy is to re-check each suppressed advisory when it expires (or when a fix ships upstream) and upgrade then. New advisories are **never** suppressed by an existing entry — each finding must be covered by its own entry.

### Running the scan locally

```bash
npm ci
node scripts/audit-dependencies.mjs           # fails on high/critical (default)
AUDIT_FAIL_ON=critical node scripts/audit-dependencies.mjs   # critical only
```

The JSON report lands in `dependency-audit-report/`.

## Contact Information

- **Security Email**: security@ophirpay.com
- **GitHub Issues**: For non-security bugs only
- **General Questions**: GitHub Discussions

## Legal

We will not take legal action against researchers who follow this responsible disclosure policy. We consider security research conducted in accordance with this policy to be authorized and will not pursue legal action for accidental, good-faith violations.

---

Last updated: August 2026
