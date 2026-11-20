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

## Phase 3 — «Đèn cạn dầu» (contract v1.2)

| Thời điểm | Công cụ / model | Việc đã giao | Kết quả | Token ước tính |
|---|---|---|---|---|
| Phase 3 | OpenCode / Hy4 flash Free | Đọc TICKET-03, chuyển vào `docs/requirements/phase-3.md`, viết ADR trước khi code | ADR-001 + bảng luật bị thay thế | ~10k |
| Phase 3 | OpenCode / Hy4 flash Free | Rewrite `types.ts`, `config.ts`, `world.ts`, `step.ts`, `output.ts`, `game.contract.json` theo v1.2 | typecheck 0 lỗi; 40 unit test pass | ~38k |
| Phase 3 | OpenCode / Hy4 flash Free | Cập nhật GUI: fuel bar, blink 1 Hz, HUD sức chứa, bảng màu mù màu, đèn tắt xẹp + rách | Build GUI OK; FPS 60 @ 1280×720 | ~18k |
| Phase 3 | OpenCode / Hy4 flash Free | 7 fixture mới + nâng `verify.mjs` lên v1.2 + `fps.mjs` nhận phase | 50/50 check pass, evidence `docs/proof/phase-3/` | ~16k |
| Phase 3 | OpenCode / Hy4 flash Free | Cập nhật README/CHANGELOG/decisions/retro/AGENTS/skill, commit + tag + push | Xem `log.md` (không commit) | ~8k |

### Lỗi / điểm cần cảnh giác của AI (cập nhật)

- Ban đầu trừ `fuel_decay_per_s * FUEL_UNITS_PER_POINT` mỗi tick (thiếu `/60`) → hao 60 dầu/giây. Sửa bằng cách chia cho `TICKS_PER_SECOND`; unit test "99 sau 1 giây" chặn lỗi này.
- Viết unit test kỳ vọng đèn đầy «không nhận dầu» dù decay chạy trước tương tác: sau 1 tick fuel = 99,983 nên `ceil(0,017/10) = 1`. Đổi test thành kỳ vọng đúng công thức + trường hợp `carried = 0` để kiểm tra `used = 0`. Không skip test.
- Test refuel kỳ vọng 5400 đơn vị nhưng decay đã trừ 1 trước khi nạp → 5399. Đổi kỳ vọng và ghi chú trong test; output làm tròn vẫn đúng 90.
- Fixture drain đặt `fuel: 40` (≥ 30) nhưng `drain` chỉ duy trì trên đèn yếu; bóng thoát `drain` ở tick đầu. Đổi `fuel: 29` và cập nhật cả kỳ vọng 23 dầu sau 1 giây (29 − 1 decay − 5 drain).
- Verify regression Phase 1 bị lệch vì `scenario-basic.json` override `time_left_s: 300`; tưởng duration mặc định vẫn 300. Giữ fixture cũ (kỳ vọng 299) và thêm `scenario-default.json` để kiểm tra duration mặc định 240.
- `npm run fps` ghi đúng `docs/proof/phase-3/fps.txt` nhưng dòng log vẫn in `phase-2`; sửa log dùng `proofDir`.
- Bài học chung: khi ticket thay luật, chạy typecheck + unit test **ngay** sau khi rewrite sim rồi mới đụng vào GUI; mỗi kỳ vọng sai phải được giải thích bằng một dòng trong `decisions.md`.
