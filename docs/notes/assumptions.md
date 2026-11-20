# Giả định & quyết định

Ghi lại mọi chỗ tài liệu mơ hồ và con số mình tự chọn. Cập nhật theo từng phase.

## Phase 0 — Chuẩn bị

| Chủ đề | Giả định / quyết định | Lý do |
|---|---|---|
| Tech stack | Three.js + TypeScript + Vite, logic game thuần trong `src/sim` | Nhẹ, cài nhanh, chạy trên macOS/Linux qua browser; cùng một module cho GUI và headless nên không lệch hành vi |
| Vật lý | Tự viết toán XZ, không dùng physics engine | Contract định nghĩa mọi khoảng cách là XZ giữa các điểm; tự viết đảm bảo đúng spec và tất định |
| `run_cmd` | `npm run dev` (Vite dev server) | Người chấm mở URL in ra terminal; không cần build GUI trước |
| Rơi khỏi đảo | `fall_enabled: false` | Contract không định nghĩa bán kính/địa hình đảo, nên test ẩn không thể kiểm tra rơi một cách công bằng; README ghi rõ |
| PRNG | mulberry32 theo `--seed` | Tất định, không phụ thuộc `Math.random()` |
| Tick | Cố định 60 tick/s, `step()` gọi đúng một lần mỗi tick | Theo mục B của Test Contract |

## Con số tuning Phase 0 (sẽ chốt lại ở Phase 1)

| Tham số | Giá trị | Ghi chú |
|---|---:|---|
| `player_speed` | 5 m/s | Đi bộ nhanh nhưng vẫn kiểm soát được |
| `carry_capacity` | 10 | Đủ cho 2 lần nạp đèn |
| `lantern_cost` | 5 | 5 đom đóm / đèn |
| `lantern_count_night1` | 5 | Theo contract |
| `pickup_radius` | 1.5 m | |
| `interact_radius` | 2.5 m | |
| `pulse_cost` | 2 | |
| `pulse_radius` | 6 m | |
| `night1_duration_s` | 300 s | 5 phút / đêm |
| `flames` | 3 | |
| `invuln_s` | 1.5 s | |
| `hit_drop_ratio` | 0.5 | Rơi nửa số đom đóm đang mang |
| `pulse_stun_s` | 2 s | |
| `pulse_push_m` | 3 m | |
| `pulse_cooldown_s` | 3 s | |
| `safe_radius` | 4 m | Bóng Mực không vào quanh đèn |
| `shade_speed` | 3 m/s | Chậm hơn người chơi |
| `shade_hit_radius` | 1 m | |
| `score.*` | 10 / 100 / 5 / 2 / 50 | per_mote / per_lantern / per_stun / per_second_left / per_flame_left |

## Phase 1 — PRD-0 (chỗ mơ hồ đã tự quyết)

| Chỗ mơ hồ | Quyết định | Lý do |
|---|---|---|
| Nhặt đom đóm tự động hay nút `E`? | **Tự nhặt khi chạm** (`dist <= pickup_radius`), tối đa 1 con/tick; `E` chỉ dùng nạp đèn | Contract chỉ định "trong bán kính r" và sự kiện `mote_picked` có `carried`; tự nhặt bao phủ cả test chỉ đi lại lẫn test bấm `E` |
| Nạp bao nhiêu mỗi lần `E`? | `min(carried, lantern_cost - deposited)` vào đèn **chưa sáng gần nhất** | Tránh lãng phí đom đóm; khớp ý nghĩa `deposited` trong snapshot |
| Khi nào thắng? | Ngay khi cả 5 đèn sáng → `game_over` `won` / `all_lit` | Hợp luật "thắp lại 5 đèn trước khi trời sáng" |
| Cộng điểm thưởng khi nào? | Chỉ khi thắng: `floor(time_left_s) * per_second_left + flames * per_flame_left` | `per_second_left`/`per_flame_left` là điểm cho thời gian/lửa còn lại; thua thì không thưởng |
| Đom đóm rơi khi bị chạm có nhặt lại được không? | **Không** — chỉ trừ `carried`, không sinh mote mới | Đơn giản, tất định, dễ kiểm `dropped` trong test ẩn |
| Pulse không trúng bóng nào? | Vẫn trừ `pulse_cost`, bắt đầu hồi chiêu và ghi event `pulse` với `stunned_ids: []` | Hành động có giá và có hệ quả rõ ràng |
| Choáng tính từ tick nào? | Lưu `stunnedAtTick`; `stunT` đúng `pulse_stun_s` ở tick pulse, giảm dần các tick sau | Tránh mất 1/60 s ngay tại tick kích hoạt |
| Bóng Mực đuổi như thế nào? | Mỗi tick tiến về phía người chơi đúng `shade_speed / 60` mét, không vượt mục tiêu; bị đẩy ra rìa vùng an toàn của đèn sáng | Tất định, đúng đơn vị mét/giây và nghĩa `safe_radius` |
| Bóng mới xuất hiện khi nào? | Mỗi 1800 tick (30 s) ở mép đảo, id tiếp theo, tối đa 8; **chỉ tắt** khi scenario có `random_shades: false` (đúng mục D) | `shades` chỉ thay danh sách ban đầu, không tắt cơ chế sinh |
| Bán kính đảo | `ISLAND_RADIUS = 30` (ngoài `tuning`, chỉ để sinh vị trí và chặn đẩy ra ngoài) | Contract không khai báo kích thước đảo; `fall_enabled: false` nên không phạt rơi |
| Va chạm với Bóng Mực đang choáng | Không gây sát thương | `stunned` là trạng thái vô hại, khớp ý nghĩa "xua" |

## Phase 2 — Ba hòn đảo (contract v1.1)

| Chỗ mơ hồ | Quyết định | Lý do |
|---|---|---|
| Vách đứng giữa các tầng Đêm 3 | `groundHeight()` trả về tầng cao nhất chứa điểm; nếu tầng cao hơn chân người > 0.1 m thì chặn bước ngang | Ticket nói "không đi lên được; bước ra thì rơi xuống tầng dưới" — đi xuống luôn được, đi lên thì chặn |
| Dốc 30°/150° | Dải rộng 3 m dọc bán kính, nội suy Y từ 0 ở r=30 tới 3 ở r=24 | Ticket chỉ cho chiều dài/góc, không cho công thức nội suy |
| Tháp chuông | Hình trụ bán kính 2 m ở tâm tầng 2; chặn nếu người ở Y ≥ 5.5 | "Không leo được" — chân tháp để Y=0 để không tạo vách vô hình trên tầng 0 |
| Bục nhảy | Vận tốc `velXZ`/`velY` giữ nguyên tới khi chạm đất (`padLock`), phím di chuyển không ghi đè; lướt vẫn được | Ticket: "Vận tốc phóng giữ nguyên tới khi chạm đất" |
| Gió | Đẩy 2 m/s cả khi đang đứng và đang bay; hướng lấy từ `world.rng()` ở tick báo trước | Cần tất định; báo trước 2 s rồi mới active 5 s |
| Sinh Bóng Mực | Lần đầu 2 con ở tick 300, sau đó `300 + k·interval`; điểm hợp lệ phải cách người chơi ≥ 15 m; hết điểm thì bỏ lượt | Đúng Phần 1 mục "Lịch sinh" |
| Sinh Gió Lạc | Tick 1200, 2400, … lấy điểm trong `shadePoints`; `drifters`/`charms` trong scenario **thay thế** mặc định | Phần 4 nói hai mảng này thay danh sách mặc định (khác `shades` chỉ thay danh sách ban đầu) |
| Đèn khi scenario override vị trí | `nearestLanternIndex` nhận mảng `world.lanterns[].pos`, không `spec.lanterns` | Scenario có thể đổi `pos`; dùng `spec` sẽ nạp nhầm đèn |
| Đom đóm rơi | TTL 480 tick, id `F1…`, bán kính 1.5–2.5 m, nhặt lại được từ tick sau | Đúng "rơi floor(carried/2) … tồn tại 480 tick" |
| Pulse đẩy Bóng Mực | Mục tiêu chốt ngay tick kích hoạt; tâm = chân Mây + 0.8 m; đẩy 4 m trong 15 tick; trùng vị trí đẩy theo +X | Đúng Phần 1 mục Tỏa Sáng; dùng 3D distance tới **tâm** Bóng (pos + 0.8) |
| Scoring | +10 chỉ khi nạp; +100 lúc đèn sáng; +5 mỗi Bóng trúng Tỏa Sáng; thưởng chỉ khi thắng | Contract v1.1 mục "Điểm" |
| Snapshot `invuln` | Ticks (90 sau khi bị chạm), kèm `invuln_s` làm tròn 3 chữ số | Test ẩn có thể đọc cả hai; ticks là đơn vị gốc |
| Snapshot `vel` | `[vx, vy, vz]` (Y ở giữa), kèm `vel_y` | Contract ghi `vel` dạng vector 3 chiều |
| HUD mũi tên | Hiện khoảng cách tới đèn chưa sáng gần nhất, chưa chiếu lên màn hình | Đủ để người chơi biết hướng; đây là giới hạn đã ghi trong spec Phần 3 |
| Đo FPS | Script CDP riêng (`npm run fps`), dùng `Emulation.setDeviceMetricsOverride` để ép đúng 1280×720 | `--window-size` của headless Chrome trừ đi viền trình duyệt (thực tế 1254×627) |
