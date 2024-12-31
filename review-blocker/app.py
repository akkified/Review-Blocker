from flask import Flask, request, jsonify, render_template
import pickle
from sklearn.feature_extraction.text import TfidfVectorizer

app = Flask("ReviewVerify")

# Load the saved model and vectorizer
with open("model_and_vectorizer.pkl", "rb") as f:
    saved_data = pickle.load(f)

rf_loaded = saved_data["model"]
tfidf_loaded = saved_data["vectorizer"]

@app.route('/')
def home():
    return render_template("index.html")

@app.route('/predict', methods=['POST'])
def predict():
    try:
        # Get the input JSON data
        data = request.get_json()
        reviews = data.get("reviews", [])  # List of reviews

        if not reviews:
            return jsonify({"error": "No reviews provided"}), 400

        # Transform the input reviews using the TF-IDF vectorizer
        reviews_tfidf = tfidf_loaded.transform(reviews)

        # Predict using the loaded model
        predictions = rf_loaded.predict(reviews_tfidf)

        # Map predictions back to labels
        label_map = {0: "Fake", 1: "Genuine"}
        results = [label_map[pred] for pred in predictions]

        return jsonify({"predictions": results})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)