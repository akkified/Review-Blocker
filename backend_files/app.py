from flask import Flask, request, jsonify
from flask_cors import CORS
import random  # For simulating probabilities

app = Flask(__name__)
CORS(app)  # Enable CORS for your extension


# --- Placeholder for AI Detection Logic ---
def detect_ai_writing(text):
    """
    Simulates AI writing detection.
    In a real scenario, you'd integrate an actual AI detection library or API here.
    Returns (is_ai_written: bool, ai_probability: float)
    """
    text_lower = text.lower()

    # Simple heuristics for demonstration (NOT RELIABLE FOR PRODUCTION)
    is_ai = False
    ai_prob = random.uniform(0.05, 0.45)  # Default to lower probability

    # Keywords often found in simple AI-generated text
    ai_keywords = [
        "as an ai language model",
        "i cannot",
        "in conclusion",
        "overall",
        "it is important to note",
        "unlock your potential",
        "seamless integration"
    ]

    for keyword in ai_keywords:
        if keyword in text_lower:
            is_ai = True
            ai_prob = random.uniform(0.7, 0.99)  # Higher probability if keyword found
            break

    # Simulate higher AI probability for very generic positive or negative reviews
    if ("perfect product" in text_lower or "highly recommend" in text_lower) and not is_ai:
        if random.random() < 0.3:  # 30% chance of higher AI prob for generic phrases
            ai_prob = random.uniform(0.55, 0.75)
            is_ai = ai_prob > 0.65  # Threshold for this simulation

    # Final determination based on a simulated threshold for AI writing
    # In a real model, the model itself would give you this boolean or a clear score.
    if ai_prob > 0.5:  # Simple threshold for our simulation
        is_ai = True
    else:
        is_ai = False

    return is_ai, ai_prob


# --- Existing /analyze_review endpoint ---
@app.route('/analyze_review', methods=['POST'])
def analyze_review():
    data = request.json
    review_text = data.get('reviewText')

    if not review_text:
        return jsonify({"error": "No reviewText provided"}), 400

    # --- Simulated Fake Review Detection ---
    # This part still simulates your existing fake review model.
    is_fake_simulated = False
    prob_fake_simulated = random.uniform(0.05, 0.45)  # Default to lower probability

    if "scam" in review_text.lower() or "terrible quality" in review_text.lower():
        is_fake_simulated = True
        prob_fake_simulated = random.uniform(0.8, 0.99)
    elif "best product ever" in review_text.lower() or "must buy" in review_text.lower():
        is_fake_simulated = True
        prob_fake_simulated = random.uniform(0.75, 0.95)  # Higher fake prob for overly positive

    # Apply the 75% threshold you set in content.js.
    # We send the raw probability, and content.js will use its threshold.
    # This `is_fake_simulated` here is just for internal context if your model had its own internal threshold.
    # The crucial part is `prob_fake_simulated`.

    # --- NEW: AI Writing Detection ---
    is_ai_written, ai_probability = detect_ai_writing(review_text)

    response_data = {
        "reviewText": review_text,
        "isFake": is_fake_simulated,  # This field is less important now, content.js uses fakeProbability
        "fakeProbability": prob_fake_simulated,  # This is the key for fake detection in content.js
        "isAIWritten": is_ai_written,  # NEW AI detection boolean
        "aiProbability": ai_probability  # NEW AI probability score
    }

    return jsonify(response_data)


if __name__ == '__main__':
    app.run(debug=True, port=5000)