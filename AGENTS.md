# AGENTS.md

## Project

Đảo Đèn Lồng — 3D third-person game (Day 12 AI SDLC lab). Three.js + TypeScript + Vite.
Everything must run on macOS/Linux after `npm ci && npm run build`.

## Commands

| Purpose | Command |
|---|---|
| GUI (dev server) | `npm run dev` |
| Build GUI + headless + sim | `npm run build` |
| Headless bundle only | `npm run build:headless` |
| Sim bundle only (tooling) | `npm run build:sim` |
| Unit tests | `npm test` |
| Type check | `npm run typecheck` |
| Tests + determinism proof | `npm run verify -- phase-4` |
| GUI FPS benchmark (1280×720) | `npm run fps -- phase-N` (cần Chrome/Edge) |
| Phase 4 benchmark | `npm run bench -- --seed 42 --duration 30 --out bench.json` |
| Phase 4 soak | `npm run soak -- --seed 7 --nights 10 --out soak.json` |
| Export leaderboard | `node scripts/run.mjs --export-leaderboard out.json` |
| Headless run | `node dist/headless.mjs --seed 7 --night 1 --ticks 600 --out .tmp/run.jsonl` |
| Headless run với fixture | `node dist/headless.mjs --seed 7 --night 2 --scenario tests/fixtures/scenario-drifter.json --inputs tests/fixtures/inputs-drifter.json --ticks 60 --out .tmp/run.jsonl` |

## Architecture rules

- `src/sim/**` is pure logic: **no DOM, no Three.js, no fs, no WebAudio, no Math.random()**. Use `world.rng` (mulberry32) only.
- `src/render`/`src/main.ts` only read `World` and draw it. Never duplicate gameplay maths there. Audio/HUD/localStorage hooks stay in the GUI and must not change JSONL output.
- Headless output must be byte-identical for the same seed + night + scenario + inputs.
- Fixed timestep: 60 ticks per second, one `step()` per tick. `world.tick` advances even while paused; `world.sim_tick` and every timer freeze.
- Distances are XZ-only between the contract's reference points (`dist <= r`); only pulse uses 3D distance to entity centres.
- Scenario construction emits no events and awards no score. `scenario.time_left_s` overrides `world.duration` (use `world.duration`, never `spec.duration`, for `time_left_s`).

## Contract rules (never violate)

- Current scope: **contract v1.3** (Phase 4, release v1.0.0). `game.contract.json` `tuning` must equal `TUNING` in `src/sim/config.ts`; `tests/sim.test.ts` (suite "contract v1.3") enforces it. `contract_version` is `1.3`. v1.3 only adds `bench_cmd`/`soak_cmd` and changes `run_cmd` to `node scripts/run.mjs` — **all v1.0–v1.2 gameplay rules and headless output stay byte-identical**.
- `--night` accepts `1|2|3` (durations 240/270/300 s); standard maps live in `NIGHTS`. Invalid `--night` is exit 1.
- Exit codes: 0 ok, 1 usage/runtime error (including missing files), 2 malformed scenario/inputs JSON.
- Inputs are edge-triggered: `dash` and `pause` fire on `false → true`; absent fields keep their previous value. Frames must strictly increase.
- Snapshot v1.3 (= v1.2 shape) must contain `night`, `wind`, `player.vel = [vx, vy, vz]`, `player.invuln` in **ticks**, `dash_cd_s`, `pulse_cd_s`, `charm_s`, `player.capacity`, plus `motes[]`, `drifters[]`, `charms[]`, `lanterns[]` (`fuel` 1 decimal, `ever_lit`, `relit_count`) and shades with `target_lantern_id`. `state` is `"paused"` while paused.
- Required event names: `night_start`, `dash`, `mote_picked`, `charm_picked`, `deposit`, `refuel`, `lantern_lit` (with `relight`), `lantern_out`, `fuel_drain`, `pulse`, `drifter_steal`, `drifter_drop`, `shade_spawned`, `player_hit` (fall adds `lost`), `paused`, `resumed`, `game_over` (`dawn_survived`/`dawn`/`no_flames`). Shade states are exactly `spawning|wander|chase|recoil|stunned|drain`.
- Events use `tick = k + 1` for the step that read input at tick `k`.
- Coordinates are rounded to 3 decimals in output; lantern `fuel` to 1 decimal. Scores: `per_mote` on **deposit/refuel**, not on pickup.
- Charm removes the dash cooldown but still requires a new key press; pressing mid-dash is ignored.
- Fuel is an integer count of 1/60 units; decay and drain are subtracted in step 2, before interaction. No early win — check dawn win/lose after every update, with `no_flames` taking priority.

## Verification discipline

- Never claim a requirement is done without running it. "The agent said it works" is not evidence.
- Run `npm test` after every change; run `npm run verify -- phase-N` before tagging a phase; run `npm run fps -- phase-N` for GUI performance claims; run `npm run bench` / `npm run soak` for Phase 4 numbers.
- Evidence goes to `docs/proof/phase-N/` and must match the tagged commit. Every new event gets a row in `scripts/verify.mjs`. Benchmark and FPS scripts record real measurements; `verify` only reads and validates them — never fabricate a number.
- One headless scenario per new feature under `tests/fixtures/`; TICKET-02 Phần 3 criteria live in `docs/requirements/phase-2-part3-acceptance.md`, TICKET-03 in `docs/requirements/phase-3.md`, TICKET-04 in `docs/requirements/phase-4.md`. The ADR for the v1.2 state model is `docs/notes/adr-001-lantern-state-and-win.md`.
- `src/leaderboard.ts` is pure like `src/sim/**`; disk and HTTP storage stay in `scripts/leaderboard.mjs` and the Vite plugin. `ffmpeg` is a local tool in ignored `.tmp/`, never a dependency.
- If a new ticket invalidates an old test, fix or delete it **with a written reason** in `docs/notes/decisions.md`.
- Record token usage and AI mistakes in `docs/notes/ai-log.md`.

## Conventions

- Conventional commits: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.
- Keep commits small and single-purpose.
- No secrets, no `.env`, no API keys in the repo.
- `log.md` at repo root is a local action log: ignored by git, never commit it.
