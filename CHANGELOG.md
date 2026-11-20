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

### Phase 2 — "Ba hòn đảo" (tag `phase-2`, contract v1.1)

- **Breaking:** `contract_version` lên `1.1`; `fall_enabled` từ `false` → `true`; số liệu chuẩn thay mọi giá trị tự chọn (tốc độ 6, nhảy 7/−20, lướt 14/0.2/1.5, pulse 3 đom đóm, 3 đêm 300/330/360 s).
- **Breaking:** snapshot thêm `night`, `wind`, `player.vel` (dạng `[x,y,z]`), `invuln` (ticks), `dash_cd_s`, `pulse_cd_s`, `charm_s`, cùng các mảng `motes`, `drifters`, `charms`; `--night` nhận 1|2|3.
- **Breaking:** input thêm `dash`, `pause`; sự kiện mới `dash`, `charm_picked`, `drifter_steal`, `drifter_drop`, `night_start`, `paused`, `resumed`; `player_hit` do rơi thêm `lost`.
- Bản đồ chuẩn 3 đêm: Đảo Bến (1 đảo), Đảo Cau (2 đảo + cầu + bục nhảy), Đảo Chuông (3 tầng + dốc + tháp + gió).
- Tính năng mới: Gió Lạc, Bùa Gió, chuỗi 3 đêm, tạm dừng, cài đổi lưu được, âm thanh, HUD đầy đủ, bảng màu chuẩn.
- GUI rewrite theo v1.1: menu/intro/result/dawn, HUD, nhạc nền + hiệu ứng, 3 bản đồ, hook đo FPS.
- `npm run verify`: 37 check gồm regression Phase 1 (số chuẩn), một scenario headless cho mỗi tính năng mới, exit codes, 21600 tick ≤ 30 s; bằng chứng tại `docs/proof/phase-2/`.
- `npm run fps`: đo `requestAnimationFrame` thật ở 1280×720 — 60 FPS (ngưỡng 30).
- Spec acceptance criteria cho Phần 3 tại `docs/requirements/phase-2-part3-acceptance.md`.
