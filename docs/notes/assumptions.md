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
