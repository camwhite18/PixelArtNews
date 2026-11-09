FROM python:3.12-slim

# ffmpeg encodes MP3; espeak-ng is Kokoro's fallback for unknown words.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg espeak-ng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# CPU-only PyTorch by default, since the CUDA wheels are huge. docker-compose.gpu.yml
# overrides these to build a CUDA torch for an NVIDIA GPU.
ARG TORCH_SPEC=torch
ARG TORCH_INDEX=cpu
RUN pip install --no-cache-dir "$TORCH_SPEC" --index-url https://download.pytorch.org/whl/$TORCH_INDEX
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Kokoro's English G2P downloads this spaCy model on first use; install it at
# build time, since the non-root runtime user can't write to site-packages.
RUN python -m spacy download en_core_web_sm

COPY *.py ./

# Run as a non-root user. /cache is created here, owned by that user, so a
# fresh named volume mounted over it inherits the owner.
RUN useradd --uid 10001 --create-home app \
    && mkdir -p /cache && chown app /cache
USER app

# Model weights download on first start into the mounted cache volume.
ENV HF_HOME=/cache/huggingface
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
