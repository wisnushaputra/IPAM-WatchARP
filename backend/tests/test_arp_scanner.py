from unittest.mock import MagicMock, patch
import pytest

from app.services.arp_scanner import (
    _OUI_CACHE,
    lookup_vendor,
    perform_arp_scan,
)


def test_lookup_vendor_caching():
    # Ubiquiti prefix 00:27:22
    vendor = lookup_vendor("00:27:22:01:02:03")
    assert vendor is not None
    assert "Ubiquiti" in vendor
    # Second call hits in-memory cache
    assert lookup_vendor("00:27:22:01:02:03") == vendor
    # Verify cache key exists in _OUI_CACHE
    assert "00:27:22" in _OUI_CACHE


def test_lookup_vendor_builtins():
    # Test major built-ins
    vendors = {
        "00:00:0C:AA:BB:CC": "Cisco",
        "3C:D9:2B:11:22:33": "Apple",
        "00:0C:42:DE:AD:01": "MikroTik",
        "A4:4C:C8:44:55:66": "Intel",
        "24:0A:C4:77:88:99": "Espressif",
        "B8:27:EB:00:11:22": "Raspberry Pi",
        "50:C7:BF:33:44:55": "TP-Link",
    }
    for mac, expected_substr in vendors.items():
        v = lookup_vendor(mac)
        assert v is not None, f"Vendor for {mac} should not be None"
        assert expected_substr.lower() in v.lower(), f"Expected {expected_substr} in {v}"


def test_lookup_vendor_unknown_and_invalid():
    # Unknown MAC should return None gracefully
    assert lookup_vendor("02:00:00:11:22:33") is None
    # Invalid MAC strings should return None gracefully
    assert lookup_vendor("invalid-mac") is None
    assert lookup_vendor("") is None
    assert lookup_vendor(None) is None


def test_perform_arp_scan_mock_mode():
    results = perform_arp_scan("192.168.1.0/24", mode="mock", sample_gateway="192.168.1.1")
    assert len(results) >= 2
    ips = [r["ip_address"] for r in results]
    assert "192.168.1.1" in ips
    for r in results:
        assert "ip_address" in r
        assert "detected_mac" in r
        assert "vendor" in r
        # MAC addresses must be normalized colon-separated hex
        parts = r["detected_mac"].split(":")
        assert len(parts) == 6


def test_perform_arp_scan_custom_cidr():
    results = perform_arp_scan("10.0.50.0/24", mode="mock", sample_gateway="10.0.50.1")
    assert len(results) >= 4
    for r in results:
        assert r["ip_address"].startswith("10.0.50.")
        assert r["detected_mac"]
        assert r["vendor"] is not None


def test_perform_arp_scan_invalid_cidr():
    with pytest.raises(ValueError):
        perform_arp_scan("not-a-cidr", mode="mock")
    with pytest.raises(ValueError):
        perform_arp_scan("192.168.1.0/16", mode="mock")


def test_perform_arp_scan_live_mode_success():
    mock_arp_pkt = MagicMock()
    mock_arp_pkt.psrc = "192.168.1.55"
    mock_ether_pkt = MagicMock()
    mock_ether_pkt.src = "00:27:22:99:88:77"

    # received packet can be indexed with ARP or Ether
    class DummyPkt:
        def __getitem__(self, item):
            from scapy.layers.l2 import ARP, Ether
            if item == ARP:
                return mock_arp_pkt
            if item == Ether:
                return mock_ether_pkt
            raise KeyError(item)

    mock_received = DummyPkt()
    mock_sent = MagicMock()

    with patch("app.services.arp_scanner._send_arp_packets", return_value=[(mock_sent, mock_received)]):
        results = perform_arp_scan("192.168.1.0/24", mode="live")
        assert len(results) == 1
        assert results[0]["ip_address"] == "192.168.1.55"
        assert results[0]["detected_mac"] == "00:27:22:99:88:77"
        assert "Ubiquiti" in results[0]["vendor"]


def test_perform_arp_scan_live_mode_fallback_on_error():
    with patch("app.services.arp_scanner._send_arp_packets", side_effect=PermissionError("Npcap permission denied")):
        # When live scan fails, it should log a warning and fallback gracefully to mock scan
        results = perform_arp_scan("192.168.1.0/24", mode="live", sample_gateway="192.168.1.1")
        assert len(results) >= 2
        ips = [r["ip_address"] for r in results]
        assert "192.168.1.1" in ips
