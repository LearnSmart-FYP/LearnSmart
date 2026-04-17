"""
Integration tests for Admin API (User Management - Admin Panel).
Tests admin-only endpoints: content listing, flashcard stats, settings dashboard.
Verifies role-based access control (admin required, 403 for non-admin, 401 for unauthenticated).
"""

import pytest


class TestAdminContent:
    """Tests for GET /api/admin/content — list content for moderation."""

    @pytest.mark.asyncio
    async def test_list_content_as_admin(self, client, admin_headers):
        response = await client.get("/api/admin/content", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert isinstance(data["items"], list)

    @pytest.mark.asyncio
    async def test_list_content_filter_by_type(self, client, admin_headers):
        response = await client.get(
            "/api/admin/content",
            headers=admin_headers,
            params={"content_type": "document"})
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        for item in data["items"]:
            assert item["type"] == "document"

    @pytest.mark.asyncio
    async def test_list_content_filter_by_status(self, client, admin_headers):
        response = await client.get(
            "/api/admin/content",
            headers=admin_headers,
            params={"status": "approved"})
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    @pytest.mark.asyncio
    async def test_list_content_with_pagination(self, client, admin_headers):
        response = await client.get(
            "/api/admin/content",
            headers=admin_headers,
            params={"limit": 5, "offset": 0})
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) <= 5

    @pytest.mark.asyncio
    async def test_list_content_unauthorized(self, client):
        response = await client.get("/api/admin/content")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_content_non_admin(self, client, auth_headers):
        response = await client.get("/api/admin/content", headers=auth_headers)
        assert response.status_code in [403, 401]


class TestAdminFlashcardStats:
    """Tests for GET /api/admin/flashcard-stats — platform flashcard statistics."""

    @pytest.mark.asyncio
    async def test_get_flashcard_stats_as_admin(self, client, admin_headers):
        response = await client.get("/api/admin/flashcard-stats", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_cards" in data
        assert "active_cards" in data
        assert "archived_cards" in data
        assert "avg_ease_factor" in data
        assert "platform_mastery_rate_pct" in data
        assert "algorithm_distribution" in data
        assert isinstance(data["algorithm_distribution"], list)

    @pytest.mark.asyncio
    async def test_get_flashcard_stats_unauthorized(self, client):
        response = await client.get("/api/admin/flashcard-stats")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_flashcard_stats_non_admin(self, client, auth_headers):
        response = await client.get("/api/admin/flashcard-stats", headers=auth_headers)
        assert response.status_code in [403, 401]


class TestAdminSettings:
    """Tests for GET /api/admin/settings — dashboard statistics and service status."""

    @pytest.mark.asyncio
    async def test_get_settings_as_admin(self, client, admin_headers):
        response = await client.get("/api/admin/settings", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "stats" in data
        assert "services" in data

        stats = data["stats"]
        assert "total_users" in stats
        assert "total_documents" in stats
        assert "total_discussions" in stats
        assert "total_communities" in stats
        assert "total_flashcards" in stats
        assert "total_questions" in stats
        assert "ai_tokens_used_this_month" in stats

        services = data["services"]
        assert services["database"] == "operational"
        assert services["storage"] == "operational"
        assert services["ai_service"] == "operational"

    @pytest.mark.asyncio
    async def test_get_settings_unauthorized(self, client):
        response = await client.get("/api/admin/settings")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_settings_non_admin(self, client, auth_headers):
        response = await client.get("/api/admin/settings", headers=auth_headers)
        assert response.status_code in [403, 401]
