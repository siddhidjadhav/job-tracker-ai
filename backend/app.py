import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
# Enable CORS for all origins. In a production deployment,
# you should restrict this to your actual frontend domain(s) for security.
CORS(app)

HUNTER_IO_API_KEY = os.getenv('HUNTER_IO_API_KEY')
ROCKETREACH_API_KEY = os.getenv('ROCKETREACH_API_KEY')

@app.route('/')
def home():
    return "Job Tracker Backend is running!"

@app.route('/api/verify-email', methods=['POST'])
def verify_email():
    """
    API endpoint to verify an email address using Hunter.io and/or RocketReach.
    Requires 'email' and 'company_domain' in the request JSON body.
    """
    data = request.get_json()
    email = data.get('email')
    company_domain = data.get('company_domain')

    if not email or not company_domain:
        return jsonify({"error": "Email and company_domain are required"}), 400

    verification_status = "unverified"
    source = "none"
    confidence = "low" # Can be 'high', 'medium', 'low' based on API response

    # --- Hunter.io Verification ---
    if HUNTER_IO_API_KEY:
        hunter_url = f"https://api.hunter.io/v2/email-verifier?email={email}&api_key={HUNTER_IO_API_KEY}"
        try:
            hunter_response = requests.get(hunter_url, timeout=5).json()
            if hunter_response and hunter_response.get('data'):
                hunter_data = hunter_response['data']
                if hunter_data.get('status') == 'valid' and hunter_data.get('result') == 'deliverable':
                    verification_status = "verified"
                    source = "Hunter.io"
                    confidence = hunter_data.get('confidence', 'medium') # Hunter.io provides confidence score
                    print(f"Hunter.io: {email} -> {hunter_data.get('result')} (Confidence: {confidence})")
                    # If Hunter.io verifies, we often trust it and return
                    return jsonify({
                        "email": email,
                        "status": verification_status,
                        "source": source,
                        "confidence": confidence
                    }), 200
                else:
                    print(f"Hunter.io: {email} -> {hunter_data.get('result', 'unknown')}")
        except requests.exceptions.RequestException as e:
            print(f"Error calling Hunter.io API: {e}")
        except Exception as e:
            print(f"Unexpected error processing Hunter.io response: {e}")

    # --- RocketReach Verification (Conceptual Example - requires actual API lookup) ---
    # RocketReach is typically used to find emails, not just verify them.
    # This is a placeholder; you'd integrate real RocketReach logic here if applicable.
    # If Hunter.io failed, you might try RocketReach if it offers a direct verification endpoint.
    # Example conceptual RocketReach API call (check their docs for actual usage):
    if ROCKETREACH_API_KEY and verification_status == "unverified":
         # This would likely involve a POST request to a search/lookup endpoint
         # and then parsing results to confirm email deliverability.
         # For a simple direct verification, RocketReach might not be the primary tool.
         # You would need to consult RocketReach's specific API documentation here.
         pass # Placeholder for actual RocketReach verification logic

    # If neither API verified, return unverified status
    return jsonify({
        "email": email,
        "status": verification_status,
        "source": source,
        "confidence": confidence
    }), 200

if __name__ == '__main__':
    # In a production environment, use a WSGI server like Gunicorn or uWSGI.
    # For development, debug=True provides hot-reloading and debug info.
    app.run(debug=True, port=5000) # Run on port 5000