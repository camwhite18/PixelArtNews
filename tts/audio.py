"""Pure audio helpers, kept free of the model so they can be unit tested."""

from __future__ import annotations

import subprocess

import numpy as np

SAMPLE_RATE = 24_000  # Kokoro's output rate


def assemble(chunks: list[np.ndarray], gap_ms: int, sample_rate: int = SAMPLE_RATE) -> tuple[np.ndarray, list[float]]:
    """Join per-line audio with silent gaps.

    Returns the joined mono float32 audio and the start time (seconds) of each
    line within it, which the front end uses to switch the talking presenter.
    """
    gap = np.zeros(int(sample_rate * gap_ms / 1000), dtype=np.float32)
    parts: list[np.ndarray] = []
    starts: list[float] = []
    cursor = 0
    for i, chunk in enumerate(chunks):
        if i > 0 and len(gap):
            parts.append(gap)
            cursor += len(gap)
        starts.append(round(cursor / sample_rate, 3))
        chunk = np.asarray(chunk, dtype=np.float32).reshape(-1)
        parts.append(chunk)
        cursor += len(chunk)
    audio = np.concatenate(parts) if parts else np.zeros(0, dtype=np.float32)
    return audio, starts


def to_pcm16(audio: np.ndarray) -> bytes:
    clipped = np.clip(audio, -1.0, 1.0)
    return (clipped * 32767).astype("<i2").tobytes()


def encode_mp3(audio: np.ndarray, sample_rate: int = SAMPLE_RATE, bitrate: str = "64k") -> bytes:
    """Encode mono float audio to MP3 with ffmpeg. Speech is fine at 48–64 kbps."""
    proc = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-f", "s16le", "-ar", str(sample_rate), "-ac", "1", "-i", "pipe:0",
            "-codec:a", "libmp3lame", "-b:a", bitrate, "-f", "mp3", "pipe:1",
        ],
        input=to_pcm16(audio),
        capture_output=True,
        check=True,
    )
    return proc.stdout
