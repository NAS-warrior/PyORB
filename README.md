# PyORB — Oil Record Book System

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![MARPOL](https://img.shields.io/badge/MARPOL-Annex%20I-green)
![Python](https://img.shields.io/badge/python-3.11+-yellow)
![License](https://img.shields.io/badge/license-MIT-orange)

## Overview

PyORB is a web-based Oil Record Book (ORB) management system built to comply with **MARPOL Annex I** regulations. It supports both **Part I (Machinery Space Operations)** and **Part II (Cargo/Ballast Operations)** and is designed for use onboard vessels.

## Features

- ✅ Full MARPOL Annex I compliance (Part I & Part II)
- ✅ Secure PostgreSQL database (no direct external access)
- ✅ Role-based user access (Admin, Chief Engineer, Officer, Viewer)
- ✅ Complete audit log of every operation
- ✅ Export records as PDF, Excel, CSV, or DB dump
- ✅ Integration with Valmarine, Kongsberg, NAPA and similar systems
- ✅ Reports, statistics and visual dashboards
- ✅ Filter by time period, operator, port, fuel type, ballast
- ✅ Vessel, tank and user setup via web interface
- ✅ Automatic tank data input from external systems

## MARPOL Coverage

### Part I — Machinery Space Operations
| Code | Operation |
|------|-----------|
| A | Ballasting of fuel oil tanks |
| B | Cleaning of fuel oil tanks |
| C | Discharge of dirty ballast |
| D | Cleaning of bilge water |
| E | Discharge of bilge water |
| F | Condition of OWS/ODM equipment |
| G | Accidental/other discharge |
| H | Bunkering |
| I | Additional operational procedures |

### Part II — Cargo/Ballast Operations
| Code | Operation |
|------|-----------|
| A | Loading of oil cargo |
| B | Internal transfer of oil cargo |
| C | Unloading of oil cargo |
| D | Ballasting of cargo tanks |
| E | Cleaning of cargo tanks |
| F | Discharge of ballast water |
| G | Accidental/other discharge |

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Python / FastAPI |
| Database | PostgreSQL |
| ORM | SQLAlchemy + Alembic |
| Frontend | Jinja2 / HTML / CSS / JS |
| Auth | JWT Tokens |
| PDF Export | ReportLab |
| Excel Export | OpenPyXL |
| Documentation | MkDocs Material |

## Quick Start

```bash
# Clone the repository
git clone https://github.com/NAS-warrior/PyORB.git
cd PyORB

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
nano .env

# Run database migrations
alembic upgrade head

# Start the application
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Project Structure

```
PyORB/
├── app/
│   ├── main.py              # FastAPI entry point
│   ├── config.py            # Settings & environment
│   ├── database.py          # PostgreSQL connection
│   ├── models/              # SQLAlchemy ORM models
│   ├── api/                 # API route handlers
│   ├── services/            # Business logic
│   ├── templates/           # Jinja2 HTML templates
│   └── static/              # CSS, JS, assets
├── docs/                    # Full documentation
├── migrations/              # Alembic DB migrations
├── tests/                   # pytest test suite
├── exports/                 # Generated report output
├── .env.example             # Environment template
├── requirements.txt         # Python dependencies
└── mkdocs.yml               # Documentation config
```

## Documentation

Full documentation available at `/docs` when running locally.

```bash
mkdocs serve
```

## Development Phases

- **Phase 1** — Core setup: DB, Auth, Vessel & Tank configuration
- **Phase 2** — ORB Core: Part I & II entries, audit log, web UI
- **Phase 3** — Reports & Exports: PDF, Excel, CSV, DB backup
- **Phase 4** — External Integrations: Valmarine, Kongsberg, NAPA
- **Phase 5** — Analytics: Dashboard, statistics, compliance reports

## License

MIT License — see [LICENSE](LICENSE) for details.

## Author

Developed by NAS-warrior
