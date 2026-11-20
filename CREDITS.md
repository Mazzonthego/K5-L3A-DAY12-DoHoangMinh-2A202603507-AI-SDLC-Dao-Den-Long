# Credits

## Assets

| Asset | Source | License |
|---|---|---|
| 3D geometry (island, lanterns, motes, shades, drifters, player, charm) | Generated procedurally in code with Three.js primitives | Own work |
| Screenshot `docs/demo/screenshot.png` | Captured from this game via Chrome DevTools Protocol | Own work |
| Demo video `docs/demo/demo.mp4` | Screen recording of this game via CDP screencast + ffmpeg | Own work |
| Fonts | System UI fonts (`system-ui`) | System-provided |
| Audio | WebAudio oscillator beeps and generated background music (no sample files) | Own work |

## Libraries & tools

| Tool | License | Used for |
|---|---|---|
| [Three.js](https://threejs.org/) | MIT | 3D rendering |
| [Vite](https://vite.dev/) | MIT | Dev server, static build, leaderboard API plugin |
| [TypeScript](https://www.typescriptlang.org/) | Apache-2.0 | Gameplay + GUI source |
| [Vitest](https://vitest.dev/) | MIT | Unit tests |
| [esbuild](https://esbuild.github.io/) | MIT | Headless + sim bundles |
| [husky](https://typicode.github.io/husky/) | MIT | Pre-commit hooks |
| [ffmpeg](https://ffmpeg.org/) (local tool, `ffmpeg-static` downloaded into ignored `.tmp/`) | LGPL/GPL build | Encoding the demo video only; not a project dependency |
| Chrome / Edge DevTools Protocol | Browser vendor | Benchmark, FPS measurement and video capture |

## AI tools

| Tool | Used for |
|---|---|
| OpenCode (DeepSeek V4.1 Flash) | CP0–Phase 2 scaffolding, code generation, tests, documentation |
| OpenCode (Hy4 flash Free) | Phase 3 (contract v1.2) and Phase 4 (release v1.0.0): simulation changes, GUI, benchmark/soak/leaderboard tooling, verification and documentation |

All game content (characters, world, names, text) is original to the lab brief "Đảo Đèn Lồng". No third-party game assets are used. AI-generated prose was reviewed and edited by the author; see `docs/notes/ai-log.md` for the mistakes found and fixed.
