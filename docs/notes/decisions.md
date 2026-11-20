# Quyết định thiết kế

Mỗi thay đổi lớn một dòng: ngày, phase, quyết định, lý do. Dùng khi ticket mới thay luật cũ.

| Ngày | Phase | Quyết định | Lý do |
|---|---|---|---|
| 2026-11-20 | 0 | Tách `src/sim` thuần logic khỏi Three.js | Headless và GUI phải cho cùng kết quả; contract yêu cầu chạy không GPU |
| 2026-11-20 | 0 | `fall_enabled: false` | Contract không định nghĩa địa hình đảo; tránh test ẩn không công bằng |
| 2026-11-20 | 0 | Chỉ dùng PRNG mulberry32 theo seed | Tất định tuyệt đối, kể cả id tự sinh |
