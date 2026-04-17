from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.latex_service import compile_latex_to_pdf, compile_latex_preview

router = APIRouter(prefix="/api/latex", tags=["latex"])


class LaTeXCompileRequest(BaseModel):
    latex_content: str


class LaTeXPreviewRequest(BaseModel):
    latex_math: str
    is_full_document: bool = False  # If True, treat as complete document; otherwise wrap in boilerplate


@router.post("/compile")
async def compile_latex(request: LaTeXCompileRequest):
    """
    Compile full LaTeX document to PDF.
    
    Request:
        latex_content: Complete LaTeX document
        
    Response:
        pdf_base64: Base64 encoded PDF
        success: bool
        error: str (if failed)
    """
    if not request.latex_content.strip():
        raise HTTPException(status_code=400, detail="LaTeX content is required")
    
    result = await compile_latex_to_pdf(request.latex_content)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return {
        "success": True,
        "pdf_base64": result["pdf_base64"]
    }


@router.post("/preview")
async def preview_latex(request: LaTeXPreviewRequest):
    """
    Quick preview compilation for math expressions or full documents.
    
    Request:
        latex_math: LaTeX math code or full document
        is_full_document: If True, treat as full document; otherwise wrap in boilerplate
        
    Response:
        image_base64: Base64 encoded image (PNG or PDF)
        format: "png" or "pdf"
        success: bool
        error: str (if failed)
    """
    if not request.latex_math.strip():
        raise HTTPException(status_code=400, detail="LaTeX math code is required")
    
    result = await compile_latex_preview(request.latex_math, is_full_document=request.is_full_document)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Compilation failed"))
    
    return {
        "success": True,
        "image_base64": result.get("png_base64"),
        "format": result.get("format", "png")
    }
