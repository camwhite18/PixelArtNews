"""Generate the demo broadcasts' audio with Kokoro (via kokoro-onnx).

Reads demo/script.json and writes, under demo/out/:
  audio/<segment id>.mp3   one file per segment
  segments.json            each segment's duration and per-line start offsets

Uses the TTS service's own audio helpers (tts/audio.py), so the demo sounds
like the real channels: natural pauses, room tone and the broadcast chain.

Needs: pip install kokoro-onnx numpy, ffmpeg on PATH, and the model files
from https://github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0):
  python demo/generate.py --model kokoro-v1.0.int8.onnx --voices voices-v1.0.bin

Add --only world,tech to re-voice just those channels and keep the rest.
"""

import argparse
import json
import sys
import time
import zlib
from pathlib import Path

import numpy as np
from kokoro_onnx import Kokoro

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent / "tts"))
from audio import add_room_tone, assemble, encode_mp3, plan_pauses, trim_silence  # noqa: E402

BASE_PAUSE_S = 0.3  # matches the server's gap_ms


def lang_for(voice: str) -> str:
    # Kokoro voice ids start with a for American English, b for British.
    return "en-gb" if voice.startswith("b") else "en-us"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--voices", required=True)
    ap.add_argument("--only", help="comma-separated channel ids to (re)generate")
    args = ap.parse_args()
    only = set(args.only.split(",")) if args.only else None

    script = json.loads((HERE / "script.json").read_text())
    # {"margot": {"voice": "bf_emma", "speed": 0.95}, ...}; older scripts have
    # a plain {"margot": "bf_emma"} voices map.
    presenters = script.get("presenters") or {
        name: {"voice": voice} for name, voice in script["voices"].items()
    }
    out = HERE / "out"
    (out / "audio").mkdir(parents=True, exist_ok=True)

    kokoro = Kokoro(args.model, args.voices)
    timings = out / "segments.json"
    result: dict[str, dict] = (
        json.loads(timings.read_text()) if only and timings.exists() else {}
    )
    spoken_s = 0.0
    started = time.perf_counter()

    for channel in script["channels"]:
        if only and channel["id"] not in only:
            continue
        for seg in channel["segments"]:
            chunks, voices, texts = [], [], []
            for speaker, text in seg["lines"]:
                p = presenters[speaker]
                samples, _ = kokoro.create(
                    text, voice=p["voice"], speed=p.get("speed", 1.0), lang=lang_for(p["voice"]),
                )
                chunks.append(trim_silence(samples))
                voices.append(p["voice"])
                texts.append(text)
            audio, starts = assemble(chunks, plan_pauses(voices, texts, BASE_PAUSE_S))
            audio = add_room_tone(audio, seed=zlib.crc32("\n".join(texts).encode("utf-8")))
            (out / "audio" / f"{seg['id']}.mp3").write_bytes(encode_mp3(audio))
            duration = len(audio) / 24_000
            spoken_s += duration
            result[seg["id"]] = {"durationS": round(duration, 3), "lineStarts": starts}
            print(f"{seg['id']}: {duration:.1f}s")

    timings.write_text(json.dumps(result, indent=2) + "\n")
    elapsed = time.perf_counter() - started
    print(f"\n{spoken_s:.0f}s of speech in {elapsed:.0f}s ({spoken_s / elapsed:.2f}x real time)")


if __name__ == "__main__":
    main()
