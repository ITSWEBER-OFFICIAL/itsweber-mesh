# Contributing to ITSWEBER Mesh

Thanks for your interest! This is a single-maintainer project at the moment,
but issues, bug reports and well-scoped PRs are very welcome.

## Reporting bugs

Open an issue with:

- **Browser + OS** (e.g. Firefox 134 on Windows 11)
- **Container version** (visible in *Admin → About* or via `docker inspect`)
- **Steps to reproduce** — the more concrete, the faster a fix
- **Relevant logs** — `docker logs itsweber-mesh --tail 100`. Redact tokens / IPs
- **Screenshot** if it's a UI issue

Please **don't include real secrets** (API keys, OAuth client secrets, your
domain config). The maintainer will not look at PII even if you send it.

## Suggesting features

Open an issue with the `enhancement` label. Describe the use case first, the
proposed UI second. Features that work for an unconfigured fresh install are
prioritised; features that hard-code one specific user's setup are usually
declined.

## Pull requests

Before opening a PR, please:

1. **Run the quality gates** — `pnpm typecheck && pnpm test` must be green
2. **Match the existing style** — TypeScript strict, no inline styles where a
   class works, Radix Dialog for any modal
3. **Update the schema migration chain** if you touch `config.json` shape —
   add a `migrateV{N}ToV{N+1}` function and bump `CURRENT_VERSION`
4. **Keep PRs small and focused** — feature × refactor × docs in separate PRs
5. **Write a clear commit message** with the *why*, not just the *what*

For non-trivial changes, please open an issue first to align on the approach.

## Local development

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm typecheck
pnpm test
```

Config lives in `./data/config.json` during local dev (gitignored). On first
run the wizard creates `auth.users[]` — pick "open" auth mode initially to
avoid being locked out, then switch to a stricter mode once you've logged in.

## Code of conduct

Be kind, be specific, prefer "the code does X" over "you wrote X". Keep
discussions focused on the project. The maintainer reserves the right to
close off-topic or hostile threads without warning.

## License

By contributing, you agree that your contributions will be licensed under
the project's [GNU Affero General Public License v3.0](LICENSE).

This is the same license the project itself uses. AGPL-3.0 is a strong
copyleft license: anyone running a modified version as a network service
must publish their modifications under the same license. Self-hosting for
personal or internal use does not trigger this requirement.
