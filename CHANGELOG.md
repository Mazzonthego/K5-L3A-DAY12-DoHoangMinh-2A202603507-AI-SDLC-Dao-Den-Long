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

### Phase 3 — «Đèn cạn dầu» (tag `phase-3`, contract v1.2)

**Breaking changes (luật bị thay thế):**

- `contract_version`: `1.1` → `1.2`. Thời lượng Đêm 1/2/3: `300/330/360` → `240/270/300` s.
- **Bỏ thắng sớm** «thắp hết đèn». Thắng chỉ ở bình minh khi số đèn đang sáng `≥ ceil(0.6 × tổng đèn)`; `game_over.reason` dùng `dawn_survived`, `all_lit` không còn. Thua: `no_flames` (ưu tiên, kể cả tick cuối) hoặc `dawn`.
- **Đèn sáng nhận thêm đom đóm** (trước đây bị cấm): châm `ceil((100 − fuel)/10)` con, mỗi con +10 dầu; đèn có `fuel ≤ 0` tắt (`lantern_out`), thắp lại chỉ cần 5 đom đóm. `deposited` reset khi tắt; lưu `ever_lit` / `relit_count`.
- **Vùng an toàn không còn vĩnh viễn**: `fuel < 30` mất vùng an toàn; Bóng Mực `wander` tìm đèn yếu và chuyển sang trạng thái mới `drain` (hút 5 dầu/giây, cộng dồn). Sau `stunned` bóng về `wander` thay vì `chase`.
- **Sức chứa** `10` → `min(20, 10 + 2 × successful_lights)`; scenario không được tính `successful_lights`.
- **Toàn bộ công thức điểm cũ bị thay**: +5/đom đóm nạp, +100 thắp, +40 thắp lại, +5/15 choáng bóng, `50 + floor(fuel)` mỗi đèn lúc bình minh, +50/lửa; bỏ thưởng thời gian.
- Snapshot thêm `lanterns[].fuel` (1 chữ số), `ever_lit`, `relit_count`, `player.capacity`, `shades[].target_lantern_id`; scenario thêm `lanterns[].fuel/ever_lit/relit_count`, `player.successful_lights`, `shades[].target_lantern_id`. Sự kiện mới: `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit` thêm `relight`.

**Tính năng / tài liệu:**

- GUI: thanh dầu trên đèn, nhấp nháy 1 Hz khi `fuel < 30`, HUD `đang mang/sức chứa`, đèn tắt xẹp 20% + giấy rách, ánh sáng môi trường giảm theo tổng dầu.
- Cài đặt «Bảng màu dễ phân biệt» (lưu localStorage): viền/mắt Bóng Mực `#00B3FF`, cảnh báo UI trắng kèm ⚠.
- ADR `docs/notes/adr-001-lantern-state-and-win.md`; lý do sửa test cũ trong `docs/notes/decisions.md`.
- 7 fixture headless mới cho từng luật; `npm run verify -- phase-3`: 50 check đạt, 40 unit test, regression Phase 1–2, FPS 60 @ 1280×720; bằng chứng `docs/proof/phase-3/`.

## [v1.0.0] — Phase 4 «Bình minh» (tag `phase-4`, contract v1.3)

**Hợp đồng:** `contract_version` `1.2` → `1.3`; thêm `bench_cmd = node scripts/bench.mjs`, `soak_cmd = node scripts/soak.mjs`, đổi `run_cmd = node scripts/run.mjs`. **Không đổi luật, số liệu hay đầu ra headless của v1.0–v1.2.**

- **Benchmark** (`npm run bench -- --seed 42 --duration 30 --out bench.json`): Chrome/Edge + CDP, 1280×720, tắt vsync; 200 Bóng Mực `wander`, 100 đom đóm, 3 đèn đầy, camera quay tròn 30 m / Y=15 / 15 s vòng; 3 s khởi động. Đo `avg_fps`, `p1_low_fps`, `frame_ms_p95`, `frames`, `load_ms`, `renderer`, `os`. `peak_mem_mb = null` vì web CDP không lộ RSS tiến trình — ghi rõ trong README.
- **Soak** (`npm run soak -- --seed 7 --nights 10 --out soak.json`): 10 đêm liên tiếp trong cùng process, seed `7+i`, input ngẫu nhiên theo ticket; đo RSS đầu/cuối. Tự chạy: 0 crash, 46.1 → 51.7 MB (≤ 1.2×).
- **Bảng xếp hạng cục bộ**: tên 3–12 ký tự (nhận tiếng Việt có dấu), top 10 theo điểm rồi thời gian, lưu `data/leaderboard.json`; GUI dùng `/api/leaderboard` (plugin Vite) và fallback `localStorage` cho bản tĩnh; xuất bằng `node scripts/run.mjs --export-leaderboard out.json`.
- **Khả năng tiếp cận**: đổi 9 phím (có chặn trùng + khôi phục mặc định), phụ đề và mũi tên chỉ Bóng Mực/gió/10 s cuối/đèn yếu, giảm chuyển động (rung, chớp đỏ, nhấp nháy), cỡ chữ 18 px @ 1280×720 với tùy chọn ×1.25.
- **Đóng gói**: README 2 lệnh cho bản dev, hướng dẫn serve `dist/web`, yêu cầu hệ thống, ảnh chụp + demo; `CREDITS.md`, `LICENSE`, `CHANGELOG.md`, retro đầy đủ.
- **Demo** [docs/demo/demo.mp4](docs/demo/demo.mp4): ~48 s, 1.4 MB, quay thật bằng CDP screencast — gameplay rồi cảnh benchmark chuẩn. Script `scripts/demo.mjs` đi kèm (ffmpeg là công cụ local, không phải dependency).
- `npm run verify -- phase-4` kiểm tra thêm hợp đồng, bench, soak, export, accessibility, đóng gói và kích thước demo; 43 unit test vẫn đạt, mọi check v1.0–v1.2 giữ nguyên.
