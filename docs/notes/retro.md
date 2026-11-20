# Retro

Tổng hợp cuối dự án — đã hoàn thiện ở Phase 4 (release `v1.0.0`).

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

## Phase 3 — «Đèn cạn dầu» (contract v1.2)

- **Hiệu quả:** kiến trúc «sim thuần + hai đầu ra» một lần nữa chịu được change request lớn: nhiên liệu, trạng thái bóng mới, luật thắng và điểm đổi gần như toàn bộ nhưng GUI chỉ đọc thêm vài field, headless vẫn cùng một `step()`.
- **Hiệu quả:** viết ADR ngay sau khi đọc ticket giúp chốt các chi tiết dễ lệch (decay trước tương tác, `fuel = 30` vẫn an toàn, hết lửa thua trước cả bình minh) trước khi code.
- **Chưa hiệu quả:** 3 unit test sai do mình quên hệ quả của «decay chạy ở bước 2» và «drain chỉ trên đèn yếu»; mất một lượt test để sửa. Đã ghi lý do từng test trong `decisions.md`, không skip.
- **Bài học harness:** mỗi event mới (`refuel`, `lantern_out`, `fuel_drain`) phải có một dòng riêng trong `verify.mjs` — 50 check mới phát hiện đủ 7 luật mới qua fixture riêng.
- **Bài học đo lường:** `npm run fps` phải nhận tên phase để không ghi đè bằng chứng cũ; FPS sau khi thêm 3 mesh/đèn vẫn 60 @ 1280×720.
- **Nếu làm lại:** dựng bảng «tick order» thành comment ngay đầu `step()` rồi mới sửa từng bước; đồng thời tạo fixture tối thiểu cho từng luật **trước** khi viết unit test sẽ tránh được việc fixture drain sai ngưỡng 30.

## Phase 4 — «Bình minh» (contract v1.3, release v1.0.0)

- **Hiệu quả:** coi benchmark/soak/leaderboard là *công cụ ngoài sim*. Nhờ giữ `src/sim` thuần, hai script mới chỉ cần `dist/sim.mjs` và không đụng vào một dòng gameplay — đầu ra JSONL v1.2 giữ nguyên, mọi test ẩn cũ vẫn đạt.
- **Hiệu quả:** đo thật bằng Chrome/CDP thay vì ước lượng. Số bench (114 FPS trung bình, p1 35.9 FPS, load 6.8 s) và soak (0 crash, 46.1 → 51.7 MB) được commit thành `bench.json`/`soak.json`, verify chỉ đọc và đối chiếu — không có số «tưởng tượng».
- **Chưa hiệu quả:** mất một lượt bench vì Vite watch quét cả `.tmp/bench-profile`, gây reload liên tục lúc đo. Sửa bằng `server.watch.ignored` trong `vite.config.ts`. Đây là lỗi harness, không phải lỗi game.
- **Bài học harness:** `AGENTS.md` (luật bất di bất dịch: sim thuần, exit code, tick order) + skill `verify` + pre-commit hook là bộ ba có ích nhất. Riêng pre-commit đã chặn nhiều lần tôi định commit khi unit test đỏ; skill `verify` nhắc chạy `npm run fps -- phase-N` nên không ghi đè bằng chứng phase cũ.
- **Lần AI sai và cách phát hiện:** (1) tưởng `time_left_s` mặc định vẫn 300 trong khi fixture override 300 — verify đỏ ở Phase 3, sửa bằng fixture riêng; (2) test leaderboard dùng tên `P1…` chỉ 2 ký tự nên bị bộ lọc tên loại, còn 3 mục — unit test đỏ ngay, đổi tên `Player1…`; (3) `cdpClient` tham chiếu chính nó trước khi định nghĩa trong hàm `evaluate` — typecheck/build bắt được, tách biến `send`; (4) tưởng script demo có ffmpeg sẵn — thực tế phải cài tạm `ffmpeg-static` vào `.tmp/` (bị ignore) và ghi rõ trong CREDITS. Mọi lần đều phát hiện bằng lệnh thật, không phải «tin agent nói» (đúng quy tắc AGENTS.md).
- **Token/chi phí:** ước tính ~300–350k token đầu vào + đầu ra cho cả 4 phase (Phase 2 ~90k, Phase 3 ~90k, Phase 4 ~120k, còn lại là CP0/Phase 1). Chạy ở tier miễn phí nên chi phí tiền ≈ 0đ. Tiết kiệm bằng cách: đọc ticket một lần rồi chép vào `docs/requirements/` thay vì hỏi lại; giữ fixture và script verify tăng dần thay vì viết lại; dùng `grep`/`read` có offset thay vì đổ toàn bộ file; chạy `npm test` ngay sau mỗi đổi sim để dừng sớm.
- **Nếu làm lại:** dừng phát triển GUI đúng lúc contract đã xanh rồi mới làm benchmark — ở đây tôi đụng cả hai cùng lúc nên một lỗi Vite watch làm bench bị reload. Ngoài ra nên sinh sẵn một fixture leaderboard mẫu ngay từ đầu để export có dữ liệu thật, thay vì board rỗng (dù export roundtrip đã được kiểm chứng bằng API POST).
