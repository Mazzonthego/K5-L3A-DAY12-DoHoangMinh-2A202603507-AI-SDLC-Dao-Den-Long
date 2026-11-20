# ADR-001 — Mô hình trạng thái đèn và luật thắng mới (TICKET-03, v1.2)

- Ngày: 2026-11-20
- Trạng thái: Accepted
- Phạm vi: `src/sim/**`, `src/main.ts`, `game.contract.json`, `scripts/verify.mjs`

## Bối cảnh

Phase 2 cho phép thắp đèn là thắng ngay; đèn sáng không bao giờ tắt. Playtest cho thấy trận đấu kết thúc sau ~2 phút, mất phần căng thẳng cuối đêm. TICKET-03 thay luật: đèn có nhiên liệu, có thể tắt và thắp lại; mục tiêu là giữ số đèn tối thiểu tới bình minh.

## Quyết định

### 1. Nhiên liệu là số nguyên đơn vị 1/60

`Lantern.fuel` lưu số nguyên `1/60` điểm dầu (`FUEL_MAX_UNITS = 6000` = 100 dầu). Hao hụt trừ đúng 1 đơn vị/tick, Bóng Mực `drain` trừ đúng 5 đơn vị/tick. Chỉ `src/sim/output.ts` làm tròn 1 chữ số khi ghi JSONL; `src/main.ts` chia `FUEL_MAX_UNITS` để vẽ thanh dầu.

**Lý do:** tránh sai số tích lũy của `0.01666…` trong 21 600 tick; output hai lần chạy cùng seed phải byte-identical. Hệ quả: ngay sau tick đầu tiên một đèn «đầy» có 99,983 dầu, nên `ceil((100 − fuel)/10) = 1` — đúng công thức contract, và được unit test ghi nhận rõ.

### 2. Vòng đời đèn là máy trạng thái có quá khứ

`never lit → lit → (fuel ≤ 0) out → (thắp lại 5 đom đóm) lit → …`

- `ever_lit` và `relit_count` được lưu trên `Lantern` (và xuất ra snapshot). `deposited` reset về 0 khi đèn tắt.
- `successful_lights` chỉ tăng khi `lantern_lit` thật sự xảy ra trong sim; đèn dựng bằng scenario **không** tính, theo contract.
- `capacity = min(20, 10 + 2 × successful_lights)` được tính lại ngay tại sự kiện thắp và khi tạo world.

**Lý do:** cần phân biệt chi phí thắp lần đầu (10) và thắp lại (5) mà không suy luận từ `lit` hiện tại; đồng thời không để scenario fabrication tăng điểm/sức chứa.

### 3. Đèn yếu mất vùng an toàn, Bóng Mực có trạng thái `drain`

`fuel < 30` → bỏ qua đèn trong `updateSafeZones()` và `clampToSafeZones()`; đúng 30 vẫn bảo vệ. `wander` ưu tiên đèn đang sáng mà yếu, rồi đèn tắt, tie theo id nhỏ hơn. Khi cách ≤ 2 m → `drain` (đứng yên, hút 5/s, cộng dồn nhiều con). Thoát `drain` theo bốn điều kiện contract; châm lên ≥ 30 thì các bóng trong 6 m bị đẩy ra mép trong 30 tick, không gây sát thương.

**Lý do:** tạo áp lực liên tục ở cuối đêm mà không thêm entity; trạng thái mới là một nhánh rõ ràng trong `moveShades()`, không dùng cờ rời rạc.

### 4. Thắng ở bình minh, không thắng sớm

Bỏ `all_lit`. Ở cuối mọi tick (kể cả tick bình minh), ưu tiên `flames <= 0 → no_flames`; nếu `timeLeft <= 0` thì đếm đèn đang sáng, `≥ ceil(0.6 × tổng đèn)` → `dawn_survived`, ngược lại `dawn`.

**Lý do:** thứ tự «hết lửa luôn thua trước» phải đúng ngay cả khi hai điều kiện xảy ra cùng tick; đặt đoạn kiểm tra ở cuối `step()` sau mọi cập nhật nên không có nhánh nào bị bỏ lỡ.

### 5. Điểm thưởng bình minh gắn với đèn còn sáng

Bỏ `per_second_left`. Khi thắng: mỗi đèn sáng `50 + floor(fuel)`, mỗi Ngọn Lửa `50`; mỗi đom đóm nạp `+5`, thắp `+100`, thắp lại `+40`, choáng bóng `+5` (`+15` nếu đang `drain`).

**Lý do:** thưởng cho việc **duy trì** đèn đến bình minh thay vì thưởng cho tốc độ thắp.

## Hệ quả / điều bị thay thế

- `contract_version` 1.1 → 1.2; snapshot thêm `fuel`, `ever_lit`, `relit_count`, `capacity`; thêm `drain` và `target_lantern_id`.
- Sự kiện mới: `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit` thêm `relight`; `game_over.reason = dawn_survived` thay `all_lit`.
- Thời lượng đêm 300/330/360 → 240/270/300 s.
- Test/verify của Phase 1–2 vẫn chạy lại qua fixture cũ; chỉ các kỳ vọng bị luật mới thay thế được sửa, có lý do ghi tại `docs/notes/decisions.md`.
