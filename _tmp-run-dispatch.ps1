$ErrorActionPreference = 'Stop'
$root = 'C:\Users\Nathan\source\repos\RetireGolden\.claude\worktrees\gtc-phase-ws3'
Set-Location $root

function Run-Cmd($label, $args) {
  Write-Output "===== $label ====="
  $outFile = Join-Path $env:TEMP "dispatch-$label.out.txt"
  $errFile = Join-Path $env:TEMP "dispatch-$label.err.txt"
  & node packages/engine/scripts/rules-dispatch.mjs @args 1> $outFile 2> $errFile
  $code = $LASTEXITCODE
  Write-Output "EXIT_CODE: $code"
  Write-Output "--- STDOUT ---"
  if (Test-Path $outFile) { Get-Content -Raw $outFile }
  Write-Output "--- STDERR ---"
  if (Test-Path $errFile) { Get-Content -Raw $errFile }
}

Run-Cmd '1' @('--rule', 'irc-4974-rmd-shortfall-excise-tax')
Run-Cmd '2' @('--rule', 'irc-223-f-4-B-hsa-death-exception')
Run-Cmd '3' @('--due', '--as-of', '2027-09-01')

New-Item -ItemType Directory -Force -Path 'C:\TEMP\claude-handoffs' | Out-Null
Run-Cmd '4' @('--due', '--as-of', '2027-09-01', '--out', 'C:\TEMP\claude-handoffs\test.md', '--chunk-size', '8')
$files = Get-ChildItem 'C:\TEMP\claude-handoffs\test-*.md' | Sort-Object Name
Write-Output "===== COMMAND 4 FILE COUNT ====="
Write-Output $files.Count
Write-Output "===== COMMAND 4 FIRST FILE FIRST 5 LINES ====="
if ($files.Count -gt 0) { Get-Content $files[0].FullName -TotalCount 5 }
