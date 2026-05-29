"""
DORB Seed Data Script
Creates realistic test data for multiple vessels with ORB entries.
Run: python3 seed_data.py
"""
import sys, os, random
from datetime import datetime, timedelta
sys.path.insert(0, os.path.dirname(__file__))

from app.database import ShipSession as SessionLocal, init_db
from app.models.vessel import Vessel, VesselType, ORBMode, get_orb_mode
from app.models.user import User, UserRole
from app.models.tank import Tank, TankType
from app.models.orb_part1 import ORBPart1Entry, OperationCodeP1, ShipStatus
from app.services.auth_service import hash_password
from loguru import logger


# ── Vessel definitions ─────────────────────────────────────────────────────
VESSELS = [
    {
        "name": "Marella Explorer 2",
        "imo": "9072446", "mmsi": "249054000", "call_sign": "9HJI9",
        "flag": "Malta", "type": VesselType.PASSENGER,
        "gt": "72458", "dwt": "7260", "year": "1995",
        "owner": "TUI Group", "operator": "Marella Cruises",
    },
    {
        "name": "Nordic Hawk",
        "imo": "9341557", "mmsi": "257123000", "call_sign": "LAQB",
        "flag": "Norway", "type": VesselType.OIL_TANKER,
        "gt": "29814", "dwt": "46500", "year": "2007",
        "owner": "Nordic Tankers AS", "operator": "Nordic Tankers AS",
    },
    {
        "name": "Baltic Carrier",
        "imo": "9198726", "mmsi": "219012000", "call_sign": "OXKJ2",
        "flag": "Denmark", "type": VesselType.BULK_CARRIER,
        "gt": "23946", "dwt": "38200", "year": "2001",
        "owner": "Norden A/S", "operator": "Norden A/S",
    },
    {
        "name": "Stena Premium",
        "imo": "9289837", "mmsi": "266312000", "call_sign": "SBBQ",
        "flag": "Sweden", "type": VesselType.PRODUCT_TANKER,
        "gt": "30152", "dwt": "49500", "year": "2005",
        "owner": "Stena Line", "operator": "Stena Tankers",
    },
]

# ── Common users per vessel ────────────────────────────────────────────────
CREW_TEMPLATES = [
    {"username_prefix": "admin",  "name": "System Administrator", "role": UserRole.ADMIN,           "rank": "Administrator",    "pwd": "admin123"},
    {"username_prefix": "ce",     "name": "James Robertson",       "role": UserRole.CHIEF_ENGINEER,  "rank": "Chief Engineer",   "pwd": "Chief2024",  "cert": "CE-UK-2019-4821"},
    {"username_prefix": "2e",     "name": "Maria Santos",          "role": UserRole.SECOND_ENGINEER, "rank": "Second Engineer",  "pwd": "Second2024", "cert": "SE-PH-2020-3310"},
    {"username_prefix": "3e",     "name": "Nikolay Petrov",        "role": UserRole.THIRD_ENGINEER,  "rank": "Third Engineer",   "pwd": "Third2024",  "cert": "TE-BG-2021-1192"},
    {"username_prefix": "master", "name": "Captain William Hughes","role": UserRole.MASTER,           "rank": "Master",           "pwd": "Master2024", "cert": "MC-UK-2015-0091"},
    {"username_prefix": "shore",  "name": "TUI Shore Office",      "role": UserRole.SHORE_OFFICE,    "rank": "Superintendent",   "pwd": "Shore2024"},
]

# ── Tank templates per vessel type ─────────────────────────────────────────
def get_tanks(vtype, vessel_id):
    base = [
        # HFO
        {"name":"HFO Tank Port FWD",         "type":TankType.FUEL_OIL,       "cap":850.0, "pos":"port",      "ff":"20","ft":"45", "vol":612.0},
        {"name":"HFO Tank Starboard FWD",    "type":TankType.FUEL_OIL,       "cap":850.0, "pos":"starboard", "ff":"20","ft":"45", "vol":578.0},
        {"name":"HFO Tank Port AFT",         "type":TankType.FUEL_OIL,       "cap":920.0, "pos":"port",      "ff":"130","ft":"155","vol":414.0},
        {"name":"HFO Tank Starboard AFT",    "type":TankType.FUEL_OIL,       "cap":920.0, "pos":"starboard", "ff":"130","ft":"155","vol":469.0},
        {"name":"HFO Settling Tank Port",    "type":TankType.FUEL_OIL,       "cap":45.0,  "pos":"port",      "ff":"85","ft":"90", "vol":38.0},
        {"name":"HFO Service Tank Port",     "type":TankType.FUEL_OIL,       "cap":38.0,  "pos":"port",      "ff":"90","ft":"95", "vol":33.0},
        # MGO
        {"name":"MGO Tank Port",             "type":TankType.DIESEL_OIL,     "cap":320.0, "pos":"port",      "ff":"50","ft":"70", "vol":192.0},
        {"name":"MGO Tank Starboard",        "type":TankType.DIESEL_OIL,     "cap":320.0, "pos":"starboard", "ff":"50","ft":"70", "vol":176.0},
        {"name":"MGO Service Tank",          "type":TankType.DIESEL_OIL,     "cap":25.0,  "pos":"center",    "ff":"88","ft":"92", "vol":20.0},
        # LO
        {"name":"LO Storage Tank",           "type":TankType.LUBRICATING_OIL,"cap":28.0,  "pos":"port",      "ff":"95","ft":"100","vol":15.4},
        {"name":"LO Sump Tank ME1",          "type":TankType.LUBRICATING_OIL,"cap":18.0,  "pos":"center",    "ff":"100","ft":"105","vol":4.9},
        {"name":"Waste LO Tank",             "type":TankType.LUBRICATING_OIL,"cap":15.0,  "pos":"port",      "ff":"100","ft":"105","vol":6.3},
        # Bilge
        {"name":"Bilge Primary Tank",        "type":TankType.BILGE,          "cap":35.0,  "pos":"center",    "ff":"105","ft":"115","vol":17.1, "alarm_hi":85, "alarm_lo":5,  "alarm_en":True},
        {"name":"Bilge Secondary Tank",      "type":TankType.BILGE,          "cap":20.0,  "pos":"center",    "ff":"115","ft":"120","vol":5.0,  "alarm_hi":85, "alarm_lo":5,  "alarm_en":True},
        {"name":"Oily Water Holding Tank",   "type":TankType.BILGE,          "cap":45.0,  "pos":"center",    "ff":"108","ft":"118","vol":24.3, "alarm_hi":80, "alarm_lo":5,  "alarm_en":True},
        # Slop
        {"name":"Slop Tank Port",            "type":TankType.SLOP,           "cap":55.0,  "pos":"port",      "ff":"120","ft":"130","vol":29.1},
        {"name":"Slop Tank Starboard",       "type":TankType.SLOP,           "cap":55.0,  "pos":"starboard", "ff":"120","ft":"130","vol":40.1},
        # Ballast
        {"name":"Fore Peak Tank",            "type":TankType.BALLAST,        "cap":380.0, "pos":"center",    "ff":"1","ft":"10",  "vol":205.0},
        {"name":"Ballast Tank FWD Port",     "type":TankType.BALLAST,        "cap":280.0, "pos":"port",      "ff":"5","ft":"20",  "vol":0.0},
        {"name":"Ballast Tank FWD SB",       "type":TankType.BALLAST,        "cap":280.0, "pos":"starboard", "ff":"5","ft":"20",  "vol":0.0},
        {"name":"Ballast Tank Mid Port",     "type":TankType.BALLAST,        "cap":420.0, "pos":"port",      "ff":"60","ft":"100","vol":136.4},
        {"name":"Ballast Tank Mid SB",       "type":TankType.BALLAST,        "cap":420.0, "pos":"starboard", "ff":"60","ft":"100","vol":120.4},
        {"name":"Aft Peak Tank",             "type":TankType.BALLAST,        "cap":350.0, "pos":"center",    "ff":"175","ft":"185","vol":203.0},
        # Fresh water
        {"name":"Fresh Water Tank Port",     "type":TankType.FRESH_WATER,    "cap":450.0, "pos":"port",      "ff":"45","ft":"65", "vol":166.5},
        {"name":"Fresh Water Tank SB",       "type":TankType.FRESH_WATER,    "cap":450.0, "pos":"starboard", "ff":"45","ft":"65", "vol":234.0},
    ]
    # Add cargo tanks for tankers
    if vtype in [VesselType.OIL_TANKER, VesselType.PRODUCT_TANKER, VesselType.CHEMICAL_TANKER]:
        base += [
            {"name":"Cargo Tank 1P",  "type":TankType.CARGO,"cap":2800.0,"pos":"port",     "ff":"10","ft":"50","vol":2240.0},
            {"name":"Cargo Tank 1S",  "type":TankType.CARGO,"cap":2800.0,"pos":"starboard","ff":"10","ft":"50","vol":2240.0},
            {"name":"Cargo Tank 2P",  "type":TankType.CARGO,"cap":3100.0,"pos":"port",     "ff":"50","ft":"95","vol":2480.0},
            {"name":"Cargo Tank 2S",  "type":TankType.CARGO,"cap":3100.0,"pos":"starboard","ff":"50","ft":"95","vol":2480.0},
            {"name":"Cargo Tank 3P",  "type":TankType.CARGO,"cap":3100.0,"pos":"port",     "ff":"95","ft":"140","vol":0.0},
            {"name":"Cargo Tank 3S",  "type":TankType.CARGO,"cap":3100.0,"pos":"starboard","ff":"95","ft":"140","vol":0.0},
            {"name":"Slop Tank P",    "type":TankType.SLOP, "cap":350.0, "pos":"port",     "ff":"140","ft":"155","vol":0.0},
            {"name":"Slop Tank S",    "type":TankType.SLOP, "cap":350.0, "pos":"starboard","ff":"140","ft":"155","vol":0.0},
        ]
    return base


# ── Sample ORB entries ────────────────────────────────────────────────────
def make_entries(vessel, tanks, users, db):
    ce = next((u for u in users if u.role == UserRole.CHIEF_ENGINEER), users[0])
    se = next((u for u in users if u.role == UserRole.SECOND_ENGINEER), users[0])

    # Get some tanks by type
    hfo_tanks = [t for t in tanks if t.tank_type == TankType.FUEL_OIL]
    bilge_tanks = [t for t in tanks if t.tank_type == TankType.BILGE]
    mgo_tanks = [t for t in tanks if t.tank_type == TankType.DIESEL_OIL]

    base_date = datetime.utcnow() - timedelta(days=30)
    entries = []

    # Bunkering entry 28 days ago
    if hfo_tanks:
        t = hfo_tanks[0]
        e = ORBPart1Entry(
            vessel_id=vessel.id, officer_id=ce.id, created_by=ce.id,
            operation_code=OperationCodeP1.H, operation_type="BUNKERING",
            operation_date=base_date + timedelta(days=2),
            ship_status=ShipStatus.IN_PORT,
            port_name="Valletta, Malta",
            position_lat=35.8989, position_lon=14.5145, position_source="manual",
            tank_id=t.id, quantity_m3=850.0,
            volume_before_m3=0.0, volume_after_m3=850.0,
            bunker_grade="VLSFO", bunker_mass_mt=843.2,
            bunker_density=992.0, bunker_supplier="Bunker One Malta",
            remarks="Bunkering completed without incident. BDN received.",
        )
        t.current_volume_m3 = min(t.current_volume_m3 + 850.0, t.capacity_m3)
        entries.append(e)

    # Bilge discharge 20 days ago
    if bilge_tanks:
        t = bilge_tanks[0]
        e = ORBPart1Entry(
            vessel_id=vessel.id, officer_id=se.id, created_by=se.id,
            operation_code=OperationCodeP1.E, operation_type="BILGE_DISCHARGE",
            operation_date=base_date + timedelta(days=10),
            ship_status=ShipStatus.EN_ROUTE,
            position_lat=38.1200, position_lon=15.6500, position_source="gps",
            tank_id=t.id, quantity_m3=12.5,
            volume_before_m3=17.1, volume_after_m3=4.6,
            ows_rate=1.2, oil_content_ppm=8.4,
            remarks="OWS operating normally. PPM within MARPOL limits.",
        )
        entries.append(e)

    # MGO transfer 15 days ago
    if mgo_tanks and len(mgo_tanks) >= 2:
        t_from = mgo_tanks[0]
        t_to = mgo_tanks[1]
        e = ORBPart1Entry(
            vessel_id=vessel.id, officer_id=ce.id, created_by=ce.id,
            operation_code=OperationCodeP1.I, operation_type="TRANSFER",
            operation_date=base_date + timedelta(days=15),
            ship_status=ShipStatus.EN_ROUTE,
            position_lat=36.8000, position_lon=15.1000, position_source="gps",
            tank_id=t_from.id, tank_to_id=t_to.id, quantity_m3=50.0,
            volume_before_m3=192.0, volume_after_m3=142.0,
            remarks="Transfer to equalize levels. Port/SB balance maintained.",
        )
        entries.append(e)

    # OWS condition check 10 days ago
    e = ORBPart1Entry(
        vessel_id=vessel.id, officer_id=ce.id, created_by=ce.id,
        operation_code=OperationCodeP1.F, operation_type="OWS_CONDITION",
        operation_date=base_date + timedelta(days=20),
        ship_status=ShipStatus.EN_ROUTE,
        position_lat=37.5000, position_lon=14.2000, position_source="gps",
        remarks="Monthly OWS inspection. Unit operating normally. ODM calibration verified. No bypass.",
    )
    entries.append(e)

    # Bilge cleaning 5 days ago
    if bilge_tanks:
        t = bilge_tanks[0]
        e = ORBPart1Entry(
            vessel_id=vessel.id, officer_id=se.id, created_by=se.id,
            operation_code=OperationCodeP1.D, operation_type="BILGE_CLEANING",
            operation_date=base_date + timedelta(days=25),
            ship_status=ShipStatus.IN_PORT,
            port_name="Piraeus, Greece",
            position_lat=37.9475, position_lon=23.6465, position_source="manual",
            tank_id=t.id, quantity_m3=8.0,
            volume_before_m3=t.current_volume_m3, volume_after_m3=max(t.current_volume_m3-8.0,0),
            remarks="Routine bilge cleaning. Contents transferred to reception facility.",
        )
        entries.append(e)

    for e in entries:
        db.add(e)


# ── Main seed ──────────────────────────────────────────────────────────────
def seed():
    init_db()
    db = SessionLocal()
    try:
        total_vessels = 0
        total_users   = 0
        total_tanks   = 0
        total_entries = 0

        for v_data in VESSELS:
            # Check/create vessel
            vessel = db.query(Vessel).filter(Vessel.imo_number == v_data["imo"]).first()
            if not vessel:
                orb_mode = get_orb_mode(v_data["type"])
                vessel = Vessel(
                    name=v_data["name"], imo_number=v_data["imo"], mmsi=v_data["mmsi"],
                    call_sign=v_data["call_sign"], flag_state=v_data["flag"],
                    vessel_type=v_data["type"], gross_tonnage=v_data["gt"],
                    deadweight=v_data["dwt"], year_built=v_data["year"],
                    owner=v_data["owner"], operator=v_data["operator"], orb_mode=orb_mode,
                )
                db.add(vessel)
                db.commit()
                db.refresh(vessel)
                logger.info(f"  Vessel: {vessel.name} ({vessel.imo_number}) — {orb_mode.value}")
                total_vessels += 1

            # Create users with vessel-specific usernames
            slug = v_data["imo"][-4:]
            vessel_users = []
            for crew in CREW_TEMPLATES:
                uname = f"{crew['username_prefix']}.{slug}"
                existing = db.query(User).filter(User.username == uname).first()
                if not existing:
                    user = User(
                        username=uname, full_name=crew["name"],
                        email=f"{uname}@dorb.ship",
                        rank=crew.get("rank"), role=crew["role"],
                        certificate_number=crew.get("cert"),
                        hashed_password=hash_password(crew["pwd"]), is_active=True,
                    )
                    db.add(user)
                    total_users += 1
                    vessel_users.append(user)
                else:
                    vessel_users.append(existing)
            db.commit()

            # Create tanks
            tanks = []
            for t_data in get_tanks(v_data["type"], vessel.id):
                existing = db.query(Tank).filter(
                    Tank.vessel_id == vessel.id, Tank.name == t_data["name"]
                ).first()
                if not existing:
                    tank = Tank(
                        vessel_id=vessel.id, name=t_data["name"],
                        tank_type=t_data["type"], capacity_m3=t_data["cap"],
                        current_volume_m3=t_data.get("vol", 0.0),
                        frame_from=t_data.get("ff"), frame_to=t_data.get("ft"),
                        position=t_data.get("pos"),
                        alarm_high_pct=t_data.get("alarm_hi", 90.0),
                        alarm_low_pct=t_data.get("alarm_lo", 10.0),
                        alarm_enabled=t_data.get("alarm_en", False),
                    )
                    db.add(tank)
                    tanks.append(tank)
                    total_tanks += 1
                else:
                    tanks.append(existing)
            db.commit()

            # Refresh vessels_users with IDs
            for i,u in enumerate(vessel_users):
                db.refresh(u)

            # Create sample ORB entries
            existing_entries = db.query(ORBPart1Entry).filter(
                ORBPart1Entry.vessel_id == vessel.id
            ).count()
            if existing_entries == 0:
                n_before = db.query(ORBPart1Entry).count()
                make_entries(vessel, tanks, vessel_users, db)
                db.commit()
                n_after = db.query(ORBPart1Entry).count()
                added = n_after - n_before
                total_entries += added
                logger.info(f"    ORB entries: {added} added")

        logger.info("=" * 60)
        logger.info(f"Seed complete!")
        logger.info(f"  Vessels : {total_vessels} created")
        logger.info(f"  Users   : {total_users} created")
        logger.info(f"  Tanks   : {total_tanks} created")
        logger.info(f"  Entries : {total_entries} created")
        logger.info("=" * 60)
        logger.info("Login credentials (username format: role.imo_last4):")
        for v in VESSELS:
            slug = v['imo'][-4:]
            logger.info(f"  {v['name']}: admin.{slug}/admin123, ce.{slug}/Chief2024")

    except Exception as e:
        logger.error(f"Seed failed: {e}")
        import traceback; traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
