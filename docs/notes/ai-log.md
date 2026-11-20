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
