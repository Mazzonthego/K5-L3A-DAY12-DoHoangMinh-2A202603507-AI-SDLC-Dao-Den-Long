# Quyết định thiết kế

Mỗi thay đổi lớn một dòng: ngày, phase, quyết định, lý do. Dùng khi ticket mới thay luật cũ.

| Ngày | Phase | Quyết định | Lý do |
|---|---|---|---|
| 2026-11-20 | 0 | Tách `src/sim` thuần logic khỏi Three.js | Headless và GUI phải cho cùng kết quả; contract yêu cầu chạy không GPU |
| 2026-11-20 | 0 | `fall_enabled: false` | Contract không định nghĩa địa hình đảo; tránh test ẩn không công bằng |
| 2026-11-20 | 0 | Chỉ dùng PRNG mulberry32 theo seed | Tất định tuyệt đối, kể cả id tự sinh |
| 2026-11-20 | 1 | Nhặt đom đóm tự động khi chạm, `E` chỉ để nạp đèn | Contract mô tả khoảng cách, không bắt bấm nút; tự nhặt dễ test hơn |
| 2026-11-20 | 1 | Nạp `min(carried, cost - deposited)` vào đèn gần nhất | Không lãng phí, snapshot `deposited` có ý nghĩa rõ |
| 2026-11-20 | 1 | Thưởng thời gian/lửa chỉ khi thắng | `per_second_left`/`per_flame_left` là phần thưởng khi còn sót lại |
| 2026-11-20 | 1 | Đom đóm rơi mất, không hồi sinh | Giữ đầu ra tất định và dễ kiểm `dropped` |
| 2026-11-20 | 1 | Sinh Bóng Mực mỗi 30 s, chỉ tắt khi `random_shades: false` | Đúng mục D: `shades` chỉ thay danh sách ban đầu; reviewer đã bắt lệch này |
