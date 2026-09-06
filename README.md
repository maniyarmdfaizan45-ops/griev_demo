# AI-Based Smart Public Grievance Management System

**GrievanceAI** is an enterprise-grade, end-to-end municipal grievance redressal portal. It integrates Natural Language Processing (NLP) machine learning models for real-time category classification, AI-assisted priority scoring, automated department assignment, Service Level Agreement (SLA) deadline tracking, escalation workflows, advisory duplicate grievance detection, real-time notifications, admin analytics dashboards, and role-based access security.

---

## 🚀 Main Features

* **AI Category Classification**: Uses TF-IDF vectorization and a Logistic Regression classifier (selected after evaluating Multinomial Naive Bayes, Logistic Regression, and Linear SVM) to instantly assign grievances to categories (*Water*, *Electricity*, *Road*, *Garbage*, *Others*).
* **AI-Assisted Priority Detection**: AI-assisted priority scoring based on severity signals, service disruption, complaint duration, affected population, and sentiment support to automatically assign priority levels (*High*, *Medium*, *Low*).
* **Automated Department Assignment**: Routes complaints directly to official municipal departments:
  * Water → **Water Supply Department**
  * Electricity → **Electricity Department**
  * Road → **Public Works Department**
  * Garbage → **Sanitation/Waste Management Department**
  * Others → **General/Public Grievance Department**
* **Structured Grievance Workflow**: Enforces strict lifecycle state transitions (`SUBMITTED` → `ASSIGNED` → `IN_PROGRESS` → `RESOLVED` → `CLOSED` / `REOPENED` → `IN_PROGRESS`). Resolution and reopening require mandatory remarks where applicable.
* **Human-Friendly Grievance IDs**: Generates stable, readable public tracking reference numbers formatted as `GRV-YYYY-NNNNNN` (e.g., `GRV-2026-000001`).
* **SLA Management & Escalation Engine**: Tracks resolution deadlines per priority level (**High → 24 hours**, **Medium → 3 days**, **Low → 7 days**), flags approaching deadlines during the final 25% of the SLA window (`NEAR_DEADLINE`), and tracks SLA states (`WITHIN_SLA`, `NEAR_DEADLINE`, `SLA_BREACHED`, `RESOLVED_WITHIN_SLA`, `RESOLVED_AFTER_SLA`).
* **Advisory Duplicate Grievance Detection**: An advisory similarity-based detection system that scans active complaints using text similarity matching and location overlap to flag potential duplicate tickets for administrative review.
* **Persistent Notification System**: Delivers event-driven alerts for citizens (submission, status updates, resolution) and administrators (new complaints, SLA warnings, breaches, escalations, duplicates).
* **Admin Analytics & Performance Dashboards**: Interactive charts (Recharts) detailing intake distributions, SLA breach rates, average resolution durations, and a Department Performance Matrix table.
* **Advanced Multi-Criteria Filtering**: Filters complaint queues by Department, SLA Status (`WITHIN_SLA`, `NEAR_DEADLINE`, `SLA_BREACHED`), Category, Priority, and Status.
* **Role Enforcement & Public Privacy Protection**: Enforces cryptographic JWT role isolation and automatically sanitizes citizen PII (`name`, `phone`, `location`, `address`) from public APIs.

---

## 🛠️ Technology Stack

* **Backend**: Python 3.11+, Flask REST API, PyJWT, Gunicorn (Production WSGI), Flask-CORS.
* **Frontend**: React 18, Vite 8, Tailwind CSS, Recharts, Lucide React Icons, Axios.
* **Machine Learning**: `scikit-learn` (Logistic Regression classifier with TF-IDF vectorization), `pandas`, `numpy`, NLTK VADER. Evaluated across Multinomial Naive Bayes, Linear SVM, and Logistic Regression.
* **Database Adapter**: Dual hybrid database engine supporting MongoDB Cloud Atlas cluster with automatic local SQLite (`complaints.db`) fallback.

---

## 📁 Project Structure

```text
grievance_demo/
├── backend/                      # Python Flask API Service
│   ├── app.py                    # Server Entry Point & REST API Routes
│   ├── database.py               # Hybrid Database Adapter (MongoDB / SQLite)
│   ├── classifier.py             # ML Classification & Priority Scoring Pipeline
│   ├── auth.py                   # JWT Auth & Role Enforcement Decorators
│   ├── sla.py                    # SLA Deadline & Status Calculations
│   ├── escalation.py             # Escalation Logic & Reasons
│   ├── similarity.py             # Advisory Duplicate Complaint Detection
│   ├── departments.py            # Department Mappings & Whitelist
│   ├── requirements.txt          # Python Dependencies
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
│   ├── train_model.py            # Model Training & Evaluation Script
│   ├── generate_dataset.py       # Training Dataset Generator
│   ├── dataset.csv               # 600-sample categorized training corpus
│   ├── model.pkl                 # Trained Logistic Regression model
│   └── vectorizer.pkl            # Fitted TF-IDF vectorizer
├── docs/                         # Technical & Viva Documentation
│   ├── architecture.md           # Architecture Specs & DFD
│   └── viva_preparation.md       # Technical Questions & Answers
├── .env.example                  # Root Environment Variable Template
├── .gitignore                    # Git Exclusion Rules
└── README.md                     # System Documentation
```

### ML Pipeline File Descriptions
- `dataset.csv`: 600-sample categorized training corpus (120 samples per category, 5 categories, 600 unique samples, 0 duplicates)
- `model.pkl`: trained Logistic Regression model
- `vectorizer.pkl`: fitted TF-IDF vectorizer

---

## 💻 Installation & Setup

### Prerequisites
* Python 3.11+
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
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

---

## ⚡ Running Locally

### 1. Start Backend API Server
With virtual environment active:
```bash
python backend/app.py
```
*The backend REST API will start at `http://localhost:5000`.*

### 2. Start Frontend Development Server
In a separate terminal:
```bash
cd frontend
npm run dev
```
*The React client will start at `http://localhost:5173`.*

---

## 🧪 Testing

Run all backend unit tests:
```bash
python -m unittest discover -s backend
```

**Verified Test Suite Status**: `71/71 tests passed (100% pass rate)`

---

## 📦 Production Build & Deployment

### 1. Frontend Production Build
Compile optimized static assets:
```bash
cd frontend
npm run build
```

### 2. Production WSGI Backend Startup (Gunicorn)
Run Gunicorn multi-worker WSGI server:
```bash
gunicorn -w 4 -b 0.0.0.0:5000 backend.app:app
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
        ├──► [ NLP Classifier (classifier.py) ] ── (Logistic Regression + TF-IDF)
        │
        ├──► [ Hybrid DB Controller (database.py) ] ──► [ MongoDB Atlas / SQLite ]
        │
        └──► [ Business Engines ]
                ├── SLA Manager (sla.py)
                ├── Escalation Engine (escalation.py)
                ├── Advisory Duplicate Matcher (similarity.py)
                └── Analytics & Matrix Generator
```

---

## 🔄 Grievance Lifecycle Workflow

```text
SUBMITTED
    ↓
ASSIGNED
    ↓
IN_PROGRESS
    ↓
RESOLVED
   ↙   ↘
CLOSED  REOPENED
            ↓
       IN_PROGRESS
```

*Note: Transitioning to RESOLVED or REOPENED requires mandatory remarks in the system.*

---

## 🛡️ Security & Privacy Boundary

* **Role Isolation**: Admin endpoints require a valid Admin JWT token. Citizen session tokens are rejected with `403 Forbidden`.
* **Public PII Protection**: Public API responses sanitize citizen personal data (`name`, `phone`, `location`, `address`).
* **Query Injection Safety**: Parameterized placeholders eliminate SQL/NoSQL injection risks.
