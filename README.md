# Đảo Đèn Lồng

> Game 3D góc nhìn thứ ba — Day 12 AI SDLC lab.
> **Video demo:** _sẽ cập nhật ở Phase 4 (Release `v1.0.0`)_.

Bạn là **Mây**, người giữ đèn nhỏ tuổi. Gom đom đóm, thắp lại 5 Đèn Lồng Lớn trước khi trời sáng, và né những **Bóng Mực** đang trôi trong sương đen.

## Cài đặt & chạy

```bash
npm ci
npm run dev        # mở http://localhost:5173
```

Build bản tĩnh + headless:

```bash
npm run build
```

## Điều khiển

| Phím | Tác dụng |
|---|---|
| `W A S D` / phím mũi tên | Di chuyển theo hướng camera |
| Kéo chuột | Xoay camera |
| `E` | Nạp đom đóm vào đèn gần nhất (đom đóm tự nhặt khi chạm) |
| `Q` | Pulse xua Bóng Mực (tốn 2 đom đóm, hồi chiêu 3 s) |
| `Space` | Dự trữ cho nhảy (chưa ảnh hưởng gameplay) |

## Luật chơi Phase 1

- Đom đóm tự được nhặt khi người chơi tiến vào bán kính `pickup_radius` (1 con/tick, tối đa `carry_capacity`).
- Đèn nhận tối đa `lantern_cost` đom đóm; đủ 5 con thì sáng. Thắp cả 5 đèn là thắng ngay (`all_lit`).
- Bóng Mực đuổi người chơi với tốc độ `shade_speed`; không vào được vùng `safe_radius` quanh đèn đã sáng.
- Bị chạm: mất 1 lửa, rơi một nửa số đom đóm đang mang, miễn nhiễm `invuln_s`. Hết lửa là thua.
- Pulse làm choáng và đẩy Bóng Mực trong bán kính `pulse_radius`; mỗi con bị choáng cho `per_stun` điểm.
- Thắng sớm được cộng điểm theo thời gian còn lại và số lửa còn lại (xem bảng `score` trong contract).
- Cứ 30 giây xuất hiện thêm 1 Bóng Mực (tối đa 8). Chỉ `random_shades: false` trong scenario mới tắt cơ chế này; một danh sách `shades` được chỉ định chỉ thay thế danh sách ban đầu.
- Không có rơi khỏi đảo (`fall_enabled: false`): contract không định nghĩa địa hình, nên không phát sự kiện `player_hit` với `by: "fall"`.

## Kiểm thử & chế độ headless

```bash
npm test            # unit test
npm run verify      # test + typecheck + build headless + tất định + exit code, ghi docs/proof/
```

Chạy headless theo Test Contract v1.0 (60 tick/giây, không cần GPU):

```bash
npm run build:headless
node dist/headless.mjs --seed 7 --night 1 \
  --scenario tests/fixtures/scenario-play.json \
  --inputs tests/fixtures/inputs-play.json \
  --ticks 600 --snapshot-every 60 --out .tmp/run.jsonl
```

Fixture `scenario-play.json` + `inputs-play.json` kích hoạt toàn bộ sự kiện Phase 1 (`mote_picked`, `deposit`, `lantern_lit`, `pulse`, `player_hit`, `game_over`); đầu ra mẫu nằm ở `docs/proof/phase-1/events.jsonl`.

- `--scenario`, `--inputs` là tùy chọn; không có thì dùng mặc định của game.
- Mã thoát: `0` thành công, `1` lỗi tham số, `2` file scenario/inputs sai định dạng.
- Cùng `--seed` + scenario + inputs cho output **giống hệt** (đã kiểm bằng sha256 trong `npm run verify`).

Các con số gameplay (`tuning`) nằm trong [`game.contract.json`](game.contract.json) và phải khớp `src/sim/config.ts` — có test tự động chặn nếu lệch.

## Cấu trúc

```text
src/sim/       logic thuần: world, step, input, scenario, output (không DOM)
src/main.ts    GUI Three.js (chỉ đọc World và vẽ)
src/headless/  runner JSONL theo Test Contract
tests/         unit test + fixture scenario/inputs
scripts/       verify.mjs — một lệnh kiểm chứng + ghi bằng chứng
docs/notes/    giả định, quyết định, nhật ký AI, retro
docs/proof/    bằng chứng từng phase
```

## Sáng tạo của tôi

- **Bóng Mực xuất hiện theo sóng:** mỗi 30 s thêm một bóng từ mép đảo (id `S4`, `S5`, …), tạo áp lực tăng dần mà không cần asset mới.
- **Đèn là khu an toàn:** Bóng Mực bị chặn ở rìa `safe_radius` quanh đèn sáng — người chơi có thể dùng đèn làm chỗ trú.
- **Pulse hy sinh tài nguyên:** xua bóng tiêu 2 đom đóm, vừa phòng thủ vừa ép người chơi cân bằng giữa nạp đèn và tự vệ. Phần 3D dùng hình khối tự sinh, không dùng asset ngoài (xem `CREDITS.md`).

## Tài liệu lab

| File | Nội dung |
|---|---|
| [GUIDE.md](GUIDE.md) | Hướng dẫn làm lab |
| [CHECKPOINTS.md](CHECKPOINTS.md) | Các mốc tự kiểm tra |
| [SUBMISSION.md](SUBMISSION.md) | Quy định nộp bài |
| [RULES.md](RULES.md) | Quy định lab |
| [RUBRIC.md](RUBRIC.md) | Thang điểm |
| [docs/requirements/phase-1.md](docs/requirements/phase-1.md) | PRD-0 + Test Contract v1.0 |

## Giấy phép

MIT — xem [LICENSE](LICENSE). Nguồn asset và công cụ AI: [CREDITS.md](CREDITS.md).
