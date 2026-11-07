import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, get_db
from sqlalchemy.orm import sessionmaker


@pytest.fixture
def client():
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)


def test_create_and_get_subnet(client):
    res = client.post(
        "/api/subnets",
        json={
            "name": "Office LAN",
            "cidr": "192.168.50.0/24",
            "gateway": "192.168.50.1",
            "vlan_id": 50,
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Office LAN"
    assert data["cidr"] == "192.168.50.0/24"
    assert data["total_ips"] == 254

    list_res = client.get("/api/subnets")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1
    summary = list_res.json()[0]
    assert summary["name"] == "Office LAN"
    assert summary["total_ips"] == 254
    assert "assigned_count" in summary
    assert "online_count" in summary
    assert "rogue_count" in summary
    assert "mismatch_count" in summary


def test_get_single_subnet(client):
    res = client.post(
        "/api/subnets",
        json={
            "name": "Server LAN",
            "cidr": "192.168.60.0/24",
            "gateway": "192.168.60.1",
        },
    )
    assert res.status_code == 201
    subnet_id = res.json()["id"]

    get_res = client.get(f"/api/subnets/{subnet_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Server LAN"
    assert get_res.json()["total_ips"] == 254

    not_found_res = client.get("/api/subnets/999999")
    assert not_found_res.status_code == 404


def test_delete_subnet(client):
    res = client.post(
        "/api/subnets",
        json={
            "name": "To Delete LAN",
            "cidr": "192.168.70.0/24",
            "gateway": "192.168.70.1",
        },
    )
    assert res.status_code == 201
    subnet_id = res.json()["id"]

    del_res = client.delete(f"/api/subnets/{subnet_id}")
    assert del_res.status_code == 204

    # Verify 404 after deletion
    get_res = client.get(f"/api/subnets/{subnet_id}")
    assert get_res.status_code == 404

    # Delete non-existent subnet returns 404
    del_non_existent = client.delete(f"/api/subnets/{subnet_id}")
    assert del_non_existent.status_code == 404


def test_create_invalid_cidr_rejected(client):
    res = client.post(
        "/api/subnets",
        json={"name": "Invalid Subnet", "cidr": "192.168.0.0/16"},
    )
    assert res.status_code in [400, 422]


def test_create_malformed_cidr_rejected(client):
    res = client.post(
        "/api/subnets",
        json={"name": "Malformed Subnet", "cidr": "not-a-cidr"},
    )
    assert res.status_code in [400, 422]


def test_create_duplicate_cidr_rejected(client):
    res1 = client.post(
        "/api/subnets",
        json={"name": "Subnet 1", "cidr": "192.168.80.0/24"},
    )
    assert res1.status_code == 201

    res2 = client.post(
        "/api/subnets",
        json={"name": "Subnet 2", "cidr": "192.168.80.0/24"},
    )
    assert res2.status_code == 400


def test_gateway_outside_subnet_rejected(client):
    res = client.post(
        "/api/subnets",
        json={
            "name": "Bad Gateway",
            "cidr": "192.168.10.0/24",
            "gateway": "10.0.0.1",
        },
    )
    assert res.status_code == 400
