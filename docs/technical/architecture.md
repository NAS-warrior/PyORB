# PyORB System Architecture

## Overview

PyORB is a web-based Oil Record Book system built with Python and PostgreSQL, designed to comply with MARPOL Annex I regulations.

## Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Backend | FastAPI | 0.111.0 |
| Database | PostgreSQL | 14+ |
| ORM | SQLAlchemy | 2.0 |
| Migrations | Alembic | 1.13 |
| Frontend | Jinja2 + HTML/CSS/JS | - |
| Auth | JWT (python-jose) | 3.3 |
| PDF Export | ReportLab | 4.2 |
| Excel Export | OpenPyXL | 3.1 |
| Documentation | MkDocs Material | 9.5 |

## Security Architecture

- PostgreSQL bound to localhost only — no external port exposure
- All API access requires JWT authentication
- Role-based access control (RBAC)
- Every write operation logged to audit_log table
- Passwords hashed with bcrypt
- Database user has minimum required privileges

## Module Structure

```
app/
├── main.py          # FastAPI app, middleware, routers
├── config.py        # Environment-based settings
├── database.py      # SQLAlchemy engine and session
├── models/          # ORM table definitions
├── api/             # Route handlers
├── services/        # Business logic
├── templates/       # Jinja2 HTML templates
└── static/          # CSS, JS, assets
```
