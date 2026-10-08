def test_register_login_me(client):
    r = client.post("/api/auth/register", json={"email": "A@Example.com", "password": "password123"})
    assert r.status_code == 201
    assert r.json()["user"]["email"] == "a@example.com"

    assert client.post("/api/auth/register", json={"email": "a@example.com", "password": "password123"}).status_code == 409
    assert client.post("/api/auth/login", json={"email": "a@example.com", "password": "wrong-pass"}).status_code == 401

    token = client.post("/api/auth/login", json={"email": "a@example.com", "password": "password123"}).json()["access_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200 and me.json()["email"] == "a@example.com"


def test_me_requires_auth(client):
    assert client.get("/api/auth/me").status_code == 401
