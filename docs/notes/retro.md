# Retro

Tổng hợp cuối dự án (điền dần, hoàn thiện ở Phase 4).

## Phase 0

- **Hiệu quả:** chốt kiến trúc "sim thuần + hai đầu ra" trước khi viết gameplay; nhờ vậy headless và GUI dùng chung logic ngay từ đầu.
- **Chưa hiệu quả:** chưa có gameplay thật, mới chỉ chứng minh đường ống (pipeline) chạy được.
- **Nếu làm lại:** dựng `game.contract.json` + test đồng bộ tuning trước cả khi viết `step()`.

## Phase 1

- **Hiệu quả:** tách `src/sim` thuần từ ngày CP0 nên gameplay mới thêm nhưng headless, GUI và unit test vẫn dùng chung một `step()`; không phải sửa luật ở hai nơi.
- **Chưa hiệu quả:** mất thời gian do fixture đặt người chơi trong vùng an toàn của đèn; cũng từng trừ `stunT` sai một tick. Cả hai đều là lỗi của mình, không phải contract.
- **Bài học harness:** cần thêm test ngay cho "thời gian hiệu lực tính từ tick kích hoạt", và phải đọc kỹ tương tác giữa các tham số (`safe_radius` vs `shade_hit_radius`) khi dựng scenario.
- **Nếu làm lại:** viết bảng giả định trước khi code (đã làm) rồi chuyển mỗi dòng thành một unit test ngay lập tức.

## Phase 2

- **Hiệu quả:** giữ nguyên hợp đồng "sim thuần + hai đầu ra" nên dù thay gần như toàn bộ luật (v1.0 → v1.1), headless, GUI và unit test vẫn dùng chung một `step()`. Regression Phase 1 chỉ cần chạy lại fixture cũ.
- **Hiệu quả:** script `verify` sinh ra bảng evidence có tên từng check — reviewer chỉ cần đọc `summary.md` là thấy ngay chỗ chưa đạt, không phải đoán.
- **Chưa hiệu quả:** mất 4 lượt verify chỉ để sửa fixture (thời gian chạy, snapshot, dash) thay vì lỗi logic. Nên viết một helper "assert fixture có đủ event mong đợi" trước khi chạy verify.
- **Bài học harness:** mọi event mới trong contract phải có một dòng tương ứng trong `verify.mjs` — nhờ vậy mới phát hiện thiếu `drifter_drop` dù unit test đã xanh.
- **Bài học đo lường:** `--window-size` của headless browser không phải viewport; phải override bằng CDP mới dám ghi số FPS vào bằng chứng.
- **Nếu làm lại:** tạo skeleton type + contract mirror + test trước, rồi mới viết `step()` theo đúng thứ tự 11 bước — sẽ tránh được các lỗi `world.tuning`, `spec.duration` ngay từ đầu.
