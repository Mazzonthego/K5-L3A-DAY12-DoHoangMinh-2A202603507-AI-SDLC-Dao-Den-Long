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
| 2026-11-20 | 3 | Lưu nhiên liệu dưới dạng số nguyên 1/60 (`FUEL_MAX_UNITS = 6000`) | Hao 1/s và hút 5/s trừ nguyên số tick; tránh sai số float sau 21 600 tick, output vẫn làm tròn 1 chữ số |
| 2026-11-20 | 3 | `used = min(carried, ceil((100 − fuel)/10))`; thắp 10, thắp lại 5; `deposited` reset khi tắt | Đúng công thức v1.2; `ever_lit` cần thiết để biết chi phí thắp lại mà không tin `lit` hiện tại |
| 2026-11-20 | 3 | Không thắng sớm; thắng `dawn_survived`, thua `dawn` / `no_flames`; kiểm tra ở cuối tick | Ticket thay luật "thắp hết là thắng"; `no_flames` phải thắng trước cả khi hết giờ cùng tick |
| 2026-11-20 | 3 | Đèn `fuel < 30` mất vùng an toàn; `wander` ưu tiên đèn yếu rồi đèn tắt; thoát `drain` theo 4 điều kiện contract | Tạo áp lực cuối đêm bằng trạng thái mới thay vì thêm entity; đúng 30 vẫn bảo vệ |
| 2026-11-20 | 3 | Pulse trúng bóng đang `drain` cộng 15 thay vì 5; sau `stunned` về `wander` | Luật điểm mới và "hết choáng thì về wander" của v1.2 |
| 2026-11-20 | 3 | Fixture `scenario-basic.json` giữ `time_left_s: 300` nên regression 60 tick vẫn kỳ vọng 299; kiểm tra duration 240 bằng fixture `scenario-default.json` | Scenario override phải được tôn trọng; không sửa fixture Phase 1 chỉ để khớp số mặc định mới |
| 2026-11-20 | 3 | Sửa 3 test v1.2 mới sai ngay sau khi chạy (đèn vừa đầy nhận 1 mote sau 1 tick decay, fuel 5399 đơn vị, drain chỉ duy trì khi đèn yếu) thay vì bỏ qua | Luật "decay trước tương tác" và "drain chỉ đèn yếu" là hệ quả của contract; ghi rõ để không ai tưởng là test bị skip |
| 2026-11-20 | 3 | Thay bộ test v1.1 bằng bộ v1.2, giữ regression Phase 1–2 qua fixture cũ + 7 fixture mới | Luật cũ (thắng sớm, đèn không nhận dầu, sức chứa cố định, điểm cũ) bị TICKET-03 thay; không skip âm thầm |
| 2026-11-20 | 4 | `contract_version` 1.3 chỉ thêm `bench_cmd`/`soak_cmd`, đổi `run_cmd`; không đụng gameplay hay output | Ticket yêu cầu mọi luật v1.0–v1.2 giữ nguyên; 43 unit test và 50 check cũ vẫn phải đạt |
| 2026-11-20 | 4 | Bench chạy trên web (Chrome + CDP), `peak_mem_mb = null` kèm giải thích trong README thay vì số giả | CDP web chỉ lộ JS heap, không phải RSS tiến trình; RSS thật được đo ở soak bằng `process.memoryUsage().rss` |
| 2026-11-20 | 4 | Bench đóng băng gameplay bằng cách reset flames/fuel/time mỗi frame nhưng vẫn chạy `step()` cho Bóng Mực wanders | Cần cảnh chuẩn 200 bóng di chuyển thật; không được phép sinh thêm, gây sát thương hay kết thúc đêm |
| 2026-11-20 | 4 | Soak dùng 10 world liên tiếp, giải reference và gọi `global.gc()` nếu có | Phải đo reset thật trong cùng process; `mem_end ≤ 1.2 × mem_start` mới có ý nghĩa |
| 2026-11-20 | 4 | Leaderboard lưu `data/leaderboard.json`, GUI ưu tiên `/api/leaderboard` rồi fallback localStorage | Bản dev có plugin Vite, bản web tĩnh trong Release không có server — export vẫn đọc cùng một file |
| 2026-11-20 | 4 | Unit test leaderboard đổi tên `P1…` thành `Player1…` (thay vì nới luật tên) | Bộ lọc tên 3–12 ký tự là đúng ticket; lỗi nằm ở dữ liệu test, đã sửa test có lý do |
| 2026-11-20 | 4 | Vite bỏ qua `.tmp/`, `dist/`, `docs/proof/` khỏi watcher | Ảnh/profile benchmark ghi liên tục làm dev server reload, nhiễu phép đo FPS |
| 2026-11-20 | 4 | `ffmpeg` chỉ cài tạm trong `.tmp/ffmpeg` (ignored), script demo nhận `FFMPEG_PATH` | Không đưa binary ~80 MB vào repo; CREDITS ghi rõ công cụ ngoài |
