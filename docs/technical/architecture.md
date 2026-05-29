# PyORB System Architecture

## Overview

PyORB is a web-based Oil Record Book (ORB) management system built with Python and
PostgreSQL, compliant with MARPOL Annex I. It operates in one of two exclusive modes
set at installation time and controlled by license key.

---

## Operational Modes

PyORB runs in exactly one mode. The mode is set during initial configuration and
cannot be changed without reinstallation and a valid license for the target mode.

### Ship Operation Mode

Designed to run onboard a single vessel on local hardware (LXC container, VM, or
dedicated server). Officers enter ORB operations directly. Data is stored locally
and optionally synchronized to a Superintendent node when connectivity is available.

**Characteristics:**
- Single vessel database
- Local network access only (no public internet required)
- Officers and engineers enter ORB records in real time
- Receives automatic tank data from Valmarine, Kongsberg, NAPA
- Can push/sync data to a Superintendent node on demand or on schedule
- Lightweight hardware requirements

**Users:**
- Admin (Chief Engineer or IT)
- Chief Engineer
- Second / Third Engineer
- Officer / Master (read + export only)

---

### Superintendent Operation Mode

Designed for shore office or fleet management centers. Connects to multiple ship
nodes, pulls their ORB data, and provides a read-only fleet-wide dashboard with
full audit, reporting and statistical capabilities.

**Characteristics:**
- Multi-vessel database (one schema per vessel or partitioned)
- Connects to ship nodes via REST API over VPN or internet
- Read-only — cannot create, modify or delete ORB entries on any ship node
- Aggregates data from all registered ship nodes
- Provides fleet-wide audit, statistics and compliance reporting
- Higher hardware and storage requirements
- Requires stable network connectivity or scheduled sync jobs

**Users:**
- Superintendent Admin
- Fleet Manager (read + export)
- Port Authority (read-only, single vessel)
- Auditor (read-only, time-limited access)

---

## Mode Selection & Licensing

| Item | Ship Mode | Superintendent Mode |
|---|---|---|
| License type | Per vessel (IMO-locked) | Per fleet (company-locked) |
| Set in | `.env` → `APP_MODE=ship` | `.env` → `APP_MODE=superintendent` |
| Changeable at runtime | No | No |
| DB size (typical) | 1–5 GB | 50–500 GB+ |
| Vessels supported | 1 | Unlimited (by license) |
| ORB entry creation | Yes | No |
| Audit & investigation | Own vessel only | All registered vessels |
| Sync direction | Push to superintendent | Pull from ship nodes |

---

## System Diagram

```
┌──────────────────────────────────────────────────┐
│  SHIP NODE (Ship Operation Mode)                 │
│                                                  │
│  ┌─────────────┐   ┌──────────────┐             │
│  │  FastAPI    │←──│  Web UI      │ Officers    │
│  │  App        │   │  (browser)   │             │
│  └──────┬──────┘   └──────────────┘             │
│         │                                        │
│  ┌──────▼──────┐   ┌──────────────┐             │
│  │ PostgreSQL  │   │ External sys │             │
│  │ (local)     │   │ Valmarine    │             │
│  └─────────────┘   │ Kongsberg    │             │
│                     │ NAPA         │             │
│                     └──────────────┘             │
└─────────────────────────┬────────────────────────┘
                          │ REST API sync (VPN/internet)
                          │ Push on demand or scheduled
                          ▼
┌──────────────────────────────────────────────────┐
│  SUPERINTENDENT NODE (Superintendent Mode)       │
│                                                  │
│  ┌─────────────┐   ┌──────────────────────────┐ │
│  │  FastAPI    │←──│  Fleet Dashboard (UI)    │ │
│  │  App        │   │  Multi-vessel view       │ │
│  └──────┬──────┘   └──────────────────────────┘ │
│         │                                        │
│  ┌──────▼──────────────────┐                    │
│  │ PostgreSQL (large)      │                    │
│  │ Multi-vessel partitions │                    │
│  │ Aggregated ORB records  │                    │
│  │ Fleet audit log         │                    │
│  └─────────────────────────┘                    │
└──────────────────────────────────────────────────┘
```

---

## Tech Stack

| Component | Technology | Version |
|---|---|---|
| Backend | FastAPI | 0.111+ |
| Database | PostgreSQL | 14+ (ship) / 16+ (superintendent) |
| ORM | SQLAlchemy | 2.0 |
| Migrations | Alembic | 1.13 |
| Frontend | HTML / CSS / JS | — |
| Auth | JWT (python-jose) | 3.3 |
| PDF Export | ReportLab | 4.2 |
| Excel Export | OpenPyXL | 3.1 |
| Data Analysis | Pandas | 2.0+ |
| Documentation | MkDocs Material | 9.5 |

---

## Security Architecture

- PostgreSQL bound to `localhost` only — no external DB port exposed
- All API access requires JWT authentication
- Role-based access control (RBAC) — see roles per mode above
- Every write operation logged to `audit_log` with old/new values
- Passwords hashed with bcrypt
- Superintendent connections to ship nodes use API key + HTTPS
- Ship nodes whitelist superintendent IP addresses
- No hard deletes — soft delete only with full audit trail
