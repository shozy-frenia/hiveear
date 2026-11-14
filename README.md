# HiveEar

AI hive-health check from 30 seconds of hive sound: queenright, queenless or pre-swarm.

- `index.html` — the full app (single file; served by GitHub Pages, or open it in any browser)
- `app.src.html` + `engine.js` — sources. Build with `python3 build.py`, which writes:
  - `index.html` — complete standalone page (GitHub Pages: https://shozy-frenia.github.io/hiveear/)
  - `hiveear.html` — body-only version for claude.ai Artifacts
- `PITCH_RU.md` — application text, pitch script, jury Q&A (Russian)

Engine: STFT (2048-pt, 0–2 kHz) → 5 features (hum pitch, spectral flatness, band ratio, loudness swings, queen-piping events) → explainable rule model → probabilities, health score, action plan.
