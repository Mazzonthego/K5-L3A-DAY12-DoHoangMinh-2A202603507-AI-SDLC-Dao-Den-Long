# Changelog

## [Unreleased]

### Phase 0 — Chuẩn bị (CP0)

- Khung dự án Three.js + TypeScript + Vite; logic game thuần trong `src/sim`.
- Headless runner theo Test Contract v1.0 (`node dist/headless.mjs`), JSONL snapshot/event/end.
- PRNG mulberry32 theo seed, tick cố định 60/s.
- `game.contract.json` + test chặn lệch tuning.
- Harness: `AGENTS.md`, skill `verify`, pre-commit hook, CI GitHub Actions.
- `npm run verify` sinh bằng chứng vào `docs/proof/phase-0/`.
