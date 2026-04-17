import json

import pytest


@pytest.mark.asyncio
async def test_script_game_validate_updates_progress(client, auth_headers, db, authenticated_user):
    # Create a minimal script with one puzzle in outline_json
    script_id = await db.fetchval(
        """
        INSERT INTO scripts (user_id, title, outline_json, module_name)
        VALUES ($1, $2, $3::jsonb, $4)
        RETURNING id
        """,
        authenticated_user["user"]["id"],
        "Test Script",
        json.dumps(
            {
                "title": "Test Script",
                "acts": [
                    {
                        "scenes": [
                            {
                                "location": "Lab",
                                "puzzles": [
                                    {
                                        "id": "puzzle-1",
                                        "puzzle": "What is 2+2?",
                                        "solution": "4",
                                        "difficulty": "easy",
                                        "concept_ids": ["MATH_001"],
                                        "hints": [
                                            "Think basic addition",
                                            "It's the same as 2*2",
                                            "The result is four",
                                        ],
                                    }
                                ],
                            }
                        ]
                    }
                ],
            }
        ),
        "unit",
    )

    # Validate correct answer
    res = await client.post(
        f"/api/game/scripts/{script_id}/puzzles/validate",
        headers=auth_headers,
        json={"puzzle_id": "puzzle-1", "user_answer": "4", "attempt_number": 1},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["is_correct"] is True
    assert body["points_awarded"] > 0

    # Progress should now exist
    gp = await client.get(f"/api/game/scripts/{script_id}/progress", headers=auth_headers)
    assert gp.status_code == 200
    progress = gp.json()
    assert progress is not None
    assert "puzzle-1" in (progress.get("solved_puzzles") or [])
    assert progress.get("mastery_score", 0) >= body["points_awarded"]
    assert (progress.get("player_progress") or {}).get("MATH_001") is True

    # Analytics should reflect script puzzle counts and progress
    an = await client.get(f"/api/game/scripts/{script_id}/analytics", headers=auth_headers)
    assert an.status_code == 200
    analytics = an.json()
    assert analytics["total_puzzles"] == 1
    assert analytics["puzzles_solved"] == 1
    assert analytics["mastery_score"] >= body["points_awarded"]

    # Report should be generated (now based on stored progress)
    rp = await client.post(f"/api/game/scripts/{script_id}/report", headers=auth_headers)
    assert rp.status_code == 200
    report = rp.json()
    assert report["performance_metrics"]["total_puzzles"] == 1
    assert report["performance_metrics"]["puzzles_solved"] == 1
    assert report["final_score"] >= body["points_awarded"]


@pytest.mark.asyncio
async def test_script_game_hints_endpoint_does_not_leak_solution(client, auth_headers, db, authenticated_user):
    script_id = await db.fetchval(
        """
        INSERT INTO scripts (user_id, title, outline_json, module_name)
        VALUES ($1, $2, $3::jsonb, $4)
        RETURNING id
        """,
        authenticated_user["user"]["id"],
        "Test Script",
        json.dumps(
            {
                "acts": [
                    {
                        "scenes": [
                            {
                                "location": "Lab",
                                "puzzles": [
                                    {
                                        "id": "puzzle-1",
                                        "puzzle": "What is 2+2?",
                                        "solution": "4",
                                        "hints": ["h1", "h2", "h3"],
                                    }
                                ],
                            }
                        ]
                    }
                ]
            }
        ),
        "unit",
    )

    res = await client.get(
        f"/api/game/scripts/{script_id}/hints/puzzle-1",
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["puzzle_id"] == "puzzle-1"
    assert data["hints"] == ["h1", "h2", "h3"]
    assert "solution" not in data

    # Hint usage should be persisted into progress and reflected by analytics/report.
    gp = await client.get(f"/api/game/scripts/{script_id}/progress", headers=auth_headers)
    assert gp.status_code == 200
    progress = gp.json()
    assert progress.get("hints_used") == 1
    assert (progress.get("hint_usage") or {}).get("puzzle-1", {}).get("count") == 1

    an = await client.get(f"/api/game/scripts/{script_id}/analytics", headers=auth_headers)
    assert an.status_code == 200
    assert an.json().get("hints_used") == 1

    rp = await client.post(f"/api/game/scripts/{script_id}/report", headers=auth_headers)
    assert rp.status_code == 200
    assert rp.json()["performance_metrics"]["hints_used"] == 1
