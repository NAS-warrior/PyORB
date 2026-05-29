# Changelog

## [Unreleased] — Phase 3
- ORB Part I entry submission (API + DB)
- ORB Part II entry submission (tankers only)
- Tank → operation code smart filtering
- PDF export in official MARPOL ORB format
- Excel and CSV export
- Audit log viewer in UI
- Superintendent mode foundation

## [2.0.0] — Phase 2 — Complete

### Added
- JWT authentication system
- Auth API: POST /api/auth/token, GET /api/auth/me
- Vessel API: GET, POST, PUT — ORB mode auto-assigned from vessel type
- Users API: list, create, update, change password
- Tanks API: list, create, update, soft-delete
- Role-based access control on all endpoints
- Audit service — every action logged with old/new values
- Auth service — bcrypt password hashing, JWT token generation
- Setup service — creates initial admin user on first run
- Full web UI — sticky topbar, 5-tab layout (Dashboard, Operations, Setup, Reports, Audit)
- Operations tab — MARPOL code selector, tank gauges, entry form
- Operations tab — Part II hidden automatically for non-tanker vessel types
- Tank gauges grouped by type with fill level indicators
- Setup tab — vessel, users, tanks in sub-sections
- Alembic migration configuration
- Seed data script — Marella Explorer 2 (IMO 9072446) with 32 tanks and 6 users

### Fixed
- Jinja2 cache bug with Python 3.14 — switched to FileResponse
- bcrypt 72-byte password limit — truncation applied
- PostgreSQL schema privileges for Ubuntu 24.04+
- Database URL parsing with special characters in password

## [1.0.0] — Phase 1 — Complete

### Added
- Project structure and FastAPI skeleton
- PostgreSQL database models: vessels, users, tanks, orb_part1, orb_part2, audit_log
- ORB Part I model — MARPOL Annex I Codes A through I
- ORB Part II model — MARPOL Annex I Codes A through G
- Basic web dashboard
- Full documentation structure
- MkDocs documentation site configuration
- Initial test suite
