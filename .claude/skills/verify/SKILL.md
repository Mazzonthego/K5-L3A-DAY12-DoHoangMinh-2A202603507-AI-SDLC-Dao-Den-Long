---
name: verify
description: Run the full verification loop for Đảo Đèn Lồng (unit tests, headless build, determinism, exit codes) and store evidence in docs/proof. Use before every commit that changes gameplay, and always before tagging a phase.
---

# Verify skill

Use this whenever code under `src/sim`, `src/headless` or `game.contract.json` changes.

## Steps

1. Run `npm run verify`. It does all of the following:
   - `npm test` (unit tests, contract tuning sync)
   - builds `dist/headless.mjs`
   - replays `tests/fixtures/scenario-basic.json` + `walk.json` twice and compares sha256
   - checks that malformed inputs exit with code 2
   - writes `docs/proof/phase-N/summary.md`, `tests.txt`, `determinism.txt`
2. Read the generated `summary.md`. If any line is not `identical: **true**` or the exit code is not 2, fix the code — do not weaken the check.
3. Add a row to the evidence table in `docs/proof/phase-N/summary.md` for each new requirement: requirement → how it was checked → result.
4. If a requirement is not met, write `chưa đạt` and the reason. Never mark it as passing.

## Adding a scenario

Put the JSON under `tests/fixtures/`, run:

```bash
node dist/headless.mjs --seed 7 --night 1 --scenario tests/fixtures/<name>.json \
  --ticks 600 --snapshot-every 60 --out .tmp/<name>.jsonl
```

Keep the fixture and its output next to the phase evidence so the grader can replay it at the tag.
