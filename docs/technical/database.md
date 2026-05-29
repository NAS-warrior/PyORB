# PyORB Database Design

## Overview

PyORB uses PostgreSQL 14+. The database is accessible only from localhost.

## Core Tables

### vessels
Stores vessel particulars required for ORB records.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(100) | Vessel name |
| imo_number | VARCHAR(20) | IMO number (unique) |
| flag_state | VARCHAR(50) | Flag state |
| vessel_type | ENUM | Type of vessel |
| orb_mode | ENUM | Part I, Part II, or Both |

### users
Crew members and their system roles.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| username | VARCHAR(50) | Login username |
| full_name | VARCHAR(100) | Full name |
| rank | VARCHAR(50) | Vessel rank |
| role | ENUM | System access role |

### tanks
Vessel tank inventory and specifications.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| vessel_id | UUID | Foreign key to vessels |
| name | VARCHAR(100) | Tank name |
| tank_type | ENUM | Type of tank |
| capacity_m3 | FLOAT | Total capacity in m3 |
| external_system_id | VARCHAR(100) | ID in Valmarine/Kongsberg/NAPA |

### orb_part1_entries
ORB Part I records - Machinery Space Operations.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| vessel_id | UUID | Foreign key to vessels |
| officer_id | UUID | Responsible officer |
| operation_code | ENUM | MARPOL code A through I |
| operation_date | TIMESTAMP | Date and time of operation |
| quantity_m3 | FLOAT | Quantity in m3 |
| oil_content_ppm | FLOAT | PPM reading |

### orb_part2_entries
ORB Part II records - Cargo/Ballast Operations.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| vessel_id | UUID | Foreign key to vessels |
| officer_id | UUID | Responsible officer |
| operation_code | ENUM | MARPOL code A through G |
| operation_date | TIMESTAMP | Date and time of operation |
| cargo_type | VARCHAR(100) | Type of cargo |
| quantity_m3 | FLOAT | Quantity in m3 |

### audit_log
Complete audit trail of every system action.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | User who performed action |
| action | ENUM | create/update/delete/login etc. |
| table_name | VARCHAR(50) | Affected table |
| old_values | JSON | Previous values |
| new_values | JSON | New values |
| timestamp | TIMESTAMP | Exact time of action |

## Database Security

```sql
CREATE USER pyorb_user WITH PASSWORD 'secure-password';
GRANT CONNECT ON DATABASE pyorb TO pyorb_user;
GRANT USAGE ON SCHEMA public TO pyorb_user;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO pyorb_user;
REVOKE DELETE ON ALL TABLES IN SCHEMA public FROM pyorb_user;
```
