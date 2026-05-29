# Getting Started with PyORB

## First Time Setup

### 1. Install and Start PyORB

```bash
cd ~/PyORB
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Access the system at: `http://<vessel-ip>:8000`

### 2. Configure Your Vessel

Go to **Setup > Vessel** and enter:
- Vessel name
- IMO number
- Flag state
- Vessel type
- Select ORB mode (Part I, Part II, or Both)

### 3. Add Users

Go to **Setup > Users** and create accounts for:
- Chief Engineer (admin rights)
- Engineers (entry rights)
- Officers (entry rights)
- Shore office (read-only)

### 4. Configure Tanks

Go to **Setup > Tanks** and add all tanks:
- Fuel oil tanks
- Bilge tanks
- Ballast tanks
- Slop tanks
- Cargo tanks (if Part II)

### 5. Start Recording

Select **ORB Part I** or **ORB Part II** from the dashboard and begin entering operations.

## User Roles

| Role | Can Enter Records | Can View | Can Export | Can Admin |
|------|------------------|----------|------------|-----------|
| Admin | Yes | Yes | Yes | Yes |
| Chief Engineer | Yes | Yes | Yes | No |
| Officer | Yes | Yes | No | No |
| Shore Office | No | Yes | Yes | No |
| Port Authority | No | Yes | No | No |
| Viewer | No | Yes | No | No |
