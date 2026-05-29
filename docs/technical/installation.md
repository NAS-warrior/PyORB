# Installation Guide

## Prerequisites

- Ubuntu 22.04 / 24.04 LTS (LXC container or VM)
- Python 3.11+
- PostgreSQL 14+ (ship) / 16+ (superintendent)
- Git
- Valid PyORB license key

---

## Ship Operation Mode — Installation

### Step 1 — Clone the Repository
```bash
git clone https://github.com/NAS-warrior/PyORB.git
cd PyORB
```

### Step 2 — Create Virtual Environment
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Step 3 — Install & Secure PostgreSQL
```bash
sudo apt install -y postgresql postgresql-contrib

# Bind to localhost only
sudo nano /etc/postgresql/*/main/postgresql.conf
# Set: listen_addresses = 'localhost'

sudo systemctl restart postgresql
sudo systemctl enable postgresql
```

### Step 4 — Create Database & User
```bash
sudo -u postgres psql

CREATE DATABASE pyorb;
CREATE USER pyorb_user WITH PASSWORD 'your-secure-password';
GRANT CONNECT ON DATABASE pyorb TO pyorb_user;
\c pyorb
GRANT ALL PRIVILEGES ON SCHEMA public TO pyorb_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO pyorb_user;
\q
```

### Step 5 — Configure Environment
```bash
cp .env.example .env
nano .env
```

Set these values:
```
APP_MODE=ship
APP_LICENSE_KEY=SHIP-IMO-XXXXXXX-XXXX-XXXX
DB_PASSWORD=your-secure-password
DATABASE_URL=postgresql://pyorb_user:your-secure-password@localhost:5432/pyorb
SECRET_KEY=generate-a-random-64-char-string
JWT_SECRET=generate-a-random-64-char-string
```

### Step 6 — Load Initial Data
```bash
# Run migrations (creates all tables)
python3 -c "from app.database import init_db; init_db()"

# Load seed data (vessel, users, tanks) - optional
python3 seed_data.py
```

### Step 7 — Start PyORB
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Access at: `http://<vessel-ip>:8000`

Default login: `admin` / `admin123` — **change immediately**

### Step 8 — Run as a System Service
```bash
sudo nano /etc/systemd/system/pyorb.service
```

```ini
[Unit]
Description=PyORB Oil Record Book System
After=network.target postgresql.service

[Service]
User=admin
WorkingDirectory=/home/admin/PyORB
Environment=PATH=/home/admin/PyORB/venv/bin
ExecStart=/home/admin/PyORB/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable pyorb
sudo systemctl start pyorb
```

---

## Superintendent Operation Mode — Installation

Same steps as Ship Mode with these differences:

### Step 3 — PostgreSQL (higher performance settings)
```bash
sudo nano /etc/postgresql/*/main/postgresql.conf

# Tune for larger workload
shared_buffers = 4GB           # 25% of RAM
effective_cache_size = 12GB    # 75% of RAM
work_mem = 64MB
max_connections = 200
wal_level = replica            # Enable WAL for backup
```

### Step 5 — Environment Differences
```
APP_MODE=superintendent
APP_LICENSE_KEY=SUPER-FLEET-COMPANY-XXXX-XXXX
```

### Step 6 — Additional Database Setup
```bash
sudo -u postgres psql

-- Sync-only read user for ship node connections
CREATE USER pyorb_sync WITH PASSWORD 'sync-password';
GRANT CONNECT ON DATABASE pyorb TO pyorb_sync;
GRANT USAGE ON SCHEMA public TO pyorb_sync;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO pyorb_sync;
\q
```

---

## Hardware Requirements Summary

### Ship Operation Mode
| Component | Minimum | Recommended |
|---|---|---|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Storage | 20 GB SSD | 50 GB SSD |
| Network | LAN | LAN + optional VPN |

### Superintendent Operation Mode
| Component | Minimum | Recommended |
|---|---|---|
| CPU | 8 cores | 16 cores |
| RAM | 16 GB | 32 GB |
| Storage | 200 GB SSD | 1 TB NVMe |
| Network | 100 Mbps | 1 Gbps stable |
| Backup | Daily encrypted | Continuous WAL archiving |

---

## Backup

### Ship Mode Backup
```bash
# Daily encrypted backup
pg_dump pyorb | gzip | \
  openssl enc -aes-256-cbc -pbkdf2 -out /backup/pyorb-$(date +%Y%m%d).sql.gz.enc

# Restore
openssl enc -d -aes-256-cbc -pbkdf2 \
  -in /backup/pyorb-20240101.sql.gz.enc | gunzip | psql pyorb
```

### Superintendent Mode Backup
```bash
# Configure continuous WAL archiving in postgresql.conf
archive_mode = on
archive_command = 'cp %p /backup/wal/%f'

# Plus daily base backup
pg_basebackup -D /backup/base -Ft -z -P
```
