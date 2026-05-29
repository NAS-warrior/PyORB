# Phase 3 Feature Specification

## 1. Combined Dashboard & Operations Panel

The Dashboard and Operations tabs are merged into a single panel:

### Layout
```
┌─────────────────────────────────────────────────────────────────┐
│ LEFT COLUMN (tanks)          │ RIGHT COLUMN (sticky)            │
│                              │                                   │
│ [Tank filter dropdown]       │ [No tank selected]                │
│                              │  → "Select a tank to begin"      │
│ HEAVY FUEL OIL               │                                   │
│ [gauge][gauge][gauge]...     │ When tank selected:               │
│                              │  ┌─────────────────────────────┐ │
│ DIESEL / MGO                 │  │ Tank Name — Type — Capacity  │ │
│ [gauge][gauge]               │  │ [Capacity graph — 30 days]   │ │
│                              │  │ [Last 10 operations table]   │ │
│ BILGE                        │  │ ─────────────────────────── │ │
│ [gauge][gauge]               │  │ RECORD OPERATION             │ │
│                              │  │ [Code A][Code B]... (valid)  │ │
│ ...                          │  │ [Entry form when code picked] │ │
│                              │  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Tank Capacity Graph
- Line/area chart showing tank volume over last 30 days (configurable)
- X-axis: date, Y-axis: volume in m³ and %
- Shows each operation as a point on the line
- Color-coded by operation type
- Built with Chart.js

### Last N Operations per Tank
- Configurable: 10 / 20 / 50 entries
- Columns: Date, Code, Operation, Quantity, Officer, Position
- Click row to view full entry details

---

## 2. Reports — Advanced Filtering & Output

### Filter Fields
Any combination of:
- Date range (from / to)
- Operation code (A, B, C... multi-select)
- Tank (multi-select)
- Tank type (multi-select)
- Officer / operator (multi-select)
- Port name (text search)
- Quantity range (min / max m³)
- Position (radius from lat/lon)
- ORB part (Part I / Part II / Both)
- Entry status (normal / flagged / deleted)

### Output Formats

| Format | Description |
|---|---|
| Print / Preview | Official ORB page layout per MEPC.312(74) — browser print |
| PDF | Official ORB format, downloadable |
| Excel (.xlsx) | Formatted spreadsheet with headers, filters, totals |
| CSV | Raw data export, UTF-8 |
| JSON | Structured data export |
| XML | MARPOL-compatible XML schema |

---

## 3. Tools Tab

### Scheduled Tasks
- Email daily report to defined recipients
- Email scheduled report (configurable interval)
- Auto-export to file (CSV/JSON/XML) on schedule
- Push data to DORB-Control superintendent node
- Notification on specific events (forbidden ops, alarms)

### Database Backup
- Manual backup trigger
- Scheduled backup (daily/weekly)
- Encrypted backup download (.sql.gz.enc)
- Restore from backup file
- Backup history log

### Data Import/Export
- Import from: DB dump, CSV, JSON, XML
- Export to: DB dump, CSV, JSON, XML
- Import validation — reject invalid or tampered data
- Import log with record counts

### GPS Configuration
- Define GPS data source (NMEA feed, API endpoint, manual)
- NMEA serial port settings (COM port, baud rate)
- API endpoint for GPS (e.g. ship's AIS/ECDIS integration)
- Test GPS connection
- Last known position display

### Email Configuration
- SMTP server settings
- Recipient lists:
  - Daily report recipients
  - Scheduled report recipients
  - Event alert recipients (forbidden ops, alarms, environmental warnings)
- Test email send

---

## 4. Input & Operation Validation

### Tank Volume Rules
- Cannot add more than available capacity (capacity - current volume)
- Cannot remove more than current volume
- Warning at configurable par level (e.g. alert when bilge > 80%)
- Error shown inline in the entry form before submission
- All violations logged to audit

### Operation Rules
- Only valid codes shown per tank type (already implemented)
- Cannot record overboard discharge in port (Code E) without OWS PPM reading
- Cannot record bunkering (Code H) without quantity
- Cannot record Code G (accidental) without remarks
- Duplicate entry detection (same code, same tank, within 1 hour)
- All rule violations logged

### Audit Database Rules
- Separate audit database: `pyorb_audit`
- Append-only: no UPDATE or DELETE permitted
- Each record has a SHA-256 hash of its content
- Hash chain: each record includes hash of previous record
- Tamper detection: system verifies chain integrity on demand
- Unique constraint: (vessel_id, table_name, record_id, action, timestamp)

---

## 5. GPS & Position

### GPS Sources (priority order)
1. NMEA 0183 serial feed (onboard GPS/ECDIS)
2. AIS transponder API
3. HTTP API endpoint (configurable)
4. Google Maps picker (manual, when no GPS)
5. Manual lat/lon text input

### Ship Status Detection
Derived from speed and position data:
- **En route** — speed > 3 knots, open sea
- **Approaching port** — within 5nm of known port, reducing speed
- **At anchor** — speed < 0.5 knots, not at berth
- **In port / at berth** — within port boundary, speed ~0
- **Maneuvering** — speed 0.5–3 knots, near port

Status shown in topbar next to vessel name.

### Environmental Zone Warning
- MARPOL Special Areas: Mediterranean, Baltic, North Sea, Antarctic, etc.
- ECA zones (Emission Control Areas)
- When ship is in a special area:
  - Warning banner shown at top
  - Certain discharge operations blocked (Code C, E overboard)
  - User must confirm awareness before proceeding

### Google Maps Location Picker
- Opens map modal when no GPS available
- User clicks map to set position
- Reverse geocoding to detect nearest port
- Coordinates auto-filled in entry form

---

## 6. Email Notification System

### Recipient Groups

| Group | Trigger | Content |
|---|---|---|
| daily_report | End of day (configurable time) | All operations from that day |
| scheduled_report | Configurable interval | Operations for the period |
| event_alert | Specific events | Event details + entry |
| alarm | Par level breached | Tank name, current level, threshold |
| forbidden_op | Blocked operation attempted | User, tank, operation, reason |
| environmental | Operation in special area | Position, operation, zone |
| audit_summary | Weekly | Audit integrity report |

### Email Content
- DORB branded HTML email
- Summary table of operations
- Attached PDF for daily/scheduled reports
- Position map link (Google Maps)
- Digital signature for authenticity

---

## Implementation Plan

### Phase 3A — Core Operations (immediate)
- Combined dashboard + operations panel
- Tank capacity graph (Chart.js)
- ORB entry submission to database
- Tank volume tracking (current volume field)
- Input validation (capacity rules)

### Phase 3B — Reports
- Filter UI with all fields
- PDF export (ReportLab — official ORB format)
- Excel export (OpenPyXL — formatted)
- CSV / JSON / XML export

### Phase 3C — Tools & Automation
- GPS configuration and NMEA integration
- Google Maps location picker
- Ship status detection
- Environmental zone warnings
- Email system (SMTP + recipient groups)
- Scheduled tasks (APScheduler)
- Database backup UI

### Phase 3D — Audit & Security
- Separate audit database with hash chain
- Tamper detection
- Par level alarms
- Forbidden operation blocking
- Duplicate detection
