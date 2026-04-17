import json
from typing import Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.core.database import get_postgres
from app.core.dependencies import get_current_user
from app.services.ai.provider import ai_provider
from app.models.visionpro import (
    VisionProBackground,
    VisionProBackgroundListResponse,
    VisionProModel,
    VisionProModelListResponse,
    VisionProPreset,
    VisionProSceneAssetsResponse,
)

router = APIRouter(prefix="/visionpro", tags=["Vision Pro"])

SKYBOX_PRESETS: list[VisionProPreset] = [
    VisionProPreset(name="library",     display_name="Library",     description="Dark warm brown indoor setting with amber tones"),
    VisionProPreset(name="classroom",   display_name="Classroom",   description="Bright light-blue daytime room with pale walls"),
    VisionProPreset(name="museum",      display_name="Museum",      description="Dark slate interior with cool gray marble tones"),
    VisionProPreset(name="garden",      display_name="Garden",      description="Warm sky-blue outdoor with golden horizon and green grass"),
    VisionProPreset(name="temple",      display_name="Temple",      description="Deep purple night sky with gold horizon and dark stone ground"),
    VisionProPreset(name="observatory", display_name="Observatory", description="Near-black starry sky with deep indigo horizon"),
]


def _parse_json(raw: Any) -> dict:
    if raw is None:
        return {}
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except Exception:
            return {}
    return raw


def _extract_background(row: asyncpg.Record) -> VisionProBackground:
    """Build a VisionProBackground from an asset_library row (asset_type='hdri')."""
    raw = _parse_json(row.get("raw_api_data"))
    files = raw.get("files", {})
    hdri_section = files.get("hdri", {})

    # Tonemapped JPG — equirectangular, works directly with RealityKit TextureResource
    thumbnail_url: str | None = None
    tonemapped = files.get("tonemapped")
    if isinstance(tonemapped, dict):
        thumbnail_url = tonemapped.get("url")

    # Collect per-resolution HDR / EXR URLs (prefer smallest available for hdr_url)
    available_resolutions: list[str] = []
    hdr_url: str | None = None
    exr_url: str | None = None
    for res in ["1k", "2k", "4k", "8k", "16k"]:
        if res in hdri_section:
            available_resolutions.append(res)
            res_data = hdri_section[res]
            if hdr_url is None and isinstance(res_data.get("hdr"), dict):
                hdr_url = res_data["hdr"].get("url")
            if exr_url is None and isinstance(res_data.get("exr"), dict):
                exr_url = res_data["exr"].get("url")

    categories: list[str] = raw.get("categories") or []

    return VisionProBackground(
        id=row["id"],
        name=row["name"],
        external_id=row.get("external_id"),
        thumbnail_url=thumbnail_url,
        hdr_url=hdr_url,
        exr_url=exr_url,
        available_resolutions=available_resolutions,
        categories=categories,
    )


def _extract_model(row: asyncpg.Record) -> VisionProModel:
    """Build a VisionProModel from an asset_library row (asset_type='model')."""
    raw = _parse_json(row.get("raw_api_data"))
    files = raw.get("files", {})

    # Thumbnail: diffuse texture at 1k JPG
    thumbnail_url: str | None = None
    for tex_key in ["Diffuse", "diff", "diffuse"]:
        tex = files.get(tex_key, {})
        for res in ["1k", "2k"]:
            fmt = tex.get(res, {})
            if isinstance(fmt.get("jpg"), dict):
                thumbnail_url = fmt["jpg"].get("url")
                break
        if thumbnail_url:
            break

    # Available USD resolutions
    available_resolutions: list[str] = []
    usd_section = files.get("usd", {})
    for res in ["1k", "2k", "4k"]:
        if res in usd_section:
            available_resolutions.append(res)

    # If no USD, fall back to GLTF resolutions (client converts via ModelDownloader)
    if not available_resolutions:
        gltf_section = files.get("gltf", {})
        for res in ["1k", "2k", "4k"]:
            if res in gltf_section:
                available_resolutions.append(res)

    categories: list[str] = raw.get("categories") or []

    return VisionProModel(
        id=row["id"],
        name=row["name"],
        external_id=row.get("external_id"),
        thumbnail_url=thumbnail_url,
        usdz_download_url=f"/api/models/{row['id']}/download/usdz",
        available_resolutions=available_resolutions,
        categories=categories,
    )



@router.get("/scene/presets", response_model=list[VisionProPreset], summary="List built-in skybox presets")
async def list_presets():
    """Returns procedural skybox presets (generated at runtime, no download needed)."""
    return SKYBOX_PRESETS


@router.get("/scene/backgrounds", response_model=VisionProBackgroundListResponse, summary="List HDRI backgrounds for VR scenes")
async def list_backgrounds(
    search: str | None = Query(None, description="Search by name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: asyncpg.Connection = Depends(get_postgres),
):
    """Returns HDRI assets suitable as VR scene backgrounds on Vision Pro."""
    offset = (page - 1) * page_size

    rows = await db.fetch(
        """
        SELECT id, external_id, name, raw_api_data
        FROM asset_library
        WHERE asset_type = 'hdri'
          AND ($1::text IS NULL OR name ILIKE '%' || $1 || '%')
        ORDER BY name
        LIMIT $2 OFFSET $3
        """,
        search, page_size, offset,
    )

    total_row = await db.fetchrow(
        """
        SELECT COUNT(1) AS cnt FROM asset_library
        WHERE asset_type = 'hdri'
          AND ($1::text IS NULL OR name ILIKE '%' || $1 || '%')
        """,
        search,
    )
    total = total_row["cnt"] if total_row else 0

    items = [_extract_background(row) for row in rows]
    return VisionProBackgroundListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/scene/models", response_model=VisionProModelListResponse, summary="List 3D models for VR scenes")
async def list_models(
    search: str | None = Query(None, description="Search by name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: asyncpg.Connection = Depends(get_postgres),
):
    """Returns 3D model assets with USDZ download URLs for Vision Pro scenes."""
    offset = (page - 1) * page_size

    rows = await db.fetch(
        """
        SELECT id, external_id, name, raw_api_data
        FROM asset_library
        WHERE asset_type = 'model'
          AND ($1::text IS NULL OR name ILIKE '%' || $1 || '%')
        ORDER BY name
        LIMIT $2 OFFSET $3
        """,
        search, page_size, offset,
    )

    total_row = await db.fetchrow(
        """
        SELECT COUNT(1) AS cnt FROM asset_library
        WHERE asset_type = 'model'
          AND ($1::text IS NULL OR name ILIKE '%' || $1 || '%')
        """,
        search,
    )
    total = total_row["cnt"] if total_row else 0

    items = [_extract_model(row) for row in rows]
    return VisionProModelListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/scene", response_model=VisionProSceneAssetsResponse, summary="Get all assets for building a VR scene")
async def get_scene_assets(
    db: asyncpg.Connection = Depends(get_postgres),
):
    """Returns presets, backgrounds, and models in a single payload for initial scene setup."""
    bg_rows = await db.fetch(
        """
        SELECT id, external_id, name, raw_api_data
        FROM asset_library
        WHERE asset_type = 'hdri'
        ORDER BY name
        LIMIT 20
        """
    )

    model_rows = await db.fetch(
        """
        SELECT id, external_id, name, raw_api_data
        FROM asset_library
        WHERE asset_type = 'model'
        ORDER BY name
        LIMIT 20
        """
    )

    return VisionProSceneAssetsResponse(
        presets=SKYBOX_PRESETS,
        backgrounds=[_extract_background(r) for r in bg_rows],
        models=[_extract_model(r) for r in model_rows],
    )



class AIAskRequest(BaseModel):
    model_name: str
    question: str

class AIAskResponse(BaseModel):
    answer: str

@router.post("/ai/ask", response_model=AIAskResponse, summary="Ask AI about a 3D model")
async def ask_ai_about_model(
    req: AIAskRequest,
    current_user=Depends(get_current_user),
):
    """Ask the AI about a 3D model placed in the VR scene."""
    system_prompt = (
        "You are an educational AI assistant inside a Vision Pro memory palace app. "
        "The user has placed a 3D model in their VR scene as a memory anchor. "
        "Answer clearly and concisely — responses will be read in a VR headset so keep them under 150 words. "
        "Focus on what the object is, what it represents educationally, and any interesting facts."
    )
    prompt = f'The 3D model in the scene is called "{req.model_name}". The user asks: {req.question}'

    try:
        async with ai_provider.session(system_prompt=system_prompt) as session:
            answer = await ai_provider.generate(
                prompt=prompt,
                session=session,
                temperature=0.7,
                max_tokens=200,
            )
    except Exception as e:
        answer = f"Sorry, I couldn't answer right now: {str(e)}"

    return AIAskResponse(answer=answer)
