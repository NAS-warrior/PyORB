# Operational Modes

## Overview

PyORB operates in one of two exclusive modes. The mode is determined at installation
time by the license key and the `APP_MODE` setting in `.env`. It cannot be changed
at runtime. Switching modes requires reinstallation with a new license.

---

## Setting the Mode

In `.env`:
```
# Ship operation mode (single vessel)
APP_MODE=ship
APP_LICENSE_KEY=SHIP-IMO-9072446-XXXX-XXXX

# OR Superintendent mode (fleet management)
APP_MODE=superintendent
APP_LICENSE_KEY=SUPER-FLEET-COMPANY-XXXX-XXXX
```

The application validates the license key against the mode on every startup.
If the license does not match the mode, the application refuses to start.

---

## Ship Operation Mode

### Purpose
Run onboard a single vessel. Officers and engineers enter ORB records in real time.

### What it does
- Vessel, tank and user setup
- ORB Part I entry (all vessel types)
- ORB Part II entry (tankers and oil barges only — auto-detected from vessel type)
- Tank status dashboard with graphical gauges
- Automatic tank data input from Valmarine, Kongsberg, NAPA
- Full audit log of every operation
- PDF, Excel and CSV export
- Optional data push to a Superintendent node

### What it does NOT do
- Does not manage multiple vessels
- Does not connect to other ship nodes
- Does not aggregate fleet-wide data

### ORB Mode Auto-Assignment
The ORB operational mode (Part I only vs Part I + Part II) is automatically
determined from the vessel type during vessel setup. Officers do not select it
manually. This prevents incorrect mode selection.

| Vessel Type | ORB Mode | Reason |
|---|---|---|
| Oil tanker | Part I + II | MARPOL Annex I Reg. 36 |
| Product tanker | Part I + II | MARPOL Annex I Reg. 36 |
| Chemical tanker | Part I + II | MARPOL Annex I Reg. 36 |
| Oil barge | Part I + II | MARPOL Annex I Reg. 36 |
| Bulk carrier | Part I only | Non-tanker |
| General cargo | Part I only | Non-tanker |
| Container | Part I only | Non-tanker |
| Passenger | Part I only | Non-tanker |
| Other | Part I only | Non-tanker |

### Tank → Operation Code Mapping
When an officer selects a tank, only the MARPOL codes applicable to that
tank type are shown. This prevents recording incorrect operation codes.

| Tank Type | Part I Codes Available | Part II Codes Available |
|---|---|---|
| Fuel oil | A, B, C, H | — |
| Diesel / MGO | H, I | — |
| Lubricating oil | H, I | — |
| Bilge | D, E, F | — |
| Slop | C, E | F (tankers) |
| Ballast | A, C | D, F (tankers) |
| Cargo | — | A, B, C, E (tankers only) |
| Fresh water | I | — |

---

## Superintendent Operation Mode

### Purpose
Run at a shore office or fleet management center. Aggregates ORB data from
multiple vessel nodes for auditing, reporting and compliance monitoring.

### What it does
- Multi-vessel fleet dashboard
- Register and manage ship node connections
- Pull ORB data from registered ship nodes (on demand or scheduled)
- Full audit and investigation across all vessels
- Fleet-wide statistics (fuel consumption, operations by port, operator activity)
- PDF export in official ORB format per vessel
- Excel and CSV export
- Time-period, operator, port, fuel-type, ballast filtering

### What it does NOT do
- Cannot create ORB entries on any ship node (read-only)
- Cannot modify or delete any record on any ship node
- Cannot change vessel, tank or user configuration on ship nodes
- Is not involved in day-to-day operations onboard

### Data Synchronization
Ship nodes push data to the superintendent node when:
1. **Manual trigger** — superintendent pulls on demand via UI
2. **Scheduled sync** — configurable interval (e.g. every 6 hours via satellite)
3. **Port arrival** — ship node detects connectivity and pushes automatically

Sync is one-directional: ship → superintendent. The superintendent never
writes back to the ship node database.

### Fleet Dashboard
The superintendent dashboard shows all registered vessels with:
- Last sync timestamp and status (online / offline / syncing)
- Total ORB entries per vessel
- Latest ORB entry date
- Any entries flagged during audit review
- Quick access to individual vessel ORB records

---

## Licensing

### Ship Mode License
- Locked to a specific vessel by IMO number
- One license per vessel
- License embedded in `.env` as `APP_LICENSE_KEY`
- Validated against the vessel's IMO number on startup

### Superintendent Mode License
- Locked to a company or fleet operator
- Allows unlimited vessel registrations (or capped by license tier)
- Higher hardware requirements
- Annual renewal recommended

### License Tiers (Planned)

| Tier | Mode | Vessels | Support |
|---|---|---|---|
| Ship Basic | Ship | 1 | Community |
| Ship Pro | Ship | 1 | Email |
| Fleet Starter | Superintendent | Up to 10 | Email |
| Fleet Pro | Superintendent | Up to 50 | Priority |
| Fleet Enterprise | Superintendent | Unlimited | Dedicated |
