# Ship-to-Superintendent Connectivity

## Overview

Ships operate in environments with highly variable and often unreliable connectivity.
PyORB supports multiple data transfer methods between Ship Operation nodes and the
Superintendent node. Each ship can have one or more connection methods configured,
with automatic fallback between them based on availability.

The Superintendent node tries each configured method in priority order until one
succeeds. All methods are one-directional: ship → superintendent (read only).

---

## Connection Methods

### 1. HTTPS REST API (Primary — recommended)

The ship node exposes a read-only sync API endpoint. The superintendent connects
directly over HTTPS and pulls ORB records on demand or on a schedule.

**Best for:** VSAT, 4G/5G, port WiFi, shore-to-ship internet

**How it works:**
```
Superintendent  ──HTTPS GET──►  Ship API (:8001/sync)
                ◄──JSON data──
```

**Authentication options (one per ship):**
- Bearer token (API key) — simple, recommended for most cases
- Mutual TLS (mTLS) — certificate-based, higher security
- JWT signed with ship's private key — token expires, auto-refresh

**Ship node configuration:**
```env
SYNC_API_ENABLED=true
SYNC_API_PORT=8001
SYNC_API_KEY=ship-api-key-generated-at-registration
SYNC_ALLOWED_IPS=203.0.113.10,10.0.0.0/8   # superintendent IPs whitelist
```

**Superintendent configuration per ship:**
```env
SHIP_001_METHOD=https
SHIP_001_ENDPOINT=https://marella-explorer-2.tui-fleet.com:8001
SHIP_001_AUTH_TYPE=bearer_token
SHIP_001_TOKEN=ship-api-key-stored-encrypted
```

**Security:**
- TLS 1.2 minimum, TLS 1.3 recommended
- Certificate pinning optional
- IP whitelist on ship node firewall
- Rate limiting: 10 sync requests per hour per superintendent

---

### 2. VPN Tunnel (Secure — for fleet VPNs)

Ship node is connected to the fleet VPN. Superintendent accesses it as if on
the same local network. HTTPS API still used but over private IP.

**Best for:** Fleets with dedicated VSAT plans and fleet VPN infrastructure

**How it works:**
```
Superintendent ──VPN──► Ship private IP ──► Ship API
```

**Supported VPN types:**
- WireGuard (recommended — lightweight, modern)
- OpenVPN
- IPSec/IKEv2
- SSH tunnel (see below)

**Configuration:**
Same as HTTPS REST API but endpoint uses private VPN IP:
```env
SHIP_001_ENDPOINT=https://10.10.1.42:8001
```

---

### 3. SSH Tunnel

For ships without a public IP or where firewall rules prevent direct connection.
The ship initiates an outbound SSH tunnel to the superintendent, which then
connects back through it.

**Best for:** Ships behind NAT, restricted firewalls, intermittent connectivity

**How it works:**
```
Ship ──SSH outbound──► Superintendent SSH server
Superintendent ──tunnel──► Ship API (as if local)
```

**Ship setup:**
```bash
# Ship runs this when connectivity is available
# Creates reverse tunnel: superintendent:9001 → ship:8001
ssh -N -R 9001:localhost:8001 sync@superintendent.company.com \
    -i /etc/pyorb/ship_tunnel_key \
    -o ServerAliveInterval=60 \
    -o ExitOnForwardFailure=yes
```

**Superintendent:** Polls `localhost:9001` when tunnel is active.

---

### 4. SFTP / FTP File Transfer

The ship generates a signed export file at set intervals and uploads it to an
SFTP/FTP server accessible by the superintendent. Superintendent polls and imports.

**Best for:** Low-bandwidth connections, store-and-forward, email-limited ships

**How it works:**
```
Ship ──export JSON/CSV──► SFTP server
Superintendent ──poll──► SFTP server ──► import
```

**Export file format:** `pyorb-sync-{IMO}-{timestamp}.json.gz`

**Ship configuration:**
```env
SYNC_SFTP_ENABLED=true
SYNC_SFTP_HOST=sftp.company.com
SYNC_SFTP_PORT=22
SYNC_SFTP_USER=ship-9072446
SYNC_SFTP_KEY=/etc/pyorb/sftp_key
SYNC_SFTP_PATH=/uploads/marella-explorer-2/
SYNC_SFTP_INTERVAL_HOURS=6
```

**File signing:** Each export file is signed with the ship's private key.
Superintendent verifies signature before importing. Prevents tampered records.

---

### 5. Email Attachment

The ship sends a signed and encrypted ORB export as an email attachment.
Superintendent monitors a dedicated mailbox and auto-imports on receipt.

**Best for:** Vessels with satellite email only (Iridium, Inmarsat C), very low
bandwidth situations, legacy fleet management workflows

**How it works:**
```
Ship ──email with attachment──► dedicated mailbox
Superintendent ──IMAP poll──► download attachment ──► import
```

**Ship configuration:**
```env
SYNC_EMAIL_ENABLED=true
SYNC_EMAIL_SMTP=smtp.iridium.com
SYNC_EMAIL_FROM=orb@marella-explorer-2.tui.com
SYNC_EMAIL_TO=fleet-sync@company.com
SYNC_EMAIL_INTERVAL_HOURS=24
SYNC_EMAIL_ENCRYPT=true
SYNC_EMAIL_GPG_KEY=superintendent-public-key.asc
```

**Email subject format:** `PyORB-SYNC|IMO:9072446|FROM:2024-01-01|TO:2024-01-31`

**Attachment:** `pyorb-sync-9072446-20240131.json.gz.gpg` (GPG encrypted)

**Superintendent mailbox polling:** Every 15 minutes via IMAP IDLE

---

### 6. USB / Physical File Export-Import

Officer exports a signed ORB data file to USB drive when in port. File is
handed to port agent or uploaded manually at the superintendent office.

**Best for:** No connectivity situations, port inspections, PSC audits,
emergency backup when all other methods fail

**How it works:**
```
Ship UI ──export──► signed file on USB
USB ──physical transfer──► superintendent office
Superintendent UI ──import──► verify signature ──► import
```

**Export process on ship:**
1. Admin goes to Reports → Data Export → Superintendent Sync Package
2. Selects date range
3. System generates: `pyorb-sync-9072446-20240131.pyorb`
4. File is signed with ship's private key and optionally encrypted
5. File written to USB or downloadable via browser

**Import process at superintendent:**
1. Superintendent goes to Fleet → Ships → Import Data
2. Uploads `.pyorb` file
3. System verifies signature against ship's registered public key
4. If valid, records are imported with source marked as `file_import`
5. Import logged in sync_log with operator name

**File format:** Binary container (ZIP-based)
```
pyorb-sync-9072446-20240131.pyorb
├── manifest.json        (IMO, date range, record count, hash)
├── orb_part1.json       (Part I records)
├── orb_part2.json       (Part II records — tankers only)
├── tanks.json           (Tank snapshots)
├── audit_log.json       (Audit trail for the period)
└── signature.sig        (RSA/Ed25519 signature of all above)
```

---

## Authentication & Security Summary

| Method | Authentication | Encryption | Tamper-proof |
|---|---|---|---|
| HTTPS API | Bearer token or mTLS cert | TLS 1.3 | Yes (TLS) |
| VPN + HTTPS | VPN keys + Bearer token | VPN + TLS | Yes |
| SSH Tunnel | SSH key pair | SSH | Yes |
| SFTP | SSH key pair | SSH | File signature |
| Email | GPG encryption | GPG | GPG signature |
| USB file | — | Optional GPG | File signature |

**All methods use asymmetric key pairs.** Each ship has:
- A private key (stored on ship, never leaves)
- A public key (registered with superintendent at ship enrollment)

This means the superintendent can verify the authenticity of every record
regardless of which transfer method was used.

---

## Connection Priority & Fallback

Each ship can have multiple methods configured with a priority order.
The superintendent tries them in order:

```
Priority 1: HTTPS API     (try first — fastest, real-time)
Priority 2: VPN + HTTPS   (if ship is on fleet VPN)
Priority 3: SSH Tunnel    (if ship has initiated tunnel)
Priority 4: SFTP          (check for new files)
Priority 5: Email         (check mailbox)
Priority 6: Manual import (human triggers this)
```

Configure per ship:
```env
SHIP_001_SYNC_METHODS=https,sftp,email
SHIP_001_SYNC_PRIORITY=https,sftp,email
SHIP_001_SYNC_INTERVAL_HOURS=6
```

---

## Superintendent Ship Registry

Each ship registered with the superintendent has:

| Field | Description |
|---|---|
| IMO number | Primary identifier |
| Vessel name | Display name |
| Public key | For verifying signed exports |
| API endpoint | HTTPS URL (if applicable) |
| API token | Encrypted bearer token (if applicable) |
| TLS certificate | Client cert for mTLS (if applicable) |
| SFTP path | Upload path (if applicable) |
| Email address | Ship sync email (if applicable) |
| VPN address | Private IP on fleet VPN (if applicable) |
| Sync methods | Priority-ordered list |
| Sync interval | Hours between automatic pulls |
| Last sync | Timestamp of last successful sync |
| Sync status | online, offline, syncing, error, manual-only |

---

## Data Integrity

Every sync package (regardless of method) includes:

1. **Record hash** — SHA-256 hash of every record's content
2. **Package hash** — SHA-256 hash of the entire package
3. **Digital signature** — RSA-4096 or Ed25519 signature using ship's private key
4. **Sequence numbers** — ORB entries have sequential IDs; superintendent detects gaps
5. **Timestamp verification** — entry timestamps validated against known port calls

If any verification fails, the import is rejected and flagged for manual review.
The superintendent never imports unverified or unsigned data.

---

## Bandwidth Estimates

| Method | Typical sync size | Bandwidth needed |
|---|---|---|
| HTTPS API (incremental) | 10–100 KB | Any |
| SFTP (daily export) | 50–500 KB | 9.6 kbps+ (satellite) |
| Email (weekly export) | 200 KB – 2 MB | Iridium capable |
| USB (monthly export) | 1–10 MB | None |

Incremental sync (only new records since last sync) is always used when
possible to minimize bandwidth consumption on satellite connections.
