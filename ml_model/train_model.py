import csv
import json
import os
import pickle
import re

import pandas as pd
from sklearn.base import clone
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
)
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC


RANDOM_STATE = 42
TEST_SIZE = 0.2
CV_FOLDS = 5
LABEL_ORDER = ["Water", "Electricity", "Road", "Garbage", "Others"]


def normalize_text(text):
    return re.sub(r"\s+", " ", str(text).strip()).casefold()


def build_vectorizer():
    return TfidfVectorizer(
        stop_words="english",
        ngram_range=(1, 2),
        min_df=2,
        sublinear_tf=True,
    )


def build_models():
    return {
        "Multinomial Naive Bayes": MultinomialNB(alpha=0.1),
        "Logistic Regression": LogisticRegression(max_iter=2000, random_state=RANDOM_STATE),
        "Linear SVM": LinearSVC(random_state=RANDOM_STATE),
    }


def check_dataset_integrity(df):
    required_columns = {"complaint_text", "category"}
    missing_columns = required_columns.difference(df.columns)
    if missing_columns:
        raise ValueError(f"Dataset is missing columns: {sorted(missing_columns)}")
    if df[list(required_columns)].isna().any().any():
        raise ValueError("Dataset contains missing complaint text or category values")

    normalized = df["complaint_text"].map(normalize_text)
    if normalized.duplicated().any():
        raise ValueError("Duplicate complaint text detected; evaluation would be optimistic")
    conflicting_labels = df.assign(normalized_text=normalized).groupby("normalized_text")["category"].nunique()
    if (conflicting_labels > 1).any():
        raise ValueError("Contradictory labels detected for the same complaint text")
    unknown_categories = set(df["category"]) - set(LABEL_ORDER)
    if unknown_categories:
        raise ValueError(f"Unexpected categories found: {sorted(unknown_categories)}")


def evaluate_models(X_train, y_train):
    scoring = {
        "accuracy": "accuracy",
        "precision_macro": "precision_macro",
        "recall_macro": "recall_macro",
        "f1_macro": "f1_macro",
    }
    folds = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    results = {}

    for name, classifier in build_models().items():
        pipeline = Pipeline(
            [
                ("tfidf", build_vectorizer()),
                ("classifier", classifier),
            ]
        )
        scores = cross_validate(
            pipeline,
            X_train,
            y_train,
            cv=folds,
            scoring=scoring,
            return_train_score=False,
            n_jobs=None,
        )
        results[name] = {
            metric: {
                "mean": float(scores[f"test_{metric}"].mean()),
                "std": float(scores[f"test_{metric}"].std()),
            }
            for metric in scoring
        }

    # Model selection uses only mean training-set CV accuracy. Dict insertion order
    # makes ties deterministic without consulting the untouched test set.
    best_name = max(results, key=lambda name: results[name]["accuracy"]["mean"])
    return results, best_name


def print_cv_results(results):
    print("\nCROSS-VALIDATION RESULTS (TRAINING DATA ONLY)")
    for name, metrics in results.items():
        accuracy = metrics["accuracy"]
        print(
            f"{name}: accuracy {accuracy['mean']:.4f} "
            f"+/- {accuracy['std']:.4f}; "
            f"macro F1 {metrics['f1_macro']['mean']:.4f}"
        )


def write_confusion_matrix(path, matrix):
    with open(path, "w", newline="", encoding="utf-8") as matrix_file:
        writer = csv.writer(matrix_file)
        writer.writerow(["actual\\predicted", *LABEL_ORDER])
        writer.writerows(
            [label, *row]
            for label, row in zip(LABEL_ORDER, matrix.tolist())
        )


def train_pipeline(data_path, model_path, vectorizer_path):
    print("--- Starting Leakage-Safe ML Training Pipeline ---")
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Dataset not found at {data_path}")

    df = pd.read_csv(data_path)
    check_dataset_integrity(df)
    X = df["complaint_text"]
    y = df["category"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=y,
    )
    train_texts = {normalize_text(text) for text in X_train}
    test_texts = {normalize_text(text) for text in X_test}
    overlap = train_texts.intersection(test_texts)
    if overlap:
        raise ValueError(f"Train/test complaint overlap detected: {len(overlap)} texts")

    print(f"Dataset: {len(df)} samples, {y.nunique()} categories")
    print(f"Train: {len(X_train)} | Test: {len(X_test)}")
    print("Training category counts:\n", y_train.value_counts().reindex(LABEL_ORDER))
    print("Test category counts:\n", y_test.value_counts().reindex(LABEL_ORDER))

    cv_results, best_name = evaluate_models(X_train, y_train)
    print_cv_results(cv_results)
    print(f"\nSelected model by mean CV accuracy: {best_name}")

    # Fit TF-IDF only on the training split. The untouched test split is transformed
    # below using this same fitted vectorizer.
    vectorizer = build_vectorizer()
    X_train_vectorized = vectorizer.fit_transform(X_train)
    X_test_vectorized = vectorizer.transform(X_test)
    final_classifier = clone(build_models()[best_name])
    final_classifier.fit(X_train_vectorized, y_train)
    y_pred = final_classifier.predict(X_test_vectorized)

    accuracy = accuracy_score(y_test, y_pred)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_test, y_pred, labels=LABEL_ORDER, zero_division=0
    )
    weighted = precision_recall_fscore_support(
        y_test, y_pred, average="weighted", zero_division=0
    )
    macro = precision_recall_fscore_support(
        y_test, y_pred, average="macro", zero_division=0
    )
    matrix = confusion_matrix(y_test, y_pred, labels=LABEL_ORDER)

    print("\nMODEL EVALUATION")
    print(f"Dataset: {len(df)} samples, {y.nunique()} categories")
    print(f"Train: {len(X_train)}")
    print(f"Test: {len(X_test)}")
    print(f"Best Model: {best_name}")
    print(f"Test Accuracy: {accuracy:.4f} ({accuracy * 100:.2f}%)")
    print(f"Macro Precision: {macro[0]:.4f}")
    print(f"Macro Recall: {macro[1]:.4f}")
    print(f"Macro F1: {macro[2]:.4f}")
    print(f"Weighted Precision: {weighted[0]:.4f}")
    print(f"Weighted Recall: {weighted[1]:.4f}")
    print(f"Weighted F1: {weighted[2]:.4f}")
    print(
        "Cross-validation Accuracy: "
        f"{cv_results[best_name]['accuracy']['mean']:.4f} +/- "
        f"{cv_results[best_name]['accuracy']['std']:.4f}"
    )
    print("\nCLASSIFICATION REPORT")
    print(classification_report(y_test, y_pred, labels=LABEL_ORDER, zero_division=0))
    print("CONFUSION MATRIX (rows=actual, columns=predicted)")
    print(pd.DataFrame(matrix, index=LABEL_ORDER, columns=LABEL_ORDER))

    output_directory = os.path.dirname(model_path) or "."
    confusion_path = os.path.join(output_directory, "confusion_matrix.csv")
    report_path = os.path.join(output_directory, "evaluation_report.json")
    write_confusion_matrix(confusion_path, matrix)

    report = classification_report(
        y_test, y_pred, labels=LABEL_ORDER, output_dict=True, zero_division=0
    )
    evaluation = {
        "random_state": RANDOM_STATE,
        "test_size": TEST_SIZE,
        "cv_folds": CV_FOLDS,
        "dataset_samples": len(df),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "selected_model": best_name,
        "cv_results": cv_results,
        "test_accuracy": float(accuracy),
        "test_macro_precision": float(macro[0]),
        "test_macro_recall": float(macro[1]),
        "test_macro_f1": float(macro[2]),
        "test_weighted_precision": float(weighted[0]),
        "test_weighted_recall": float(weighted[1]),
        "test_weighted_f1": float(weighted[2]),
        "classification_report": report,
        "train_test_text_overlap": len(overlap),
    }
    with open(report_path, "w", encoding="utf-8") as report_file:
        json.dump(evaluation, report_file, indent=2)

    # Preserve the backend contract: it loads a classifier and vectorizer separately.
    with open(model_path, "wb") as model_file:
        pickle.dump(final_classifier, model_file)
    with open(vectorizer_path, "wb") as vectorizer_file:
        pickle.dump(vectorizer, vectorizer_file)

    print(f"Saved classifier to: {model_path}")
    print(f"Saved TF-IDF vectorizer to: {vectorizer_path}")
    print(f"Saved confusion matrix to: {confusion_path}")
    print(f"Saved evaluation report to: {report_path}")
    print("--- ML Training Pipeline Complete ---")


if __name__ == "__main__":
    train_pipeline("dataset.csv", "model.pkl", "vectorizer.pkl")
