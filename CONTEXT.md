# RFID Attendance System — Full Project Context for AI

> This document explains everything about this project — architecture, decisions, file structure, deployment, and what still needs to be done. Read this fully before making any changes.

---

## What This Project Is

An **IoT-based employee attendance system** using RFID cards and an ESP32 microcontroller. When an employee taps their RFID card on the reader, the system logs their attendance (IN/OUT) to a cloud database and displays it on a live web dashboard.

---

## Architecture

```
RFID Card (physical)
      |
      | SPI
      v
   RC522 (RFID reader module)
      |
      | SPI
      v
   ESP32 (microcontroller)
      |
      | HTTP POST over WiFi (internet)
      v
FastAPI Backend (deployed on Render)
      |
      | SQLAlchemy ORM
      v
PostgreSQL Database (Neon cloud)
      |
      | REST API (fetch every 5s)
      v
Dashboard (static HTML, deployed on Vercel)
```

---

## Hardware

| Component | Role |
|---|---|
| ESP32 Dev Module | WiFi-enabled microcontroller. Reads RFID, sends UID to backend |
| RC522 | RFID reader. Reads card UID via SPI protocol |
| OLED SSD1306 (128x64, I2C) | Shows feedback ("Welcome Rahul", "Unknown Card", etc.) |
| Active Buzzer | Audio feedback (1 beep = IN, 2 beeps = OUT, 3 = unknown) |
| RFID Cards/Keyfobs | Passive cards with a fixed UID (e.g. CD:FA:02:07). Cannot be written to. |

### Wiring (ESP32 pin assignments)
```
RC522 SPI:
  SDA  -> GPIO 5
  SCK  -> GPIO 18
  MOSI -> GPIO 23
  MISO -> GPIO 19
  RST  -> GPIO 4   ← IMPORTANT: moved from GPIO 22 (conflicts with OLED SCL)
  3.3V -> 3V3
  GND  -> GND

OLED I2C:
  SDA  -> GPIO 21
  SCL  -> GPIO 22

Buzzer:
  +    -> GPIO 25
  -    -> GND
```

---

## Repository Structure

```
attendance-system/
├── README.md                    ← Setup/run guide for humans
├── PROJECT_NOTES.md             ← Original project notes
├── CONTEXT.md                   ← THIS FILE (for AI context)
├── .gitignore                   ← Excludes backend/.env and dashboard/.env and venv/
│
├── esp32/
│   └── attendance_scanner.ino  ← Arduino sketch for ESP32
│
├── backend/                     ← Git repo: github.com/ghanashyamauti/IoT_backend
│   ├── main.py                  ← FastAPI app (all API logic + DB models)
│   ├── requirements.txt         ← Python dependencies (relaxed version pins for Render)
│   ├── runtime.txt              ← "python-3.12.0" — pins Python version on Render
│   ├── Procfile                 ← "web: uvicorn main:app --host 0.0.0.0 --port $PORT"
│   ├── .gitignore               ← Excludes venv/, .env, __pycache__
│   └── .env                     ← NOT in git. Contains DATABASE_URL secret (see below)
│
└── dashboard/                   ← Git repo: github.com/ghanashyamauti/IoT_frontend
    ├── index.html               ← Single-file dashboard (pure HTML/CSS/JS, no framework)
    ├── build.js                 ← Node.js script: reads BACKEND_URL env var, writes config.js
    ├── vercel.json              ← Tells Vercel: buildCommand = "node build.js"
    ├── package.json             ← Minimal, just defines the build script for Vercel
    ├── config.example.js        ← Template showing what config.js should look like
    ├── .gitignore               ← Excludes config.js and .env
    └── .env                     ← NOT in git. Contains BACKEND_URL for local dev
```

---

## Backend — `backend/main.py`

**Framework:** FastAPI  
**Database ORM:** SQLAlchemy  
**Database:** PostgreSQL on Neon (cloud), NOT SQLite  
**Config:** All secrets loaded from `.env` via `python-dotenv`  

### Database Tables

```
employees
  id, name, employee_code (unique), department, created_at

cards
  id, uid (unique), employee_id (FK), is_active, assigned_at

attendance
  id, employee_id (FK), card_uid, scan_time, scan_type ("IN" or "OUT")

unknown_scans
  id, uid, scanned_at
```

### Key API Endpoints

| Method | Endpoint | Who calls it | What it does |
|---|---|---|---|
| POST | `/employees` | Dashboard | Add a new employee |
| GET | `/employees` | Dashboard | List all employees with has_card field |
| POST | `/enroll/start` | Dashboard | Arm a 30-second enrollment window for a given employee_id |
| GET | `/enroll/result` | Dashboard (polls every 1s) | Returns status: waiting/success/idle |
| POST | `/scan` | **ESP32** | Main endpoint: handles enrollment OR attendance IN/OUT |
| GET | `/attendance/today` | Dashboard | All scans for today with name, code, card_uid, scan_type, scan_time |
| GET | `/` | Health check | Returns {"status": "Attendance backend running"} |

### `/scan` Logic (most important endpoint)

```
1. Is enrollment armed and not expired?
   YES → link this card UID to the pending employee → return "enrolled"

2. Was this exact UID seen in the last 8 seconds? (duplicate guard)
   YES → return "duplicate" (ignored, OLED shows "Already Scanned")

3. Is the card UID in the `cards` table and is_active = True?
   NO  → log to unknown_scans → return "unknown" (3 beeps)
   YES → determine IN or OUT:
         - Look at last scan today for this employee
         - If last was IN  → this is OUT
         - If last was OUT → this is IN
         - No scan today   → this is IN
         → save to attendance → return "in" or "out"
```

### ESP32 Response Format
The backend returns JSON that the ESP32 uses to drive the OLED and buzzer:
```json
{
  "result": "in",           // "in" | "out" | "enrolled" | "duplicate" | "unknown"
  "employee_name": "Rahul",
  "line1": "Welcome",       // OLED line 1 (large text)
  "line2": "Rahul"          // OLED line 2 (small text)
}
```
Buzzer: 1 beep = in/enrolled, 2 beeps = out, 3 rapid beeps = unknown, silent = duplicate

---

## Frontend — `dashboard/index.html`

**Type:** Pure static HTML + CSS + vanilla JS. No React, no build framework, no Node runtime needed.  
**Font:** DM Sans + DM Mono (Google Fonts)  
**Theme:** Light professional (white cards, light grey bg, blue/green/red accents)  
**Deployed on:** Vercel  

### How `BACKEND_URL` is injected (no hardcoding)

The URL is NOT hardcoded in any committed file. Instead:

1. `build.js` runs at Vercel deploy time
2. It reads `process.env.BACKEND_URL` (set in Vercel dashboard)
3. It writes `config.js` with `const BACKEND_URL = "https://...";`
4. `index.html` loads `config.js` via `<script src="config.js"></script>`
5. `config.js` is in `.gitignore` — never committed

For local development: create `dashboard/config.js` manually with `const BACKEND_URL = "http://localhost:8000";`

### Dashboard Features
- Live clock + Backend Online/Offline status chip
- 4 KPI cards: Total Employees, Checked In, Checked Out, Total Scans Today
- Left panel: Add Employee form, Employee list with avatar + card-linked badge, Card Enrollment flow
- Right panel: Today's attendance table (Employee, Code, Card UID, IN/OUT badge, Time) with search filter
- Auto-refreshes attendance every 5 seconds, employees every 15 seconds
- Toast notifications for success/error actions
- Countdown progress bar during card enrollment

---

## Environment Variables

### Backend `.env` (at `backend/.env`, NOT committed)
```
DATABASE_URL=postgresql://neondb_owner:npg_v5k3mPdfKMSQ@ep-bitter-darkness-azglhcgb-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
DUPLICATE_WINDOW_SECONDS=8
ENROLL_TIMEOUT_SECONDS=30
```
On Render: set `DATABASE_URL` in Environment section of the service.

### Frontend `.env` (at `dashboard/.env`, NOT committed)
```
BACKEND_URL=https://iot-backend-43ao.onrender.com
```
On Vercel: set `BACKEND_URL` in Project Settings → Environment Variables.

---

## Deployed URLs

| Service | URL |
|---|---|
| Backend (Render) | https://iot-backend-43ao.onrender.com |
| Frontend (Vercel) | (set after Vercel deployment) |
| Database (Neon) | Neon dashboard at neon.tech |
| Backend GitHub | https://github.com/ghanashyamauti/IoT_backend |
| Frontend GitHub | https://github.com/ghanashyamauti/IoT_frontend |

---

## ESP32 Sketch — `esp32/attendance_scanner.ino`

**Libraries needed (install via Arduino Library Manager):**
- MFRC522 by GithubCommunity
- Adafruit GFX Library
- Adafruit SSD1306
- ArduinoJson by Benoit Blanchon
- WiFi.h and HTTPClient.h (built into ESP32 board package)

**Three values to edit before uploading:**
```cpp
const char* WIFI_SSID     = "YourWiFiName";
const char* WIFI_PASSWORD = "YourWiFiPassword";
const char* SERVER_URL    = "https://iot-backend-43ao.onrender.com/scan";
```

**Behavior:**
- On boot: initializes OLED, RC522, connects to WiFi
- Loop: polls for new card → reads UID → HTTP POST to SERVER_URL → shows OLED + buzzer response
- If WiFi drops: retries every 10 seconds in background
- Duplicate tap guard is handled SERVER-SIDE (8 second window)
- After uploading: no laptop needed, runs off any USB power

**UID format sent to backend:**
```
"CD:FA:02:07"   (hex bytes separated by colons, always uppercase)
```

---

## Key Design Decisions (don't re-litigate these)

1. **SQLite → PostgreSQL (Neon):** Switched from SQLite to Neon PostgreSQL for cloud deployment. SQLAlchemy code barely changed — just the `DATABASE_URL`.

2. **ESP32 only sends UID, knows nothing else:** Name, phone, department all live in the database. ESP32 is dumb on purpose — adding 1000 employees doesn't require re-flashing.

3. **No authentication on dashboard/API:** Anyone on the internet with the URL can hit the API. Fine for a small office; add auth if needed later.

4. **IN/OUT alternates per day:** First scan = IN, second = OUT, third = IN, etc. Resets at midnight.

5. **Duplicate guard (8 seconds):** Same card tapped twice within 8 seconds = ignored. Prevents double-logging when someone holds the card too long.

6. **OLED RST moved from GPIO 22 → GPIO 4:** GPIO 22 is used by OLED's I2C SCL line. Physical rewire required on the ESP32.

7. **Backend URL not hardcoded in frontend:** Uses `build.js` + Vercel env vars to generate `config.js` at deploy time.

8. **Render requires Python 3.12:** Pinned via `runtime.txt`. Python 3.14 (Render's default) doesn't have pre-built wheels for pydantic-core yet.

---

## What Is NOT Done Yet (open items)

- [ ] No authentication on dashboard or API
- [ ] No CSV/Excel export for payroll
- [ ] No "deactivate card" endpoint (for lost cards)
- [ ] No multi-scanner support (enrollment state is in-memory, single scanner assumed)
- [ ] Render free tier sleeps after 15 min inactivity (first request ~30s delay to wake)
- [ ] Dashboard is a local HTML file — not yet hosted permanently (Vercel deployment pending)

---

## How to Run Locally (for development)

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate      # Windows
pip install -r requirements.txt
# Create .env with DATABASE_URL (see above)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
```bash
# Create dashboard/config.js manually:
echo 'const BACKEND_URL = "http://localhost:8000";' > dashboard/config.js
# Then just open dashboard/index.html in browser
```

### ESP32
- Edit WIFI_SSID, WIFI_PASSWORD, SERVER_URL in attendance_scanner.ino
- Upload via Arduino IDE
- Monitor via Serial at 115200 baud