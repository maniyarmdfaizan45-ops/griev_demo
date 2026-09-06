import re

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

ACTIVE_STATUSES = {"SUBMITTED", "ASSIGNED", "IN_PROGRESS", "REOPENED"}
RELATED_THRESHOLD = 0.50
HIGH_SIMILARITY_THRESHOLD = 0.75
MAX_COMPARISONS = 250
MAX_RESULTS = 3


def normalize_text(text):
    return re.sub(r"\s+", " ", str(text or "").strip().casefold())


def extract_location(text):
    match = re.search(r"(?:^|\n)LOCATION:\s*(.+?)(?:\n|$)", str(text or ""), re.IGNORECASE)
    return normalize_text(match.group(1)) if match else ""


def _score_metadata(text_similarity, new_text, candidate, new_category, new_department):
    score = text_similarity
    reasons = [f"Text similarity {text_similarity:.0%}"]

    if new_category and candidate.get("category") == new_category:
        score += 0.08
        reasons.append("same category")
    if new_department and candidate.get("department") == new_department:
        score += 0.04
        reasons.append("same department")

    new_location = extract_location(new_text)
    candidate_location = extract_location(candidate.get("complaint_text"))
    if new_location and candidate_location and new_location == candidate_location:
        score += 0.12
        reasons.append("same location")
    elif new_location and candidate_location and new_location != candidate_location:
        score -= 0.25
        reasons.append("different location")

    return min(score, 1.0), ", ".join(reasons)


def find_related_complaints(text, category, department, candidates):
    results = []
    active_candidates = [
        candidate for candidate in candidates
        if candidate.get("status") in ACTIVE_STATUSES and candidate.get("complaint_text")
    ][:MAX_COMPARISONS]
    if not active_candidates:
        return results
    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 1))
    vectors = vectorizer.fit_transform([text] + [candidate["complaint_text"] for candidate in active_candidates])
    text_scores = cosine_similarity(vectors[0:1], vectors[1:]).ravel()
    for candidate, text_similarity in zip(active_candidates, text_scores):
        score, reason = _score_metadata(float(text_similarity), text, candidate, category, department)
        if score >= RELATED_THRESHOLD:
            results.append({
                "related_grievance_id": candidate.get("grievance_id"),
                "similarity_score": round(score * 100),
                "text_similarity_score": round(text_similarity * 100),
                "category": candidate.get("category"),
                "department": candidate.get("department"),
                "status": candidate.get("status"),
                "match_reason": reason,
                "match_type": "HIGHLY_SIMILAR" if score >= HIGH_SIMILARITY_THRESHOLD else "POSSIBLY_RELATED",
            })
    results.sort(key=lambda item: item["similarity_score"], reverse=True)
    return results[:MAX_RESULTS]
