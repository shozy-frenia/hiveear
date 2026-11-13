# HiveEar

AI hive-health check from 30 seconds of hive sound: queenright, queenless or pre-swarm.

- `hiveear.html` — the full app (single file, open it in any browser)
- `app.src.html` + `engine.js` — sources; build with:
  `python3 -c "s=open('app.src.html').read();open('hiveear.html','w').write(s.replace('/*__ENGINE__*/',open('engine.js').read()))"`
- `PITCH_RU.md` — application text, pitch script, jury Q&A (Russian)

Engine: STFT (2048-pt, 0–2 kHz) → 5 features (hum pitch, spectral flatness, band ratio, loudness swings, queen-piping events) → explainable rule model → probabilities, health score, action plan.
