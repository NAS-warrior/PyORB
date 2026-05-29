# PyORB Database Design

## Overview

PyORB uses PostgreSQL. The schema and sizing differ significantly between the two
operational modes. The database is only accessible from localhost in both modes.

---

## Ship Operation Mode — Database

Single-vessel schema. Designed to run on modest onboard hardware.

### Schema

#### vessels
One record per installation (the vessel this node belongs to).

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | VARCHAR(100) | Vessel name |
| imo_number | VARCHAR(20) | IMO number — unique, used for licensing |
| mmsi | VARCHAR(20) | MMSI number |
| call_sign | VARCHAR(20) | Radio call sign |
| flag_state | VARCHAR(50) | Flag state |
| vessel_type | ENUM | See vessel types below |
| gross_tonnage | VARCHAR(20) | GT |
| deadweight | VARCHAR(20) | DWT in tonnes |
| year_built | VARCHAR(4) | Year of build |
| owner | VARCHAR(100) | Registered owner |
| operator | VARCHAR(100) | Commercial operator |
| orb_mode | ENUM | part1 or both (auto-assigned from vessel type) |
| is_active | BOOLEAN | Active flag |
| created_at | TIMESTAMP | Record creation |
| updated_at | TIMESTAMP | Last update |

**Vessel types and ORB mode assignment (per MARPOL):**

| Vessel Type | Requires Part I | Requires Part II |
|---|---|---|
| oil_tanker | Yes | Yes |
| product_tanker | Yes | Yes |
| chemical_tanker | Yes | Yes |
| oil_barge | Yes | Yes |
| bulk_carrier | Yes | No |
| general_cargo | Yes | No |
| container | Yes | No |
| passenger | Yes | No |
| other | Yes | No |

---

#### users
Crew members and shore access accounts.

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| username | VARCHAR(50) | Login username — unique |
| email | VARCHAR(100) | Email address |
| full_name | VARCHAR(100) | Full name |
| rank | VARCHAR(50) | Vessel rank |
| certificate_number | VARCHAR(50) | STCW or endorsement number |
| role | ENUM | System access role |
| hashed_password | VARCHAR(255) | bcrypt hash |
| is_active | BOOLEAN | Active flag |
| last_login | TIMESTAMP | Last login timestamp |
| created_at | TIMESTAMP | Record creation |
| updated_at | TIMESTAMP | Last update |

**Roles and permissions:**

| Role | Enter ORB | View | Export | Admin | Notes |
|---|---|---|---|---|---|
| admin | Yes | Yes | Yes | Yes | Chief Engineer or IT |
| chief_engineer | Yes | Yes | Yes | No | |
| second_engineer | Yes | Yes | No | No | |
| third_engineer | Yes | Yes | No | No | |
| officer | Yes | Yes | No | No | |
| master | No | Yes | Yes | No | Read + export |
| shore_office | No | Yes | Yes | No | Read + export |
| port_authority | No | Yes | No | No | Read only |
| viewer | No | Yes | No | No | Read only |

---

#### tanks
Vessel tank inventory.

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| vessel_id | UUID | FK → vessels |
| name | VARCHAR(100) | Tank name |
| tank_type | ENUM | fuel_oil, diesel_oil, lubricating_oil, bilge, slop, ballast, cargo, fresh_water, other |
| capacity_m3 | FLOAT | Total capacity in m³ |
| frame_from | VARCHAR(10) | Forward frame |
| frame_to | VARCHAR(10) | Aft frame |
| position | VARCHAR(20) | port, starboard, center |
| external_system_id | VARCHAR(100) | ID in Valmarine / Kongsberg / NAPA |
| is_active | BOOLEAN | Soft delete flag |
| created_at | TIMESTAMP | Record creation |
| updated_at | TIMESTAMP | Last update |

**Applicable MARPOL codes per tank type:**

| Tank Type | Part I Codes | Part II Codes |
|---|---|---|
| fuel_oil | A, B, C, H | — |
| diesel_oil | H, I | — |
| lubricating_oil | H, I | — |
| bilge | D, E, F | — |
| slop | C, E | F (tankers) |
| ballast | A, C | D, F (tankers) |
| cargo | — | A, B, C, E (tankers only) |
| fresh_water | I | — |
| other | I | — |

---

#### orb_part1_entries
ORB Part I records — Machinery Space Operations.
Reference: MARPOL Annex I Regulation 17, Resolution MEPC.312(74)

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| vessel_id | UUID | FK → vessels |
| officer_id | UUID | FK → users (responsible officer) |
| operation_code | ENUM | A, B, C, D, E, F, G, H, I |
| operation_date | TIMESTAMP | Date and time of operation |
| position_lat | FLOAT | Vessel latitude at time of operation |
| position_lon | FLOAT | Vessel longitude at time of operation |
| port_name | VARCHAR(100) | Port name if in port |
| tank_id | UUID | FK → tanks (nullable) |
| quantity_m3 | FLOAT | Quantity in m³ |
| discharge_method | ENUM | into_sea, to_reception_facility, incinerated, transferred |
| ows_rate | FLOAT | OWS throughput rate m³/h |
| oil_content_ppm | FLOAT | PPM reading from ODM |
| remarks | TEXT | Free text remarks |
| is_deleted | BOOLEAN | Soft delete only |
| created_at | TIMESTAMP | Record creation |
| updated_at | TIMESTAMP | Last update |
| created_by | UUID | FK → users (who entered the record) |

---

#### orb_part2_entries
ORB Part II records — Cargo/Ballast Operations.
Reference: MARPOL Annex I Regulations 36 & 37
Only present on tanker/barge vessel types.

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| vessel_id | UUID | FK → vessels |
| officer_id | UUID | FK → users |
| operation_code | ENUM | A, B, C, D, E, F, G |
| operation_date | TIMESTAMP | Date and time of operation |
| position_lat | FLOAT | Vessel latitude |
| position_lon | FLOAT | Vessel longitude |
| port_name | VARCHAR(100) | Port name if in port |
| tank_id | UUID | FK → tanks |
| cargo_type | VARCHAR(100) | Type of cargo (e.g. crude oil, VLSFO) |
| quantity_m3 | FLOAT | Quantity in m³ |
| remarks | TEXT | Free text remarks |
| is_deleted | BOOLEAN | Soft delete only |
| created_at | TIMESTAMP | Record creation |
| updated_at | TIMESTAMP | Last update |
| created_by | UUID | FK → users |

---

#### audit_log
Every system action is recorded here. Cannot be disabled.

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID | FK → users (nullable for system actions) |
| action | ENUM | create, update, delete, login, logout, export, import, view |
| table_name | VARCHAR(50) | Affected table |
| record_id | UUID | Affected record ID |
| old_values | JSON | Previous field values |
| new_values | JSON | New field values |
| ip_address | VARCHAR(50) | Client IP |
| user_agent | VARCHAR(200) | Browser/client info |
| description | TEXT | Human-readable description |
| timestamp | TIMESTAMP | Exact UTC time of action |

---

### Ship Mode — Hardware Requirements

| Component | Minimum | Recommended |
|---|---|---|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Storage | 20 GB SSD | 50 GB SSD |
| OS | Ubuntu 22.04+ | Ubuntu 24.04+ |
| PostgreSQL | 14+ | 18+ |
| Python | 3.11+ | 3.12+ |
| Network | LAN only | LAN + optional VPN |

---

## Superintendent Operation Mode — Database

Multi-vessel schema. Stores aggregated data from all registered ship nodes.
Significantly larger and requires more capable hardware.

### Additional Tables (Superintendent only)

#### superintendent_vessels
Registry of all ship nodes registered to this superintendent.

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| vessel_id | UUID | FK → vessels (mirrored from ship) |
| imo_number | VARCHAR(20) | IMO — used as node identifier |
| api_endpoint | VARCHAR(255) | Ship node REST API URL |
| api_key | VARCHAR(255) | Encrypted API key for authentication |
| last_sync | TIMESTAMP | Last successful data pull |
| sync_status | ENUM | online, offline, syncing, error |
| sync_interval_hours | INT | How often to pull (0 = manual only) |
| is_active | BOOLEAN | Active flag |
| registered_at | TIMESTAMP | When ship node was registered |

#### sync_log
Record of every data sync operation between superintendent and ship nodes.

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| vessel_id | UUID | FK → vessels |
| sync_started | TIMESTAMP | Start time |
| sync_completed | TIMESTAMP | Completion time |
| records_pulled | INT | Number of ORB records received |
| status | ENUM | success, partial, failed |
| error_message | TEXT | Error detail if failed |
| triggered_by | ENUM | scheduled, manual, ship_push |

---

### Superintendent Mode — Hardware Requirements

| Component | Minimum | Recommended | Notes |
|---|---|---|---|
| CPU | 8 cores | 16 cores | More vessels = more concurrent queries |
| RAM | 16 GB | 32 GB | PostgreSQL benefits from large shared_buffers |
| Storage | 200 GB SSD | 1 TB NVMe | 50-500 GB+ data depending on fleet size |
| OS | Ubuntu 22.04+ | Ubuntu 24.04 LTS | |
| PostgreSQL | 16+ | 18+ | Partitioning features needed |
| Python | 3.11+ | 3.12+ | |
| Network | 100 Mbps | 1 Gbps | Stable connection to ship nodes required |
| Backup | Daily encrypted | Continuous WAL | Critical compliance data |

### Storage Estimates

| Fleet Size | ORB Records/Year | Estimated DB Size/Year |
|---|---|---|
| 5 vessels | ~18,000 | ~2 GB |
| 20 vessels | ~72,000 | ~8 GB |
| 50 vessels | ~180,000 | ~20 GB |
| 100 vessels | ~360,000 | ~40 GB |

Audit logs add approximately 3x the raw data size.
Allow 5x headroom for indexes, backups and growth.

---

## Database Security

### Ship Mode
```sql
-- Create restricted user (no DELETE privilege)
CREATE USER pyorb_user WITH PASSWORD 'secure-password';
GRANT CONNECT ON DATABASE pyorb TO pyorb_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO pyorb_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO pyorb_user;

-- Bind to localhost only (postgresql.conf)
listen_addresses = 'localhost'
```

### Superintendent Mode
```sql
-- Same as ship mode plus read-only replication user for ship sync
CREATE USER pyorb_sync WITH PASSWORD 'sync-password';
GRANT CONNECT ON DATABASE pyorb TO pyorb_sync;
GRANT USAGE ON SCHEMA public TO pyorb_sync;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO pyorb_sync;
```

### General Rules
- No hard deletes are permitted in any table
- `is_deleted = true` is the only removal mechanism
- Every INSERT and UPDATE generates an `audit_log` entry automatically
- `audit_log` itself has no UPDATE or DELETE permissions — append only
- Database backups must be encrypted at rest
