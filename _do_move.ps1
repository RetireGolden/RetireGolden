Set-Location "C:\Users\Nathan\source\repos\RetireGolden\.claude\worktrees\gtc-phase-ws4a"
node _fix_move.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
node _move_batch_bc.js
exit $LASTEXITCODE
