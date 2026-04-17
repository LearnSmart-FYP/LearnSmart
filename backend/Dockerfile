# Development Dockerfile
# Uses BuildKit cache mounts so pip install is near-instant on rebuilds.
# Enable with: COMPOSE_BUILDKIT=1 docker compose up --build
# (docker-compose.yml sets DOCKER_BUILDKIT=1 in the build section)

FROM python:3.11-slim

WORKDIR /app

# System deps (cached as a separate layer — only re-runs when apt list changes)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    libglib2.0-0 \
    libgl1 \
    libgomp1 \
    tesseract-ocr \
    tesseract-ocr-eng \
    ffmpeg \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    && rm -rf /var/lib/apt/lists/*

# Copy only requirements first so pip layer is cached until requirements.txt changes.
# The --mount=type=cache keeps the pip download cache across rebuilds on the host,
# so packages are not re-downloaded even after docker system prune.
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-warn-script-location -r requirements.txt

ENV PYTHONUNBUFFERED=1 \
    HF_HOME=/root/.cache/huggingface \
    TRANSFORMERS_CACHE=/root/.cache/huggingface

# App code is mounted as a volume in docker-compose.yml (./backend:/app),
# so we don't COPY it here — changes are reflected instantly without rebuilding.

RUN mkdir -p /app/uploads /app/tmp && chmod 777 /app/uploads /app/tmp

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
