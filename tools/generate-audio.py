#!/usr/bin/env python3
"""
Генерирует озвучку разговорника: edge-tts (китайский голос) -> mp3.

edge-tts всегда отдаёт audio-24khz-48kbitrate-mono-mp3 (формат прошит в
библиотеке, не настраивается через CLI/API — проверено чтением исходников
edge_tts/communicate.py). Чтобы получить компактный файл (~9 КБ на фразу,
как заявлено в задаче), после генерации перекодируем через ffmpeg в
24кбит/с моно — на голосе это не заметно, а вес падает вдвое.

Запуск:
    python3 tools/generate-audio.py
Нужны: edge-tts (pip install edge-tts), ffmpeg в PATH.
Кладёт файлы в public/audio/<id>.mp3, пропускает уже существующие
(--force для перегенерации всех).
"""
import argparse
import asyncio
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PHRASEBOOK = ROOT / "src" / "content" / "phrasebook.json"
OUT_DIR = ROOT / "public" / "audio"
VOICE = "zh-CN-XiaoxiaoNeural"  # женский, чёткий — см. TASK-china-phase1.md
BITRATE = "24k"


async def synth_raw(text: str, out_path: Path) -> None:
    import edge_tts

    communicate = edge_tts.Communicate(text, VOICE)
    await communicate.save(str(out_path))


def reencode(src: Path, dst: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
         "-b:a", BITRATE, "-ac", "1", "-ar", "24000", str(dst)],
        check=True,
    )


async def main(force: bool) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    data = json.loads(PHRASEBOOK.read_text())
    entries = data["entries"]

    total_bytes = 0
    generated = 0
    skipped = 0
    for entry in entries:
        out_path = OUT_DIR / f"{entry['id']}.mp3"
        if out_path.exists() and not force:
            total_bytes += out_path.stat().st_size
            skipped += 1
            continue

        raw_path = out_path.with_suffix(".raw.mp3")
        text = entry["zh"].replace("___", "")  # плейсхолдер не озвучиваем как есть
        try:
            await synth_raw(text, raw_path)
            reencode(raw_path, out_path)
        finally:
            raw_path.unlink(missing_ok=True)

        size = out_path.stat().st_size
        total_bytes += size
        generated += 1
        print(f"  {entry['id']}: {entry['zh']!r} -> {size} байт")

    print(f"\nСгенерировано: {generated}, пропущено (уже было): {skipped}")
    print(f"Суммарный вес public/audio/: {total_bytes / 1024:.1f} КБ")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="перегенерировать все файлы заново")
    args = parser.parse_args()
    try:
        asyncio.run(main(args.force))
    except KeyboardInterrupt:
        sys.exit(1)
