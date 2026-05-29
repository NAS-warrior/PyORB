"""
PyORB Seed Data Script
Vessel: Marella Explorer 2 (IMO 9072446)
Run: python3 seed_data.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, init_db
from app.models.vessel import Vessel, VesselType, ORBMode
from app.models.user import User, UserRole
from app.models.tank import Tank, TankType
from app.services.auth_service import hash_password
from loguru import logger


def seed():
    init_db()
    db = SessionLocal()

    try:
        # ─── VESSEL ─────────────────────────────────────────
        existing_vessel = db.query(Vessel).filter(
            Vessel.imo_number == "9072446"
        ).first()

        if not existing_vessel:
            vessel = Vessel(
                name="Marella Explorer 2",
                imo_number="9072446",
                mmsi="249054000",
                call_sign="9HJI9",
                flag_state="Malta",
                vessel_type=VesselType.OTHER,  # Passenger/Cruise
                gross_tonnage="72458",
                deadweight="7260",
                year_built="1995",
                owner="TUI Group",
                operator="Marella Cruises",
                orb_mode=ORBMode.PART1
            )
            db.add(vessel)
            db.commit()
            db.refresh(vessel)
            logger.info(f"Vessel created: {vessel.name} — IMO {vessel.imo_number}")
        else:
            vessel = existing_vessel
            logger.info(f"Vessel already exists: {vessel.name}")

        # ─── USERS ──────────────────────────────────────────
        users_data = [
            {
                "username": "admin",
                "full_name": "System Administrator",
                "password": "admin123",
                "role": UserRole.ADMIN,
                "rank": "Administrator",
                "email": "admin@marella-explorer2.com"
            },
            {
                "username": "chief.engineer",
                "full_name": "James Robertson",
                "password": "Chief2024",
                "role": UserRole.CHIEF_ENGINEER,
                "rank": "Chief Engineer",
                "email": "chief@marella-explorer2.com",
                "certificate_number": "CE-UK-2019-4821"
            },
            {
                "username": "second.engineer",
                "full_name": "Maria Santos",
                "password": "Second2024",
                "role": UserRole.SECOND_ENGINEER,
                "rank": "Second Engineer",
                "email": "second@marella-explorer2.com",
                "certificate_number": "SE-PH-2020-3310"
            },
            {
                "username": "third.engineer",
                "full_name": "Nikolay Petrov",
                "password": "Third2024",
                "role": UserRole.THIRD_ENGINEER,
                "rank": "Third Engineer",
                "email": "third@marella-explorer2.com",
                "certificate_number": "TE-BG-2021-1192"
            },
            {
                "username": "master",
                "full_name": "Captain William Hughes",
                "password": "Master2024",
                "role": UserRole.MASTER,
                "rank": "Master",
                "email": "master@marella-explorer2.com",
                "certificate_number": "MC-UK-2015-0091"
            },
            {
                "username": "shore.office",
                "full_name": "TUI Shore Office",
                "password": "Shore2024",
                "role": UserRole.SHORE_OFFICE,
                "rank": "Shore Superintendent",
                "email": "shore@tui-marella.com"
            },
        ]

        for u_data in users_data:
            existing = db.query(User).filter(
                User.username == u_data["username"]
            ).first()
            if not existing:
                user = User(
                    username=u_data["username"],
                    full_name=u_data["full_name"],
                    hashed_password=hash_password(u_data["password"]),
                    role=u_data["role"],
                    rank=u_data.get("rank"),
                    email=u_data.get("email"),
                    certificate_number=u_data.get("certificate_number"),
                    is_active=True
                )
                db.add(user)
                logger.info(f"User created: {u_data['username']} ({u_data['role'].value})")
            else:
                logger.info(f"User already exists: {u_data['username']}")

        db.commit()

        # ─── TANKS ──────────────────────────────────────────
        # Typical tanks for a passenger cruise vessel
        # Based on Century-class ship configuration
        tanks_data = [
            # Heavy Fuel Oil Tanks
            {"name": "HFO Tank Port FWD",       "type": TankType.FUEL_OIL,       "cap": 850.0,  "pos": "port",      "ff": "20",  "ft": "45"},
            {"name": "HFO Tank Starboard FWD",  "type": TankType.FUEL_OIL,       "cap": 850.0,  "pos": "starboard", "ff": "20",  "ft": "45"},
            {"name": "HFO Tank Port AFT",        "type": TankType.FUEL_OIL,       "cap": 920.0,  "pos": "port",      "ff": "130", "ft": "155"},
            {"name": "HFO Tank Starboard AFT",   "type": TankType.FUEL_OIL,       "cap": 920.0,  "pos": "starboard", "ff": "130", "ft": "155"},
            {"name": "HFO Tank Centre",          "type": TankType.FUEL_OIL,       "cap": 650.0,  "pos": "center",    "ff": "70",  "ft": "100"},
            {"name": "HFO Settling Tank Port",   "type": TankType.FUEL_OIL,       "cap": 45.0,   "pos": "port",      "ff": "85",  "ft": "90"},
            {"name": "HFO Settling Tank SB",     "type": TankType.FUEL_OIL,       "cap": 45.0,   "pos": "starboard", "ff": "85",  "ft": "90"},
            {"name": "HFO Service Tank Port",    "type": TankType.FUEL_OIL,       "cap": 38.0,   "pos": "port",      "ff": "90",  "ft": "95"},
            {"name": "HFO Service Tank SB",      "type": TankType.FUEL_OIL,       "cap": 38.0,   "pos": "starboard", "ff": "90",  "ft": "95"},

            # Diesel / MGO Tanks
            {"name": "MGO Tank Port",            "type": TankType.DIESEL_OIL,     "cap": 320.0,  "pos": "port",      "ff": "50",  "ft": "70"},
            {"name": "MGO Tank Starboard",       "type": TankType.DIESEL_OIL,     "cap": 320.0,  "pos": "starboard", "ff": "50",  "ft": "70"},
            {"name": "MGO Service Tank",         "type": TankType.DIESEL_OIL,     "cap": 25.0,   "pos": "center",    "ff": "88",  "ft": "92"},

            # Lubricating Oil Tanks
            {"name": "LO Storage Tank",          "type": TankType.LUBRICATING_OIL,"cap": 28.0,   "pos": "port",      "ff": "95",  "ft": "100"},
            {"name": "LO Sump Tank ME1",         "type": TankType.LUBRICATING_OIL,"cap": 18.0,   "pos": "center",    "ff": "100", "ft": "105"},
            {"name": "LO Sump Tank ME2",         "type": TankType.LUBRICATING_OIL,"cap": 18.0,   "pos": "center",    "ff": "140", "ft": "145"},
            {"name": "Waste LO Tank",            "type": TankType.LUBRICATING_OIL,"cap": 15.0,   "pos": "port",      "ff": "100", "ft": "105"},

            # Bilge Tanks
            {"name": "Bilge Primary Tank",       "type": TankType.BILGE,          "cap": 35.0,   "pos": "center",    "ff": "105", "ft": "115"},
            {"name": "Bilge Secondary Tank",     "type": TankType.BILGE,          "cap": 20.0,   "pos": "center",    "ff": "115", "ft": "120"},
            {"name": "Bilge Water Tank FWD",     "type": TankType.BILGE,          "cap": 12.0,   "pos": "center",    "ff": "30",  "ft": "40"},
            {"name": "Oily Water Holding Tank",  "type": TankType.BILGE,          "cap": 45.0,   "pos": "center",    "ff": "108", "ft": "118"},

            # Slop Tanks
            {"name": "Slop Tank Port",           "type": TankType.SLOP,           "cap": 55.0,   "pos": "port",      "ff": "120", "ft": "130"},
            {"name": "Slop Tank Starboard",      "type": TankType.SLOP,           "cap": 55.0,   "pos": "starboard", "ff": "120", "ft": "130"},

            # Ballast Tanks
            {"name": "Ballast Tank FWD Port",    "type": TankType.BALLAST,        "cap": 280.0,  "pos": "port",      "ff": "5",   "ft": "20"},
            {"name": "Ballast Tank FWD SB",      "type": TankType.BALLAST,        "cap": 280.0,  "pos": "starboard", "ff": "5",   "ft": "20"},
            {"name": "Ballast Tank Mid Port",    "type": TankType.BALLAST,        "cap": 420.0,  "pos": "port",      "ff": "60",  "ft": "100"},
            {"name": "Ballast Tank Mid SB",      "type": TankType.BALLAST,        "cap": 420.0,  "pos": "starboard", "ff": "60",  "ft": "100"},
            {"name": "Ballast Tank AFT Port",    "type": TankType.BALLAST,        "cap": 310.0,  "pos": "port",      "ff": "155", "ft": "175"},
            {"name": "Ballast Tank AFT SB",      "type": TankType.BALLAST,        "cap": 310.0,  "pos": "starboard", "ff": "155", "ft": "175"},
            {"name": "Fore Peak Tank",           "type": TankType.BALLAST,        "cap": 380.0,  "pos": "center",    "ff": "1",   "ft": "10"},
            {"name": "Aft Peak Tank",            "type": TankType.BALLAST,        "cap": 350.0,  "pos": "center",    "ff": "175", "ft": "185"},

            # Fresh Water
            {"name": "Fresh Water Tank Port",    "type": TankType.FRESH_WATER,    "cap": 450.0,  "pos": "port",      "ff": "45",  "ft": "65"},
            {"name": "Fresh Water Tank SB",      "type": TankType.FRESH_WATER,    "cap": 450.0,  "pos": "starboard", "ff": "45",  "ft": "65"},
        ]

        for t_data in tanks_data:
            existing = db.query(Tank).filter(
                Tank.name == t_data["name"],
                Tank.vessel_id == vessel.id
            ).first()
            if not existing:
                tank = Tank(
                    vessel_id=vessel.id,
                    name=t_data["name"],
                    tank_type=t_data["type"],
                    capacity_m3=t_data["cap"],
                    position=t_data.get("pos"),
                    frame_from=t_data.get("ff"),
                    frame_to=t_data.get("ft"),
                    is_active=True
                )
                db.add(tank)
                logger.info(f"Tank created: {t_data['name']} ({t_data['cap']} m3)")
            else:
                logger.info(f"Tank already exists: {t_data['name']}")

        db.commit()
        logger.info("=" * 50)
        logger.info("Seed data complete!")
        logger.info(f"Vessel : Marella Explorer 2 (IMO 9072446)")
        logger.info(f"Users  : {len(users_data)} users created")
        logger.info(f"Tanks  : {len(tanks_data)} tanks created")
        logger.info("=" * 50)
        logger.info("Login credentials:")
        for u in users_data:
            logger.info(f"  {u['username']:25} / {u['password']}")
        logger.info("=" * 50)

    except Exception as e:
        logger.error(f"Seed failed: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
