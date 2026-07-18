# System Architecture and Design Specifications
## Project: AI-Based Smart Public Grievance Management System

This document outlines the technical design, data schema models, and component diagrams of the application.

---

## 1. System Architecture Overview

The system is designed around a decoupled, three-tier architecture:

```mermaid
graph TD
    subgraph Client Tier [React SPA Frontend]
        UI[Tailwind CSS UI Panels]
        RC[React Router & Axios]
        CH[Recharts Analytics]
    end

    subgraph Logic Tier [Flask REST API Backend]
        API[Flask Server]
        Auth[JWT JWT Decorator]
        Classifier[TF-IDF + Naive Bayes Classifier]
        Sentiment[VADER Sentiment Analyzer]
    end

    subgraph Storage Tier [Hybrid DB Adapter]
        Adapter{GrievanceDB Adapter}
        Mongo[(MongoDB Atlas Cluster)]
        SQLite[(Local SQLite db)]
    end

    UI -->|JSON Data| RC
    RC -->|HTTP REST Request| API
    API --> Auth
    API -->|Features extraction| Classifier
    API -->|Frustration parsing| Sentiment
    API --> Adapter
    Adapter -->|Primary Connection| Mongo
    Adapter -->|Fallback Offline| SQLite
    CH <--|GET stats| RC
```

---

## 2. Component Design & Responsibilities

### A. Frontend Single Page Application (React)
- **Citizens Access**: Submit complaints, request real-time categorization previews, and review the public ledger of municipal tickets.
- **Administrators Access**: Secured via JWT tokens. Dashboard showing category distribution (Pie Chart), priority severity (Bar Chart), cumulative daily intake (Line Chart), and status management control panels.
- **State & HTTP Handling**: Manages local data queues with custom Axios interceptors injecting auth authorization tokens automatically.

### B. REST API Backend (Flask)
- **Prediction Worker**: Exposes stateless `/api/predict` endpoints doing fast vector transformations and return prediction preview JSON structures.
- **CRUD Operations**: Connects endpoints for submitting grievances, listing records with parameters, and updating statuses.
- **Security Interceptor**: Protects admin-facing routers verifying cryptographically signed JWT hashes.

### C. Artificial Intelligence Pipeline
- **Vectorizer**: Pre-loaded `vectorizer.pkl` processes inputs to extract token frequencies using the TF-IDF formula.
- **Categorization**: Multinomial Naive Bayes `model.pkl` calculates class likelihoods.
- **Priority Evaluator**: NLTK VADER calculates sentiment polarity coefficients.

---

## 3. Database Schema Layout

The database uses a unified, document-like flat schema designed to match both MongoDB BSON documents and SQLite tabular columns.

### Grievance Data Schema

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | String | Primary Key, Unique | Unique UUID / ObjectId string identifying the grievance. |
| `complaint_text` | String | Not Null, Min 15 chars | Full detailed description submitted by the citizen. |
| `category` | String | Not Null | Predicted department: `Water`, `Electricity`, `Road`, `Garbage`, `Others`. |
| `priority` | String | Not Null | Calculated priority rating: `High`, `Medium`, `Low`. |
| `sentiment_score` | Float | Not Null | VADER compound sentiment coefficient (between -1.0 and 1.0). |
| `status` | String | Not Null, default: `Pending` | Resolution milestone status: `Pending`, `In Progress`, `Resolved`. |
| `timestamp` | String | Not Null | ISO-8601 UTC date-time string indicating submission time. |

---

## 4. Operational API Specs

### 1. Authenticate Admin Login
- **Endpoint**: `POST /api/auth/login`
- **Request Body**:
  ```json
  {
    "username": "admin",
    "password": "admin123"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "username": "admin",
      "role": "Administrator"
    }
  }
  ```

### 2. Predict Grievance Preview
- **Endpoint**: `POST /api/predict`
- **Request Body**:
  ```json
  {
    "complaint_text": "Water pipeline is leaking on High Street"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "data": {
      "complaint_text": "Water pipeline is leaking on High Street",
      "category": "Water",
      "priority": "High",
      "sentiment_score": -0.42
    }
  }
  ```

### 3. Retrieve Grievance Ledger
- **Endpoint**: `GET /api/get-complaints`
- **Query Parameters**:
  - `search` (optional keyword)
  - `category` (optional: Water/Road/etc)
  - `priority` (optional: High/Medium/Low)
  - `status` (optional: Pending/In Progress/Resolved)
  - `page` (integer pagination, default 1)
  - `limit` (records per page, default 10)
- **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "complaints": [
      {
        "id": "e0d0246a-7965-4f30-84eb-c962b9bdff70",
        "complaint_text": "Water pipeline is leaking on High Street",
        "category": "Water",
        "priority": "High",
        "sentiment_score": -0.42,
        "status": "Pending",
        "timestamp": "2026-07-16T19:53:00.123Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10
  }
  ```
