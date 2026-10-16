# Shakham IoT Attendance System — Dashboard Frontend

A modern, high-performance responsive web dashboard for real-time employee attendance tracking, direct attendance overrides, card enrollment, analytics, and PDF report generation.

---

## 🚀 Key Features

- **Live Attendance Dashboard**: Real-time scan feed with live polling and dynamic attendance rate metrics.
- **Direct Attendance Management**: Clean interface allowing authenticated administrators to directly record staff presence or mark absences for any calendar date.
- **Single Check-In Support**: Enforces once-per-day check-in with duplicate scan guards.
- **PDF Report Generation**: Instant client-side branded PDF downloads with company logos, status summaries, and detailed tables using `html2canvas` and `jspdf`.
- **RFID Card Enrollment**: Step-by-step card linking supporting both Web Serial USB readers and network-armed ESP32 readers.
- **Modern Responsive Design**: Fluid typography, dark/light theme switching, compact mobile KPI grids, and zero layout shift.
- **Configurable Routing**: Dynamic base path support (e.g. `/IoT-Attendance/`) loaded strictly from environment variables without hardcoded URLs.

---

## 🛠️ Tech Stack

- **Framework**: [React 18+](https://react.dev/) + [Vite](https://vite.dev/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Styling**: Vanilla CSS with custom design tokens and dark/light mode
- **PDF Export**: [jsPDF](https://github.com/parallax/jsPDF) + [html2canvas](https://html2canvas.hertzen.com/)
- **HTML Sanitization**: [DOMPurify](https://github.com/cure53/DOMPurify)
- **Deployment**: [Nginx Alpine](https://hub.docker.com/_/nginx) multi-stage container

---

## ⚙️ Local Development Setup

### 1. Prerequisites
- Node.js 18+
- npm or yarn

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/shakhaminc-temp/IoT-Attendance-FE.git
cd IoT-Attendance-FE

# Install dependencies
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

```env
VITE_BACKEND_URL=http://localhost:8000
VITE_BASE_PATH=/IoT-Attendance/
```

### 4. Run Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173/IoT-Attendance/`.

### 5. Build for Production
```bash
npm run build
```

---

## 🐳 Docker Deployment

A multi-stage `Dockerfile` is provided using `node:20-alpine` to compile assets and `nginx:alpine` to serve with SPA client-side routing:

```bash
# Build Docker image
docker build -t iot-attendance-fe .

# Run container
docker run -d -p 80:80 --name attendance-fe iot-attendance-fe
```
