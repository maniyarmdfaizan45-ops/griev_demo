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
,,,

