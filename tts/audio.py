"""Pure audio helpers, kept free of the model so they can be unit tested.

Most of what makes synthetic speech sound synthetic between lines is timing
and the studio: identical gaps, digital silence, and dry, unprocessed audio.
So segments are put together like a real broadcast:

- each line's own leading and trailing silence is trimmed, then pauses are
  chosen by context (a speaker carrying on, a handover, a quick answer to a
  question), with a little variation so the rhythm isn't mechanical;
- a very quiet room tone runs underneath, so pauses aren't dead silence;
- the result goes through a light broadcast chain (high-pass, presence lift,
  gentle compression, a short studio reflection) and is normalised to a
  steady loudness, so every presenter sounds like they share one studio.
"""

from __future__ import annotations

import subprocess
import zlib

import numpy as np

SAMPLE_RATE = 24_000  # Kokoro's output rate

# Pauses, in seconds, relative to the base pause the caller asks for.
SAME_SPEAKER = 1.0
HANDOVER = 1.7  # a new presenter starts talking
QUICK_ANSWER = 1.15  # replying to a question is snappier than a handover
JITTER = 0.2  # +/- share of each pause, so the rhythm isn't uniform

# Edge silence below this level is trimmed from each line before pausing.
TRIM_DB = -45.0
TRIM_KEEP_S = 0.04  # keep a breath of the natural onset and decay

ROOM_TONE_DB = -62.0

# Broadcast chain: remove rumble, roll off hiss, lift presence a touch,
# compress gently, add a short early reflection, normalise loudness.
MASTER_FILTER = ",".join([
    "highpass=f=75",
    "lowpass=f=11500",
    "equalizer=f=180:t=q:w=1.0:g=1.5",
    "equalizer=f=3200:t=q:w=1.4:g=2",
    "acompressor=threshold=-21dB:ratio=2.5:attack=8:release=120:makeup=1.5",
    "aecho=0.85:0.25:11|19:0.05|0.03",
    "loudnorm=I=-17:TP=-1.5:LRA=8",
])


def trim_silence(chunk: np.ndarray, sample_rate: int = SAMPLE_RATE) -> np.ndarray:
    """Trims leading and trailing silence, keeping a short natural margin.

    A chunk that is silent throughout (or nearly) is returned unchanged.
    """
    chunk = np.asarray(chunk, dtype=np.float32).reshape(-1)
    if len(chunk) == 0:
        return chunk
    threshold = 10 ** (TRIM_DB / 20)
    loud = np.flatnonzero(np.abs(chunk) > threshold)
    if len(loud) == 0:
        return chunk
    keep = int(TRIM_KEEP_S * sample_rate)
    start = max(0, loud[0] - keep)
    end = min(len(chunk), loud[-1] + 1 + keep)
    if end - start < int(0.05 * sample_rate):
        return chunk
    return chunk[start:end]


def _jitter(key: str) -> float:
    """A stable value in [-1, 1] for a key, so the same script times the same."""
    return (zlib.crc32(key.encode("utf-8")) % 2001) / 1000.0 - 1.0


def plan_pauses(voices: list[str], texts: list[str], base_s: float) -> list[float]:
    """Pause before each line after the first, chosen by conversational context."""
    pauses: list[float] = []
    for i in range(1, len(voices)):
        if voices[i] == voices[i - 1]:
            factor = SAME_SPEAKER
        elif texts[i - 1].rstrip().endswith("?"):
            factor = QUICK_ANSWER
        else:
            factor = HANDOVER
        jitter = 1 + JITTER * _jitter(f"{i}:{texts[i]}")
        pauses.append(round(base_s * factor * jitter, 3))
    return pauses


def assemble(
    chunks: list[np.ndarray],
    pauses_s: list[float],
    sample_rate: int = SAMPLE_RATE,
) -> tuple[np.ndarray, list[float]]:
    """Join per-line audio with the given pause before each line after the first.

    Returns the joined mono float32 audio and the start time (seconds) of each
    line within it, which the front end uses to switch the talking presenter.
    """
    if chunks and len(pauses_s) != len(chunks) - 1:
        raise ValueError("need one pause between each pair of lines")
    parts: list[np.ndarray] = []
    starts: list[float] = []
    cursor = 0
    for i, chunk in enumerate(chunks):
        if i > 0:
            gap = np.zeros(int(sample_rate * pauses_s[i - 1]), dtype=np.float32)
            parts.append(gap)
            cursor += len(gap)
        starts.append(round(cursor / sample_rate, 3))
        chunk = np.asarray(chunk, dtype=np.float32).reshape(-1)
        parts.append(chunk)
        cursor += len(chunk)
    audio = np.concatenate(parts) if parts else np.zeros(0, dtype=np.float32)
    return audio, starts


def add_room_tone(audio: np.ndarray, seed: int = 0) -> np.ndarray:
    """Mixes in a very quiet, soft noise floor so pauses aren't digital silence."""
    if len(audio) == 0:
        return audio
    rng = np.random.default_rng(seed)
    noise = rng.standard_normal(len(audio)).astype(np.float32)
    # Soften the hiss into a low "room" rumble with a short moving average.
    kernel = np.ones(24, dtype=np.float32) / 24
    noise = np.convolve(noise, kernel, mode="same")
    noise *= (10 ** (ROOM_TONE_DB / 20)) / (np.sqrt(np.mean(noise**2)) + 1e-12)
    return (audio + noise).astype(np.float32)


def to_pcm16(audio: np.ndarray) -> bytes:
    clipped = np.clip(audio, -1.0, 1.0)
    return (clipped * 32767).astype("<i2").tobytes()


def encode_mp3(
    audio: np.ndarray,
    sample_rate: int = SAMPLE_RATE,
    bitrate: str = "64k",
    master: bool = True,
) -> bytes:
    """Encodes mono float audio to MP3 with ffmpeg, through the broadcast chain.

    The chain doesn't change the length, so durations and line starts measured
    before encoding still hold. Speech is fine at 48–64 kbps.
    """
    args = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-f", "s16le", "-ar", str(sample_rate), "-ac", "1", "-i", "pipe:0",
    ]
    if master:
        args += ["-af", MASTER_FILTER, "-ar", str(sample_rate)]
    args += ["-codec:a", "libmp3lame", "-b:a", bitrate, "-f", "mp3", "pipe:1"]
    proc = subprocess.run(args, input=to_pcm16(audio), capture_output=True, check=True)
    return proc.stdout
