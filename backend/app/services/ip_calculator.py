import ipaddress
import re
from typing import Any, Optional

MAC_PATTERN = re.compile(
    r"^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$|"
    r"^([0-9A-Fa-f]{4}\.){2}([0-9A-Fa-f]{4})$|"
    r"^[0-9A-Fa-f]{12}$"
)


def normalize_mac(mac: Optional[str]) -> Optional[str]:
    """Normalize MAC address string to standard uppercase colon-separated format (AA:BB:CC:DD:EE:FF).

    Returns None if input is None.
    Raises ValueError on empty or invalid MAC string.
    """
    if mac is None:
        return None

    cleaned = mac.strip()
    if not cleaned:
        raise ValueError("MAC address cannot be empty")

    if not MAC_PATTERN.match(cleaned):
        raise ValueError(f"Invalid MAC address: '{mac}'")

    hex_digits = re.sub(r"[^0-9A-Fa-f]", "", cleaned).upper()
    return ":".join(hex_digits[i : i + 2] for i in range(0, 12, 2))


def validate_v4_subnet_24(cidr: str) -> None:
    """Validate that CIDR is a valid IPv4 /24 subnet.

    Raises ValueError if CIDR is invalid or not a /24 prefix.
    """
    if not cidr or not isinstance(cidr, str):
        raise ValueError("CIDR must be a non-empty string")

    try:
        network = ipaddress.IPv4Network(cidr.strip(), strict=False)
    except Exception as e:
        raise ValueError(f"Invalid IPv4 CIDR: '{cidr}'") from e

    if network.version != 4 or network.prefixlen != 24:
        raise ValueError(
            f"Subnet must be a /24 IPv4 network, got /{network.prefixlen}"
        )


def generate_host_ips(
    cidr: str, gateway: Optional[str] = None
) -> list[dict[str, Any]]:
    """Generate all 254 usable host records for a /24 subnet.

    Automatically assigns admin_status="reserved", hostname="Default Gateway",
    and reconciliation_status="RESERVED" to the gateway IP if provided.
    Raises ValueError if subnet is invalid or gateway is not within host range.
    """
    validate_v4_subnet_24(cidr)
    network = ipaddress.IPv4Network(cidr.strip(), strict=False)

    gw_addr: Optional[ipaddress.IPv4Address] = None
    if gateway and gateway.strip():
        gw_raw = gateway.strip()
        try:
            gw_addr = ipaddress.IPv4Address(gw_raw)
        except Exception as e:
            raise ValueError(f"Invalid gateway IP address: '{gateway}'") from e

        if gw_addr not in network.hosts():
            raise ValueError(
                f"Gateway '{gateway}' is not a valid host IP in subnet '{cidr}'"
            )

    hosts: list[dict[str, Any]] = []
    for host_ip in network.hosts():
        is_gw = gw_addr is not None and host_ip == gw_addr
        hosts.append(
            {
                "ip_address": str(host_ip),
                "admin_status": "reserved" if is_gw else "available",
                "hostname": "Default Gateway" if is_gw else None,
                "description": None,
                "expected_mac": None,
                "detected_mac": None,
                "vendor": None,
                "is_online": False,
                "last_seen_at": None,
                "reconciliation_status": "RESERVED" if is_gw else "FREE",
            }
        )

    return hosts


def reconcile_status(
    admin_status: str,
    is_online: bool,
    expected_mac: Optional[str] = None,
    detected_mac: Optional[str] = None,
) -> str:
    """Reconcile operational status based on administrative status, online state,

    and MAC comparison.

    States:
    - RESERVED: admin_status == "reserved"
    - FREE: admin_status == "available" and not is_online
    - ROGUE_DEVICE: admin_status == "available" and is_online
    - OFFLINE: admin_status == "assigned" and not is_online
    - VALID_ONLINE: admin_status == "assigned" and is_online and (no expected_mac or normalized MACs match)
    - MAC_MISMATCH: admin_status == "assigned" and is_online and expected_mac != detected_mac
    """
    status = (admin_status or "").lower().strip()

    if status == "reserved":
        return "RESERVED"

    if status == "available":
        return "ROGUE_DEVICE" if is_online else "FREE"

    if status == "assigned":
        if not is_online:
            return "OFFLINE"

        if not expected_mac or not expected_mac.strip():
            return "VALID_ONLINE"

        try:
            norm_expected = normalize_mac(expected_mac)
        except ValueError:
            norm_expected = expected_mac.strip().upper()

        try:
            norm_detected = normalize_mac(detected_mac) if detected_mac else None
        except ValueError:
            norm_detected = detected_mac.strip().upper() if detected_mac else None

        if norm_detected is not None and norm_expected == norm_detected:
            return "VALID_ONLINE"

        return "MAC_MISMATCH"

    raise ValueError(
        f"Unknown admin_status: '{admin_status}'. Must be 'available', 'assigned', or 'reserved'."
    )
