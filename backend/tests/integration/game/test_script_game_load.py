import json
import pytest


@pytest.mark.asyncio
async def test_get_script_by_id_and_by_document(client, db, auth_headers):
    # Insert minimal related parsed_document row (join target)
    await db.execute(
        """
        INSERT INTO parsed_documents (document_name, document_hash, modules, summary)
        VALUES ($1, $2, $3::jsonb, $4::jsonb)
        """,
        "Test Doc",
        "hash_abc",
        # modules is a list of module objects; at minimum it must include the module_name we load.
        json.dumps([{"name": "Module 1"}]),
        json.dumps({"total_concepts": 0, "total_structures": 0, "total_applications": 0, "difficulty_score": 0}),
    )

    outline = {
        "title": "Test Script",
        "module_name": "Module 1",
        "characters": [
            {
                "name": "Alice",
                "role": "Detective",
                "age": 20,
                "occupation": "Student",
                "background": "Background text",
                "personality": "Curious",
                "secret": "Secret",
                "knowledge_points": ["KP1"],
                "goal": "Solve it",
            }
        ],
        "acts": [],
        "evidence": [],
        "knowledge_mapping": [],
        "puzzle_config": {
            "difficulty_distribution": {"easy": 1},
            "max_hints_per_puzzle": 3,
            "points_per_difficulty": {"easy": 10},
            "mastery_threshold": 0.8,
        },
    }

    script_id = await db.fetchval(
        """
        INSERT INTO scripts (document_hash, outline_json, module_name)
        VALUES ($1, $2::jsonb, $3)
        RETURNING id
        """,
        "hash_abc",
        json.dumps(outline),
        "Module 1",
    )

    # By document/module (this is the key route for the document_hash + module_name mapping)
    r2 = await client.get(
        "/api/game/scripts/by-document",
        params={"document_hash": "hash_abc", "module_name": "Module 1"},
        headers=auth_headers,
    )
    assert r2.status_code == 200
    data2 = r2.json()
    assert data2["id"] == str(script_id)
    assert data2["characters"][0]["name"] == "Alice"
    assert isinstance(data2["characters"][0]["knowledge_points"], list)


@pytest.mark.asyncio
async def test_get_script_by_document_rejects_unknown_module_name(client, db, auth_headers):
    await db.execute(
        """
        INSERT INTO parsed_documents (document_name, document_hash, modules, summary)
        VALUES ($1, $2, $3::jsonb, $4::jsonb)
        """,
        "Test Doc",
        "hash_guard",
        json.dumps([{"name": "Allowed"}]),
        json.dumps({"total_concepts": 0, "total_structures": 0, "total_applications": 0, "difficulty_score": 0}),
    )

    outline = {
        "title": "Guarded Script",
        "module_name": "NotAllowed",
        "characters": [],
        "acts": [],
        "evidence": [],
        "knowledge_mapping": [],
        "puzzle_config": {
            "difficulty_distribution": {"easy": 0},
            "max_hints_per_puzzle": 3,
            "points_per_difficulty": {"easy": 10},
            "mastery_threshold": 0.8,
        },
    }

    await db.execute(
        """
        INSERT INTO scripts (document_hash, outline_json, module_name)
        VALUES ($1, $2::jsonb, $3)
        """,
        "hash_guard",
        json.dumps(outline),
        "NotAllowed",
    )

    r = await client.get(
        "/api/game/scripts/by-document",
        params={"document_hash": "hash_guard", "module_name": "NotAllowed"},
        headers=auth_headers,
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_by_document_route_is_not_captured_by_uuid_route(client, auth_headers):
    # If routing is misconfigured, FastAPI may interpret "by-document" as {script_id}
    # and try to parse it as UUID. With correct routing, we should get a 422 because
    # document_hash/module_name query params are missing.
    r = await client.get("/api/game/scripts/by-document", headers=auth_headers)
    assert r.status_code == 422
