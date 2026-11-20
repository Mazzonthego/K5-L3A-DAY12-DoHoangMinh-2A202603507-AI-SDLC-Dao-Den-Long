# Evidence phase-4 — Test Contract v1.3

Generated on 2026-11-20T10:56:19.541Z.

| Requirement | How checked | Result |
|---|---|---|
| Unit tests | npm test | đạt |
| Type check | npm run typecheck | đạt |
| Determinism | two runs, equal sha256 | đạt — 3593f2bb62b52bf031bcdbf9a0f2ed497a9a2900c9d976fbe68328be9f41333b |
| Phase 1 regression determinism | scenario-basic.json + walk.json replayed twice | đạt — 2c34161b0852491d9c66ac6f946e4a22f229db6c26ce4a6420ce11eeb4740b54 |
| Phase 1 regression: 60 ticks = 1 s | snapshot tick 60 time_left_s | đạt |
| Phase 1 regression: speed 6 m/s | snapshot tick 60 vel | đạt |
| Phase 1 regression: mote pickup | headless replay | đạt |
| Phase 1 regression: 3 flames lost → game over | game_over reason no_flames | đạt |
| Snapshot v1.2 fields | first snapshot | đạt |
| Coordinates rounded to 3 decimals | snapshot player pos | đạt |
| Event night_start | scenario-features.json + inputs-features.json | đạt |
| Event mote_picked | scenario-features.json + inputs-features.json | đạt |
| Event pulse | scenario-features.json + inputs-features.json | đạt |
| Event dash | scenario-features.json + inputs-features.json | đạt |
| Event deposit | scenario-features.json + inputs-features.json | đạt |
| Event lantern_lit | scenario-features.json + inputs-features.json | đạt |
| Event paused | scenario-features.json + inputs-features.json | đạt |
| Event resumed | scenario-features.json + inputs-features.json | đạt |
| Event game_over | scenario-features.json + inputs-features.json | đạt |
| Pause freezes sim_tick | snapshots around pause frames | đạt |
| Event tick = k+1 | event list | đạt |
| End line | last line | đạt |
| Drifter steal | night 2 drifter fixture | đạt |
| Pulse makes drifter drop loot | dropped motes appear after pulse | đạt |
| Event drifter_drop | night 2 drifter fixture | đạt |
| Charm pickup | night 2 charm fixture | đạt |
| Charm removes dash cooldown | two dash events within 1.5 s | đạt |
| Fall event carries lost field | night 1 fall fixture | đạt |
| Night 3 pad launch | player Y rises above the pad | đạt |
| Night 3 wind warning | tick 1800 snapshot | đạt |
| Shade spawn schedule | 2 shades at tick 300, 1 at tick 780 | đạt |
| --night 2 accepted | headless run | đạt |
| Night durations 240/270/300 s | headless snapshot without time_left_s | đạt |
| Fuel decays 1/s and lantern_out at 0 | 1 fuel lantern, 60 ticks → lantern_out | đạt |
| Lantern off exposes fuel 0 and ever_lit | snapshot after lantern_out | đạt |
| Refuel event and fuel restore | 10 motes spent on a 20-fuel lantern | đạt |
| Refuel above 30 ends drain and pushes shade | shade leaves drain after refuel | đạt |
| Drain state reported in snapshots | weak lantern + shade in drain | đạt |
| fuel_drain event each second | 60 ticks of drain | đạt |
| Multiple drains are cumulative | fuel below 23 after one second of decay + drain | đạt |
| Relight costs 5 motes and awards +40 | lantern_lit event with relight=true | đạt |
| Relight grows capacity by 2 | snapshot capacity 12 | đạt |
| Dawn win needs ceil(0.6 x 5) = 3 lit lanterns | game_over dawn_survived | đạt |
| Dawn loss when fewer than 3 lanterns are lit | game_over dawn | đạt |
| Capacity = 10 + 2 x successful_lights capped at 20 | 6 successful lights → 20 | đạt |
| Full night within 30 s | 21600 ticks, night 3 | đạt — 235 ms |
| GUI ≥ 30 FPS @ 1280×720 | npm run fps (real requestAnimationFrame) | đạt — 58.8 FPS |
| Malformed inputs exit 2 | spawnSync | đạt |
| Missing file exit 1 | spawnSync | đạt |
| Invalid --night exit 1 | spawnSync | đạt |
| Contract v1.3 commands | game.contract.json | đạt |
| Bench schema | bench.json from bench_cmd | đạt |
| Bench thresholds (reference machine) | avg ≥ 60, p1 ≥ 30, load ≤ 10000 ms | đạt — 114.2 / 35.9 / 6825 ms |
| Bench peak_mem explained | web build records null plus README note | đạt |
| Soak schema | soak.json from soak_cmd | đạt |
| Soak memory ≤ 1.2× | RSS start vs end | đạt — 46.1 → 51.7 MB |
| Leaderboard export | run_cmd --export-leaderboard | đạt |
| Packaging files | README/CREDITS/LICENSE/retro/ticket/demo | đạt |
| Demo under 100 MB | docs/demo/demo.mp4 | đạt — 1.3 MB |
| Accessibility hooks | rebinding / subtitles / reduced motion / font scale | đạt |
| Clean-clone commands | README documents ≤ 3 commands | đạt |

## Unit tests

```
> dao-den-long@0.1.0 test
> vitest run


 RUN  v5.1.1 E:/Vinuni/K5-L3A-DAY12-DoHoangMinh-2A202603507-AI-SDLC-Dao-Den-Long


 Test Files  1 passed (1)
      Tests  43 passed (43)
   Start at  17:56:15
   Duration  328ms (tests 48%, transform 27%, import 20%, worker 5%)
```

## Determinism

- sha256 (both runs): `3593f2bb62b52bf031bcdbf9a0f2ed497a9a2900c9d976fbe68328be9f41333b`
- identical: **true**

## Phase 1 regression

- sha256 (both runs): `2c34161b0852491d9c66ac6f946e4a22f229db6c26ce4a6420ce11eeb4740b54`
- 60 ticks → time_left_s 299 (the v1.1 fixture overrides it to 300), speed 6 m/s, mote pickup and no_flames game over all preserved.

## Performance

21600 ticks in **235 ms** (limit 30000 ms).

## GUI performance

# FPS benchmark — 1280×720

- Trình duyệt: C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe
- Kích thước: 1280×720 (DPR 1)
- Các mẫu FPS (mỗi mẫu trung bình 60 frame): [60,56.3,60]
- FPS trung bình: **58.8**
- Kết quả: **đạt** (ngưỡng ≥ 30)

Đo bằng `npm run fps -- phase-4` (Vite + headless Edge/Chrome, requestAnimationFrame thật).

## Benchmark

- avg 114.2 FPS · p1 35.9 FPS · p95 13.7 ms · 3440 frames · load 6825 ms.
- Renderer: Three.js r187 / ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)
- OS: win32 10.0.26200
- peak_mem_mb = null (web build; CDP exposes JS heap, not process RSS — explained in README).

## Soak

- 10 nights, 0 crashes, results: lost, lost, lost, lost, lost, lost, lost, lost, lost, lost.
- RSS 46.1 → 51.7 MB (limit 55.3 MB), 0.1 s.
