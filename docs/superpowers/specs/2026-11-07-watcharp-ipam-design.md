# Design Document: WatchARP — Simple IPAM & Live ARP Scanner

## 1. Intent & Context
Network engineers and administrators in small-to-medium offices, campuses, and ISPs frequently manage static IP allocations using manual spreadsheets (Excel/Google Sheets). This introduces three critical points of operational failure:
1. **Unrecorded allocations**: Field engineers deploy equipment without updating spreadsheets.
2. **IP conflicts**: Teams assign in-use IPs thinking they are free, causing downtime for critical nodes.
3. **Rogue devices**: Unauthorized devices or misconfigured clients attach to the network undetected.

**WatchARP** solves this by unifying an IP Address Management (IPAM) inventory with an active Layer 2 ARP scanner and an automated status reconciliation engine. The system continuously compares documented administrative state against physical wire reality.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals (MVP)
- **Subnet Provisioning**: Add IPv4 `/24` subnets (254 hosts per subnet, e.g. `192.168.1.0/24`) using standard CIDR notation; automatically generate all assignable host IP rows in the database.
- **Gateway Reservation**: Automatically flag the specified gateway IP (e.g. `192.168.1.1`) as `reserved` upon subnet creation.
- **IP Inventory Management**: Edit IP metadata (admin status: `available`, `assigned`, `reserved`; hostname; description; expected MAC address).
- **On-Demand Active ARP Scanner**: Execute Layer 2 broadcast ARP sweeps on-demand via the user interface using Scapy to discover live IP/MAC pairings on the local network segment.
- **Dual Scanner Modes**:
  - `live`: Sends real raw Ethernet/ARP broadcast frames (requires administrative/Npcap privileges).
  - `mock`: Returns realistic simulated scan responses (for development, isolated Wi-Fi, or non-admin testing on Windows).
- **Vendor Identification**: Resolve MAC Organizationally Unique Identifiers (OUI) to vendor manufacturer names with local caching.
- **Deterministic Reconciliation Matrix**: Compute accurate operational statuses (`FREE`, `VALID_ONLINE`, `OFFLINE`, `ROGUE_DEVICE`, `MAC_MISMATCH`, `RESERVED`) after every scan or record update.
- **Interactive Visual IP Grid**: Render a responsive 254-cell grid (`.1` through `.254`) with distinct status colors, hover tooltips, and click-to-edit drawer/modal interactions.
- **Executive & Operational UI**: 4 summary statistic cards, filterable IP details table, modal/drawer editors, and a one-click "Trust / Quick Approve MAC" shortcut.
- **Scan History**: Log each scan run (timestamp, duration, online hosts count, anomalies count).

### Non-Goals (MVP)
- Multi-block `/22` or arbitrary CIDR sizes beyond standard `/24` (reserved for future milestone).
- Automated background polling scheduler (`APScheduler`) — scanning is strictly user-triggered on-demand to prevent write contention and router-boundary ARP timeouts.
- Cross-VLAN/Layer-3 scanning (ARP cannot traverse routers; scoped strictly to local L2 segments).
- User authentication and role-based access control (RBAC).
- Full DHCP server lease synchronizer or SNMP polling.
- Multi-node distributed agent architecture.

### Anti-Goals
- Bloated, heavyweight network monitoring suite (this is not an NMS replacement like Zabbix or Nagios).
- Blocking scan executions that freeze the backend event loop or UI responsiveness.
- Generic AI-slop visual presentation (adhering strictly to purposeful layout, high-contrast accessible states, and antislop design guidelines).

---

## 3. Approaches Considered

### Approach 1: Modular Decoupled Monorepo (FastAPI + React/Vite) — [SELECTED]
- **Structure**: Backend Python API (`FastAPI` + `SQLAlchemy` + `SQLite`) in `backend/` and Single Page Application (`React` + `Vite` + `Tailwind CSS`) in `frontend/`.
- **Trade-offs**: Requires running two processes during development (FastAPI on port 8000, Vite dev server on port 5173 with proxy).
- **Why Chosen**: Matches the PRD specification, cleanly isolates network scanning services from UI rendering, enables fast Hot Module Reloading (HMR), and allows interactive state handling (interactive grid hover, modal edit drawer, filter bars) without messy DOM manipulation.

### Approach 2: Fullstack Python Monolith (FastAPI + Jinja2 + HTMX) — [REJECTED]
- **Structure**: Single Python app rendering server-side HTML with HTMX swaps.
- **Trade-offs**: Single runtime, but managing 254 individual responsive grid cells with dynamic hover tooltips, complex instant filtering, and responsive state transitions becomes cumbersome in server templates. Deviates from the PRD requirement.

### Approach 3: Distributed Worker System (FastAPI + Celery + Redis + React) — [REJECTED]
- **Structure**: Asynchronous background workers via message queues with WebSocket streaming.
- **Trade-offs**: Substantial operational complexity on Windows local environments (requires Redis service). Unnecessary overhead for single-user local admin tool.

---

## 4. Key Architectural Decisions (Decided with Human Partner)

1. **Subnet Scope**: Constrained to standard `/24` (254 hosts per subnet) for MVP. Matches the 254-cell Visual IP Grid (`.1`–`.254`) 1-to-1 without multi-octet navigation ambiguity.
2. **Scan Trigger**: Purely on-demand via the "Scan Subnet Sekarang" button (`POST /api/subnets/{id}/scan`). Background cron/scheduler deferred to post-MVP to eliminate SQLite lock contention and false-offline timeouts on non-local subnets.
3. **Tech Stack**:
   - Backend: Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0, SQLite (WAL mode), Scapy, mac-vendor-lookup.
   - Frontend: React 18/19, Vite, Tailwind CSS, Lucide React icons.
4. **Reconciliation Rules**:
   - Comparison must normalize MAC addresses to uppercase colon-separated format (`AA:BB:CC:DD:EE:FF`).
   - If `admin_status == "reserved"` $\rightarrow$ `RESERVED`
   - If `admin_status == "available"`:
     - `is_online == False` $\rightarrow$ `FREE`
     - `is_online == True` $\rightarrow$ `ROGUE_DEVICE`
   - If `admin_status == "assigned"`:
     - `is_online == False` $\rightarrow$ `OFFLINE`
     - `is_online == True`:
       - If `expected_mac` is empty or matches `detected_mac` $\rightarrow$ `VALID_ONLINE`
       - If `expected_mac != detected_mac` $\rightarrow$ `MAC_MISMATCH`
5. **Simulation Mode**: Controlled via environment variable `SCAN_MODE=mock|live` (defaults to `mock` if Npcap/raw socket privileges are unavailable).
6. **Antislop Policy**: Mode `during` active during planning and execution.

---

## 5. System Architecture & Components

```
watcharp-project/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app, CORS, router mounting
│   │   ├── database.py          # SQLAlchemy SQLite engine (WAL mode) & session
│   │   ├── models.py            # Subnet, IpAddress, ScanHistory ORM models
│   │   ├── schemas.py           # Pydantic validation schemas
│   │   ├── routers/
│   │   │   ├── subnets.py       # CRUD subnets, scan trigger
│   │   │   └── ips.py           # Update IP, trust-mac
│   │   └── services/
│   │       ├── ip_calculator.py # CIDR expansion & reconciliation matrix
│   │       └── arp_scanner.py   # Scapy ARP sweep + mock scanner + vendor lookup
│   ├── tests/                   # Backend unit & integration tests
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx       # App bar with subnet selector & scan button
│   │   │   ├── StatCards.jsx    # 4 summary metrics cards
│   │   │   ├── IpGridMap.jsx    # 40x40px 254-cell interactive visual map
│   │   │   ├── IpTable.jsx      # Filterable, sortable host details table
│   │   │   ├── EditIpModal.jsx  # Drawer/modal for host configuration
│   │   │   └── AddSubnetModal.jsx # Subnet creation modal
│   │   ├── services/api.js      # Axios / Fetch client wrapper
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
└── README.md
```

### Database Schema (SQLite)
- `subnets`: `id` (PK), `name`, `cidr` (unique, `/24`), `gateway` (nullable), `vlan_id` (nullable), `last_scanned_at`, `created_at`.
- `ip_addresses`: `id` (PK), `subnet_id` (FK $\rightarrow$ subnets.id ON DELETE CASCADE), `ip_address`, `admin_status` (`available`|`assigned`|`reserved`), `hostname`, `description`, `expected_mac`, `detected_mac`, `vendor`, `is_online` (boolean), `last_seen_at`, `reconciliation_status` (`FREE`|`VALID_ONLINE`|`OFFLINE`|`ROGUE_DEVICE`|`MAC_MISMATCH`|`RESERVED`).
- `scan_histories`: `id` (PK), `subnet_id` (FK), `scanned_at`, `total_online`, `total_anomalies`, `duration_ms`.

### API Specifications
1. `POST /api/subnets`: Validates CIDR (enforces `/24`), creates subnet, auto-generates 254 host records, flags gateway as reserved.
2. `GET /api/subnets`: Returns subnets with computed utilization, online count, and anomaly counts.
3. `GET /api/subnets/{id}`: Returns single subnet details.
4. `DELETE /api/subnets/{id}`: Cascades deletion of subnet and its IP records.
5. `GET /api/subnets/{id}/ips`: Returns IP records for subnet, supporting optional `status` query filter.
6. `PUT /api/ips/{id}`: Updates `admin_status`, `hostname`, `expected_mac`, `description`, and immediately recalculates `reconciliation_status`.
7. `POST /api/ips/{id}/trust-mac`: Copies `detected_mac` to `expected_mac`, sets `admin_status="assigned"`, recalculates status.
8. `POST /api/subnets/{id}/scan`: Initiates ARP sweep (`live` or `mock`), updates all host statuses, creates scan history record.

---

## 6. Technical Decisions Left to the Builder (Settled)

1. **Database Resilience**: SQLite will be initialized with `PRAGMA journal_mode=WAL;` and `PRAGMA busy_timeout=5000;` to ensure snappy reads while write transactions are active.
2. **Vendor Lookup Performance**: An in-memory cache dictionary (`dict[str, str]`) will store resolved MAC OUIs so repetitive scan results do not incur look-up delays.
3. **Frontend Proxying**: Vite configuration will proxy `/api` calls directly to `http://127.0.0.1:8000` to avoid CORS issues in local development.
4. **Environment Isolation**: Backend Python dependencies will be isolated using `uv` virtualenv (`.venv`).
