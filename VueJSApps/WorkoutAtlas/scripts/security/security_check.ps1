param([switch]$StagedOnly)

$ErrorActionPreference = 'Stop'
$critical = @()

$localOnly = @('.local-only/','.artifacts/','docs-private/','Documents/','backend/.env','frontend/.env','frontend/.env.local')

if ($StagedOnly) {
  $paths = @(git diff --cached --name-only --diff-filter=ACMR)
} else {
  $paths = @()
  $paths += @(git diff --cached --name-only --diff-filter=ACMR)
  $paths += @(git rev-list origin/BETA..HEAD | ForEach-Object { git diff-tree --no-commit-id --name-only -r $_ })
  $paths = @($paths | Sort-Object -Unique)
}

foreach ($path in $paths) {
  foreach ($blocked in $localOnly) {
    if (($path -like "$blocked*") -or ($path -eq $blocked)) {
      $critical += "LOCAL_ONLY_PATH=$path"
    }
  }
  if ($path -match '\.(env($|\.)|pem$|p12$|pfx$|key$|log$|dump$|bak$)$' -and $path -notmatch '\.env(?:\.[^/]+)?\.example$') {
    $critical += "SENSITIVE_PATH=$path"
  }
}

foreach ($signature in @('C:\\Users\\','65\.181\.116\.252','BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY','gh[pousr]_[A-Za-z0-9]{20,}','AKIA[A-Z0-9]{16}')) {
  $matches = @()
  if ($StagedOnly) {
    $matches = @(git diff --cached --unified=0 | Select-String -Pattern '^\+' | Select-String -Pattern $signature -AllMatches)
  } else {
    $matches = @(git log -p origin/BETA..HEAD -- . | Select-String -Pattern '^\+' | Select-String -Pattern $signature -AllMatches)
  }
  if ($matches.Count) { $critical += "SENSITIVE_PATTERN_SIGNATURE=$signature" }
}

if ($critical.Count) {
  $critical | ForEach-Object { Write-Error $_ }
  exit 1
}

Write-Output 'SECURITY_GATE_PASS'
