$file = "C:\Users\stephen.karpathakis\Documents\VisualStudio-Workspace\Dev Asterisks Github - StephenK\VueJSApps\FlexFit\frontend\src\views\Member\exercises.vue"
$lines = Get-Content $file -Encoding UTF8
"Total lines: $($lines.Count)" | Out-File "C:\Users\stephen.karpathakis\Documents\VisualStudio-Workspace\Dev Asterisks Github - StephenK\VueJSApps\FlexFit\patch_log.txt"

# Find key anchor lines
$idx991Start = -1
$idx991End = -1
$idx768Start = -1
$idx768End = -1
$idx480Start = -1

for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "RESPONSIVE.*991px" ) { $idx991Start = $i }
    if ($lines[$i] -match "RESPONSIVE.*768px" ) { $idx768Start = $i }
    if ($lines[$i] -match "RESPONSIVE.*480px" ) { $idx480Start = $i }
}
"991px comment at: $($idx991Start+1)" | Out-File "C:\Users\stephen.karpathakis\Documents\VisualStudio-Workspace\Dev Asterisks Github - StephenK\VueJSApps\FlexFit\patch_log.txt" -Append
"768px comment at: $($idx768Start+1)" | Out-File "C:\Users\stephen.karpathakis\Documents\VisualStudio-Workspace\Dev Asterisks Github - StephenK\VueJSApps\FlexFit\patch_log.txt" -Append
"480px comment at: $($idx480Start+1)" | Out-File "C:\Users\stephen.karpathakis\Documents\VisualStudio-Workspace\Dev Asterisks Github - StephenK\VueJSApps\FlexFit\patch_log.txt" -Append

# Find .exercise-row within 991px block (first occurrence after idx991Start opening @media brace)
$exRow991 = -1
$exRow768 = -1
$exImg480 = -1
for ($i = $idx991Start; $i -lt $idx768Start; $i++) {
    if ($lines[$i] -match "^\s+\.exercise-row\s*\{" -and $exRow991 -eq -1) { $exRow991 = $i }
}
for ($i = $idx768Start; $i -lt $idx480Start; $i++) {
    if ($lines[$i] -match "^\s+\.exercise-row\s*\{" -and $exRow768 -eq -1) { $exRow768 = $i }
}
for ($i = $idx480Start; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^\s+\.exercise-img\s*\{" -and $exImg480 -eq -1) { $exImg480 = $i }
}

"991 exercise-row at: $($exRow991+1)" | Out-File "C:\Users\stephen.karpathakis\Documents\VisualStudio-Workspace\Dev Asterisks Github - StephenK\VueJSApps\FlexFit\patch_log.txt" -Append
"768 exercise-row at: $($exRow768+1)" | Out-File "C:\Users\stephen.karpathakis\Documents\VisualStudio-Workspace\Dev Asterisks Github - StephenK\VueJSApps\FlexFit\patch_log.txt" -Append
"480 exercise-img at: $($exImg480+1)" | Out-File "C:\Users\stephen.karpathakis\Documents\VisualStudio-Workspace\Dev Asterisks Github - StephenK\VueJSApps\FlexFit\patch_log.txt" -Append

# Find closing } of .exercise-actions .btn block after each exercise-row
function Find-BlockEnd {
    param($lines, $startIdx, $stopIdx)
    # find the last "  }" before stopIdx that closes exercise-actions .btn
    $last = -1
    for ($i = $startIdx; $i -lt $stopIdx; $i++) {
        if ($lines[$i] -match "^\s+\}" -and $i -gt $startIdx) { $last = $i }
        if ($lines[$i] -match "^\}" -and $i -gt $startIdx) { break }  # hit next @media
    }
    return $last
}

$end991 = Find-BlockEnd $lines $exRow991 $idx768Start
$end768 = Find-BlockEnd $lines $exRow768 $idx480Start
"991 block end at: $($end991+1)" | Out-File "C:\Users\stephen.karpathakis\Documents\VisualStudio-Workspace\Dev Asterisks Github - StephenK\VueJSApps\FlexFit\patch_log.txt" -Append
"768 block end at: $($end768+1)" | Out-File "C:\Users\stephen.karpathakis\Documents\VisualStudio-Workspace\Dev Asterisks Github - StephenK\VueJSApps\FlexFit\patch_log.txt" -Append

"Done scanning." | Out-File "C:\Users\stephen.karpathakis\Documents\VisualStudio-Workspace\Dev Asterisks Github - StephenK\VueJSApps\FlexFit\patch_log.txt" -Append
