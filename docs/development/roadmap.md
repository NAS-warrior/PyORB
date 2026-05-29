# PyORB Development Roadmap

## Phase 1 — Core Setup (Current)
- [x] Project structure
- [x] Database models
- [x] Configuration system
- [x] Basic web skeleton
- [ ] PostgreSQL installation & security hardening
- [ ] Alembic migrations
- [ ] User authentication (JWT)
- [ ] Vessel & tank setup UI

## Phase 2 — ORB Core
- [ ] ORB Part I entry forms (Codes A-I)
- [ ] ORB Part II entry forms (Codes A-G)
- [ ] Entry validation (MARPOL compliance checks)
- [ ] Audit log implementation
- [ ] Position recording (lat/lon)
- [ ] Port database

## Phase 3 — Reports & Exports
- [ ] PDF export (official ORB format per MEPC.312(74))
- [ ] Excel export
- [ ] CSV export
- [ ] Database backup & restore
- [ ] Report filtering (date, operator, port, fuel type)

## Phase 4 — External Integrations
- [ ] Valmarine REST API connector
- [ ] Kongsberg OPC-UA connector
- [ ] NAPA REST API connector
- [ ] Generic CSV/JSON file import
- [ ] Automatic tank level updates

## Phase 5 — Analytics & Statistics
- [ ] Interactive dashboard
- [ ] Fuel consumption charts
- [ ] Tank history visualization
- [ ] Compliance timeline
- [ ] Audit & investigation reports
- [ ] Port-based operation statistics
- [ ] Operator activity reports
- [ ] Ballast water statistics
