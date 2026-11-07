import numpy as np
import pytest

from audio import (
    HANDOVER,
    JITTER,
    QUICK_ANSWER,
    SAME_SPEAKER,
    add_room_tone,
    assemble,
    plan_pauses,
    to_pcm16,
    trim_silence,
)


def test_assemble_inserts_pauses_and_reports_line_starts():
    sr = 1000
    a = np.ones(500, dtype=np.float32)  # 0.5 s
    b = np.ones(250, dtype=np.float32)  # 0.25 s
    audio, starts = assemble([a, b], [0.1], sample_rate=sr)
    assert len(audio) == 500 + 100 + 250
    assert starts == [0.0, 0.6]
    assert np.all(audio[500:600] == 0)


def test_assemble_empty():
    audio, starts = assemble([], [])
    assert len(audio) == 0
    assert starts == []


def test_assemble_needs_one_pause_per_gap():
    with pytest.raises(ValueError):
        assemble([np.ones(10), np.ones(10)], [])


def within(value, base, factor):
    return base * factor * (1 - JITTER) <= value <= base * factor * (1 + JITTER)


def test_plan_pauses_by_context():
    voices = ["bf_emma", "bf_emma", "am_michael", "bf_emma"]
    texts = ["Good evening.", "Here's the news. Kofi, why?", "Because it matters.", "Thanks."]
    p = plan_pauses(voices, texts, 0.3)
    assert len(p) == 3
    assert within(p[0], 0.3, SAME_SPEAKER)  # same presenter carries on
    assert within(p[1], 0.3, QUICK_ANSWER)  # answering a question
    assert within(p[2], 0.3, HANDOVER)  # a normal handover


def test_plan_pauses_is_stable_for_the_same_script():
    v, t = ["a", "b"], ["One.", "Two."]
    assert plan_pauses(v, t, 0.3) == plan_pauses(v, t, 0.3)


def test_trim_silence_keeps_a_short_margin():
    sr = 1000
    chunk = np.concatenate([np.zeros(300), np.full(200, 0.5), np.zeros(300)]).astype(np.float32)
    out = trim_silence(chunk, sample_rate=sr)
    assert len(out) == 200 + 2 * 40  # 40 ms kept either side
    assert out.max() == pytest.approx(0.5)


def test_trim_silence_leaves_silent_chunks_alone():
    chunk = np.zeros(1000, dtype=np.float32)
    assert len(trim_silence(chunk)) == 1000


def test_room_tone_is_quiet_and_keeps_length():
    audio = np.zeros(24_000, dtype=np.float32)
    out = add_room_tone(audio)
    assert len(out) == len(audio)
    rms_db = 20 * np.log10(np.sqrt(np.mean(out**2)))
    assert -66 < rms_db < -58


def test_to_pcm16_clips():
    out = np.frombuffer(to_pcm16(np.array([2.0, -2.0, 0.0], dtype=np.float32)), dtype="<i2")
    assert list(out) == [32767, -32767, 0]
