from typing import Dict, Any, List, Optional
from datetime import date, datetime, timedelta


class GamificationRepository:

    def __init__(self, db):
        self.db = db


    async def get_point_rule(self, action_type: str) -> Optional[Dict[str, Any]]:
        row = await self.db.fetchrow(
            "SELECT * FROM point_rules WHERE action_type = $1 AND is_active = TRUE",
            action_type,
        )
        return dict(row) if row else None

    async def check_daily_limit(self, user_id: str, action_type: str) -> bool:
        """Returns True if the daily limit has been reached."""
        rule = await self.get_point_rule(action_type)
        if not rule or not rule.get("daily_limit"):
            return False

        count = await self.db.fetchval(
            """
            SELECT COUNT(*) FROM user_points
            WHERE user_id = $1 AND action_type = $2 AND created_at::date = $3
            """,
            user_id, action_type, date.today(),
        )
        return count >= rule["daily_limit"]

    async def _get_active_multiplier(self, user_id: str, community_id: Optional[str] = None) -> float:
        """Check for active XP boosts (user-level and community-level)."""
        multiplier = 1.0
        now = datetime.utcnow()
        # User-level boost
        user_boost = await self.db.fetchval(
            """
            SELECT boost_value->>'multiplier'
            FROM active_boosts
            WHERE user_id = $1 AND scope = 'user' AND boost_type = 'xp_multiplier'
              AND is_active = TRUE AND starts_at <= $2 AND expires_at > $2
            ORDER BY (boost_value->>'multiplier')::numeric DESC
            LIMIT 1
            """,
            user_id, now,
        )
        if user_boost:
            multiplier = max(multiplier, float(user_boost))
        # Community-level boost
        if community_id:
            comm_boost = await self.db.fetchval(
                """
                SELECT boost_value->>'multiplier'
                FROM active_boosts
                WHERE community_id = $1 AND scope = 'community' AND boost_type = 'xp_multiplier'
                  AND is_active = TRUE AND starts_at <= $2 AND expires_at > $2
                ORDER BY (boost_value->>'multiplier')::numeric DESC
                LIMIT 1
                """,
                community_id, now,
            )
            if comm_boost:
                multiplier = max(multiplier, float(comm_boost))
        return multiplier

    async def award_points(
        self,
        user_id: str,
        action_type: str,
        points: int,
        point_type_id: str,
        rule_id: Optional[str] = None,
        action_id: Optional[str] = None,
        community_id: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        # Apply active XP boost multiplier
        if action_type != "shop_purchase":
            try:
                multiplier = await self._get_active_multiplier(user_id, community_id)
                if multiplier > 1.0:
                    points = int(points * multiplier)
            except Exception:
                pass  # best-effort, fall back to base points

        row = await self.db.fetchrow(
            """
            INSERT INTO user_points (user_id, point_type_id, points, action_type,
                                     rule_id, action_id, community_id, description)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            """,
            user_id, point_type_id, points, action_type,
            rule_id, action_id, community_id, description,
        )
        # Update user_currency balance
        await self.db.execute(
            """
            INSERT INTO user_currency (user_id, balance, total_earned)
            VALUES ($1, $2, $2)
            ON CONFLICT (user_id) DO UPDATE
            SET balance = user_currency.balance + $2,
                total_earned = user_currency.total_earned + $2,
                updated_at = NOW()
            """,
            user_id, points,
        )
        # Update community contribution_points if community context
        if community_id:
            await self.db.execute(
                """
                UPDATE community_members
                SET contribution_points = contribution_points + $3
                WHERE community_id = $1 AND user_id = $2
                """,
                community_id, user_id, points,
            )

        # Auto-update daily_study streak (skip if the action IS a streak award)
        if action_type not in ("daily_study", "weekly_share"):
            try:
                today = date.today()
                streak = await self.db.fetchrow(
                    "SELECT last_activity_date FROM user_streaks WHERE user_id = $1 AND streak_type = 'daily_study'",
                    user_id,
                )
                if not streak or streak["last_activity_date"] != today:
                    await self.update_streak(user_id, "daily_study")
            except Exception:
                pass  # best-effort

        # Auto-check badge criteria (skip for badge_earned to avoid recursion)
        if action_type != "badge_earned":
            try:
                await self.check_and_award_badges(user_id, community_id)
            except Exception:
                pass  # best-effort

        # Auto-fire reputation event
        _REP_MAP = {
            "share_content":      ("content_shared",            "content",     "shared_content"),
            "content_liked":      ("content_liked",             "content",     "shared_content"),
            "give_feedback":      ("feedback_given",            "feedback",    "peer_feedback"),
            "feedback_helpful":   ("feedback_marked_helpful",   "feedback",    "peer_feedback"),
            "discussion_post":    ("discussion_created",        "engagement",  "discussion_thread"),
            "discussion_reply":   ("reply_liked",               "engagement",  "discussion_reply"),
            "answer_accepted":    ("content_rated",             "teaching",    "discussion_reply"),
            "challenge_complete": ("challenge_completed",       "reliability", "challenge"),
            "challenge_win":      ("challenge_won",             "reliability", "challenge"),
            "mentor_session":     ("mentoring_completed",       "teaching",    "mentorship"),
            "daily_study":        ("streak_milestone",          "reliability", None),
            "weekly_share":       ("streak_milestone",          "content",     None),
        }
        mapping = _REP_MAP.get(action_type)
        if mapping:
            try:
                from app.repositories.reputation_repository import ReputationRepository
                event_type, dimension, ref_type = mapping
                rep_repo = ReputationRepository(self.db)
                rep_points = max(1, points // 2)
                await rep_repo.add_event(
                    user_id=user_id,
                    event_type=event_type,
                    dimension=dimension,
                    points_change=rep_points,
                    reference_type=ref_type,
                    reference_id=action_id,
                    community_id=community_id,
                )
            except Exception:
                pass  # best-effort

        return dict(row) if row else None

    async def get_points_summary(self, user_id: str) -> Dict[str, Any]:
        # Currency
        try:
            currency = await self.db.fetchrow(
                "SELECT * FROM user_currency WHERE user_id = $1", user_id
            )
            balance = dict(currency) if currency else {}
        except Exception:
            balance = {}

        # Points by type
        try:
            points_by_type_rows = await self.db.fetch(
                """
                SELECT pt.name, pt.url_id, pt.icon, pt.color,
                       COALESCE(SUM(up.points), 0) as total
                FROM point_types pt
                LEFT JOIN user_points up ON pt.id = up.point_type_id AND up.user_id = $1
                WHERE pt.is_global = TRUE
                GROUP BY pt.id, pt.name, pt.url_id, pt.icon, pt.color
                ORDER BY pt.name
                """,
                user_id,
            )
            points_by_type = [
                {
                    "name": r["name"],
                    "url_id": r["url_id"],
                    "icon": r["icon"],
                    "color": r["color"],
                    "total": int(r["total"]),
                }
                for r in points_by_type_rows
            ]
        except Exception:
            points_by_type = []

        # Streak
        try:
            streak = await self.db.fetchrow(
                "SELECT * FROM user_streaks WHERE user_id = $1 AND streak_type = 'daily_study'",
                user_id,
            )
            current_streak = int(streak["current_streak"]) if streak and streak["current_streak"] is not None else 0
            streak_data = {
                "current": current_streak,
                "longest": int(streak["longest_streak"]) if streak and streak["longest_streak"] is not None else 0,
                "multiplier": float(streak["current_multiplier"]) if streak and streak["current_multiplier"] is not None else 1.0,
            }
            # Display-time reconciliation: if user hasn't been active for >1 day,
            # check if a freeze would save the streak; if not, show 0.
            if streak and streak["last_activity_date"] and current_streak > 0:
                diff = (date.today() - streak["last_activity_date"]).days
                if diff > 1:
                    has_freeze = await self.db.fetchval(
                        """
                        SELECT 1 FROM user_inventory ui
                        JOIN shop_items si ON si.id = ui.shop_item_id
                        WHERE ui.user_id = $1 AND si.item_type = 'streak_freeze' AND ui.quantity > 0
                        LIMIT 1
                        """,
                        user_id,
                    )
                    if not has_freeze:
                        streak_data["current"] = 0
        except Exception:
            streak_data = {"current": 0, "longest": 0, "multiplier": 1.0}

        # Active cosmetics
        try:
            profile = await self.db.fetchrow(
                "SELECT active_cosmetics FROM user_profiles WHERE user_id = $1", user_id
            )
            raw = profile["active_cosmetics"] if profile else None
            if isinstance(raw, str):
                import json as _cj
                cosmetics = _cj.loads(raw)
            elif isinstance(raw, dict):
                cosmetics = raw
            else:
                cosmetics = {}
        except Exception:
            cosmetics = {}

        # Streak freeze inventory count
        try:
            freeze_count = await self.db.fetchval(
                """
                SELECT COALESCE(ui.quantity, 0) FROM user_inventory ui
                JOIN shop_items si ON si.id = ui.shop_item_id
                WHERE ui.user_id = $1 AND si.item_type = 'streak_freeze'
                LIMIT 1
                """,
                user_id,
            )
        except Exception:
            freeze_count = 0

        # Active XP boost
        active_boost = None
        try:
            now = datetime.utcnow()
            boost_row = await self.db.fetchrow(
                """
                SELECT boost_value->>'multiplier' AS multiplier, expires_at
                FROM active_boosts
                WHERE user_id = $1 AND scope = 'user' AND boost_type = 'xp_multiplier'
                  AND is_active = TRUE AND starts_at <= $2 AND expires_at > $2
                ORDER BY (boost_value->>'multiplier')::numeric DESC
                LIMIT 1
                """,
                user_id, now,
            )
            if boost_row:
                active_boost = {
                    "multiplier": float(boost_row["multiplier"]),
                    "expires_at": boost_row["expires_at"].isoformat() if boost_row["expires_at"] else None,
                }
        except Exception:
            pass

        return {
            "balance": int(balance.get("balance", 0)),
            "total_earned": int(balance.get("total_earned", 0)),
            "total_spent": int(balance.get("total_spent", 0)),
            "points_by_type": points_by_type,
            "streak": streak_data,
            "cosmetics": cosmetics,
            "streak_freeze_count": int(freeze_count) if freeze_count else 0,
            "active_boost": active_boost,
        }

    async def get_points_history(
        self, user_id: str, limit: int = 20, offset: int = 0
    ) -> List[Dict[str, Any]]:
        rows = await self.db.fetch(
            """
            SELECT up.*, pt.name as point_type_name, pt.icon, pt.color
            FROM user_points up
            JOIN point_types pt ON up.point_type_id = pt.id
            WHERE up.user_id = $1
            ORDER BY up.created_at DESC
            LIMIT $2 OFFSET $3
            """,
            user_id, limit, offset,
        )
        return [dict(r) for r in rows]

    async def count_points_history(self, user_id: str) -> int:
        return await self.db.fetchval(
            "SELECT COUNT(*) FROM user_points WHERE user_id = $1", user_id
        )


    async def update_streak(self, user_id: str, streak_type: str = "daily_study") -> Dict[str, Any]:
        """Update the user's streak. Returns streak info and whether points were awarded."""
        today = date.today()

        streak = await self.db.fetchrow(
            "SELECT * FROM user_streaks WHERE user_id = $1 AND streak_type = $2",
            user_id, streak_type,
        )

        if not streak:
            # First ever activity — create streak
            row = await self.db.fetchrow(
                """
                INSERT INTO user_streaks (user_id, streak_type, current_streak, longest_streak,
                    last_activity_date, streak_started_at)
                VALUES ($1, $2, 1, 1, $3, $3)
                RETURNING *
                """,
                user_id, streak_type, today,
            )
            awarded = await self._try_award_streak_points(user_id, streak_type, 1)
            return {"streak": dict(row), "points_awarded": awarded}

        last_date = streak["last_activity_date"]
        if last_date == today:
            # Already recorded today
            return {"streak": dict(streak), "points_awarded": False}

        diff = (today - last_date).days
        if diff == 1:
            # Consecutive day — increment
            new_streak = streak["current_streak"] + 1
            new_longest = max(streak["longest_streak"], new_streak)
            await self.db.execute(
                """
                UPDATE user_streaks
                SET current_streak = $3, longest_streak = $4,
                    last_activity_date = $5, updated_at = NOW()
                WHERE user_id = $1 AND streak_type = $2
                """,
                user_id, streak_type, new_streak, new_longest, today,
            )
            awarded = await self._try_award_streak_points(user_id, streak_type, new_streak)
            return {"streak": {"current_streak": new_streak, "longest_streak": new_longest}, "points_awarded": awarded}
        else:
            # Streak broken — check for streak freeze item
            freeze_item = await self.db.fetchrow(
                """
                SELECT ui.shop_item_id FROM user_inventory ui
                JOIN shop_items si ON si.id = ui.shop_item_id
                WHERE ui.user_id = $1 AND si.item_type = 'streak_freeze' AND ui.quantity > 0
                LIMIT 1
                """,
                user_id,
            )
            if freeze_item:
                # Consume one freeze — preserve streak
                await self.db.execute(
                    "UPDATE user_inventory SET quantity = quantity - 1, updated_at = NOW() WHERE user_id = $1 AND shop_item_id = $2",
                    user_id, freeze_item["shop_item_id"],
                )
                # Update last_activity_date so tomorrow counts as consecutive
                new_streak = streak["current_streak"]
                await self.db.execute(
                    """
                    UPDATE user_streaks
                    SET last_activity_date = $3, updated_at = NOW()
                    WHERE user_id = $1 AND streak_type = $2
                    """,
                    user_id, streak_type, today,
                )
                awarded = await self._try_award_streak_points(user_id, streak_type, new_streak)
                return {"streak": {"current_streak": new_streak, "longest_streak": streak["longest_streak"]}, "points_awarded": awarded, "freeze_used": True}

            # No freeze — reset to 1
            await self.db.execute(
                """
                UPDATE user_streaks
                SET current_streak = 1, last_activity_date = $3,
                    streak_started_at = $3, updated_at = NOW()
                WHERE user_id = $1 AND streak_type = $2
                """,
                user_id, streak_type, today,
            )
            awarded = await self._try_award_streak_points(user_id, streak_type, 1)
            return {"streak": {"current_streak": 1, "longest_streak": streak["longest_streak"]}, "points_awarded": awarded}

    async def _try_award_streak_points(self, user_id: str, streak_type: str, current_streak: int) -> bool:
        """Award points for streak milestones (every day for daily, every week for weekly)."""
        action_type = "daily_study" if streak_type == "daily_study" else "weekly_share"
        rule = await self.get_point_rule(action_type)
        if not rule:
            return False
        if await self.check_daily_limit(user_id, action_type):
            return False
        await self.award_points(
            user_id=user_id,
            action_type=action_type,
            points=rule["points_awarded"],
            point_type_id=str(rule["point_type_id"]),
            rule_id=str(rule["id"]),
            description=f"{'Daily study' if streak_type == 'daily_study' else 'Weekly share'} streak: {current_streak}",
        )
        return True


    async def get_all_badges(self, user_id: str) -> List[Dict[str, Any]]:
        rows = await self.db.fetch(
            """
            SELECT b.*, ub.earned_at, ub.show_on_profile,
                   CASE WHEN ub.id IS NOT NULL THEN TRUE ELSE FALSE END as earned
            FROM badges b
            LEFT JOIN user_badges ub ON b.id = ub.badge_id AND ub.user_id = $1
            WHERE b.is_active = TRUE AND b.is_global = TRUE
            ORDER BY b.rarity DESC, b.name
            """,
            user_id,
        )
        return [dict(r) for r in rows]

    async def get_earned_badges(self, user_id: str) -> List[Dict[str, Any]]:
        rows = await self.db.fetch(
            """
            SELECT b.*, ub.earned_at, ub.show_on_profile
            FROM user_badges ub
            JOIN badges b ON ub.badge_id = b.id
            WHERE ub.user_id = $1
            ORDER BY ub.earned_at DESC
            """,
            user_id,
        )
        return [dict(r) for r in rows]

    async def check_and_award_badges(
        self, user_id: str, community_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Evaluate all badge criteria and award any newly earned badges.

        Called automatically after points are awarded.  Returns the list of
        badges that were *just* earned in this invocation.
        """
        # 1. Collect badge-ids the user already owns (across all communities)
        earned_rows = await self.db.fetch(
            "SELECT badge_id FROM user_badges WHERE user_id = $1", user_id
        )
        earned_set = {str(r["badge_id"]) for r in earned_rows}

        # 2. Fetch all active global badges the user hasn't earned yet
        all_badges = await self.db.fetch(
            "SELECT * FROM badges WHERE is_active = TRUE AND is_global = TRUE"
        )

        newly_awarded: List[Dict[str, Any]] = []

        for badge in all_badges:
            badge_id = str(badge["id"])
            if badge_id in earned_set:
                continue

            criteria = badge["criteria"]
            if not criteria:
                continue
            if isinstance(criteria, str):
                import json as _bj
                criteria = _bj.loads(criteria)

            if not await self._evaluate_badge_criteria(user_id, criteria):
                continue

            # 3. Award the badge
            try:
                await self.db.execute(
                    """
                    INSERT INTO user_badges (user_id, badge_id, community_id, earned_at, show_on_profile)
                    VALUES ($1, $2, $3, NOW(), TRUE)
                    """,
                    user_id, badge["id"], community_id,
                )
            except Exception:
                continue  # duplicate or FK error — skip

            # 4. Grant badge bonus points (without re-triggering badge check)
            if badge.get("points_awarded") and badge["points_awarded"] > 0 and badge.get("point_type_id"):
                try:
                    await self.db.execute(
                        """
                        INSERT INTO user_points (user_id, point_type_id, points, action_type, description)
                        VALUES ($1, $2, $3, 'badge_earned', $4)
                        """,
                        user_id, badge["point_type_id"],
                        badge["points_awarded"], f"Earned badge: {badge['name']}",
                    )
                    await self.db.execute(
                        """
                        INSERT INTO user_currency (user_id, balance, total_earned)
                        VALUES ($1, $2, $2)
                        ON CONFLICT (user_id) DO UPDATE
                        SET balance = user_currency.balance + $2,
                            total_earned = user_currency.total_earned + $2,
                            updated_at = NOW()
                        """,
                        user_id, badge["points_awarded"],
                    )
                except Exception:
                    pass

            # 5. Fire reputation event for badge earned
            try:
                from app.repositories.reputation_repository import ReputationRepository
                rep_repo = ReputationRepository(self.db)
                await rep_repo.add_event(
                    user_id=user_id,
                    event_type="badge_earned",
                    dimension="engagement",
                    points_change=max(1, (badge.get("points_awarded") or 5) // 2),
                    reference_type="badge",
                    reference_id=badge["id"],
                    community_id=community_id,
                )
            except Exception:
                pass

            newly_awarded.append(dict(badge))
            earned_set.add(badge_id)  # prevent double-award within same call

        return newly_awarded

    async def _evaluate_badge_criteria(self, user_id: str, criteria: dict) -> bool:
        """Return True if the user satisfies the badge criteria."""
        try:
            # --- Points-threshold badges ---
            # e.g. {"points_threshold": 1000}
            if "points_threshold" in criteria:
                total = await self.db.fetchval(
                    "SELECT COALESCE(total_earned, 0) FROM user_currency WHERE user_id = $1",
                    user_id,
                )
                return (total or 0) >= criteria["points_threshold"]

            # --- Streak badges ---
            # e.g. {"streak_type":"daily_study","days":7}  or  {"action":"daily_study","streak":7}
            if "streak" in criteria or "days" in criteria:
                streak_type = criteria.get("streak_type") or criteria.get("action", "daily_study")
                required = criteria.get("days") or criteria.get("streak", 0)
                current = await self.db.fetchval(
                    "SELECT COALESCE(current_streak, 0) FROM user_streaks WHERE user_id = $1 AND streak_type = $2",
                    user_id, streak_type,
                )
                return (current or 0) >= required

            # --- Action-count badges ---
            # e.g. {"action":"discussion_post","count":1}
            if "action" in criteria and "count" in criteria:
                count = await self.db.fetchval(
                    "SELECT COUNT(*) FROM user_points WHERE user_id = $1 AND action_type = $2",
                    user_id, criteria["action"],
                )
                return (count or 0) >= criteria["count"]

            return False
        except Exception:
            return False


    async def get_global_leaderboard(self, limit: int = 20) -> List[Dict[str, Any]]:
        rows = await self.db.fetch(
            """
            SELECT uc.user_id, uc.total_earned,
                   u.username, u.display_name,
                   up.active_cosmetics->>'name_color' AS name_color,
                   up.active_cosmetics->>'profile_border' AS profile_border
            FROM user_currency uc
            JOIN users u ON uc.user_id = u.id
            LEFT JOIN user_profiles up ON up.user_id = u.id
            ORDER BY uc.total_earned DESC
            LIMIT $1
            """,
            limit,
        )
        return [dict(r) for r in rows]

    async def get_community_leaderboard(
        self, community_id: str, limit: int = 20
    ) -> List[Dict[str, Any]]:
        rows = await self.db.fetch(
            """
            SELECT cm.user_id, cm.contribution_points,
                   u.username, u.display_name,
                   up.active_cosmetics->>'name_color' AS name_color,
                   up.active_cosmetics->>'profile_border' AS profile_border
            FROM community_members cm
            JOIN users u ON cm.user_id = u.id
            LEFT JOIN user_profiles up ON up.user_id = u.id
            WHERE cm.community_id = $1 AND cm.status = 'active'
            ORDER BY cm.contribution_points DESC
            LIMIT $2
            """,
            community_id, limit,
        )
        return [dict(r) for r in rows]


    async def get_shop_items(self, category: Optional[str] = None, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        if category:
            rows = await self.db.fetch(
                "SELECT * FROM shop_items WHERE is_active = TRUE AND category = $1 ORDER BY display_order",
                category,
            )
        else:
            rows = await self.db.fetch(
                "SELECT * FROM shop_items WHERE is_active = TRUE ORDER BY display_order"
            )
        items = [dict(r) for r in rows]

        # Attach owned quantity if user_id provided
        if user_id:
            inv_rows = await self.db.fetch(
                "SELECT shop_item_id, quantity FROM user_inventory WHERE user_id = $1",
                user_id,
            )
            owned = {str(r["shop_item_id"]): r["quantity"] for r in inv_rows}
            for item in items:
                item["owned_quantity"] = owned.get(str(item["id"]), 0)

        return items

    async def purchase_item(self, user_id: str, item_id: str) -> Dict[str, Any]:
        import json

        item = await self.db.fetchrow(
            "SELECT * FROM shop_items WHERE id = $1 AND is_active = TRUE", item_id
        )
        if not item:
            raise ValueError("Item not found")

        # Check if one-time cosmetic item already owned
        one_time_types = {"profile_border", "name_color", "avatar", "emoji_pack"}
        if item["item_type"] in one_time_types:
            existing = await self.db.fetchval(
                "SELECT quantity FROM user_inventory WHERE user_id = $1 AND shop_item_id = $2",
                user_id, item_id,
            )
            if existing and existing > 0:
                raise ValueError("You already own this item")

        # Check balance
        currency = await self.db.fetchrow(
            "SELECT balance FROM user_currency WHERE user_id = $1", user_id
        )
        balance = currency["balance"] if currency else 0
        if balance < item["price"]:
            raise ValueError("Insufficient balance")

        # Check stock
        if item["is_limited"] and item.get("stock_count") is not None and item["stock_count"] <= 0:
            raise ValueError("Item out of stock")

        # Deduct balance
        await self.db.execute(
            """
            UPDATE user_currency
            SET balance = balance - $2, total_spent = total_spent + $2, updated_at = NOW()
            WHERE user_id = $1
            """,
            user_id, item["price"],
        )

        # Record purchase
        item_snapshot = json.dumps({
            "name": item["name"],
            "price": item["price"],
            "category": item["category"],
            "item_type": item["item_type"],
        })
        purchase = await self.db.fetchrow(
            """
            INSERT INTO user_purchases (user_id, shop_item_id, item_snapshot, price_paid)
            VALUES ($1, $2, $3::jsonb, $4)
            RETURNING *
            """,
            user_id, item_id, item_snapshot, item["price"],
        )

        # Update inventory
        await self.db.execute(
            """
            INSERT INTO user_inventory (user_id, shop_item_id, quantity)
            VALUES ($1, $2, 1)
            ON CONFLICT (user_id, shop_item_id) DO UPDATE
            SET quantity = user_inventory.quantity + 1, updated_at = NOW()
            """,
            user_id, item_id,
        )

        # Record as negative points transaction so it appears in history
        point_type_id = await self.db.fetchval(
            "SELECT id FROM point_types WHERE url_id = 'learning-points'"
        )
        if point_type_id:
            await self.db.execute(
                """
                INSERT INTO user_points (user_id, point_type_id, points, action_type, description)
                VALUES ($1, $2, $3, 'shop_purchase', $4)
                """,
                user_id, point_type_id, -item["price"],
                f"Purchased {item['name']}",
            )

        # Reduce stock if limited
        if item["is_limited"]:
            await self.db.execute(
                "UPDATE shop_items SET stock_count = stock_count - 1 WHERE id = $1",
                item_id,
            )

        # Auto-equip cosmetic items
        cosmetic_key = None
        cosmetic_value = None
        item_val = item.get("item_value") or {}
        if isinstance(item_val, str):
            import json as _json
            item_val = _json.loads(item_val)

        if item["item_type"] == "name_color" and item_val.get("color"):
            cosmetic_key = "name_color"
            cosmetic_value = item_val["color"]
        elif item["item_type"] == "profile_border" and item_val.get("asset"):
            cosmetic_key = "profile_border"
            cosmetic_value = item_val["asset"]

        if cosmetic_key:
            await self.db.execute(
                """
                UPDATE user_profiles
                SET active_cosmetics = jsonb_set(
                    COALESCE(active_cosmetics, '{}'::jsonb),
                    $2::text[], to_jsonb($3::text)
                ),
                updated_at = NOW()
                WHERE user_id = $1
                """,
                user_id, [cosmetic_key], cosmetic_value,
            )

        # Activate boost items (xp_boost, community_boost)
        if item["item_type"] == "xp_boost":
            duration_hours = item_val.get("duration_hours", 24)
            multiplier = item_val.get("multiplier", 2)
            import json as _j
            await self.db.execute(
                """
                INSERT INTO active_boosts
                    (activated_by, scope, user_id, boost_type, boost_value, source_id, coins_spent, expires_at)
                VALUES ($1, 'user', $1, 'xp_multiplier', $2::jsonb, $3, $4, NOW() + $5 * INTERVAL '1 hour')
                """,
                user_id, _j.dumps({"multiplier": multiplier}), item_id, item["price"],
                duration_hours,
            )
        elif item["item_type"] == "community_boost":
            duration_hours = item_val.get("duration_hours", 24)
            multiplier = item_val.get("multiplier", 1.5)
            import json as _j
            # Find user's communities and apply to the first one (or could let user choose)
            comm_id = await self.db.fetchval(
                "SELECT community_id FROM community_members WHERE user_id = $1 AND status = 'active' LIMIT 1",
                user_id,
            )
            if comm_id:
                member_count = await self.db.fetchval(
                    "SELECT COUNT(*) FROM community_members WHERE community_id = $1 AND status = 'active'",
                    comm_id,
                )
                await self.db.execute(
                    """
                    INSERT INTO active_boosts
                        (activated_by, scope, community_id, boost_type, boost_value, source_id, coins_spent, expires_at, beneficiaries_count)
                    VALUES ($1, 'community', $2, 'xp_multiplier', $3::jsonb, $4, $5, NOW() + $6 * INTERVAL '1 hour', $7)
                    """,
                    user_id, comm_id, _j.dumps({"multiplier": multiplier}), item_id, item["price"],
                    duration_hours, member_count,
                )

        return dict(purchase)


    async def check_and_consume(self, user_id: str, item_type: str) -> bool:
        """Check if user owns an item of this type and consume one. Returns True if consumed."""
        row = await self.db.fetchrow(
            """
            SELECT ui.shop_item_id, ui.quantity FROM user_inventory ui
            JOIN shop_items si ON si.id = ui.shop_item_id
            WHERE ui.user_id = $1 AND si.item_type = $2 AND ui.quantity > 0
            LIMIT 1
            """,
            user_id, item_type,
        )
        if not row:
            return False
        await self.db.execute(
            "UPDATE user_inventory SET quantity = quantity - 1, updated_at = NOW() WHERE user_id = $1 AND shop_item_id = $2",
            user_id, row["shop_item_id"],
        )
        # Mark purchase as used
        await self.db.execute(
            """
            UPDATE user_purchases SET status = 'used', used_at = NOW()
            WHERE id = (
                SELECT id FROM user_purchases
                WHERE user_id = $1 AND shop_item_id = $2 AND status = 'completed'
                ORDER BY created_at DESC LIMIT 1
            )
            """,
            user_id, row["shop_item_id"],
        )
        return True

    async def has_item(self, user_id: str, item_type: str) -> bool:
        """Check if user owns at least one of this item type (without consuming)."""
        val = await self.db.fetchval(
            """
            SELECT 1 FROM user_inventory ui
            JOIN shop_items si ON si.id = ui.shop_item_id
            WHERE ui.user_id = $1 AND si.item_type = $2 AND ui.quantity > 0
            LIMIT 1
            """,
            user_id, item_type,
        )
        return val is not None


    async def send_appreciation(
        self, from_user_id: str, to_user_id: str, coins: int,
        appreciation_type: str = "general", message: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Transfer coins from one user to another as appreciation."""
        # Check balance
        balance = await self.db.fetchval(
            "SELECT balance FROM user_currency WHERE user_id = $1", from_user_id
        )
        if not balance or balance < coins:
            raise ValueError("Insufficient balance")

        # Deduct from sender
        await self.db.execute(
            "UPDATE user_currency SET balance = balance - $2, total_spent = total_spent + $2, updated_at = NOW() WHERE user_id = $1",
            from_user_id, coins,
        )
        # Credit to receiver
        await self.db.execute(
            """
            INSERT INTO user_currency (user_id, balance, total_earned)
            VALUES ($1, $2, $2)
            ON CONFLICT (user_id) DO UPDATE
            SET balance = user_currency.balance + $2,
                total_earned = user_currency.total_earned + $2,
                updated_at = NOW()
            """,
            to_user_id, coins,
        )
        # Record in appreciations table
        row = await self.db.fetchrow(
            """
            INSERT INTO appreciations (from_user_id, to_user_id, appreciation_type, coins_given, message)
            VALUES ($1, $2, $3, $4, $5) RETURNING *
            """,
            from_user_id, to_user_id, appreciation_type, coins, message,
        )
        return dict(row)


    async def gift_item(self, from_user_id: str, to_user_id: str, item_id: str, message: Optional[str] = None) -> Dict[str, Any]:
        """Gift a shop item to another user. Purchases and transfers."""
        import json

        item = await self.db.fetchrow(
            "SELECT * FROM shop_items WHERE id = $1 AND is_active = TRUE", item_id
        )
        if not item:
            raise ValueError("Item not found")
        if not item.get("is_giftable"):
            raise ValueError("This item cannot be gifted")

        # Check balance
        balance = await self.db.fetchval(
            "SELECT balance FROM user_currency WHERE user_id = $1", from_user_id
        )
        if not balance or balance < item["price"]:
            raise ValueError("Insufficient balance")

        # Deduct from sender
        await self.db.execute(
            "UPDATE user_currency SET balance = balance - $2, total_spent = total_spent + $2, updated_at = NOW() WHERE user_id = $1",
            from_user_id, item["price"],
        )
        # Record purchase as gift
        purchase = await self.db.fetchrow(
            """
            INSERT INTO user_purchases (user_id, shop_item_id, item_snapshot, price_paid, is_gift, gifted_to, gift_message)
            VALUES ($1, $2, $3::jsonb, $4, TRUE, $5, $6) RETURNING *
            """,
            from_user_id, item_id,
            json.dumps({"name": item["name"], "price": item["price"], "category": item["category"], "item_type": item["item_type"]}),
            item["price"], to_user_id, message,
        )
        # Add to receiver's inventory
        await self.db.execute(
            """
            INSERT INTO user_inventory (user_id, shop_item_id, quantity)
            VALUES ($1, $2, 1)
            ON CONFLICT (user_id, shop_item_id) DO UPDATE
            SET quantity = user_inventory.quantity + 1, updated_at = NOW()
            """,
            to_user_id, item_id,
        )
        # Record negative points for sender
        point_type_id = await self.db.fetchval("SELECT id FROM point_types WHERE url_id = 'learning-points'")
        if point_type_id:
            await self.db.execute(
                "INSERT INTO user_points (user_id, point_type_id, points, action_type, description) VALUES ($1, $2, $3, 'shop_purchase', $4)",
                from_user_id, point_type_id, -item["price"], f"Gifted {item['name']} to a friend",
            )
        return dict(purchase)


    async def equip_cosmetic(self, user_id: str, cosmetic_type: str, value: Optional[str]) -> Dict[str, Any]:
        """Equip or unequip a cosmetic item. value=None to unequip."""
        import json as _json

        # Map cosmetic_type to item_type and the item_value key that holds the asset identifier
        type_map = {
            "profile_border": ("profile_border", "asset"),
            "name_color": ("name_color", "color"),
        }
        if cosmetic_type not in type_map:
            raise ValueError("Invalid cosmetic type")

        item_type, val_key = type_map[cosmetic_type]

        if value:
            # Verify user owns an item with this asset value
            owned = await self.db.fetchval(
                """
                SELECT 1 FROM user_inventory ui
                JOIN shop_items si ON si.id = ui.shop_item_id
                WHERE ui.user_id = $1 AND si.item_type = $2
                  AND ui.quantity > 0
                  AND si.item_value->>$3 = $4
                LIMIT 1
                """,
                user_id, item_type, val_key, value,
            )
            if not owned:
                raise ValueError("You don't own this cosmetic")

        # Update active_cosmetics
        if value:
            await self.db.execute(
                """
                UPDATE user_profiles
                SET active_cosmetics = jsonb_set(
                    COALESCE(active_cosmetics, '{}'::jsonb),
                    $2::text[], to_jsonb($3::text)
                ),
                updated_at = NOW()
                WHERE user_id = $1
                """,
                user_id, [cosmetic_type], value,
            )
        else:
            # Unequip: remove the key
            await self.db.execute(
                """
                UPDATE user_profiles
                SET active_cosmetics = active_cosmetics - $2,
                updated_at = NOW()
                WHERE user_id = $1
                """,
                user_id, cosmetic_type,
            )

        # Return updated cosmetics
        raw = await self.db.fetchval(
            "SELECT active_cosmetics FROM user_profiles WHERE user_id = $1", user_id
        )
        if isinstance(raw, str):
            cosmetics = _json.loads(raw)
        elif isinstance(raw, dict):
            cosmetics = raw
        else:
            cosmetics = {}
        return {"cosmetics": cosmetics, "message": f"{'Equipped' if value else 'Unequipped'} {cosmetic_type}"}
