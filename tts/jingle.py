"""Chiptune idents and stings, synthesised from scratch (no samples or files).

Each channel gets its own key from a seed (the channel id), so WORLD and
SPORT sound related but not identical.

- "ident": a rising arpeggio into a held chord with a snare hit, about 1.3 s;
  opens a show's headlines.
- "sting": two quick notes, about 0.5 s; between stories.
"""

from __future__ import annotations

import zlib

import numpy as np

SAMPLE_RATE = 24_000
LEVEL = 0.2  # peak level of the melody; loudness is normalised with the speech

# Root notes to pick from, as semitones above A3 (220 Hz).
ROOTS = [0, 2, 3, 5, 7, 8, 10]


def _freq(semitones: float) -> float:
    return 220.0 * 2 ** (semitones / 12)


def _pulse(freq: float, length_s: float, duty: float = 0.25, sr: int = SAMPLE_RATE) -> np.ndarray:
    t = np.arange(int(sr * length_s)) / sr
    return np.where((t * freq) % 1 < duty, 1.0, -1.0).astype(np.float32)


def _triangle(freq: float, length_s: float, sr: int = SAMPLE_RATE) -> np.ndarray:
    t = np.arange(int(sr * length_s)) / sr
    return (2 * np.abs(2 * ((t * freq) % 1) - 1) - 1).astype(np.float32)


def _envelope(n: int, attack_s: float = 0.005, release_s: float = 0.06, sr: int = SAMPLE_RATE) -> np.ndarray:
    env = np.ones(n, dtype=np.float32)
    a = min(n, int(sr * attack_s))
    r = min(n - a, int(sr * release_s))
    if a:
        env[:a] = np.linspace(0, 1, a, dtype=np.float32)
    if r:
        env[n - r:] = np.linspace(1, 0, r, dtype=np.float32)
    return env


def _note(semitones: float, length_s: float, sr: int = SAMPLE_RATE) -> np.ndarray:
    lead = _pulse(_freq(semitones + 12), length_s, sr=sr)
    bass = _triangle(_freq(semitones - 12), length_s, sr=sr)
    tone = 0.6 * lead + 0.4 * bass
    return tone * _envelope(len(tone), sr=sr)


def _snare(length_s: float, seed: int, sr: int = SAMPLE_RATE) -> np.ndarray:
    n = int(sr * length_s)
    noise = np.random.default_rng(seed).uniform(-1, 1, n).astype(np.float32)
    return noise * np.linspace(1, 0, n, dtype=np.float32) ** 3


def _soften(audio: np.ndarray) -> np.ndarray:
    """Takes the harsh edge off the square waves with a short moving average."""
    kernel = np.ones(4, dtype=np.float32) / 4
    return np.convolve(audio, kernel, mode="same").astype(np.float32)


def jingle(style: str, seed: str, sr: int = SAMPLE_RATE) -> np.ndarray:
    """The ident or sting for a channel, as mono float32 audio."""
    key = zlib.crc32(seed.encode("utf-8"))
    root = ROOTS[key % len(ROOTS)]
    if style == "ident":
        arpeggio = [root, root + 4, root + 7, root + 12]
        parts = [_note(n, 0.11, sr) for n in arpeggio]
        chord_s = 0.75
        chord = sum(_note(n, chord_s, sr) for n in (root + 12, root + 16, root + 19)) / 3
        # A little vibrato-like shimmer: fade the chord out slowly.
        chord *= np.linspace(1, 0.2, len(chord), dtype=np.float32)
        snare = _snare(0.18, key, sr)
        chord[: len(snare)] += 0.5 * snare
        parts.append(chord.astype(np.float32))
    elif style == "sting":
        parts = [_note(root + 7, 0.12, sr), _note(root + 12, 0.32, sr)]
    else:
        raise ValueError(f"unknown jingle style {style!r}")
    audio = _soften(np.concatenate(parts))
    peak = float(np.max(np.abs(audio))) or 1.0
    return (audio * (LEVEL / peak)).astype(np.float32)
