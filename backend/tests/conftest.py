import os

os.environ["DATABASE_URL"] = "sqlite:///./test_ghosttrace.db"
os.environ["ENABLE_SCHEDULER"] = "false"
os.environ["SECRET_KEY"] = "test-secret-key-that-is-long-enough-123"

import pytest
from fastapi.testclient import TestClient

from app.db import Base, engine
from app.main import app


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def auth_client(client):
    r = client.post("/api/auth/register", json={"email": "dev@example.com", "password": "supersecret1", "full_name": "Dev"})  # ghosttrace:ignore
    assert r.status_code == 201, r.text
    client.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    return client
