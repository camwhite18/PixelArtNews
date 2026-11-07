"""HTTP service the Go pipeline calls to voice a segment.

POST /synthesize
    {"lines": [{"text": "...", "voice": "bf_emma"}, ...], "gap_ms": 250}
returns
    {"audio_b64": "<mp3>", "duration_s": 42.1, "line_starts": [0.0, 3.4, ...]}
"""

from __future__ import annotations

import base64
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from audio import SAMPLE_RATE, assemble, encode_mp3
from engine import Engine

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


class SynthesizeRequest(BaseModel):
    lines: list[Line] = Field(min_length=1, max_length=200)
    gap_ms: int = Field(default=250, ge=0, le=2000)
    speed: float = Field(default=1.0, ge=0.5, le=2.0)


class SynthesizeResponse(BaseModel):
    audio_b64: str
    duration_s: float
    line_starts: list[float]


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok" if engine else "loading"}


def _synthesize(req: SynthesizeRequest) -> SynthesizeResponse:
    assert engine is not None
    try:
        chunks = [engine.speak(line.text, line.voice, req.speed) for line in req.lines]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    audio, starts = assemble(chunks, req.gap_ms)
    mp3 = encode_mp3(audio)
    return SynthesizeResponse(
        audio_b64=base64.b64encode(mp3).decode("ascii"),
        duration_s=round(len(audio) / SAMPLE_RATE, 3),
        line_starts=starts,
    )


@app.post("/synthesize", response_model=SynthesizeResponse)
async def synthesize(req: SynthesizeRequest) -> SynthesizeResponse:
    if engine is None:
        raise HTTPException(status_code=503, detail="model loading")
    return await run_in_threadpool(_synthesize, req)
