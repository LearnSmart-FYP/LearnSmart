"""
Unit tests for QueryAnalyzer (app.services.retrieval.query_analyzer).
Tests intent classification, synonym expansion, concept extraction, and query analysis.
"""

import pytest
from app.services.retrieval.query_analyzer import (
    QueryAnalyzer,
    QueryIntent,
    AnalyzedQuery,
    expand_abbreviation,
    get_synonyms,
    is_abbreviation,
    SYNONYMS,
)

analyzer = QueryAnalyzer()


class TestQueryIntent:

    def test_definition_intent(self):
        result = analyzer.analyze("What is machine learning?")
        assert result.intent == QueryIntent.DEFINITION

    def test_explanation_intent(self):
        result = analyzer.analyze("How does gradient descent work?")
        assert result.intent == QueryIntent.EXPLANATION

    def test_comparison_intent(self):
        result = analyzer.analyze("Compare CNN and RNN")
        assert result.intent == QueryIntent.COMPARISON

    def test_example_intent(self):
        result = analyzer.analyze("Give me an example of a neural network")
        assert result.intent == QueryIntent.EXAMPLE

    def test_procedure_intent(self):
        result = analyzer.analyze("How to implement gradient descent?")
        assert result.intent == QueryIntent.PROCEDURE

    def test_prerequisite_intent(self):
        result = analyzer.analyze("What do I need to know before learning transformers?")
        assert result.intent == QueryIntent.PREREQUISITE

    def test_related_intent(self):
        result = analyzer.analyze("Topics related to deep learning")
        assert result.intent == QueryIntent.RELATED

    def test_general_intent(self):
        result = analyzer.analyze("machine learning applications")
        assert result.intent == QueryIntent.GENERAL


class TestSynonymExpansion:

    def test_ml_synonym(self):
        synonyms = get_synonyms("ml")
        assert len(synonyms) > 0

    def test_ai_synonym(self):
        synonyms = get_synonyms("ai")
        assert len(synonyms) > 0

    def test_unknown_term(self):
        synonyms = get_synonyms("xyznonexistent")
        assert len(synonyms) == 0


class TestAbbreviationExpansion:

    def test_known_abbreviation(self):
        result = expand_abbreviation("ml")
        assert result is not None
        assert "learning" in result.lower()

    def test_unknown_abbreviation(self):
        result = expand_abbreviation("xyz")
        assert result is None

    def test_is_abbreviation(self):
        assert is_abbreviation("ml") is True
        assert is_abbreviation("ai") is True

    def test_is_not_abbreviation(self):
        assert is_abbreviation("machine learning") is False


class TestAnalyze:

    def test_returns_analyzed_query(self):
        result = analyzer.analyze("What is deep learning?")
        assert isinstance(result, AnalyzedQuery)
        assert result.original_query == "What is deep learning?"
        assert len(result.normalized_query) > 0

    def test_concepts_extracted(self):
        result = analyzer.analyze("What is the difference between CNN and RNN?")
        assert len(result.concepts) >= 1

    def test_empty_query(self):
        result = analyzer.analyze("")
        assert isinstance(result, AnalyzedQuery)
        assert result.intent == QueryIntent.GENERAL


class TestExpandQuery:

    def test_expand_with_abbreviation(self):
        result = analyzer.expand_query("What is ML?")
        assert isinstance(result, str)
        assert len(result) > 0

    def test_expand_plain_query(self):
        result = analyzer.expand_query("deep learning basics")
        assert isinstance(result, str)


class TestGetSearchTerms:

    def test_search_terms_from_query(self):
        terms = analyzer.get_search_terms("What is machine learning?")
        assert isinstance(terms, list)
        assert len(terms) > 0

    def test_search_terms_from_abbreviation(self):
        terms = analyzer.get_search_terms("explain NLP")
        assert isinstance(terms, list)


class TestSynonymsDictionary:

    def test_synonyms_dict_not_empty(self):
        assert len(SYNONYMS) > 0

    def test_ai_ml_synonyms_exist(self):
        assert "machine learning" in SYNONYMS
        assert "artificial intelligence" in SYNONYMS
        assert "deep learning" in SYNONYMS

    def test_programming_synonyms_exist(self):
        assert "application programming interface" in SYNONYMS
        assert "database" in SYNONYMS

    def test_statistics_synonyms_exist(self):
        assert "statistics" in SYNONYMS
        assert "probability" in SYNONYMS
