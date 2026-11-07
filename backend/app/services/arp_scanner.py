import ipaddress
import logging
import warnings
from typing import Any, Optional

from app.services.ip_calculator import normalize_mac, validate_v4_subnet_24

logger = logging.getLogger(__name__)

# Common vendor OUI mappings (first 3 bytes, colon-separated uppercase)
BUILTIN_VENDORS: dict[str, str] = {
    # Ubiquiti
    "00:27:22": "Ubiquiti Networks Inc.",
    "24:A4:3C": "Ubiquiti Networks Inc.",
    "74:83:C2": "Ubiquiti Networks Inc.",
    "B4:FB:E4": "Ubiquiti Networks Inc.",
    "F0:9F:C2": "Ubiquiti Networks Inc.",
    # Cisco
    "00:00:0C": "Cisco Systems",
    "00:01:42": "Cisco Systems",
    "00:01:43": "Cisco Systems",
    "00:01:63": "Cisco Systems",
    "00:01:64": "Cisco Systems",
    "00:1E:13": "Cisco Systems",
    "00:1E:49": "Cisco Systems",
    "00:40:96": "Cisco Systems",
    # Apple
    "00:17:F2": "Apple, Inc.",
    "3C:D9:2B": "Apple, Inc.",
    "AC:DE:48": "Apple, Inc.",
    "F0:18:98": "Apple, Inc.",
    "BC:D0:74": "Apple, Inc.",
    # MikroTik
    "00:0C:42": "MikroTik",
    "48:8F:5A": "MikroTik",
    "64:D1:54": "MikroTik",
    "B8:69:F4": "MikroTik",
    "D4:01:C3": "MikroTik",
    # Intel
    "00:03:47": "Intel Corporate",
    "00:13:02": "Intel Corporate",
    "00:15:00": "Intel Corporate",
    "00:1B:21": "Intel Corporate",
    "A4:4C:C8": "Intel Corporate",
    # Espressif
    "24:0A:C4": "Espressif Inc.",
    "30:AE:A4": "Espressif Inc.",
    "84:CC:A8": "Espressif Inc.",
    "A4:CF:12": "Espressif Inc.",
    "EC:FA:BC": "Espressif Inc.",
    # Raspberry Pi
    "28:CD:C1": "Raspberry Pi Trading Ltd",
    "B8:27:EB": "Raspberry Pi Foundation",
    "DC:A6:32": "Raspberry Pi Trading Ltd",
    "E4:5F:01": "Raspberry Pi Trading Ltd",
    # TP-Link
    "14:CC:20": "TP-Link Corporation Limited",
    "50:C7:BF": "TP-Link Corporation Limited",
    "B0:4E:26": "TP-Link Corporation Limited",
    "C0:06:C3": "TP-Link Corporation Limited",
    "EC:08:6B": "TP-Link Corporation Limited",
}

# In-memory OUI cache for O(1) vendor lookups
_OUI_CACHE: dict[str, str] = {}

# Lazy initialization of mac-vendor-lookup helper
_mac_lookup_instance: Any = None
_mac_lookup_failed: bool = False


def _get_mac_lookup():
    global _mac_lookup_instance, _mac_lookup_failed
    if _mac_lookup_instance is None and not _mac_lookup_failed:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", DeprecationWarning)
                from mac_vendor_lookup import MacLookup
                _mac_lookup_instance = MacLookup()
        except Exception as e:
            logger.debug("Failed to initialize MacLookup: %s", e)
            _mac_lookup_failed = True
    return _mac_lookup_instance


def lookup_vendor(mac: Optional[str]) -> Optional[str]:
    """Look up vendor name from MAC address using in-memory OUI cache,

    built-in mappings, and mac-vendor-lookup fallback.
    Returns None if unknown or invalid MAC.
    """
    if not mac or not isinstance(mac, str):
        return None

    try:
        normalized = normalize_mac(mac)
    except ValueError:
        return None

    if not normalized:
        return None

    oui = normalized[:8].upper()

    # 1. Check in-memory cache
    if oui in _OUI_CACHE:
        return _OUI_CACHE[oui]

    # 2. Check built-in table
    if oui in BUILTIN_VENDORS:
        vendor = BUILTIN_VENDORS[oui]
        _OUI_CACHE[oui] = vendor
        return vendor

    # 3. Fallback to mac-vendor-lookup library
    lookup_obj = _get_mac_lookup()
    if lookup_obj is not None:
        try:
            vendor = lookup_obj.lookup(normalized)
            if vendor:
                _OUI_CACHE[oui] = vendor
                return vendor
        except Exception:
            pass

    return None


def _mock_arp_scan(network: ipaddress.IPv4Network, sample_gateway: Optional[str] = None) -> list[dict[str, Optional[str]]]:
    """Generate deterministic simulated active hosts for mock mode."""
    base_ip = network.network_address
    gw_ip = sample_gateway.strip() if sample_gateway else str(base_ip + 1)

    # 3-5 deterministic simulated devices with authentic vendor OUIs
    devices = [
        {"ip": gw_ip, "mac": "00:00:0C:FE:10:01", "fallback_vendor": "Cisco Systems"},
        {"ip": str(base_ip + 10), "mac": "24:0A:C4:1A:2B:3C", "fallback_vendor": "Espressif Inc."},
        {"ip": str(base_ip + 25), "mac": "00:27:22:98:76:54", "fallback_vendor": "Ubiquiti Networks Inc."},
        {"ip": str(base_ip + 50), "mac": "3C:D9:2B:AA:BB:CC", "fallback_vendor": "Apple, Inc."},
        {"ip": str(base_ip + 100), "mac": "A4:4C:C8:11:22:33", "fallback_vendor": "Intel Corporate"},
    ]

    # Deduplicate in case sample_gateway clashes with one of the offsets
    seen_ips = set()
    results: list[dict[str, Optional[str]]] = []

    for dev in devices:
        ip = dev["ip"]
        if ip in seen_ips:
            continue
        seen_ips.add(ip)
        norm_mac = normalize_mac(dev["mac"]) or dev["mac"]
        vendor = lookup_vendor(norm_mac) or dev["fallback_vendor"]
        results.append({
            "ip_address": ip,
            "detected_mac": norm_mac,
            "vendor": vendor,
        })

    return results


def _send_arp_packets(cidr: str):
    """Encapsulates Scapy srp execution for ARP sweep."""
    from scapy.all import srp
    from scapy.layers.l2 import ARP, Ether

    ans, _ = srp(
        Ether(dst="ff:ff:ff:ff:ff:ff") / ARP(pdst=cidr),
        timeout=2,
        verbose=0,
    )
    return ans


def perform_arp_scan(
    cidr: str,
    mode: Optional[str] = None,
    sample_gateway: Optional[str] = None,
) -> list[dict[str, Optional[str]]]:
    """Perform an ARP scan across a /24 IPv4 subnet.

    Parameters:
    - cidr: IPv4 subnet in CIDR notation (must be a valid /24).
    - mode: "mock" (deterministic simulation) or "live" (Scapy packet sweep).
      Defaults to SCAN_MODE env var or "mock".
    - sample_gateway: Optional gateway IP to ensure inclusion in scan results.

    Returns:
    List of active host records: [{"ip_address": str, "detected_mac": str, "vendor": Optional[str]}]
    """
    validate_v4_subnet_24(cidr)
    network = ipaddress.IPv4Network(cidr.strip(), strict=False)
    effective_mode = (mode or os.getenv("SCAN_MODE", "mock")).strip().lower()

    if effective_mode == "mock":
        return _mock_arp_scan(network, sample_gateway)

    if effective_mode == "live":
        try:
            from scapy.layers.l2 import ARP, Ether
            ans = _send_arp_packets(cidr)
            results: list[dict[str, Optional[str]]] = []
            for _sent, received in ans:
                try:
                    recv_ip = str(received[ARP].psrc)
                    raw_mac = str(received[Ether].src)
                    detected_mac = normalize_mac(raw_mac)
                    if not detected_mac:
                        continue
                    vendor = lookup_vendor(detected_mac)
                    results.append({
                        "ip_address": recv_ip,
                        "detected_mac": detected_mac,
                        "vendor": vendor,
                    })
                except Exception as packet_err:
                    logger.debug("Skipping invalid packet in live ARP scan: %s", packet_err)
                    continue
            return results
        except Exception as exc:
            logger.warning(
                "Live ARP scan failed for subnet %s (%s: %s). Falling back to mock scan.",
                cidr,
                type(exc).__name__,
                exc,
            )
            return _mock_arp_scan(network, sample_gateway)

    raise ValueError(f"Invalid scan mode: '{effective_mode}'. Must be 'mock' or 'live'")
