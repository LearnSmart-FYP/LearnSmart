import subprocess
import tempfile
import os
import base64
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


async def compile_latex_to_pdf(latex_content: str) -> dict:
    """
    Compile LaTeX content to PDF using pdflatex.
    
    Args:
        latex_content: Full LaTeX document content
        
    Returns:
        dict with keys:
        - success: bool
        - pdf_base64: str (base64 encoded PDF if successful)
        - error: str (error message if failed)
    """
    try:
        # Check if pdflatex is installed
        result = subprocess.run(
            ["pdflatex", "--version"],
            capture_output=True,
            timeout=5
        )
        if result.returncode != 0:
            return {
                "success": False,
                "error": "LaTeX compiler not found. Install texlive-latex-base on your system.",
                "pdf_base64": None
            }
    except FileNotFoundError:
        return {
            "success": False,
            "error": "LaTeX compiler not found. Install texlive-latex-base on your system.",
            "pdf_base64": None
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error checking LaTeX compiler: {str(e)}",
            "pdf_base64": None
        }

    # Create temporary directory for compilation
    with tempfile.TemporaryDirectory() as tmpdir:
        try:
            tex_file = Path(tmpdir) / "document.tex"
            
            # Write LaTeX content to file
            tex_file.write_text(latex_content, encoding='utf-8')
            
            # Compile LaTeX to PDF
            result = subprocess.run(
                [
                    "pdflatex",
                    "-interaction=nonstopmode",
                    "-output-directory=" + tmpdir,
                    str(tex_file)
                ],
                capture_output=True,
                timeout=30,
                text=True
            )
            
            # Check if compilation was successful
            pdf_file = Path(tmpdir) / "document.pdf"
            
            if not pdf_file.exists():
                # Compilation failed, extract error from log
                log_file = Path(tmpdir) / "document.log"
                error_msg = "LaTeX compilation failed"
                if log_file.exists():
                    log_content = log_file.read_text()
                    # Extract error lines
                    lines = log_content.split('\n')
                    error_lines = [l for l in lines if '!' in l or 'error' in l.lower()]
                    if error_lines:
                        error_msg = ' | '.join(error_lines[:3])
                
                return {
                    "success": False,
                    "error": error_msg,
                    "pdf_base64": None
                }
            
            # Read PDF and encode to base64
            pdf_bytes = pdf_file.read_bytes()
            pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
            
            return {
                "success": True,
                "pdf_base64": pdf_base64,
                "error": None
            }
            
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": "LaTeX compilation timed out (took too long)",
                "pdf_base64": None
            }
        except Exception as e:
            logger.error(f"LaTeX compilation error: {str(e)}")
            return {
                "success": False,
                "error": f"Compilation error: {str(e)}",
                "pdf_base64": None
            }


async def compile_latex_preview(latex_math: str, is_full_document: bool = False) -> dict:
    """
    Compile LaTeX for preview (math expression or full document).
    
    Args:
        latex_math: LaTeX math code (e.g., "E = mc^2") or full LaTeX document
        is_full_document: If True, treat as complete document; otherwise wrap in boilerplate
        
    Returns:
        dict with keys:
        - success: bool
        - png_base64: str (base64 encoded PNG if successful)
        - pdf_base64: str (base64 encoded PDF as fallback)
        - format: "png" or "pdf"
        - error: str (error message if failed)
    """
    try:
        if is_full_document:
            # Use document as-is
            latex_doc = latex_math
        else:
            # Wrap math in a minimal LaTeX document
            latex_doc = f"""\\documentclass{{article}}
\\usepackage{{amsmath}}
\\usepackage{{amssymb}}
\\pagestyle{{empty}}
\\begin{{document}}
${latex_math}$
\\end{{document}}
"""
        
        with tempfile.TemporaryDirectory() as tmpdir:
            tex_file = Path(tmpdir) / "preview.tex"
            tex_file.write_text(latex_doc, encoding='utf-8')
            
            # Compile to PDF
            result = subprocess.run(
                [
                    "pdflatex",
                    "-interaction=nonstopmode",
                    "-output-directory=" + tmpdir,
                    str(tex_file)
                ],
                capture_output=True,
                timeout=15
            )
            
            pdf_file = Path(tmpdir) / "preview.pdf"
            if not pdf_file.exists():
                return {
                    "success": False,
                    "png_base64": None,
                    "pdf_base64": None,
                    "format": None,
                    "error": "Failed to compile LaTeX"
                }
            
            # Try to convert PDF to PNG (requires ImageMagick + Ghostscript)
            png_file = Path(tmpdir) / "preview.png"
            try:
                subprocess.run(
                    [
                        "convert",
                        "-density", "150",
                        "-trim",
                        str(pdf_file) + "[0]",
                        "-background", "white",
                        "-alpha", "off",
                        str(png_file)
                    ],
                    capture_output=True,
                    timeout=10
                )
                
                if png_file.exists() and png_file.stat().st_size > 0:
                    png_bytes = png_file.read_bytes()
                    png_base64 = base64.b64encode(png_bytes).decode('utf-8')
                    return {
                        "success": True,
                        "png_base64": png_base64,
                        "pdf_base64": None,
                        "format": "png",
                        "error": None
                    }
            except (FileNotFoundError, subprocess.TimeoutExpired, Exception) as convert_err:
                logger.warning(f"ImageMagick conversion failed: {convert_err}, falling back to PDF")
            
            # Fallback: return PDF as base64 (browsers can display PDFs)
            pdf_bytes = pdf_file.read_bytes()
            pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
            return {
                "success": True,
                "png_base64": pdf_base64,
                "pdf_base64": pdf_base64,
                "format": "pdf",
                "error": None
            }
            
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "png_base64": None,
            "pdf_base64": None,
            "format": None,
            "error": "Compilation timed out"
        }
    except Exception as e:
        return {
            "success": False,
            "png_base64": None,
            "pdf_base64": None,
            "format": None,
            "error": f"Error: {str(e)}"
        }
