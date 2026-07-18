import os
from functools import wraps
import jwt
from datetime import datetime, timedelta, timezone
from flask import request, jsonify

# Secret key configuration for JWT signing
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "grievance_system_secret_key_998877")

def encode_auth_token(username):
    """
    Generates the Access Token with an expiration of 24 hours
    """
    try:
        payload = {
            'exp': datetime.now(timezone.utc) + timedelta(days=1),
            'iat': datetime.now(timezone.utc),
            'sub': username
        }
        return jwt.encode(
            payload,
            SECRET_KEY,
            algorithm='HS256'
        )
    except Exception as e:
        return str(e)

def token_required(f):
    """
    Decorator to secure routes with JWT tokens
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            # Support Bearer <token> format
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
            else:
                token = auth_header
                
        if not token:
            return jsonify({
                "status": "error",
                "message": "Authorization token is missing!"
            }), 401
            
        try:
            # Decode token
            payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            # Extract username and attach to request context
            request.current_user = payload['sub']
        except jwt.ExpiredSignatureError:
            return jsonify({
                "status": "error",
                "message": "Token has expired! Please log in again."
            }), 401
        except jwt.InvalidTokenError:
            return jsonify({
                "status": "error",
                "message": "Invalid token! Authorization denied."
            }), 401
            
        return f(*args, **kwargs)
        
    return decorated
