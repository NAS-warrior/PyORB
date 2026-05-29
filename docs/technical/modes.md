# Operational Modes — DORB-Ship & DORB-Control

## Overview

PyORB operates in one of two modes at any given time:

- **DORB-Ship** — single vessel onboard operation
- **DORB-Control** — superintendent fleet management

Each mode uses its own **completely separate database**. The two databases share
the same schema but contain independent data. Switching modes connects to a
different database — it does not affect or migrate data from the other.

The active mode is shown in the top bar of the application at all times.

---

## Mode Switching

### Who Can Switch
Only users with the **Admin** role can switch modes.
A valid license key for the target mode is required.

### How to Switch
1. Log in as Admin
2. Click **Switch Mode** in the top bar
3. Enter the license key for the target mode
4. Confirm — the application reconnects to the target database and reloads

### What Happens During a Switch
- The application disconnects from the current database
- Connects to the target mode database (must be configured in `.env`)
- The current mode's data remains untouched
- The page reloads and the top bar updates to show the new mode
- All subsequent operations run against the new mode's database

### What Does NOT Happen
- No data is migrated between databases
- No data is deleted
- The `.env` `APP_MODE` setting does not change at runtime (only the
  in-memory active mode changes). To persist across restarts, update `.env`

---

## DORB-Ship

### Purpose
Run onboard a single vessel. Officers and engineers enter ORB records in real time.

### Database
`pyorb_ship` — configured via `SHIP_DB_*` settings in `.env`

### Capabilities
- Single vessel configuration (vessel, tanks, users)
- ORB Part I entry — all vessel types — Codes A through I
- ORB Part II entry — oil tankers and barges only — Codes A through G
- ORB mode auto-assigned from vessel type (no manual selection)
- Tank → operation code smart filtering per MARPOL
- Tank status dashboard with graphical gauges
- Automatic tank data from Valmarine, Kongsberg, NAPA
- Full audit log of every operation
- PDF, Excel and CSV export
- Data sync to DORB-Control (push on demand or scheduled)

### ORB Mode Auto-Assignment
The ORB operational mode is automatically determined from vessel type.

| Vessel Type | ORB Mode | MARPOL Reference |
|---|---|---|
| Oil tanker | Part I + Part II | Annex I Reg. 36 |
| Product tanker | Part I + Part II | Annex I Reg. 36 |
| Chemical tanker | Part I + Part II | Annex I Reg. 36 |
| Oil barge | Part I + Part II | Annex I Reg. 36 |
| Bulk carrier | Part I only | Non-tanker |
| General cargo | Part I only | Non-tanker |
| Container | Part I only | Non-tanker |
| Passenger | Part I only | Non-tanker |
| Other | Part I only | Non-tanker |

### Tank → Operation Code Mapping
Only valid MARPOL codes for the selected tank type are shown.

| Tank Type | Part I | Part II |
|---|---|---|
| Fuel oil | A, B, C, H | — |
| Diesel / MGO | H, I | — |
| Lubricating oil | H, I | — |
| Bilge | D, E, F | — |
| Slop | C, E | F (tankers) |
| Ballast | A, C | D, F (tankers) |
| Cargo | — | A, B, C, E (tankers) |
| Fresh water | I | — |

### License Key Format
```
SHIP-{IMO}-{XXXX}-{XXXX}
Example: SHIP-9072446-A1B2-C3D4
```

### Hardware Requirements
| Component | Minimum | Recommended |
|---|---|---|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Storage | 20 GB SSD | 50 GB SSD |
| Network | LAN only | LAN + optional VPN |

---

## DORB-Control

### Purpose
Shore office or fleet management center. Aggregates ORB data from multiple
vessel nodes. Full audit, reporting and compliance across the fleet.

### Database
`pyorb_control` — configured via `CONTROL_DB_*` settings in `.env`
Significantly larger — see hardware requirements below.

### Capabilities
- Multi-vessel fleet dashboard
- Register and manage ship node connections
- Pull ORB data from ship nodes (6 connection methods — see Connectivity)
- Read-only — cannot create, modify or delete ORB entries on any ship node
- Full audit and investigation across all vessels
- Fleet-wide statistics (fuel, operations, ports, operators)
- PDF export in official ORB format per vessel
- Excel and CSV export
- Filtering by date, operator, port, fuel type, operation code
- Sync log and connection status per vessel

### Connection Methods to Ship Nodes
All methods are one-directional (ship → superintendent). See
[Connectivity](connectivity.md) for full details.

1. HTTPS REST API (recommended)
2. VPN tunnel
3. SSH reverse tunnel
4. SFTP file transfer
5. Email attachment (satellite-compatible)
6. USB / physical file import

### License Key Format
```
CTRL-{COMPANY}-{XXXX}-{XXXX}
Example: CTRL-TUIFLEET-E5F6-G7H8
```

### Hardware Requirements
| Component | Minimum | Recommended |
|---|---|---|
| CPU | 8 cores | 16 cores |
| RAM | 16 GB | 32 GB |
| Storage | 200 GB SSD | 1 TB NVMe |
| Network | 100 Mbps | 1 Gbps stable |
| PostgreSQL | 16+ | 18+ |
| Backup | Daily encrypted | Continuous WAL |

### Storage Estimates
| Fleet Size | ORB Records/Year | DB Size/Year |
|---|---|---|
| 5 vessels | ~18,000 | ~2 GB |
| 20 vessels | ~72,000 | ~8 GB |
| 50 vessels | ~180,000 | ~20 GB |
| 100 vessels | ~360,000 | ~40 GB |

Audit logs add ~3× the raw data. Allow 5× headroom for indexes and growth.

---

## Environment Configuration

Both databases must be configured in `.env` even if only one mode is used.
The unused database connection is initialized but not actively queried.

```env
# Active mode at startup
APP_MODE=ship

# License keys
LICENSE_SHIP=SHIP-9072446-A1B2-C3D4
LICENSE_CONTROL=CTRL-TUIFLEET-E5F6-G7H8

# DORB-Ship database
SHIP_DB_NAME=pyorb_ship
SHIP_DB_USER=pyorb_ship_user
SHIP_DB_PASSWORD=secure-password

# DORB-Control database
CONTROL_DB_NAME=pyorb_control
CONTROL_DB_USER=pyorb_control_user
CONTROL_DB_PASSWORD=secure-password
```

---

## Licensing Tiers (Planned)

| License | Mode | Vessels | Description |
|---|---|---|---|
| SHIP-BASIC | DORB-Ship | 1 | Single vessel, community support |
| SHIP-PRO | DORB-Ship | 1 | Single vessel, email support |
| CTRL-STARTER | DORB-Control | Up to 10 | Small fleet |
| CTRL-PRO | DORB-Control | Up to 50 | Medium fleet |
| CTRL-ENTERPRISE | DORB-Control | Unlimited | Large fleet, dedicated support |
| DUAL | Both | 1 ship + fleet | Ship + Control on same installation |
