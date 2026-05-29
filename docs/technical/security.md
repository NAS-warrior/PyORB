# Security Guide

## Database Security

- PostgreSQL listens on localhost only (no external access)
- Dedicated DB user with minimal privileges (no DELETE)
- All hard deletes replaced with soft-delete (is_deleted flag)
- Every change recorded in audit_log with old and new values

## Application Security

- JWT tokens with configurable expiry (default 8 hours)
- Passwords hashed with bcrypt (cost factor 12)
- Role-based access control — users only see what their role allows
- CORS restricted to localhost
- No raw SQL exposed to frontend

## Audit Trail

Every operation creates an audit_log entry containing:
- Which user performed the action
- Exact timestamp
- IP address
- What changed (old values vs new values)
- Which record was affected

This provides a complete investigation trail as required for ORB compliance.

## Backup

```bash
# Encrypted database backup
pg_dump pyorb | gzip | openssl enc -aes-256-cbc -out backup.sql.gz.enc

# Restore
openssl enc -d -aes-256-cbc -in backup.sql.gz.enc | gunzip | psql pyorb
```
