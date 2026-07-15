param(
    [ValidateSet('DryRun','Execute','Rollback')]
    [string]$Mode = 'DryRun',

    [string]$SourceRoot = (Join-Path $PSScriptRoot '..\..\frontend\src\assets\Excerises'),
    [string]$TargetRoot = (Join-Path $PSScriptRoot '..\AWS-S3-CONTENT\APP\exercise-library'),
    [string]$MappingFile = (Join-Path $PSScriptRoot '..\AWS-S3-CONTENT\TEST\exercise-content-migration\last-plan.json'),
    [string]$AuditCsv = (Join-Path $PSScriptRoot '..\AWS-S3-CONTENT\TEST\exercise-content-migration\powershell-audit.csv'),
    [string]$ManifestPath = (Join-Path $PSScriptRoot '..\AWS-S3-CONTENT\TEST\exercise-content-migration\powershell-manifest.json'),
    [switch]$AllowDelete
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Normalize-LegacyRelativePath {
    param([string]$InputPath)
    if ([string]::IsNullOrWhiteSpace($InputPath)) {
        return ''
    }

    $normalized = $InputPath.Trim().Replace('\\', '/')
    $prefixes = @('/assets/Excerises/', 'assets/Excerises/', '/assets/Exercises/', 'assets/Exercises/')

    foreach ($prefix in $prefixes) {
        if ($normalized.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $normalized.Substring($prefix.Length)
        }
    }

    return $normalized.TrimStart('/')
}

function Import-MappingData {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Mapping file not found: $Path"
    }

    $ext = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
    if ($ext -eq '.csv') {
        return Import-Csv -LiteralPath $Path
    }

    if ($ext -eq '.json') {
        $json = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
        if ($json.entries) {
            return $json.entries
        }
        return $json
    }

    throw "Unsupported mapping format. Use CSV or JSON. File: $Path"
}

function Resolve-SourceFiles {
    param(
        [object]$Record,
        [string]$Root
    )

    $results = @()
    $seen = New-Object System.Collections.Generic.HashSet[string]

    if ($Record.images) {
        foreach ($img in $Record.images) {
            if ($img.sourceAbsolute -and (Test-Path -LiteralPath $img.sourceAbsolute)) {
                if ($seen.Add($img.sourceAbsolute)) {
                    $results += $img.sourceAbsolute
                }
            }
        }
    }

    if ($Record.OldPath) {
        $relative = Normalize-LegacyRelativePath -InputPath $Record.OldPath
        if ($relative) {
            $candidate = Join-Path $Root $relative
            if ((Test-Path -LiteralPath $candidate) -and $seen.Add($candidate)) {
                $results += $candidate
            }
        }
    }

    if ($results.Count -eq 0 -and $Record.ExerciseTitle) {
        $folder = ($Record.ExerciseTitle.ToString() -replace '\s+', '_' -replace '[^a-zA-Z0-9_-]', '')
        $folderPath = Join-Path $Root $folder
        if (Test-Path -LiteralPath $folderPath) {
            Get-ChildItem -LiteralPath $folderPath -File | Where-Object { $_.Extension -match '^\.(jpg|jpeg|png|gif|webp)$' } |
                Sort-Object Name |
                ForEach-Object {
                    if ($seen.Add($_.FullName)) {
                        $results += $_.FullName
                    }
                }
        }
    }

    return $results
}

function Export-Audit {
    param(
        [array]$Rows,
        [string]$Path
    )

    $dir = Split-Path -Parent $Path
    Ensure-Directory -Path $dir
    $Rows | Export-Csv -LiteralPath $Path -NoTypeInformation -Encoding UTF8
}

$records = Import-MappingData -Path $MappingFile
if (-not $records) {
    throw 'No mapping records found.'
}

$audit = @()
$manifest = [ordered]@{
    generatedAt = (Get-Date).ToString('o')
    mode = $Mode
    sourceRoot = (Resolve-Path -LiteralPath $SourceRoot).Path
    targetRoot = (Resolve-Path -LiteralPath (Split-Path -Parent $TargetRoot)).Path
    copies = @()
}

if ($Mode -eq 'Rollback') {
    if (-not (Test-Path -LiteralPath $ManifestPath)) {
        throw "Rollback manifest not found: $ManifestPath"
    }

    $rollbackManifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
    foreach ($copy in $rollbackManifest.copies) {
        $status = 'SKIPPED'
        if (-not $AllowDelete) {
            $status = 'SKIPPED_ALLOWDELETE_REQUIRED'
        } elseif (Test-Path -LiteralPath $copy.target) {
            Remove-Item -LiteralPath $copy.target -Force
            $status = 'DELETED'
        }

        $audit += [pscustomobject]@{
            ExerciseID = $copy.exerciseId
            ExerciseTitle = $copy.exerciseTitle
            OldPath = $copy.source
            NewPath = $copy.target
            Status = $status
        }
    }

    Export-Audit -Rows $audit -Path $AuditCsv
    Write-Host "Rollback complete. Rows: $($audit.Count). Audit: $AuditCsv"
    if (-not $AllowDelete) {
        Write-Host 'No files were deleted because -AllowDelete was not set.'
    }
    return
}

Ensure-Directory -Path $TargetRoot

foreach ($record in $records) {
    $exerciseId = [int]($record.ExerciseID ?? $record.exerciseId)
    $exerciseTitle = [string]($record.ExerciseTitle ?? $record.exerciseTitle)
    if ($exerciseId -le 0) {
        continue
    }

    $sourceFiles = Resolve-SourceFiles -Record $record -Root $SourceRoot
    if ($sourceFiles.Count -eq 0) {
        $audit += [pscustomobject]@{
            ExerciseID = $exerciseId
            ExerciseTitle = $exerciseTitle
            OldPath = [string]($record.OldPath ?? $record.oldPath)
            NewPath = ''
            Status = 'NO_SOURCE'
        }
        continue
    }

    $imageTargetDir = Join-Path (Join-Path $TargetRoot $exerciseId) 'images'
    if ($Mode -eq 'Execute') {
        Ensure-Directory -Path $imageTargetDir
    }

    $index = 1
    foreach ($source in $sourceFiles) {
        $ext = [System.IO.Path]::GetExtension($source)
        if ([string]::IsNullOrWhiteSpace($ext)) { $ext = '.jpg' }
        $newName = "$index$ext"
        $target = Join-Path $imageTargetDir $newName
        $relativeTarget = "APP/exercise-library/$exerciseId/images/$newName"

        $status = 'DRY_RUN'
        if ($Mode -eq 'Execute') {
            Copy-Item -LiteralPath $source -Destination $target -Force
            $status = 'COPIED'
            $manifest.copies += [pscustomobject]@{
                exerciseId = $exerciseId
                exerciseTitle = $exerciseTitle
                source = $source
                target = $target
            }
        }

        $audit += [pscustomobject]@{
            ExerciseID = $exerciseId
            ExerciseTitle = $exerciseTitle
            OldPath = $source
            NewPath = $relativeTarget
            Status = $status
        }

        $index++
    }
}

Export-Audit -Rows $audit -Path $AuditCsv

if ($Mode -eq 'Execute') {
    $manifestDir = Split-Path -Parent $ManifestPath
    Ensure-Directory -Path $manifestDir
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ManifestPath -Encoding UTF8
}

Write-Host "Mode: $Mode"
Write-Host "Total Audit Rows: $($audit.Count)"
Write-Host "Audit Report: $AuditCsv"
if ($Mode -eq 'Execute') {
    Write-Host "Manifest: $ManifestPath"
}
