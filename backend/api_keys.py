"""Per-request API key threading via contextvars (BYOK demo mode).

Usage:
    1. Call ``set_user_keys(anthropic_key, linkup_key)`` at the start of a
       request (or before spawning a background task).
    2. Use ``make_claude_client()`` / ``make_linkup_client()`` in place of the
       old singleton factories — they read the current contextvar value.
    3. Wrap ``asyncio.create_task`` with ``create_task_with_context`` so that
       background tasks inherit the caller's API keys.
"""

from __future__ import annotations

import asyncio
import contextvars
from typing import Any, Coroutine

import anthropic
from linkup import LinkupClient

# ── Context variables ────────────────────────────────────────────────────

_anthropic_key: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "_anthropic_key", default=None
)
_linkup_key: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "_linkup_key", default=None
)


def set_user_keys(anthropic_api_key: str | None, linkup_api_key: str | None) -> None:
    """Store the current user's API keys in context for the running coroutine."""
    _anthropic_key.set(anthropic_api_key)
    _linkup_key.set(linkup_api_key)


# ── Client factories ─────────────────────────────────────────────────────


class MissingApiKeyError(Exception):
    """Raised when an API key is required but not set."""

    def __init__(self, provider: str) -> None:
        super().__init__(
            f"Please add your {provider} API key in Settings → API Keys before using this feature."
        )
        self.provider = provider


def make_claude_client() -> anthropic.AsyncAnthropic:
    """Return an AsyncAnthropic client using the current user's key."""
    key = _anthropic_key.get()
    if not key:
        raise MissingApiKeyError("Anthropic")
    return anthropic.AsyncAnthropic(api_key=key)


def make_linkup_client() -> LinkupClient:
    """Return a LinkupClient using the current user's key."""
    key = _linkup_key.get()
    if not key:
        raise MissingApiKeyError("LinkUp")
    return LinkupClient(api_key=key)


# ── Background task helper ───────────────────────────────────────────────


def create_task_with_context(coro: Coroutine[Any, Any, Any]) -> asyncio.Task[Any]:
    """Like ``asyncio.create_task`` but copies the current context so that
    contextvars (including user API keys) propagate into the new task."""
    ctx = contextvars.copy_context()
    return asyncio.create_task(ctx.run(_wrap, coro))


async def _wrap(coro: Coroutine[Any, Any, Any]) -> Any:
    """Thin async wrapper so ``ctx.run`` can schedule the coroutine."""
    return await coro
