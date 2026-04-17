from typing import List, Optional
import logging
import httpx
import openai
import asyncio
import nest_asyncio

from app.core.config import settings, PROVIDER_CONFIGS, resolve_embed_model

logger = logging.getLogger(__name__)

_CHARS_PER_TOKEN = 4  # rough estimate for truncation
_DEFAULT_MAX_TOKENS = 512  # conservative fallback when no config


def _resolve_embed_provider() -> str:
    """
    Pick the best available embedding provider based on config priority.
    Mac Mini first (if configured), then Ollama as fallback.
    """
    if "macmini" in PROVIDER_CONFIGS and settings.macmini_base_url:
        return "macmini"
    return "ollama"


def _resolve_embed_model(provider: str) -> str:
    """Resolve the actual model name for the given provider."""
    if provider == "macmini":
        key = settings.macmini_default_embed_model
        for m in settings.macmini_embed_models:
            if m.get("key") == key:
                return m["name"]
        return key
    return settings.ollama_default_embed_model


def _resolve_embed_url(provider: str) -> str:
    """Resolve the base URL for the given provider."""
    if provider == "macmini":
        return settings.macmini_base_url
    return settings.ollama_url


class EmbeddingService:

    def __init__(
        self,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        dimensions: Optional[int] = None):

        self.provider = provider or _resolve_embed_provider()
        self.model = model or _resolve_embed_model(self.provider)
        self.dimensions = dimensions or settings.qdrant_dimensions
        self._macmini_available: Optional[bool] = None
        self._macmini_checked_at: float = 0
        self._health_lock: Optional[asyncio.Lock] = None

        # Resolve max input tokens from .env config
        embed_cfg = resolve_embed_model(self.provider)
        self._max_tokens = embed_cfg.max_tokens if embed_cfg else _DEFAULT_MAX_TOKENS
        self._max_chars = self._max_tokens * _CHARS_PER_TOKEN

        logger.info(
            f"EmbeddingService initialized: provider={self.provider}, "
            f"model={self.model}, max_tokens={self._max_tokens}")

    async def _is_macmini_reachable(self) -> bool:
        """Health check with 10s timeout. Caches result for 60s.
        Uses a lock to prevent stampede when many concurrent tasks check at once."""
        import time

        # Fast path: return cached result without lock
        now = time.time()
        if self._macmini_available is not None and (now - self._macmini_checked_at) < 60:
            return self._macmini_available

        # Lazy-init lock (must be created in async context)
        if self._health_lock is None:
            self._health_lock = asyncio.Lock()

        async with self._health_lock:
            # Double-check after acquiring lock
            now = time.time()
            if self._macmini_available is not None and (now - self._macmini_checked_at) < 60:
                return self._macmini_available

            try:
                async with httpx.AsyncClient() as client:
                    r = await client.get(
                        f"{settings.macmini_base_url}/health",
                        timeout = 10.0)
                    self._macmini_available = r.status_code == 200
            except Exception:
                self._macmini_available = False

            self._macmini_checked_at = now
            if not self._macmini_available:
                logger.info("Mac Mini not reachable, will use fallback provider")
            return self._macmini_available

    def _truncate(self, text: str) -> str:
        """Truncate text to the embedding model's max input token limit."""
        if len(text) <= self._max_chars:
            return text
        logger.warning(
            f"Embedding input truncated: {len(text)} chars -> {self._max_chars} chars "
            f"(model max_tokens={self._max_tokens})")
        return text[:self._max_chars]

    def _truncate_batch(self, texts: List[str]) -> List[str]:
        """Truncate each text in a batch."""
        return [self._truncate(t) for t in texts]

    async def embed(self, text: str) -> List[float]:

        text = self._truncate(text)
        providers_to_try = self._get_providers_to_try()

        for prov in providers_to_try:
            try:
                if prov == "macmini":
                    if not await self._is_macmini_reachable():
                        continue
                    return await self._embed_openai_compat(text, prov)
                elif prov == "ollama":
                    return await self._embed_ollama(text)
                elif prov == "openai":
                    return await self._embed_openai(text)
            except Exception as e:
                logger.warning(f"Embedding failed with {prov}: {e}")
                continue

        raise RuntimeError("All embedding providers failed")

    async def embed_batch(self, texts: List[str], batch_size: int = 32) -> List[List[float]]:

        texts = self._truncate_batch(texts)
        providers_to_try = self._get_providers_to_try()

        for prov in providers_to_try:
            try:
                if prov == "macmini":
                    if not await self._is_macmini_reachable():
                        continue
                    return await self._embed_batch_openai_compat(texts, batch_size, prov)
                elif prov == "ollama":
                    return await self._embed_batch_ollama(texts, batch_size)
                else:
                    # Generic sequential fallback
                    embeddings = []
                    for text in texts:
                        embedding = await self.embed(text)
                        embeddings.append(embedding)
                    return embeddings
            except Exception as e:
                logger.warning(f"Batch embedding failed with {prov}: {e}")
                continue

        raise RuntimeError("All embedding providers failed for batch")

    def _get_providers_to_try(self) -> List[str]:
        """Return ordered list of providers to try, starting with the configured one."""
        providers = [self.provider]
        # Add fallbacks
        if self.provider == "macmini" and "ollama" not in providers:
            providers.append("ollama")
        elif self.provider == "ollama" and "macmini" in PROVIDER_CONFIGS and "macmini" not in providers:
            providers.append("macmini")
        return providers

    # =========================================================================
    # OpenAI-compatible (Mac Mini gateway)

    async def _embed_openai_compat(self, text: str, provider: str) -> List[float]:

        url = _resolve_embed_url(provider)
        model = _resolve_embed_model(provider)

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{url}/embeddings",
                json = {"model": model, "input": text},
                headers = {"Authorization": "Bearer no-key-needed"},
                timeout = 30.0)
            response.raise_for_status()
            data = response.json()
            return data["data"][0]["embedding"]

    async def _embed_batch_openai_compat(
        self, texts: List[str], batch_size: int, provider: str) -> List[List[float]]:

        url = _resolve_embed_url(provider)
        model = _resolve_embed_model(provider)
        all_embeddings = []

        for i in range(0, len(texts), batch_size):

            batch = texts[i:i + batch_size]

            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        f"{url}/embeddings",
                        json = {"model": model, "input": batch},
                        headers = {"Authorization": "Bearer no-key-needed"},
                        timeout = 120.0)
                    response.raise_for_status()
                    data = response.json()

                    # OpenAI returns sorted by index
                    batch_embeddings = [item["embedding"] for item in sorted(data["data"], key=lambda x: x["index"])]
                    all_embeddings.extend(batch_embeddings)
                    logger.debug(f"Batch embedded {len(batch)} texts via {provider} (batch {i//batch_size + 1})")

            except Exception as e:
                logger.warning(f"Batch embedding failed via {provider}, falling back to sequential: {e}")
                for text in batch:
                    embedding = await self._embed_openai_compat(text, provider)
                    all_embeddings.append(embedding)

        logger.info(f"Embedded {len(texts)} texts via {provider} in {(len(texts) + batch_size - 1) // batch_size} batches")
        return all_embeddings

    # =========================================================================
    # Ollama native API

    async def _embed_batch_ollama(self, texts: List[str], batch_size: int = 32) -> List[List[float]]:

        all_embeddings = []

        for i in range(0, len(texts), batch_size):

            batch = texts[i:i + batch_size]

            try:

                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        f"{settings.ollama_url}/api/embed",
                        json={
                            "model": self.model,
                            "input": batch},
                        timeout = 120.0)
                    response.raise_for_status()
                    data = response.json()
                    all_embeddings.extend(data["embeddings"])
                    logger.debug(f"Batch embedded {len(batch)} texts (batch {i//batch_size + 1})")

            except httpx.HTTPError as e:

                logger.warning(f"Batch embedding failed, falling back to sequential: {e}")
                for text in batch:
                    embedding = await self._embed_ollama(text)
                    all_embeddings.append(embedding)

        logger.info(f"Embedded {len(texts)} texts in {(len(texts) + batch_size - 1) // batch_size} batches")
        return all_embeddings

    async def _embed_ollama(self, text: str) -> List[float]:

        try:

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{settings.ollama_url}/api/embed",
                    json = {
                        "model": self.model,
                        "input": text},
                    timeout = 30.0)
                response.raise_for_status()
                data = response.json()
                return data["embeddings"][0]

        except httpx.HTTPError as e:

            logger.error(f"Ollama embedding failed: {e}")
            raise RuntimeError(f"Ollama embedding failed: {e}")

    # =========================================================================
    # OpenAI API (cloud)

    async def _embed_openai(self, text: str) -> List[float]:

        try:

            client = openai.AsyncOpenAI()
            response = await client.embeddings.create(
                model = self.model or "text-embedding-3-small",
                input = text)
            return response.data[0].embedding

        except Exception as e:

            logger.error(f"OpenAI embedding failed: {e}")
            raise RuntimeError(f"OpenAI embedding failed: {e}")

    # =========================================================================
    # Sync wrapper + health check

    def get_text_embedding(self, text: str) -> List[float]:

        """
        Synchronous wrapper for embed() - for LlamaIndex compatibility
        """

        try:

            loop = asyncio.get_event_loop()
            if loop.is_running():
                nest_asyncio.apply()
                return loop.run_until_complete(self.embed(text))
            else:
                return loop.run_until_complete(self.embed(text))

        except RuntimeError:
            return asyncio.run(self.embed(text))

    async def health_check(self) -> bool:

        try:
            if self.provider == "ollama":
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        f"{settings.ollama_url}/api/tags",
                        timeout = 5.0)
                    return response.status_code == 200
            elif self.provider == "macmini":
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        f"{settings.macmini_base_url}/health",
                        timeout = 5.0)
                    return response.status_code == 200
            return True
        except Exception:
            return False

# Global instance
embedding_service = EmbeddingService()
