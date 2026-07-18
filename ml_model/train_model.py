import os
import pickle
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import accuracy_score, classification_report

def train_pipeline(data_path, model_path, vectorizer_path):
    print("--- Starting Machine Learning Training Pipeline ---")
    
    # 1. Load Dataset
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Dataset not found at {data_path}. Please run generate_dataset.py first.")
        
    df = pd.read_csv(data_path)
    print(f"Loaded dataset containing {len(df)} samples.")
    print("Class distribution:\n", df['category'].value_counts())
    
    # 2. Text Preprocessing and Vectorization
    # We use TF-IDF with english stop words and a range of unigrams and bigrams
    vectorizer = TfidfVectorizer(
        stop_words='english',
        ngram_range=(1, 2),
        min_df=2,
        sublinear_tf=True
    )
    
    X = df['complaint_text']
    y = df['category']
    
    # 3. Train-Test Split (for Evaluation)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    # Fit vectorizer on train data
    X_train_vectorized = vectorizer.fit_transform(X_train)
    X_test_vectorized = vectorizer.transform(X_test)
    
    # 4. Train Multinomial Naive Bayes Classifier
    classifier = MultinomialNB(alpha=0.1) # Add a small smoothing parameter
    classifier.fit(X_train_vectorized, y_train)
    
    # 5. Evaluate Model
    y_pred = classifier.predict(X_test_vectorized)
    accuracy = accuracy_score(y_test, y_pred)
    
    print(f"\nEvaluation Results (Test Set Size: {len(y_test)}):")
    print(f"Accuracy: {accuracy:.4f} ({accuracy * 100:.2f}%)")
    print("\nClassification Report:\n", classification_report(y_test, y_pred))
    
    # 6. Fit on FULL Dataset for production deployment
    print("Training model on the complete dataset for production export...")
    X_full_vectorized = vectorizer.fit_transform(X)
    final_classifier = MultinomialNB(alpha=0.1)
    final_classifier.fit(X_full_vectorized, y)
    
    # 7. Serialize and Save Objects
    with open(model_path, 'wb') as model_file:
        pickle.dump(final_classifier, model_file)
    with open(vectorizer_path, 'wb') as vec_file:
        pickle.dump(vectorizer, vec_file)
        
    print(f"Successfully saved final model to: {model_path}")
    print(f"Successfully saved final vectorizer to: {vectorizer_path}")
    print("--- ML Training Pipeline Complete ---")

if __name__ == "__main__":
    # Define local paths
    data_file = "dataset.csv"
    model_file = "model.pkl"
    vec_file = "vectorizer.pkl"
    
    train_pipeline(data_file, model_file, vec_file)
