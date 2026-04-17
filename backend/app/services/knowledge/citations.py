"""
Citation Utilities Module

Provides functions for parsing, validating, extracting, and manipulating
inline citations in the format: [src:UUID:page_or_location]

Example: "Entropy [src:550e8400-e29b-41d4-a716-446655440000:p5] is a measure..."
"""
import re
from typing import List, Tuple, Dict, Optional
from dataclasses import dataclass


# Citation format: [src:UUID:location]
CITATION_PATTERN = re.compile(r'\[src:([a-f0-9\-]{36}):([^\]]+)\]', re.IGNORECASE)

# Page number patterns
PAGE_SINGLE = re.compile(r'p\.?(\d+)', re.IGNORECASE)
PAGE_RANGE = re.compile(r'pp?\.?\s*(\d+)\s*[-–]\s*(\d+)', re.IGNORECASE)
PAGE_MULTIPLE = re.compile(r'pages?\s*([\d,\s]+)', re.IGNORECASE)


@dataclass
class Citation:
    """Represents a single citation."""
    source_id: str
    location: str
    start_pos: int
    end_pos: int
    full_text: str


def extract_citations(text: str) -> List[Tuple[str, str]]:
    """
    Extract all citations from text.

    Args:
        text: Text containing citations

    Returns:
        List of (source_id, location) tuples
    """
    return CITATION_PATTERN.findall(text)


def extract_citations_detailed(text: str) -> List[Citation]:
    """
    Extract all citations with position information.

    Args:
        text: Text containing citations

    Returns:
        List of Citation objects with position info
    """
    citations = []
    for match in CITATION_PATTERN.finditer(text):
        citations.append(Citation(
            source_id=match.group(1),
            location=match.group(2),
            start_pos=match.start(),
            end_pos=match.end(),
            full_text=match.group(0)
        ))
    return citations


def extract_page_numbers(location: str) -> List[int]:
    """
    Parse page numbers from location string.

    Handles:
        - Single: "p5", "p.5", "page 5" → [5]
        - Range: "pp.10-15", "pages 10-15" → [10,11,12,13,14,15]
        - Multiple: "pages 5,7,9" → [5,7,9]
        - Timestamps: "12:35" → [] (not pages)

    Args:
        location: Location string from citation

    Returns:
        List of page numbers (may be empty for non-page locations)
    """
    pages = []

    # Try range first (pp.10-15)
    range_match = PAGE_RANGE.search(location)
    if range_match:
        start, end = int(range_match.group(1)), int(range_match.group(2))
        return list(range(start, end + 1))

    # Try multiple pages (pages 5,7,9)
    multi_match = PAGE_MULTIPLE.search(location)
    if multi_match:
        nums = re.findall(r'\d+', multi_match.group(1))
        return [int(n) for n in nums]

    # Try single page (p5, p.5)
    single_match = PAGE_SINGLE.search(location)
    if single_match:
        return [int(single_match.group(1))]

    return pages


def has_citations(text: str) -> bool:
    """
    Check if text contains any citations.

    Args:
        text: Text to check

    Returns:
        True if at least one citation found
    """
    return bool(CITATION_PATTERN.search(text))


def citation_coverage(text: str) -> float:
    """
    Calculate what percentage of sentences have citations.

    Args:
        text: Text to analyze

    Returns:
        Float between 0.0 and 1.0
    """
    # Simple sentence split (could be improved with nltk)
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]

    if not sentences:
        return 0.0

    cited_count = sum(1 for s in sentences if has_citations(s))
    return cited_count / len(sentences)


def remove_citations(text: str) -> str:
    """
    Remove all citations from text.

    Args:
        text: Text with citations

    Returns:
        Text without citations
    """
    return CITATION_PATTERN.sub('', text)


def remove_citations_clean(text: str) -> str:
    """
    Remove citations and clean up resulting whitespace.

    Args:
        text: Text with citations

    Returns:
        Clean text without citations
    """
    result = remove_citations(text)
    # Clean up double spaces and trailing spaces before punctuation
    result = re.sub(r'\s+', ' ', result)
    result = re.sub(r'\s+([.!?,;:])', r'\1', result)
    return result.strip()


def replace_citations_with_display(
    text: str,
    source_map: Optional[Dict[str, str]] = None,
    format_template: str = "[{name}, {location}]"
) -> str:
    """
    Replace citations with human-readable format.

    Args:
        text: Text with citations
        source_map: Optional dict mapping source_id to display name
        format_template: Template for display format

    Returns:
        Text with readable citations
    """
    def replace_fn(match):
        source_id = match.group(1)
        location = match.group(2)

        if source_map and source_id in source_map:
            name = source_map[source_id]
        else:
            name = f"Source {source_id[:8]}..."

        return format_template.format(name=name, location=location)

    return CITATION_PATTERN.sub(replace_fn, text)


