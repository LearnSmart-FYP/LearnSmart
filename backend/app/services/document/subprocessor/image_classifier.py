import logging
import time
from dataclasses import dataclass
from io import BytesIO
from PIL import Image
from collections import Counter
import torch
from transformers import CLIPProcessor, CLIPModel
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_macmini_backoff_expires = 0.0
_MACMINI_BACKOFF_SECONDS = 300

# Lazy load CLIP to avoid slow startup
_clip_model = None
_clip_processor = None
_device = None

KEEP_CATEGORIES = [
    "an educational diagram with text and shapes",
    "a mathematical graph showing data or functions",
    "a chart with numbers or statistics",
    "a technical illustration explaining a concept",
    "a screenshot showing information or interface",
    "a flowchart showing process steps",
    "a scientific diagram or schematic",
    "an infographic with educational content"]

DISCARD_CATEGORIES = [
    "a solid color background or gradient",
    "a simple decorative border or frame",
    "a small decorative icon",
    "a company logo or branding element",
    "a repeating decorative pattern",
    "a page header or footer decoration",
    "a watermark or background texture",
    "a simple geometric shape decoration"]

@dataclass
class ClassificationResult:
    should_keep: bool
    category: str
    confidence: float
    reason: str

def _load_clip():

    global _clip_model, _clip_processor, _device

    if _clip_model is not None:
        return _clip_model, _clip_processor, _device

    try:

        import os
        _device = "cuda" if torch.cuda.is_available() else "cpu"
        local_path = "/root/.cache/huggingface/hub/clip-local"
        model_name = local_path if os.path.isdir(local_path) else "openai/clip-vit-base-patch32"
        logger.info(f"Loading CLIP model from {model_name} on {_device}...")

        _clip_model = CLIPModel.from_pretrained(model_name).to(_device)
        _clip_processor = CLIPProcessor.from_pretrained(model_name)
        logger.info("CLIP model loaded successfully")

        return _clip_model, _clip_processor, _device

    except ImportError as e:
        logger.warning(f"CLIP not available: {e}. Install with: pip install transformers torch")
        return None, None, None
    except Exception as e:
        logger.error(f"Failed to load CLIP: {e}")
        return None, None, None

def classify_image(source: bytes | Image.Image) -> ClassificationResult:

    if isinstance(source, bytes):

        try:
            image = Image.open(BytesIO(source)).convert("RGB")

        except Exception as e:
            logger.debug(f"Failed to open image: {e}")
            return ClassificationResult(
                should_keep = False,
                category = "invalid",
                confidence = 1.0,
                reason = "Could not open image")
    else:
        image = source.convert("RGB") if source.mode != "RGB" else source

    width, height = image.size

    # Filter out small image (likely icon)
    if width < 100 and height < 100:
        return ClassificationResult(
            should_keep = False,
            category = "small_icon",
            confidence = 0.9,
            reason = f"Image too small ({width}x{height})")

    # Filter out blank/solid backgrounds
    if _is_mostly_single_color(image, threshold = 0.90):
        return ClassificationResult(
            should_keep = False,
            category = "blank_or_solid",
            confidence = 0.95,
            reason = "Image is mostly a single color")

    # Filter out gradient background
    if _is_gradient_background(image):
        return ClassificationResult(
            should_keep = False,
            category = "gradient_background",
            confidence = 0.85,
            reason = "Image appears to be a gradient background")

    # Filter out decorative patterns
    if _is_low_complexity(image):
        return ClassificationResult(
            should_keep = False,
            category = "low_complexity_pattern",
            confidence = 0.80,
            reason = "Image has very low visual complexity")

    # Obtain CLIP classification
    model, processor, device = _load_clip()

    if model is None:
        return ClassificationResult(
            should_keep = True,
            category = "unknown",
            confidence = 0.5,
            reason = "CLIP not available, keeping by default")

    try:

        all_categories = KEEP_CATEGORIES + DISCARD_CATEGORIES

        inputs = processor(
            text = all_categories,
            images = image,
            return_tensors = "pt",
            padding = True).to(device)

        with torch.no_grad():
            outputs = model(**inputs)
            logits_per_image = outputs.logits_per_image
            probs = logits_per_image.softmax(dim = 1).cpu().numpy()[0]

        # Find best matching category
        best_idx = probs.argmax()
        best_category = all_categories[best_idx]
        best_confidence = float(probs[best_idx])

        # Determine if we should keep
        should_keep = best_idx < len(KEEP_CATEGORIES)

        if not should_keep and best_confidence < 0.75:
            return ClassificationResult(
                should_keep = True,
                category = best_category,
                confidence = best_confidence,
                reason = f"Low confidence ({best_confidence:.1%}), keeping to be safe")

        return ClassificationResult(
            should_keep = should_keep,
            category = best_category,
            confidence = best_confidence,
            reason = f"CLIP classified as '{best_category}' with {best_confidence:.1%} confidence")

    except Exception as e:
        logger.error(f"CLIP classification failed: {e}")
        return ClassificationResult(
            should_keep = True,
            category = "error",
            confidence = 0.0,
            reason = f"Classification error: {e}")

def _is_mostly_single_color(image: Image.Image, threshold: float = 0.90) -> bool:

    try:

        # Resize for faster processing
        small = image.resize((50, 50))
        pixels = list(small.getdata())

        if not pixels:
            return False

        # Quantize colors to reduce noise
        quantized = [(r // 32, g // 32, b // 32) for r, g, b in pixels]
        color_counts = Counter(quantized)
        most_common_count = color_counts.most_common(1)[0][1]
        ratio = most_common_count / len(pixels)
        return ratio > threshold

    except Exception:
        return False

def _is_gradient_background(image: Image.Image) -> bool:

    try:

        small = image.resize((50, 50))
        pixels = list(small.getdata())

        if not pixels:
            return False

        quantized = [(r // 16, g // 16, b // 16) for r, g, b in pixels]
        unique_colors = len(set(quantized))

        if 10 < unique_colors < 100:
            color_counts = Counter(quantized)
            max_count = max(color_counts.values())
            if max_count / len(pixels) < 0.4:
                return True

        return False

    except Exception:
        return False

def _is_low_complexity(image: Image.Image) -> bool:

    try:

        small = image.resize((50, 50))
        pixels = list(small.getdata())

        if not pixels:
            return False

        quantized = [(r // 64, g // 64, b // 64) for r, g, b in pixels]
        unique_colors = len(set(quantized))

        return 2 < unique_colors <= 5

    except Exception:
        return False

def should_keep_image(image_bytes: bytes, ocr_text: str = "") -> tuple[bool, str]:

    if ocr_text and len(ocr_text.strip()) > 20:
        return True, "Contains text from OCR"

    # Try Mac Mini first, fall back to local CLIP
    macmini_url = settings.macmini_base_url
    global _macmini_backoff_expires
    now = time.time()

    if macmini_url:
        if now < _macmini_backoff_expires:
            logger.debug("Skipping Mac Mini classification due to backoff")
        else:
            try:
                timeout = httpx.Timeout(6.0, connect=2.0)
                with httpx.Client(timeout=timeout) as client:
                    resp = client.post(
                        f"{macmini_url}/classify-image",
                        files={"image": ("image.bin", image_bytes, "application/octet-stream")})
                    if resp.status_code == 200:
                        data = resp.json()
                        logger.info(f"Image classification via Mac Mini: {data.get('category')}")
                        return data.get("should_keep", True), data.get("reason", "Mac Mini classification")
                    logger.debug(f"Mac Mini returned status {resp.status_code}; falling back to local classification")
            except Exception as e:
                logger.debug(f"Mac Mini classification unavailable: {e}")
                _macmini_backoff_expires = now + _MACMINI_BACKOFF_SECONDS

    result = classify_image(image_bytes)
    return result.should_keep, result.reason
