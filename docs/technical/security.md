# Security Guide

## Database Security

- PostgreSQL listens on `localhost` only — no external port exposed in either mode
- Dedicated DB user with minimal privileges (no DELETE on any table)
- All removals use soft-delete (`is_deleted = true`) — data is never physically removed
- Every INSERT and UPDATE generates an `audit_log` entry with old and new values
- `audit_log` table is append-only — the DB user has no UPDATE or DELETE on it
- Passwords hashed with bcrypt (cost factor 12)

## Application Security

- JWT tokens with configurable expiry (default 8 hours)
- Role-based access control enforced on every API endpoint
- CORS restricted — no cross-origin requests accepted in ship mode
- No raw SQL exposed to the frontend
- All input validated via Pydantic models before reaching the database

## Audit Trail

Every system action generates an `audit_log` record containing:

| Field | Description |
|---|---|
| user_id | Who performed the action |
| action | create / update / delete / login / logout / export |
| table_name | Which table was affected |
| record_id | Which record was affected |
| old_values | JSON snapshot of previous values |
| new_values | JSON snapshot of new values |
| ip_address | Client IP address |
| timestamp | Exact UTC time |

This provides a complete investigation trail as required for PSC inspections and
Port Authority audits under MARPOL Annex I.

## Ship Mode — Network Security

- Application accessible only on local vessel network (192.168.x.x)
- No direct internet exposure required for normal operation
- VPN recommended if superintendent sync is needed
- Firewall rules: only port 8000 (app) and 22 (SSH admin) open

## Superintendent Mode — API Security

Ship nodes expose a restricted sync API. The superintendent authenticates using
a per-vessel API key. Ship nodes whitelist the superintendent's IP address.

```
Ship node firewall:
  Allow: superintendent IP → port 8001 (sync API)
  Deny: all other inbound connections
```

API keys are rotated annually or on any suspected compromise.

## Backup Security

All database backups must be encrypted:
```bash
# AES-256 encryption with PBKDF2 key derivation
pg_dump pyorb | gzip | \
  openssl enc -aes-256-cbc -pbkdf2 -out backup.sql.gz.enc
```

Backup encryption keys must be stored separately from the backup files and
from the server that generated the backup.
