"""
Convert Polyhaven USDC (MaterialX shaders) to RealityKit-compatible USDZ.

Polyhaven uses ND_standard_surface_surfaceshader (MaterialX) which RealityKit
cannot parse — models load as red/black. This service rewrites every material
to UsdPreviewSurface, which RealityKit fully supports.
"""
import os
import io
import zipfile


def _find_texture_for_material(mat_name: str, texture_dir: str, tex_type: str) -> str | None:
    """
    Find the best matching texture file for a given material name and type.
    e.g. mat_name="Camera_01_body", tex_type="diff" -> "Camera_01_body_diff_1k.jpg"
    Falls back to any texture of that type if no name match found.
    """
    if not os.path.isdir(texture_dir):
        return None

    DIFF_KEYWORDS  = ("diff", "color", "col_", "albedo", "base_color")
    ROUGH_KEYWORDS = ("rough",)
    METAL_KEYWORDS = ("metal",)

    keywords = {"diff": DIFF_KEYWORDS, "rough": ROUGH_KEYWORDS, "metal": METAL_KEYWORDS}.get(tex_type, (tex_type,))
    img_exts = (".jpg", ".jpeg", ".png")

    files = os.listdir(texture_dir)
    mat_lower = mat_name.lower()
    # Parts of material name, longest first — e.g. "lens_body" before "lens"
    mat_parts = sorted(mat_lower.split("_"), key=len, reverse=True)

    # 1. Exact full name match + type (best)
    for f in files:
        fl = f.lower()
        if any(kw in fl for kw in keywords) and fl.endswith(img_exts):
            if mat_lower in fl:
                return os.path.join(texture_dir, f)

    # 2. Specific part match + type — match the most unique part of the material name
    for part in mat_parts:
        if len(part) < 3:
            continue
        for f in files:
            fl = f.lower()
            if any(kw in fl for kw in keywords) and fl.endswith(img_exts):
                if part in fl:
                    return os.path.join(texture_dir, f)

    # 3. Type only fallback (single-texture models)
    for f in files:
        fl = f.lower()
        if any(kw in fl for kw in keywords) and fl.endswith(img_exts):
            return os.path.join(texture_dir, f)

    return None


def _convert_usdc_materials(usdc_path: str, texture_dir: str) -> str:
    """
    Rewrite all materials in a USDC file to UsdPreviewSurface.
    Each material gets its own matching texture (e.g. Camera body vs lens vs strap).
    Returns path to the modified USDC file.
    """
    try:
        from pxr import Usd, UsdShade, Sdf, Gf
    except ImportError:
        # usd-core not available on Linux — return original file unchanged
        return usdc_path

    stage = Usd.Stage.Open(usdc_path)
    if not stage:
        return usdc_path

    for prim in stage.Traverse():
        if not prim.IsA(UsdShade.Material):
            continue

        material = UsdShade.Material(prim)
        mat_path = prim.GetPath()
        # Material name e.g. "Camera_01_body", "Armchair_01", "brass_goblets_01"
        mat_name = prim.GetName()

        # Find per-material textures
        diffuse_tex  = _find_texture_for_material(mat_name, texture_dir, "diff")
        roughness_tex = _find_texture_for_material(mat_name, texture_dir, "rough")

        # Remove existing (broken MaterialX) shader children
        for child in list(prim.GetChildren()):
            stage.RemovePrim(child.GetPath())

        # Create UsdPreviewSurface
        shader_prim = UsdShade.Shader.Define(stage, mat_path.AppendChild("PBRShader"))
        shader_prim.CreateIdAttr("UsdPreviewSurface")

        # Texture paths must be relative to the USDC inside the USDZ archive.
        # USDC sits at root, textures at textures/ — so path is always "textures/filename"
        def _asset_path(abs_tex: str) -> str:
            return "textures/" + os.path.basename(abs_tex)

        if diffuse_tex:
            tex_prim = UsdShade.Shader.Define(stage, mat_path.AppendChild("DiffuseTexture"))
            tex_prim.CreateIdAttr("UsdUVTexture")
            tex_prim.CreateInput("file", Sdf.ValueTypeNames.Asset).Set(Sdf.AssetPath(_asset_path(diffuse_tex)))
            tex_prim.CreateInput("wrapS", Sdf.ValueTypeNames.Token).Set("repeat")
            tex_prim.CreateInput("wrapT", Sdf.ValueTypeNames.Token).Set("repeat")
            rgb_out = tex_prim.CreateOutput("rgb", Sdf.ValueTypeNames.Float3)
            shader_prim.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).ConnectToSource(rgb_out)
        else:
            shader_prim.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(0.8, 0.8, 0.8))

        if roughness_tex:
            rtex_prim = UsdShade.Shader.Define(stage, mat_path.AppendChild("RoughnessTexture"))
            rtex_prim.CreateIdAttr("UsdUVTexture")
            rtex_prim.CreateInput("file", Sdf.ValueTypeNames.Asset).Set(Sdf.AssetPath(_asset_path(roughness_tex)))
            r_out = rtex_prim.CreateOutput("r", Sdf.ValueTypeNames.Float)
            shader_prim.CreateInput("roughness", Sdf.ValueTypeNames.Float).ConnectToSource(r_out)
        else:
            shader_prim.CreateInput("roughness", Sdf.ValueTypeNames.Float).Set(0.6)

        shader_prim.CreateInput("metallic", Sdf.ValueTypeNames.Float).Set(0.0)

        surface_out = shader_prim.CreateOutput("surface", Sdf.ValueTypeNames.Token)
        material.CreateSurfaceOutput().ConnectToSource(surface_out)

    out_path = usdc_path.replace(".usdc", "_converted.usdc")
    stage.Export(out_path)

    # stage.Export() resolves asset paths to absolute. Fix them back to relative
    # by doing a text replacement in the exported USDC's ASCII representation.
    # We re-export as USDA (text), fix paths, then re-save as USDC.
    usda_path = out_path.replace(".usdc", ".usda")
    stage2 = Usd.Stage.Open(out_path)
    stage2.Export(usda_path)  # export as text
    with open(usda_path, "r") as f:
        content = f.read()
    # Replace absolute /tmp/.../textures/X with ./textures/X
    import re
    content = re.sub(r'@[^@]*/textures/([^@]+)@', r'@./textures/\1@', content)
    with open(usda_path, "w") as f:
        f.write(content)
    # Re-export as binary USDC
    stage3 = Usd.Stage.Open(usda_path)
    stage3.Export(out_path)
    os.remove(usda_path)

    return out_path


def build_usdz(entries: list[tuple[str, bytes]]) -> bytes:
    """Pack files into a USDZ (ZIP) archive."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_STORED) as zf:
        for name, data in entries:
            zf.writestr(name, data)
    return buf.getvalue()


