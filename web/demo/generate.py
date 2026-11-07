"""Generate the demo broadcasts' audio with Kokoro (via kokoro-onnx).

Reads demo/script.json and writes, under demo/out/:
  audio/<segment id>.mp3   one file per segment, lines joined with short pauses
  segments.json            each segment's duration and per-line start offsets

Needs: pip install kokoro-onnx soundfile, ffmpeg on PATH, and the model files
from https://github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0):
  python demo/generate.py --model kokoro-v1.0.int8.onnx --voices voices-v1.0.bin
"""

import argparse
import json
import subprocess
import time
from pathlib import Path

import numpy as np
from kokoro_onnx import Kokoro

GAP_S = 0.3  # pause between lines; a touch longer when the speaker changes
HANDOVER_S = 0.45


def lang_for(voice: str) -> str:
    # Kokoro voice ids start with a for American English, b for British.
    return "en-gb" if voice.startswith("b") else "en-us"


def encode_mp3(samples: np.ndarray, rate: int, path: Path) -> None:
    pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes()
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y", "-f", "s16le", "-ar", str(rate), "-ac", "1",
         "-i", "-", "-codec:a", "libmp3lame", "-b:a", "64k", str(path)],
        input=pcm, check=True,
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--voices", required=True)
    args = ap.parse_args()

    here = Path(__file__).parent
    script = json.loads((here / "script.json").read_text())
    out = here / "out"
    (out / "audio").mkdir(parents=True, exist_ok=True)

    kokoro = Kokoro(args.model, args.voices)
    result: dict[str, dict] = {}
    spoken_s = 0.0
    started = time.perf_counter()

    for channel in script["channels"]:
        for seg in channel["segments"]:
            chunks: list[np.ndarray] = []
            starts: list[float] = []
            t = 0.0
            prev = None
            rate = 24000
            for speaker, text in seg["lines"]:
                voice = script["voices"][speaker]
                if prev is not None:
                    gap = HANDOVER_S if speaker != prev else GAP_S
                    chunks.append(np.zeros(int(gap * rate), dtype=np.float32))
                    t += gap
                samples, rate = kokoro.create(text, voice=voice, speed=1.0, lang=lang_for(voice))
                starts.append(round(t, 3))
                chunks.append(samples.astype(np.float32))
                t += len(samples) / rate
                prev = speaker
            audio = np.concatenate(chunks)
            duration = len(audio) / rate
            spoken_s += duration
            encode_mp3(audio, rate, out / "audio" / f"{seg['id']}.mp3")
            result[seg["id"]] = {"durationS": round(duration, 3), "lineStarts": starts}
            print(f"{seg['id']}: {duration:.1f}s")

    (out / "segments.json").write_text(json.dumps(result, indent=2) + "\n")
    elapsed = time.perf_counter() - started
    print(f"\n{spoken_s:.0f}s of speech in {elapsed:.0f}s ({spoken_s / elapsed:.2f}x real time)")


if __name__ == "__main__":
    main()
