---
name: verify
description: Run the full verification loop for Đảo Đèn Lồng (unit tests, headless build, determinism, exit codes, per-feature scenarios, FPS) and store evidence in docs/proof. Use before every commit that changes gameplay, and always before tagging a phase.
---

# Verify skill

Use this whenever code under `src/sim`, `src/headless`, `scripts/`, `game.contract.json` or the GUI changes the observable behaviour. Current scope is **Test Contract v1.1** (Phase 2, three nights).

## Steps

1. Run `npm run verify -- phase-2` (or the phase you are tagging). It does all of the following:
   - `npm test` (30 unit tests, including `tuning` ↔ `game.contract.json` sync)
   - `npm run typecheck` and a `dist/headless.mjs` build
   - replays `scenario-features.json` + `inputs-features.json` twice and compares sha256
   - replays the Phase 1 regression pair `scenario-basic.json` + `walk.json` twice (standard numbers: 60 ticks = 1 s, 6 m/s, pickup, `no_flames`)
   - runs one headless scenario per new feature: drifter, charm, fall, night-3 wind/wind, shade spawn, `--night 2`
   - checks snapshot v1.1 fields, event names/ticks, pause freeze, exit codes (0/1/2) and a full 21600-tick night ≤ 30 s
   - reads `docs/proof/phase-2/fps.txt` produced by `npm run fps` and requires ≥ 30 FPS at 1280×720
   - writes `docs/proof/phase-N/summary.md`, `tests.txt`, `determinism.txt`, `events.jsonl`, `regression.jsonl`
2. Read the generated `summary.md`. Every row must say `đạt`. If determinism is not `identical: **true**`, an exit code differs, or any new event is missing, fix the code or the fixture — do **not** weaken the check.
3. For every new contract event or scenario field, add a matching row in `scripts/verify.mjs` **before** adding the implementation. The table in `summary.md` is generated from those rows; do not hand-edit it.
4. If a requirement is not met, write `chưa đạt` and the reason. Never mark it as passing.
5. Run `npm run fps` separately when GUI performance changed (needs Chrome/Edge). It starts Vite, forces a 1280×720 viewport over CDP and writes the measured `requestAnimationFrame` rate. A missing browser is recorded honestly, never fabricated.

## Adding a scenario

Put the JSON under `tests/fixtures/` and add a `fixtureRun(...)` call in `scripts/verify.mjs` with at least one `check(...)` on an event or snapshot field it must produce. To inspect by hand:

```bash
npm run build:headless
node dist/headless.mjs --seed 7 --night 2 --scenario tests/fixtures/<name>.json \
  --inputs tests/fixtures/<inputs>.json --ticks 600 --snapshot-every 10 --out .tmp/<name>.jsonl
```

Keep both the fixture and the relevant output/excerpt next to the phase evidence so the grader can replay it at the tag. `--night` must be 1, 2 or 3; malformed JSON exits 2, missing files exit 1.

## Contract traps (v1.1)

- `player.invuln` is **ticks**; `player.vel` is `[vx, vy, vz]`.
- `dash`/`pause` are edge-triggered; paused ticks advance `tick` but freeze `sim_tick`.
- `per_mote` score lands on **deposit**, not pickup.
- `scenario.time_left_s` overrides the night duration — use `world.duration`.
- Shade states: `spawning|wander|chase|recoil|stunned`. New events include `dash`, `drifter_drop`, `night_start`, `paused`, `resumed`.
