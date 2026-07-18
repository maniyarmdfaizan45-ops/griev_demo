import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import local modules
from database import GrievanceDB
from classifier import ComplaintClassifier
from auth import encode_auth_token, token_required

app = Flask(__name__)
# Enable CORS for frontend cross-origin requests
CORS(app)

# Initialize Database and AI Classifier
db = GrievanceDB()
classifier = ComplaintClassifier()

# Default admin credentials
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

@app.route('/', methods=['GET'])
def root():
    """Simple root endpoint for the backend service."""
    return jsonify({
        "status": "ok",
        "message": "GrievanceAI backend is running. Use /health or /api/* endpoints.",
        "routes": ["/health", "/api/auth/login", "/api/predict", "/api/submit-complaint", "/api/get-complaints"]
    }), 200

@app.route('/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({
        "status": "healthy",
        "database": db.db_type
    }), 200

@app.route('/api/auth/login', methods=['POST'])
def login():
    """
    Endpoint for Admin login. Validates credentials and returns JWT token
    """
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({
            "status": "error",
            "message": "Missing username or password"
        }), 400
        
    username = data.get('username')
    password = data.get('password')
    
    if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
        token = encode_auth_token(username)
        return jsonify({
            "status": "success",
            "message": "Login successful",
            "token": token,
            "user": {
                "username": username,
                "role": "Administrator"
            }
        }), 200
    else:
        return jsonify({
            "status": "error",
            "message": "Invalid username or password"
        }), 401

@app.route('/api/predict', methods=['POST'])
def predict():
    """
    Endpoint for real-time classification and sentiment analysis.
    Does not save to database.
    """
    data = request.get_json()
    if not data or 'complaint_text' not in data:
        return jsonify({
            "status": "error",
            "message": "Complaint text is required"
        }), 400
        
    text = data.get('complaint_text')
    if not text.strip():
        return jsonify({
            "status": "error",
            "message": "Complaint text cannot be empty"
        }), 400
        
    analysis = classifier.get_full_analysis(text)
    
    return jsonify({
        "status": "success",
        "data": analysis
    }), 200

@app.route('/api/submit-complaint', methods=['POST'])
def submit_complaint():
    """
    Endpoint to submit and save a complaint.
    Automatically classifies the complaint if category/priority are not provided.
    """
    data = request.get_json()
    if not data or 'complaint_text' not in data:
        return jsonify({
            "status": "error",
            "message": "Complaint text is required"
        }), 400
        
    text = data.get('complaint_text').strip()
    if not text:
        return jsonify({
            "status": "error",
            "message": "Complaint text cannot be empty"
        }), 400
        
    # Get parameters or predict on-the-fly
    category = data.get('category')
    priority = data.get('priority')
    sentiment_score = data.get('sentiment_score')
    
    # If UI hasn't pre-analyzed, run backend analysis
    if not category or not priority or sentiment_score is None:
        analysis = classifier.get_full_analysis(text)
        category = category or analysis["category"]
        priority = priority or analysis["priority"]
        sentiment_score = sentiment_score if sentiment_score is not None else analysis["sentiment_score"]
        
    try:
        saved_complaint = db.insert_complaint(
            text=text,
            category=category,
            priority=priority,
            sentiment_score=sentiment_score
        )
        return jsonify({
            "status": "success",
            "message": "Complaint submitted successfully",
            "complaint": saved_complaint
        }), 201
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Database insertion failed: {str(e)}"
        }), 500

@app.route('/api/get-complaints', methods=['GET'])
def get_complaints():
    """
    Endpoint to fetch list of complaints with filtering, search, and pagination.
    """
    search_query = request.args.get('search', '')
    category = request.args.get('category', 'All')
    priority = request.args.get('priority', 'All')
    status = request.args.get('status', 'All')
    
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
    except ValueError:
        return jsonify({
            "status": "error",
            "message": "Page and limit parameters must be integers"
        }), 400
        
    complaints, total = db.get_complaints(
        search_query=search_query,
        category=category,
        priority=priority,
        status=status,
        page=page,
        limit=limit
    )
    
    return jsonify({
        "status": "success",
        "complaints": complaints,
        "total": total,
        "page": page,
        "limit": limit
    }), 200

@app.route('/api/update-status/<complaint_id>', methods=['PUT'])
@token_required
def update_status(complaint_id):
    """
    Admin-only route. Updates the status of a complaint.
    """
    data = request.get_json()
    if not data or 'status' not in data:
        return jsonify({
            "status": "error",
            "message": "Status parameter is required"
        }), 400
        
    new_status = data.get('status')
    
    try:
        success = db.update_status(complaint_id, new_status)
        if success:
            return jsonify({
                "status": "success",
                "message": f"Complaint status updated successfully to: {new_status}"
            }), 200
        else:
            return jsonify({
                "status": "error",
                "message": f"Complaint with ID {complaint_id} not found"
            }), 404
    except ValueError as ve:
        return jsonify({
            "status": "error",
            "message": str(ve)
        }), 400
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Update failed: {str(e)}"
        }), 500

@app.route('/api/dashboard-stats', methods=['GET'])
@token_required
def dashboard_stats():
    """
    Admin-only route. Returns cumulative stats and distributions for charts.
    """
    try:
        stats = db.get_dashboard_stats()
        return jsonify({
            "status": "success",
            "stats": stats
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Could not compute dashboard stats: {str(e)}"
        }), 500

if __name__ == '__main__':
    # Get port from environment or default to 5000
    port = int(os.getenv("PORT", 5000))
    debug_mode = os.getenv("FLASK_ENV") == "development"
    
    print(f"Starting server on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=debug_mode)
