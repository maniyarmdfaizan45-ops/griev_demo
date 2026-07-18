# Viva Voce Examination Preparation Guide
## Project: AI-Based Smart Public Grievance Management System

This guide compiles critical questions and answers to prepare for the final year engineering project defense and viva presentation.

---

### Part 1: System Overview & Architecture

#### Q1: What is the main objective of this project?
**A:** The primary objective is to build an automated citizen portal that processes public complaints in real-time. By utilizing Natural Language Processing (NLP) and Sentiment Analysis, the system eliminates manual triaging by instantly classifying the grievance department (Water, Electricity, Road, etc.) and rating its urgency priority (High, Medium, Low) to streamline municipal routing.

#### Q2: Explain the system's end-to-end data flow.
**A:** 
1. **Submit**: A citizen submits a text grievance through the React SPA frontend.
2. **Predict**: The React client makes a REST API request to the Flask server.
3. **Analyze**: The backend passes the text to the ML model (TfidfVectorizer + Multinomial Naive Bayes) to extract the department category, and NLTK VADER to determine the priority based on sentiment compound score.
4. **Persist**: The backend saves the structured log (complaint text, category, priority, sentiment, status, date) into MongoDB Atlas (or SQLite fallback).
5. **Manage**: Administrators log in using JWT credentials, view data trends via Recharts, and resolve pending issues.

#### Q3: Why did you choose Python Flask for the backend?
**A:** Flask is a lightweight WSGI web application framework. It provides modular architecture and allows easy integration with Python's machine learning ecosystem (`scikit-learn`, `pandas`, `nltk`) via simple REST endpoints, making it perfect for rapid AI API serving.

#### Q4: Explain the "Database Adapter Pattern" implemented in this project.
**A:** To ensure maximum portability, we wrote a unified database manager class (`GrievanceDB`). Upon server startup, it attempts to connect to MongoDB Atlas using the `MONGO_URI` environment variable. If the URI is missing or the connection times out, it logs a warning and automatically instantiates a local SQLite database (`complaints.db`). This ensures the app works offline/out-of-the-box for examiners without database dependencies.

---

### Part 2: Machine Learning & NLP Concepts

#### Q5: What is Natural Language Processing (NLP)?
**A:** NLP is a branch of artificial intelligence that enables computers to understand, interpret, and manipulate human language. In this project, NLP is used for text preprocessing, feature extraction, and text classification.

#### Q6: What text preprocessing steps are performed before training?
**A:** Text is converted to lowercase, stripped of unnecessary formatting, tokenized into words, and passed to a TF-IDF vectorizer which automatically filters out common English "stopwords" (e.g. "is", "the", "and") which carry no category-specific signal.

#### Q7: What is TF-IDF and how does it work?
**A:** TF-IDF stands for **Term Frequency-Inverse Document Frequency**. It is a statistical measure used to evaluate how important a word is to a document in a corpus.
- **Term Frequency (TF)**: Measures how frequently a term occurs in a document: 
  $$\text{TF}(t, d) = \frac{\text{Number of times term } t \text{ appears in document } d}{\text{Total number of terms in document } d}$$
- **Inverse Document Frequency (IDF)**: Measures how common or rare a word is across all documents:
  $$\text{IDF}(t, D) = \log\left(\frac{\text{Total number of documents } |D|}{\text{Number of documents containing term } t}\right)$$
- **TF-IDF Weight**: $\text{TF-IDF} = \text{TF} \times \text{IDF}$. High weights occur when a term appears frequently in a single document but rarely across the whole corpus.

#### Q8: Why did you use Multinomial Naive Bayes for classification?
**A:** Naive Bayes is a probabilistic classifier based on Bayes' Theorem. The **Multinomial** variant is specifically suited for text classification because it models term frequency counts directly. It is computationally fast, requires minimal training data compared to deep learning models, has low memory overhead, and acts as an excellent, highly-accurate baseline.

#### Q9: State the mathematical formula for Naive Bayes.
**A:** Bayes' Theorem calculates the posterior probability of a class $C$ given feature vector $X$:
$$P(C|X) = \frac{P(X|C) \cdot P(C)}{P(X)}$$
Where:
- $P(C|X)$ is the posterior probability.
- $P(X|C)$ is the likelihood of features given class.
- $P(C)$ is the prior probability of class.
- $P(X)$ is the prior probability of the predictor (constant scaling factor).

#### Q10: What is the "Naive" assumption in Naive Bayes?
**A:** It assumes that all input features (words in this case) are completely independent of each other, given the class label. While this is rarely true in natural languages (word order matters), the model still performs remarkably well for classification tasks.

#### Q11: What is Laplace Smoothing (alpha parameter)?
**A:** If the model encounters a word during testing that did not appear in the training set for a specific category, the conditional probability would be zero ($P(word|category) = 0$), causing the entire posterior product to collapse to zero. Laplace Smoothing adds a small constant ($\alpha=0.1$ or $1.0$) to the numerator and denominator to ensure no probability is ever absolute zero.

#### Q12: How did you evaluate your classification model?
**A:** We split the dataset into an 80% training set and a 20% test set using stratified sampling (maintaining category balance). We achieved an accuracy of approximately **95%** on the test set. We also generated a **Classification Report** detailing Precision, Recall, and F1-Score for each department.

#### Q13: Define Precision, Recall, and F1-Score.
**A:**
- **Precision**: Of all complaints predicted for a category, how many were actually correct? 
  $$\text{Precision} = \frac{\text{True Positives}}{\text{True Positives} + \text{False Positives}}$$
- **Recall (Sensitivity)**: Of all actual complaints in a category, how many did the model find?
  $$\text{Recall} = \frac{\text{True Positives}}{\text{True Positives} + \text{False Negatives}}$$
- **F1-Score**: The harmonic mean of precision and recall:
  $$\text{F1} = 2 \times \frac{\text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}}$$

---

### Part 3: Sentiment Analysis & Priority Prediction

#### Q14: How is priority calculated in your system?
**A:** We utilize NLTK's **VADER (Valence Aware Dictionary and sEntiment Reasoner)** lexicon-based sentiment intensity analyzer. It parses the description text and assigns an overall polarity score (Compound score) from -1 (extremely negative/angry) to +1 (extremely positive).
- **High Priority**: Compound score $\le -0.15$ (strong negative valence, indicates critical distress).
- **Medium Priority**: $-0.15 < \text{Compound score} < 0.15$ (neutral description).
- **Low Priority**: Compound score $\ge 0.15$ (constructive, positive, or polite suggestions).

#### Q15: Why is VADER chosen over standard machine learning sentiment models?
**A:** VADER is a rule-based model specifically tuned to sentiments expressed in short text segments, social media, and feedback. It handles punctuation (e.g., exclamation marks increase intensity), capitalization (e.g. "URGENT"), and contrastive conjunctions (e.g., "but") without needing heavy ML training datasets or downloading giant neural networks, making it lightweight and highly accurate for civic complaints.

---

### Part 4: Web Development & Security

#### Q16: Explain REST APIs.
**A:** REST stands for **Representational State Transfer**. It is an architectural style for designing networked applications. It relies on stateless, client-server communication using standard HTTP methods:
- `POST` to submit resource details (e.g., submit grievance).
- `GET` to fetch resources (e.g., retrieve grievance lists or metrics).
- `PUT` to modify resources (e.g., resolve complaint status).

#### Q17: What is CORS and why is it needed?
**A:** CORS stands for **Cross-Origin Resource Sharing**. It is a browser security mechanism that restricts scripts from making HTTP requests to a different domain than the one that served the web page. Since React runs on `http://localhost:5173` and Flask runs on `http://localhost:5000`, the browser blocks API calls unless CORS is enabled in Flask using `Flask-CORS`.

#### Q18: How does JWT Authentication work in your system?
**A:** 
1. **Login**: The admin submits credentials to `/api/auth/login`.
2. **Issue**: The Flask server validates credentials and creates a JSON Web Token (JWT) containing standard claims (identity, expiration) encrypted with a server secret key.
3. **Store**: React receives the token and stores it in `localStorage`.
4. **Attach**: For secure routes (e.g., fetching stats or updating ticket statuses), React automatically attaches the token in the `Authorization: Bearer <token>` header.
5. **Verify**: Flask uses a custom Python decorator (`@token_required`) to intercept the request, decode the token, check expiration, and authorize access.

#### Q19: What are the three parts of a JWT token?
**A:** A JWT is separated by dots (`.`) into:
1. **Header**: Contains the algorithm (HS256) and token type (JWT).
2. **Payload**: Contains the claims (e.g., sub/identity, expiration, issued-at).
3. **Signature**: Cryptographic hash created by signing header and payload with the secret key to verify tampering.
