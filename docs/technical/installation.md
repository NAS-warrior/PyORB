# Installation Guide

## Prerequisites

- Ubuntu 22.04 / 24.04 LXC or VM
- Python 3.11+
- PostgreSQL 14+
- Git

## Step 1 — Clone the Repository

```bash
git clone https://github.com/NAS-warrior/PyORB.git
cd PyORB
```

## Step 2 — Create Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Step 3 — Install & Secure PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib

# Secure: bind to localhost only
sudo nano /etc/postgresql/14/main/postgresql.conf
# Set: listen_addresses = 'localhost'

sudo systemctl restart postgresql
```

## Step 4 — Create Database & User

```bash
sudo -u postgres psql

CREATE DATABASE pyorb;
CREATE USER pyorb_user WITH PASSWORD 'your-secure-password';
GRANT CONNECT ON DATABASE pyorb TO pyorb_user;
GRANT USAGE ON SCHEMA public TO pyorb_user;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO pyorb_user;
\q
```

## Step 5 — Configure Environment

```bash
cp .env.example .env
nano .env
# Fill in DB_PASSWORD and SECRET_KEY
```

## Step 6 — Run Migrations

```bash
alembic upgrade head
```

## Step 7 — Start PyORB

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Access at: `http://<server-ip>:8000`
