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
| `E` | Tương tác (nhặt đom đóm, nạp đèn) — Phase 1 |
| `Q` | Pulse xua Bóng Mực — Phase 1 |
| `Space` | Nhảy — Phase 1 |

## Kiểm thử & chế độ headless

```bash
npm test            # unit test
npm run verify      # test + build headless + kiểm tra tất định, ghi docs/proof/
```

Chạy headless theo Test Contract v1.0 (60 tick/giây, không cần GPU):

```bash
npm run build:headless
node dist/headless.mjs --seed 7 --night 1 \
  --scenario tests/fixtures/scenario-basic.json \
  --inputs tests/fixtures/walk.json \
  --ticks 600 --snapshot-every 60 --out .tmp/run.jsonl
```

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

_Chưa có (Phase 0). Sẽ bổ sung ở Phase 1–4 và ghi bằng chứng ngắn._

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
