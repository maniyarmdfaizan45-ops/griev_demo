# AI-Based Smart Public Grievance Management System
### Final Year Engineering Project Submission

GrievanceAI is a complete, production-ready municipal ticket management portal. It utilizes Natural Language Processing (NLP) to classify public grievances (Water, Electricity, Road, Garbage, and Others) and Sentiment Analysis to calculate urgency levels (High, Medium, and Low) in real-time.

---

## 🚀 Key Features

* **Real-time AI Categorization**: Evaluates description patterns using TF-IDF feature weights and a Multinomial Naive Bayes classifier.
* **Severity Urgency Indexing**: Uses NLTK VADER to gauge citizen frustration, automatically flagging highly negative complaints as High Priority.
* **Hybrid Database Controller**: Integrates with MongoDB Atlas cloud, with automatic local SQLite fallback (`complaints.db`) for offline demonstration.
* **Admin Dashboard Analytics**: Displays intake trend vectors, severity breakdowns, and department loads using Recharts.
* **Secure JWT Session Guard**: Secures administrative controls behind token authorization.

---

## 🛠️ Technology Stack

* **Frontend**: React.js, Tailwind CSS, Axios client, Lucide Icons, Recharts widgets.
* **Backend**: Python Flask REST API server, Flask-CORS middleware, PyJWT authorization.
* **Machine Learning**: `scikit-learn` Multinomial Naive Bayes, `pandas`, `TfidfVectorizer`, NLTK VADER.
* **Database**: MongoDB Atlas Cluster OR local SQLite.

---

## 📁 Repository Structure

```
project-root/
│
├── frontend/                     # React + Tailwind SPA Frontend
│   ├── src/
│   │   ├── components/           # Navbar, Footer
│   │   ├── pages/                # Home, Submit, History, Login, Dashboard
│   │   ├── services/             # Axios API Client
│   │   ├── App.jsx               # Client Routing
│   │   └── index.css             # Stylesheet
│   └── package.json
│
├── backend/                      # Python Flask Server
│   ├── app.py                    # Entry Server
│   ├── database.py               # Hybrid DB Adapter
│   ├── classifier.py             # ML Inference & Sentiment Analyzer
│   ├── auth.py                   # JWT Auth middleware
│   └── requirements.txt
│
├── ml_model/                     # Machine Learning Pipeline
│   ├── generate_dataset.py       # Dataset Generator script
│   ├── train_model.py            # Model Training pipeline
│   ├── dataset.csv               # 325-sample CSV
│   ├── model.pkl                 # Naive Bayes binary
│   └── vectorizer.pkl            # TF-IDF Vectorizer binary
│
├── docs/                         # Technical Specs
│   ├── architecture.md           # DFD & Schemas
│   └── viva_preparation.md       # 40+ Viva Voce Q&As
│
└── README.md                     # Main Guide
```

---

## ⚙️ Installation and Setup (Local)

Follow these steps to run the complete system locally.

### Prerequisites
* **Node.js** (v18+)
* **Python** (3.8+)
* **npm** or yarn package managers.

---

### Step 1: Set up the Python Backend & Train the Model

1. Navigate to the root directory and create a Python virtual environment:
   ```bash
   py -m venv venv
   ```
2. Activate the environment:
   * **Windows Powershell**:
     ```bash
     .\venv\Scripts\Activate.ps1
     ```
   * **Linux/macOS**:
     ```bash
     source venv/bin/activate
     ```
3. Install backend packages:
   ```bash
   pip install -r backend/requirements.txt
   ```
4. Move into the `ml_model` directory to generate the training data and compile the classifier:
   ```bash
   python ml_model/generate_dataset.py
   python ml_model/train_model.py
   ```
   *Note: This will output `model.pkl` and `vectorizer.pkl` into the `ml_model/` folder.*

---

### Step 2: Configure Environment Variables

Create a `.env` file in the `backend/` directory to configure variables:

```env
# Server settings
PORT=5000
FLASK_ENV=development

# JWT Secret Key
JWT_SECRET_KEY=my_secure_grievance_key_9988

# Database Config (Optional)
# If MONGO_URI is omitted, the server automatically falls back to local SQLite (complaints.db)
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority
MONGO_DB_NAME=grievance_system

# Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

---

### Step 3: Run the Backend Flask API Server

With the virtual environment active, run the entry server:
```bash
python backend/app.py
```
*The API will start running at: `http://localhost:5000`*

---

### Step 4: Run the React Frontend

1. Open a new terminal session and navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   *The React client will launch at: `http://localhost:5173`*

---

## 🌐 Production Deployment Guide

### Database (MongoDB Atlas)
1. Register for a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Whitelist `0.0.0.0/0` in Network Access.
3. Obtain the connection string URI and set it as `MONGO_URI` in the backend environment variables.

### Backend (Render / Heroku)
1. Push the code to a Git repository.
2. Link the repository to [Render](https://render.com) and create a **Web Service**.
3. Set the **Start Command** to: `gunicorn backend.app:app` (ensure you add `gunicorn` to backend requirements.txt).
4. Add all environment variables in the Dashboard.

### Frontend (Vercel / Netlify)
1. Link your repository to [Vercel](https://vercel.com).
2. Set the **Build Command** to: `npm run build`.
3. Set the **Output Directory** to: `dist`.
4. Configure environmental parameters: `VITE_API_URL` pointing to your deployed backend URL (e.g. `https://my-backend-app.onrender.com/api`).
