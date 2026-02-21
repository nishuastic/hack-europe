"""LinkUp SDK client — lazy singleton used by search_executor agent."""

from linkup import LinkupClient

from backend.config import settings

_client: LinkupClient | None = None


def _get_client() -> LinkupClient:
    """Lazy-initialize and return the LinkUp client singleton."""
    global _client
    if _client is None:
        _client = LinkupClient(api_key=settings.linkup_api_key)
    return _client
