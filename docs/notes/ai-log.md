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
