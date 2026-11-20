# Đảo Đèn Lồng

> Game 3D góc nhìn thứ ba — Day 12 AI SDLC lab.
> **Video demo:** _sẽ cập nhật ở Phase 4 (Release `v1.0.0`)_.

Bạn là **Mây**, người giữ đèn nhỏ tuổi. Ba đêm, ba hòn đảo — gom đom đóm, thắp lại các Đèn Lồng Lớn trước khi trời sáng, né Bóng Mực, Gió Lạc và những cơn gió lạc trên đảo.

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
| Kéo chuột | Xoay camera (độ nhạy trong Cài đặt) |
| `Space` | Nhảy (7 m/s, chỉ khi chạm đất) |
| `Shift` | Lướt 14 m/s trong 0.2 s, hồi chiêu 1.5 s |
| `E` | Nạp đom đóm vào đèn gần nhất (đom đóm tự nhặt khi chạm) |
| `Q` | Tỏa Sáng: tốn 3 đom đóm, choáng Bóng Mực, hồi chiêu 3 s |
| `Esc` / `P` | Tạm dừng (Tiếp tục / Chơi lại / Cài đặt / Về menu) |

## Luật chơi — Test Contract v1.1

- **Số liệu chuẩn:** 60 tick/giây; chạy 6 m/s (tăng tốc ≤ 0.1 s); nhảy 7 m/s với trọng lực −20 m/s²; lướt 14 m/s / 0.2 s / 1.5 s.
- **Đom đóm:** tự nhặt khi XZ ≤ 1 m và chênh cao ≤ 1.5 m; sức chứa 10; bắt đầu 20 con tại 20 điểm, trần 30, cứ 240 tick thêm 1 con ở điểm trống.
- **Đèn:** chi phí 10, nạp nhiều lần, chỉ xét đèn chưa sáng (gần nhất, bằng nhau chọn id nhỏ hơn); đèn sáng tạo vùng an toàn bán kính 6 m, Bóng Mực bị đẩy ra mép trong tối đa 30 tick.
- **Bóng Mực:** 4 m/s (Đêm 3 là 4.5), phát hiện 12 m / bỏ đuổi 18 m; chạm → mất 1 Ngọn Lửa, rơi `floor(carried/2)` đom đóm, bất tử 90 tick; sinh 2 con ở tick 300 rồi theo lịch từng đêm.
- **Gió Lạc (Đêm 2, 3):** bay 7 m/s, cướp tối đa 3 đom đóm rồi bay ra xa; Tỏa Sáng làm nó thả đồ lại (`drifter_drop`).
- **Bùa Gió:** hiệu lực 600 tick — chạy 7.2 m/s và lướt không hồi chiêu (vẫn phải nhấn lại); mọc lại sau 2700 tick.
- **Rơi khỏi đảo (Y < −10):** mất 1 lửa + toàn bộ đom đóm, chờ 60 tick rồi hồi sinh bất tử 90 tick. `fall_enabled: true`.
- **Thời gian:** Đêm 1/2/3 = 300/330/360 s. Hết lửa → thua ngay; thắp hết đèn → thắng; hết giờ mà chưa xong → thua.
- **Điểm:** +10 mỗi đom đóm nạp, +100 mỗi đèn thắp, +5 mỗi Bóng Mực trúng Tỏa Sáng; thưởng `floor(giây còn lại) × 2 + 50 × lửa` khi thắng. Tổng điểm là tổng các Đêm đã thắng.

### Ba đêm

| Đêm | Tên | Bản đồ | Cơ chế riêng |
|---|---|---|---|
| 1 | Đảo Bến | Đảo tròn bán kính 40 m, 5 đèn | Làm quen, Bóng Mực sinh mỗi 8 s |
| 2 | Đảo Cau | 2 đảo bán kính 28 m nối cầu, bục nhảy, 6 đèn | Gió Lạc, Bùa Gió, Bóng Mực mỗi 7 s |
| 3 | Đảo Chuông | 3 tầng Y=0/3/6, dốc, tháp chuông, 7 đèn | Gió 5 s sau mỗi 30 s (báo trước 2 s), Bóng Mực mỗi 6 s |

## Kiểm thử & chế độ headless

```bash
npm test            # unit test (30 tests)
npm run typecheck   # tsc --noEmit
npm run verify      # test + typecheck + headless build + tất định + exit code + FPS, ghi docs/proof/
npm run fps         # đo FPS GUI thật ở 1280×720 (cần Chrome/Edge)
npm run verify -- phase-2
```

Chạy headless theo Test Contract v1.1 (60 tick/giây, không cần GPU):

```bash
npm run build:headless
node dist/headless.mjs --seed 7 --night 1 \
  --scenario tests/fixtures/scenario-features.json \
  --inputs tests/fixtures/inputs-features.json \
  --ticks 600 --snapshot-every 10 --out .tmp/run.jsonl
```

- `--night` nhận `1`, `2`, `3` (ngoài khoảng → exit 1).
- `--scenario`, `--inputs` là tùy chọn; không có thì dùng mặc định của game.
- Mã thoát: `0` thành công, `1` lỗi tham số/file không tồn tại, `2` file sai định dạng.
- Cùng `--seed` + night + scenario + inputs cho output **giống hệt** (sha256 trong `npm run verify`).
- Fixture theo từng tính năng mới nằm ở `tests/fixtures/` (`scenario-drifter`, `scenario-charm`, `scenario-fall`, `scenario-night3`, `scenario-spawn`, …).
- Bằng chứng Phase 2: `docs/proof/phase-2/` (37 check, regression Phase 1 bằng số chuẩn, FPS 60 @ 1280×720).

Các con số gameplay (`tuning`) nằm trong [`game.contract.json`](game.contract.json) và phải khớp `src/sim/config.ts` — có test tự động chặn nếu lệch.

## Cấu trúc

```text
src/sim/       logic thuần: world, step, geometry, input, scenario, output (không DOM)
src/main.ts    GUI Three.js (chỉ đọc World và vẽ)
src/headless/  runner JSONL theo Test Contract
tests/         unit test + fixture scenario/inputs
scripts/       verify.mjs (kiểm chứng + bằng chứng), fps.mjs (benchmark GUI)
docs/notes/    giả định, quyết định, nhật ký AI, retro
docs/proof/    bằng chứng từng phase
docs/requirements/  ticket gốc + spec acceptance criteria
```

## Sáng tạo của tôi

- **Bóng Mực xuất hiện theo sóng:** mỗi đêm một nhịp sinh riêng (8 s / 7 s / 6 s), tạo áp lực tăng dần mà không cần asset mới.
- **Đèn là khu an toàn:** Bóng Mực bị chặn ở rìa `safe_radius`; người chơi dùng đèn làm chỗ trú.
- **Pulse hy sinh tài nguyên:** xua bóng tiêu 3 đom đóm, ép người chơi cân bằng giữa nạp đèn và tự vệ.
- **Gió Lạc cướp đồ:** dải lụa bay nhanh cướp đom đóm rồi tháo chạy — bị Tỏa Sáng thì thả lại tại chỗ.
- Toàn bộ hình khối tự sinh bằng Three.js, không dùng asset ngoài (xem `CREDITS.md`).

## Tài liệu lab

| File | Nội dung |
|---|---|
| [GUIDE.md](GUIDE.md) | Hướng dẫn làm lab |
| [CHECKPOINTS.md](CHECKPOINTS.md) | Các mốc tự kiểm tra |
| [SUBMISSION.md](SUBMISSION.md) | Quy định nộp bài |
| [RULES.md](RULES.md) | Quy định lab |
| [RUBRIC.md](RUBRIC.md) | Thang điểm |
| [docs/requirements/phase-1.md](docs/requirements/phase-1.md) | PRD-0 + Test Contract v1.0 |
| [docs/requirements/phase-2.md](docs/requirements/phase-2.md) | TICKET-02 + Test Contract v1.1 |
| [docs/requirements/phase-2-part3-acceptance.md](docs/requirements/phase-2-part3-acceptance.md) | Acceptance criteria Phần 3 |

## Giấy phép

MIT — xem [LICENSE](LICENSE). Nguồn asset và công cụ AI: [CREDITS.md](CREDITS.md).
