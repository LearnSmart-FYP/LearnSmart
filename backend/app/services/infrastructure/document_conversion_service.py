"""Document conversion service for converting office formats to PDF."""

import asyncio
import subprocess
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class DocumentConversionService:
    """Converts office documents (PPTX, DOCX, XLSX) to PDF using LibreOffice."""
    
    # Office file extensions that we can convert to PDF
    CONVERTIBLE_EXTENSIONS = {'.pptx', '.docx', '.xlsx', '.ppt', '.doc', '.xls', '.odp', '.odt', '.ods'}
    
    @staticmethod
    async def convert_to_pdf(input_path: str | Path, output_path: Optional[str | Path] = None) -> Optional[str]:
        """
        Convert an office document to PDF using LibreOffice.
        
        Args:
            input_path: Path to the input document (PPTX, DOCX, XLSX, etc.)
            output_path: Path where PDF should be saved. If None, saves in same directory as input.
        
        Returns:
            Path to the converted PDF if successful, None if conversion failed.
        """
        input_path = Path(input_path)
        
        # Check if file extension is convertible
        if input_path.suffix.lower() not in DocumentConversionService.CONVERTIBLE_EXTENSIONS:
            logger.debug(f"File {input_path.suffix} is not in convertible list, skipping conversion")
            return None
        
        if not input_path.exists():
            logger.error(f"Input file does not exist: {input_path}")
            return None
        
        # Determine output path
        if output_path is None:
            output_path = input_path.with_suffix('.pdf')
        else:
            output_path = Path(output_path)
        
        # Create output directory if it doesn't exist
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Use LibreOffice to convert
        # --headless: no GUI
        # --convert-to pdf: convert to PDF
        # --outdir: output directory
        try:
            cmd = [
                'libreoffice',
                '--headless',
                '--convert-to', 'pdf',
                '--outdir', str(output_path.parent),
                str(input_path),
            ]
            
            # Run conversion asynchronously with timeout
            result = await asyncio.wait_for(
                asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                ),
                timeout=60.0
            )
            
            stdout, stderr = await result.communicate()
            
            if result.returncode != 0:
                logger.error(f"LibreOffice conversion failed: {stderr.decode()}")
                return None
            
            # LibreOffice outputs PDF with same basename in output directory
            expected_pdf = output_path.parent / f"{input_path.stem}.pdf"
            
            if expected_pdf.exists():
                logger.info(f"Successfully converted {input_path} to {expected_pdf}")
                return str(expected_pdf)
            else:
                logger.error(f"Expected PDF not found at {expected_pdf} after LibreOffice conversion")
                return None
                
        except asyncio.TimeoutError:
            logger.error(f"LibreOffice conversion timeout for {input_path}")
            return None
        except Exception as e:
            logger.error(f"Error during document conversion: {e}")
            return None


# Global instance
document_conversion_service = DocumentConversionService()
