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
