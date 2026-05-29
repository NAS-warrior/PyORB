# PyORB Development Roadmap

## Phase 1 — Core Setup (Complete)
- [x] Project structure and FastAPI skeleton
- [x] PostgreSQL database models
- [x] Configuration system with environment variables
- [x] Documentation structure

## Phase 2 — Authentication & Setup UI (Complete)
- [x] JWT authentication
- [x] Vessel API with auto ORB mode assignment
- [x] Users API with RBAC
- [x] Tanks API
- [x] Full web UI — topbar, tabs, operations, setup, reports
- [x] Seed data — Marella Explorer 2
- [x] Audit service

## Phase 3 — ORB Operations & Exports (Next)
- [ ] Tank → operation code smart filtering (only valid codes per tank type)
- [ ] ORB Part I entry form — full submission to database
- [ ] ORB Part II entry form — tankers only
- [ ] Position recording — lat/lon from manual input or GPS
- [ ] OWS/ODM PPM recording with validation
- [ ] ORB entry list and viewing
- [ ] PDF export — official MARPOL ORB format per MEPC.312(74)
- [ ] Excel export
- [ ] CSV export
- [ ] Audit log viewer in UI
- [ ] Database backup/restore via UI

## Phase 4 — External Integrations
- [ ] Valmarine REST API connector
- [ ] Kongsberg OPC-UA connector
- [ ] NAPA REST API connector
- [ ] Generic CSV/JSON file import
- [ ] Automatic tank level updates from external systems
- [ ] GPS position auto-fill

## Phase 5 — Analytics & Statistics
- [ ] Fuel consumption charts over time
- [ ] Tank history visualization
- [ ] Operations by port
- [ ] Operations by operator
- [ ] Compliance timeline
- [ ] Ballast water statistics
- [ ] Filter by: date range, operator, port, fuel type, operation code

## Phase 6 — Superintendent Mode
- [ ] APP_MODE configuration and license validation
- [ ] Ship node registration and management
- [ ] REST sync API on ship nodes (push endpoint)
- [ ] Superintendent data pull — on demand and scheduled
- [ ] Multi-vessel dashboard
- [ ] Fleet-wide audit and investigation
- [ ] Fleet-wide reports and statistics
- [ ] Superintendent-specific user roles
- [ ] Sync log and connectivity status per vessel

## Phase 6 — Superintendent Mode & Connectivity
- [ ] APP_MODE configuration and license validation
- [ ] Ship node registration with public key enrollment
- [ ] HTTPS REST API sync (ship exposes read-only endpoint)
- [ ] Bearer token and mTLS certificate authentication
- [ ] VPN tunnel support
- [ ] SSH reverse tunnel support
- [ ] SFTP upload/download with file signature verification
- [ ] Email attachment sync (IMAP polling + GPG decrypt)
- [ ] USB/file export-import (.pyorb signed package format)
- [ ] Connection priority and automatic fallback
- [ ] Multi-vessel dashboard with sync status per ship
- [ ] Incremental sync (only new records since last sync)
- [ ] Digital signature verification on all imports
- [ ] Fleet-wide audit and investigation
- [ ] Fleet-wide statistics and compliance reporting
- [ ] Sync log and connectivity status UI
- [ ] Bandwidth estimates and satellite-optimized compression
