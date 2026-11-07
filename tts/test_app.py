"""Contract test for /synthesize with the model swapped for a stub."""

import base64

import numpy as np
from fastapi.testclient import TestClient

import app as tts_app


class FakeEngine:
    def speak(self, text, voice, speed=1.0):
        if not voice.startswith(("a", "b")):
            raise ValueError("unsupported voice")
        return np.zeros(24_000, dtype=np.float32)  # 1 s per line


def client(monkeypatch):
    monkeypatch.setattr(tts_app, "Engine", FakeEngine)
    return TestClient(tts_app.app)


def test_synthesize_returns_mp3_duration_and_line_starts(monkeypatch):
    with client(monkeypatch) as c:
        r = c.post("/synthesize", json={
            "lines": [{"text": "Hello.", "voice": "bf_emma"}, {"text": "Hi.", "voice": "am_michael"}],
            "gap_ms": 500,
        })
    assert r.status_code == 200, r.text
    body = r.json()
    # 1 s per line plus a handover pause of about 1.7 x 500 ms.
    assert 2.6 < body["duration_s"] < 2.95
    assert body["line_starts"][0] == 0.0
    assert 1.6 < body["line_starts"][1] < 1.95
    assert base64.b64decode(body["audio_b64"])[:3] in (b"ID3", b"\xff\xfb", b"\xff\xf3")


def test_synthesize_rejects_unknown_voice(monkeypatch):
    with client(monkeypatch) as c:
        r = c.post("/synthesize", json={"lines": [{"text": "Hello.", "voice": "zz_nope"}]})
    assert r.status_code == 400
