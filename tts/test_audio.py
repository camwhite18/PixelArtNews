import numpy as np

from audio import assemble, to_pcm16


def test_assemble_inserts_gaps_and_reports_line_starts():
    sr = 1000
    a = np.ones(500, dtype=np.float32)  # 0.5 s
    b = np.ones(250, dtype=np.float32)  # 0.25 s
    audio, starts = assemble([a, b], gap_ms=100, sample_rate=sr)
    assert len(audio) == 500 + 100 + 250
    assert starts == [0.0, 0.6]
    assert np.all(audio[500:600] == 0)


def test_assemble_empty():
    audio, starts = assemble([], gap_ms=100)
    assert len(audio) == 0
    assert starts == []


def test_to_pcm16_clips():
    out = np.frombuffer(to_pcm16(np.array([2.0, -2.0, 0.0], dtype=np.float32)), dtype="<i2")
    assert list(out) == [32767, -32767, 0]
