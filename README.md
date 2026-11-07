# WatchARP

A lightweight IP Address Management (IPAM) web application with an integrated on-demand ARP scanner and deterministic status reconciliation engine for `/24` IPv4 subnets.

WatchARP bridges the gap between planned IP allocations and actual physical network state. By comparing administrative documentation against Layer 2 ARP sweep results, it flags rogue devices, detects IP/MAC mismatches, and tracks active hosts in real time.

---

## Architecture & Tech Stack

WatchARP is structured as a decoupled monorepo:

```
IPAM/
├── backend/                  # FastAPI REST API & ARP Scanner Engine
│   ├── app/
│   │   ├── routers/          # Subnets and IPs endpoints
│   │   ├── services/         # CIDR calculator, OUI lookup, Scapy & mock ARP scanner
│   │   ├── database.py       # SQLite engine with WAL mode & foreign keys
│   │   ├── models.py         # SQLAlchemy ORM models (Subnet, IpAddress, ScanHistory)
│   │   └── schemas.py        # Pydantic v2 validation models
│   ├── tests/                # Pytest unit, API, and E2E integration test suite
│   ├── requirements.txt
│   └── pytest.ini
├── frontend/                 # React SPA (Vite + Tailwind CSS)
│   ├── src/
│   │   ├── components/       # Header, StatCards, IpGridMap, IpTable, EditModal, AddModal
│   │   ├── services/         # API client module
│   │   ├── App.jsx           # Main state orchestrator
│   │   └── index.css         # Tailwind directives
│   └── package.json
└── README.md
```

### Technology Highlights
- **Backend**: Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0, SQLite (WAL mode, busy timeout 5000ms), Scapy, `mac-vendor-lookup` with an in-memory OUI cache.
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide React icons.
- **Network Scope**: Constrained to `/24` subnets (254 host IPs per subnet) for predictable 1:1 mapping with the visual IP grid map (`.1` through `.254`).

---

## Status Reconciliation Matrix

The core reconciliation engine runs deterministically whenever an IP record is modified or when an ARP scan completes:

| Admin Status | Online (`is_online`) | MAC Match (`expected_mac` vs `detected_mac`) | Reconciliation Status | UI Color / Badge | Operational Meaning |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `reserved` | Any | Any | `RESERVED` | Indigo / Purple (`bg-indigo-600`) | Network gateway or infrastructure reservation. |
| `available` | `False` | N/A | `FREE` | Dark Slate (`bg-slate-900`) | Unallocated IP address, clean and available for assignment. |
| `available` | `True` | N/A | `ROGUE_DEVICE` | Amber (`bg-amber-500`) | **Anomaly**: Unregistered device active on the wire. |
| `assigned` | `False` | N/A | `OFFLINE` | Muted Slate (`bg-slate-800`) | Known asset configured in inventory, currently powered off or disconnected. |
| `assigned` | `True` | Matches (or `expected_mac` is unset) | `VALID_ONLINE` | Emerald Green (`bg-emerald-600`) | **Normal State**: Documented device active with verified MAC identity. |
| `assigned` | `True` | Does not match | `MAC_MISMATCH` | Pulsing Rose / Red (`bg-rose-600`) | **Critical Anomaly**: IP conflict or unauthorized hardware change. |

---

## Prerequisites

- **Python**: 3.12 or later (with `pip` or `uv`)
- **Node.js**: 20 or later and `npm`
- **Packet Driver Requirements**:
  - **`SCAN_MODE=mock` (Default)**: No special drivers, elevated privileges, or root permissions required. Runs out of the box on Windows, macOS, and Linux.
  - **`SCAN_MODE=live` (Windows)**: Requires [Npcap](https://npcap.com/) installed with "Install Npcap in WinPcap API-compatible Mode" enabled, and PowerShell/Terminal running as Administrator.
  - **`SCAN_MODE=live` (Linux)**: Requires `libpcap-dev` installed (`sudo apt install libpcap-dev`) and raw socket capabilities (`sudo setcap cap_net_raw,cap_net_admin=eip $(which python3)` or running via `sudo`).

---

## Step-by-Step Setup & Running

### 1. Backend Setup

From the repository root directory:

#### Create and activate virtual environment
- **Windows (PowerShell)**:
  ```powershell
  python -m venv backend/.venv
  & backend/.venv/Scripts/Activate.ps1
  ```
- **Linux / macOS**:
  ```bash
  python3 -m venv backend/.venv
  source backend/.venv/bin/activate
  ```

#### Install dependencies
```bash
pip install -r backend/requirements.txt
```

#### Configure Environment
Copy the example environment configuration:
```bash
# Windows
copy backend\.env.example backend\.env

# Linux / macOS
cp backend/.env.example backend/.env
```

Contents of `backend/.env`:
```env
DATABASE_URL=sqlite:///./ipam.db
SCAN_MODE=mock
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
```

#### Start the Backend API
Run the backend server using Uvicorn:
- **Windows**:
  ```powershell
  & backend/.venv/Scripts/uvicorn.exe app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
  ```
- **Linux / macOS**:
  ```bash
  uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
  ```

The API will be available at `http://127.0.0.1:8000`.

---

### 2. Frontend Setup

In a new terminal window:

#### Install dependencies
```bash
npm --prefix frontend install
```

#### Start Development Server
```bash
npm --prefix frontend run dev
```

Open your browser at `http://localhost:5173`. The Vite development server automatically proxies `/api` calls to `http://127.0.0.1:8000`.

#### Build for Production
To create an optimized production build:
```bash
npm --prefix frontend run build
```
The compiled assets will be placed in `frontend/dist/`.

---

## Scanner Modes: Mock vs Live

The scan mode is controlled via the `SCAN_MODE` environment variable in `backend/.env`:

### `SCAN_MODE=mock` (Default)
- **Use case**: Local development, CI/CD automated test runs, and environments without network interface access.
- **Behavior**: Emulates deterministic Layer 2 ARP responses across the subnet CIDR. Generates active host samples representing typical enterprise networks (e.g. Cisco gateway, Espressif IoT nodes, Ubiquiti access points, Apple workstations, and Intel PCs).
- **Permissions**: Standard non-root user permissions.

### `SCAN_MODE=live`
- **Use case**: Production deployments and local physical network scanning.
- **Behavior**: Scapy constructs and transmits Ethernet Layer 2 broadcast ARP requests (`ff:ff:ff:ff:ff:ff`) across the `/24` subnet. Listens for unicast ARP replies to collect responsive IP addresses and MAC hardware addresses.
- **Resilience**: If live packet capture encounters permission errors or missing drivers, WatchARP logs a warning and falls back to mock results rather than crashing.

---

## API Documentation

FastAPI provides interactive OpenAPI documentation out of the box:

- **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

### Primary Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/subnets` | Creates a new `/24` subnet and automatically generates all 254 host records (`.1`–`.254`). |
| `GET` | `/api/subnets` | Lists all subnets with calculated metrics (utilization, total, online, rogue, mismatch). |
| `GET` | `/api/subnets/{id}` | Retrieves detailed metadata for a single subnet. |
| `DELETE` | `/api/subnets/{id}` | Deletes a subnet and cascades deletion to all associated IP records. |
| `GET` | `/api/subnets/{id}/ips` | Retrieves all 254 IP records for a subnet (optional query: `?status=ROGUE_DEVICE`). |
| `PUT` | `/api/ips/{id}` | Updates administrative allocation, hostname, description, and expected MAC. |
| `POST` | `/api/ips/{id}/trust-mac` | Adopts detected MAC as expected MAC and transitions status to `assigned` (`VALID_ONLINE`). |
| `POST` | `/api/subnets/{id}/scan` | Triggers an on-demand ARP sweep (`mock` or `live`) and reconciles all host statuses. |

---

## Running the Test Suites

### Backend Tests
The backend test suite covers models, CIDR validation, status reconciliation matrix logic, ARP scanning, API routes, concurrency locking, and end-to-end integration flows.

- **Windows (PowerShell)**:
  ```powershell
  & backend/.venv/Scripts/pytest.exe -c backend/pytest.ini -v
  ```
- **Linux / macOS**:
  ```bash
  pytest -c backend/pytest.ini -v
  ```

### Frontend Tests
The frontend test suite verifies the API service client and React component rendering structures:
```bash
npm --prefix frontend test
```

### Full Verification
To run all tests and verify the production build in one go:
```bash
# Backend tests
& backend/.venv/Scripts/pytest.exe -c backend/pytest.ini -v

# Frontend tests & build
npm --prefix frontend test
npm --prefix frontend run build
```
