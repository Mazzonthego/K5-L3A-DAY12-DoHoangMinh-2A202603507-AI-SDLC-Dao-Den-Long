# Spec & Acceptance Criteria — TICKET-02, Phần 3 "Tính năng mới"

Tài liệu này đáp ứng DoD của `docs/requirements/phase-2.md` dòng 114: mỗi mục ở **Phần 3** phải có acceptance criteria. Đây là spec của Phase 2 (contract v1.1), **không phải** ticket change-request v1.2 trong `phase3.md`.

Quy ước: "đạt" nghĩa là có lệnh chạy được hoặc fixture/unit test tương ứng trong `docs/proof/phase-2/`. Mục nào chỉ kiểm được bằng mắt thì ghi rõ là kiểm thủ công — không tự động gán là đạt.

---

## 1. Gió Lạc (Đêm 2 và 3)

| ID | Acceptance criteria | Kiểm chứng |
|---|---|---|
| AC1.1 | Xuất hiện ở tick 1200, 2400, … chỉ khi `driftersEnabled` và không bị `random_drifters: false`; id `D1`, `D2`, …; tối đa 2 con cùng lúc. | Unit test `schedules > spawns drifters at tick 1200 on nights 2 and 3`. |
| AC1.2 | `idle` lượn 2 m/s; `chase`/`flee` bay 7 m/s; `idle → chase` khi Mây mang ≥ 5 và cách ≤ 15 m, mất điều kiện thì về `idle`. | `moveDrifters()` trong `src/sim/step.ts`; fixture headless `scenario-drifter.json`. |
| AC1.3 | Chạm XZ ≤ 1.2 m: cướp `min(3, carried)`, chuyển `flee`, bay 240 tick rồi `removed` cùng số đã cướp; mỗi con cướp 1 lần. | Unit test `drifters and charms > steals up to 3 motes then flees…`. |
| AC1.4 | Tỏa Sáng trúng `chase` → `flee` không cướp; trúng `flee` đang mang → phát `drifter_drop {drifter_id, amount}`, thả motes rơi tại chỗ, `removed` sau 120 tick. | Unit test ở trên (kiểm cả event `drifter_drop`) + verify check `Event drifter_drop`; fixture `inputs-drifter.json`. |
| AC1.5 | Không làm mất Ngọn Lửa; vùng an toàn của đèn không chặn; bất tử của Mây không ngăn bị cướp. | `contactDrifters()` không đọc `invuln`; unit test cướp với `carried` và không có `player_hit`. |

**Trạng thái: đạt** — headless `night 2`, fixture `scenario-drifter.json` + `inputs-drifter.json`, 2 verify check (`Drifter steal`, `Pulse makes drifter drop loot`, `Event drifter_drop`).

## 2. Bùa Gió

| ID | Acceptance criteria | Kiểm chứng |
|---|---|---|
| AC2.1 | Lá bùa đỏ viền vàng, id `C1`, `C2`; Đêm 2 tại (35,0,0), Đêm 3 tại (30,0,25) và (−30,0,25). | `NIGHTS[2|3].charmPoints` trong `src/sim/config.ts`; unit test `contract v1.1 > has the standard maps` (số đèn/điểm). |
| AC2.2 | Nhặt theo luật đom đóm (XZ ≤ 1 m, chênh cao ≤ 1.5 m); hiệu lực 600 tick, nhặt lại làm mới; xuất hiện lại sau 2700 tick. | Unit test `charm pickup boosts speed…` (600 tick); `pickupCharms()` + timer trong `step()`. |
| AC2.3 | Trong hiệu lực: tốc độ chạy 7.2 m/s, Lướt vẫn 14 m/s trong 12 tick nhưng **không hồi chiêu**; vẫn cần nhấn lại; nhấn khi đang lướt thì bỏ qua. | `movePlayer()` dùng `dashReady = dashCd === 0 || charmTicks > 0` và đặt `dashCd = 0` khi có bùa; verify check `Charm removes dash cooldown` với `inputs-charm.json` (2 dash trong 1.5 s). |
| AC2.4 | Bùa không làm đổi đầu ra headless khi chạy kịch bản không có bùa. | `scenario-features.json` không khai báo `charms` nhưng vẫn chạy tất định (verify `Phase 1 regression determinism`). |

**Trạng thái: đạt** — fixture `scenario-charm.json` + `inputs-charm.json`; snapshot có `charms[].{id, available, respawn_s}` và `player.charm_s`.

## 3. Chuỗi 3 Đêm

| ID | Acceptance criteria | Kiểm chứng |
|---|---|---|
| AC3.1 | Menu chính → màn giới thiệu (tên đảo + lời Ông Đăng) → chơi → kết quả → Đêm kế tiếp. | `menu()`, `intro()`, `result()` trong `src/main.ts`. |
| AC3.2 | Thắng Đêm 3 hiện màn "Bình Minh" kèm tổng điểm (`total_score` cộng dồn qua `createWorld({totalScore})`). | `result()` nhánh `phase === 'dawn'`; snapshot/end v1.1 có `total_score`. |
| AC3.3 | Thua được chơi lại đúng Đêm đó; Ngọn Lửa hồi đầy đầu mỗi Đêm. | Nút `replay` gọi `startNight(world.night)`; `createWorld()` lấy `TUNING.flames`. |
| AC3.4 | `--night` nhận 1, 2, 3; ngoài khoảng → exit 1. | Verify check `--night 2 accepted` và `Invalid --night exit 1`. |

**Trạng thái: đạt** (headless tự động) / kiểm GUI bằng mắt. Không có automated GUI test cho luồng menu — ghi nhận tại đây thay vì giả vờ có.

## 4. Tạm dừng (Esc/P)

| ID | Acceptance criteria | Kiểm chứng |
|---|---|---|
| AC4.1 | Chuyển `false → true` thì đổi trạng thái; tick vẫn tăng, `sim_tick`, `time_left_s`, hồi chiêu, spawn, TTL đứng yên; snapshot `state: "paused"`. | Unit test `night 3 wind and pause > pause increments tick…`; verify check `Pause freezes sim_tick`. |
| AC4.2 | Phát event `paused` / `resumed` đúng tick `k + 1`. | Verify checks `Event paused`, `Event resumed`; `docs/proof/phase-2/events.jsonl`. |
| AC4.3 | Menu tạm dừng có Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu. | `pausePanel()` trong `src/main.ts` (kiểm GUI bằng mắt). |

**Trạng thái: đạt** (logic + event tự động); menu kiểm bằng mắt.

## 5. Cài đặt

| ID | Acceptance criteria | Kiểm chứng |
|---|---|---|
| AC5.1 | Âm lượng 0–1 và độ nhạy chuột 0.2–3, lưu vào `localStorage` key `dao-den-long-settings`, đọc lại khi mở game. | `loadSettings()` / `saveSettings()` trong `src/main.ts`. |
| AC5.2 | Thay đổi có hiệu lực ngay trong phiên hiện tại (gain nhạc, hệ số xoay camera). | `saveSettings()` cập nhật `musicGain`; `pointermove` nhân `sensitivity`. |

**Trạng thái: đạt** (code) — kiểm GUI bằng mắt; không có unit test DOM.

## 6. Âm thanh

| ID | Acceptance criteria | Kiểm chứng |
|---|---|---|
| AC6.1 | Có hiệu ứng cho: nhặt, nạp/thắp đèn, Tỏa Sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s cuối. | `soundFor` + `beep()`; nhảy và đếm ngược phát trong `frame()` (GUI-only, không phát ra JSONL). |
| AC6.2 | Có nhạc nền đêm, tắt khi về menu/kết quả; âm lượng 0 thì không phát. | `startMusic()` / `stopMusic()`; `beep()` và `startMusic()` đều return sớm khi `volume <= 0`. |
| AC6.3 | Âm thanh không làm đổi đầu ra headless. | `src/sim/**` không import WebAudio; verify determinism vẫn identical. |

**Trạng thái: đạt** (code) — chất lượng âm thanh kiểm bằng mắt/tai; không có assertion tự động trên WebAudio.

## 7. HUD đầy đủ

| ID | Acceptance criteria | Kiểm chứng |
|---|---|---|
| AC7.1 | Ngọn Lửa trên trái; đồng hồ `mm:ss` ở giữa, đổi đỏ + nhấp nháy khi ≤ 30 s; đèn `k/n` và điểm trên phải. | `updateHud()` — lớp `.clock.blink`, `fmtTime()`. |
| AC7.2 | Thanh đom đóm 10 ô dưới giữa; biểu tượng hồi chiêu Lướt/Tỏa Sáng dưới phải. | `bars` (`■`/`□`) và `.cooldowns`. |
| AC7.3 | Nhắc `E — Nạp ánh sáng (x/10)` khi đứng gần đèn chưa sáng; mũi tên chỉ đèn chưa sáng gần nhất. | `near` / `.arrow` trong `updateHud()`. Mũi tên hiện theo khoảng cách, chưa dùng phép chiếu màn hình — ghi nhận giới hạn này. |
| AC7.4 | HUD không chặn chuột (overlay `pointer-events: none`). | CSS `#hud` trong `index.html`. |

**Trạng thái: đạt** (code) / kiểm GUI bằng mắt.

## 8. Bảng màu chuẩn

| Thành phần | Hex | Nơi áp dụng |
|---|---|---|
| Trời đêm / sương | `#0E1430` / `#1B2350` | `scene.background`, `scene.fog` |
| Cỏ / cát / gỗ / biển mây | `#2F5D50` / `#C9B48A` / `#6B4A2F` / `#12384A` | `buildMap()` |
| Đèn sáng / lõi / đèn tắt | `#FFB347` / `#FFE9B0` / `#5B5F6E` | `C.lit`, `C.core`, `C.off` |
| Đom đóm lõi / quầng | `#FFF6C2` / `#FFE58A` | `moteMaterial` |
| Bóng Mực thân / viền / choáng | `#120A1A` / `#7A3CFF` / `#3A3450` | `shadeMaterial`, `syncScene()` |
| Áo Mây / khăn + Bùa | `#E8E2D0` / `#C8102E` | `body`, `scarf`, `charmMaterial` |
| Viền vàng, điểm / Gió Lạc | `#F2C14E` / `#8FA3B8` | CSS `.panel`, `drifterMaterial` |
| UI nguy hiểm / chữ UI | `#FF5A5F` / `#F5F1E6` | `.clock.blink`, body |

**AC8.1:** mọi hex trên khớp ticket (sai lệch 0%). **Kiểm chứng:** đối chiếu hằng số `C` trong `src/main.ts`; không có pixel test tự động. **Trạng thái: đạt** (code review).

## 9. Ánh sáng & hiệu năng

| ID | Acceptance criteria | Kiểm chứng |
|---|---|---|
| AC9.1 | `ambient.intensity = 0.15 + 0.55 × (đèn sáng / tổng đèn)`, tăng dần theo tiến độ. | `syncScene()` trong `src/main.ts`. |
| AC9.2 | Một Đêm đầy đủ (≤ 21600 tick) chạy headless trong ≤ 30 s. | Verify check `Full night within 30 s` — 159 ms measured. |
| AC9.3 | GUI trung bình ≥ 30 FPS ở 1280×720. | `npm run fps` (Vite + headless Edge, `requestAnimationFrame` thật) → **60 FPS**; `docs/proof/phase-2/fps.txt`. |

**Trạng thái: đạt.**

---

## Tóm tắt bằng chứng

| Mục Phần 3 | Scenario headless / unit test | Verify check |
|---|---|---|
| Gió Lạc | `scenario-drifter.json`, `inputs-drifter.json` | Drifter steal · Pulse makes drifter drop loot · Event drifter_drop |
| Bùa Gió | `scenario-charm.json`, `inputs-charm.json` | Charm pickup · Charm removes dash cooldown |
| Chuỗi 3 Đêm | `scenario-features.json`, `scenario-night3.json`, `scenario-spawn.json` | --night 2 accepted · Invalid --night exit 1 · Event night_start |
| Tạm dừng | `inputs-features.json` | Pause freezes sim_tick · Event paused · Event resumed |
| Cài đặt / Âm thanh / HUD / Màu | GUI (`src/main.ts`, `index.html`) | GUI ≥ 30 FPS @ 1280×720 · Snapshot v1.1 fields |
| Ánh sáng / hiệu năng | `scenario-spawn.json` (21600 tick) | Full night within 30 s |
