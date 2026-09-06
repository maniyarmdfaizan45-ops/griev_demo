import os
import pickle
import re
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
    PRIORITY_THRESHOLDS = {
        "HIGH": 70,
        "MEDIUM": 40,
    }

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
        """Return the legacy priority and sentiment tuple for existing callers."""
        details = self.analyze_priority_details(text)
        return details["priority"], details["sentiment_score"]

    def analyze_priority_details(self, text):
        """Calculate an explainable urgency score without making sentiment decisive."""
        text_lower = text.casefold()
        sentiment_score = self.sia.polarity_scores(text).get("compound", 0.0)
        score = 5
        reasons = []

        severity_rules = [
            (r"\b(exposed|live|hanging|fallen)\s+(?:electrical\s+)?wire\b|\belectric(?:al|ity)\s+(?:wire|cable)\b", 35, "Electrical hazard detected"),
            (r"\b(contaminated|unsafe|dirty|muddy)\s+(?:drinking\s+)?water\b|\b(?:drinking\s+)?water\s+(?:is|seems)\s+(?:contaminated|unsafe|dirty|muddy)\b|\bsewage\b", 30, "Public health risk detected"),
            (r"\bfalling sick\b", 25, "Possible illness outbreak detected"),
            (r"\b(accident(?:s)?|injur(?:y|ies)|dangerous|hazardous|emergency|life threatening|unsafe)\b|\bchildren\s+(?:are\s+)?walking underneath\b", 25, "Immediate safety risk detected"),
            (r"\b(major|deep|large)\s+pothole\b|\bblocking ambulances\b|\broad\s+(?:is\s+)?impassable\b", 30, "Significant road hazard detected"),
            (r"\bentire\s+(?:area|neighbou?rhood|colony|block)\b.{0,40}\b(?:no|without)\s+(?:power|electricity)\b", 25, "Widespread power outage detected"),
            (r"\boverflow(?:ed|ing)\b|\bgarbage\s+(?:pile|heap)\b|\bflies\b|\bmosquito(?:es)?\b", 30, "Sanitation risk detected"),
        ]
        severity_score = 0
        for pattern, points, reason in severity_rules:
            if re.search(pattern, text_lower):
                severity_score += points
                reasons.append(reason)
        score += min(severity_score, 50)

        service_patterns = [
            r"\bno\s+(?:water|power|electricity)\b",
            r"\b(?:power|electricity)\s+(?:has\s+been\s+)?(?:out|cut)\b",
            r"\b(?:water|electricity)\s+supply\s+(?:has\s+)?(?:stopped|cut off)\b",
            r"\bgarbage\s+(?:has\s+)?not\s+been\s+collected\b",
            r"\bcollection\s+truck\s+(?:has\s+)?(?:missed|skipped)\b",
        ]
        if any(re.search(pattern, text_lower) for pattern in service_patterns):
            score += 25
            reasons.append("Essential service disruption detected")

        duration_points = self._duration_points(text_lower)
        if duration_points:
            score += duration_points
            reasons.append("Ongoing or prolonged issue detected")

        affected_patterns = [
            r"\bentire\s+(?:area|neighbou?rhood|colony|block)\b",
            r"\bwhole\s+(?:area|neighbou?rhood|colony|block)\b",
            r"\b(?:many|several|hundreds of)\s+(?:families|households|residents|people)\b",
            r"\bpublic\b|\bchildren\b|\bmultiple\b|\b(?:hospital|ambulance|footpath|street)\b",
        ]
        if any(re.search(pattern, text_lower) for pattern in affected_patterns):
            score += 12
            reasons.append("Multiple people potentially affected")

        if sentiment_score <= -0.6:
            score += 8
        elif sentiment_score <= -0.3:
            score += 5
        elif sentiment_score <= -0.15:
            score += 3
        if sentiment_score <= -0.15:
            reasons.append("Negative sentiment supports urgency assessment")

        score = min(score, 100)
        if score >= self.PRIORITY_THRESHOLDS["HIGH"]:
            priority = "High"
        elif score >= self.PRIORITY_THRESHOLDS["MEDIUM"]:
            priority = "Medium"
        else:
            priority = "Low"

        if not reasons:
            reasons.append("No significant safety, health, duration, or service risk detected")

        return {
            "priority": priority,
            "priority_score": score,
            "priority_reason": "; ".join(reasons),
            "sentiment_score": sentiment_score,
        }

    @staticmethod
    def _duration_points(text):
        if re.search(r"\b(?:for|over)\s+(?:several|many|multiple|\d+|one|two|three|four|five|six|seven|ten|fifteen|twenty)\s+(?:months?|years?)\b", text):
            return 20
        if re.search(r"\b(?:for|over)\s+(?:several|many|multiple|\d+|one|two|three|four|five|six|seven|ten|fifteen|twenty)\s+weeks?\b", text):
            return 15
        if re.search(r"\b(?:for|over)\s+(?:several|many|multiple|\d+|one|two|three|four|five|six|seven|ten|fifteen|twenty)\s+days?\b", text):
            return 12
        if re.search(r"\b(?:since yesterday|since last night|since Monday|ongoing|repeatedly|every day|every evening)\b", text):
            return 8
        return 0

    def get_full_analysis(self, text):
        category = self.predict_category(text)
        priority_details = self.analyze_priority_details(text)
        return {
            "complaint_text": text,
            "category": category,
            "priority": priority_details["priority"],
            "priority_score": priority_details["priority_score"],
            "priority_reason": priority_details["priority_reason"],
            "sentiment_score": priority_details["sentiment_score"],
        }
