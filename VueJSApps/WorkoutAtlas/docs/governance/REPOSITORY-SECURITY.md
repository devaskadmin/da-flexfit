# WorkoutAtlas Repository Security and Publication Policy

## Information classifications

- **PUBLIC / SHAREABLE:** sanitized application source, architecture, API contracts, standards, prompts, schemas, release procedures, and GitLab templates.
- **INTERNAL / LOCAL ONLY:** private topology, hostnames, private IPs, local paths, confidential operations, private runbooks, incident details, and QA artifacts.
- **SECRET — RESTRICTED:** passwords, tokens, API keys, HMAC/session/OAuth secrets, database credentials, certificates, recovery codes, and cookies.

## Local-only storage

Confidential local records belong under `.local-only/` and are excluded from Git. `.local-only/` is not encrypted or otherwise protected merely by Gitignore; filesystem permissions must restrict access.

## Environment conventions

- Commit only `.env.example` or `.env.*.example` files with placeholders.
- Never commit real `.env`, `.env.local`, private certificates, or secret-bearing overrides.
- Public frontend variables must not contain secrets because browser builds expose them.

## Commit and push review

Before committing:

- Review staged paths and diffs.
- Verify local-only paths are excluded.
- Scan staged content for secret signatures and private paths.
- Confirm sanitized shareable documentation.

Before pushing:

- Explicit user authorization is mandatory.
- Review every unpublished commit.
- Pass local secret-pattern and local-only-path checks.
- Remediate unresolved critical findings.
- Rotate credentials that may have been exposed.

Passing tests or a clean working tree does not establish publication safety.

## GitLab compatibility

Future GitLab publication must use the same classifications, branch protection, review gates, secret scanning, and local-only exclusions.

## Incident response

- Stop publication attempts.
- Revoke or rotate exposed credentials.
- Record affected commits and paths without copying secret values.
- Obtain approval before history rewriting or force-push remediation.
