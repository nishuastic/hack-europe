"""Shared test fixtures — in-memory SQLite + test client."""

import asyncio
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel

import backend.models  # noqa: F401
from backend.db import get_session
from backend.main import app

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DB_URL, echo=False)
TestSession = sessionmaker(  # type: ignore[call-overload]
    engine, class_=AsyncSession, expire_on_commit=False,
)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    """Create tables before each test, drop after."""
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)


async def _override_session() -> AsyncGenerator[AsyncSession, None]:
    async with TestSession() as session:
        yield session


app.dependency_overrides[get_session] = _override_session


@pytest_asyncio.fixture
async def client():
    """Async HTTP client with auto-registered user + auth token + 100 free credits."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/auth/register", json={
            "email": "test@example.com", "password": "testpass123", "name": "Test User",
        })
        token = resp.json()["access_token"]
        ac.headers["Authorization"] = f"Bearer {token}"
        yield ac


# Keep authed_client as alias for backwards compat
@pytest_asyncio.fixture
async def authed_client(client: AsyncClient):
    """Alias for client — already authenticated."""
    yield client
