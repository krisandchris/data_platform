"""Authentication and user-context utilities."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
import os
import secrets

from fastapi import Request
from pwdlib import PasswordHash

from urban_violation_backend.api_schemas import CurrentUserResponse
from urban_violation_backend.errors import unauthorized
from urban_violation_backend.permissions import ROLE_PERMISSIONS
from urban_violation_backend.schemas import (
    AuthSession,
    RoleBinding,
    RoleScopeType,
    UserAccount,
    UserRole,
    UserStatus,
)
from urban_violation_backend.state_store import PlatformStateStore


_PASSWORD_HASHER = PasswordHash.recommended()


@dataclass(slots=True)
class AuthSettings:
    """Runtime auth settings."""

    auth_mode: str
    allow_anonymous_dev: bool
    session_ttl_minutes: int


@dataclass(slots=True)
class AuthContext:
    """Resolved request user context."""

    auth_mode: str
    user: UserAccount
    roles: list[RoleBinding]

    @property
    def user_id(self) -> str:
        return self.user.user_id

    def to_current_user_response(self) -> CurrentUserResponse:
        permissions = sorted(
            {
                permission
                for role_binding in self.roles
                for permission in ROLE_PERMISSIONS.get(role_binding.role, set())
            }
        )
        return CurrentUserResponse(
            auth_mode=self.auth_mode,
            user_id=self.user.user_id,
            display_name=self.user.display_name,
            email=self.user.email,
            status=self.user.status,
            roles=self.roles,
            permissions=permissions,
        )


class AuthService:
    """Internal account/session management."""

    def __init__(self, store: PlatformStateStore, settings: AuthSettings) -> None:
        self.store = store
        self.settings = settings

    @staticmethod
    def default_settings() -> AuthSettings:
        mode = os.environ.get("PLATFORM_AUTH_MODE", "dev_header").strip() or "dev_header"
        allow_anonymous = os.environ.get("PLATFORM_DEV_ANON", "1").strip() != "0"
        ttl = int(os.environ.get("PLATFORM_SESSION_TTL_MINUTES", "720"))
        return AuthSettings(
            auth_mode=mode,
            allow_anonymous_dev=allow_anonymous,
            session_ttl_minutes=max(5, ttl),
        )

    @staticmethod
    def hash_password(password: str) -> str:
        return _PASSWORD_HASHER.hash(password)

    @staticmethod
    def verify_password(password: str, password_hash: str) -> bool:
        return _PASSWORD_HASHER.verify(password, password_hash)

    def ensure_bootstrap_admin(self) -> None:
        users = self.store.list_users()
        if users:
            return

        now = self.store.now()
        admin_user = UserAccount(
            user_id=os.environ.get("PLATFORM_INIT_ADMIN_ID", "platform_admin"),
            display_name=os.environ.get("PLATFORM_INIT_ADMIN_NAME", "Platform Admin"),
            email=os.environ.get("PLATFORM_INIT_ADMIN_EMAIL", "admin@example.local"),
            password_hash=self.hash_password(
                os.environ.get("PLATFORM_INIT_ADMIN_PASSWORD", "admin123456")
            ),
            status=UserStatus.ACTIVE,
            created_at=now,
            updated_at=now,
            last_seen_at=now,
        )
        self.store.save_users([admin_user])

        binding = RoleBinding(
            binding_id=self.store.new_id("rb"),
            user_id=admin_user.user_id,
            role=UserRole.PLATFORM_ADMIN,
            scope_type=RoleScopeType.PLATFORM,
            scope_id="*",
            created_by=admin_user.user_id,
            created_at=now,
        )
        self.store.save_role_bindings([binding])

    def list_users(self) -> list[UserAccount]:
        return self.store.list_users()

    def get_user(self, user_id: str) -> UserAccount | None:
        for user in self.store.list_users():
            if user.user_id == user_id:
                return user
        return None

    def save_user(self, account: UserAccount) -> None:
        users = self.store.list_users()
        replaced = False
        for index, existing in enumerate(users):
            if existing.user_id == account.user_id:
                users[index] = account
                replaced = True
                break
        if not replaced:
            users.append(account)
        self.store.save_users(users)

    def create_session(self, user: UserAccount) -> AuthSession:
        now = self.store.now()
        session = AuthSession(
            session_id=self.store.new_id("sess"),
            user_id=user.user_id,
            token=secrets.token_urlsafe(32),
            auth_mode="session",
            created_at=now,
            expires_at=now + timedelta(minutes=self.settings.session_ttl_minutes),
            revoked_at=None,
        )
        sessions = self.store.list_sessions()
        sessions.append(session)
        self.store.save_sessions(sessions)

        updated_user = user.model_copy(update={"last_seen_at": now, "updated_at": now})
        self.save_user(updated_user)
        return session

    def revoke_session(self, token: str) -> bool:
        sessions = self.store.list_sessions()
        revoked = False
        now = self.store.now()
        updated: list[AuthSession] = []
        for session in sessions:
            if session.token == token and session.revoked_at is None:
                revoked = True
                updated.append(session.model_copy(update={"revoked_at": now}))
            else:
                updated.append(session)
        if revoked:
            self.store.save_sessions(updated)
        return revoked

    def resolve_session(self, token: str) -> AuthSession | None:
        now = self.store.now()
        sessions = self.store.list_sessions()
        valid: AuthSession | None = None
        touched = False
        updated_sessions: list[AuthSession] = []
        for session in sessions:
            if session.revoked_at is not None or session.expires_at <= now:
                if session.revoked_at is None and session.expires_at <= now:
                    touched = True
                    updated_sessions.append(session.model_copy(update={"revoked_at": now}))
                else:
                    updated_sessions.append(session)
                continue
            updated_sessions.append(session)
            if session.token == token:
                valid = session
        if touched:
            self.store.save_sessions(updated_sessions)
        return valid

    def _roles_for_user(self, user_id: str) -> list[RoleBinding]:
        return [binding for binding in self.store.list_role_bindings() if binding.user_id == user_id]

    def resolve_context(self, request: Request) -> AuthContext:
        token_header = request.headers.get("X-Session-Token")
        auth_header = request.headers.get("Authorization")
        token: str | None = token_header
        if token is None and auth_header and auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1].strip()

        if token:
            session = self.resolve_session(token)
            if session is None:
                raise unauthorized(message="Session is invalid or expired.")
            user = self.get_user(session.user_id)
            if user is None:
                raise unauthorized(message="Session user no longer exists.")
            if user.status != UserStatus.ACTIVE:
                raise unauthorized(message="User account is disabled.")
            return AuthContext(auth_mode="session", user=user, roles=self._roles_for_user(user.user_id))

        if self.settings.auth_mode != "dev_header":
            raise unauthorized()

        header_user_id = request.headers.get("X-User-Id")
        header_role = request.headers.get("X-User-Role")
        if header_user_id:
            user = self.get_user(header_user_id)
            now = self.store.now()
            if user is None:
                user = UserAccount(
                    user_id=header_user_id,
                    display_name=header_user_id,
                    email=f"{header_user_id}@dev.local",
                    password_hash=self.hash_password("dev-only-placeholder"),
                    status=UserStatus.ACTIVE,
                    created_at=now,
                    updated_at=now,
                    last_seen_at=now,
                )
                self.save_user(user)

            roles = self._roles_for_user(user.user_id)
            if not roles and header_role:
                try:
                    parsed_role = UserRole(header_role)
                except ValueError:
                    parsed_role = UserRole.ANNOTATOR
                binding = RoleBinding(
                    binding_id=self.store.new_id("rb"),
                    user_id=user.user_id,
                    role=parsed_role,
                    scope_type=RoleScopeType.PLATFORM,
                    scope_id="*",
                    created_by="dev_header",
                    created_at=now,
                )
                role_bindings = self.store.list_role_bindings()
                role_bindings.append(binding)
                self.store.save_role_bindings(role_bindings)
                roles = [binding]
            return AuthContext(auth_mode="dev_header", user=user, roles=roles)

        if self.settings.allow_anonymous_dev:
            users = self.store.list_users()
            if not users:
                raise unauthorized()
            fallback = users[0]
            if fallback.status != UserStatus.ACTIVE:
                raise unauthorized(message="Default dev user is disabled.")
            return AuthContext(
                auth_mode="dev_header",
                user=fallback,
                roles=self._roles_for_user(fallback.user_id),
            )

        raise unauthorized()
