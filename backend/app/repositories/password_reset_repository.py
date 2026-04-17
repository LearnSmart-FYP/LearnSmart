"""
Password Reset OTP Repository
Handles database operations for password reset OTPs
"""
import logging
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional
from asyncpg import Connection

logger = logging.getLogger(__name__)


class PasswordResetRepository:
    """Repository for managing password reset OTPs"""

    def __init__(self, db: Connection):
        self.db = db

    @staticmethod
    def generate_otp() -> str:
        """Generate a random 6-digit OTP"""
        return ''.join([str(secrets.randbelow(10)) for _ in range(6)])

    @staticmethod
    def hash_otp(otp: str) -> str:
        """Hash OTP for secure storage"""
        return hashlib.sha256(otp.encode()).hexdigest()

    async def create(
        self,
        user_id: str,
        email: str,
        otp_code: str,
        ip_address: Optional[str] = None
    ) -> dict:
        """
        Create a new password reset OTP record

        Args:
            user_id: User's UUID
            email: User's email address
            otp_code: Plain text OTP code (will be hashed)
            ip_address: Optional IP address of requester

        Returns:
            Created OTP record
        """
        otp_hash = self.hash_otp(otp_code)
        expires_at = datetime.utcnow() + timedelta(minutes=15)

        query = """
            INSERT INTO password_reset_otps (
                user_id, email, otp_code, otp_hash, expires_at, ip_address
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, user_id, email, expires_at, created_at
        """

        result = await self.db.fetchrow(
            query,
            user_id,
            email,
            otp_code,
            otp_hash,
            expires_at,
            ip_address
        )

        return dict(result)

    async def verify_otp(self, email: str, otp_code: str) -> Optional[dict]:
        """
        Verify OTP is valid and not expired

        Args:
            email: User's email address
            otp_code: Plain text OTP code to verify

        Returns:
            OTP record if valid, None otherwise
        """
        otp_hash = self.hash_otp(otp_code)

        query = """
            SELECT id, user_id, email, expires_at, used_at
            FROM password_reset_otps
            WHERE email = $1
              AND otp_hash = $2
              AND expires_at > NOW()
              AND used_at IS NULL
            ORDER BY created_at DESC
            LIMIT 1
        """

        result = await self.db.fetchrow(query, email, otp_hash)

        if result:
            return dict(result)
        return None

    async def mark_as_used(self, otp_id: str) -> None:
        """
        Mark OTP as used to prevent reuse

        Args:
            otp_id: OTP record UUID
        """
        query = """
            UPDATE password_reset_otps
            SET used_at = NOW()
            WHERE id = $1
        """
        await self.db.execute(query, otp_id)

    async def count_recent_requests(self, email: str, hours: int = 1) -> int:
        """
        Count password reset requests in the last N hours

        Args:
            email: User's email address
            hours: Number of hours to look back

        Returns:
            Number of requests
        """
        query = """
            SELECT COUNT(*)
            FROM password_reset_otps
            WHERE email = $1
              AND created_at > NOW() - INTERVAL '%s hours'
        """ % hours

        result = await self.db.fetchval(query, email)
        return result or 0

