# Changelog

## [2.0.0] - Phase 2 - In Development

### Added
- JWT Authentication system (login, token, role-based access)
- Auth API endpoints (/api/auth/token, /api/auth/me)
- Vessel setup API with full CRUD operations
- User management API with role-based permissions
- Tank management API (create, update, deactivate)
- API dependency injection (auth guards, permissions)
- Audit service — logs every action with old/new values
- Auth service — bcrypt password hashing, token generation
- Setup service — creates initial admin user on first run
- Full web UI — login screen, dashboard, vessel/user/tank forms
- Alembic migration configuration
- Role permissions: Admin, Chief Engineer, Officer, Shore Office, Port Authority, Viewer

### Security
- JWT tokens with 8-hour expiry
- bcrypt password hashing (cost factor 12)
- Role-based access control on all endpoints
- Soft delete only — no hard deletes permitted
- All changes logged to audit_log table

## [1.0.0] - Phase 1 - Complete

### Added
- Initial project structure
- FastAPI backend skeleton
- PostgreSQL database models (vessels, users, tanks)
- ORB Part I model — MARPOL Annex I Codes A-I
- ORB Part II model — MARPOL Annex I Codes A-G
- Audit log model
- Basic web dashboard
- Full documentation structure
- MkDocs documentation site config
- Initial test suite
