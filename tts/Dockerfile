FROM python:3.12-slim

# ffmpeg encodes MP3; espeak-ng is Kokoro's fallback for unknown words.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg espeak-ng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# CPU-only PyTorch: the GPU stays with Jellyfin, and the CUDA wheels are huge.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY *.py ./

# Model weights download on first start into the mounted cache volume.
ENV HF_HOME=/cache/huggingface
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
