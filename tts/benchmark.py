"""Measure Kokoro's speed on this machine against the 24/7 audio budget.

Run inside the container so it uses the same CPU limits as production:

    docker compose run --rm tts python benchmark.py

The design budget is 5 channels x 10-15 minutes of fresh speech per hour,
i.e. up to 75 minutes of audio generated per 60 minutes of wall time. That
needs a real-time factor (audio seconds per wall second) of at least 1.25.
"""

from __future__ import annotations

import argparse
import time

from audio import SAMPLE_RATE
from engine import Engine

SAMPLE_LINES = [
    "Good afternoon. Leaders have agreed a new climate deal after talks ran late into a second night.",
    "And Margot, the key question now is how quickly countries actually act on these promises.",
    "A new phone chip claims to stretch battery life to a whole week, though independent tests are still to come.",
    "Astronomers say a telescope has spotted signs of water vapour above the icy surface of a distant moon.",
    "A late winner sent the underdogs through to the final, sparking wild celebrations in the away end.",
    "And finally, a small town has elected a goat as its honorary mayor. Zorp, does your planet have goats?",
]
VOICES = ["bf_emma", "am_michael", "am_adam", "bf_isabella", "af_bella", "bm_george"]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--rounds", type=int, default=3, help="passes over the sample lines (default 3)")
    parser.add_argument("--channels", type=int, default=5)
    parser.add_argument("--fresh-minutes", type=float, default=15, help="fresh audio per channel per hour")
    args = parser.parse_args()

    t0 = time.perf_counter()
    engine = Engine()
    engine.speak("Warm up.", VOICES[0])  # loads model weights and voices
    print(f"model load + warm-up: {time.perf_counter() - t0:.1f}s")

    audio_s = 0.0
    wall_s = 0.0
    for r in range(args.rounds):
        for text, voice in zip(SAMPLE_LINES, VOICES):
            start = time.perf_counter()
            audio = engine.speak(text, voice)
            wall_s += time.perf_counter() - start
            audio_s += len(audio) / SAMPLE_RATE
        print(f"round {r + 1}: {audio_s:.1f}s audio in {wall_s:.1f}s")

    rtf = audio_s / wall_s
    need_min = args.channels * args.fresh_minutes
    need_rtf = need_min / 60
    capacity_min = rtf * 60
    print()
    print(f"real-time factor: {rtf:.2f}x  (audio seconds per wall second)")
    print(f"capacity:         ~{capacity_min:.0f} min of speech per hour, if TTS runs flat out")
    print(f"budget:           {args.channels} channels x {args.fresh_minutes:g} min = {need_min:g} min/hour (needs {need_rtf:.2f}x)")
    if rtf >= need_rtf * 1.5:
        print("verdict:          comfortable - room for more fresh audio or channels")
    elif rtf >= need_rtf:
        print("verdict:          fits, with little headroom - consider Piper for filler voices")
    else:
        fits = capacity_min / args.channels
        print(f"verdict:          too slow - cut fresh audio to ~{fits:.0f} min per channel, use Piper for filler, or share the GPU")


if __name__ == "__main__":
    main()
