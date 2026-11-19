# WorkoutAtlas Repository Security Gate

Run staged review locally:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/security/security_check.ps1 -StagedOnly
```

The gate checks staged or unpublished commit paths for local-only and secret-bearing patterns. It is defensive, not a guarantee that every secret is detectable.

No Gitleaks installation or external scan is required. If Gitleaks is later approved and installed, extend the gate with a local binary invocation only.
