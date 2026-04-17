from pydantic import BaseModel
from uuid import UUID
from typing import Any


class VisionProBackground(BaseModel):
    id: UUID
    name: str
    external_id: str | None = None
    # Tonemapped JPG — works directly as RealityKit TextureResource (equirectangular)
    thumbnail_url: str | None = None
    # HDR/EXR URLs for reference (limited RealityKit support)
    hdr_url: str | None = None
    exr_url: str | None = None
    available_resolutions: list[str] = []
    categories: list[str] = []


class VisionProModel(BaseModel):
    id: UUID
    name: str
    external_id: str | None = None
    # Diffuse texture JPG for preview in UI
    thumbnail_url: str | None = None
    # Relative URL to the existing USDZ download endpoint
    usdz_download_url: str
    available_resolutions: list[str] = []
    categories: list[str] = []


class VisionProPreset(BaseModel):
    name: str
    display_name: str
    description: str


class VisionProBackgroundListResponse(BaseModel):
    items: list[VisionProBackground]
    total: int
    page: int
    page_size: int


class VisionProModelListResponse(BaseModel):
    items: list[VisionProModel]
    total: int
    page: int
    page_size: int


class VisionProSceneAssetsResponse(BaseModel):
    backgrounds: list[VisionProBackground]
    models: list[VisionProModel]
    presets: list[VisionProPreset]
