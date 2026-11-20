# Changelog

## [Unreleased]

### Phase 0 — Chuẩn bị (CP0)

- Khung dự án Three.js + TypeScript + Vite; logic game thuần trong `src/sim`.
- Headless runner theo Test Contract v1.0 (`node dist/headless.mjs`), JSONL snapshot/event/end.
- PRNG mulberry32 theo seed, tick cố định 60/s.
- `game.contract.json` + test chặn lệch tuning.
- Harness: `AGENTS.md`, skill `verify`, pre-commit hook, CI GitHub Actions.
- `npm run verify` sinh bằng chứng vào `docs/proof/phase-0/`.

### Phase 1 — PRD-0 (tag `phase-1`)

- Gameplay đầy đủ: nhặt đom đóm, nạp/thắp đèn, Bóng Mực đuổi theo, pulse choáng+đẩy, va chạm mất lửa, thắng/thua.
- Phát sự kiện contract: `mote_picked`, `deposit`, `lantern_lit`, `pulse`, `player_hit`, `shade_spawned`, `game_over`.
- Snapshot bổ sung mảng `motes` (khuyến nghị v1.0); tọa độ làm tròn 3 chữ số.
- `npm run verify` mở rộng: typecheck + 15 kiểm chứng + bằng chứng tại `docs/proof/phase-1/`.
- Fixture mới `scenario-play.json`, `inputs-play.json`, `scenario-spawn.json`.
