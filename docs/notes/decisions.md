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
| 2026-11-20 | 2 | Thay toàn bộ số liệu tự chọn bằng số chuẩn Phần 1 (6 m/s, nhảy 7/−20, lướt 14/0.2/1.5, pulse 3, 300/330/360 s) | Ticket mới bắt buộc; mọi bản phải cho cảm giác giống nhau |
| 2026-11-20 | 2 | `fall_enabled: false` → `true` | v1.1 đã định nghĩa địa hình 3 đêm và luật rơi (Y < −10, chờ 60 tick, hồi sinh) — lý do cũ không còn |
| 2026-11-20 | 2 | `score.per_mote` cộng lúc **nạp vào đèn**, không lúc nhặt | Contract: "+10 mỗi đom đóm nạp"; nhặt chỉ tăng `carried` |
| 2026-11-20 | 2 | Snapshot `invuln` là **ticks**, `vel` là `[x, y, z]`, thêm `invuln_s`/`vel_y` | Đúng field list Phần 4 v1.1, tránh test ẩn đọc nhầm đơn vị |
| 2026-11-20 | 2 | Bùa Gió xóa hẳn cooldown lướt nhưng vẫn cần nhấn lại; nhấn lúc đang lướt bị bỏ qua | Ticket Phần 3: "Lướt không hồi chiêu (vẫn cần nhấn lại nút; nhấn khi đang lướt bị bỏ qua)" |
| 2026-11-20 | 2 | Dùng `world.duration` cho `time_left_s`, không dùng `spec.duration` | Scenario `time_left_s` override phải có hiệu lực; lỗi này làm thưởng thời gian sai |
| 2026-11-20 | 2 | Đẩy ra khỏi vùng an toàn bằng vận tốc constant, mỗi episode 30 tick | Tính `(safe_radius − d)/30` mỗi tick làm tăng tốc dần, sai "đẩy ra mép trong tối đa 30 tick" |
| 2026-11-20 | 2 | Event `dash` tách khỏi `night_start` | Contract liệt kê hai event riêng; gộp làm test event list sai |
| 2026-11-20 | 2 | `drifter_drop` phát khi Tỏa Sáng trúng Gió Lạc đang `flee` có đồ | Contract v1.1 mục 108 liệt kê event này; trước đó chỉ rơi motes không có event |
| 2026-11-20 | 2 | Thay bộ test v1.0 bằng bộ v1.1; giữ regression Phase 1 qua fixture `scenario-basic.json` + `walk.json` | Luật cũ (fall off, pulse 2, player_hit không có `lost`) bị ticket mới thay — sửa test có lý do, không skip âm thầm |
| 2026-11-20 | 2 | `npm run fps` là script riêng, verify chỉ đọc bằng chứng đã sinh | Cần Chrome/Edge + dev server; không bắt môi trường macOS/Linux phải có browser khi chạy verify |
