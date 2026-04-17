"""
Unit tests for Citation utilities (app.services.knowledge.citations).
Tests extraction, validation, manipulation, statistics, and preparation functions.
"""

import pytest
from app.services.knowledge.citations import (
    extract_citations,
    extract_citations_detailed,
    extract_page_numbers,
    group_citations_by_source,
    validate_citation_format,
    validate_source_uuid,
    parse_citation,
    has_citations,
    citation_statistics,
    citation_coverage,
    add_citation,
    remove_citations,
    remove_citations_clean,
    replace_citations_with_display,
    prepare_for_embedding,
    prepare_for_display,
    extract_source_citations_pg_compatible,
    build_citation,
    build_citation_range,
    build_citation_timestamp,
)

UUID1 = "550e8400-e29b-41d4-a716-446655440000"
UUID2 = "660e8400-e29b-41d4-a716-446655440001"


class TestExtractCitations:

    def test_single_citation(self):
        text = f"Entropy [src:{UUID1}:p5] is important."
        result = extract_citations(text)
        assert len(result) == 1
        assert result[0] == (UUID1, "p5")

    def test_multiple_citations(self):
        text = f"A [src:{UUID1}:p1] and B [src:{UUID2}:p2] are related."
        result = extract_citations(text)
        assert len(result) == 2

    def test_no_citations(self):
        text = "Plain text without citations."
        result = extract_citations(text)
        assert len(result) == 0

    def test_page_range_citation(self):
        text = f"See [src:{UUID1}:pp10-15] for details."
        result = extract_citations(text)
        assert result[0] == (UUID1, "pp10-15")

    def test_timestamp_citation(self):
        text = f"Listen at [src:{UUID1}:12:35] for the explanation."
        result = extract_citations(text)
        assert result[0] == (UUID1, "12:35")


class TestExtractCitationsDetailed:

    def test_returns_citation_objects(self):
        text = f"A concept [src:{UUID1}:p3] here."
        result = extract_citations_detailed(text)
        assert len(result) == 1
        c = result[0]
        assert c.source_id == UUID1
        assert c.location == "p3"
        assert c.start_pos > 0
        assert c.end_pos > c.start_pos

    def test_empty_text(self):
        result = extract_citations_detailed("")
        assert len(result) == 0


class TestExtractPageNumbers:

    def test_single_page(self):
        assert extract_page_numbers("p5") == [5]

    def test_single_page_with_dot(self):
        assert extract_page_numbers("p.5") == [5]

    def test_page_range(self):
        result = extract_page_numbers("pp10-15")
        assert result == [10, 11, 12, 13, 14, 15]

    def test_page_range_with_dots(self):
        result = extract_page_numbers("pp.10-15")
        assert result == [10, 11, 12, 13, 14, 15]

    def test_multiple_pages(self):
        result = extract_page_numbers("pages 5,7,9")
        assert result == [5, 7, 9]

    def test_timestamp_returns_empty(self):
        result = extract_page_numbers("12:35")
        assert result == []

    def test_empty_string(self):
        result = extract_page_numbers("")
        assert result == []


class TestGroupCitationsBySource:

    def test_group_by_source(self):
        text = f"A [src:{UUID1}:p1] B [src:{UUID1}:p5] C [src:{UUID2}:p3]."
        result = group_citations_by_source(text)
        assert len(result) == 2
        assert len(result[UUID1]) == 2
        assert len(result[UUID2]) == 1

    def test_no_citations(self):
        result = group_citations_by_source("No citations.")
        assert result == {}


class TestValidateCitationFormat:

    def test_valid_citation(self):
        assert validate_citation_format(f"[src:{UUID1}:p5]") is True

    def test_invalid_citation_no_brackets(self):
        assert validate_citation_format(f"src:{UUID1}:p5") is False

    def test_invalid_citation_wrong_prefix(self):
        assert validate_citation_format(f"[ref:{UUID1}:p5]") is False

    def test_invalid_citation_bad_uuid(self):
        assert validate_citation_format("[src:not-a-uuid:p5]") is False


class TestValidateSourceUUID:

    def test_valid_uuid(self):
        assert validate_source_uuid(UUID1) is True

    def test_invalid_uuid(self):
        assert validate_source_uuid("not-a-uuid") is False

    def test_empty_string(self):
        assert validate_source_uuid("") is False


class TestParseCitation:

    def test_valid_citation(self):
        result = parse_citation(f"[src:{UUID1}:p5]")
        assert result == (UUID1, "p5")

    def test_invalid_citation(self):
        result = parse_citation("not a citation")
        assert result is None

    def test_partial_citation(self):
        result = parse_citation(f"[src:{UUID1}]")
        assert result is None


class TestHasCitations:

    def test_text_with_citation(self):
        assert has_citations(f"Text [src:{UUID1}:p1] here.") is True

    def test_text_without_citation(self):
        assert has_citations("Plain text.") is False

    def test_empty_text(self):
        assert has_citations("") is False


class TestCitationStatistics:

    def test_basic_statistics(self):
        text = f"A [src:{UUID1}:p1]. B [src:{UUID1}:p5]. C [src:{UUID2}:p3]."
        stats = citation_statistics(text)
        assert stats.total_citations == 3
        assert stats.unique_sources == 2
        assert stats.citations_per_source[UUID1] == 2
        assert stats.citations_per_source[UUID2] == 1

    def test_empty_text(self):
        stats = citation_statistics("")
        assert stats.total_citations == 0
        assert stats.unique_sources == 0

    def test_pages_per_source(self):
        text = f"A [src:{UUID1}:p1]. B [src:{UUID1}:p5]."
        stats = citation_statistics(text)
        assert 1 in stats.pages_per_source[UUID1]
        assert 5 in stats.pages_per_source[UUID1]


class TestCitationCoverage:

    def test_full_coverage(self):
        text = f"A [src:{UUID1}:p1]. B [src:{UUID2}:p2]."
        coverage = citation_coverage(text)
        assert coverage == 1.0

    def test_no_coverage(self):
        text = "No citations here. None here either."
        coverage = citation_coverage(text)
        assert coverage == 0.0

    def test_partial_coverage(self):
        text = f"Cited [src:{UUID1}:p1]. Not cited."
        coverage = citation_coverage(text)
        assert coverage == 0.5

    def test_empty_text(self):
        assert citation_coverage("") == 0.0


class TestAddCitation:

    def test_add_citation_at_end(self):
        result = add_citation("Text", UUID1, "p5")
        assert result == f"Text [src:{UUID1}:p5]"

    def test_add_citation_at_position(self):
        result = add_citation("Hello World", UUID1, "p1", position=5)
        assert result.startswith("Hello")
        assert f"[src:{UUID1}:p1]" in result


class TestRemoveCitations:

    def test_remove_citations(self):
        text = f"A [src:{UUID1}:p1] B [src:{UUID2}:p2]."
        result = remove_citations(text)
        assert "[src:" not in result
        assert "A" in result

    def test_no_citations_to_remove(self):
        text = "Plain text."
        assert remove_citations(text) == text


class TestRemoveCitationsClean:

    def test_clean_whitespace(self):
        text = f"A [src:{UUID1}:p1] B."
        result = remove_citations_clean(text)
        assert "  " not in result
        assert result.strip() == result

    def test_clean_punctuation_spacing(self):
        text = f"Word [src:{UUID1}:p1] ."
        result = remove_citations_clean(text)
        assert " ." not in result


class TestReplaceCitationsWithDisplay:

    def test_replace_with_source_map(self):
        source_map = {UUID1: "Chapter 1"}
        text = f"A [src:{UUID1}:p5] concept."
        result = replace_citations_with_display(text, source_map)
        assert "Chapter 1" in result
        assert "[src:" not in result

    def test_replace_without_source_map(self):
        text = f"A [src:{UUID1}:p5] concept."
        result = replace_citations_with_display(text)
        assert "Source" in result
        assert "[src:" not in result


class TestPrepareForEmbedding:

    def test_removes_citations(self):
        text = f"Key concept [src:{UUID1}:p3] definition."
        result = prepare_for_embedding(text)
        assert "[src:" not in result
        assert "Key concept" in result


class TestPrepareForDisplay:

    def test_readable_format(self):
        text = f"A [src:{UUID1}:p3] concept."
        result = prepare_for_display(text, {UUID1: "Doc A"})
        assert "Doc A" in result


class TestPgCompatible:

    def test_extract_pg_compatible(self):
        text = f"A [src:{UUID1}:p5] concept."
        result = extract_source_citations_pg_compatible(text)
        assert len(result) == 1
        assert result[0]["source_id"] == UUID1
        assert result[0]["pages"] == [5]
        assert "position" in result[0]


class TestBuildCitation:

    def test_build_single_page(self):
        result = build_citation(UUID1, 5)
        assert result == f"[src:{UUID1}:p5]"

    def test_build_range(self):
        result = build_citation_range(UUID1, 10, 15)
        assert result == f"[src:{UUID1}:pp10-15]"

    def test_build_timestamp(self):
        result = build_citation_timestamp(UUID1, "12:35")
        assert result == f"[src:{UUID1}:12:35]"
