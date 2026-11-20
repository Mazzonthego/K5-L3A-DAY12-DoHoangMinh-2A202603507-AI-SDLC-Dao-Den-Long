# Nhật ký dùng AI

Ghi lại công cụ, việc đã giao, lỗi của AI và ước tính token/chi phí.

## Phase 0 — Chuẩn bị (CP0)

| Thời điểm | Công cụ / model | Việc đã giao | Kết quả | Token ước tính |
|---|---|---|---|---|
| CP0 | OpenCode / DeepSeek V4.1 Flash | Đọc 7 file `.md`, tóm tắt checkpoint | Đúng, không bịa yêu cầu | ~25k |
| CP0 | OpenCode / DeepSeek V4.1 Flash | So sánh 4 phương án tech stack, chọn Three.js + TS | Chốt được lựa chọn nhẹ nhất | ~3k |
| CP0 | OpenCode / DeepSeek V4.1 Flash | Dựng khung: `src/sim` thuần, headless runner, test, harness | Cần kiểm chứng bằng `npm run verify` | ~20k |

### Lỗi / điểm cần cảnh giác của AI

- (ghi khi gặp) AI có xu hướng thêm tính năng ngoài yêu cầu. Quy tắc trong `AGENTS.md`: chỉ làm đúng ticket hiện tại.

### Cách tiết kiệm token

- Đưa nguyên văn đoạn contract vào prompt thay vì để agent tự suy.
- Giữ `AGENTS.md` ngắn; không lặp lại nội dung đã có trong tài liệu.
- Dùng một agent cho việc code, một agent khác review (không đốt token vào việc hỏi lại chính nó).

## Phase 1 — gameplay PRD-0

| Thời điểm | Công cụ / model | Việc đã giao | Kết quả | Token ước tính |
|---|---|---|---|---|
| Phase 1 | OpenCode / DeepSeek V4.1 Flash | Đọc PRD-0 lần 2, tách luật bắt buộc và chỗ mơ hồ | Có bảng giả định riêng trong `assumptions.md` | ~8k |
| Phase 1 | OpenCode / DeepSeek V4.1 Flash | Viết `step()` đầy đủ: nhặt/nạp/thắp/pulse/đuổi/va chạm/kết thúc | 31 unit test pass | ~18k |
| Phase 1 | OpenCode / DeepSeek V4.1 Flash | Fixture + `scripts/verify.mjs` + bằng chứng `docs/proof/phase-1/` | 15/15 check pass | ~9k |
| Phase 1 | OpenCode / DeepSeek V4.1 Flash | Cập nhật README/notes/CHANGELOG, tag `phase-1`, push | Xem `log.md` (không commit) | ~5k |

### Lỗi / điểm cần cảnh giác của AI (cập nhật)

- AI ban đầu đặt đèn `L1` cách người chơi 2 m trong fixture gameplay; vì `safe_radius = 4`, Bóng Mực không bao giờ chạm được người chơi → thiếu event `player_hit`. Đã sửa bằng cách cho người chơi đi ra khỏi vùng an toàn sau khi nạp đèn, và ghi rõ bài học: **fixture phải nằm ngoài vùng an toàn nếu muốn test va chạm**.
- AI trừ `stunT` ngay trong tick pulse (`2 - 1/60`), làm thời gian choáng không đúng 2 s. Đã sửa bằng `stunnedAtTick` và có unit test chặn.
- AI ban đầu dùng `Number.isInteger(n * 1000)` để kiểm tra làm tròn; dễ sai do sai số floating point. Đã đổi sang sai số `< 1e-6`.
- Agent reviewer (subagent độc lập) bắt đúng 2 lệch contract: tắt sinh Bóng Mực khi có `shades` (sai mục D) và trả exit 2 cho file không tồn tại (phải là exit 1). Đã sửa cả hai trước khi tag.

## Phase 2 — Ba hòn đảo (contract v1.1)

| Thời điểm | Công cụ / model | Việc đã giao | Kết quả | Token ước tính |
|---|---|---|---|---|
| Phase 2 | OpenCode / DeepSeek V4.1 Flash | Đọc TICKET-02, tách Phần 1/2/3/4 và DoD | Có bảng acceptance criteria riêng cho Phần 3 | ~12k |
| Phase 2 | OpenCode / DeepSeek V4.1 Flash | Rewrite `src/sim` theo v1.1 (types/config/geometry/world/step/output/inputs/headless) | 30 unit test pass, typecheck 0 lỗi | ~34k |
| Phase 2 | OpenCode / DeepSeek V4.1 Flash | Rewrite GUI: menu/intro/result/dawn, HUD, 3 bản đồ, âm thanh, cài đặt | Build GUI + headless OK, 60 FPS @ 1280×720 | ~22k |
| Phase 2 | OpenCode / DeepSeek V4.1 Flash | Fixtures + `scripts/verify.mjs` + `scripts/fps.mjs` + bằng chứng | 37 check pass, evidence `docs/proof/phase-2/` | ~14k |
| Phase 2 | OpenCode / DeepSeek V4.1 Flash | Cập nhật README/CHANGELOG/notes/AGENTS.md/skill/spec, commit + tag + push | Xem `log.md` (không commit) | ~7k |

### Lỗi / điểm cần cảnh giác của AI (cập nhật)

- Viết `world.tuning.score.*` trong `step.ts` dù `World` không có field `tuning` — 5 lỗi typecheck. Sửa dùng `TUNING.score.*` trực tiếp. Bài học: đổi cấu trúc type phải chạy typecheck ngay, đừng đợi hết file.
- Dùng `spec.duration` để tính `time_left_s` nên scenario `time_left_s` override bị bỏ qua, làm thưởng thời gian sai (748 thay vì 268). Thêm `world.duration` và dùng nó.
- `nearestLanternIndex()` nhận `spec.lanterns` thay vì `world.lanterns[].pos`; scenario đổi vị trí đèn thì nạp nhầm đèn. Đổi chữ ký hàm nhận mảng vị trí.
- Tính lại vận tốc đẩy `(6 − d)/30` mỗi tick → Bóng Mực tăng tốc dần và dừng ở 5.228 m (< 6). Sửa thành một episode vận tốc constant đúng 30 tick.
- Gộp event `dash` vào `night_start`; contract v1.1 liệt kê hai event riêng. Tách ra.
- Quên event `drifter_drop` dù contract mục 108 liệt kê — chỉ sinh motes rơi. Đã thêm event + unit test + verify check.
- Thiết kế fixture sai 3 chỗ: `time_left_s: 120` (> 600 tick chạy) nên không có `game_over`; pause chỉ 1 tick nên snapshot mỗi 60 tick không thấy `state: "paused"`; dash thứ 2 đặt ở tick 5 vẫn dính 12 tick dash đầu. Sửa bằng `time_left_s: 5`, `snapshot-every 10`, dash thứ 2 ở tick 15.
- Đo FPS lần đầu được 1254×627 vì `--window-size` trừ viền trình duyệt, dù số đo 56.2 FPS. Phải dùng CDP `Emulation.setDeviceMetricsOverride` để ép đúng 1280×720 (kết quả cuối 60 FPS).
- PowerShell báo `Exit code: 1` khi node/git ghi stderr dù lệnh thành công (cảnh báo DEP0190). Luôn đọc stdout/`git log` thay vì tin exit code.
