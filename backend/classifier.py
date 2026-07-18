import os
import pickle
import nltk
from nltk.sentiment.vader import SentimentIntensityAnalyzer

# Automatically download VADER lexicon if not already present
try:
    # Test if lexicon exists
    nltk.data.find('sentiment/vader_lexicon.zip')
except LookupError:
    print("[INFO] NLTK VADER Lexicon not found. Downloading...")
    nltk.download('vader_lexicon', quiet=True)

class ComplaintClassifier:
    def __init__(self):
        # Locate pickle paths dynamically
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(backend_dir)
        self.model_path = os.path.join(project_root, "ml_model", "model.pkl")
        self.vectorizer_path = os.path.join(project_root, "ml_model", "vectorizer.pkl")
        
        self.model = None
        self.vectorizer = None
        self.sia = SentimentIntensityAnalyzer()
        
        self.load_model()

    def load_model(self):
        if os.path.exists(self.model_path) and os.path.exists(self.vectorizer_path):
            try:
                with open(self.model_path, 'rb') as mf:
                    self.model = pickle.load(mf)
                with open(self.vectorizer_path, 'rb') as vf:
                    self.vectorizer = pickle.load(vf)
                print("[INFO] Machine Learning model and vectorizer loaded successfully.")
            except Exception as e:
                print(f"[ERROR] Failed to load model pickles: {e}")
                print("Will use fallback keyword-based classifier.")
        else:
            print("[WARNING] Model or Vectorizer pickle files not found!")
            print(f"  Missing: {self.model_path if not os.path.exists(self.model_path) else ''} "
                  f"{self.vectorizer_path if not os.path.exists(self.vectorizer_path) else ''}")
            print("  Please run 'python train_model.py' inside the 'ml_model' folder.")
            print("  Backend will temporarily use a keyword-based fallback classifier.")

    def keyword_fallback(self, text):
        """Simple rule-based classification when ML pickle is not yet built."""
        text_lower = text.lower()
        if any(w in text_lower for w in ["water", "pipe", "leak", "tap", "drinking", "drainage", "sewage"]):
            return "Water"
        elif any(w in text_lower for w in ["power", "electricity", "light", "transformer", "wire", "voltage", "current"]):
            return "Electricity"
        elif any(w in text_lower for w in ["road", "pothole", "highway", "divider", "manhole", "construction", "street"]):
            return "Road"
        elif any(w in text_lower for w in ["garbage", "trash", "waste", "dustbin", "litter", "sweep", "dump"]):
            return "Garbage"
        else:
            return "Others"

    def predict_category(self, text):
        # Reload model if it wasn't loaded initially but now exists
        if self.model is None or self.vectorizer is None:
            self.load_model()
            
        if self.model is not None and self.vectorizer is not None:
            try:
                text_vectorized = self.vectorizer.transform([text])
                prediction = self.model.predict(text_vectorized)
                return prediction[0]
            except Exception as e:
                print(f"[ERROR] Inference failed: {e}. Falling back to keywords...")
                return self.keyword_fallback(text)
        else:
            return self.keyword_fallback(text)

    def analyze_priority(self, text):
        """
        Uses NLTK VADER to score complaint sentiment:
        - Compound score measures overall sentiment (from -1 to 1).
        - Very negative complaints (score <= -0.15) represent high urgency -> High Priority
        - Mildly negative/neutral (-0.15 < score < 0.15) -> Medium Priority
        - Positive/constructive feedback (score >= 0.15) -> Low Priority
        """
        scores = self.sia.polarity_scores(text)
        compound = scores.get('compound', 0.0)
        
        if compound <= -0.15:
            priority = "High"
        elif compound < 0.15:
            priority = "Medium"
        else:
            priority = "Low"
            
        return priority, compound

    def get_full_analysis(self, text):
        category = self.predict_category(text)
        priority, score = self.analyze_priority(text)
        return {
            "complaint_text": text,
            "category": category,
            "priority": priority,
            "sentiment_score": score
        }
