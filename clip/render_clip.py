#!/usr/bin/env python3
"""Render the 15-second btc-ta-skill social clip from an existing analysis."""

from __future__ import annotations

import argparse
import json
import math
import subprocess
import wave
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps


HERE = Path(__file__).resolve().parent
SOURCE = HERE / "source"
SIZE = (1080, 1920)
FPS = 30
DURATION = 15

CREAM = "#f7f7f4"
WHITE = "#ffffff"
INK = "#26251e"
BODY = "#5a5852"
MUTED = "#807d72"
LINE = "#e6e5e0"
LINE_STRONG = "#cfcdc4"
ORANGE = "#f7931a"
ORANGE_PALE = "#fff1df"
GREEN = "#1f8a65"
DARK = "#12161b"

SANS_PATH = HERE / "fonts/Inter.ttf"
MONO_PATH = HERE / "fonts/JetBrainsMono.ttf"
SYMBOL_PATH = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"


@lru_cache(maxsize=100)
def font(size: int, kind: str = "sans") -> ImageFont.FreeTypeFont:
    path = {"sans": SANS_PATH, "bold": SANS_PATH, "mono": MONO_PATH, "symbol": SYMBOL_PATH}[kind]
    result = ImageFont.truetype(path, size)
    if kind == "bold":
        result.set_variation_by_axes([14, 600])
    return result


def rgba(color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    color = color.removeprefix("#")
    return tuple(int(color[i:i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def layer() -> Image.Image:
    return Image.new("RGBA", SIZE, (0, 0, 0, 0))


def rect(draw: ImageDraw.ImageDraw, box, fill=WHITE, outline=None, radius=22, width=2):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def txt(draw: ImageDraw.ImageDraw, xy, string, size, color=INK, kind="sans", anchor=None):
    draw.text(xy, string, font=font(size, kind), fill=color, anchor=anchor)


def line(draw: ImageDraw.ImageDraw, points, fill=LINE, width=2):
    draw.line(points, fill=fill, width=width, joint="curve")


def ease(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def appear(t: float, start: float, span: float = 0.45) -> float:
    return ease((t - start) / span)


def fade_paste(base: Image.Image, overlay: Image.Image, opacity: float) -> None:
    if opacity <= 0:
        return
    if opacity >= 1:
        base.alpha_composite(overlay)
        return
    part = overlay.copy()
    part.putalpha(part.getchannel("A").point(lambda a: round(a * opacity)))
    base.alpha_composite(part)


def rounded_image(im: Image.Image, size: tuple[int, int], radius: int = 20) -> Image.Image:
    im = ImageOps.fit(im, size, method=Image.Resampling.LANCZOS)
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *size), radius=radius, fill=255)
    im = im.convert("RGBA")
    im.putalpha(mask)
    return im


def image_at(base: Image.Image, im: Image.Image, x: int, y: int, opacity: float = 1):
    if opacity <= 0:
        return
    if opacity < 1:
        im = im.copy()
        im.putalpha(im.getchannel("A").point(lambda a: round(a * opacity)))
    base.alpha_composite(im, (x, y))


def small_label(draw: ImageDraw.ImageDraw, x, y, string, color=MUTED):
    txt(draw, (x, y), string, 25, color, "mono")


summary = json.loads((SOURCE / "summary.json").read_text())
chart = Image.open(SOURCE / "chart.png").convert("RGB")
assert summary["meta"]["timeframe"] == "1d"
assert summary["meta"]["asOfIso"].startswith("2026-09-24")
BIAS = "rialzista" if summary["overall"]["bias"] == "bullish" else "ribassista"

# Crop the real output around recent price action and its annotated levels.
CHART_ZOOM = rounded_image(chart.crop((785, 170, 1584, 850)), (900, 765), 20)
CHART_WIDE = rounded_image(chart.crop((700, 345, 1585, 845)), (900, 440), 20)
CHART_THUMB = rounded_image(chart.crop((760, 170, 1585, 850)), (408, 350), 14)


def common(title: str, kicker: str) -> Image.Image:
    im = Image.new("RGBA", SIZE, CREAM)
    d = ImageDraw.Draw(im)
    d.ellipse((72, 70, 130, 128), fill=ORANGE)
    txt(d, (101, 98), "₿", 35, WHITE, "symbol", "mm")
    txt(d, (148, 76), "btc-ta-skill", 39, INK, "bold")
    rect(d, (831, 76, 1008, 124), fill=WHITE, outline=LINE_STRONG, radius=24, width=2)
    txt(d, (919, 100), "BTC  /  1D", 19, MUTED, "mono", "mm")
    small_label(d, 74, 206, kicker, ORANGE)
    txt(d, (72, 270), title, 88, INK)
    line(d, [(72, 1785), (1008, 1785)], LINE, 2)
    small_label(d, 72, 1820, "DATI REALI  ·  ESEMPIO 24 SET 2026")
    return im


def scene_one(t: float) -> Image.Image:
    im = common("Cos'è btc-ta-skill?", "01  /  CHIEDI")
    d = ImageDraw.Draw(im)
    txt(d, (72, 401), "L'analisi tecnica di Bitcoin", 56, BODY)
    txt(d, (72, 466), "parte da una richiesta.", 56, BODY)

    card = layer(); c = ImageDraw.Draw(card)
    rect(c, (72, 680, 1008, 1060), WHITE, LINE_STRONG, 28, 2)
    rect(c, (103, 714, 977, 786), "#fafaf7", LINE, 15, 2)
    c.ellipse((129, 745, 143, 759), fill=ORANGE)
    small_label(c, 162, 731, "RICHIESTA")
    txt(c, (123, 833), "›", 66, ORANGE, "mono")
    prompt = "Analizza BTC su 1D"
    shown = prompt[:round(len(prompt) * appear(t, 0.55, 1.25))]
    txt(c, (193, 851), shown, 48, INK, "mono")
    if int(t * 2) % 2 == 0 and len(shown) < len(prompt):
        cursor_x = 193 + c.textlength(shown, font=font(48, "mono"))
        c.rectangle((cursor_x + 4, 852, cursor_x + 8, 905), fill=ORANGE)
    rect(c, (123, 956, 372, 1015), ORANGE, radius=12)
    txt(c, (247, 985), "Avvia analisi  →", 26, WHITE, "bold", "mm")
    fade_paste(im, card, appear(t, 0.2, 0.55))

    labels = [("DATI", 105), ("GRAFICO", 421), ("SCENARI", 737)]
    for i, (label, x) in enumerate(labels):
        a = appear(t, 1.35 + 0.29 * i, 0.34)
        p = layer(); pd = ImageDraw.Draw(p)
        rect(pd, (x, 1270, x + 238, 1360), ORANGE_PALE if i == 0 else WHITE, LINE, 18, 2)
        txt(pd, (x + 119, 1315), label, 27, INK, "mono", "mm")
        fade_paste(im, p, a)
        if i < 2:
            txt(d, (x + 267, 1291), "→", 43, ORANGE)
    txt(d, (72, 1485), "Una skill, dal dato al risultato.", 48, BODY)
    return im


def scene_two(t: float) -> Image.Image:
    im = common("Dati reali. Analisi chiara.", "02  /  ANALIZZA")
    d = ImageDraw.Draw(im)
    small_label(d, 72, 425, "PREZZO  +  VOLUMI  +  INDICATORI")
    for i, (label, sub) in enumerate([
        ("Dati di mercato", "Candele BTC/USDT"),
        ("Trend e momentum", "Direzione e forza"),
        ("Livelli chiave", "Supporti e resistenze"),
    ]):
        a = appear(t, 0.12 + i * 0.45, 0.4)
        y = 510 + i * 172 + round((1 - a) * 35)
        p = layer(); pd = ImageDraw.Draw(p)
        rect(pd, (72, y, 1008, y + 145), WHITE, LINE, 20, 2)
        pd.ellipse((103, y + 43, 165, y + 105), fill=ORANGE_PALE)
        txt(pd, (134, y + 74), str(i + 1), 27, ORANGE, "mono", "mm")
        txt(pd, (195, y + 29), label, 41, INK, "bold")
        txt(pd, (195, y + 83), sub, 28, MUTED)
        fade_paste(im, p, a)
    line(d, [(539, 1030), (539, 1090)], ORANGE, 6)
    d.polygon([(525, 1080), (553, 1080), (539, 1104)], fill=ORANGE)
    rect(d, (72, 1150, 1008, 1635), DARK, radius=24)
    # Reveal a genuine chart crop as the analysis finishes.
    reveal = appear(t, 0.95, 1.25)
    visible_w = max(1, round(CHART_WIDE.width * reveal))
    part = CHART_WIDE.crop((CHART_WIDE.width - visible_w, 0, CHART_WIDE.width, CHART_WIDE.height))
    image_at(im, part, 90 + CHART_WIDE.width - visible_w, 1172)
    small_label(d, 97, 1671, "GRAFICO GENERATO DALLA SKILL")
    return im


def scene_three(t: float) -> Image.Image:
    im = common("Il grafico prende forma.", "03  /  MOSTRA")
    d = ImageDraw.Draw(im)
    txt(d, (72, 406), "Trend, livelli e indicatori", 53, BODY)
    txt(d, (72, 468), "sullo stesso grafico.", 53, BODY)
    rect(d, (72, 612, 1008, 1498), DARK, radius=26)
    # Small vertical pan keeps the real output moving without altering its contents.
    pan = round(12 * math.sin(min(t, 3.6) * 1.15))
    image_at(im, CHART_ZOOM, 90, 630 + pan)
    overlay = layer(); od = ImageDraw.Draw(overlay)
    # Focus markers frame existing support and resistance labels in the screenshot.
    od.rounded_rectangle((680, 856 + pan, 959, 921 + pan), radius=14, outline=ORANGE, width=5)
    od.rounded_rectangle((690, 1050 + pan, 962, 1116 + pan), radius=14, outline="#45b6ac", width=5)
    fade_paste(im, overlay, 0.7 * appear(t, 0.9, 0.45))
    for i, (label, x, color) in enumerate([
        ("TREND", 72, ORANGE),
        ("RESISTENZE", 350, ORANGE),
        ("SUPPORTI", 718, GREEN),
    ]):
        p = layer(); pd = ImageDraw.Draw(p)
        rect(pd, (x, 1565, x + (251 if i == 1 else 246), 1641), WHITE, LINE_STRONG, 17, 2)
        pd.ellipse((x + 24, 1593, x + 45, 1614), fill=color)
        txt(pd, (x + 61, 1587), label, 23, INK, "mono")
        fade_paste(im, p, appear(t, 0.5 + i * 0.44, 0.4))
    return im


def scene_four(t: float) -> Image.Image:
    im = common("Grafico + scenari.", "04  /  PRODUCE")
    d = ImageDraw.Draw(im)
    txt(d, (72, 409), "Output da consultare e condividere.", 47, BODY)

    top = layer(); td = ImageDraw.Draw(top)
    rect(td, (72, 528, 1008, 944), WHITE, LINE_STRONG, 24, 2)
    image_at(top, CHART_THUMB, 92, 548)
    small_label(td, 532, 575, "GRAFICO")
    txt(td, (532, 635), "Interattivo", 43, INK, "bold")
    txt(td, (532, 692), "+ immagine PNG", 35, BODY)
    line(td, [(532, 782), (966, 782)], LINE, 2)
    txt(td, (532, 817), "Livelli annotati", 31, MUTED)
    fade_paste(im, top, appear(t, 0.12, 0.52))

    report = layer(); rd = ImageDraw.Draw(report)
    rect(rd, (72, 990, 1008, 1664), WHITE, LINE_STRONG, 24, 2)
    small_label(rd, 105, 1022, "REPORT")
    txt(rd, (105, 1081), "Lettura sintetica", 51, INK, "bold")
    rect(rd, (105, 1170, 975, 1260), ORANGE_PALE, radius=15)
    txt(rd, (133, 1193), "Bias complessivo", 28, BODY)
    txt(rd, (945, 1214), BIAS, 34, INK, "bold", "rm")
    line(rd, [(105, 1297), (975, 1297)], LINE, 2)
    rd.ellipse((114, 1347, 144, 1377), fill=GREEN)
    txt(rd, (169, 1332), "Scenario rialzista", 41, INK)
    rd.ellipse((114, 1450, 144, 1480), fill=ORANGE)
    txt(rd, (169, 1435), "Scenario ribassista", 41, INK)
    line(rd, [(105, 1537), (975, 1537)], LINE, 2)
    txt(rd, (105, 1570), "Scenari, non previsioni.", 32, BODY)
    fade_paste(im, report, appear(t, 0.74, 0.6))
    return im


def scene_five(t: float) -> Image.Image:
    im = Image.new("RGBA", SIZE, CREAM)
    d = ImageDraw.Draw(im)
    d.ellipse((433, 254, 647, 468), fill=ORANGE)
    txt(d, (540, 361), "₿", 126, WHITE, "symbol", "mm")
    txt(d, (540, 572), "btc-ta-skill", 108, INK, "bold", "ma")
    txt(d, (540, 732), "Chiedi un'analisi BTC.", 65, BODY, "sans", "ma")
    rect(d, (167, 874, 913, 976), ORANGE, radius=19)
    txt(d, (540, 925), "› /btc-ta 1d", 44, WHITE, "mono", "mm")

    # Miniatures of the two tangible outputs.
    chart_panel = layer(); cp = ImageDraw.Draw(chart_panel)
    rect(cp, (92, 1112, 549, 1540), WHITE, LINE_STRONG, 21, 2)
    image_at(chart_panel, CHART_THUMB, 116, 1136)
    txt(cp, (120, 1513), "GRAFICO", 23, MUTED, "mono")
    report_panel = layer(); rp = ImageDraw.Draw(report_panel)
    rect(rp, (568, 1112, 1025, 1540), WHITE, LINE_STRONG, 21, 2)
    small_label(rp, 592, 1142, "REPORT")
    txt(rp, (592, 1216), "Bias", 45, BODY)
    txt(rp, (592, 1273), BIAS, 49, INK, "bold")
    line(rp, [(592, 1363), (999, 1363)], LINE, 2)
    txt(rp, (592, 1391), "↑ Rialzista", 31, GREEN)
    txt(rp, (592, 1455), "↓ Ribassista", 31, ORANGE)
    fade_paste(im, chart_panel, appear(t, 0.18, 0.42))
    fade_paste(im, report_panel, appear(t, 0.4, 0.42))
    line(d, [(72, 1785), (1008, 1785)], LINE, 2)
    small_label(d, 72, 1820, "ESEMPIO 24 SET 2026  ·  SCOPO INFORMATIVO")
    return im


SCENES = [scene_one, scene_two, scene_three, scene_four, scene_five]
BOUNDARIES = [0, 3, 6, 10, 13, 15]


def frame(time_s: float) -> Image.Image:
    idx = max(i for i, start in enumerate(BOUNDARIES[:-1]) if time_s >= start)
    t = time_s - BOUNDARIES[idx]
    current = SCENES[idx](t)
    if idx < len(SCENES) - 1:
        remaining = BOUNDARIES[idx + 1] - time_s
        if remaining < 0.28:
            upcoming = SCENES[idx + 1](0)
            current = Image.blend(current, upcoming, ease((0.28 - remaining) / 0.28))
    return current.convert("RGB")


def make_audio(path: Path):
    sample_rate = 44100
    n = sample_rate * DURATION
    out = np.zeros(n, dtype=np.float64)
    beat = 60 / 96
    # A quiet original arpeggio: warm sine plucks, low root and a soft beat.
    chords = [
        (220.00, 261.63, 329.63),
        (174.61, 220.00, 261.63),
        (261.63, 329.63, 392.00),
        (196.00, 246.94, 293.66),
    ]
    for k in range(math.ceil(DURATION / beat)):
        start = round(k * beat * sample_rate)
        if start >= n:
            break
        length = min(round(0.56 * sample_rate), n - start)
        tm = np.arange(length) / sample_rate
        chord = chords[(k // 4) % len(chords)]
        f = chord[k % 3]
        pluck = (np.sin(2 * np.pi * f * tm) + 0.18 * np.sin(2 * np.pi * 2 * f * tm))
        pluck *= np.exp(-6.2 * tm) * 0.095
        out[start:start + length] += pluck
        if k % 2 == 0:
            bass_len = min(round(0.48 * sample_rate), n - start)
            bt = np.arange(bass_len) / sample_rate
            out[start:start + bass_len] += np.sin(2 * np.pi * chord[0] / 2 * bt) * np.exp(-4 * bt) * 0.055
        tick_len = min(round(0.035 * sample_rate), n - start)
        tt = np.arange(tick_len) / sample_rate
        out[start:start + tick_len] += np.sin(2 * np.pi * (900 - 350 * tt) * tt) * np.exp(-130 * tt) * 0.025
    fade = np.ones(n)
    fade[:sample_rate] = np.linspace(0, 1, sample_rate)
    fade[-sample_rate:] = np.linspace(1, 0, sample_rate)
    out *= fade
    stereo = np.column_stack((out, out * 0.95))
    pcm = np.int16(np.clip(stereo, -1, 1) * 32767)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(pcm.tobytes())


def make_preview():
    samples = [1.5, 4.5, 8.0, 11.5, 14.0]
    thumbs = [frame(t).resize((324, 576), Image.Resampling.LANCZOS) for t in samples]
    sheet = Image.new("RGB", (324 * 5, 576), WHITE)
    for i, im in enumerate(thumbs):
        sheet.paste(im, (i * 324, 0))
    sheet.save(HERE / "storyboard.png", optimize=True)
    frame(8.0).save(HERE / "poster.png", optimize=True)
    print(HERE / "storyboard.png")


def render():
    audio_path = HERE / "soundtrack.wav"
    video_path = HERE / "btc-ta-skill-15s.mp4"
    make_audio(audio_path)
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pixel_format", "rgb24",
        "-video_size", "1080x1920", "-framerate", str(FPS), "-i", "pipe:0",
        "-i", str(audio_path), "-t", str(DURATION),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
        "-movflags", "+faststart", str(video_path),
    ]
    with subprocess.Popen(cmd, stdin=subprocess.PIPE) as proc:
        assert proc.stdin is not None
        for i in range(DURATION * FPS):
            proc.stdin.write(frame(i / FPS).tobytes())
            if (i + 1) % 90 == 0:
                print(f"Rendered {i + 1}/{DURATION * FPS} frames", flush=True)
        proc.stdin.close()
        if proc.wait() != 0:
            raise RuntimeError("ffmpeg failed")
    print(video_path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["preview", "render"])
    args = parser.parse_args()
    HERE.mkdir(exist_ok=True)
    if args.mode == "preview":
        make_preview()
    else:
        render()
