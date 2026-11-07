"""Kokoro text-to-speech wrapper."""

from __future__ import annotations

import threading

import numpy as np

# Kokoro picks its pronunciation model from the voice's first letter:
# a/b = American/British English (e.g. am_adam, bf_emma).
SUPPORTED_LANGS = {"a", "b"}


class Engine:
    def __init__(self) -> None:
        from kokoro import KPipeline  # heavy import: keep it out of module load

        self._KPipeline = KPipeline
        self._pipelines: dict[str, object] = {}
        # One synthesis at a time: the CPU is the bottleneck and parallel runs
        # only thrash the cache.
        self._lock = threading.Lock()

    def _pipeline(self, voice: str):
        lang = voice[:1]
        if lang not in SUPPORTED_LANGS:
            raise ValueError(f"unsupported voice {voice!r}: expected an a*/b* English voice")
        if lang not in self._pipelines:
            self._pipelines[lang] = self._KPipeline(lang_code=lang)
        return self._pipelines[lang]

    def speak(self, text: str, voice: str, speed: float = 1.0) -> np.ndarray:
        with self._lock:
            pipeline = self._pipeline(voice)
            pieces = [np.asarray(audio, dtype=np.float32) for _, _, audio in pipeline(text, voice=voice, speed=speed)]
        if not pieces:
            return np.zeros(0, dtype=np.float32)
        return np.concatenate(pieces)
