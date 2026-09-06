# AI-Based Smart Public Grievance Management System

**GrievanceAI** is an enterprise-grade, end-to-end municipal grievance redressal portal. It integrates Natural Language Processing (NLP) machine learning models for real-time category classification, sentiment-based priority scoring, automated department assignment, Service Level Agreement (SLA) deadline tracking, escalation workflows, duplicate grievance detection, real-time notifications, admin analytics dashboards, and role-based access security.

---

## 🚀 Main Features

* **AI Category Classification**: Uses TF-IDF vectorization and a Multinomial Naive Bayes classifier to instantly assign grievances to categories (*Water*, *Electricity*, *Road*, *Garbage*, *Others*).
* **Automated Priority Detection**: Evaluates sentiment intensity via NLTK VADER and keyword scoring to automatically assign priority levels (*High*, *Medium*, *Low*).
* **Automated Department Assignment**: Routes complaints directly to standard municipal departments (*Water Supply Department*, *Electricity Department*, *Public Works Department*, *Sanitation/Waste Management Department*, *General/Public Grievance Department*).
* **Structured Grievance Workflow**: Enforces strict lifecycle state transitions (`SUBMITTED` → `ASSIGNED` → `IN_PROGRESS` → `RESOLVED` → `CLOSED` / `REOPENED`).
* **Human-Friendly Grievance IDs**: Generates stable, readable public tracking reference numbers (e.g. `GRV-20260906-000001`).
* **SLA Management & Escalation Engine**: Tracks resolution deadlines per priority level (24h High, 48h Medium, 72h Low), flags approaching deadlines, and automatically or manually escalates breached grievances.
* **Duplicate & Related Grievance Detection**: Scans active complaints using text similarity matching and location overlap to flag potential duplicates upon submission.
* **Persistent Notification System**: Delivers event-driven alerts for citizens (submission, status updates, resolution) and administrators (new complaints, SLA warnings, breaches, escalations, duplicates).
* **Admin Analytics & Performance Dashboards**: Interactive charts (Recharts) detailing intake distributions, SLA breach rates, average resolution durations, and a Department Performance Matrix table.
* **Advanced Multi-Criteria Filtering**: Filters complaint queues by Department, SLA Status (`WITHIN_SLA`, `NEAR_DEADLINE`, `SLA_BREACHED`), Category, Priority, and Status.
* **Role Enforcement & Public Privacy Protection**: Enforces cryptographic JWT role isolation and automatically sanitizes citizen PII (`name`, `phone`, `location`, `address`) from public APIs.

---

## 🛠️ Technology Stack

* **Backend**: Python 3.11+, Flask REST API, PyJWT, Gunicorn (Production WSGI), Flask-CORS.
* **Frontend**: React 18, Vite 8, Tailwind CSS, Recharts, Lucide React Icons, Axios.
* **Machine Learning**: `scikit-learn` (Multinomial Naive Bayes), `pandas`, `TfidfVectorizer`, NLTK VADER sentiment analyzer.
* **Database Adapter**: Dual hybrid database engine supporting MongoDB Cloud Atlas cluster with automatic local SQLite (`complaints.db`) fallback.

---

## 📁 Project Structure

```text
grievance_demo/
├── backend/                      # Python Flask API Service
│   ├── app.py                    # Server Entry Point & REST API Routes
│   ├── database.py               # Hybrid Database Adapter (MongoDB / SQLite)
│   ├── classifier.py             # ML Classification & Sentiment Analysis Pipeline
│   ├── auth.py                   # JWT Auth & Role Enforcement Decorators
│   ├── sla.py                    # SLA Deadline & Status Calculations
│   ├── escalation.py             # Escalation Logic & Reasons
│   ├── similarity.py             # Duplicate Complaint Detection
│   ├── departments.py            # Department Mappings & Whitelist
│   ├── requirements.txt          # Python Dependencies (Flask, PyJWT, scikit-learn, Gunicorn)
│   ├── .env.example              # Environment Variable Template
│   ├── test_app.py               # Backend Core API Unit Tests
│   ├── test_notifications.py     # Notification System Unit Tests
│   ├── test_analytics.py         # Dashboard Analytics Unit Tests
│   ├── test_search_filters.py    # Search & Filtering Unit Tests
│   └── test_security_hardening.py# Security Hardening & PII Unit Tests
├── frontend/                     # React + Vite Client Application
│   ├── src/
│   │   ├── components/           # UI Components (Navbar, Footer, Notifications)
│   │   ├── pages/                # Pages (Home, Submit, History, Login, Dashboard)
│   │   ├── services/             # Axios API Client & Interceptors (`api.js`)
│   │   ├── App.jsx               # Client Routing & Shell
│   │   └── index.css             # Tailwind Design System & Utility Tokens
│   ├── package.json              # Frontend Dependencies
│   └── vite.config.js            # Vite Bundler Configuration
├── ml_model/                     # Machine Learning Pipeline
│   ├── train_model.py            # Model Training Script
│   ├── generate_dataset.py       # Training Dataset Generator
│   ├── dataset.csv               # 325-sample Categorized Training Corpus
│   ├── model.pkl                 # Trained Multinomial Naive Bayes Binary
│   └── vectorizer.pkl            # Fitted TF-IDF Vectorizer Binary
├── docs/                         # Technical & Viva Documentation
│   ├── architecture.md           # Architecture Specs & DFD
│   └── viva_preparation.md       # Technical Questions & Answers
├── .env.example                  # Root Environment Variable Template
├── .gitignore                    # Git Exclusion Rules
└── README.md                     # System Documentation
```

---

## 💻 Installation & Setup

### Prerequisites
* Python 3.10+
* Node.js 18+ and npm
* Git

### Step-by-Step Installation

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd grievance_demo
   ```

2. **Set Up Python Virtual Environment**:
   - **Windows**:
     ```cmd
     python -m venv .venv
     .venv\Scripts\activate
     ```
   - **Linux / macOS**:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. **Install Backend Dependencies**:
   ```bash
   pip install -r backend/requirements.txt
   ```

4. **Install Frontend Dependencies**:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

5. **Configure Environment Variables**:
   Copy `.env.example` to `.env` (or `backend/.env`):
   ```bash
   cp .env.example .env
   ```
   *Modify `.env` to set your custom `JWT_SECRET_KEY`, admin credentials, or optional `MONGO_URI`.*

---

## ⚡ Running Locally

### 1. Start Backend API Server
With virtual environment active:
```bash
python backend/app.py
```
*The backend REST API will start at `http://localhost:5000` (or configured `PORT`).*

### 2. Start Frontend Development Server
In a separate terminal:
```bash
cd frontend
npm run dev
```
*The React client will start at `http://localhost:5173`.*

---

## 🧪 Testing

The system includes a comprehensive automated test suite covering all business logic, workflow rules, analytics, filtering, and security controls.

Run all 71 backend unit tests:
```bash
python -m unittest discover -s backend
```

**Verified Test Suite Status**: `Ran 71 tests in ~6.8s — OK (100% Pass Rate)`

---

## 📦 Production Build & Deployment

### 1. Frontend Production Build
Compile optimized static assets:
```bash
cd frontend
npm run build
```
*Output generated in `frontend/dist/`.*

### 2. Production WSGI Backend Startup (Gunicorn)
Run Gunicorn multi-worker WSGI server:
```bash
gunicorn -w 4 -b 0.0.0.0:5000 backend.app:app
```
*For Windows production environments, run via Waitress or virtualized container:*
```bash
waitress-serve --port=5000 backend.app:app
```

---

## ⚙️ Configuration Guide

| Environment Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | HTTP port for backend API server |
| `FLASK_ENV` | `development` | Environment mode (`development` or `production`) |
| `JWT_SECRET_KEY` | *(Built-in fallback)* | Cryptographic secret key for signing JWT tokens |
| `ADMIN_USERNAME` | `admin` | Username for administrative login |
| `ADMIN_PASSWORD` | `admin123` | Password for administrative login |
| `MONGO_URI` | *(Empty)* | MongoDB Cloud Atlas connection URI (Falls back to SQLite if empty) |
| `VITE_API_URL` | `http://localhost:5000/api` | API Base URL for frontend Axios client |

---

## 🏗️ System Architecture

```text
[ Citizen / Admin UI ]
        │
        ▼ (HTTPS REST / JSON)
[ Axios API Client (api.js) ]
        │
        ▼
[ Flask API Router (app.py) ] ── (JWT Guard: auth.py)
        │
        ├──► [ NLP Classifier (classifier.py) ] ── (Naive Bayes + VADER)
        │
        ├──► [ Hybrid DB Controller (database.py) ] ──► [ MongoDB Atlas / SQLite ]
        │
        └──► [ Business Engines ]
                ├── SLA Manager (sla.py)
                ├── Escalation Engine (escalation.py)
                ├── Duplicate Matcher (similarity.py)
                └── Analytics & Matrix Generator
```

---

## 🔄 Grievance Lifecycle Workflow

```text
  [ Citizen Submits Complaint ]
              │
              ▼
        ( SUBMITTED )
              │
              ├──────► [ Admin Assigns ] ──► ( ASSIGNED )
              │                                    │
              ▼                                    ▼
       ( IN_PROGRESS ) ◄───────────────────────────┘
              │
              ▼
        [ Disposed ] ──► ( RESOLVED ) ──► [ Closed ] ──► ( CLOSED )
                             │
                             └───────────► [ Citizen Reopens ] ──► ( REOPENED )
                                                                      │
                                                                      ▼
                                                               ( IN_PROGRESS )
```

---

## 🛡️ Security & Privacy Boundary

* **Role Isolation**: Admin endpoints (`/api/update-status`, `/api/update-department`, `/api/escalate`, `/api/dashboard-stats`) require a valid Admin JWT token. Citizen session tokens are rejected with `403 Forbidden`.
* **Public PII Protection**: Public API responses (`GET /api/get-complaints` and public grievance lookup) sanitize citizen personal data (`name`, `phone`, `location`, `address`).
* **Query Injection Safety**: Database queries utilize parameterized placeholders (`?` in SQLite, structured dictionary objects in MongoDB), eliminating SQL/NoSQL injection risks.
