"""Tests for the chiptune idents and stings."""

import numpy as np
import pytest

from jingle import LEVEL, SAMPLE_RATE, jingle


@pytest.mark.parametrize("style, low, high", [("ident", 1.0, 1.6), ("sting", 0.3, 0.7)])
def test_jingle_length_and_level(style, low, high):
    audio = jingle(style, "world")
    assert audio.dtype == np.float32
    assert low < len(audio) / SAMPLE_RATE < high
    assert abs(float(np.max(np.abs(audio))) - LEVEL) < 1e-3


def test_each_channel_has_its_own_key_but_is_repeatable():
    assert np.array_equal(jingle("sting", "world"), jingle("sting", "world"))
    keys = {jingle("sting", ch).tobytes() for ch in ["world", "tech", "science", "sport", "weird"]}
    assert len(keys) > 2


def test_unknown_style():
    with pytest.raises(ValueError):
        jingle("fanfare", "world")
