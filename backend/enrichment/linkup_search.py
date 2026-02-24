"""LinkUp SDK client — per-request factory using BYOK contextvars."""

from backend.api_keys import make_linkup_client as _get_client

__all__ = ["_get_client"]
