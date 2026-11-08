"""HTTP service the Go pipeline calls to voice a segment.

POST /synthesize
    {"lines": [{"text": "...", "voice": "bf_emma", "speed": 0.95}, ...], "gap_ms": 300,
     "intro": "ident", "intro_seed": "world"}
returns
    {"audio_b64": "<mp3>", "duration_s": 42.1, "line_starts": [1.6, 5.0, ...], "intro_s": 1.6}

With "intro", the audio opens with that channel's chiptune ident ("ident") or
sting ("sting"); line starts count from the start of the audio, after it.
"""

from __future__ import annotations

import base64
import zlib
from contextlib import asynccontextmanager
from typing import Literal

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from audio import SAMPLE_RATE, add_room_tone, assemble, encode_mp3, plan_pauses, trim_silence
from engine import Engine
from jingle import jingle

INTRO_GAP_S = 0.3  # a beat between the jingle and the first line

engine: Engine | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global engine
    engine = Engine()
    yield


app = FastAPI(title="Pixel Art News TTS", lifespan=lifespan)


class Line(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    voice: str = Field(min_length=2)
    # The presenter's own pace; falls back to the request's speed.
    speed: float | None = Field(default=None, ge=0.5, le=2.0)


class SynthesizeRequest(BaseModel):
    lines: list[Line] = Field(min_length=1, max_length=200)
    # Base pause between lines by the same presenter. Handovers and answers
    # to questions get their own, longer or shorter, pauses (audio.plan_pauses).
    gap_ms: int = Field(default=300, ge=0, le=2000)
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    intro: Literal["ident", "sting"] | None = None
    # Picks the jingle's key, so each channel has its own (the channel id).
    intro_seed: str = Field(default="", max_length=64)


class SynthesizeResponse(BaseModel):
    audio_b64: str
    duration_s: float
    line_starts: list[float]
    intro_s: float = 0.0


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok" if engine else "loading"}


def _synthesize(req: SynthesizeRequest) -> SynthesizeResponse:
    assert engine is not None
    try:
        chunks = [
            trim_silence(engine.speak(line.text, line.voice, line.speed or req.speed))
            for line in req.lines
        ]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    texts = [line.text for line in req.lines]
    pauses = plan_pauses([line.voice for line in req.lines], texts, req.gap_ms / 1000)
    audio, starts = assemble(chunks, pauses)
    intro_s = 0.0
    if req.intro:
        lead = np.concatenate([
            jingle(req.intro, req.intro_seed),
            np.zeros(int(SAMPLE_RATE * INTRO_GAP_S), dtype=np.float32),
        ])
        audio = np.concatenate([lead, audio])
        intro_s = round(len(lead) / SAMPLE_RATE, 3)
        starts = [round(s + intro_s, 3) for s in starts]
    audio = add_room_tone(audio, seed=zlib.crc32("\n".join(texts).encode("utf-8")))
    mp3 = encode_mp3(audio)
    return SynthesizeResponse(
        audio_b64=base64.b64encode(mp3).decode("ascii"),
        duration_s=round(len(audio) / SAMPLE_RATE, 3),
        line_starts=starts,
        intro_s=intro_s,
    )


@app.post("/synthesize", response_model=SynthesizeResponse)
async def synthesize(req: SynthesizeRequest) -> SynthesizeResponse:
    if engine is None:
        raise HTTPException(status_code=503, detail="model loading")
    return await run_in_threadpool(_synthesize, req)
