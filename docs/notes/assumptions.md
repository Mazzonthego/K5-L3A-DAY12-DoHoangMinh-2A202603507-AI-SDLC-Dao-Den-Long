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
