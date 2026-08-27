@echo off
cd /d "C:\Users\Nathan\source\repos\RetireGolden\.claude\worktrees\gtc-phase-ws4a"
python _move_batch_bc.py
if errorlevel 1 exit /b 1
corepack enable
pnpm --filter @retiregolden/engine exec vitest run src/tax/stateTax.rules.test.ts src/rules/approximations/stateTax.approximation.test.ts src/rules/taxRuleRegistry.conformance.test.ts
pnpm --filter @retiregolden/engine exec tsc --noEmit
