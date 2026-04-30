# Security Policy

## Supported Versions

Only the latest release is actively maintained. Please upgrade before reporting.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Use GitHub's [private vulnerability reporting](https://github.com/ITSWEBER-OFFICIAL/itsweber-mesh/security/advisories/new)
to send an encrypted, private report to the maintainers.

Alternative: email `support@itsweber.de` and use **"SECURITY:"** as the
subject prefix so we route it to the right channel.

Include:
- Description of the vulnerability
- Steps to reproduce or proof-of-concept
- Potential impact
- Your contact for follow-up

You will receive an acknowledgement within 72 hours and a resolution timeline within 7 days.

## Scope

- Authentication bypass or privilege escalation
- Stored/reflected XSS
- Remote code execution
- Path traversal / arbitrary file read/write
- Sensitive data exposure

Out of scope: rate limiting, self-XSS, issues requiring physical access, vulnerabilities in dependencies (report those upstream).

## Disclosure

We follow coordinated disclosure: fixes are released before public disclosure. Credit is given to reporters unless anonymity is requested.
