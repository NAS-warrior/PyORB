# PyORB — Oil Record Book System

MARPOL Annex I compliant Oil Record Book management for vessels and fleet operators.

## Quick Links

| | |
|---|---|
| [Getting Started](user/getting_started.md) | First time setup and login |
| [Operational Modes](technical/modes.md) | Ship mode vs Superintendent mode |
| [Installation Guide](technical/installation.md) | Hardware, PostgreSQL, configuration |
| [MARPOL Part I Codes](marpol/part1_codes.md) | Operation codes A through I |
| [MARPOL Part II Codes](marpol/part2_codes.md) | Operation codes A through G |
| [Database Design](technical/database.md) | Schema, tables, hardware requirements |
| [Security Guide](technical/security.md) | Audit trail, access control, backups |
| [Roadmap](development/roadmap.md) | Planned features by phase |

## Operational Modes

PyORB runs in one of two exclusive modes set at installation:

**Ship Operation Mode** — runs onboard a single vessel. Officers enter ORB records
in real time. Supports Valmarine, Kongsberg and NAPA tank data integration.
Lightweight — runs on 2 cores, 4 GB RAM.

**Superintendent Mode** — runs at a shore office. Pulls data from multiple vessel
nodes. Full fleet audit, statistics and compliance reporting. Read-only — cannot
create entries on any ship. Requires 8–16 cores, 16–32 GB RAM, 200 GB+ storage.

## MARPOL Coverage

- Part I (Codes A–I) — all vessel types — Machinery Space Operations
- Part II (Codes A–G) — tankers and oil barges only — Cargo/Ballast Operations
- ORB mode is auto-assigned from vessel type — no manual selection required
- Tank → operation code mapping enforces valid code selection per tank type

## Current Version

Phase 2 complete. Phase 3 (ORB entry submission, PDF export) in development.
See [Roadmap](development/roadmap.md) and [Changelog](development/changelog.md).
