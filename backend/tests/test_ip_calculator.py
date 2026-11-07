import pytest
from app.services.ip_calculator import (
    normalize_mac,
    validate_v4_subnet_24,
    generate_host_ips,
    reconcile_status,
)


def test_normalize_mac():
    assert normalize_mac("00-11-22-33-44-55") == "00:11:22:33:44:55"
    assert normalize_mac("aa:bb:cc:dd:ee:ff") == "AA:BB:CC:DD:EE:FF"
    assert normalize_mac("AA:BB:CC:DD:EE:FF") == "AA:BB:CC:DD:EE:FF"
    assert normalize_mac("0011.2233.4455") == "00:11:22:33:44:55"
    assert normalize_mac("001122334455") == "00:11:22:33:44:55"
    assert normalize_mac(None) is None

    with pytest.raises(ValueError):
        normalize_mac("invalid-mac")

    with pytest.raises(ValueError):
        normalize_mac("")

    with pytest.raises(ValueError):
        normalize_mac("00:11:22:33:44")

    with pytest.raises(ValueError):
        normalize_mac("00:11:22:33:44:55:66")

    with pytest.raises(ValueError):
        normalize_mac("00:11:22:33:44:ZZ")


def test_validate_v4_subnet_24():
    validate_v4_subnet_24("192.168.1.0/24")
    validate_v4_subnet_24("10.50.0.0/24")

    with pytest.raises(ValueError):
        validate_v4_subnet_24("192.168.1.0/22")  # Non-/24 must fail

    with pytest.raises(ValueError):
        validate_v4_subnet_24("10.0.0.1/32")

    with pytest.raises(ValueError):
        validate_v4_subnet_24("invalid-cidr")

    with pytest.raises(ValueError):
        validate_v4_subnet_24("")


def test_generate_host_ips():
    hosts = generate_host_ips("192.168.10.0/24", gateway="192.168.10.1")
    assert len(hosts) == 254
    assert hosts[0]["ip_address"] == "192.168.10.1"
    assert hosts[0]["admin_status"] == "reserved"
    assert hosts[0]["hostname"] == "Default Gateway"
    assert hosts[0]["reconciliation_status"] == "RESERVED"
    assert hosts[1]["ip_address"] == "192.168.10.2"
    assert hosts[1]["admin_status"] == "available"
    assert hosts[1]["reconciliation_status"] == "FREE"
    assert hosts[253]["ip_address"] == "192.168.10.254"
    assert hosts[253]["admin_status"] == "available"

    # Subnet without gateway
    hosts_no_gw = generate_host_ips("192.168.20.0/24")
    assert len(hosts_no_gw) == 254
    assert all(h["admin_status"] == "available" for h in hosts_no_gw)
    assert all(h["reconciliation_status"] == "FREE" for h in hosts_no_gw)

    # Gateway outside subnet must fail
    with pytest.raises(ValueError):
        generate_host_ips("192.168.10.0/24", gateway="10.0.0.1")

    # Gateway as network or broadcast address must fail
    with pytest.raises(ValueError):
        generate_host_ips("192.168.10.0/24", gateway="192.168.10.0")

    with pytest.raises(ValueError):
        generate_host_ips("192.168.10.0/24", gateway="192.168.10.255")


def test_reconcile_matrix_statuses():
    # Reserved
    assert reconcile_status("reserved", is_online=True, expected_mac=None, detected_mac=None) == "RESERVED"
    assert reconcile_status("reserved", is_online=False, expected_mac="AA:BB:CC:DD:EE:FF", detected_mac="AA:BB:CC:DD:EE:FF") == "RESERVED"

    # Free
    assert reconcile_status("available", is_online=False, expected_mac=None, detected_mac=None) == "FREE"

    # Rogue device
    assert reconcile_status("available", is_online=True, expected_mac=None, detected_mac="AA:BB:CC:DD:EE:FF") == "ROGUE_DEVICE"

    # Offline assigned
    assert reconcile_status("assigned", is_online=False, expected_mac="AA:BB:CC:DD:EE:FF", detected_mac=None) == "OFFLINE"

    # Valid online (matching MAC or empty expected)
    assert reconcile_status("assigned", is_online=True, expected_mac="AA:BB:CC:DD:EE:FF", detected_mac="AA:BB:CC:DD:EE:FF") == "VALID_ONLINE"
    assert reconcile_status("assigned", is_online=True, expected_mac=None, detected_mac="AA:BB:CC:DD:EE:FF") == "VALID_ONLINE"
    assert reconcile_status("assigned", is_online=True, expected_mac="", detected_mac="AA:BB:CC:DD:EE:FF") == "VALID_ONLINE"
    assert reconcile_status("assigned", is_online=True, expected_mac="aa-bb-cc-dd-ee-ff", detected_mac="AA:BB:CC:DD:EE:FF") == "VALID_ONLINE"

    # MAC Mismatch
    assert reconcile_status("assigned", is_online=True, expected_mac="11:22:33:44:55:66", detected_mac="AA:BB:CC:DD:EE:FF") == "MAC_MISMATCH"

    # Invalid admin_status
    with pytest.raises(ValueError):
        reconcile_status("unknown_status", is_online=False)
