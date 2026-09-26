# Clip btc-ta-skill

- **Video:** `btc-ta-skill-15s.mp4` — 1080 × 1920, 30 fps, 15 secondi, H.264/AAC.
- **Anteprime:** `poster.png` e `storyboard.png`.
- **Sorgente:** `render_clip.py`, `source/chart.png` e `source/summary.json`.

Il grafico e il bias provengono dall'analisi BTC/USDT 1D del 24 settembre 2026, con barra ancora in corso. Le schede riassumono le capacità della skill; sono una presentazione visiva, non un report finanziario aggiornato.

Il design riprende palette, Inter, JetBrains Mono, card e bordi sottili dal design system Bitcode indicato dall'utente. Le licenze dei font sono in `fonts/`. La musica è generata dal renderer.

Per rigenerare la clip, con Python 3, Pillow, NumPy e FFmpeg disponibili:

```bash
python3 render_clip.py preview
python3 render_clip.py render
```
