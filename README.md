# LearnSmart
LearnSmart is an AI-powered study platform that turns documents into interactive learning experiences with concept extraction, flashcards, quizzes, study planning, analytics, and immersive memory-palace features across web and Vision Pro

## Overview

- AI-assisted study workflows from your own material
- Flashcards, quizzes, and progress tracking
- Web app for everyday study
- Vision Pro support for immersive learning

## Quick start

```bash
cp .env.example .env
docker compose up -d
cd apps/web
npm install
npm run dev
```

Web app: `http://localhost:5173`  
Backend health check: `http://localhost:8000/health`

## Structure

- `apps/web` - React frontend
- `apps/ARVR/Testing Ground` - Vision Pro app
- `backend` - FastAPI backend
- `shared` - shared TypeScript code

## Local stack

- PostgreSQL
- Neo4j
- Qdrant
- Ollama
- FastAPI backend

Everything needed for the default setup is driven by `docker-compose.yml` and `.env.example`.
