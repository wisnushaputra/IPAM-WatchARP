# WatchARP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build WatchARP, a lightweight IP Address Management (IPAM) web application with an integrated on-demand ARP scanner (with Scapy live mode and mock simulation mode) and deterministic status reconciliation engine to detect rogue devices and IP/MAC mismatches on local `/24` subnets.

**Architecture:** Modular Decoupled Monorepo with a FastAPI backend (`backend/`) using SQLite (WAL mode) and SQLAlchemy ORM, and a React + Vite + Tailwind CSS frontend (`frontend/`). State is managed through RESTful endpoints with in-process Layer 2 ARP sweeping and cached OUI MAC vendor lookup.

**Tech Stack:** Python 3.12 (`uv`), FastAPI, Pydantic v2, SQLAlchemy 2.0, SQLite, Scapy, mac-vendor-lookup, Node.js 26, Vite, React 18/19, Tailwind CSS, Lucide React.

**Spec:** [docs/superpowers/specs/2026-11-07-watcharp-ipam-design.md](file:///d:/latihan/IPAM/docs/superpowers/specs/2026-11-07-watcharp-ipam-design.md)

## Global Constraints

- Backend must enforce `/24` IPv4 subnets strictly (254 host IPs generated per subnet).
- Gateway IP must fall within the subnet CIDR and automatically have `admin_status="reserved"` and `hostname="Default Gateway"`.
- MAC addresses must always be normalized to uppercase, colon-separated format (`AA:BB:CC:DD:EE:FF`).
- SQLite database must be configured with `PRAGMA journal_mode=WAL;` and `PRAGMA busy_timeout=5000;`.
- Scanner service must support `SCAN_MODE=mock` (default for testing without root/Npcap permissions) and `SCAN_MODE=live`.
- Antislop mode `during` must be respected: purposeful layout, accessible high-contrast status colors, responsive interactive elements, and zero generic UI slop.

## Review Focus

1. **Non-/24 or Malformed CIDR**: Input like `192.168.1.0/22`, `10.0.0.1/32`, or `invalid-cidr` must be rejected with HTTP 422/400 validation error.
2. **Out-of-Subnet Gateway**: Creating a subnet `192.168.10.0/24` with gateway `10.0.0.1` must be rejected with HTTP 400.
3. **Dirty MAC Address Strings**: Updates submitting dashes (`AA-BB-CC-DD-EE-FF`) or lowercase characters (`aa:bb:cc:dd:ee:ff`) must normalize to `AA:BB:CC:DD:EE:FF`; invalid strings must be rejected with 422.
4. **Trust MAC on Unseen IP**: Calling `POST /api/ips/{id}/trust-mac` on an IP record with no `detected_mac` must return HTTP 400 with a clear error message.
5. **Simultaneous Scan Requests**: Triggering `POST /api/subnets/{id}/scan` while a scan on the same subnet is already in progress must reject or queue safely without duplicate database writes or SQLite locks.

---

### Task 1: Backend Foundation, Database Configuration & Models

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/app/__init__.py`
- Create: `backend/app/database.py`
- Create: `backend/app/models.py`
- Test: `backend/tests/test_models.py`

**Interfaces:**
- Produces:
  - `Base`: SQLAlchemy declarative base
  - `get_db() -> Generator[Session, None, None]`
  - `engine`: SQLAlchemy Engine with WAL mode listener
  - `Subnet`: SQLAlchemy model (`id`, `name`, `cidr`, `gateway`, `vlan_id`, `last_scanned_at`, `created_at`, `ip_addresses`)
  - `IpAddress`: SQLAlchemy model (`id`, `subnet_id`, `ip_address`, `admin_status`, `hostname`, `description`, `expected_mac`, `detected_mac`, `vendor`, `is_online`, `last_seen_at`, `reconciliation_status`)
  - `ScanHistory`: SQLAlchemy model (`id`, `subnet_id`, `scanned_at`, `total_online`, `total_anomalies`, `duration_ms`)

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_models.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import Subnet, IpAddress, ScanHistory

def test_models_creation_and_relationships():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    subnet = Subnet(name="Test Subnet", cidr="192.168.1.0/24", gateway="192.168.1.1")
    session.add(subnet)
    session.commit()

    ip = IpAddress(
        subnet_id=subnet.id,
        ip_address="192.168.1.10",
        admin_status="available",
        reconciliation_status="FREE"
    )
    session.add(ip)

    history = ScanHistory(
        subnet_id=subnet.id,
        total_online=1,
        total_anomalies=0,
        duration_ms=120
    )
    session.add(history)
    session.commit()

    assert subnet.id is not None
    assert len(subnet.ip_addresses) == 1
    assert subnet.ip_addresses[0].ip_address == "192.168.1.10"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --directory backend pytest tests/test_models.py -v`
Expected: FAIL with `ModuleNotFoundError` or missing database/models modules.

- [ ] **Step 3: Implement database configuration and models**

- Create `backend/requirements.txt` containing `fastapi>=0.115.0`, `uvicorn[standard]>=0.30.0`, `sqlalchemy>=2.0.0`, `pydantic>=2.8.0`, `python-dotenv>=1.0.0`, `scapy>=2.5.0`, `mac-vendor-lookup>=0.1.12`, `pytest>=8.0.0`, `httpx>=0.27.0`.
- Create `backend/app/database.py` configuring SQLite engine with `check_same_thread=False` and a connect listener executing `PRAGMA journal_mode=WAL;` and `PRAGMA busy_timeout=5000;`. Provide `get_db` session generator.
- Create `backend/app/models.py` with SQLAlchemy models `Subnet`, `IpAddress`, `ScanHistory` and cascade deletion foreign keys.

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --directory backend pytest tests/test_models.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat(backend): configure database and define SQLAlchemy models"
```

---

### Task 2: IP Calculator & Status Reconciliation Engine

**Files:**
- Create: `backend/app/services/ip_calculator.py`
- Test: `backend/tests/test_ip_calculator.py`

**Interfaces:**
- Produces:
  - `normalize_mac(mac: Optional[str]) -> Optional[str]`
  - `validate_v4_subnet_24(cidr: str) -> None` (raises `ValueError` if not valid `/24`)
  - `generate_host_ips(cidr: str, gateway: Optional[str] = None) -> list[dict]`
  - `reconcile_status(admin_status: str, is_online: bool, expected_mac: Optional[str], detected_mac: Optional[str]) -> str`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_ip_calculator.py
import pytest
from app.services.ip_calculator import (
    normalize_mac,
    validate_v4_subnet_24,
    generate_host_ips,
    reconcile_status
)

def test_normalize_mac():
    assert normalize_mac("00-11-22-33-44-55") == "00:11:22:33:44:55"
    assert normalize_mac("aa:bb:cc:dd:ee:ff") == "AA:BB:CC:DD:EE:FF"
    assert normalize_mac(None) is None
    with pytest.raises(ValueError):
        normalize_mac("invalid-mac")

def test_validate_v4_subnet_24():
    validate_v4_subnet_24("192.168.1.0/24")
    with pytest.raises(ValueError):
        validate_v4_subnet_24("192.168.1.0/22")  # Non-/24 must fail
    with pytest.raises(ValueError):
        validate_v4_subnet_24("invalid-cidr")

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

def test_reconcile_matrix_statuses():
    # Reserved
    assert reconcile_status("reserved", is_online=True, expected_mac=None, detected_mac=None) == "RESERVED"
    # Free
    assert reconcile_status("available", is_online=False, expected_mac=None, detected_mac=None) == "FREE"
    # Rogue device
    assert reconcile_status("available", is_online=True, expected_mac=None, detected_mac="AA:BB:CC:DD:EE:FF") == "ROGUE_DEVICE"
    # Offline assigned
    assert reconcile_status("assigned", is_online=False, expected_mac="AA:BB:CC:DD:EE:FF", detected_mac=None) == "OFFLINE"
    # Valid online (matching MAC or empty expected)
    assert reconcile_status("assigned", is_online=True, expected_mac="AA:BB:CC:DD:EE:FF", detected_mac="AA:BB:CC:DD:EE:FF") == "VALID_ONLINE"
    assert reconcile_status("assigned", is_online=True, expected_mac=None, detected_mac="AA:BB:CC:DD:EE:FF") == "VALID_ONLINE"
    # MAC Mismatch
    assert reconcile_status("assigned", is_online=True, expected_mac="11:22:33:44:55:66", detected_mac="AA:BB:CC:DD:EE:FF") == "MAC_MISMATCH"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --directory backend pytest tests/test_ip_calculator.py -v`
Expected: FAIL with `ModuleNotFoundError` for `app.services.ip_calculator`.

- [ ] **Step 3: Implement `ip_calculator.py`**

- Use Python's `ipaddress` module to enforce `network.prefixlen == 24` and generate hosts.
- Implement `normalize_mac` to strip non-hex separators and format as `AA:BB:CC:DD:EE:FF`.
- Implement `reconcile_status` mapping the 6 states specified in the design doc.

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --directory backend pytest tests/test_ip_calculator.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ip_calculator.py backend/tests/test_ip_calculator.py
git commit -m "feat(backend): implement IP calculator and status reconciliation engine"
```

---

### Task 3: ARP Scanner Service & Vendor Lookup

**Files:**
- Create: `backend/app/services/arp_scanner.py`
- Test: `backend/tests/test_arp_scanner.py`

**Interfaces:**
- Consumes: `normalize_mac` from `app.services.ip_calculator`
- Produces:
  - `lookup_vendor(mac: str) -> Optional[str]` (with in-memory dictionary cache)
  - `perform_arp_scan(cidr: str, mode: str = "mock", sample_gateway: Optional[str] = None) -> list[dict[str, str]]`
    Returns list of items: `{"ip_address": str, "detected_mac": str, "vendor": Optional[str]}`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_arp_scanner.py
import pytest
from app.services.arp_scanner import lookup_vendor, perform_arp_scan

def test_lookup_vendor_caching():
    # Ubiquiti prefix 00:27:22
    vendor = lookup_vendor("00:27:22:01:02:03")
    assert vendor is not None
    assert "Ubiquiti" in vendor
    # Second call hits in-memory cache
    assert lookup_vendor("00:27:22:01:02:03") == vendor

def test_perform_arp_scan_mock_mode():
    results = perform_arp_scan("192.168.1.0/24", mode="mock", sample_gateway="192.168.1.1")
    assert len(results) >= 2
    ips = [r["ip_address"] for r in results]
    assert "192.168.1.1" in ips
    for r in results:
        assert "detected_mac" in r
        assert "vendor" in r
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --directory backend pytest tests/test_arp_scanner.py -v`
Expected: FAIL with `ModuleNotFoundError` for `app.services.arp_scanner`.

- [ ] **Step 3: Implement `arp_scanner.py`**

- In `lookup_vendor(mac: str)`, cache OUI 3-byte prefix results in an in-memory `dict[str, str]`. Fallback to `mac-vendor-lookup` or a built-in common vendor table (Cisco, Apple, MikroTik, Ubiquiti, Intel, Espressif).
- In `perform_arp_scan`, check `mode`. If `mock`, generate deterministic simulated active hosts including gateway (`192.168.1.1`), router, host machine, and 2-3 sample clients with genuine MAC addresses. If `live`, execute Scapy `srp(Ether(dst="ff:ff:ff:ff:ff:ff")/ARP(pdst=cidr), timeout=2, verbose=0)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --directory backend pytest tests/test_arp_scanner.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/arp_scanner.py backend/tests/test_arp_scanner.py
git commit -m "feat(backend): implement ARP scanner service with mock fallback and vendor lookup"
```

---

### Task 4: FastAPI Schemas & Subnet Endpoints

**Files:**
- Create: `backend/app/schemas.py`
- Create: `backend/app/routers/subnets.py`
- Create: `backend/app/main.py`
- Test: `backend/tests/test_subnets_api.py`

**Interfaces:**
- Consumes: Models from `app.models`, Services from `app.services.ip_calculator`
- Produces:
  - `POST /api/subnets`: Create `/24` subnet, populate 254 IP rows, return SubnetDetail
  - `GET /api/subnets`: List subnets with calculated statistics (`total_ips`, `assigned_count`, `online_count`, `rogue_count`, `mismatch_count`)
  - `GET /api/subnets/{id}`: Single subnet details
  - `DELETE /api/subnets/{id}`: Delete subnet and cascade IP rows

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_subnets_api.py
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
    res = client.post("/api/subnets", json={
        "name": "Office LAN",
        "cidr": "192.168.50.0/24",
        "gateway": "192.168.50.1",
        "vlan_id": 50
    })
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Office LAN"
    assert data["cidr"] == "192.168.50.0/24"
    assert data["total_ips"] == 254

    list_res = client.get("/api/subnets")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

def test_create_invalid_cidr_rejected(client):
    res = client.post("/api/subnets", json={
        "name": "Invalid Subnet",
        "cidr": "192.168.0.0/16"
    })
    assert res.status_code in [400, 422]

def test_gateway_outside_subnet_rejected(client):
    res = client.post("/api/subnets", json={
        "name": "Bad Gateway",
        "cidr": "192.168.10.0/24",
        "gateway": "10.0.0.1"
    })
    assert res.status_code == 400
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --directory backend pytest tests/test_subnets_api.py -v`
Expected: FAIL with `ModuleNotFoundError` for `app.main`.

- [ ] **Step 3: Implement `schemas.py`, `routers/subnets.py`, and `main.py`**

- `schemas.py`: Pydantic models for `SubnetCreate`, `SubnetResponse`, `SubnetSummary`, `IpAddressResponse`, `IpAddressUpdate`.
- `routers/subnets.py`: Subnet CRUD endpoints. Ensure `POST` generates all 254 IP rows using `generate_host_ips`. Validate gateway is inside CIDR.
- `main.py`: Setup FastAPI instance, configure CORS for `http://localhost:5173` and `http://127.0.0.1:5173`, mount routers.

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --directory backend pytest tests/test_subnets_api.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas.py backend/app/routers/subnets.py backend/app/main.py backend/tests/test_subnets_api.py
git commit -m "feat(backend): implement Pydantic schemas and subnet API endpoints"
```

---

### Task 5: IP Endpoints & Scan Trigger API

**Files:**
- Create: `backend/app/routers/ips.py`
- Modify: `backend/app/routers/subnets.py` (mount scan endpoint)
- Modify: `backend/app/main.py` (include `ips_router`)
- Test: `backend/tests/test_ips_api.py`

**Interfaces:**
- Produces:
  - `GET /api/subnets/{id}/ips?status=...`: Query list of all IPs in subnet
  - `PUT /api/ips/{id}`: Update admin status, hostname, description, expected MAC; recalculate reconciliation status
  - `POST /api/ips/{id}/trust-mac`: Copy detected MAC to expected MAC, set `assigned`, recalculate
  - `POST /api/subnets/{id}/scan`: Run scan, update online states, create `ScanHistory`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_ips_api.py
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
    sub_res = client.post("/api/subnets", json={
        "name": "Scan LAN",
        "cidr": "192.168.1.0/24",
        "gateway": "192.168.1.1"
    })
    subnet_id = sub_res.json()["id"]

    # 2. Trigger Scan (mock mode)
    scan_res = client.post(f"/api/subnets/{subnet_id}/scan")
    assert scan_res.status_code == 200
    scan_data = scan_res.json()
    assert scan_data["total_online"] > 0

    # 3. Retrieve IPs
    ips_res = client.get(f"/api/subnets/{subnet_id}/ips")
    assert ips_res.status_code == 200
    ips = ips_res.json()
    assert len(ips) == 254

    # Find an online rogue device
    rogue = next((ip for ip in ips if ip["reconciliation_status"] == "ROGUE_DEVICE"), None)
    assert rogue is not None

    # 4. Trust MAC shortcut
    trust_res = client.post(f"/api/ips/{rogue['id']}/trust-mac")
    assert trust_res.status_code == 200
    updated_rogue = trust_res.json()
    assert updated_rogue["admin_status"] == "assigned"
    assert updated_rogue["expected_mac"] == updated_rogue["detected_mac"]
    assert updated_rogue["reconciliation_status"] == "VALID_ONLINE"

    # 5. Intentional MAC mismatch
    edit_res = client.put(f"/api/ips/{rogue['id']}", json={
        "admin_status": "assigned",
        "expected_mac": "11:22:33:44:55:66",
        "hostname": "Renamed Node"
    })
    assert edit_res.status_code == 200
    assert edit_res.json()["reconciliation_status"] == "MAC_MISMATCH"

def test_trust_mac_without_detected_mac_fails(client):
    sub_res = client.post("/api/subnets", json={"name": "Test LAN", "cidr": "192.168.2.0/24"})
    subnet_id = sub_res.json()["id"]
    ips = client.get(f"/api/subnets/{subnet_id}/ips").json()
    # Offline IP with no detected MAC
    target = ips[10]
    res = client.post(f"/api/ips/{target['id']}/trust-mac")
    assert res.status_code == 400
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --directory backend pytest tests/test_ips_api.py -v`
Expected: FAIL with missing router endpoints.

- [ ] **Step 3: Implement IP management and scan endpoints**

- Create `backend/app/routers/ips.py` with `PUT /api/ips/{id}` and `POST /api/ips/{id}/trust-mac`.
- Add `POST /api/subnets/{id}/scan` in `routers/subnets.py` using `perform_arp_scan` and bulk update `ip_addresses` rows with computed `reconciliation_status`.
- Mount `ips_router` in `backend/app/main.py`.

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --directory backend pytest tests/test_ips_api.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/ips.py backend/app/routers/subnets.py backend/app/main.py backend/tests/test_ips_api.py
git commit -m "feat(backend): implement IP management, trust-mac action, and scan trigger endpoints"
```

---

### Task 6: Frontend Project Setup, Tailwind & API Client

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/src/index.css`
- Create: `frontend/src/services/api.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`

**Interfaces:**
- Produces:
  - `api.getSubnets()`
  - `api.getSubnet(id)`
  - `api.createSubnet(data)`
  - `api.deleteSubnet(id)`
  - `api.getSubnetIps(subnetId, statusFilter)`
  - `api.updateIp(id, data)`
  - `api.trustMac(id)`
  - `api.scanSubnet(subnetId)`

- [ ] **Step 1: Write API client test / verification check**

Create `frontend/src/services/api.js` with structured fetch functions configured to call `/api` with error checking.
Verify build with `npm --prefix frontend run build`.

- [ ] **Step 2: Initialize frontend dependencies**

- Configure `frontend/package.json` with React 18, React DOM, Vite, Tailwind CSS, PostCSS, Autoprefixer, Lucide React.
- Run `npm install` inside `frontend/`.

- [ ] **Step 3: Configure Vite proxy and Tailwind CSS**

- In `frontend/vite.config.js`, configure `server.proxy`: `'/api': 'http://127.0.0.1:8000'`.
- In `frontend/src/index.css`, add `@tailwind base; @tailwind components; @tailwind utilities;` plus clean custom scrollbar and focus ring utility classes adhering to antislop principles (accessible contrast, crisp borders).

- [ ] **Step 4: Verify frontend build compiles**

Run: `npm --prefix frontend run build`
Expected: Build outputs to `frontend/dist` without errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): scaffold Vite React app with Tailwind CSS and API client"
```

---

### Task 7: Frontend Header & Add Subnet Modal

**Files:**
- Create: `frontend/src/components/Header.jsx`
- Create: `frontend/src/components/AddSubnetModal.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- `Header`: props `{ subnets, selectedSubnet, onSelectSubnet, onOpenAddSubnet, onScan, isScanning }`
- `AddSubnetModal`: props `{ isOpen, onClose, onCreated }`

- [ ] **Step 1: Implement `AddSubnetModal.jsx`**

Form inputs: Subnet Name, CIDR (placeholder `192.168.1.0/24`), Gateway (placeholder `192.168.1.1`), VLAN ID (optional). Form validation disallows non `/24` subnets before submit. Loading state while creating.

- [ ] **Step 2: Implement `Header.jsx`**

Render logo & WatchARP title, Subnet selector dropdown, "+ Tambah Subnet" button, and prominent "Scan Subnet Sekarang" button with loading spinner when `isScanning=true`.

- [ ] **Step 3: Test component integration in `App.jsx`**

Connect `Header` and `AddSubnetModal` in `frontend/src/App.jsx` with state hooks.

- [ ] **Step 4: Verify build succeeds**

Run: `npm --prefix frontend run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Header.jsx frontend/src/components/AddSubnetModal.jsx frontend/src/App.jsx
git commit -m "feat(frontend): add Header with subnet switcher and AddSubnetModal"
```

---

### Task 8: Frontend Summary Cards & Visual IP Grid Map

**Files:**
- Create: `frontend/src/components/StatCards.jsx`
- Create: `frontend/src/components/IpGridMap.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- `StatCards`: props `{ summary }` (Total & Utilization %, Online count, Rogue Devices count, MAC Conflict count)
- `IpGridMap`: props `{ ips, onSelectIp, selectedIp }`
  - Renders 254 responsive grid blocks (`.1` through `.254`)
  - Color map matching PRD §4:
    - `FREE`: White / neutral subtle border
    - `VALID_ONLINE`: Emerald green (`bg-emerald-500 text-white`)
    - `OFFLINE`: Slate gray (`bg-slate-700 text-slate-300`)
    - `ROGUE_DEVICE`: Amber / orange (`bg-amber-500 text-white`)
    - `MAC_MISMATCH`: Pulsing rose red (`bg-rose-600 text-white animate-pulse`)
    - `RESERVED`: Indigo / purple (`bg-indigo-600 text-white`)
  - Tooltip on hover displaying full IP, Hostname, Detected MAC, Status.
  - On click, triggers `onSelectIp(ip)`.

- [ ] **Step 1: Implement `StatCards.jsx`**

Four cards with semantic badges, icons (Lucide `Server`, `Activity`, `AlertTriangle`, `ShieldAlert`), and clear percentages.

- [ ] **Step 2: Implement `IpGridMap.jsx`**

A responsive flex/grid container displaying 254 cells. Accessible focus rings, hover tooltips showing device details, and active selection border. Includes status color legend at the bottom.

- [ ] **Step 3: Connect to `App.jsx`**

Load IP list when selected subnet changes, feed to `StatCards` and `IpGridMap`.

- [ ] **Step 4: Verify build succeeds**

Run: `npm --prefix frontend run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/StatCards.jsx frontend/src/components/IpGridMap.jsx frontend/src/App.jsx
git commit -m "feat(frontend): implement StatCards and interactive Visual IP Grid Map"
```

---

### Task 9: Frontend IP Details Table & Edit Host Modal/Drawer

**Files:**
- Create: `frontend/src/components/IpTable.jsx`
- Create: `frontend/src/components/EditIpModal.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- `IpTable`: props `{ ips, onSelectIp, onTrustMac, onRefresh }`
  - Search bar by IP, Hostname, or MAC.
  - Filter tabs: `ALL (254)`, `ONLINE`, `ROGUE DEVICES`, `MISMATCHES`, `ASSIGNED`.
  - Columns: IP Address, Admin Status, Hostname, Expected MAC, Detected MAC (Vendor), Status Badge, Last Seen, Actions.
  - If status is `ROGUE_DEVICE`, displays one-click "Approve / Trust MAC" button.
- `EditIpModal`: props `{ ip, isOpen, onClose, onSaved }`
  - Drawer/Modal to edit Hostname, Admin Status (`available`, `assigned`, `reserved`), Expected MAC, Description.

- [ ] **Step 1: Implement `IpTable.jsx`**

Table with pagination or virtual scroll, search input, status filter pills, clear responsive layout, and quick action buttons.

- [ ] **Step 2: Implement `EditIpModal.jsx`**

Accessible dialog containing form inputs with MAC format validation and quick helper to copy detected MAC if available.

- [ ] **Step 3: Wire full interaction loop in `App.jsx`**

Clicking a grid cell or table row opens `EditIpModal`. Saving refreshes state. Clicking "Approve / Trust MAC" invokes `api.trustMac(id)` and updates UI instantly.

- [ ] **Step 4: Verify build succeeds**

Run: `npm --prefix frontend run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/IpTable.jsx frontend/src/components/EditIpModal.jsx frontend/src/App.jsx
git commit -m "feat(frontend): implement IpTable with filters and EditIpModal drawer"
```

---

### Task 10: End-to-End Verification, Documentation & Cleanup

**Files:**
- Create: `README.md`
- Create: `backend/tests/test_e2e_flow.py`

- [ ] **Step 1: Write and run end-to-end integration test**

```python
# backend/tests/test_e2e_flow.py
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine

def test_full_user_story_flow():
    Base.metadata.create_all(bind=engine)
    client = TestClient(app)

    # 1. Create Subnet
    res = client.post("/api/subnets", json={
        "name": "Production LAN",
        "cidr": "192.168.100.0/24",
        "gateway": "192.168.100.1"
    })
    assert res.status_code == 201
    subnet_id = res.json()["id"]

    # 2. Trigger Scan
    scan_res = client.post(f"/api/subnets/{subnet_id}/scan")
    assert scan_res.status_code == 200

    # 3. List IPs & Check Rogue
    ips = client.get(f"/api/subnets/{subnet_id}/ips").json()
    rogues = [i for i in ips if i["reconciliation_status"] == "ROGUE_DEVICE"]
    assert len(rogues) > 0

    # 4. Quick Trust-MAC
    target = rogues[0]
    trust_res = client.post(f"/api/ips/{target['id']}/trust-mac")
    assert trust_res.status_code == 200
    assert trust_res.json()["reconciliation_status"] == "VALID_ONLINE"

    # 5. Conflict Test
    conflict_res = client.put(f"/api/ips/{target['id']}", json={
        "admin_status": "assigned",
        "expected_mac": "DE:AD:BE:EF:00:01"
    })
    assert conflict_res.status_code == 200
    assert conflict_res.json()["reconciliation_status"] == "MAC_MISMATCH"
```

- [ ] **Step 2: Run all backend tests**

Run: `uv run --directory backend pytest -v`
Expected: ALL PASS

- [ ] **Step 3: Run frontend build**

Run: `npm --prefix frontend run build`
Expected: Build passes with zero errors.

- [ ] **Step 4: Create comprehensive `README.md`**

Provide setup and launch instructions for Windows and Linux, explaining `SCAN_MODE=mock` vs `SCAN_MODE=live` (Npcap setup), API docs URL (`/docs`), and frontend dashboard.

- [ ] **Step 5: Final Commit**

```bash
git add README.md backend/tests/test_e2e_flow.py
git commit -m "docs: add README with installation guide and complete e2e test suite"
```

