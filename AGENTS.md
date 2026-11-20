# AGENTS.md

## Project

Đảo Đèn Lồng — 3D third-person game (Day 12 AI SDLC lab). Three.js + TypeScript + Vite.
Everything must run on macOS/Linux after `npm ci && npm run build`.

## Commands

| Purpose | Command |
|---|---|
| GUI (dev server) | `npm run dev` |
| Build GUI + headless | `npm run build` |
| Headless bundle only | `npm run build:headless` |
| Unit tests | `npm test` |
| Type check | `npm run typecheck` |
| Tests + determinism proof | `npm run verify` |
| Headless run | `node dist/headless.mjs --seed 7 --night 1 --ticks 600 --out .tmp/run.jsonl` |

## Architecture rules

- `src/sim/**` is pure logic: **no DOM, no Three.js, no fs, no Math.random()**. Use `world.rng` (mulberry32) only.
- `src/render`/`src/main.ts` only read `World` and draw it. Never duplicate gameplay maths there.
- Headless output must be byte-identical for the same seed + scenario + inputs.
- Fixed timestep: 60 ticks per second, one `step()` per tick.
- Distances are XZ-only between the contract's reference points (`dist <= r`).

## Contract rules (never violate)

- `game.contract.json` `tuning` must equal `TUNING` in `src/sim/config.ts`; `tests/sim.test.ts` (suite "contract tuning") enforces it.
- Exit codes: 0 ok, 1 usage/runtime error, 2 malformed scenario/inputs.
- Building a scenario never emits events and never awards score.
- Events use `tick = k + 1` for the step that read input at tick `k`.
- Coordinates are rounded to 3 decimals in output.

## Verification discipline

- Never claim a requirement is done without running it. "The agent said it works" is not evidence.
- Run `npm test` after every change; run `npm run verify` before tagging a phase.
- Evidence goes to `docs/proof/phase-N/` and must match the tagged commit.
- If a new ticket invalidates an old test, fix or delete it **with a written reason** in `docs/notes/decisions.md`.
- Record token usage and AI mistakes in `docs/notes/ai-log.md`.

## Conventions

- Conventional commits: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.
- Keep commits small and single-purpose.
- No secrets, no `.env`, no API keys in the repo.
