import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine


@pytest.fixture
def client():
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)


def test_ip_lifecycle_and_scan(client):
    # 1. Create Subnet
    sub_res = client.post(
        "/api/subnets",
        json={
            "name": "Scan LAN",
            "cidr": "192.168.1.0/24",
            "gateway": "192.168.1.1",
        },
    )
    assert sub_res.status_code == 201
    subnet_id = sub_res.json()["id"]

    # 2. Trigger Scan (mock mode)
    scan_res = client.post(f"/api/subnets/{subnet_id}/scan")
    assert scan_res.status_code == 200
    scan_data = scan_res.json()
    assert scan_data["total_online"] > 0
    assert "duration_ms" in scan_data

    # 3. Retrieve IPs
    ips_res = client.get(f"/api/subnets/{subnet_id}/ips")
    assert ips_res.status_code == 200
    ips = ips_res.json()
    assert len(ips) == 254

    # Verify IP addresses are properly sorted numerically
    assert ips[0]["ip_address"] == "192.168.1.1"
    assert ips[253]["ip_address"] == "192.168.1.254"

    # Find an online rogue device
    rogue = next(
        (ip for ip in ips if ip["reconciliation_status"] == "ROGUE_DEVICE"),
        None,
    )
    assert rogue is not None

    # 4. Trust MAC shortcut
    trust_res = client.post(f"/api/ips/{rogue['id']}/trust-mac")
    assert trust_res.status_code == 200
    updated_rogue = trust_res.json()
    assert updated_rogue["admin_status"] == "assigned"
    assert updated_rogue["expected_mac"] == updated_rogue["detected_mac"]
    assert updated_rogue["reconciliation_status"] == "VALID_ONLINE"

    # 5. Intentional MAC mismatch
    edit_res = client.put(
        f"/api/ips/{rogue['id']}",
        json={
            "admin_status": "assigned",
            "expected_mac": "11:22:33:44:55:66",
            "hostname": "Renamed Node",
        },
    )
    assert edit_res.status_code == 200
    assert edit_res.json()["reconciliation_status"] == "MAC_MISMATCH"
    assert edit_res.json()["hostname"] == "Renamed Node"


def test_trust_mac_without_detected_mac_fails(client):
    sub_res = client.post(
        "/api/subnets", json={"name": "Test LAN", "cidr": "192.168.2.0/24"}
    )
    assert sub_res.status_code == 201
    subnet_id = sub_res.json()["id"]
    ips = client.get(f"/api/subnets/{subnet_id}/ips").json()
    # Offline IP with no detected MAC
    target = ips[10]
    res = client.post(f"/api/ips/{target['id']}/trust-mac")
    assert res.status_code == 400
    assert "Cannot trust MAC" in res.json()["detail"]


def test_get_ips_filtered_by_status(client):
    sub_res = client.post(
        "/api/subnets",
        json={"name": "Filter LAN", "cidr": "192.168.3.0/24", "gateway": "192.168.3.1"},
    )
    assert sub_res.status_code == 201
    subnet_id = sub_res.json()["id"]

    # Before scan: 1 RESERVED (gateway), 253 FREE
    reserved_res = client.get(f"/api/subnets/{subnet_id}/ips?status=RESERVED")
    assert reserved_res.status_code == 200
    assert len(reserved_res.json()) == 1
    assert reserved_res.json()[0]["ip_address"] == "192.168.3.1"

    free_res = client.get(f"/api/subnets/{subnet_id}/ips?status=FREE")
    assert free_res.status_code == 200
    assert len(free_res.json()) == 253


def test_put_ip_invalid_mac_returns_422(client):
    sub_res = client.post(
        "/api/subnets", json={"name": "Val LAN", "cidr": "192.168.4.0/24"}
    )
    subnet_id = sub_res.json()["id"]
    ips = client.get(f"/api/subnets/{subnet_id}/ips").json()
    target_id = ips[0]["id"]

    res = client.put(
        f"/api/ips/{target_id}",
        json={"expected_mac": "invalid-mac-address"},
    )
    assert res.status_code == 422


def test_put_ip_normalizes_mac(client):
    sub_res = client.post(
        "/api/subnets", json={"name": "Norm LAN", "cidr": "192.168.5.0/24"}
    )
    subnet_id = sub_res.json()["id"]
    ips = client.get(f"/api/subnets/{subnet_id}/ips").json()
    target_id = ips[0]["id"]

    res = client.put(
        f"/api/ips/{target_id}",
        json={"expected_mac": "aa-bb-cc-dd-ee-ff", "admin_status": "assigned"},
    )
    assert res.status_code == 200
    assert res.json()["expected_mac"] == "AA:BB:CC:DD:EE:FF"


def test_ip_not_found_404(client):
    res_put = client.put("/api/ips/99999", json={"hostname": "ghost"})
    assert res_put.status_code == 404

    res_trust = client.post("/api/ips/99999/trust-mac")
    assert res_trust.status_code == 404

    res_ips = client.get("/api/subnets/99999/ips")
    assert res_ips.status_code == 404

    res_scan = client.post("/api/subnets/99999/scan")
    assert res_scan.status_code == 404


def test_concurrent_scan_rejected(client):
    import time
    from unittest.mock import patch
    import threading

    sub_res = client.post(
        "/api/subnets", json={"name": "Lock LAN", "cidr": "192.168.6.0/24"}
    )
    subnet_id = sub_res.json()["id"]

    def slow_scan(*args, **kwargs):
        time.sleep(0.3)
        return []

    statuses = []

    def run_scan():
        res = client.post(f"/api/subnets/{subnet_id}/scan")
        statuses.append(res.status_code)

    with patch("app.routers.subnets.perform_arp_scan", side_effect=slow_scan):
        t1 = threading.Thread(target=run_scan)
        t2 = threading.Thread(target=run_scan)
        t1.start()
        time.sleep(0.05)
        t2.start()
        t1.join()
        t2.join()

    assert 200 in statuses
    assert 409 in statuses

