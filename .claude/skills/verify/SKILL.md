---
name: verify
description: Run the full verification loop for Đảo Đèn Lồng (unit tests, headless build, determinism, exit codes, per-feature scenarios, bench/soak/export, FPS) and store evidence in docs/proof. Use before every commit that changes gameplay, and always before tagging a phase.
---

# Verify skill

Use this whenever code under `src/sim`, `src/headless`, `scripts/`, `src/leaderboard.ts`, `game.contract.json` or the GUI changes the observable behaviour. Current scope is **Test Contract v1.3** (Phase 4, release v1.0.0). v1.3 adds only `bench_cmd`/`soak_cmd` and a new `run_cmd`; all v1.0–v1.2 gameplay rules and headless bytes are unchanged.

## Steps

1. Run `npm run verify -- phase-4` (or the phase you are tagging). It does all of the following:
   - `npm test` (43 unit tests, including `tuning` ↔ `game.contract.json` sync and leaderboard rules)
   - `npm run typecheck`, a `dist/headless.mjs` build and a `dist/sim.mjs` build
   - replays `scenario-features.json` + `inputs-features.json` twice and compares sha256
   - replays the Phase 1 regression pair `scenario-basic.json` + `walk.json` twice (standard numbers: 60 ticks = 1 s, 6 m/s, pickup, `no_flames`)
   - runs one headless scenario per feature: drifter, charm, fall, night-3 wind, shade spawn, `--night 2`, plus v1.2 fuel/refuel/drain/relight/dawn/capacity
   - checks snapshot v1.2/v1.3 fields, event names/ticks, pause freeze, exit codes (0/1/2) and a full 21600-tick night ≤ 30 s
   - for phase-4 only: validates `bench.json` and `soak.json` produced by the real scripts (avg ≥ 60, p1 ≥ 30, load ≤ 10000 ms; 0 crashes, mem ≤ 1.2×), leaderboard export, accessibility hooks and packaging files
   - reads `docs/proof/phase-N/fps.txt` produced by `npm run fps -- phase-N` and requires ≥ 30 FPS at 1280×720
   - writes `docs/proof/phase-N/summary.md`, `tests.txt`, `determinism.txt`, `events.jsonl`, `regression.jsonl` (plus `bench.json`, `soak.json`, `leaderboard-export.json` at phase-4)
2. Read the generated `summary.md`. Every row must say `đạt`. If determinism is not `identical: **true**`, an exit code differs, or any new event is missing, fix the code or the fixture — do **not** weaken the check.
3. For every new contract event or scenario field, add a matching row in `scripts/verify.mjs` **before** adding the implementation. The table in `summary.md` is generated from those rows; do not hand-edit it.
4. If a requirement is not met, write `chưa đạt` and the reason. Never mark it as passing.
5. Run `npm run fps -- phase-N` separately when GUI performance changed (needs Chrome/Edge). It starts Vite, forces a 1280×720 viewport over CDP and writes the measured `requestAnimationFrame` rate. A missing browser is recorded honestly, never fabricated.
6. For phase-4, also run `npm run bench -- --seed 42 --duration 30 --out bench.json` and `npm run soak -- --seed 7 --nights 10 --out soak.json` before `verify`. Both scripts produce real measurements; `verify` only validates and copies them into the evidence folder. Never edit those numbers by hand.

## Adding a scenario

Put the JSON under `tests/fixtures/` and add a `fixtureRun(...)` call in `scripts/verify.mjs` with at least one `check(...)` on an event or snapshot field it must produce. To inspect by hand:

```bash
npm run build:headless
node dist/headless.mjs --seed 7 --night 2 --scenario tests/fixtures/<name>.json \
  --inputs tests/fixtures/<inputs>.json --ticks 600 --snapshot-every 10 --out .tmp/<name>.jsonl
```

Keep both the fixture and the relevant output/excerpt next to the phase evidence so the grader can replay it at the tag. `--night` must be 1, 2 or 3; malformed JSON exits 2, missing files exit 1.

## Contract traps (v1.2 gameplay, v1.3 release)

- `player.invuln` is **ticks**; `player.vel` is `[vx, vy, vz]`.
- `dash`/`pause` are edge-triggered; paused ticks advance `tick` but freeze `sim_tick`.
- `player.carried` is capped by `player.capacity = min(20, 10 + 2 × successful_lights)`.
- Fuel is an integer count of 1/60 units (`FUEL_MAX_UNITS = 6000`); decay and drain run in step 2, **before** interaction. A just-lit lamp is at 99,983 after one tick, so refuel uses 1 mote.
- `fuel < 30` removes the safe zone; exactly 30 still protects. `drain` only continues while the lamp is weak, within 2 m, and the player is outside 6 m.
- `scenario.time_left_s` overrides the night duration — use `world.duration`. Fixtures with an explicit 300 s keep the Phase 1 regression number 299.
- No early win: `dawn_survived` needs `ceil(0.6 × lantern count)` lit lamps at the final tick; `no_flames` always wins over dawn.
- Shade states: `spawning|wander|chase|recoil|stunned|drain`. New v1.2 events: `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit` carries `relight`.
- v1.3: `bench_cmd`/`soak_cmd` must exist and actually runnable; `run_cmd` is `node scripts/run.mjs`; `bench.json` records `peak_mem_mb: null` for web builds with a README explanation; 10 nights of soak must have `crashes = 0` and `mem_end_mb ≤ 1.2 × mem_start_mb`.
- Leaderboard names are 3–12 unicode letters/digits/underscore; top 10 by score then earliest `achieved_at`. Export must read the same `data/leaderboard.json` the GUI writes.
