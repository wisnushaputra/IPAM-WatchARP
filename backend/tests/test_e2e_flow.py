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


def test_full_user_story_flow(client):
    """E2E flow verifying the Definition of Done user stories:

    1. Create a /24 subnet (192.168.100.0/24 with gateway 192.168.100.1)
    2. Trigger ARP scan (POST /api/subnets/{id}/scan)
    3. Verify active hosts detected, vendor resolved, and rogue devices flagged
    4. Call quick trust MAC (POST /api/ips/{id}/trust-mac) -> status transitions to VALID_ONLINE
    5. Update expected MAC to an intentional conflict (11:22:33:44:55:66) -> status transitions to MAC_MISMATCH
    """
    # 1. Create Subnet
    res = client.post(
        "/api/subnets",
        json={
            "name": "Production LAN",
            "cidr": "192.168.100.0/24",
            "gateway": "192.168.100.1",
            "vlan_id": 100,
        },
    )
    assert res.status_code == 201
    subnet = res.json()
    assert subnet["name"] == "Production LAN"
    assert subnet["cidr"] == "192.168.100.0/24"
    assert subnet["total_ips"] == 254
    subnet_id = subnet["id"]

    # 2. Trigger ARP Scan
    scan_res = client.post(f"/api/subnets/{subnet_id}/scan")
    assert scan_res.status_code == 200
    scan_data = scan_res.json()
    assert scan_data["total_online"] > 0
    assert "duration_ms" in scan_data

    # 3. List IPs & Check Active Hosts, Vendors, and Rogue Devices
    ips_res = client.get(f"/api/subnets/{subnet_id}/ips")
    assert ips_res.status_code == 200
    ips = ips_res.json()
    assert len(ips) == 254

    active_hosts = [i for i in ips if i["is_online"]]
    assert len(active_hosts) >= 2

    # Check vendor resolution for detected active hosts
    hosts_with_vendor = [i for i in active_hosts if i.get("vendor")]
    assert len(hosts_with_vendor) > 0

    rogues = [i for i in ips if i["reconciliation_status"] == "ROGUE_DEVICE"]
    assert len(rogues) > 0

    # 4. Quick Trust-MAC
    target = rogues[0]
    trust_res = client.post(f"/api/ips/{target['id']}/trust-mac")
    assert trust_res.status_code == 200
    trusted_ip = trust_res.json()
    assert trusted_ip["admin_status"] == "assigned"
    assert trusted_ip["expected_mac"] == trusted_ip["detected_mac"]
    assert trusted_ip["reconciliation_status"] == "VALID_ONLINE"

    # 5. Intentional Conflict Test (MAC Mismatch)
    conflict_res = client.put(
        f"/api/ips/{target['id']}",
        json={
            "admin_status": "assigned",
            "expected_mac": "11:22:33:44:55:66",
        },
    )
    assert conflict_res.status_code == 200
    mismatched_ip = conflict_res.json()
    assert mismatched_ip["expected_mac"] == "11:22:33:44:55:66"
    assert mismatched_ip["reconciliation_status"] == "MAC_MISMATCH"
